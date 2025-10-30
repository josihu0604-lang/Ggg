// Streak gamification service
// Manages daily streak tracking, milestones, and rewards

import { prisma } from '@zzik/database/src/client';
import { startOfDay, differenceInDays, addHours } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { TokenService } from './token.service';

const GRACE_PERIOD_HOURS = 12;
const DAILY_BONUS_TOKENS = 10; // Incremental bonus per day

// Milestone configuration
const MILESTONE_CONFIG = [
  { days: 3, name: '3-Day Starter', bonus: 50 },
  { days: 7, name: 'Week Warrior', bonus: 300 },
  { days: 14, name: 'Two-Week Titan', bonus: 700 },
  { days: 30, name: 'Month Master', bonus: 2000 },
  { days: 60, name: '60-Day Dragon', bonus: 5000 },
  { days: 100, name: 'Centurion', bonus: 10000 },
  { days: 365, name: 'Year Legend', bonus: 50000 }
];

export const StreakService = {
  /**
   * Process streak on check-in
   * Called AFTER successful check-in validation
   */
  async processCheckInStreak(params: {
    userId: string;
    checkInId: string;
    checkInTime: Date;
  }): Promise<{
    streakUpdated: boolean;
    currentStreak: number;
    bonusTokens: number;
    milestone?: { name: string; bonus: number; days: number };
    message: string;
  }> {
    const userTimezone = await this._getUserTimezone(params.userId);
    const checkInDate = startOfDay(utcToZonedTime(params.checkInTime, userTimezone));
    const today = startOfDay(utcToZonedTime(new Date(), userTimezone));

    // Only process once per day
    if (checkInDate < today) {
      return {
        streakUpdated: false,
        currentStreak: 0,
        bonusTokens: 0,
        message: 'Check-in is from a past date'
      };
    }

    // Get or create user streak
    let userStreak = await prisma.userStreak.findUnique({
      where: { userId: params.userId }
    });

    if (!userStreak) {
      userStreak = await prisma.userStreak.create({
        data: {
          userId: params.userId,
          currentStreak: 0,
          status: 'INACTIVE'
        }
      });
    }

    // Check if already checked in today
    if (userStreak.lastCheckInDate) {
      const lastCheckInDay = startOfDay(
        utcToZonedTime(userStreak.lastCheckInDate, userTimezone)
      );
      
      if (differenceInDays(today, lastCheckInDay) === 0) {
        return {
          streakUpdated: false,
          currentStreak: userStreak.currentStreak,
          bonusTokens: 0,
          message: 'Already checked in today'
        };
      }
    }

    // Calculate new streak
    const { newStreak, status, bonusTokens, milestone } = 
      await this._calculateNewStreak(userStreak, today, userTimezone);

    // Update streak in database (transaction)
    const result = await prisma.$transaction(async (tx) => {
      // Update UserStreak
      const updated = await tx.userStreak.update({
        where: { userId: params.userId },
        data: {
          currentStreak: newStreak,
          lastCheckInDate: params.checkInTime,
          status: 'ACTIVE',
          graceEndTime: null,
          longestStreak: Math.max(newStreak, userStreak!.longestStreak),
          totalStreakDays: { increment: 1 },
          streaksRecovered: status === 'recovered' ? { increment: 1 } : undefined,
          milestonesReached: milestone 
            ? this._addMilestone(userStreak!.milestonesReached as any, milestone.days)
            : undefined
        }
      });

      // Update User denormalized fields
      await tx.user.update({
        where: { id: params.userId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, userStreak!.longestStreak),
          lastCheckInDate: params.checkInTime
        }
      });

      // Create StreakHistory event
      const eventType = newStreak === 1 
        ? 'STREAK_STARTED'
        : milestone 
          ? 'STREAK_MILESTONE'
          : status === 'recovered'
            ? 'STREAK_RECOVERED'
            : 'STREAK_CONTINUED';

      await tx.streakHistory.create({
        data: {
          userStreakId: userStreak!.id,
          userId: params.userId,
          eventType,
          streakLength: newStreak,
          checkInId: params.checkInId,
          bonusTokens,
          metadata: milestone ? { milestone: milestone.name } : undefined
        }
      });

      // Award bonus tokens
      if (bonusTokens > 0) {
        await TokenService.awardBonusTokens({
          userId: params.userId,
          amount: bonusTokens,
          type: 'EARN_BONUS',
          description: milestone 
            ? `🎉 ${milestone.name} milestone (${newStreak} days)`
            : `🔥 ${newStreak}-day streak bonus`
        });
      }

      // Update check-in record with streak info
      await tx.validatedCheckIn.update({
        where: { id: params.checkInId },
        data: {
          streakDay: newStreak,
          streakBonus: bonusTokens
        }
      });

      return { updated, bonusTokens, milestone };
    });

    return {
      streakUpdated: true,
      currentStreak: newStreak,
      bonusTokens,
      milestone,
      message: milestone 
        ? `🎉 ${milestone.name} milestone! +${milestone.bonus} tokens`
        : newStreak === 1
          ? '🔥 Streak started!'
          : `🔥 ${newStreak}-day streak! +${bonusTokens} bonus tokens`
    };
  },

  /**
   * Calculate new streak based on last check-in
   */
  async _calculateNewStreak(
    userStreak: any,
    today: Date,
    userTimezone: string
  ): Promise<{
    newStreak: number;
    status: 'new' | 'continued' | 'recovered' | 'broken';
    bonusTokens: number;
    milestone?: { days: number; name: string; bonus: number };
  }> {
    if (!userStreak.lastCheckInDate) {
      return { newStreak: 1, status: 'new', bonusTokens: 0, milestone: undefined };
    }

    const lastCheckInDay = startOfDay(
      utcToZonedTime(userStreak.lastCheckInDate, userTimezone)
    );
    const daysSinceLastCheckIn = differenceInDays(today, lastCheckInDay);

    // Checked in yesterday → Continue streak
    if (daysSinceLastCheckIn === 1) {
      const newStreak = userStreak.currentStreak + 1;
      const bonusTokens = this._calculateBonusTokens(newStreak);
      const milestone = this._checkMilestone(newStreak);
      return { newStreak, status: 'continued', bonusTokens, milestone };
    }

    // Missed 1 day but within grace period → Recover streak
    if (
      daysSinceLastCheckIn === 2 &&
      userStreak.status === 'GRACE_PERIOD' &&
      userStreak.graceEndTime &&
      new Date() <= userStreak.graceEndTime
    ) {
      const newStreak = userStreak.currentStreak + 1;
      const bonusTokens = this._calculateBonusTokens(newStreak);
      return { newStreak, status: 'recovered', bonusTokens, milestone: undefined };
    }

    // Streak broken → Restart
    return { newStreak: 1, status: 'broken', bonusTokens: 0, milestone: undefined };
  },

  _calculateBonusTokens(streakDays: number): number {
    const dailyBonus = Math.min(streakDays * DAILY_BONUS_TOKENS, 500);
    return dailyBonus;
  },

  _checkMilestone(streakDays: number): typeof MILESTONE_CONFIG[0] | undefined {
    return MILESTONE_CONFIG.find(m => m.days === streakDays);
  },

  _addMilestone(existing: number[], newMilestone: number): number[] {
    const milestones = Array.isArray(existing) ? existing : [];
    if (!milestones.includes(newMilestone)) {
      milestones.push(newMilestone);
    }
    return milestones;
  },

  async _getUserTimezone(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true }
    });
    return user?.timezone || 'Asia/Seoul';
  },

  /**
   * Get streak status for user
   */
  async getStreakStatus(userId: string): Promise<any> {
    const streak = await prisma.userStreak.findUnique({
      where: { userId },
      select: {
        currentStreak: true,
        longestStreak: true,
        status: true,
        lastCheckInDate: true,
        graceEndTime: true,
        totalStreakDays: true,
        streaksBroken: true,
        streaksRecovered: true,
        milestonesReached: true
      }
    });

    if (!streak) {
      return {
        current: 0,
        longest: 0,
        status: 'INACTIVE',
        nextMilestone: MILESTONE_CONFIG[0]
      };
    }

    const nextMilestone = MILESTONE_CONFIG.find(
      m => m.days > streak.currentStreak
    );

    return {
      current: streak.currentStreak,
      longest: streak.longestStreak,
      status: streak.status,
      lastCheckInDate: streak.lastCheckInDate,
      graceEndTime: streak.graceEndTime,
      nextMilestone: nextMilestone ? {
        days: nextMilestone.days,
        name: nextMilestone.name,
        bonus: nextMilestone.bonus,
        daysRemaining: nextMilestone.days - streak.currentStreak,
        progress: streak.currentStreak / nextMilestone.days
      } : null,
      totalStreakDays: streak.totalStreakDays,
      streaksBroken: streak.streaksBroken,
      streaksRecovered: streak.streaksRecovered,
      milestonesReached: streak.milestonesReached
    };
  },

  /**
   * Cron job: Check for streaks entering grace period
   * Run every hour
   */
  async checkGracePeriods(): Promise<void> {
    const now = new Date();
    const midnightToday = startOfDay(now);

    const streaksAtRisk = await prisma.userStreak.findMany({
      where: {
        status: 'ACTIVE',
        currentStreak: { gt: 0 },
        lastCheckInDate: { lt: midnightToday }
      },
      select: { id: true, userId: true, currentStreak: true, lastCheckInDate: true }
    });

    for (const streak of streaksAtRisk) {
      const lastCheckInDay = startOfDay(streak.lastCheckInDate!);
      const daysSinceLastCheckIn = differenceInDays(midnightToday, lastCheckInDay);

      if (daysSinceLastCheckIn === 1) {
        // Enter grace period
        const graceEndTime = addHours(midnightToday, GRACE_PERIOD_HOURS);

        await prisma.userStreak.update({
          where: { id: streak.id },
          data: { status: 'GRACE_PERIOD', graceEndTime }
        });

        await prisma.streakHistory.create({
          data: {
            userStreakId: streak.id,
            userId: streak.userId,
            eventType: 'STREAK_GRACE',
            streakLength: streak.currentStreak
          }
        });
      } else if (daysSinceLastCheckIn > 1 || (streak.status === 'GRACE_PERIOD' && now > streak.graceEndTime!)) {
        // Break streak
        await prisma.userStreak.update({
          where: { id: streak.id },
          data: {
            currentStreak: 0,
            status: 'BROKEN',
            graceEndTime: null,
            streaksBroken: { increment: 1 }
          }
        });

        await prisma.user.update({
          where: { id: streak.userId },
          data: { currentStreak: 0 }
        });

        await prisma.streakHistory.create({
          data: {
            userStreakId: streak.id,
            userId: streak.userId,
            eventType: 'STREAK_BROKEN',
            streakLength: streak.currentStreak
          }
        });
      }
    }
  }
};

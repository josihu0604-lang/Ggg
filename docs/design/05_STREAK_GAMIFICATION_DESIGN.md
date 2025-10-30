# Streak Gamification System - Technical Design Document

**Version**: 1.0  
**Date**: 2025-10-29  
**Status**: 🟡 HIGH PRIORITY - MVP Feature (RICE: 16,000)  
**Timeline**: 5 days implementation

---

## Problem Statement

### Low Retention & Inconsistent Engagement

**Current User Behavior**:
```
Week 1: User discovers app → 5 check-ins (excited)
Week 2: Novelty wears off → 2 check-ins (declining)
Week 3: Forgets about app → 0 check-ins (churned)
Week 4: Uninstalls app ❌

Result:
├─ 7-day retention: 35% (industry avg: 40%)
├─ 30-day retention: 12% (industry avg: 15%)
└─ Avg check-ins per user: 8 (before churn)
```

**Core Issues**:
1. **No Habit Formation**: Users don't develop daily routine
2. **Lack of Continuity**: No reason to come back tomorrow specifically
3. **Missing Urgency**: No consequence for skipping days
4. **Low Investment**: Users don't feel loss when they abandon app

---

## Solution Overview

### Daily Streak System with Loss Aversion Psychology

**Gamification Mechanics**:
```
Day 1: First check-in → 🔥 Streak begins (100 tokens)
Day 2: Check-in again → 🔥 2-day streak (100 tokens + 10 bonus)
Day 3: Check-in again → 🔥 3-day streak (100 tokens + 20 bonus)
...
Day 7: Milestone! → 🎉 7-day streak (100 tokens + 300 bonus)
Day 8: Skip check-in → ⏰ Grace period (12 hours to recover)
Day 9: Still no check-in → 💔 Streak broken, reset to 0

Psychology:
├─ Endowment Effect: "I've built a 5-day streak, can't lose it now"
├─ Loss Aversion: Pain of losing streak > joy of gaining tokens
├─ Commitment Consistency: "I'm a daily user, I don't quit"
└─ Social Proof: "Top 10% of users maintain 30-day streaks"
```

**Expected Impact**:
- 7-day retention: 35% → 50% (+15% absolute)
- 30-day retention: 12% → 20% (+8% absolute)
- DAU/MAU ratio: 0.25 → 0.45 (healthy engagement)
- Avg check-ins per month: 8 → 18 (+125%)

**RICE Score Breakdown**:
```
Reach: 80% of active users (800 users/month)
Impact: +15% 7-day retention → 2.5 (scale 0-3)
Confidence: 80% (proven in Duolingo, Snapchat, Strava)
Effort: 5 days (1 engineer)

RICE = (800 × 2.5 × 0.8) / 5 = 16,000 ✅
```

---

## Database Schema

### New Tables

#### UserStreak
```prisma
model UserStreak {
  id              String   @id @default(cuid())
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId          String   @unique
  
  // Current streak
  currentStreak   Int      @default(0) // Days in a row
  lastCheckInDate DateTime? // Last check-in date (UTC midnight)
  
  // Streak status
  status          StreakStatus @default(INACTIVE)
  graceEndTime    DateTime? // 12-hour grace period expiry
  
  // Lifetime stats
  longestStreak   Int      @default(0)
  totalStreakDays Int      @default(0) // All-time streak days
  streaksBroken   Int      @default(0) // Times streak was broken
  streaksRecovered Int     @default(0) // Times recovered via grace period
  
  // Milestones achieved
  milestonesReached Json   @default("[]") // [3, 7, 14, 30, 100]
  
  // Notifications
  reminderEnabled   Boolean @default(true)
  reminderTime      String? // "20:00" (8 PM local time)
  lastReminderSent  DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  streakHistory   StreakHistory[]
  
  @@index([userId, status])
  @@index([lastCheckInDate])
}

enum StreakStatus {
  INACTIVE       // No active streak (0 days)
  ACTIVE         // Streak is active
  GRACE_PERIOD   // User missed day, has 12h to recover
  BROKEN         // Streak broken (after grace period)
}
```

#### StreakHistory
```prisma
model StreakHistory {
  id              String   @id @default(cuid())
  userStreak      UserStreak @relation(fields: [userStreakId], references: [id], onDelete: Cascade)
  userStreakId    String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId          String
  
  // Event details
  eventType       StreakEventType
  streakLength    Int      // Streak days when event occurred
  
  // Context
  checkIn         ValidatedCheckIn? @relation(fields: [checkInId], references: [id])
  checkInId       String?
  
  // Rewards
  bonusTokens     Int      @default(0)
  
  // Metadata
  metadata        Json?    // Additional context
  
  createdAt       DateTime @default(now())
  
  @@index([userId, createdAt])
  @@index([eventType, createdAt])
}

enum StreakEventType {
  STREAK_STARTED     // First check-in (day 1)
  STREAK_CONTINUED   // Daily check-in
  STREAK_MILESTONE   // Reached milestone (7, 14, 30, etc.)
  STREAK_GRACE       // Entered grace period (missed day)
  STREAK_RECOVERED   // Recovered during grace period
  STREAK_BROKEN      // Streak broken (after grace)
  STREAK_RESET       // Manual reset by user
}
```

#### StreakMilestone
```prisma
model StreakMilestone {
  id              String   @id @default(cuid())
  
  // Milestone configuration
  streakDays      Int      @unique // 3, 7, 14, 30, 60, 100, 365
  name            String   // "Week Warrior", "Month Master"
  bonusTokens     Int      // Bonus tokens awarded
  
  // Badge (optional)
  badgeIcon       String?  // Emoji or icon name
  badgeColor      String?  // Hex color
  
  // Notification
  notificationTitle String
  notificationBody  String
  
  enabled         Boolean  @default(true)
  createdAt       DateTime @default(now())
  
  @@index([streakDays])
}
```

---

### Modified Existing Tables

#### User (add streak fields)
```prisma
model User {
  // ... existing fields ...
  
  streak          UserStreak?
  streakHistory   StreakHistory[]
  
  // Quick access fields (denormalized for performance)
  currentStreak   Int      @default(0)
  longestStreak   Int      @default(0)
  lastCheckInDate DateTime?
}
```

#### ValidatedCheckIn (add streak reference)
```prisma
model ValidatedCheckIn {
  // ... existing fields ...
  
  // Streak context
  streakDay       Int?             // Which day of streak (1-indexed)
  streakBonus     Int      @default(0) // Bonus tokens from streak
  streakHistory   StreakHistory?
}
```

---

## Streak Logic

### Daily Check-in Flow

```typescript
// packages/shared/src/services/streak.service.ts

import { prisma } from '@zzik/database/src/client';
import { startOfDay, differenceInDays, addHours } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';

const GRACE_PERIOD_HOURS = 12;
const DAILY_BONUS_TOKENS = 10; // Incremental bonus per day
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
    milestone?: { name: string; bonus: number };
    message: string;
  }> {
    const userTimezone = await this._getUserTimezone(params.userId);
    const checkInDate = startOfDay(utcToZonedTime(params.checkInTime, userTimezone));
    const today = startOfDay(utcToZonedTime(new Date(), userTimezone));

    // Only process once per day (prevent multiple check-ins from double-counting)
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
        // Already checked in today
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

    // Update streak in database
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update UserStreak
      const updated = await tx.userStreak.update({
        where: { userId: params.userId },
        data: {
          currentStreak: newStreak,
          lastCheckInDate: params.checkInTime,
          status: 'ACTIVE',
          graceEndTime: null, // Clear grace period
          longestStreak: Math.max(newStreak, userStreak!.longestStreak),
          totalStreakDays: { increment: 1 },
          streaksRecovered: status === 'recovered' 
            ? { increment: 1 } 
            : undefined,
          milestonesReached: milestone 
            ? this._addMilestone(userStreak!.milestonesReached as any, milestone.days)
            : undefined
        }
      });

      // 2. Update User (denormalized fields)
      await tx.user.update({
        where: { id: params.userId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, userStreak!.longestStreak),
          lastCheckInDate: params.checkInTime
        }
      });

      // 3. Create StreakHistory event
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

      // 4. Award bonus tokens
      if (bonusTokens > 0) {
        await tx.tokenBalance.upsert({
          where: { userId: params.userId },
          create: {
            userId: params.userId,
            balance: bonusTokens,
            totalEarned: bonusTokens
          },
          update: {
            balance: { increment: bonusTokens },
            totalEarned: { increment: bonusTokens }
          }
        });

        await tx.tokenTransaction.create({
          data: {
            userId: params.userId,
            type: 'EARN_BONUS',
            amount: bonusTokens,
            description: milestone 
              ? `🎉 ${milestone.name} milestone (${newStreak} days)`
              : `🔥 ${newStreak}-day streak bonus`,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          }
        });
      }

      // 5. Update check-in record
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
    // No previous check-in → Start new streak
    if (!userStreak.lastCheckInDate) {
      return {
        newStreak: 1,
        status: 'new',
        bonusTokens: 0,
        milestone: undefined
      };
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

      return {
        newStreak,
        status: 'continued',
        bonusTokens,
        milestone
      };
    }

    // Missed 1 day, but within grace period → Recover streak
    if (
      daysSinceLastCheckIn === 2 &&
      userStreak.status === 'GRACE_PERIOD' &&
      userStreak.graceEndTime &&
      new Date() <= userStreak.graceEndTime
    ) {
      const newStreak = userStreak.currentStreak + 1;
      const bonusTokens = this._calculateBonusTokens(newStreak);

      return {
        newStreak,
        status: 'recovered',
        bonusTokens,
        milestone: undefined
      };
    }

    // Missed >1 day or grace period expired → Streak broken, restart
    return {
      newStreak: 1,
      status: 'broken',
      bonusTokens: 0,
      milestone: undefined
    };
  },

  /**
   * Calculate bonus tokens for streak day
   * Formula: 10 tokens per day (linear growth)
   */
  _calculateBonusTokens(streakDays: number): number {
    // Daily bonus: 10 tokens per day (capped at 500)
    const dailyBonus = Math.min(streakDays * DAILY_BONUS_TOKENS, 500);
    return dailyBonus;
  },

  /**
   * Check if streak reached a milestone
   */
  _checkMilestone(streakDays: number): 
    { days: number; name: string; bonus: number } | undefined {
    return MILESTONE_CONFIG.find(m => m.days === streakDays);
  },

  /**
   * Add milestone to achieved list
   */
  _addMilestone(existing: number[], newMilestone: number): number[] {
    const milestones = Array.isArray(existing) ? existing : [];
    if (!milestones.includes(newMilestone)) {
      milestones.push(newMilestone);
    }
    return milestones;
  },

  /**
   * Get user timezone (fallback to Asia/Seoul)
   */
  async _getUserTimezone(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true }
    });
    return user?.timezone || 'Asia/Seoul';
  },

  /**
   * Cron job: Check for streaks entering grace period
   * Run every hour
   */
  async checkGracePeriods(): Promise<void> {
    const now = new Date();
    const midnightToday = startOfDay(now);

    // Find users who haven't checked in today
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

      // Just missed today (1 day) → Enter grace period
      if (daysSinceLastCheckIn === 1) {
        const graceEndTime = addHours(midnightToday, GRACE_PERIOD_HOURS);

        await prisma.userStreak.update({
          where: { id: streak.id },
          data: {
            status: 'GRACE_PERIOD',
            graceEndTime
          }
        });

        await prisma.streakHistory.create({
          data: {
            userStreakId: streak.id,
            userId: streak.userId,
            eventType: 'STREAK_GRACE',
            streakLength: streak.currentStreak
          }
        });

        // Send grace period notification
        await this._sendGracePeriodNotification(streak.userId, graceEndTime);
      }

      // Missed >1 day or grace expired → Break streak
      if (
        daysSinceLastCheckIn > 1 ||
        (streak.status === 'GRACE_PERIOD' && now > streak.graceEndTime!)
      ) {
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
            streakLength: streak.currentStreak // Previous streak
          }
        });

        // Send streak broken notification
        await this._sendStreakBrokenNotification(
          streak.userId,
          streak.currentStreak
        );
      }
    }
  },

  /**
   * Send daily reminder notification
   * Run at user's preferred time (e.g., 8 PM)
   */
  async sendDailyReminders(): Promise<void> {
    const now = new Date();
    const currentHour = now.getUTCHours();

    // Find users who want reminders at this hour
    const streaks = await prisma.userStreak.findMany({
      where: {
        reminderEnabled: true,
        reminderTime: { not: null },
        status: { in: ['ACTIVE', 'GRACE_PERIOD'] }
      },
      select: { 
        id: true, 
        userId: true, 
        reminderTime: true, 
        currentStreak: true,
        lastCheckInDate: true
      }
    });

    for (const streak of streaks) {
      const [hour] = streak.reminderTime!.split(':').map(Number);
      
      // Check if it's this user's reminder time
      if (hour === currentHour) {
        const lastCheckInDay = startOfDay(streak.lastCheckInDate!);
        const today = startOfDay(new Date());

        // Only send if haven't checked in today
        if (differenceInDays(today, lastCheckInDay) > 0) {
          await this._sendDailyReminderNotification(
            streak.userId,
            streak.currentStreak
          );

          await prisma.userStreak.update({
            where: { id: streak.id },
            data: { lastReminderSent: now }
          });
        }
      }
    }
  },

  async _sendGracePeriodNotification(userId: string, graceEndTime: Date): Promise<void> {
    // TODO: Integrate with PushNotificationService
    console.log(`⏰ Grace period notification for user ${userId}, expires: ${graceEndTime}`);
  },

  async _sendStreakBrokenNotification(userId: string, previousStreak: number): Promise<void> {
    console.log(`💔 Streak broken notification for user ${userId}, was: ${previousStreak} days`);
  },

  async _sendDailyReminderNotification(userId: string, currentStreak: number): Promise<void> {
    console.log(`🔔 Daily reminder for user ${userId}, streak: ${currentStreak} days`);
  }
};
```

---

## API Design

### Get Streak Status

#### GET /api/v1/streak/status

**Purpose**: Get user's current streak status

**Response**:
```typescript
{
  streak: {
    current: 14,
    longest: 28,
    status: 'ACTIVE', // or 'GRACE_PERIOD', 'INACTIVE', 'BROKEN'
    lastCheckInDate: '2025-10-28T12:00:00Z',
    graceEndTime: null, // or ISO datetime if in grace period
    
    // Progress to next milestone
    nextMilestone: {
      days: 30,
      name: 'Month Master',
      bonus: 2000,
      daysRemaining: 16,
      progress: 0.47 // 14/30
    },
    
    // Lifetime stats
    totalStreakDays: 142,
    streaksBroken: 3,
    streaksRecovered: 1,
    milestonesReached: [3, 7, 14]
  },
  
  // Bonus tokens projection
  bonusTokens: {
    today: 140, // 14 days × 10 tokens
    tomorrow: 150,
    nextMilestone: 2000
  },
  
  // Reminder settings
  reminder: {
    enabled: true,
    time: '20:00', // 8 PM local time
    lastSent: '2025-10-27T20:00:00Z'
  }
}
```

---

### Update Reminder Settings

#### POST /api/v1/streak/reminder

**Purpose**: Configure daily streak reminders

**Request**:
```typescript
{
  enabled: true,
  time: '20:00', // 24-hour format (local time)
  timezone: 'Asia/Seoul'
}
```

**Response**:
```typescript
{
  success: true,
  reminder: {
    enabled: true,
    time: '20:00',
    nextReminderAt: '2025-10-29T20:00:00Z'
  }
}
```

---

### Get Streak Leaderboard

#### GET /api/v1/streak/leaderboard

**Purpose**: Show top streaks (social proof)

**Query Params**:
- `type`: `current` | `longest` (default: `current`)
- `limit`: number (default: 50)

**Response**:
```typescript
{
  leaderboard: [
    {
      rank: 1,
      userId: 'user_xxx',
      username: 'John D.', // Privacy: first name + initial
      currentStreak: 127,
      longestStreak: 180,
      avatar: 'https://...'
    },
    {
      rank: 2,
      userId: 'user_yyy',
      username: 'Sarah K.',
      currentStreak: 98,
      longestStreak: 98,
      avatar: 'https://...'
    }
    // ... top 50
  ],
  
  currentUser: {
    rank: 143,
    currentStreak: 14,
    longestStreak: 28,
    percentile: 78 // Top 22% of users
  }
}
```

---

### Get Streak History

#### GET /api/v1/streak/history

**Purpose**: Show user's streak history and milestones

**Query Params**:
- `limit`: number (default: 50)
- `eventTypes`: array of StreakEventType (optional filter)

**Response**:
```typescript
{
  history: [
    {
      id: 'hist_xxx',
      eventType: 'STREAK_MILESTONE',
      streakLength: 14,
      bonusTokens: 700,
      metadata: { milestone: 'Two-Week Titan' },
      createdAt: '2025-10-28T12:00:00Z'
    },
    {
      eventType: 'STREAK_CONTINUED',
      streakLength: 13,
      bonusTokens: 130,
      createdAt: '2025-10-27T10:30:00Z'
    },
    {
      eventType: 'STREAK_GRACE',
      streakLength: 12,
      bonusTokens: 0,
      createdAt: '2025-10-26T00:00:00Z'
    },
    {
      eventType: 'STREAK_RECOVERED',
      streakLength: 12,
      bonusTokens: 120,
      createdAt: '2025-10-26T09:00:00Z'
    }
    // ... last 50 events
  ],
  
  summary: {
    totalEvents: 245,
    streaksContinued: 220,
    milestonesReached: 6,
    streaksRecovered: 2,
    streaksBroken: 3
  }
}
```

---

## Notification Strategy

### Push Notification Templates

```typescript
// packages/shared/src/templates/streak-notifications.ts

export const StreakNotificationTemplates = {
  dailyReminder: {
    active: {
      title: (streak: number) => `🔥 Don't break your ${streak}-day streak!`,
      body: 'Check-in today to keep your streak alive and earn bonus tokens.'
    },
    gracePeriod: {
      title: (streak: number, hoursLeft: number) => 
        `⏰ ${hoursLeft}h left to save your ${streak}-day streak!`,
      body: 'Check-in now before your grace period expires.'
    }
  },

  milestone: {
    title: (name: string, days: number) => 
      `🎉 ${name} milestone! ${days} days!`,
    body: (bonus: number) => 
      `You've earned ${bonus.toLocaleString()} bonus tokens! Keep it going!`
  },

  streakBroken: {
    title: (previousStreak: number) => 
      `💔 Your ${previousStreak}-day streak ended`,
    body: 'Start a new streak today and beat your previous record!'
  },

  weeklyProgress: {
    title: (streak: number) => `🔥 Week recap: ${streak}-day streak`,
    body: (tokensEarned: number) => 
      `You earned ${tokensEarned} bonus tokens this week. Keep going!`
  }
};
```

### Notification Timing

```typescript
const NOTIFICATION_SCHEDULE = {
  // Daily reminder at user's preferred time (default: 8 PM)
  dailyReminder: {
    time: 'user.reminderTime', // e.g., '20:00'
    condition: 'not checked in today'
  },

  // Grace period warning (sent when entering grace period)
  gracePeriodStart: {
    trigger: 'midnight + 1 minute',
    condition: 'streak status = GRACE_PERIOD'
  },

  // Urgent reminder before grace expires
  gracePeriodUrgent: {
    trigger: 'grace end time - 2 hours',
    condition: 'still not checked in'
  },

  // Milestone celebration (immediate)
  milestone: {
    trigger: 'check-in completion',
    condition: 'milestone reached'
  },

  // Streak broken notification (next morning)
  streakBroken: {
    trigger: 'grace period expired + 8 hours',
    condition: 'streak broken'
  },

  // Weekly progress summary (every Sunday 6 PM)
  weeklyProgress: {
    time: 'Sunday 18:00',
    condition: 'active user'
  }
};
```

---

## UI/UX Design

### Streak Widget (Home Screen)

```typescript
// apps/web/components/StreakWidget.tsx

interface StreakWidgetProps {
  streak: {
    current: number;
    status: 'ACTIVE' | 'GRACE_PERIOD' | 'INACTIVE';
    graceEndTime?: Date;
    nextMilestone: {
      days: number;
      name: string;
      daysRemaining: number;
    };
  };
}

// Visual representation:
┌─────────────────────────────────────┐
│  🔥 14-Day Streak                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  47% to Month Master (16 days left)│
│                                     │
│  ⭐ Next milestone: +2,000 tokens  │
└─────────────────────────────────────┘

// Grace period state:
┌─────────────────────────────────────┐
│  ⏰ 14-Day Streak (Grace Period)    │
│  🚨 10h 23m left to check-in!       │
│                                     │
│  [Check-in Now] button (pulsing)   │
└─────────────────────────────────────┘
```

### Milestone Celebration Animation

```typescript
// When user reaches milestone:
1. Confetti animation (3 seconds)
2. Modal popup:
   ┌─────────────────────────────────────┐
   │  🎉 TWO-WEEK TITAN! 🎉             │
   │                                     │
   │  14-day streak milestone reached!  │
   │                                     │
   │  +700 bonus tokens earned          │
   │                                     │
   │  Next: Month Master (30 days)      │
   │                                     │
   │  [Keep Going!]                     │
   └─────────────────────────────────────┘
3. Auto-dismiss after 5 seconds
```

### Streak Calendar View

```typescript
// Visual monthly calendar showing check-in history:
┌─────────────────────────────────────┐
│  October 2025                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Sun Mon Tue Wed Thu Fri Sat        │
│   1   2   3   4   5   6   7         │
│  🔥  🔥  🔥  🔥  🔥  🔥  🔥        │
│                                     │
│   8   9  10  11  12  13  14         │
│  🔥  ❌  🔥  🔥  🔥  🔥  🔥        │
│         (streak broken)             │
│                                     │
│  15  16  17  18  19  20  21         │
│  🔥  🔥  🔥  🔥  🔥  🔥  🔥  ⭐    │
│                        (milestone) │
└─────────────────────────────────────┘

Legend:
🔥 = Check-in completed
❌ = Streak broken
⭐ = Milestone reached
⏰ = Grace period
```

---

## Gamification Psychology Principles

### 1. Loss Aversion (Kahneman & Tversky)
**Principle**: Loss of 5-day streak feels worse than gaining 5-day streak feels good

**Implementation**:
- Grace period gives users chance to "save" their streak
- Streak broken notification emphasizes what was lost
- Visual countdown timer during grace period (urgency)

---

### 2. Endowment Effect
**Principle**: Users value what they've already built (streak) more than potential gains

**Implementation**:
- Streak counter always visible (constant reminder of investment)
- Weekly recap shows cumulative effort
- Leaderboard shows how much effort would be "wasted"

---

### 3. Commitment & Consistency (Cialdini)
**Principle**: Once people commit to a behavior, they feel pressure to maintain it

**Implementation**:
- First 3 days are easiest to build habit
- Public leaderboard creates social commitment
- Badges and milestones reinforce identity ("I'm a consistent user")

---

### 4. Variable Rewards (Skinner)
**Principle**: Unpredictable rewards increase engagement

**Implementation**:
- Milestone bonuses are large and exciting (7d: 300, 14d: 700, 30d: 2000)
- Surprise bonus tokens for recovering from grace period
- Random "streak saver" power-ups (future feature)

---

### 5. Social Proof
**Principle**: People follow the behavior of others

**Implementation**:
- Leaderboard shows top streakers
- Percentile ranking ("You're in top 22%!")
- Share streak milestones on social media

---

## Testing Strategy

### Unit Tests

```typescript
// packages/shared/tests/unit/streak.service.test.ts

describe('StreakService', () => {
  it('should start new streak on first check-in', async () => {
    const result = await StreakService.processCheckInStreak({
      userId: 'user_test',
      checkInId: 'checkin_test',
      checkInTime: new Date()
    });

    expect(result.currentStreak).toBe(1);
    expect(result.bonusTokens).toBe(0); // No bonus on first day
  });

  it('should continue streak on consecutive day', async () => {
    // Setup: User checked in yesterday
    await setupUserWithStreak('user_test', 5, yesterday());

    const result = await StreakService.processCheckInStreak({
      userId: 'user_test',
      checkInId: 'checkin_test',
      checkInTime: new Date()
    });

    expect(result.currentStreak).toBe(6);
    expect(result.bonusTokens).toBe(60); // 6 days × 10
  });

  it('should award milestone bonus at day 7', async () => {
    await setupUserWithStreak('user_test', 6, yesterday());

    const result = await StreakService.processCheckInStreak({
      userId: 'user_test',
      checkInId: 'checkin_test',
      checkInTime: new Date()
    });

    expect(result.currentStreak).toBe(7);
    expect(result.bonusTokens).toBe(300); // Week Warrior milestone
    expect(result.milestone).toEqual({
      days: 7,
      name: 'Week Warrior',
      bonus: 300
    });
  });

  it('should enter grace period if missed 1 day', async () => {
    await setupUserWithStreak('user_test', 5, twoDaysAgo());

    await StreakService.checkGracePeriods();

    const streak = await prisma.userStreak.findUnique({
      where: { userId: 'user_test' }
    });

    expect(streak.status).toBe('GRACE_PERIOD');
    expect(streak.graceEndTime).toBeDefined();
  });

  it('should recover streak if check-in during grace period', async () => {
    await setupUserWithStreakInGrace('user_test', 5, yesterday(), futureHours(10));

    const result = await StreakService.processCheckInStreak({
      userId: 'user_test',
      checkInId: 'checkin_test',
      checkInTime: new Date()
    });

    expect(result.currentStreak).toBe(6);
    expect(result.message).toContain('recovered');
  });

  it('should break streak if grace period expired', async () => {
    await setupUserWithStreakInGrace('user_test', 5, twoDaysAgo(), pastHours(1));

    await StreakService.checkGracePeriods();

    const streak = await prisma.userStreak.findUnique({
      where: { userId: 'user_test' }
    });

    expect(streak.status).toBe('BROKEN');
    expect(streak.currentStreak).toBe(0);
  });

  it('should not double-count same-day check-ins', async () => {
    await setupUserWithStreak('user_test', 5, today());

    const result = await StreakService.processCheckInStreak({
      userId: 'user_test',
      checkInId: 'checkin_test2',
      checkInTime: new Date()
    });

    expect(result.streakUpdated).toBe(false);
    expect(result.currentStreak).toBe(5); // Unchanged
  });
});
```

---

## Monitoring & Analytics

### Key Metrics

```typescript
const streakMetrics = {
  // Engagement
  activeStreaksTotal: new Gauge({
    name: 'zzik_streaks_active_total',
    help: 'Number of users with active streaks'
  }),

  streakDistribution: new Histogram({
    name: 'zzik_streak_length_distribution',
    help: 'Distribution of streak lengths',
    buckets: [1, 3, 7, 14, 30, 60, 100, 365]
  }),

  // Retention
  streakRetentionRate: new Gauge({
    name: 'zzik_streak_retention_rate',
    help: '% of users maintaining streak after N days',
    labelNames: ['days'] // 3, 7, 14, 30
  }),

  // Events
  streakEventsTotal: new Counter({
    name: 'zzik_streak_events_total',
    help: 'Total streak events',
    labelNames: ['event_type'] // STARTED, CONTINUED, MILESTONE, BROKEN
  }),

  // Grace period
  gracePeriodRecoveryRate: new Gauge({
    name: 'zzik_grace_period_recovery_rate',
    help: '% of grace periods that were recovered'
  }),

  // Notifications
  streakNotificationsSent: new Counter({
    name: 'zzik_streak_notifications_sent',
    help: 'Streak notifications sent',
    labelNames: ['type'] // REMINDER, GRACE, MILESTONE, BROKEN
  }),

  streakNotificationOpenRate: new Histogram({
    name: 'zzik_streak_notification_open_rate',
    help: 'Notification open rate by type',
    labelNames: ['type']
  })
};
```

---

## Success Metrics (30 Days Post-Launch)

```
Retention Impact:
├─ 7-day retention: 35% → 50% (+15% absolute) ✅ Target
├─ 30-day retention: 12% → 20% (+8% absolute) ✅ Target
├─ DAU/MAU ratio: 0.25 → 0.45 ✅ Target
└─ Avg check-ins per month: 8 → 18 (+125%) ✅ Target

Streak Adoption:
├─ % users who start a streak: Target 80%
├─ % users who reach day 7: Target 35%
├─ % users who reach day 30: Target 10%
└─ Avg active streak length: Target 12 days

Grace Period Performance:
├─ % entering grace period: Expected 25%
├─ % recovering from grace: Target 60%
├─ % breaking streak: Expected 40%
└─ Grace period notification open rate: Target 70%

Token Economics:
├─ Bonus tokens issued per month: Expected ₩15M deferred
├─ Avg bonus tokens per user: Expected 1,200/month
├─ Milestone bonus distribution: 7d (60%), 14d (25%), 30d (10%)
└─ Total token liability: Expected <₩25M (manageable)
```

---

## Rollout Plan

### Week 1: Internal Testing
- Deploy to staging
- Team tests for 7 days to build streaks
- Verify notification timing
- Test grace period recovery

### Week 2: Closed Beta (100 users)
- Invite power users (high check-in frequency)
- Monitor streak adoption rate
- Collect qualitative feedback on UX
- A/B test notification times

### Week 3: Gradual Rollout (20% → 100%)
- Day 1: 20% of users (feature flag)
- Day 3: 50% of users
- Day 5: 80% of users
- Day 7: 100% of users
- Monitor retention impact daily

### Week 4: Optimization
- Analyze retention lift
- Adjust bonus token amounts if needed
- Optimize notification copy based on open rates
- Launch leaderboard feature

---

## Future Enhancements (Phase 2)

### 1. Streak Freeze Power-Up
**Feature**: Allow users to "freeze" streak for 1 day (once per month)
**Use Case**: Planned vacation, sick day
**Implementation**: Add `freezesRemaining` to UserStreak table

### 2. Streak Insurance
**Feature**: Pay 500 tokens to extend grace period to 24h
**Monetization**: Premium feature or in-app purchase
**Psychology**: Loss aversion (worth paying to save streak)

### 3. Team Streaks
**Feature**: Create streak with friends, all must check-in daily
**Use Case**: Accountability partner, social motivation
**Implementation**: New `TeamStreak` table with members

### 4. Streak Challenges
**Feature**: "30-day streak challenge" with leaderboard
**Reward**: Exclusive badge, bonus tokens
**Timing**: Monthly recurring event

### 5. Personalized Milestone Rewards
**Feature**: Let users choose reward type (tokens vs vouchers)
**Implementation**: Add `milestoneRewardPreference` field
**Psychology**: Autonomy increases engagement

---

## Conclusion

Streak gamification is a proven retention mechanism:

**Expected Impact**:
- 7-day retention: +15% absolute (35% → 50%)
- 30-day retention: +8% absolute (12% → 20%)
- Check-ins per user: +125% (8 → 18/month)
- DAU/MAU ratio: +80% (0.25 → 0.45)

**Key Features**:
1. Daily streak counter with bonus tokens
2. 7 milestone tiers (3d → 365d)
3. 12-hour grace period (loss aversion)
4. Push notifications (reminders + celebrations)
5. Leaderboard (social proof)

**Implementation**: 5 days for MVP
**Psychology**: Loss aversion + endowment effect + commitment consistency
**Risk**: Low (proven mechanic, low technical complexity)

---

**Next Steps**:
1. Review this design document
2. Create database migration
3. Implement StreakService
4. Build UI components
5. Set up cron jobs
6. Launch closed beta


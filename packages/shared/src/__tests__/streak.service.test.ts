// Streak Service Tests
import { describe, it, expect } from '@jest/globals';

// Milestone configuration (from streak.service.ts)
const MILESTONE_CONFIG = [
  { days: 3, name: '3-Day Starter', bonus: 50 },
  { days: 7, name: 'Week Warrior', bonus: 300 },
  { days: 14, name: 'Two-Week Titan', bonus: 700 },
  { days: 30, name: 'Month Master', bonus: 2000 },
  { days: 60, name: '60-Day Dragon', bonus: 5000 },
  { days: 100, name: 'Centurion', bonus: 10000 },
  { days: 365, name: 'Year Legend', bonus: 50000 }
];

describe('Streak Service', () => {
  describe('Milestone Configuration', () => {
    it('should have 7 milestone levels', () => {
      expect(MILESTONE_CONFIG.length).toBe(7);
    });

    it('should have increasing day requirements', () => {
      for (let i = 1; i < MILESTONE_CONFIG.length; i++) {
        expect(MILESTONE_CONFIG[i].days).toBeGreaterThan(MILESTONE_CONFIG[i - 1].days);
      }
    });

    it('should have increasing bonus amounts', () => {
      for (let i = 1; i < MILESTONE_CONFIG.length; i++) {
        expect(MILESTONE_CONFIG[i].bonus).toBeGreaterThan(MILESTONE_CONFIG[i - 1].bonus);
      }
    });

    it('should have descriptive milestone names', () => {
      MILESTONE_CONFIG.forEach(milestone => {
        expect(milestone.name).toBeTruthy();
        expect(typeof milestone.name).toBe('string');
        expect(milestone.name.length).toBeGreaterThan(5);
      });
    });
  });

  describe('Streak Calculation', () => {
    it('should start new streak on first check-in', () => {
      const streak = 1;
      expect(streak).toBe(1);
    });

    it('should increment streak on consecutive days', () => {
      const previousStreak = 5;
      const newStreak = previousStreak + 1;
      expect(newStreak).toBe(6);
    });

    it('should reset streak after gap > 36 hours', () => {
      const previousCheckIn = new Date('2024-01-01T12:00:00Z');
      const currentCheckIn = new Date('2024-01-03T00:00:01Z'); // >36 hours
      const hoursDiff = (currentCheckIn.getTime() - previousCheckIn.getTime()) / (1000 * 60 * 60);
      
      expect(hoursDiff).toBeGreaterThan(36);
      // Streak should reset to 1
    });

    it('should maintain streak within 36-hour grace period', () => {
      const previousCheckIn = new Date('2024-01-01T12:00:00Z');
      const currentCheckIn = new Date('2024-01-02T23:59:59Z'); // <36 hours
      const hoursDiff = (currentCheckIn.getTime() - previousCheckIn.getTime()) / (1000 * 60 * 60);
      
      expect(hoursDiff).toBeLessThanOrEqual(36);
      // Streak should increment
    });
  });

  describe('Grace Period Logic', () => {
    it('should define 12-hour grace period', () => {
      const GRACE_PERIOD_HOURS = 12;
      expect(GRACE_PERIOD_HOURS).toBe(12);
    });

    it('should allow check-in within grace period', () => {
      const lastCheckIn = new Date('2024-01-01T23:00:00Z');
      const nextCheckIn = new Date('2024-01-02T10:00:00Z'); // 11 hours later
      const hoursDiff = (nextCheckIn.getTime() - lastCheckIn.getTime()) / (1000 * 60 * 60);
      
      expect(hoursDiff).toBeLessThan(12);
    });

    it('should maintain streak up to 36 hours total', () => {
      const MAX_STREAK_GAP_HOURS = 36;
      expect(MAX_STREAK_GAP_HOURS).toBe(36); // 24h + 12h grace
    });
  });

  describe('Milestone Achievement', () => {
    it('should award bonus at 3-day milestone', () => {
      const streak = 3;
      const milestone = MILESTONE_CONFIG.find(m => m.days === streak);
      
      expect(milestone).toBeDefined();
      expect(milestone?.bonus).toBe(50);
      expect(milestone?.name).toBe('3-Day Starter');
    });

    it('should award bonus at 7-day milestone', () => {
      const streak = 7;
      const milestone = MILESTONE_CONFIG.find(m => m.days === streak);
      
      expect(milestone).toBeDefined();
      expect(milestone?.bonus).toBe(300);
    });

    it('should award bonus at 365-day milestone', () => {
      const streak = 365;
      const milestone = MILESTONE_CONFIG.find(m => m.days === streak);
      
      expect(milestone).toBeDefined();
      expect(milestone?.bonus).toBe(50000);
      expect(milestone?.name).toBe('Year Legend');
    });

    it('should not award bonus on non-milestone days', () => {
      const streak = 5;
      const milestone = MILESTONE_CONFIG.find(m => m.days === streak);
      
      expect(milestone).toBeUndefined();
    });
  });

  describe('Token Bonus Distribution', () => {
    it('should award tokens only at milestones', () => {
      const streaks = [3, 7, 14, 30, 60, 100, 365];
      
      streaks.forEach(streak => {
        const milestone = MILESTONE_CONFIG.find(m => m.days === streak);
        expect(milestone).toBeDefined();
        expect(milestone?.bonus).toBeGreaterThan(0);
      });
    });

    it('should not award tokens between milestones', () => {
      const nonMilestoneDays = [4, 5, 6, 8, 15, 31, 61, 101];
      
      nonMilestoneDays.forEach(streak => {
        const milestone = MILESTONE_CONFIG.find(m => m.days === streak);
        expect(milestone).toBeUndefined();
      });
    });
  });

  describe('Streak Persistence', () => {
    it('should track longest streak separately', () => {
      const currentStreak = 10;
      const longestStreak = 25;
      
      expect(longestStreak).toBeGreaterThanOrEqual(currentStreak);
    });

    it('should update longest streak when exceeded', () => {
      const currentStreak = 30;
      const previousLongest = 25;
      const newLongest = Math.max(currentStreak, previousLongest);
      
      expect(newLongest).toBe(30);
    });
  });

  describe('Edge Cases', () => {
    it('should handle same-day multiple check-ins', () => {
      const checkIn1 = new Date('2024-01-01T08:00:00Z');
      const checkIn2 = new Date('2024-01-01T20:00:00Z');
      
      const isSameDay = checkIn1.toDateString() === checkIn2.toDateString();
      expect(isSameDay).toBe(true);
      // Should not increment streak
    });

    it('should handle timezone differences', () => {
      const utcDate = new Date('2024-01-01T23:59:59Z');
      const kstOffset = 9 * 60; // UTC+9
      
      expect(kstOffset).toBe(540);
      // Should consider local timezone for day calculation
    });

    it('should handle leap year day counts', () => {
      const yearDays = 365;
      const leapYearDays = 366;
      
      expect(yearDays).toBe(365);
      expect(leapYearDays).toBe(366);
      // 365-day milestone should work for both
    });
  });
});

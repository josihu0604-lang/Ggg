'use server';

import { prisma } from '@zzik/database';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  stats: {
    totalCheckIns: number;
    followers: number;
    following: number;
    totalTokens: number;
    currentStreak: number;
    level: 'FREE' | 'PREMIUM';
  };
  recentActivity: Array<{
    id: string;
    type: 'check-in' | 'token-earned' | 'milestone';
    title: string;
    timestamp: Date;
    icon: string;
  }>;
}

/**
 * Get user profile data
 * Mock data for now - will connect to real DB and auth when configured
 */
export async function getUserProfile(userId?: string): Promise<UserProfile> {
  try {
    if (!process.env.DATABASE_URL || !userId) {
      console.log('[Profile] Using mock data');
      return getMockProfile();
    }

    // Fetch real user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tokenBalance: true,
        streak: true,
        subscription: true,
        checkIns: {
          take: 5,
          orderBy: { checkedAt: 'desc' },
          include: {
            poi: { select: { name: true } },
          },
        },
      },
    });

    if (!user) {
      return getMockProfile();
    }

    return {
      id: user.id,
      name: user.name || 'ZZIK User',
      email: user.email,
      avatar: user.avatar || undefined,
      stats: {
        totalCheckIns: user.totalCheckIns,
        followers: 0, // TODO: Implement social features
        following: 0,
        totalTokens: user.tokenBalance?.balance || 0,
        currentStreak: user.currentStreak,
        level: user.subscription?.tier || 'FREE',
      },
      recentActivity: user.checkIns.map((ci) => ({
        id: ci.id,
        type: 'check-in' as const,
        title: `${ci.poi.name}에서 체크인`,
        timestamp: ci.checkedAt,
        icon: '📍',
      })),
    };
  } catch (error) {
    console.error('[Profile] Error fetching profile:', error);
    return getMockProfile();
  }
}

/**
 * Mock profile data for development
 */
function getMockProfile(): UserProfile {
  const now = new Date();
  return {
    id: 'mock-user-1',
    name: 'ZZIK 사용자',
    email: 'user@zzik.app',
    stats: {
      totalCheckIns: 127,
      followers: 42,
      following: 68,
      totalTokens: 15_420,
      currentStreak: 7,
      level: 'FREE',
    },
    recentActivity: [
      {
        id: '1',
        type: 'check-in',
        title: '스타벅스 강남역점에서 체크인',
        timestamp: new Date(now.getTime() - 2 * 3600000),
        icon: '☕',
      },
      {
        id: '2',
        type: 'token-earned',
        title: '100 토큰 획득',
        timestamp: new Date(now.getTime() - 2 * 3600000),
        icon: '💰',
      },
      {
        id: '3',
        type: 'milestone',
        title: '7일 연속 체크인 달성!',
        timestamp: new Date(now.getTime() - 12 * 3600000),
        icon: '🔥',
      },
      {
        id: '4',
        type: 'check-in',
        title: '교보문고 광화문점에서 체크인',
        timestamp: new Date(now.getTime() - 26 * 3600000),
        icon: '📚',
      },
      {
        id: '5',
        type: 'check-in',
        title: '남산공원에서 체크인',
        timestamp: new Date(now.getTime() - 50 * 3600000),
        icon: '🌳',
      },
    ],
  };
}

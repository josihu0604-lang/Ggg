'use server';

import { prisma } from '@zzik/database';

export interface CheckInFeedItem {
  id: string;
  poiName: string;
  poiCategory: string;
  tokensEarned: number;
  distance: number;
  checkedAt: Date;
  userTier: string;
  location: {
    lat: number;
    lng: number;
  };
}

/**
 * Get recent check-ins for feed display
 * Mock data for now - will connect to real DB when DATABASE_URL is configured
 */
export async function getRecentCheckIns(limit = 10): Promise<CheckInFeedItem[]> {
  try {
    // Check if database is connected
    if (!process.env.DATABASE_URL) {
      console.log('[Feed] DATABASE_URL not configured, returning mock data');
      return getMockCheckIns(limit);
    }

    // Fetch real data from database
    const checkIns = await prisma.validatedCheckIn.findMany({
      take: limit,
      orderBy: {
        checkedAt: 'desc',
      },
      include: {
        poi: {
          select: {
            name: true,
            category: true,
            lat: true,
            lng: true,
          },
        },
      },
    });

    return checkIns.map((ci) => ({
      id: ci.id,
      poiName: ci.poi.name,
      poiCategory: ci.poi.category,
      tokensEarned: ci.tokensEarned,
      distance: ci.distance,
      checkedAt: ci.checkedAt,
      userTier: ci.userTier,
      location: {
        lat: ci.poi.lat,
        lng: ci.poi.lng,
      },
    }));
  } catch (error) {
    console.error('[Feed] Error fetching check-ins:', error);
    // Fallback to mock data on error
    return getMockCheckIns(limit);
  }
}

/**
 * Mock check-in data for development/testing
 */
function getMockCheckIns(limit: number): CheckInFeedItem[] {
  const categories = ['카페', '식당', '공원', '서점', '편의점', '헬스장', '영화관', '박물관'];
  const places = [
    { name: '스타벅스 강남역점', category: '카페', lat: 37.498095, lng: 127.027610 },
    { name: '교보문고 광화문점', category: '서점', lat: 37.571607, lng: 126.988205 },
    { name: '남산공원', category: '공원', lat: 37.551169, lng: 126.988227 },
    { name: '국립중앙박물관', category: '박물관', lat: 37.524086, lng: 126.980269 },
    { name: '이디야 홍대점', category: '카페', lat: 37.556221, lng: 126.922583 },
    { name: '올림픽공원', category: '공원', lat: 37.521807, lng: 127.122528 },
    { name: '할리스 신촌점', category: '카페', lat: 37.555946, lng: 126.936893 },
    { name: '24시 헬스장', category: '헬스장', lat: 37.566826, lng: 126.978656 },
  ];

  const mockData: CheckInFeedItem[] = [];
  const now = new Date();

  for (let i = 0; i < Math.min(limit, 15); i++) {
    const place = places[i % places.length];
    const hoursAgo = Math.floor(Math.random() * 48);
    const minutesAgo = Math.floor(Math.random() * 60);
    
    mockData.push({
      id: `mock-${i}`,
      poiName: place.name,
      poiCategory: place.category,
      tokensEarned: Math.floor(Math.random() * 200) + 50, // 50-250 tokens
      distance: Math.floor(Math.random() * 100) + 10, // 10-110 meters
      checkedAt: new Date(now.getTime() - (hoursAgo * 3600000 + minutesAgo * 60000)),
      userTier: Math.random() > 0.3 ? 'FREE' : 'PREMIUM',
      location: {
        lat: place.lat,
        lng: place.lng,
      },
    });
  }

  return mockData;
}

/**
 * Get check-in statistics for the current user
 */
export async function getUserStats() {
  try {
    if (!process.env.DATABASE_URL) {
      return {
        totalCheckIns: 42,
        totalTokens: 8_450,
        currentStreak: 7,
        level: 'PREMIUM',
      };
    }

    // TODO: Get real user from session/auth
    // For now, return mock data
    return {
      totalCheckIns: 42,
      totalTokens: 8_450,
      currentStreak: 7,
      level: 'FREE',
    };
  } catch (error) {
    console.error('[Feed] Error fetching user stats:', error);
    return {
      totalCheckIns: 0,
      totalTokens: 0,
      currentStreak: 0,
      level: 'FREE',
    };
  }
}

'use server';

import { prisma } from '@zzik/database';

export interface CheckInRequest {
  poiId: string;
  userLat: number;
  userLng: number;
  accuracy: number;
}

export interface CheckInResult {
  success: boolean;
  message: string;
  data?: {
    checkInId: string;
    tokensEarned: number;
    distance: number;
    streakBonus: number;
  };
  error?: string;
}

/**
 * Perform a check-in at a POI
 * Validates GPS distance and awards tokens
 */
export async function performCheckIn(request: CheckInRequest): Promise<CheckInResult> {
  try {
    const { poiId, userLat, userLng, accuracy } = request;

    // Validate input
    if (!poiId || !userLat || !userLng || !accuracy) {
      return {
        success: false,
        message: '필수 정보가 누락되었습니다.',
        error: 'MISSING_PARAMS',
      };
    }

    // Check if database is connected
    if (!process.env.DATABASE_URL) {
      console.log('[CheckIn] DATABASE_URL not configured, simulating check-in');
      return simulateCheckIn(request);
    }

    // Fetch POI details
    const poi = await prisma.pOI.findUnique({
      where: { id: poiId },
      include: {
        campaigns: {
          where: {
            status: 'ACTIVE',
            endDate: { gte: new Date() },
          },
          take: 1,
        },
      },
    });

    if (!poi) {
      return {
        success: false,
        message: '장소를 찾을 수 없습니다.',
        error: 'POI_NOT_FOUND',
      };
    }

    // Calculate distance
    const distance = calculateDistance(userLat, userLng, poi.lat, poi.lng);

    // Validate distance (max 100m)
    if (distance > 100) {
      return {
        success: false,
        message: `장소에서 너무 멀리 떨어져 있습니다. (${Math.round(distance)}m)`,
        error: 'TOO_FAR',
      };
    }

    // Validate accuracy (max 50m)
    if (accuracy > 50) {
      return {
        success: false,
        message: 'GPS 정확도가 낮습니다. 야외에서 다시 시도해주세요.',
        error: 'LOW_ACCURACY',
      };
    }

    // TODO: Get real user from session
    // For now, use mock user ID
    const userId = 'mock-user-1';

    // Calculate tokens earned
    const baseTokens = 100;
    const hasActiveCampaign = poi.campaigns.length > 0;
    const campaignBonus = hasActiveCampaign ? 50 : 0;
    const tokensEarned = baseTokens + campaignBonus;

    // Create check-in record
    const checkIn = await prisma.validatedCheckIn.create({
      data: {
        userId,
        poiId: poi.id,
        campaignId: poi.campaigns[0]?.id,
        userLat,
        userLng,
        accuracy,
        distance: Math.round(distance),
        tokensEarned,
        verified: true,
        fraudScore: 0,
      },
    });

    // Update POI visit count
    await prisma.pOI.update({
      where: { id: poi.id },
      data: { visitCount: { increment: 1 } },
    });

    return {
      success: true,
      message: '체크인 완료! 토큰을 획득했습니다.',
      data: {
        checkInId: checkIn.id,
        tokensEarned,
        distance: Math.round(distance),
        streakBonus: 0,
      },
    };
  } catch (error) {
    console.error('[CheckIn] Error:', error);
    return {
      success: false,
      message: '체크인 중 오류가 발생했습니다.',
      error: 'SERVER_ERROR',
    };
  }
}

/**
 * Simulate check-in for development/testing
 */
function simulateCheckIn(request: CheckInRequest): CheckInResult {
  const { poiId, userLat, userLng, accuracy } = request;

  // Simulate distance calculation (use mock POI coordinates)
  const mockPOIs: Record<string, { lat: number; lng: number }> = {
    'poi-1': { lat: 37.498095, lng: 127.027610 },
    'poi-2': { lat: 37.571607, lng: 126.988205 },
    'poi-3': { lat: 37.551169, lng: 126.988227 },
  };

  const poi = mockPOIs[poiId] || mockPOIs['poi-1'];
  const distance = calculateDistance(userLat, userLng, poi.lat, poi.lng);

  // Validate distance
  if (distance > 100) {
    return {
      success: false,
      message: `장소에서 너무 멀리 떨어져 있습니다. (${Math.round(distance)}m)`,
      error: 'TOO_FAR',
    };
  }

  // Validate accuracy
  if (accuracy > 50) {
    return {
      success: false,
      message: 'GPS 정확도가 낮습니다. 야외에서 다시 시도해주세요.',
      error: 'LOW_ACCURACY',
    };
  }

  // Simulate successful check-in
  const tokensEarned = 100 + Math.floor(Math.random() * 50);
  
  return {
    success: true,
    message: '체크인 완료! 토큰을 획득했습니다.',
    data: {
      checkInId: `mock-checkin-${Date.now()}`,
      tokensEarned,
      distance: Math.round(distance),
      streakBonus: 0,
    },
  };
}

/**
 * Calculate distance between two coordinates in meters
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

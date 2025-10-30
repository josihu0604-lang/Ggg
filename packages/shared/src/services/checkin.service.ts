// Enhanced check-in service with subscription tier validation and token rewards
import { prisma } from '@zzik/database/src/client';
import { distanceMeters } from '../utils/distance.util';
import { fraudScoreCheck } from './fraud.service';
import { TokenService } from './token.service';
import { checkMultipleRateLimits, RATE_LIMITS } from '../utils/rate-limit.util';
import { detectAnomalies, checkAutoBlock } from './anomaly.service';

export const CheckinService = {
  async validateAndCreate(params: {
    userId: string;
    poiId: string;
    location: { lat: number; lng: number; accuracy: number };
    deviceInfo?: any;
    ipAddress?: string;
    qrCodeToken?: string; // For QR code check-ins
  }): Promise<{
    valid: boolean;
    reason?: string;
    details?: any;
    checkinId?: string;
    tokensEarned?: number;
    tierLimitReached?: boolean;
    rateLimitExceeded?: boolean;
  }> {
    // 0. Rate limiting (protects against automated abuse)
    const rateLimitResult = await checkMultipleRateLimits(
      params.userId,
      'checkin',
      [
        { name: 'hourly', config: RATE_LIMITS.CHECKIN_HOURLY },
        { name: 'daily', config: RATE_LIMITS.CHECKIN_DAILY }
      ]
    );

    if (!rateLimitResult.allowed) {
      const failedLimit = rateLimitResult.results[rateLimitResult.failed!];
      return {
        valid: false,
        reason: 'rate_limit_exceeded',
        rateLimitExceeded: true,
        details: {
          limit: rateLimitResult.failed,
          resetAt: failedLimit.resetAt,
          message: `Too many check-in attempts. Please try again after ${failedLimit.resetAt.toLocaleTimeString()}`
        }
      };
    }

    // 1. Get user subscription tier
    const userSub = await prisma.userSubscription.findUnique({
      where: { userId: params.userId },
      select: { 
        tier: true, 
        status: true,
        checkInsThisMonth: true, 
        checkInLimit: true 
      }
    });

    // Default to FREE tier if no subscription
    const tier = userSub?.tier || 'FREE';
    const checkInsThisMonth = userSub?.checkInsThisMonth || 0;
    const checkInLimit = userSub?.checkInLimit || 3;

    // 2. Check tier limits (FREE: 3/month, PREMIUM: unlimited)
    if (tier === 'FREE' && checkInLimit !== -1 && checkInsThisMonth >= checkInLimit) {
      return {
        valid: false,
        reason: 'tier_limit_reached',
        tierLimitReached: true,
        details: {
          tier: 'FREE',
          limit: checkInLimit,
          used: checkInsThisMonth,
          upgradeRequired: true
        }
      };
    }

    // 3. Check subscription status
    if (userSub && userSub.status !== 'ACTIVE' && userSub.status !== 'TRIALING') {
      return {
        valid: false,
        reason: 'subscription_inactive',
        details: {
          status: userSub.status,
          message: userSub.status === 'PAST_DUE' 
            ? 'Payment required to continue' 
            : 'Subscription canceled'
        }
      };
    }

    // 3.5. Anomaly detection (catches sophisticated fraud)
    const anomalyResult = await detectAnomalies({
      userId: params.userId,
      currentLocation: { lat: params.location.lat, lng: params.location.lng },
      poiId: params.poiId,
      timestamp: new Date()
    });

    // Auto-block if anomaly detection flags user
    if (anomalyResult.autoBlock) {
      const shouldBlock = await checkAutoBlock(params.userId);
      if (shouldBlock) {
        return {
          valid: false,
          reason: 'account_suspended',
          details: {
            message: 'Account temporarily suspended due to suspicious activity',
            anomalies: anomalyResult.anomalies,
            contactSupport: true
          }
        };
      }
    }

    // Flag but allow if just suspicious (not auto-block)
    if (anomalyResult.suspicious && !anomalyResult.autoBlock) {
      console.warn('[CheckIn] Suspicious activity detected but allowing', {
        userId: params.userId,
        anomalyScore: anomalyResult.score,
        anomalies: anomalyResult.anomalies
      });
    }

    // 4. Validate POI exists
    const poi = await prisma.pOI.findUnique({
      where: { id: params.poiId },
      select: { id: true, name: true, lat: true, lng: true, h3Index: true },
    });

    if (!poi) {
      return { valid: false, reason: 'poi_not_found' };
    }

    // 5. Determine check-in method (GPS or QR Code)
    let checkInMethod: 'GPS' | 'QR_CODE' | 'HYBRID' = 'GPS';
    let qrCodeId: string | undefined;

    if (params.qrCodeToken) {
      // CRITICAL: Import QRCodeService for single-use validation
      const { QRCodeService } = await import('./qrcode.service');
      
      // Validate QR code with single-use enforcement
      const qrValidation = await QRCodeService.validateQRCode(
        params.qrCodeToken,
        params.userId
      );

      if (!qrValidation.valid) {
        return {
          valid: false,
          reason: 'invalid_qr_code',
          details: { 
            message: qrValidation.error || 'QR code is invalid or already used',
            qrCodeError: true
          }
        };
      }

      // Additional check: Verify QR code is for this POI
      if (qrValidation.payload?.poiId !== params.poiId) {
        return {
          valid: false,
          reason: 'qr_poi_mismatch',
          details: { message: 'QR code is for a different location' }
        };
      }

      // Find QR code ID for relation
      const qrCode = await prisma.qRCode.findUnique({
        where: { token: params.qrCodeToken },
        select: { id: true }
      });

      if (!qrCode) {
        return {
          valid: false,
          reason: 'qr_code_not_found'
        };
      }

      checkInMethod = 'QR_CODE';
      qrCodeId = qrCode.id;

      // Update QR code scan count
      await prisma.qRCode.update({
        where: { id: qrCode.id },
        data: {
          scansTotal: { increment: 1 },
          scansToday: { increment: 1 },
          lastScannedAt: new Date()
        }
      });
    }

    // 6. Check distance (must be within 50m for GPS check-ins)
    const d = distanceMeters(
      { lat: params.location.lat, lng: params.location.lng },
      { lat: poi.lat, lng: poi.lng }
    );

    if (checkInMethod === 'GPS' && d > 50) {
      return {
        valid: false,
        reason: 'too_far',
        details: { distance: Math.round(d), required: 50 },
      };
    }

    // If QR code used but also close enough, mark as HYBRID
    if (checkInMethod === 'QR_CODE' && d <= 50) {
      checkInMethod = 'HYBRID';
    }

    // 7. Get last check-in for fraud detection
    const last = await prisma.validatedCheckIn.findFirst({
      where: { userId: params.userId },
      orderBy: { checkedAt: 'desc' },
      select: { userLat: true, userLng: true, checkedAt: true },
    });

    // 8. Run fraud checks (skip for QR code check-ins)
    let fraudScore = 0;
    
    if (checkInMethod !== 'QR_CODE') {
      const fraud = await fraudScoreCheck(
        last ? { lat: last.userLat, lng: last.userLng, ts: last.checkedAt.getTime() } : null,
        { lat: params.location.lat, lng: params.location.lng, acc: params.location.accuracy },
        { lat: poi.lat, lng: poi.lng }
      );

      fraudScore = fraud.fraud;

      if (!fraud.passed) {
        return { 
          valid: false, 
          reason: 'fraud', 
          details: { 
            fraud: fraud.fraud,
            message: 'Location verification failed. Try using QR code instead.'
          } 
        };
      }
    }

    // 9. Calculate token reward (100 for PREMIUM, 0 for FREE)
    const tokensEarned = tier === 'PREMIUM' ? 100 : 0;

    // 10. Create check-in + update counters in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 10a. Create check-in record
      const checkin = await tx.validatedCheckIn.create({
        data: {
          userId: params.userId,
          poiId: poi.id,
          userLat: params.location.lat,
          userLng: params.location.lng,
          accuracy: params.location.accuracy,
          distance: Math.round(d),
          verified: true,
          fraudScore,
          deviceInfo: params.deviceInfo ?? null,
          ipAddress: params.ipAddress ?? null,
          tokensEarned,
          userTier: tier,
          checkInMethod,
          qrCodeId
        },
        select: { id: true },
      });

      // 10b. Award tokens if PREMIUM
      if (tier === 'PREMIUM' && tokensEarned > 0) {
        await TokenService.awardTokens({
          userId: params.userId,
          checkInId: checkin.id,
          tokensEarned,
          description: `Check-in at ${poi.name || 'POI'}`
        });
      }

      // 10c. Increment user subscription check-in counter
      if (userSub) {
        await tx.userSubscription.update({
          where: { userId: params.userId },
          data: { checkInsThisMonth: { increment: 1 } }
        });
      } else {
        // Create FREE tier subscription if doesn't exist
        await tx.userSubscription.create({
          data: {
            userId: params.userId,
            tier: 'FREE',
            status: 'ACTIVE',
            checkInsThisMonth: 1,
            checkInLimit: 3,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        });
      }

      // 10d. Update user stats
      await tx.user.update({
        where: { id: params.userId },
        data: {
          totalCheckIns: { increment: 1 },
          points: { increment: tokensEarned }, // Backward compatibility
          lastCheckInDate: new Date()
        }
      });

      // 10e. Update POI visit count
      await tx.pOI.update({
        where: { id: poi.id },
        data: { visitCount: { increment: 1 } }
      });

      // 10f. Mark QR code as used (single-use enforcement)
      if (params.qrCodeToken && qrCodeId) {
        await tx.qRCode.update({
          where: { token: params.qrCodeToken },
          data: {
            used: true,
            usedAt: new Date(),
            usedByUserId: params.userId,
            scansTotal: { increment: 1 },
            scansToday: { increment: 1 },
            lastScannedAt: new Date()
          }
        });

        console.log('[CheckIn] QR code marked as used', {
          token: params.qrCodeToken.substring(0, 20) + '...',
          userId: params.userId,
          poiId: poi.id,
          checkInId: checkin.id
        });
      }

      return { checkinId: checkin.id };
    });

    return {
      valid: true,
      checkinId: result.checkinId,
      tokensEarned: tier === 'PREMIUM' ? tokensEarned : undefined,
      details: {
        tier,
        checkInMethod,
        checkInsRemaining: checkInLimit === -1 
          ? -1 
          : Math.max(0, checkInLimit - checkInsThisMonth - 1)
      }
    };
  },

  /**
   * Get check-in statistics for user
   */
  async getUserCheckInStats(userId: string): Promise<any> {
    const [totalCheckIns, todayCheckIns, subscription] = await Promise.all([
      prisma.validatedCheckIn.count({
        where: { userId }
      }),
      prisma.validatedCheckIn.count({
        where: {
          userId,
          checkedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.userSubscription.findUnique({
        where: { userId },
        select: {
          tier: true,
          checkInsThisMonth: true,
          checkInLimit: true
        }
      })
    ]);

    return {
      totalCheckIns,
      todayCheckIns,
      thisMonthCheckIns: subscription?.checkInsThisMonth || 0,
      monthlyLimit: subscription?.checkInLimit || 3,
      tier: subscription?.tier || 'FREE',
      remainingThisMonth: subscription?.checkInLimit === -1
        ? -1
        : Math.max(0, (subscription?.checkInLimit || 3) - (subscription?.checkInsThisMonth || 0))
    };
  },

  /**
   * Get recent check-ins for user
   */
  async getUserRecentCheckIns(userId: string, limit: number = 10): Promise<any> {
    return await prisma.validatedCheckIn.findMany({
      where: { userId },
      orderBy: { checkedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        checkedAt: true,
        tokensEarned: true,
        checkInMethod: true,
        distance: true,
        poi: {
          select: {
            id: true,
            name: true,
            category: true,
            thumbnailUrl: true
          }
        }
      }
    });
  }
};

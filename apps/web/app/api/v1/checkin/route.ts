import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CheckinService } from '@zzik/shared/src/services/checkin.service';
import { SettlementService } from '@zzik/shared/src/services/settlement.service';
import { AppError, handleAPIError } from '../../../../lib/error';
import { getCached, setCache } from '@zzik/shared/src/utils/cache.util';

const BodySchema = z.object({
  poiId: z.string().min(8),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    accuracy: z.number().positive(),
  }),
  deviceInfo: z.any().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const idem = req.headers.get('Idempotency-Key') || '';
    const userId = req.headers.get('x-user-id') || 'demo-user'; // Demo/pilot guard

    const body = BodySchema.parse(await req.json());

    // Idempotency: return same response for 120s
    if (idem) {
      const idempotencyKey = `idem:checkin:${userId}:${idem}`;
      try {
        const cached = await getCached<any>(
          idempotencyKey,
          async () => null,
          120
        );
        if (cached !== null) {
          console.log(`[Idempotency] Returning cached response for key: ${idempotencyKey}`);
          return NextResponse.json(cached, { 
            status: 200,
            headers: {
              'X-Idempotency-Cache': 'hit'
            }
          });
        }
      } catch (err) {
        console.warn(`[Idempotency] Cache check failed, proceeding with request:`, err);
      }
    }

    // Validate and create check-in
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                      req.headers.get('x-real-ip') || 
                      undefined;
    
    const { valid, reason, details, checkinId } =
      await CheckinService.validateAndCreate({
        userId,
        ...body,
        ipAddress,
      });

    if (!valid || !checkinId) {
      throw new AppError('CHECKIN_INVALID', reason || 'invalid', 400, details);
    }

    // Settle CPCV
    const settlement = await SettlementService.settleCPCV(checkinId);

    const result = {
      success: true,
      check_in_id: checkinId,
      reward_pts: settlement.userReward,
      message: `체크인 완료! +${settlement.userReward} PTS`,
    };

    // Cache idempotency result for 120s
    if (idem) {
      const idempotencyKey = `idem:checkin:${userId}:${idem}`;
      try {
        await setCache(idempotencyKey, result, 120);
        console.log(`[Idempotency] Cached response for key: ${idempotencyKey}`);
      } catch (err) {
        console.warn(`[Idempotency] Failed to cache response:`, err);
      }
    }

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return handleAPIError(e);
  }
}

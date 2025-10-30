// Token redemption API
// POST /api/v1/tokens/redeem - Redeem tokens for voucher

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { TokenService } from '@zzik/shared/src/services/token.service';
import { AppError, handleAPIError } from '../../../../../lib/error';

const RedeemTokensSchema = z.object({
  tokensToRedeem: z.number().min(5000).multipleOf(5000),
  merchantId: z.string().optional(),
  voucherType: z.enum(['GENERAL', 'MERCHANT_SPECIFIC']).default('GENERAL')
});

/**
 * POST /api/v1/tokens/redeem
 * Redeem tokens for voucher
 */
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'User ID required', 401);
    }

    const body = RedeemTokensSchema.parse(await req.json());

    const redemption = await TokenService.redeemTokens({
      userId,
      tokensToRedeem: body.tokensToRedeem,
      merchantId: body.merchantId
    });

    // Get updated balance
    const balanceData = await TokenService.getTokenBalance(userId);

    return NextResponse.json({
      success: true,
      redemption: {
        id: redemption.id,
        tokensUsed: redemption.tokensUsed,
        voucherValue: redemption.voucherValue,
        voucherCode: redemption.voucherCode,
        status: redemption.status,
        expiresAt: redemption.expiresAt,
        merchantId: redemption.merchantId
      },
      newBalance: {
        balance: balanceData.balance.balance,
        totalRedeemed: balanceData.balance.totalRedeemed
      }
    }, { status: 201 });
  } catch (e) {
    return handleAPIError(e);
  }
}

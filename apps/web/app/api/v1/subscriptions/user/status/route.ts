// User subscription status API
// GET /api/v1/subscriptions/user/status - Get subscription and usage info

import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionService } from '@zzik/shared/src/services/subscription.service';
import { TokenService } from '@zzik/shared/src/services/token.service';
import { AppError, handleAPIError } from '../../../../../../lib/error';

/**
 * GET /api/v1/subscriptions/user/status
 * Get current subscription status and usage
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'User ID required', 401);
    }

    // Get subscription status
    const subscription = await SubscriptionService.getUserSubscriptionStatus(userId);

    // Get token balance
    const tokenData = await TokenService.getTokenBalance(userId);

    return NextResponse.json({
      subscription: {
        tier: subscription.tier,
        status: subscription.status,
        checkInsThisMonth: subscription.checkInsThisMonth,
        checkInLimit: subscription.checkInLimit,
        remainingCheckIns: subscription.remainingCheckIns,
        renewsAt: subscription.currentPeriodEnd
      },
      tokenBalance: {
        balance: tokenData.balance.balance,
        totalEarned: tokenData.balance.totalEarned,
        totalRedeemed: tokenData.balance.totalRedeemed,
        nextRedemptionAt: Math.max(0, 5000 - tokenData.balance.balance) // tokens needed for next redemption
      },
      expiringTokens: tokenData.expiringTokens,
      redemptionOptions: tokenData.redemptionOptions
    }, { status: 200 });
  } catch (e) {
    return handleAPIError(e);
  }
}

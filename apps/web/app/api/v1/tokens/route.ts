// Token API routes
// GET /api/v1/tokens - Get token balance and history
// POST /api/v1/tokens/redeem - Redeem tokens for voucher

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { TokenService } from '@zzik/shared/src/services/token.service';
import { AppError, handleAPIError } from '../../../../lib/error';

/**
 * GET /api/v1/tokens
 * Get token balance and transaction history
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'User ID required', 401);
    }

    const data = await TokenService.getTokenBalance(userId);

    return NextResponse.json({
      balance: {
        current: data.balance.balance,
        totalEarned: data.balance.totalEarned,
        totalRedeemed: data.balance.totalRedeemed,
        totalExpired: data.balance.totalExpired
      },
      recentTransactions: data.recentTransactions.map((t: any) => ({
        type: t.type,
        amount: t.amount,
        description: t.description,
        createdAt: t.createdAt,
        expiresAt: t.expiresAt
      })),
      expiringTokens: data.expiringTokens,
      redemptionOptions: data.redemptionOptions
    }, { status: 200 });
  } catch (e) {
    return handleAPIError(e);
  }
}

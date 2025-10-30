// Voucher API routes
// POST /api/v1/tokens/voucher - Use/validate voucher
// GET /api/v1/tokens/voucher - Get user's vouchers

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { TokenService } from '@zzik/shared/src/services/token.service';
import { AppError, handleAPIError } from '../../../../../lib/error';

const UseVoucherSchema = z.object({
  voucherCode: z.string().length(14), // ZZIK-XXXX-XXXX format
  merchantId: z.string()
});

/**
 * POST /api/v1/tokens/voucher
 * Use voucher at merchant (merchant-facing endpoint)
 */
export async function POST(req: NextRequest) {
  try {
    const merchantId = req.headers.get('x-merchant-id');
    if (!merchantId) {
      throw new AppError('AUTH_REQUIRED', 'Merchant ID required', 401);
    }

    const body = UseVoucherSchema.parse(await req.json());

    // Validate voucher code format
    if (!body.voucherCode.startsWith('ZZIK-')) {
      throw new AppError('INVALID_VOUCHER', 'Invalid voucher code format', 400);
    }

    const redemption = await TokenService.useVoucher({
      voucherCode: body.voucherCode,
      merchantId: body.merchantId || merchantId
    });

    return NextResponse.json({
      success: true,
      redemption: {
        id: redemption.id,
        voucherValue: redemption.voucherValue,
        status: redemption.status,
        usedAt: redemption.usedAt,
        customerName: redemption.user?.name || 'Customer'
      },
      merchantCredit: redemption.voucherValue // Merchant gets credited
    }, { status: 200 });
  } catch (e) {
    return handleAPIError(e);
  }
}

/**
 * GET /api/v1/tokens/voucher
 * Get user's active vouchers
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'User ID required', 401);
    }

    const vouchers = await TokenService.getUserVouchers(userId);

    return NextResponse.json({
      vouchers: vouchers.map((v: any) => ({
        id: v.id,
        voucherCode: v.voucherCode,
        voucherValue: v.voucherValue,
        merchantId: v.merchantId,
        expiresAt: v.expiresAt,
        daysRemaining: Math.ceil((new Date(v.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      }))
    }, { status: 200 });
  } catch (e) {
    return handleAPIError(e);
  }
}

// User subscription API routes
// POST /api/v1/subscriptions/user - Create premium subscription
// DELETE /api/v1/subscriptions/user - Cancel subscription

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SubscriptionService } from '@zzik/shared/src/services/subscription.service';
import { AppError, handleAPIError } from '../../../../../lib/error';

const CreateSubscriptionSchema = z.object({
  tier: z.literal('PREMIUM'),
  paymentMethodId: z.string().min(1),
  billingCycle: z.enum(['monthly', 'yearly']).optional().default('monthly')
});

const CancelSubscriptionSchema = z.object({
  cancelAtPeriodEnd: z.boolean().default(true),
  reason: z.enum(['too_expensive', 'not_using', 'switching', 'other']).optional(),
  feedback: z.string().optional()
});

/**
 * POST /api/v1/subscriptions/user
 * Create user premium subscription
 */
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'User ID required', 401);
    }

    const body = CreateSubscriptionSchema.parse(await req.json());

    const { subscription, clientSecret } = await SubscriptionService.createUserSubscription({
      userId,
      tier: body.tier,
      paymentMethodId: body.paymentMethodId
    });

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        tier: subscription.tier,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        checkInLimit: subscription.checkInLimit,
        pricePerMonth: 9900 // KRW
      },
      stripeClientSecret: clientSecret
    }, { status: 201 });
  } catch (e) {
    return handleAPIError(e);
  }
}

/**
 * DELETE /api/v1/subscriptions/user
 * Cancel user subscription
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'User ID required', 401);
    }

    const body = CancelSubscriptionSchema.parse(await req.json());

    const subscription = await SubscriptionService.cancelUserSubscription({
      userId,
      cancelAtPeriodEnd: body.cancelAtPeriodEnd
    });

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currentPeriodEnd: subscription.currentPeriodEnd,
        downgradeDate: subscription.currentPeriodEnd
      }
    }, { status: 200 });
  } catch (e) {
    return handleAPIError(e);
  }
}

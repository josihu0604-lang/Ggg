// Subscription service for managing user and merchant subscriptions
// Integrates with Stripe for payment processing

import { prisma } from '@zzik/database/src/client';
import Stripe from 'stripe';

// Initialize Stripe (will be configured via environment variables)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_xxx', {
  apiVersion: '2024-10-28' as any
});

// Stripe Price IDs (configure in Stripe Dashboard)
const PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID || 'price_premium_monthly';
const MERCHANT_STARTER_PRICE_ID = process.env.STRIPE_MERCHANT_STARTER_PRICE_ID || 'price_merchant_starter';
const MERCHANT_GROWTH_PRICE_ID = process.env.STRIPE_MERCHANT_GROWTH_PRICE_ID || 'price_merchant_growth';
const MERCHANT_PRO_PRICE_ID = process.env.STRIPE_MERCHANT_PRO_PRICE_ID || 'price_merchant_pro';

export const SubscriptionService = {
  /**
   * Create user premium subscription
   */
  async createUserSubscription(params: {
    userId: string;
    tier: 'PREMIUM';
    paymentMethodId: string;
  }): Promise<{ subscription: any; clientSecret: string }> {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { email: true, name: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // 1. Create Stripe customer
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name || undefined,
      payment_method: params.paymentMethodId,
      invoice_settings: {
        default_payment_method: params.paymentMethodId
      },
      metadata: {
        userId: params.userId
      }
    });

    // 2. Create Stripe subscription
    const stripeSubscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: PREMIUM_PRICE_ID }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userId: params.userId
      }
    });

    // 3. Create local subscription record
    const subscription = await prisma.userSubscription.create({
      data: {
        userId: params.userId,
        tier: 'PREMIUM',
        status: 'ACTIVE',
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        checkInLimit: -1, // unlimited
        stripeCustomerId: customer.id,
        stripeSubscriptionId: stripeSubscription.id
      }
    });

    // Extract client secret for 3D Secure
    const invoice = stripeSubscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    return {
      subscription,
      clientSecret: paymentIntent.client_secret!
    };
  },

  /**
   * Cancel user subscription
   */
  async cancelUserSubscription(params: {
    userId: string;
    cancelAtPeriodEnd: boolean;
  }): Promise<any> {
    const sub = await prisma.userSubscription.findUnique({
      where: { userId: params.userId }
    });

    if (!sub || !sub.stripeSubscriptionId) {
      throw new Error('Subscription not found');
    }

    // Cancel in Stripe
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: params.cancelAtPeriodEnd
    });

    // Update local record
    return await prisma.userSubscription.update({
      where: { userId: params.userId },
      data: { cancelAtPeriodEnd: params.cancelAtPeriodEnd }
    });
  },

  /**
   * Get user subscription status
   */
  async getUserSubscriptionStatus(userId: string): Promise<any> {
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
      select: {
        tier: true,
        status: true,
        checkInsThisMonth: true,
        checkInLimit: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true
      }
    });

    if (!subscription) {
      // Return default FREE tier
      return {
        tier: 'FREE',
        status: 'ACTIVE',
        checkInsThisMonth: 0,
        checkInLimit: 3,
        remainingCheckIns: 3,
        currentPeriodStart: null,
        currentPeriodEnd: null
      };
    }

    return {
      ...subscription,
      remainingCheckIns: subscription.checkInLimit === -1 
        ? -1 // unlimited
        : Math.max(0, subscription.checkInLimit - subscription.checkInsThisMonth)
    };
  },

  /**
   * Create merchant subscription
   */
  async createMerchantSubscription(params: {
    merchantId: string;
    plan: 'STARTER' | 'GROWTH' | 'PRO';
    paymentMethodId: string;
  }): Promise<{ subscription: any; clientSecret: string }> {
    const merchant = await prisma.merchant.findUnique({
      where: { id: params.merchantId },
      select: { email: true, businessName: true }
    });

    if (!merchant) {
      throw new Error('Merchant not found');
    }

    // Determine price ID and limits based on plan
    const planConfig = {
      STARTER: {
        priceId: MERCHANT_STARTER_PRICE_ID,
        checkInLimit: 50,
        campaignLimit: 1
      },
      GROWTH: {
        priceId: MERCHANT_GROWTH_PRICE_ID,
        checkInLimit: 150,
        campaignLimit: 3
      },
      PRO: {
        priceId: MERCHANT_PRO_PRICE_ID,
        checkInLimit: 400,
        campaignLimit: -1 // unlimited
      }
    }[params.plan];

    // 1. Create Stripe customer
    const customer = await stripe.customers.create({
      email: merchant.email,
      name: merchant.businessName,
      payment_method: params.paymentMethodId,
      invoice_settings: {
        default_payment_method: params.paymentMethodId
      },
      metadata: {
        merchantId: params.merchantId
      }
    });

    // 2. Create Stripe subscription
    const stripeSubscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: planConfig.priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        merchantId: params.merchantId
      }
    });

    // 3. Create local subscription record
    const subscription = await prisma.merchantSubscription.create({
      data: {
        merchantId: params.merchantId,
        plan: params.plan,
        status: 'ACTIVE',
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        checkInLimit: planConfig.checkInLimit,
        campaignLimit: planConfig.campaignLimit,
        stripeCustomerId: customer.id,
        stripeSubscriptionId: stripeSubscription.id
      }
    });

    // Extract client secret
    const invoice = stripeSubscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    return {
      subscription,
      clientSecret: paymentIntent.client_secret!
    };
  },

  /**
   * Handle Stripe webhook events
   */
  async handleStripeWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'customer.subscription.updated':
        await this._handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this._handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await this._handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this._handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
    }
  },

  async _handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata.userId;
    const merchantId = subscription.metadata.merchantId;
    
    if (userId) {
      // User subscription updated
      await prisma.userSubscription.update({
        where: { userId },
        data: {
          status: subscription.status === 'active' ? 'ACTIVE' : 'PAST_DUE',
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end
        }
      });
    } else if (merchantId) {
      // Merchant subscription updated
      await prisma.merchantSubscription.update({
        where: { merchantId },
        data: {
          status: subscription.status === 'active' ? 'ACTIVE' : 'PAST_DUE',
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end
        }
      });
    }
  },

  async _handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata.userId;
    const merchantId = subscription.metadata.merchantId;
    
    if (userId) {
      // Downgrade to FREE tier
      await prisma.userSubscription.update({
        where: { userId },
        data: {
          tier: 'FREE',
          status: 'CANCELED',
          checkInLimit: 3,
          checkInsThisMonth: 0 // Reset counter
        }
      });
    } else if (merchantId) {
      // Mark merchant subscription as canceled
      await prisma.merchantSubscription.update({
        where: { merchantId },
        data: {
          status: 'CANCELED'
        }
      });
    }
  },

  async _handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    // Payment successful, reset monthly counters
    const customerId = invoice.customer as string;
    const customer = await stripe.customers.retrieve(customerId);
    
    const userId = (customer as Stripe.Customer).metadata?.userId;
    const merchantId = (customer as Stripe.Customer).metadata?.merchantId;

    if (userId) {
      await prisma.userSubscription.update({
        where: { userId },
        data: {
          checkInsThisMonth: 0, // Reset monthly counter
          status: 'ACTIVE'
        }
      });
    } else if (merchantId) {
      await prisma.merchantSubscription.update({
        where: { merchantId },
        data: {
          checkInsThisMonth: 0,
          overageCheckIns: 0,
          status: 'ACTIVE'
        }
      });
    }
  },

  async _handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    const customer = await stripe.customers.retrieve(customerId);
    
    const userId = (customer as Stripe.Customer).metadata?.userId;
    const merchantId = (customer as Stripe.Customer).metadata?.merchantId;
    
    if (userId) {
      await prisma.userSubscription.update({
        where: { userId },
        data: { status: 'PAST_DUE' }
      });
    } else if (merchantId) {
      await prisma.merchantSubscription.update({
        where: { merchantId },
        data: { status: 'PAST_DUE' }
      });
    }
    
    // TODO: Send notification to user/merchant
    console.error('Payment failed for customer:', customerId);
  },

  /**
   * Reset monthly counters (cron job - run on 1st of each month)
   */
  async resetMonthlyCounters(): Promise<void> {
    await prisma.$transaction([
      // Reset user check-in counters
      prisma.userSubscription.updateMany({
        where: {},
        data: { checkInsThisMonth: 0 }
      }),
      // Reset merchant check-in counters
      prisma.merchantSubscription.updateMany({
        where: {},
        data: {
          checkInsThisMonth: 0,
          overageCheckIns: 0
        }
      }),
      // Reset campaign check-in counters
      prisma.campaign.updateMany({
        where: {},
        data: { checkInsThisMonth: 0 }
      })
    ]);
  }
};

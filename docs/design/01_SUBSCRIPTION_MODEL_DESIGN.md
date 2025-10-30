# Subscription + Token Model - Technical Design Document

**Version**: 1.0  
**Date**: 2025-10-28  
**Status**: 🔴 CRITICAL - Fixes broken unit economics  
**Timeline**: 3 days implementation

---

## Problem Statement

Current CPCV model loses ₩1,040 per check-in:
```
Revenue:  ₩2,000 (merchant pays per check-in)
Cost:     ₩3,040 (₩1,400 user reward + ₩1,640 other)
Loss:     -₩1,040 ❌
```

Business cannot achieve profitability at any scale.

---

## Solution Overview

### Hybrid Model: Subscription (MRR) + Token Rewards (Deferred Cost)

**For Users:**
- Free Tier: 3 check-ins/month, no rewards
- Premium Tier: ₩9,900/month, unlimited check-ins + 100 tokens each

**For Merchants:**
- Starter: ₩299,000/month (50 check-ins, 1 campaign)
- Growth: ₩699,000/month (150 check-ins, 3 campaigns)
- Pro: ₩1,499,000/month (400 check-ins, unlimited campaigns)

**Token Economics:**
- Issuance: 100 tokens per check-in (free)
- Redemption: 5,000 tokens = ₩5,000 voucher (50 check-ins)
- Redemption Rate: 30% (industry standard)
- Deferred Cost: ₩30 per check-in

**Result**: 95% gross margin ✅

---

## Database Schema Changes

### 1. New Tables

#### UserSubscription
```prisma
model UserSubscription {
  id                String   @id @default(cuid())
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId            String   @unique
  
  tier              SubscriptionTier @default(FREE)
  status            SubscriptionStatus @default(ACTIVE)
  
  // Billing
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd  Boolean @default(false)
  
  // Usage tracking (for Free tier limits)
  checkInsThisMonth  Int     @default(0)
  checkInLimit       Int     @default(3) // 3 for FREE, -1 for PREMIUM (unlimited)
  
  // Payment
  stripeCustomerId   String?
  stripeSubscriptionId String?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([userId, status])
}

enum SubscriptionTier {
  FREE
  PREMIUM
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  TRIALING
}
```

#### MerchantSubscription
```prisma
model MerchantSubscription {
  id                String   @id @default(cuid())
  merchant          Merchant @relation(fields: [merchantId], references: [id], onDelete: Cascade)
  merchantId        String   @unique
  
  plan              MerchantPlan @default(STARTER)
  status            SubscriptionStatus @default(ACTIVE)
  
  // Billing
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd  Boolean @default(false)
  
  // Usage tracking
  checkInsThisMonth  Int     @default(0)
  checkInLimit       Int     @default(50) // 50/150/400 based on plan
  activeCampaigns    Int     @default(0)
  campaignLimit      Int     @default(1)  // 1/3/-1 based on plan
  
  // Overage billing
  overageCheckIns    Int     @default(0)
  overageRate        Decimal @default(3000) @db.Decimal(8, 2) // ₩3,000 per extra check-in
  
  // Payment
  stripeCustomerId   String?
  stripeSubscriptionId String?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([merchantId, status])
}

enum MerchantPlan {
  STARTER  // ₩299K/month, 50 check-ins, 1 campaign
  GROWTH   // ₩699K/month, 150 check-ins, 3 campaigns
  PRO      // ₩1,499K/month, 400 check-ins, unlimited campaigns
}
```

#### TokenBalance
```prisma
model TokenBalance {
  id              String   @id @default(cuid())
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId          String   @unique
  
  balance         Int      @default(0) // Current token balance
  totalEarned     Int      @default(0) // Lifetime earned
  totalRedeemed   Int      @default(0) // Lifetime redeemed
  totalExpired    Int      @default(0) // Expired tokens
  
  lastEarnedAt    DateTime?
  lastRedeemedAt  DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  transactions    TokenTransaction[]
  
  @@index([userId])
}
```

#### TokenTransaction
```prisma
model TokenTransaction {
  id              String   @id @default(cuid())
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId          String
  balance         TokenBalance @relation(fields: [userId], references: [userId], onDelete: Cascade)
  
  type            TokenTransactionType
  amount          Int      // Positive for earn, negative for redeem
  
  // Context
  checkIn         ValidatedCheckIn? @relation(fields: [checkInId], references: [id])
  checkInId       String?
  redemption      TokenRedemption? @relation(fields: [redemptionId], references: [id])
  redemptionId    String?
  
  // Expiry (tokens expire after 12 months)
  expiresAt       DateTime?
  expired         Boolean  @default(false)
  
  description     String?
  metadata        Json?
  
  createdAt       DateTime @default(now())
  
  @@index([userId, createdAt])
  @@index([expiresAt, expired])
}

enum TokenTransactionType {
  EARN_CHECKIN      // Earned from check-in
  EARN_REFERRAL     // Earned from referring friend
  EARN_BONUS        // Bonus from streak/event
  REDEEM_VOUCHER    // Redeemed for voucher
  REDEEM_MERCHANT   // Redeemed at merchant
  EXPIRE            // Tokens expired
  ADMIN_ADJUSTMENT  // Manual adjustment
}
```

#### TokenRedemption
```prisma
model TokenRedemption {
  id              String   @id @default(cuid())
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId          String
  
  tokensUsed      Int      // 5,000 tokens
  voucherValue    Decimal  @db.Decimal(10, 2) // ₩5,000
  
  status          RedemptionStatus @default(PENDING)
  
  // Voucher details
  voucherCode     String   @unique
  merchant        Merchant? @relation(fields: [merchantId], references: [id])
  merchantId      String?
  
  // Usage
  usedAt          DateTime?
  expiresAt       DateTime // 30 days validity
  
  // Accounting (deferred cost tracking)
  actualCost      Decimal  @db.Decimal(10, 2) // ₩5,000 when redeemed
  recorded        Boolean  @default(false) // For accounting sync
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  transactions    TokenTransaction[]
  
  @@index([userId, status])
  @@index([voucherCode])
  @@index([expiresAt, status])
}

enum RedemptionStatus {
  PENDING   // Created, not used yet
  USED      // Redeemed at merchant
  EXPIRED   // Voucher expired
  CANCELED  // User canceled
}
```

---

### 2. Modified Existing Tables

#### User (add fields)
```prisma
model User {
  // ... existing fields ...
  
  subscription      UserSubscription?
  tokenBalance      TokenBalance?
  tokenTransactions TokenTransaction[]
  redemptions       TokenRedemption[]
  
  // New fields
  referralCode      String?  @unique // For referral program
  referredBy        User?    @relation("Referrals", fields: [referredById], references: [id])
  referredById      String?
  referrals         User[]   @relation("Referrals")
  
  // Gamification
  currentStreak     Int      @default(0) // Days in a row
  longestStreak     Int      @default(0)
  lastCheckInDate   DateTime?
}
```

#### Merchant (add fields)
```prisma
model Merchant {
  // ... existing fields ...
  
  subscription      MerchantSubscription?
  redemptions       TokenRedemption[]
}
```

#### Campaign (modify for subscription model)
```prisma
model Campaign {
  // ... existing fields ...
  
  // REMOVE these fields (no longer needed):
  // - budgetTotal
  // - budgetSpent
  // - cpcvAmount
  
  // ADD these fields:
  maxCheckInsPerMonth Int    @default(150) // From merchant's plan
  checkInsThisMonth   Int    @default(0)
  priority            Int    @default(0)   // Higher priority for Pro tier
  
  // Token rewards (consistent across all campaigns)
  tokensPerCheckIn    Int    @default(100)
}
```

#### ValidatedCheckIn (add token reference)
```prisma
model ValidatedCheckIn {
  // ... existing fields ...
  
  // MODIFY:
  pointsEarned Int @default(0) // DEPRECATED - use tokensEarned
  
  // ADD:
  tokensEarned     Int              @default(0)
  tokenTransaction TokenTransaction?
  
  // Track which subscription tier user had at check-in time
  userTier         SubscriptionTier @default(FREE)
}
```

---

## API Design

### User Subscription Endpoints

#### POST /api/v1/subscriptions/user/create
**Purpose**: Upgrade user from Free to Premium

**Request**:
```typescript
{
  tier: 'PREMIUM',
  paymentMethodId: 'pm_xxx', // Stripe payment method
  billingCycle: 'monthly' | 'yearly'
}
```

**Response**:
```typescript
{
  subscription: {
    id: 'sub_xxx',
    tier: 'PREMIUM',
    status: 'ACTIVE',
    currentPeriodStart: '2025-10-28T00:00:00Z',
    currentPeriodEnd: '2025-11-28T00:00:00Z',
    checkInLimit: -1, // unlimited
    pricePerMonth: 9900 // KRW
  },
  stripeClientSecret: 'seti_xxx' // For 3D Secure
}
```

**Business Logic**:
1. Validate payment method with Stripe
2. Create Stripe subscription (₩9,900/month)
3. Create UserSubscription record
4. Reset checkInsThisMonth counter
5. Grant immediate access to premium features

---

#### POST /api/v1/subscriptions/user/cancel
**Purpose**: Cancel premium subscription (effective at period end)

**Request**:
```typescript
{
  cancelAtPeriodEnd: true,
  reason?: 'too_expensive' | 'not_using' | 'switching' | 'other',
  feedback?: string
}
```

**Response**:
```typescript
{
  subscription: {
    id: 'sub_xxx',
    status: 'ACTIVE',
    cancelAtPeriodEnd: true,
    currentPeriodEnd: '2025-11-28T00:00:00Z',
    downgradeDate: '2025-11-28T00:00:00Z'
  }
}
```

---

#### GET /api/v1/subscriptions/user/status
**Purpose**: Get current subscription status and usage

**Response**:
```typescript
{
  subscription: {
    tier: 'FREE' | 'PREMIUM',
    status: 'ACTIVE',
    checkInsThisMonth: 2,
    checkInLimit: 3, // or -1 for unlimited
    remainingCheckIns: 1,
    renewsAt: '2025-11-28T00:00:00Z'
  },
  tokenBalance: {
    balance: 450,
    totalEarned: 800,
    totalRedeemed: 350,
    nextRedemptionAt: 4550 // tokens needed
  }
}
```

---

### Merchant Subscription Endpoints

#### POST /api/v1/subscriptions/merchant/create
**Purpose**: Create merchant subscription plan

**Request**:
```typescript
{
  plan: 'STARTER' | 'GROWTH' | 'PRO',
  paymentMethodId: 'pm_xxx',
  billingCycle: 'monthly' | 'yearly' // 10% discount for yearly
}
```

**Response**:
```typescript
{
  subscription: {
    id: 'sub_xxx',
    plan: 'GROWTH',
    status: 'ACTIVE',
    pricePerMonth: 699000, // KRW
    checkInLimit: 150,
    checkInsThisMonth: 0,
    campaignLimit: 3,
    activeCampaigns: 0,
    overageRate: 3000, // KRW per extra check-in
    currentPeriodEnd: '2025-11-28T00:00:00Z'
  }
}
```

---

#### GET /api/v1/subscriptions/merchant/usage
**Purpose**: Get usage stats and billing preview

**Response**:
```typescript
{
  subscription: {
    plan: 'GROWTH',
    checkInsThisMonth: 145,
    checkInLimit: 150,
    remainingCheckIns: 5,
    overageCheckIns: 0,
    activeCampaigns: 2,
    campaignLimit: 3
  },
  billing: {
    basePrice: 699000,
    overageCharges: 0, // checkInsThisMonth > limit ? (excess × 3000) : 0
    estimatedTotal: 699000,
    nextBillingDate: '2025-11-28T00:00:00Z'
  },
  warnings: [
    {
      type: 'APPROACHING_LIMIT',
      message: 'You have 5 check-ins remaining this month',
      threshold: 0.95
    }
  ]
}
```

---

#### POST /api/v1/subscriptions/merchant/upgrade
**Purpose**: Upgrade merchant plan (e.g., STARTER → GROWTH)

**Request**:
```typescript
{
  newPlan: 'GROWTH',
  prorated: true // Prorate credit from old plan
}
```

**Response**:
```typescript
{
  subscription: {
    plan: 'GROWTH',
    status: 'ACTIVE',
    checkInLimit: 150, // upgraded
    campaignLimit: 3,  // upgraded
    proratedCredit: 120000, // Credit from unused days of STARTER
    nextBillingAmount: 579000 // 699000 - 120000
  }
}
```

---

### Token Endpoints

#### POST /api/v1/tokens/redeem
**Purpose**: Redeem tokens for voucher

**Request**:
```typescript
{
  tokensToRedeem: 5000,
  merchantId?: 'merchant_xxx', // Optional: specific merchant voucher
  voucherType: 'GENERAL' | 'MERCHANT_SPECIFIC'
}
```

**Response**:
```typescript
{
  redemption: {
    id: 'red_xxx',
    tokensUsed: 5000,
    voucherValue: 5000, // KRW
    voucherCode: 'ZZIK-A8F2-91E3', // 12-char code
    status: 'PENDING',
    expiresAt: '2025-11-27T23:59:59Z', // 30 days
    merchantName?: 'Café Mocha'
  },
  newBalance: {
    balance: 450, // 5450 - 5000
    totalRedeemed: 5350
  }
}
```

**Business Logic**:
1. Validate user has >= 5,000 tokens
2. Deduct 5,000 tokens from TokenBalance
3. Create TokenRedemption record
4. Generate unique voucher code (12 chars, alphanumeric)
5. Create REDEEM_VOUCHER TokenTransaction
6. Set expiry to 30 days from now
7. **DO NOT** record actual cost yet (deferred until used)

---

#### POST /api/v1/tokens/voucher/use
**Purpose**: Merchant validates and uses voucher

**Request**:
```typescript
{
  voucherCode: 'ZZIK-A8F2-91E3',
  merchantId: 'merchant_xxx'
}
```

**Response**:
```typescript
{
  success: true,
  redemption: {
    id: 'red_xxx',
    voucherValue: 5000,
    status: 'USED',
    usedAt: '2025-10-28T14:23:00Z',
    customerName: 'John D.' // Privacy: only first name + initial
  },
  merchantCredit: 5000 // Merchant gets credited ₩5,000
}
```

**Business Logic**:
1. Validate voucher exists and status = PENDING
2. Check voucher not expired
3. Check merchantId matches (if merchant-specific)
4. Update status to USED, set usedAt
5. **RECORD ACTUAL COST**: Create deferred liability entry (₩5,000)
6. Credit merchant account (if merchant-specific voucher)
7. Send confirmation to user (push notification)

---

#### GET /api/v1/tokens/balance
**Purpose**: Get token balance and history

**Response**:
```typescript
{
  balance: {
    current: 450,
    totalEarned: 5800,
    totalRedeemed: 5350,
    totalExpired: 0
  },
  recentTransactions: [
    {
      type: 'EARN_CHECKIN',
      amount: 100,
      description: 'Check-in at Café Mocha',
      createdAt: '2025-10-28T14:00:00Z',
      expiresAt: '2026-10-28T14:00:00Z'
    },
    {
      type: 'REDEEM_VOUCHER',
      amount: -5000,
      description: 'Redeemed voucher ZZIK-A8F2-91E3',
      createdAt: '2025-10-27T10:00:00Z'
    }
  ],
  expiringTokens: [
    {
      amount: 200,
      expiresAt: '2025-11-15T00:00:00Z',
      daysRemaining: 18
    }
  ],
  redemptionOptions: [
    {
      tokensRequired: 5000,
      voucherValue: 5000,
      available: false // balance < 5000
    },
    {
      tokensRequired: 10000,
      voucherValue: 10000,
      bonusValue: 500, // 5% bonus for larger redemption
      available: false
    }
  ]
}
```

---

## Service Layer Design

### CheckinService (Modified)

```typescript
// packages/shared/src/services/checkin.service.ts

import { prisma } from '@zzik/database/src/client';
import { SubscriptionTier } from '@prisma/client';

export const CheckinService = {
  async validateAndCreate(params: {
    userId: string;
    poiId: string;
    location: { lat: number; lng: number; accuracy: number };
  }): Promise<{
    valid: boolean;
    reason?: string;
    checkinId?: string;
    tokensEarned?: number;
    tierLimitReached?: boolean;
  }> {
    // 1. Get user subscription
    const userSub = await prisma.userSubscription.findUnique({
      where: { userId: params.userId },
      select: { tier: true, checkInsThisMonth: true, checkInLimit: true }
    });

    // Default to FREE tier if no subscription
    const tier = userSub?.tier || 'FREE';
    const checkInsThisMonth = userSub?.checkInsThisMonth || 0;
    const checkInLimit = userSub?.checkInLimit || 3;

    // 2. Check tier limits (FREE: 3/month, PREMIUM: unlimited)
    if (tier === 'FREE' && checkInsThisMonth >= checkInLimit) {
      return {
        valid: false,
        reason: 'tier_limit_reached',
        tierLimitReached: true
      };
    }

    // 3. Validate POI exists
    const poi = await prisma.pOI.findUnique({
      where: { id: params.poiId },
      select: { id: true, lat: true, lng: true }
    });

    if (!poi) {
      return { valid: false, reason: 'poi_not_found' };
    }

    // 4. Check distance (50m threshold)
    const d = distanceMeters(
      { lat: params.location.lat, lng: params.location.lng },
      { lat: poi.lat, lng: poi.lng }
    );

    if (d > 50) {
      return {
        valid: false,
        reason: 'too_far',
        details: { distance: Math.round(d), required: 50 }
      };
    }

    // 5. Fraud detection (unchanged)
    const last = await prisma.validatedCheckIn.findFirst({
      where: { userId: params.userId },
      orderBy: { checkedAt: 'desc' },
      select: { userLat: true, userLng: true, checkedAt: true }
    });

    const fraud = await fraudScoreCheck(
      last ? { lat: last.userLat, lng: last.userLng, ts: last.checkedAt.getTime() } : null,
      { lat: params.location.lat, lng: params.location.lng, acc: params.location.accuracy },
      { lat: poi.lat, lng: poi.lng }
    );

    if (!fraud.passed) {
      return { valid: false, reason: 'fraud', details: { fraud: fraud.fraud } };
    }

    // 6. Calculate token reward (100 for PREMIUM, 0 for FREE)
    const tokensEarned = tier === 'PREMIUM' ? 100 : 0;

    // 7. Create check-in + token transaction (ACID transaction)
    const result = await prisma.$transaction(async (tx) => {
      // 7a. Create check-in
      const checkin = await tx.validatedCheckIn.create({
        data: {
          userId: params.userId,
          poiId: poi.id,
          userLat: params.location.lat,
          userLng: params.location.lng,
          accuracy: params.location.accuracy,
          distance: Math.round(d),
          verified: true,
          fraudScore: fraud.fraud,
          tokensEarned,
          userTier: tier
        },
        select: { id: true }
      });

      // 7b. If PREMIUM, award tokens
      if (tier === 'PREMIUM') {
        // Update token balance
        await tx.tokenBalance.upsert({
          where: { userId: params.userId },
          create: {
            userId: params.userId,
            balance: tokensEarned,
            totalEarned: tokensEarned,
            lastEarnedAt: new Date()
          },
          update: {
            balance: { increment: tokensEarned },
            totalEarned: { increment: tokensEarned },
            lastEarnedAt: new Date()
          }
        });

        // Create token transaction
        await tx.tokenTransaction.create({
          data: {
            userId: params.userId,
            type: 'EARN_CHECKIN',
            amount: tokensEarned,
            checkInId: checkin.id,
            description: `Check-in at ${poi.name || 'POI'}`,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
          }
        });
      }

      // 7c. Increment user's check-in counter for this month
      await tx.userSubscription.update({
        where: { userId: params.userId },
        data: { checkInsThisMonth: { increment: 1 } }
      });

      // 7d. Update user stats
      await tx.user.update({
        where: { id: params.userId },
        data: {
          totalCheckIns: { increment: 1 },
          lastCheckInDate: new Date()
        }
      });

      return { checkinId: checkin.id };
    });

    return {
      valid: true,
      checkinId: result.checkinId,
      tokensEarned: tier === 'PREMIUM' ? tokensEarned : undefined
    };
  }
};
```

---

### SubscriptionService (New)

```typescript
// packages/shared/src/services/subscription.service.ts

import { prisma } from '@zzik/database/src/client';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-10-28.acacia'
});

const PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID!; // ₩9,900/month

export const SubscriptionService = {
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
    
    await prisma.userSubscription.update({
      where: { userId },
      data: {
        status: subscription.status === 'active' ? 'ACTIVE' : 'PAST_DUE',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      }
    });
  },

  async _handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata.userId;
    
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
  },

  async _handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    // Payment successful, no action needed (subscription is already ACTIVE)
    console.log('Invoice paid:', invoice.id);
  },

  async _handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    const customer = await stripe.customers.retrieve(customerId);
    const userId = (customer as Stripe.Customer).metadata.userId;
    
    // Mark subscription as PAST_DUE
    await prisma.userSubscription.update({
      where: { userId },
      data: { status: 'PAST_DUE' }
    });
    
    // Send notification to user (implement separately)
    console.error('Payment failed for user:', userId);
  }
};
```

---

### TokenService (New)

```typescript
// packages/shared/src/services/token.service.ts

import { prisma } from '@zzik/database/src/client';
import { nanoid } from 'nanoid';

export const TokenService = {
  async redeemTokens(params: {
    userId: string;
    tokensToRedeem: number;
    merchantId?: string;
  }): Promise<any> {
    // Validate token amount
    if (params.tokensToRedeem < 5000) {
      throw new Error('Minimum redemption is 5,000 tokens');
    }

    if (params.tokensToRedeem % 5000 !== 0) {
      throw new Error('Tokens must be redeemed in multiples of 5,000');
    }

    const voucherValue = params.tokensToRedeem; // 1 token = ₩1

    return await prisma.$transaction(async (tx) => {
      // 1. Check balance
      const balance = await tx.tokenBalance.findUnique({
        where: { userId: params.userId },
        select: { balance: true }
      });

      if (!balance || balance.balance < params.tokensToRedeem) {
        throw new Error('Insufficient token balance');
      }

      // 2. Deduct tokens
      await tx.tokenBalance.update({
        where: { userId: params.userId },
        data: {
          balance: { decrement: params.tokensToRedeem },
          totalRedeemed: { increment: params.tokensToRedeem },
          lastRedeemedAt: new Date()
        }
      });

      // 3. Generate unique voucher code
      const voucherCode = this._generateVoucherCode();

      // 4. Create redemption record
      const redemption = await tx.tokenRedemption.create({
        data: {
          userId: params.userId,
          tokensUsed: params.tokensToRedeem,
          voucherValue,
          voucherCode,
          status: 'PENDING',
          merchantId: params.merchantId,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          actualCost: 0, // Deferred until used
          recorded: false
        }
      });

      // 5. Create token transaction
      await tx.tokenTransaction.create({
        data: {
          userId: params.userId,
          type: 'REDEEM_VOUCHER',
          amount: -params.tokensToRedeem,
          redemptionId: redemption.id,
          description: `Redeemed ${params.tokensToRedeem} tokens for voucher`
        }
      });

      return redemption;
    });
  },

  async useVoucher(params: {
    voucherCode: string;
    merchantId: string;
  }): Promise<any> {
    return await prisma.$transaction(async (tx) => {
      // 1. Find voucher
      const redemption = await tx.tokenRedemption.findUnique({
        where: { voucherCode: params.voucherCode },
        select: {
          id: true,
          status: true,
          expiresAt: true,
          voucherValue: true,
          merchantId: true,
          userId: true
        }
      });

      if (!redemption) {
        throw new Error('Voucher not found');
      }

      // 2. Validate status
      if (redemption.status !== 'PENDING') {
        throw new Error(`Voucher already ${redemption.status.toLowerCase()}`);
      }

      // 3. Check expiry
      if (new Date() > redemption.expiresAt) {
        await tx.tokenRedemption.update({
          where: { voucherCode: params.voucherCode },
          data: { status: 'EXPIRED' }
        });
        throw new Error('Voucher expired');
      }

      // 4. Check merchant match (if merchant-specific)
      if (redemption.merchantId && redemption.merchantId !== params.merchantId) {
        throw new Error('Voucher not valid at this merchant');
      }

      // 5. Mark as USED
      const used = await tx.tokenRedemption.update({
        where: { voucherCode: params.voucherCode },
        data: {
          status: 'USED',
          usedAt: new Date(),
          actualCost: redemption.voucherValue, // NOW we record the actual cost
          recorded: false // Will be picked up by accounting job
        }
      });

      // 6. If merchant-specific, credit merchant account
      if (redemption.merchantId) {
        // TODO: Implement merchant credit system
        // This would credit ₩5,000 to the merchant's account
      }

      // 7. Send notification to user
      // TODO: Implement push notification

      return used;
    });
  },

  async expireOldTokens(): Promise<number> {
    // Cron job: Run daily to expire tokens older than 12 months
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const expiredTransactions = await prisma.tokenTransaction.findMany({
      where: {
        expiresAt: { lte: new Date() },
        expired: false,
        type: { in: ['EARN_CHECKIN', 'EARN_REFERRAL', 'EARN_BONUS'] }
      },
      select: { id: true, userId: true, amount: true }
    });

    let totalExpired = 0;

    for (const txn of expiredTransactions) {
      await prisma.$transaction(async (tx) => {
        // Mark transaction as expired
        await tx.tokenTransaction.update({
          where: { id: txn.id },
          data: { expired: true }
        });

        // Deduct from balance
        await tx.tokenBalance.update({
          where: { userId: txn.userId },
          data: {
            balance: { decrement: txn.amount },
            totalExpired: { increment: txn.amount }
          }
        });

        // Create EXPIRE transaction
        await tx.tokenTransaction.create({
          data: {
            userId: txn.userId,
            type: 'EXPIRE',
            amount: -txn.amount,
            description: `Expired after 12 months`
          }
        });
      });

      totalExpired += txn.amount;
    }

    return totalExpired;
  },

  _generateVoucherCode(): string {
    // Generate 12-character alphanumeric code: ZZIK-XXXX-XXXX
    const part1 = nanoid(4).toUpperCase();
    const part2 = nanoid(4).toUpperCase();
    return `ZZIK-${part1}-${part2}`;
  }
};
```

---

## Migration Strategy

### Phase 1: Database Migration (Day 1)
```bash
# Create new Prisma migration
pnpm db:migrate -- create-subscription-model

# This will:
# 1. Create new tables (UserSubscription, MerchantSubscription, TokenBalance, etc.)
# 2. Add new fields to User, Merchant, Campaign
# 3. Migrate existing data:
#    - All existing users → FREE tier with 3 check-ins/month
#    - All existing merchants → NO subscription (require signup)
#    - All existing campaigns → Pause until merchant subscribes
```

### Phase 2: API Implementation (Day 2)
```
1. Implement SubscriptionService
2. Implement TokenService
3. Update CheckinService to check tier limits
4. Create API routes:
   - POST /api/v1/subscriptions/user/create
   - POST /api/v1/subscriptions/user/cancel
   - GET /api/v1/subscriptions/user/status
   - POST /api/v1/tokens/redeem
   - POST /api/v1/tokens/voucher/use
   - GET /api/v1/tokens/balance
5. Implement Stripe webhook handler
```

### Phase 3: Frontend Integration (Day 3)
```
1. Update check-in flow to show tier limits
2. Create subscription upgrade modal
3. Create token redemption UI
4. Update user profile to show subscription status
5. Create merchant subscription dashboard
```

---

## Testing Checklist

### Unit Tests
- [ ] TokenService.redeemTokens (insufficient balance)
- [ ] TokenService.redeemTokens (successful redemption)
- [ ] TokenService.useVoucher (expired voucher)
- [ ] TokenService.useVoucher (merchant mismatch)
- [ ] CheckinService tier limit (FREE user at 3/3)
- [ ] CheckinService tier limit (PREMIUM user unlimited)
- [ ] SubscriptionService.createUserSubscription (success)
- [ ] SubscriptionService.handleStripeWebhook (subscription.updated)

### Integration Tests
- [ ] User upgrades to PREMIUM → check-in limit removed
- [ ] User check-in at 3/3 limit → rejected
- [ ] PREMIUM user check-in → 100 tokens earned
- [ ] FREE user check-in → 0 tokens earned
- [ ] Redeem 5,000 tokens → voucher created
- [ ] Use voucher → actual cost recorded
- [ ] Merchant reaches check-in limit → overage charged
- [ ] User cancels subscription → downgraded to FREE at period end

### E2E Tests
- [ ] Complete flow: Upgrade → Check-in → Earn tokens → Redeem voucher → Use voucher
- [ ] Stripe webhook integration (use Stripe CLI for testing)
- [ ] Token expiry cron job (fast-forward time in test)

---

## Rollout Plan

### Week 1 (Internal Testing)
- Deploy to staging environment
- Manual testing by team
- Fix critical bugs
- Load testing (simulate 1,000 users)

### Week 2 (Closed Beta)
- Invite 50 existing users to try PREMIUM
- Collect feedback on pricing
- Monitor token redemption rates
- Adjust if redemption rate > 40% (too high)

### Week 3 (Public Launch)
- Announce new subscription model
- Offer 30-day free trial for PREMIUM
- Launch referral program (500 tokens per referral)
- Monitor churn rate closely

### Week 4 (Optimization)
- Analyze conversion funnel (Free → Premium)
- A/B test pricing (₩9,900 vs ₩7,900)
- Optimize token redemption flow
- Add more voucher redemption options

---

## Success Metrics (30 Days Post-Launch)

### User Metrics
- FREE to PREMIUM conversion: **Target 15%**
- Premium churn rate: **Target <8%**
- Avg check-ins per premium user: **Target 20/month**
- Token redemption rate: **Target 25-35%**

### Revenue Metrics
- MRR from user subscriptions: **Target ₩50M** (5,000 premium users)
- MRR from merchant subscriptions: **Target ₩500M** (1,000 merchants)
- Total MRR: **Target ₩550M**
- Deferred token liability: **Target <₩10M** (manageable)

### Operational Metrics
- Stripe payment success rate: **Target >95%**
- Token system uptime: **Target 99.9%**
- Average token earn-to-redeem cycle: **Target 30-45 days**
- Customer support tickets: **Target <100/month**

---

## Risk Mitigation

### Risk 1: Users Don't Want to Pay
**Mitigation**: 
- Offer 30-day free trial
- Launch referral program (earn tokens for free)
- Show clear value prop ("Earn ₩10,000/month in vouchers")

### Risk 2: Token Redemption Rate Too High
**Mitigation**:
- Monitor redemption rate weekly
- If > 40%, reduce tokens per check-in (100 → 75)
- Or increase redemption threshold (5,000 → 7,500)

### Risk 3: Merchants Don't Subscribe
**Mitigation**:
- Offer first month free
- Show ROI calculator (cost per visit vs CPCV)
- Highlight unlimited campaigns in PRO tier

### Risk 4: Payment Failures
**Mitigation**:
- Implement retry logic (3 attempts over 7 days)
- Send proactive email reminders
- Allow grace period (7 days) before downgrade

---

## Conclusion

This subscription + token model fixes the broken unit economics:

**Old Model**:
- Revenue: ₩2,000 per check-in
- Cost: ₩3,040 per check-in
- **Loss: -₩1,040 ❌**

**New Model**:
- Revenue: ₩9,900 per premium user/month (20 check-ins)
- Cost: ₩600 in deferred tokens (20 × ₩30)
- **Profit per user: ₩9,300 ✅**
- **Gross margin: 94% ✅**

At scale (5,000 premium users + 1,000 merchants):
- User MRR: ₩49.5M
- Merchant MRR: ₩500M
- **Total MRR: ₩550M**
- **Annual Revenue: ₩6.6B (Year 1 target) ✅**

Implementation timeline: **3 days** for critical path, then iterative improvements.

---

**Next Steps**:
1. Review this design document
2. Create Prisma migration
3. Implement backend services
4. Build frontend components
5. Test thoroughly
6. Launch closed beta


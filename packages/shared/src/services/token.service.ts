// Token service for managing token economy
// Handles token issuance, redemption, expiry, and voucher generation

import { prisma } from '@zzik/database/src/client';
import { customAlphabet } from 'nanoid';

// Custom alphabet for voucher codes (exclude similar-looking characters)
const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4);

export const TokenService = {
  /**
   * Award tokens for check-in
   * Called by CheckinService after successful validation
   */
  async awardTokens(params: {
    userId: string;
    checkInId: string;
    tokensEarned: number;
    description?: string;
  }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 1. Update or create token balance
      await tx.tokenBalance.upsert({
        where: { userId: params.userId },
        create: {
          userId: params.userId,
          balance: params.tokensEarned,
          totalEarned: params.tokensEarned,
          lastEarnedAt: new Date()
        },
        update: {
          balance: { increment: params.tokensEarned },
          totalEarned: { increment: params.tokensEarned },
          lastEarnedAt: new Date()
        }
      });

      // 2. Create transaction record
      await tx.tokenTransaction.create({
        data: {
          userId: params.userId,
          type: 'EARN_CHECKIN',
          amount: params.tokensEarned,
          checkInId: params.checkInId,
          description: params.description || `Check-in tokens`,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year expiry
        }
      });
    });
  },

  /**
   * Award bonus tokens (streak, referral, etc.)
   */
  async awardBonusTokens(params: {
    userId: string;
    amount: number;
    type: 'EARN_BONUS' | 'EARN_REFERRAL';
    description: string;
  }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.tokenBalance.upsert({
        where: { userId: params.userId },
        create: {
          userId: params.userId,
          balance: params.amount,
          totalEarned: params.amount,
          lastEarnedAt: new Date()
        },
        update: {
          balance: { increment: params.amount },
          totalEarned: { increment: params.amount },
          lastEarnedAt: new Date()
        }
      });

      await tx.tokenTransaction.create({
        data: {
          userId: params.userId,
          type: params.type,
          amount: params.amount,
          description: params.description,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
      });
    });
  },

  /**
   * Redeem tokens for voucher
   */
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

  /**
   * Use voucher at merchant
   */
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
        // This would credit the merchant's account with the voucher value
      }

      // 7. Send notification to user
      // TODO: Implement push notification

      return used;
    });
  },

  /**
   * Get token balance and recent transactions
   */
  async getTokenBalance(userId: string): Promise<any> {
    const balance = await prisma.tokenBalance.findUnique({
      where: { userId },
      select: {
        balance: true,
        totalEarned: true,
        totalRedeemed: true,
        totalExpired: true,
        lastEarnedAt: true,
        lastRedeemedAt: true
      }
    });

    const recentTransactions = await prisma.tokenTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        type: true,
        amount: true,
        description: true,
        createdAt: true,
        expiresAt: true
      }
    });

    // Find expiring tokens (within next 30 days)
    const expiringTokens = await prisma.tokenTransaction.findMany({
      where: {
        userId,
        expired: false,
        expiresAt: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        type: { in: ['EARN_CHECKIN', 'EARN_REFERRAL', 'EARN_BONUS'] }
      },
      orderBy: { expiresAt: 'asc' },
      select: {
        amount: true,
        expiresAt: true
      }
    });

    return {
      balance: balance || {
        balance: 0,
        totalEarned: 0,
        totalRedeemed: 0,
        totalExpired: 0
      },
      recentTransactions,
      expiringTokens: expiringTokens.map(t => ({
        amount: t.amount,
        expiresAt: t.expiresAt,
        daysRemaining: Math.ceil((t.expiresAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      })),
      redemptionOptions: [
        {
          tokensRequired: 5000,
          voucherValue: 5000,
          available: (balance?.balance || 0) >= 5000
        },
        {
          tokensRequired: 10000,
          voucherValue: 10000,
          bonusValue: 500, // 5% bonus for larger redemption
          available: (balance?.balance || 0) >= 10000
        },
        {
          tokensRequired: 20000,
          voucherValue: 20000,
          bonusValue: 1500, // 7.5% bonus
          available: (balance?.balance || 0) >= 20000
        }
      ]
    };
  },

  /**
   * Get active vouchers for user
   */
  async getUserVouchers(userId: string): Promise<any> {
    return await prisma.tokenRedemption.findMany({
      where: {
        userId,
        status: 'PENDING',
        expiresAt: { gte: new Date() }
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        voucherCode: true,
        voucherValue: true,
        merchantId: true,
        expiresAt: true,
        createdAt: true
      }
    });
  },

  /**
   * Validate voucher (for QR code scanning)
   */
  async validateVoucher(voucherCode: string): Promise<{
    valid: boolean;
    voucher?: any;
    error?: string;
  }> {
    const voucher = await prisma.tokenRedemption.findUnique({
      where: { voucherCode },
      select: {
        id: true,
        status: true,
        voucherValue: true,
        merchantId: true,
        expiresAt: true,
        userId: true,
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    if (!voucher) {
      return { valid: false, error: 'Voucher not found' };
    }

    if (voucher.status !== 'PENDING') {
      return { valid: false, error: `Voucher already ${voucher.status.toLowerCase()}` };
    }

    if (new Date() > voucher.expiresAt) {
      // Auto-expire
      await prisma.tokenRedemption.update({
        where: { voucherCode },
        data: { status: 'EXPIRED' }
      });
      return { valid: false, error: 'Voucher expired' };
    }

    return { valid: true, voucher };
  },

  /**
   * Expire old tokens (cron job - run daily)
   * Tokens expire after 12 months from issuance
   */
  async expireOldTokens(): Promise<{ expiredCount: number; tokensExpired: number }> {
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
            description: `Tokens expired after 12 months`
          }
        });
      });

      totalExpired += txn.amount;
    }

    return {
      expiredCount: expiredTransactions.length,
      tokensExpired: totalExpired
    };
  },

  /**
   * Expire old vouchers (cron job - run daily)
   */
  async expireOldVouchers(): Promise<{ expiredCount: number }> {
    const result = await prisma.tokenRedemption.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lte: new Date() }
      },
      data: {
        status: 'EXPIRED'
      }
    });

    return { expiredCount: result.count };
  },

  /**
   * Generate unique voucher code
   * Format: ZZIK-XXXX-XXXX (12 characters)
   */
  _generateVoucherCode(): string {
    const part1 = nanoid();
    const part2 = nanoid();
    return `ZZIK-${part1}-${part2}`;
  },

  /**
   * Get token statistics (for admin dashboard)
   */
  async getTokenStatistics(): Promise<any> {
    const [
      totalIssued,
      totalRedeemed,
      totalExpired,
      activeBalance,
      pendingVouchers
    ] = await Promise.all([
      prisma.tokenTransaction.aggregate({
        where: { type: { in: ['EARN_CHECKIN', 'EARN_REFERRAL', 'EARN_BONUS'] } },
        _sum: { amount: true }
      }),
      prisma.tokenBalance.aggregate({
        _sum: { totalRedeemed: true }
      }),
      prisma.tokenBalance.aggregate({
        _sum: { totalExpired: true }
      }),
      prisma.tokenBalance.aggregate({
        _sum: { balance: true }
      }),
      prisma.tokenRedemption.aggregate({
        where: { status: 'PENDING' },
        _sum: { voucherValue: true },
        _count: true
      })
    ]);

    return {
      totalIssued: totalIssued._sum.amount || 0,
      totalRedeemed: totalRedeemed._sum.totalRedeemed || 0,
      totalExpired: totalExpired._sum.totalExpired || 0,
      activeBalance: activeBalance._sum.balance || 0,
      pendingVouchers: {
        count: pendingVouchers._count,
        value: pendingVouchers._sum.voucherValue || 0
      },
      redemptionRate: totalIssued._sum.amount 
        ? ((totalRedeemed._sum.totalRedeemed || 0) / (totalIssued._sum.amount || 1)) 
        : 0
    };
  }
};

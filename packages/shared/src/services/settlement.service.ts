import { prisma } from '@zzik/database/src/client';

export const SettlementService = {
  async settleCPCV(checkinId: string): Promise<{
    userReward: number;
    platformFee: number;
    networkFee: number;
  }> {
    return prisma.$transaction(
      async (tx) => {
        // 1. Get check-in with campaign and merchant wallet
        const c = await tx.validatedCheckIn.findUnique({
          where: { id: checkinId },
          include: {
            campaign: {
              include: {
                merchant: {
                  include: { sponsorWallet: true },
                },
              },
            },
          },
        });

        if (!c || !c.campaign || !c.campaign.merchant.sponsorWallet) {
          return { userReward: 0, platformFee: 0, networkFee: 0 };
        }

        // 2. Calculate distribution
        const cpcv = Number(c.campaign.cpcvAmount ?? 700); // KRW
        const dist = (c.campaign.distribution as any) || {
          user: 0.7,
          platform: 0.25,
          network: 0.05,
        };

        const userReward = Math.floor(cpcv * dist.user);
        const platformFee = Math.floor(cpcv * dist.platform);
        const networkFee = cpcv - userReward - platformFee;

        // 3. Update sponsor wallet (deduct CPCV)
        await tx.sponsorWallet.update({
          where: { id: c.campaign.merchant.sponsorWallet.id },
          data: { balance: { decrement: cpcv } },
        });

        // 4. Credit user points
        await tx.user.update({
          where: { id: c.userId },
          data: {
            points: { increment: userReward },
            totalCheckIns: { increment: 1 },
          },
        });

        // 5. Record transactions
        await tx.creditTransaction.createMany({
          data: [
            {
              walletId: c.campaign.merchant.sponsorWallet.id,
              type: 'SPEND',
              amount: -cpcv,
              campaignId: c.campaign.id,
            },
            {
              walletId: c.campaign.merchant.sponsorWallet.id,
              type: 'PLATFORM_FEE',
              amount: -platformFee,
              campaignId: c.campaign.id,
            },
            {
              walletId: c.campaign.merchant.sponsorWallet.id,
              type: 'NETWORK_POOL',
              amount: -networkFee,
              campaignId: c.campaign.id,
            },
          ],
        });

        // 6. Update check-in with earned points
        await tx.validatedCheckIn.update({
          where: { id: checkinId },
          data: { pointsEarned: userReward },
        });

        // 7. Update campaign stats
        await tx.campaign.update({
          where: { id: c.campaign.id },
          data: {
            budgetSpent: { increment: cpcv },
            totalCheckIns: { increment: 1 },
          },
        });

        return { userReward, platformFee, networkFee };
      },
      { isolationLevel: 'Serializable' }
    );
  },
};

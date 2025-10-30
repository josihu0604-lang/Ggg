'use server';

import { prisma } from '@zzik/database';

export interface TokenTransaction {
  id: string;
  type: 'EARN' | 'REDEEM' | 'BONUS' | 'EXPIRE';
  amount: number;
  description: string;
  timestamp: Date;
  balance: number;
}

export interface WalletData {
  balance: number;
  totalEarned: number;
  totalRedeemed: number;
  transactions: TokenTransaction[];
}

/**
 * Get wallet data and transaction history
 * Mock data for now - will connect to real DB when configured
 */
export async function getWalletData(userId?: string): Promise<WalletData> {
  try {
    if (!process.env.DATABASE_URL || !userId) {
      console.log('[Wallet] Using mock data');
      return getMockWalletData();
    }

    // Fetch real wallet data
    const tokenBalance = await prisma.tokenBalance.findUnique({
      where: { userId },
      include: {
        transactions: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            checkIn: {
              include: {
                poi: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!tokenBalance) {
      return getMockWalletData();
    }

    // Map transactions
    let runningBalance = tokenBalance.balance;
    const transactions: TokenTransaction[] = tokenBalance.transactions.map((tx) => {
      const transaction: TokenTransaction = {
        id: tx.id,
        type: mapTransactionType(tx.type),
        amount: tx.amount,
        description: getTransactionDescription(tx),
        timestamp: tx.createdAt,
        balance: runningBalance,
      };
      runningBalance -= tx.amount; // Calculate previous balance
      return transaction;
    });

    return {
      balance: tokenBalance.balance,
      totalEarned: tokenBalance.totalEarned,
      totalRedeemed: tokenBalance.totalRedeemed,
      transactions: transactions.reverse(), // Chronological order
    };
  } catch (error) {
    console.error('[Wallet] Error fetching wallet data:', error);
    return getMockWalletData();
  }
}

function mapTransactionType(type: string): 'EARN' | 'REDEEM' | 'BONUS' | 'EXPIRE' {
  if (type.startsWith('EARN')) return 'EARN';
  if (type.startsWith('REDEEM')) return 'REDEEM';
  if (type === 'EXPIRE') return 'EXPIRE';
  return 'BONUS';
}

function getTransactionDescription(tx: any): string {
  if (tx.checkIn?.poi?.name) {
    return `${tx.checkIn.poi.name}에서 체크인`;
  }
  return tx.description || '토큰 거래';
}

/**
 * Mock wallet data for development
 */
function getMockWalletData(): WalletData {
  const now = new Date();
  const transactions: TokenTransaction[] = [
    {
      id: '1',
      type: 'EARN',
      amount: 100,
      description: '스타벅스 강남역점에서 체크인',
      timestamp: new Date(now.getTime() - 2 * 3600000),
      balance: 15420,
    },
    {
      id: '2',
      type: 'EARN',
      amount: 150,
      description: '교보문고 광화문점에서 체크인',
      timestamp: new Date(now.getTime() - 26 * 3600000),
      balance: 15320,
    },
    {
      id: '3',
      type: 'BONUS',
      amount: 200,
      description: '7일 연속 체크인 보너스',
      timestamp: new Date(now.getTime() - 28 * 3600000),
      balance: 15170,
    },
    {
      id: '4',
      type: 'EARN',
      amount: 120,
      description: '남산공원에서 체크인',
      timestamp: new Date(now.getTime() - 50 * 3600000),
      balance: 14970,
    },
    {
      id: '5',
      type: 'REDEEM',
      amount: -5000,
      description: '5,000원 상품권 교환',
      timestamp: new Date(now.getTime() - 72 * 3600000),
      balance: 14850,
    },
    {
      id: '6',
      type: 'EARN',
      amount: 100,
      description: '국립중앙박물관에서 체크인',
      timestamp: new Date(now.getTime() - 96 * 3600000),
      balance: 19850,
    },
    {
      id: '7',
      type: 'EARN',
      amount: 80,
      description: '이디야 홍대점에서 체크인',
      timestamp: new Date(now.getTime() - 120 * 3600000),
      balance: 19750,
    },
    {
      id: '8',
      type: 'BONUS',
      amount: 150,
      description: '친구 추천 보너스',
      timestamp: new Date(now.getTime() - 144 * 3600000),
      balance: 19670,
    },
  ];

  return {
    balance: 15420,
    totalEarned: 23650,
    totalRedeemed: 8230,
    transactions,
  };
}

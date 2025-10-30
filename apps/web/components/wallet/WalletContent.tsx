'use client';

import { useState } from 'react';
import RedeemModal from './RedeemModal';
import type { TokenTransaction } from '../../lib/actions/wallet';

interface WalletContentProps {
  wallet: {
    balance: number;
    totalEarned: number;
    totalRedeemed: number;
    transactions: TokenTransaction[];
  };
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return '방금 전';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}일 전`;
  return new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function getTransactionIcon(type: string): string {
  switch (type) {
    case 'EARN': return '📍';
    case 'REDEEM': return '🎁';
    case 'BONUS': return '✨';
    case 'EXPIRE': return '⏰';
    default: return '💰';
  }
}

function getTransactionColor(type: string): string {
  switch (type) {
    case 'EARN': return 'text-green-400';
    case 'REDEEM': return 'text-red-400';
    case 'BONUS': return 'text-yellow-400';
    case 'EXPIRE': return 'text-gray-400';
    default: return 'text-white';
  }
}

export default function WalletContent({ wallet }: WalletContentProps) {
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  return (
    <>
      {/* Balance Card */}
      <header className="glass-card rounded-2xl p-6 mb-4 text-center animate-liquid-appear">
        <div className="text-5xl mb-3" aria-hidden="true">💰</div>
        <h1 className="text-sm text-gray-400 mb-2">보유 토큰</h1>
        <div className="text-5xl font-bold text-yellow-400 mb-1">
          {wallet.balance.toLocaleString()}
        </div>
        <div className="text-xs text-gray-400 mb-6">ZZIK</div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
          <div>
            <div className="text-sm text-gray-400 mb-1">총 획득</div>
            <div className="text-xl font-bold text-green-400">
              +{wallet.totalEarned.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">총 사용</div>
            <div className="text-xl font-bold text-red-400">
              -{wallet.totalRedeemed.toLocaleString()}
            </div>
          </div>
        </div>
      </header>
      
      {/* Quick Actions */}
      <section className="grid grid-cols-3 gap-3 mb-6">
        <button 
          onClick={() => setShowRedeemModal(true)}
          className="glass-card p-4 rounded-xl text-center hover:bg-white/5 transition-colors"
        >
          <div className="text-2xl mb-2" aria-hidden="true">🎁</div>
          <div className="text-xs font-medium">교환하기</div>
        </button>
        <button className="glass-card p-4 rounded-xl text-center hover:bg-white/5 transition-colors">
          <div className="text-2xl mb-2" aria-hidden="true">📜</div>
          <div className="text-xs font-medium">쿠폰함</div>
        </button>
        <button className="glass-card p-4 rounded-xl text-center hover:bg-white/5 transition-colors">
          <div className="text-2xl mb-2" aria-hidden="true">📊</div>
          <div className="text-xs font-medium">통계</div>
        </button>
      </section>
      
      {/* Transaction History */}
      <section>
        <h2 className="text-lg font-semibold mb-3 px-1 flex items-center gap-2">
          <span aria-hidden="true">📋</span>
          <span>거래 내역</span>
          <span className="text-sm font-normal text-gray-400">({wallet.transactions.length})</span>
        </h2>
        
        {wallet.transactions.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="text-5xl mb-4" aria-hidden="true">📭</div>
            <h3 className="text-xl font-semibold mb-2">거래 내역이 없어요</h3>
            <p className="text-sm text-gray-400">
              체크인을 하면 토큰을 획득할 수 있어요!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {wallet.transactions.map((tx) => (
              <article 
                key={tx.id} 
                className="glass-card rounded-xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors"
              >
                <div className="text-2xl" aria-hidden="true">
                  {getTransactionIcon(tx.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{tx.description}</div>
                  <time className="text-xs text-gray-400" dateTime={new Date(tx.timestamp).toISOString()}>
                    {formatTimeAgo(tx.timestamp)}
                  </time>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`font-bold ${getTransactionColor(tx.type)}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">
                    잔액: {tx.balance.toLocaleString()}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      
      {/* Info Box */}
      <div className="mt-6 mb-4 glass-card rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl" aria-hidden="true">ℹ️</span>
          <div className="text-xs text-gray-400 leading-relaxed">
            <p className="mb-2">• 토큰은 획득일로부터 12개월 동안 유효합니다.</p>
            <p>• 5,000 토큰 = 5,000원 상품권으로 교환 가능합니다.</p>
          </div>
        </div>
      </div>

      {/* Redeem Modal */}
      {showRedeemModal && (
        <RedeemModal 
          currentBalance={wallet.balance}
          onClose={() => setShowRedeemModal(false)}
        />
      )}
    </>
  );
}

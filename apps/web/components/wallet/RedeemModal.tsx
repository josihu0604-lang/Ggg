'use client';

import { useState } from 'react';
import { useToast } from '../common/Toast';

interface RedeemModalProps {
  currentBalance: number;
  onClose: () => void;
  onRedeem?: (amount: number) => Promise<void>;
}

interface RedeemOption {
  tokens: number;
  value: number;
  label: string;
  description: string;
}

export default function RedeemModal({ currentBalance, onClose, onRedeem }: RedeemModalProps) {
  const [selectedOption, setSelectedOption] = useState<RedeemOption | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const { addToast } = useToast();

  const options: RedeemOption[] = [
    {
      tokens: 5000,
      value: 5000,
      label: '₩5,000 상품권',
      description: '편의점, 카페 등에서 사용 가능',
    },
    {
      tokens: 10000,
      value: 10000,
      label: '₩10,000 상품권',
      description: '5% 추가 할인',
    },
    {
      tokens: 30000,
      value: 30000,
      label: '₩30,000 상품권',
      description: '10% 추가 할인',
    },
    {
      tokens: 50000,
      value: 50000,
      label: '₩50,000 상품권',
      description: '15% 추가 할인',
    },
  ];

  const handleRedeem = async () => {
    if (!selectedOption) return;

    if (currentBalance < selectedOption.tokens) {
      addToast('error', '보유 토큰이 부족합니다.');
      return;
    }

    setRedeeming(true);

    try {
      if (onRedeem) {
        await onRedeem(selectedOption.tokens);
      }
      
      addToast('success', `${selectedOption.label} 교환 완료!`);
      onClose();
    } catch (error) {
      addToast('error', '교환 중 오류가 발생했습니다.');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 animate-liquid-appear"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative glass-card rounded-t-3xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="redeem-title"
      >
        {/* Handle */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/20 rounded-full" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 id="redeem-title" className="text-xl font-bold">토큰 교환</h2>
            <p className="text-sm text-gray-400 mt-1">
              보유 토큰: <span className="text-yellow-400 font-semibold">{currentBalance.toLocaleString()}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="icon-btn w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-6">
          {options.map((option) => {
            const canAfford = currentBalance >= option.tokens;
            const isSelected = selectedOption === option;

            return (
              <button
                key={option.tokens}
                onClick={() => setSelectedOption(option)}
                disabled={!canAfford}
                className={`w-full text-left p-4 rounded-xl transition-all ${
                  isSelected
                    ? 'bg-gradient-to-r from-orange-500/20 to-pink-500/20 border-2 border-orange-500'
                    : canAfford
                    ? 'glass-card hover:bg-white/5 border border-white/10'
                    : 'glass-card opacity-50 cursor-not-allowed border border-white/5'
                }`}
                aria-pressed={isSelected}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-lg">{option.label}</div>
                    <div className="text-xs text-gray-400">{option.description}</div>
                  </div>
                  {isSelected && (
                    <span className="text-2xl" aria-hidden="true">✓</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                  <span className="text-sm text-gray-400">필요 토큰</span>
                  <span className={`font-bold ${canAfford ? 'text-yellow-400' : 'text-gray-500'}`}>
                    {option.tokens.toLocaleString()}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Info Box */}
        <div className="glass-card rounded-xl p-4 mb-6 bg-blue-500/5 border border-blue-500/20">
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0" aria-hidden="true">ℹ️</span>
            <div className="text-xs text-gray-400 leading-relaxed">
              <p className="mb-1">• 교환된 상품권은 쿠폰함에서 확인할 수 있습니다.</p>
              <p className="mb-1">• 상품권은 발급일로부터 30일간 유효합니다.</p>
              <p>• 교환은 취소가 불가능하니 신중히 선택해주세요.</p>
            </div>
          </div>
        </div>

        {/* Redeem Button */}
        <button
          onClick={handleRedeem}
          disabled={!selectedOption || redeeming}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
            selectedOption && !redeeming
              ? 'bg-gradient-to-r from-orange-500 to-pink-500 hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          {redeeming ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block animate-spin">⏳</span>
              <span>교환 중...</span>
            </span>
          ) : selectedOption ? (
            <span className="flex items-center justify-center gap-2">
              <span aria-hidden="true">🎁</span>
              <span>{selectedOption.tokens.toLocaleString()} 토큰으로 교환하기</span>
            </span>
          ) : (
            '교환할 상품권을 선택하세요'
          )}
        </button>
      </div>
    </div>
  );
}

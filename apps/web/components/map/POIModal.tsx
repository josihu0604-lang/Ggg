'use client';

import { useState } from 'react';
import { useGeolocation, calculateDistance } from '../../lib/hooks/useGeolocation';
import { performCheckIn } from '../../lib/actions/checkin';
import { useToast } from '../common/Toast';

interface POI {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  visitCount: number;
  hasActiveCampaign: boolean;
}

interface POIModalProps {
  poi: POI;
  onClose: () => void;
}

export default function POIModal({ poi, onClose }: POIModalProps) {
  const [checking, setChecking] = useState(false);
  const location = useGeolocation();
  const { addToast } = useToast();

  // Calculate distance to POI
  const distance = location.latitude && location.longitude
    ? calculateDistance(location.latitude, location.longitude, poi.lat, poi.lng)
    : null;

  const canCheckIn = distance !== null && distance <= 100 && location.accuracy !== null && location.accuracy <= 50;

  const handleCheckIn = async () => {
    if (!location.latitude || !location.longitude || !location.accuracy) {
      addToast('error', 'GPS 위치를 확인할 수 없습니다.');
      return;
    }

    setChecking(true);

    try {
      const result = await performCheckIn({
        poiId: poi.id,
        userLat: location.latitude,
        userLng: location.longitude,
        accuracy: location.accuracy,
      });

      if (result.success && result.data) {
        addToast('success', `체크인 완료! +${result.data.tokensEarned} 토큰 획득`);
        onClose();
      } else {
        addToast('error', result.message);
      }
    } catch (error) {
      addToast('error', '체크인 중 오류가 발생했습니다.');
    } finally {
      setChecking(false);
    }
  };

  const getCategoryIcon = (category: string): string => {
    const iconMap: Record<string, string> = {
      '카페': '☕',
      '식당': '🍽️',
      '공원': '🌳',
      '서점': '📚',
      '편의점': '🏪',
      '헬스장': '💪',
      '영화관': '🎬',
      '박물관': '🏛️',
      '관광지': '🗼',
    };
    return iconMap[category] || '📍';
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
        className="relative glass-card rounded-t-3xl max-w-lg w-full p-6 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="poi-title"
        aria-describedby="poi-description"
      >
        {/* Handle */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/20 rounded-full" />

        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center text-4xl">
            {getCategoryIcon(poi.category)}
          </div>
          <div className="flex-1">
            <h2 id="poi-title" className="text-xl font-bold mb-1">{poi.name}</h2>
            <p className="text-sm text-gray-400">{poi.category}</p>
          </div>
          <button
            onClick={onClose}
            className="icon-btn w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="glass-card p-3 rounded-xl text-center">
            <div className="text-xs text-gray-400 mb-1">방문자</div>
            <div className="text-lg font-bold">{poi.visitCount}</div>
          </div>
          <div className="glass-card p-3 rounded-xl text-center">
            <div className="text-xs text-gray-400 mb-1">거리</div>
            <div className="text-lg font-bold">
              {distance !== null ? `${Math.round(distance)}m` : '...'}
            </div>
          </div>
          <div className="glass-card p-3 rounded-xl text-center">
            <div className="text-xs text-gray-400 mb-1">보상</div>
            <div className="text-lg font-bold text-yellow-400">
              {poi.hasActiveCampaign ? '150' : '100'}
            </div>
          </div>
        </div>

        {/* Campaign Badge */}
        {poi.hasActiveCampaign && (
          <div className="mb-4 glass-card p-3 rounded-xl bg-gradient-to-r from-orange-500/10 to-pink-500/10 border border-orange-500/20">
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden="true">🎁</span>
              <div className="flex-1">
                <div className="text-sm font-semibold">활성 오퍼</div>
                <div className="text-xs text-gray-400">+50 보너스 토큰</div>
              </div>
            </div>
          </div>
        )}

        {/* Location Status */}
        {location.loading ? (
          <div className="mb-4 text-center text-sm text-gray-400">
            <span className="inline-block animate-spin mr-2">⏳</span>
            위치 확인 중...
          </div>
        ) : location.error ? (
          <div className="mb-4 glass-card p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 text-sm text-red-400">
              <span aria-hidden="true">⚠️</span>
              <span>{location.error}</span>
            </div>
          </div>
        ) : distance !== null && distance > 100 ? (
          <div className="mb-4 glass-card p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2 text-sm text-yellow-400">
              <span aria-hidden="true">📍</span>
              <span>체크인 범위 밖입니다. {Math.round(distance)}m 더 가까이 가주세요.</span>
            </div>
          </div>
        ) : null}

        {/* Check-in Button */}
        <button
          onClick={handleCheckIn}
          disabled={!canCheckIn || checking}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
            canCheckIn && !checking
              ? 'bg-gradient-to-r from-orange-500 to-pink-500 hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          {checking ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block animate-spin">⏳</span>
              <span>체크인 중...</span>
            </span>
          ) : canCheckIn ? (
            <span className="flex items-center justify-center gap-2">
              <span aria-hidden="true">📍</span>
              <span>체크인하기</span>
            </span>
          ) : (
            '체크인 불가'
          )}
        </button>

        {/* Accuracy Info */}
        {location.accuracy !== null && (
          <div className="mt-3 text-center text-xs text-gray-500">
            GPS 정확도: ±{Math.round(location.accuracy)}m
          </div>
        )}
      </div>
    </div>
  );
}

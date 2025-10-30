import type { CheckInFeedItem } from '../../lib/actions/feed';

interface CheckInCardProps {
  checkIn: CheckInFeedItem;
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

function getCategoryIcon(category: string): string {
  const iconMap: Record<string, string> = {
    '카페': '☕',
    '식당': '🍽️',
    '공원': '🌳',
    '서점': '📚',
    '편의점': '🏪',
    '헬스장': '💪',
    '영화관': '🎬',
    '박물관': '🏛️',
    '병원': '🏥',
    '약국': '💊',
    '은행': '🏦',
    '학교': '🏫',
  };
  return iconMap[category] || '📍';
}

export default function CheckInCard({ checkIn }: CheckInCardProps) {
  const icon = getCategoryIcon(checkIn.poiCategory);
  const timeAgo = formatTimeAgo(checkIn.checkedAt);

  return (
    <article 
      className="glass-card rounded-2xl p-4 animate-liquid-appear hover:bg-white/5 transition-all duration-200"
      aria-label={`${checkIn.poiName} 체크인 정보`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div 
          className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center"
          aria-hidden="true"
        >
          <span className="text-2xl">{icon}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-white truncate">
              {checkIn.poiName}
            </h3>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-yellow-400 text-sm" aria-hidden="true">💰</span>
              <span className="text-sm font-bold text-yellow-400">
                +{checkIn.tokensEarned}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span aria-hidden="true">📍</span>
              <span>{checkIn.distance}m</span>
            </span>
            <span className="flex items-center gap-1">
              <span aria-hidden="true">🕐</span>
              <time dateTime={new Date(checkIn.checkedAt).toISOString()}>
                {timeAgo}
              </time>
            </span>
            {checkIn.userTier === 'PREMIUM' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500/20 to-pink-500/20 text-orange-400 font-medium">
                <span aria-hidden="true">✨</span>
                <span>PRO</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action hint */}
      <button 
        className="mt-3 w-full text-left text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center justify-between group"
        aria-label={`${checkIn.poiName} 위치 보기`}
      >
        <span>지도에서 보기</span>
        <span className="text-gray-600 group-hover:text-gray-400 transition-colors" aria-hidden="true">›</span>
      </button>
    </article>
  );
}

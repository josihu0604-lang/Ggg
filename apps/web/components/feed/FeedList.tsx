'use client';

import { useState, useMemo } from 'react';
import CheckInCard from './CheckInCard';
import FeedFilters, { type SortOption, type FilterCategory } from './FeedFilters';
import type { CheckInFeedItem } from '../../lib/actions/feed';

interface FeedListProps {
  initialCheckIns: CheckInFeedItem[];
  userStats: {
    totalCheckIns: number;
    totalTokens: number;
    currentStreak: number;
    level: string;
  };
}

export default function FeedList({ initialCheckIns, userStats }: FeedListProps) {
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [category, setCategory] = useState<FilterCategory>('all');

  // Filter and sort check-ins
  const filteredCheckIns = useMemo(() => {
    let result = [...initialCheckIns];

    // Filter by category
    if (category !== 'all') {
      result = result.filter((item) => item.poiCategory === category);
    }

    // Sort
    switch (sortBy) {
      case 'distance':
        result.sort((a, b) => a.distance - b.distance);
        break;
      case 'tokens':
        result.sort((a, b) => b.tokensEarned - a.tokensEarned);
        break;
      case 'recent':
      default:
        result.sort((a, b) => 
          new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
        );
        break;
    }

    return result;
  }, [initialCheckIns, category, sortBy]);

  return (
    <>
      {/* Header Section */}
      <header className="mb-6 animate-liquid-appear">
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl" aria-hidden="true">🏠</div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">홈 피드</h1>
              <p className="text-sm text-gray-400">최근 체크인 활동</p>
            </div>
          </div>
          
          {/* User Stats */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-400">{userStats.totalCheckIns}</div>
              <div className="text-xs text-gray-400">체크인</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{userStats.totalTokens.toLocaleString()}</div>
              <div className="text-xs text-gray-400">토큰</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-pink-400">{userStats.currentStreak}</div>
              <div className="text-xs text-gray-400">연속일</div>
            </div>
          </div>
        </div>
      </header>

      {/* Filters */}
      <FeedFilters 
        onSortChange={setSortBy}
        onCategoryChange={setCategory}
      />

      {/* Check-in Feed */}
      <section aria-label="최근 체크인 피드">
        <h2 className="text-lg font-semibold mb-3 px-1 flex items-center gap-2">
          <span aria-hidden="true">📍</span>
          <span>최근 활동</span>
          <span className="text-sm font-normal text-gray-400">({filteredCheckIns.length})</span>
        </h2>
        
        {filteredCheckIns.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="text-5xl mb-4" aria-hidden="true">
              {category === 'all' ? '🎯' : '🔍'}
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {category === 'all' ? '아직 체크인이 없어요' : '해당 카테고리에 체크인이 없어요'}
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              {category === 'all' 
                ? '근처 장소를 찾아 첫 체크인을 해보세요!'
                : '다른 카테고리를 선택해보세요.'
              }
            </p>
            {category === 'all' && (
              <button className="icon-btn px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl font-semibold hover:scale-105 transition-transform">
                체크인하기
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCheckIns.map((checkIn) => (
              <CheckInCard key={checkIn.id} checkIn={checkIn} />
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions - moved to bottom */}
      <section className="mt-6 mb-4">
        <h2 className="sr-only">빠른 액션</h2>
        <div className="grid grid-cols-2 gap-3">
          <button className="glass-card p-4 rounded-xl text-center hover:bg-white/5 transition-colors">
            <div className="text-3xl mb-2" aria-hidden="true">📍</div>
            <div className="text-sm font-medium">새 체크인</div>
          </button>
          <button className="glass-card p-4 rounded-xl text-center hover:bg-white/5 transition-colors">
            <div className="text-3xl mb-2" aria-hidden="true">🎁</div>
            <div className="text-sm font-medium">오퍼 보기</div>
          </button>
        </div>
      </section>
    </>
  );
}

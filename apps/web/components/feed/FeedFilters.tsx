'use client';

import { useState } from 'react';

export type SortOption = 'recent' | 'distance' | 'tokens';
export type FilterCategory = 'all' | '카페' | '식당' | '공원' | '서점';

interface FeedFiltersProps {
  onSortChange: (sort: SortOption) => void;
  onCategoryChange: (category: FilterCategory) => void;
}

export default function FeedFilters({ onSortChange, onCategoryChange }: FeedFiltersProps) {
  const [activeSort, setActiveSort] = useState<SortOption>('recent');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');

  const handleSortChange = (sort: SortOption) => {
    setActiveSort(sort);
    onSortChange(sort);
  };

  const handleCategoryChange = (category: FilterCategory) => {
    setActiveCategory(category);
    onCategoryChange(category);
  };

  const categories: Array<{ value: FilterCategory; label: string; icon: string }> = [
    { value: 'all', label: '전체', icon: '🌟' },
    { value: '카페', label: '카페', icon: '☕' },
    { value: '식당', label: '식당', icon: '🍽️' },
    { value: '공원', label: '공원', icon: '🌳' },
    { value: '서점', label: '서점', icon: '📚' },
  ];

  const sortOptions: Array<{ value: SortOption; label: string; icon: string }> = [
    { value: 'recent', label: '최신순', icon: '🕐' },
    { value: 'distance', label: '거리순', icon: '📍' },
    { value: 'tokens', label: '토큰순', icon: '💰' },
  ];

  return (
    <div className="mb-4 space-y-3">
      {/* Category Filter */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 mb-2 px-1">카테고리</h3>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => handleCategoryChange(cat.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeCategory === cat.value
                  ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white'
                  : 'glass-card hover:bg-white/5'
              }`}
              aria-pressed={activeCategory === cat.value}
            >
              <span className="mr-1.5" aria-hidden="true">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sort Options */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 mb-2 px-1">정렬</h3>
        <div className="flex gap-2">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSortChange(opt.value)}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeSort === opt.value
                  ? 'bg-white/10 text-white'
                  : 'glass-card text-gray-400 hover:bg-white/5'
              }`}
              aria-pressed={activeSort === opt.value}
            >
              <span className="mr-1" aria-hidden="true">{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { Category, Status } from '../types';
import { Search, Utensils, Building2, GraduationCap, PartyPopper, Shirt, HelpCircle, LayoutGrid } from 'lucide-react';

interface CategoryFilterBarProps {
  selectedCategory: Category | 'ALL';
  onSelectCategory: (cat: Category | 'ALL') => void;
  selectedStatus: Status | 'ALL';
  onSelectStatus: (status: Status | 'ALL') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortBy: 'latest' | 'upvotes' | 'comments';
  onSortChange: (sort: 'latest' | 'upvotes' | 'comments') => void;
}

const CATEGORY_ITEMS: { key: Category | 'ALL'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'ALL', label: '전체 보기', icon: LayoutGrid },
  { key: 'MEALS', label: '🍱 급식/식당', icon: Utensils },
  { key: 'FACILITY', label: '🏫 시설/환경', icon: Building2 },
  { key: 'ACADEMICS', label: '📚 학습/진로', icon: GraduationCap },
  { key: 'STUDENT_COUNCIL', label: '🎈 학생회/행사', icon: PartyPopper },
  { key: 'LIFE_RULES', label: '👔 교칙/생활', icon: Shirt },
  { key: 'OTHER', label: '💬 기타/자유', icon: HelpCircle },
];

const STATUS_ITEMS: { key: Status | 'ALL'; label: string }[] = [
  { key: 'ALL', label: '모든 상태' },
  { key: 'RECEIVED', label: '🟡 접수됨' },
  { key: 'IN_REVIEW', label: '🔵 검토 중' },
  { key: 'ANSWERED', label: '🟢 답변 완료' },
  { key: 'APPLIED', label: '🟣 반영 완료' },
  { key: 'ON_HOLD', label: '⚪ 보류' },
];

export const CategoryFilterBar: React.FC<CategoryFilterBarProps> = ({
  selectedCategory,
  onSelectCategory,
  selectedStatus,
  onSelectStatus,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
}) => {
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-4 sm:mt-6">
      <div className="bg-white rounded-2xl sm:rounded-[28px] p-3.5 sm:p-5 border border-[#E6E2D3] shadow-xs space-y-3 sm:space-y-4">
        
        {/* Search & Sort Controls Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
          
          {/* Search Input Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8C8479] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-query"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="제목, 건의 내용, #태그, 익명 닉네임 검색..."
              className="w-full pl-10 pr-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border border-[#E6E2D3] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#5F7161] bg-[#F4F1EA]/50 text-[#2D2926] transition-all placeholder:text-[#8C8479]"
            />
          </div>

          {/* Sort & Status Controls */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:space-x-2">
            {/* Status Dropdown */}
            <select
              id="select-status-filter"
              value={selectedStatus}
              onChange={(e) => onSelectStatus(e.target.value as Status | 'ALL')}
              className="w-full sm:w-auto bg-[#F4F1EA] border border-[#E6E2D3] text-[#2D2926] text-xs sm:text-sm font-semibold rounded-xl sm:rounded-2xl px-2.5 sm:px-3 py-2 sm:py-2.5 focus:outline-none focus:ring-2 focus:ring-[#5F7161] cursor-pointer"
            >
              {STATUS_ITEMS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>

            {/* Sort Dropdown */}
            <select
              id="select-sort-by"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as 'latest' | 'upvotes' | 'comments')}
              className="w-full sm:w-auto bg-[#F4F1EA] border border-[#E6E2D3] text-[#2D2926] text-xs sm:text-sm font-semibold rounded-xl sm:rounded-2xl px-2.5 sm:px-3 py-2 sm:py-2.5 focus:outline-none focus:ring-2 focus:ring-[#5F7161] cursor-pointer"
            >
              <option value="latest">최신 등록순 ⏱️</option>
              <option value="upvotes">최다 공감순 🔥</option>
              <option value="comments">댓글 많은순 💬</option>
            </select>
          </div>

        </div>

        {/* Category Tabs */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto pt-1 pb-1 -mx-3.5 px-3.5 sm:mx-0 sm:px-0 scrollbar-none">
          {CATEGORY_ITEMS.map((cat) => {
            const isSelected = selectedCategory === cat.key;
            const IconComp = cat.icon;
            return (
              <button
                key={cat.key}
                id={`cat-btn-${cat.key}`}
                onClick={() => onSelectCategory(cat.key)}
                className={`flex items-center space-x-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border shrink-0 ${
                  isSelected
                    ? 'bg-[#5F7161] text-white border-[#5F7161] shadow-xs'
                    : 'bg-[#F4F1EA]/80 hover:bg-[#F4F1EA] text-[#4A443F] border-[#E6E2D3]'
                }`}
              >
                <IconComp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
};


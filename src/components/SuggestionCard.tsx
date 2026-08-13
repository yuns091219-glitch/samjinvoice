import React from 'react';
import { Suggestion, Status, Category, normalizeCategory } from '../types';
import { ThumbsUp, MessageSquare, Lock, CheckCircle2, Clock, FileSearch, AlertCircle, Award } from 'lucide-react';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onSelectCard: (suggestion: Suggestion) => void;
  onUpvote: (id: string, e: React.MouseEvent) => void;
  isUpvoted?: boolean;
}

export const STATUS_CONFIG: Record<Status, { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }> = {
  RECEIVED: {
    label: '접수됨',
    badgeClass: 'bg-amber-100/80 text-amber-900 border-amber-300',
    icon: Clock,
  },
  IN_REVIEW: {
    label: '검토 중',
    badgeClass: 'bg-[#5F7161]/15 text-[#5F7161] border-[#5F7161]/30',
    icon: FileSearch,
  },
  ANSWERED: {
    label: '답변 완료',
    badgeClass: 'bg-[#4D5C4F]/20 text-[#4D5C4F] border-[#4D5C4F]/30',
    icon: CheckCircle2,
  },
  APPLIED: {
    label: '반영 완료!',
    badgeClass: 'bg-[#5F7161] text-white font-bold border-[#5F7161]',
    icon: Award,
  },
  ON_HOLD: {
    label: '보류',
    badgeClass: 'bg-[#E6E2D3] text-[#8C8479] border-[#E6E2D3]',
    icon: AlertCircle,
  },
};

export const CATEGORY_LABELS: Record<Category, string> = {
  MEALS: '🍱 급식/식당',
  FACILITY: '🏫 시설/환경',
  ACADEMICS: '📚 학습/진로',
  STUDENT_COUNCIL: '🎈 학생회/행사',
  LIFE_RULES: '👔 교칙/생활',
  OTHER: '💬 기타/자유',
};

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  onSelectCard,
  onUpvote,
  isUpvoted = false,
}) => {
  const statusInfo = STATUS_CONFIG[suggestion.status];
  const StatusIcon = statusInfo.icon;

  const formattedDate = new Date(suggestion.createdAt).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      onClick={() => onSelectCard(suggestion)}
      className="bg-white rounded-[24px] p-5 border border-[#E6E2D3] shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between group hover:border-[#5F7161] relative overflow-hidden"
    >
      {/* Top Meta Bar */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            {/* Category Tag */}
            <span className="text-xs font-semibold bg-[#F4F1EA] text-[#4A443F] px-2.5 py-1 rounded-xl border border-[#E6E2D3]">
              {CATEGORY_LABELS[normalizeCategory(suggestion.category)] || CATEGORY_LABELS['OTHER']}
            </span>

            {/* Status Badge */}
            <span
              className={`inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusInfo.badgeClass}`}
            >
              <StatusIcon className="w-3 h-3" />
              <span>{statusInfo.label}</span>
            </span>

            {/* Secret Badge */}
            {suggestion.isSecret && (
              <span className="inline-flex items-center space-x-1 text-xs bg-rose-50 text-rose-800 px-2 py-0.5 rounded-md border border-rose-200 font-semibold">
                <Lock className="w-3 h-3" />
                <span>비밀글</span>
              </span>
            )}
          </div>

          <span className="text-xs text-[#8C8479] whitespace-nowrap">{formattedDate}</span>
        </div>

        {/* Title */}
        <h3 className="font-bold text-[#2D2926] text-base sm:text-lg group-hover:text-[#5F7161] transition-colors line-clamp-2 mb-2 leading-snug">
          {suggestion.title}
        </h3>

        {/* Content Excerpt */}
        <p className="text-[#8C8479] text-xs sm:text-sm line-clamp-2 leading-relaxed mb-4">
          {suggestion.content}
        </p>

        {/* Tags */}
        {suggestion.tags && suggestion.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {suggestion.tags.map((tag, i) => (
              <span key={i} className="text-[11px] font-bold text-[#5F7161] bg-[#F4F1EA] px-2.5 py-0.5 rounded-lg border border-[#E6E2D3]">
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}

        {/* Official Response Banner Highlight */}
        {suggestion.officialResponse && (
          <div className="mb-4 bg-[#F4F1EA] border border-[#E6E2D3] rounded-2xl p-3.5 text-xs text-[#2D2926] flex items-start space-x-2.5">
            <div className="w-6 h-6 rounded-xl bg-[#5F7161] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
              공식
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="font-bold text-[#2D2926]">
                  [{suggestion.officialResponse.department}] {suggestion.officialResponse.authorName}
                </span>
              </div>
              <p className="text-[#8C8479] line-clamp-2 leading-relaxed">
                {suggestion.officialResponse.content}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Meta: Author & Actions */}
      <div className="pt-3 border-t border-[#E6E2D3] flex items-center justify-between text-xs text-[#8C8479]">
        
        {/* Anonymous Author Nickname */}
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-full bg-[#E6E2D3] flex items-center justify-center font-bold text-[10px] text-[#2D2926]">
            익명
          </div>
          <span className="font-bold text-[#2D2926] truncate max-w-[140px]">
            {suggestion.authorNickname}
          </span>
        </div>

        {/* Upvotes & Comments */}
        <div className="flex items-center space-x-3">
          
          {/* Upvote Button */}
          <button
            id={`btn-upvote-${suggestion.id}`}
            onClick={(e) => onUpvote(suggestion.id, e)}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-xl font-bold transition-all border active:scale-95 ${
              isUpvoted
                ? 'bg-[#5F7161] hover:bg-[#4D5C4F] text-white border-[#5F7161] shadow-xs'
                : 'bg-[#5F7161]/10 hover:bg-[#5F7161]/20 text-[#5F7161] border-[#5F7161]/30'
            }`}
            title={isUpvoted ? '공감 취소' : '이 건의에 공감합니다'}
          >
            <ThumbsUp className={`w-3.5 h-3.5 ${isUpvoted ? 'fill-current' : ''}`} />
            <span>{suggestion.upvotes}</span>
          </button>

          {/* Comment Count */}
          <div className="flex items-center space-x-1 text-[#8C8479] font-semibold">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{suggestion.comments?.length || 0}</span>
          </div>

        </div>

      </div>
    </div>
  );
};


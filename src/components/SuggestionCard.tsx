import React from 'react';
import { Suggestion, Status, Category, normalizeCategory, isSecretSuggestion, isPostUnlocked, stripMetadataMarkers } from '../types';
import { maskProfanity } from '../lib/profanityFilter';
import { 
  ThumbsUp, 
  MessageSquare, 
  Lock, 
  CheckCircle2, 
  Clock, 
  FileSearch, 
  AlertCircle, 
  Award,
  Utensils,
  Building2,
  GraduationCap,
  PartyPopper,
  Shirt,
  HelpCircle,
  Trash2,
  UserCheck
} from 'lucide-react';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onSelectCard: (suggestion: Suggestion) => void;
  onUpvote: (id: string, e: React.MouseEvent) => void;
  onTagClick?: (tag: string, e: React.MouseEvent) => void;
  onDeleteSuggestion?: (id: string) => void;
  isUpvoted?: boolean;
  isAdmin?: boolean;
  isMyPost?: boolean;
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
  MEALS: '급식/식당',
  FACILITY: '시설/환경',
  ACADEMICS: '학습/진로',
  STUDENT_COUNCIL: '학생회/행사',
  LIFE_RULES: '교칙/생활',
  OTHER: '기타/자유',
};

export const CATEGORY_ICONS: Record<Category, React.ComponentType<{ className?: string }>> = {
  MEALS: Utensils,
  FACILITY: Building2,
  ACADEMICS: GraduationCap,
  STUDENT_COUNCIL: PartyPopper,
  LIFE_RULES: Shirt,
  OTHER: HelpCircle,
};

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  onSelectCard,
  onUpvote,
  onTagClick,
  onDeleteSuggestion,
  isUpvoted = false,
  isAdmin = false,
  isMyPost = false,
}) => {
  const statusInfo = STATUS_CONFIG[suggestion.status] || STATUS_CONFIG['RECEIVED'];
  const StatusIcon = statusInfo.icon;

  const formattedDate = new Date(suggestion.createdAt).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isSecret = isSecretSuggestion(suggestion);
  const isUnlocked = isPostUnlocked(suggestion.id, isAdmin);

  let rawTags = Array.isArray(suggestion.tags) && suggestion.tags.length > 0
    ? [...suggestion.tags]
    : ['#마산삼진고', '#학생건의'];
  if (isSecret && !rawTags.includes('#비밀글')) {
    rawTags.push('#비밀글');
  }
  const displayTags = isAdmin ? rawTags : rawTags.map((t) => maskProfanity(t));

  const rawTitle = stripMetadataMarkers(suggestion.title) || '제목 없음';
  const cleanTitle = isAdmin ? rawTitle : (maskProfanity(rawTitle) || '제목 없음');

  const strippedContent = stripMetadataMarkers(suggestion.content);
  const rawContent = isAdmin ? strippedContent : maskProfanity(strippedContent);

  const displayContent = (isSecret && !isUnlocked)
    ? '🔒 비밀글입니다. 작성자 본인 및 관리자만 열람할 수 있습니다. (클릭하여 PIN 4자리 입력)'
    : rawContent;

  const rawAuthor = suggestion.authorNickname || '익명의 삼진인';
  const displayAuthor = isAdmin ? rawAuthor : maskProfanity(rawAuthor);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('작성하신 건의글을 정말로 삭제하시겠습니까?')) {
      if (onDeleteSuggestion) {
        onDeleteSuggestion(suggestion.id);
      }
    }
  };

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
            {(() => {
              const normCat = normalizeCategory(suggestion.category);
              const CatIcon = CATEGORY_ICONS[normCat] || CATEGORY_ICONS['OTHER'];
              return (
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-[#F4F1EA] text-[#4A443F] px-2.5 py-1 rounded-xl border border-[#E6E2D3]">
                  <CatIcon className="w-3.5 h-3.5 text-[#5F7161]" />
                  <span>{CATEGORY_LABELS[normCat] || CATEGORY_LABELS['OTHER']}</span>
                </span>
              );
            })()}

            {/* Status Badge */}
            <span
              className={`inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusInfo.badgeClass}`}
            >
              <StatusIcon className="w-3 h-3" />
              <span>{statusInfo.label}</span>
            </span>

            {/* My Post Badge - Only visible to the author */}
            {isMyPost && (
              <span className="inline-flex items-center space-x-1 text-xs bg-emerald-50 text-[#3e5341] px-2.5 py-0.5 rounded-full border border-emerald-300 font-bold shadow-2xs">
                <UserCheck className="w-3 h-3 text-[#5F7161]" />
                <span>내가 쓴 글</span>
              </span>
            )}

            {/* Secret Badge */}
            {isSecret && (
              <span className="inline-flex items-center space-x-1 text-xs bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full border border-rose-300 font-bold shadow-2xs">
                <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>비밀글</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8C8479] whitespace-nowrap">{formattedDate}</span>
            {/* Author-only Delete Button on Card */}
            {(isMyPost || isAdmin) && onDeleteSuggestion && (
              <button
                type="button"
                onClick={handleDeleteClick}
                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="내가 올린 건의글 삭제하기"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-bold text-[#2D2926] text-base sm:text-lg group-hover:text-[#5F7161] transition-colors line-clamp-2 mb-2 leading-snug">
          {cleanTitle}
        </h3>

        {/* Content Excerpt */}
        <p className={`text-xs sm:text-sm line-clamp-2 leading-relaxed mb-4 ${isSecret && !isUnlocked ? 'text-rose-700 font-medium italic' : 'text-[#8C8479]'}`}>
          {displayContent}
        </p>

        {/* Tags */}
        {displayTags && displayTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {displayTags.map((tag, i) => (
              <span
                key={i}
                onClick={(e) => {
                  if (onTagClick) {
                    e.stopPropagation();
                    onTagClick(tag, e);
                  }
                }}
                className={`text-[11px] font-bold text-[#5F7161] bg-[#F4F1EA] px-2.5 py-0.5 rounded-lg border border-[#E6E2D3] transition-colors ${
                  onTagClick ? 'hover:bg-[#5F7161] hover:text-white cursor-pointer' : ''
                }`}
              >
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
                  [{suggestion.officialResponse.department}] {isAdmin ? suggestion.officialResponse.authorName : maskProfanity(suggestion.officialResponse.authorName)}
                </span>
              </div>
              <p className="text-[#8C8479] line-clamp-2 leading-relaxed">
                {isAdmin ? suggestion.officialResponse.content : maskProfanity(suggestion.officialResponse.content)}
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
            {displayAuthor}
          </span>
        </div>

        {/* Upvotes & Comments */}
        <div className="flex items-center space-x-3">
          
          {/* Upvote Button */}
          <button
            id={`btn-upvote-${suggestion.id}`}
            onClick={(e) => onUpvote(suggestion.id, e)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              isUpvoted
                ? 'bg-[#5F7161] text-white shadow-2xs scale-105'
                : 'bg-[#F4F1EA] text-[#4A443F] hover:bg-[#E6E2D3] border border-[#E6E2D3]'
            }`}
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


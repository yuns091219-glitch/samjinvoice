import React, { useState, useEffect } from 'react';
import { Category } from '../types';
import { CATEGORY_LABELS } from './SuggestionCard';
import { getRandomAnonymousNickname } from '../data/initialData';
import { X, MessageSquarePlus, Lock, Tag, Heart, Send, Sparkles, RefreshCw, UserCheck } from 'lucide-react';

interface SuggestionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: {
    category: Category;
    title: string;
    content: string;
    authorNickname: string;
    isSecret: boolean;
    secretPin?: string;
    tags: string[];
  }) => void;
}

export const SuggestionFormModal: React.FC<SuggestionFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const [category, setCategory] = useState<Category>('MEALS');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [authorNickname, setAuthorNickname] = useState(() => getRandomAnonymousNickname());
  const [isSecret, setIsSecret] = useState(false);
  const [secretPin, setSecretPin] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['#마산삼진고', '#학생건의']);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCategory('MEALS');
      setAuthorNickname(getRandomAnonymousNickname());
      setTitle('');
      setContent('');
      setIsSecret(false);
      setSecretPin('');
      setTags(['#마산삼진고', '#학생건의']);
      setTagInput('');
      setErrorMsg('');
    }
  }, [isOpen]);

  const addTagString = (raw: string) => {
    if (!raw) return;
    // Split by commas, spaces, or # if user pastes multiple
    const tokens = raw
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    setTags((prev) => {
      let next = [...prev];
      for (let t of tokens) {
        // Strip duplicate leading hashes and clean
        t = t.replace(/^#+/, '');
        if (!t) continue;
        const formatted = `#${t}`;
        if (!next.includes(formatted)) {
          next.push(formatted);
        }
      }
      return next;
    });
  };

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    addTagString(tagInput);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('제목을 입력해주세요.');
      return;
    }
    if (!content.trim()) {
      setErrorMsg('건의 내용을 구체적으로 작성해주세요.');
      return;
    }
    if (isSecret && (!secretPin || secretPin.trim().length < 4)) {
      setErrorMsg('비밀글 설정 시 4자리 비밀번호(PIN)를 입력해 주세요.');
      return;
    }

    // Auto extract any remaining tag input or hashtags written in content
    let finalTags = [...tags];
    if (tagInput.trim()) {
      const pending = tagInput
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#+/, '').trim())
        .filter(Boolean);
      pending.forEach((p) => {
        const f = `#${p}`;
        if (!finalTags.includes(f)) finalTags.push(f);
      });
    }

    // Also auto-extract any #hashtags written directly in content or title
    const contentHashtags = (content.match(/#[A-Za-z0-9가-힣_]+/g) || []).map((t) => t.trim());
    contentHashtags.forEach((ht) => {
      if (!finalTags.includes(ht)) {
        finalTags.push(ht);
      }
    });

    if (isSecret && !finalTags.includes('#비밀글')) {
      finalTags.push('#비밀글');
    }

    const uniqueFinalTags = Array.from(
      new Set(
        finalTags
          .map((t) => (t.startsWith('#') ? t : `#${t}`))
          .filter((t) => t.length > 1)
      )
    );

    const submittedTags = uniqueFinalTags.length > 0 ? uniqueFinalTags : ['#마산삼진고', '#건의사항'];

    onSubmit({
      category,
      title: title.trim(),
      content: content.trim(),
      authorNickname: authorNickname.trim() || '익명의 삼진인',
      isSecret,
      secretPin: isSecret ? secretPin.trim() : undefined,
      tags: submittedTags,
    });

    // Reset Form
    setTitle('');
    setContent('');
    setIsSecret(false);
    setSecretPin('');
    setTags(['#마산삼진고', '#학생건의']);
    setTagInput('');
    setErrorMsg('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2D2926]/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#E6E2D3] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-[#E6E2D3] flex items-center justify-between bg-[#5F7161] text-white">
          <div className="flex items-center space-x-2">
            <MessageSquarePlus className="w-5 h-5 text-emerald-200" />
            <h2 className="font-bold text-lg">마산삼진고 익명 건의 작성</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Category Selector */}
          <div>
            <label className="block text-xs font-bold text-[#2D2926] mb-2">
              건의 분야 (카테고리) <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`p-3 rounded-2xl text-xs font-bold border transition-all text-left flex items-center justify-between ${
                    category === cat
                      ? 'bg-[#5F7161] text-white border-[#5F7161] shadow-xs'
                      : 'bg-[#F4F1EA]/80 hover:bg-[#F4F1EA] text-[#4A443F] border-[#E6E2D3]'
                  }`}
                >
                  <span>{CATEGORY_LABELS[cat]}</span>
                  {category === cat && <span className="text-white text-xs">✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Anonymous Nickname */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#2D2926] flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-[#5F7161]" />
                <span>부여된 익명 닉네임</span>
              </label>
              <button
                type="button"
                onClick={() => setAuthorNickname(getRandomAnonymousNickname())}
                className="text-[11px] text-[#5F7161] hover:text-[#4D5C4F] font-bold bg-[#5F7161]/10 hover:bg-[#5F7161]/20 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                title="다른 닉네임으로 다시 뽑기"
              >
                <RefreshCw className="w-3 h-3" />
                <span>닉네임 새로고침</span>
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                value={authorNickname}
                readOnly
                tabIndex={-1}
                className="w-full pl-4 pr-12 py-2.5 rounded-2xl border border-[#E6E2D3] text-sm font-bold bg-[#F4F1EA] text-[#2D2926] select-none focus:outline-none"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#5F7161]">
                <Sparkles className="w-4 h-4" />
              </span>
            </div>
            <p className="text-[11px] text-[#8C8479] mt-1 pl-1">
              ※ 건의 목록 및 상세 화면에 위 닉네임으로 고유하게 표시됩니다.
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-[#2D2926] mb-1.5">
              건의 제목 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="구체적이고 정중한 제목을 입력해 주세요 (예: 체육관 에어컨 필터 청소 건의)"
              className="w-full px-4 py-2.5 rounded-2xl border border-[#E6E2D3] text-sm focus:outline-none focus:ring-2 focus:ring-[#5F7161] text-[#2D2926]"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-bold text-[#2D2926] mb-1.5">
              상세 건의 내용 <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="학교 환경, 생활 규칙, 급식, 행사 등 더 나은 삼진고를 위한 건설적인 의견을 자유롭게 적어주세요."
              className="w-full p-4 rounded-2xl border border-[#E6E2D3] text-sm focus:outline-none focus:ring-2 focus:ring-[#5F7161] text-[#2D2926] leading-relaxed"
            />
          </div>

          {/* Tags Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#2D2926]">
                태그 (키워드) <span className="text-[#8C8479] font-normal">(엔터, 스페이스바, 쉼표로 추가)</span>
              </label>
              <span className="text-[11px] text-[#5F7161] font-semibold">
                본문에 #태그 작성 시 자동 추가
              </span>
            </div>

            {/* Tag Input Field */}
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#5F7161]">
                  #
                </span>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    // If user enters comma or newline, auto create tag
                    if (val.includes(',') || val.includes('\n')) {
                      addTagString(val);
                      setTagInput('');
                    } else {
                      setTagInput(val);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === ',' || e.key === 'Tab') {
                      e.preventDefault();
                      handleAddTag();
                    } else if (e.key === 'Enter') {
                      if ((e.nativeEvent as any).isComposing) return;
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  onBlur={() => {
                    if (tagInput.trim()) {
                      handleAddTag();
                    }
                  }}
                  placeholder="태그 입력 후 엔터 (예: 급식, 시설, 야자실, 건의)"
                  className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-[#E6E2D3] text-xs focus:outline-none focus:ring-2 focus:ring-[#5F7161] text-[#2D2926] bg-white font-medium"
                />
              </div>
              <button
                type="button"
                onClick={handleAddTag}
                className="bg-[#5F7161] hover:bg-[#4D5C4F] text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-1 shrink-0"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>추가</span>
              </button>
            </div>

            {/* Quick Recommended Tags */}
            <div className="mb-3 flex items-center flex-wrap gap-1.5">
              <span className="text-[10px] font-bold text-[#8C8479] mr-1">추천 태그:</span>
              {['#급식개선', '#시설보수', '#야간자율학습', '#학습환경', '#학생복지', '#체육관', '#동아리'].map(
                (quickTag) => (
                  <button
                    key={quickTag}
                    type="button"
                    onClick={() => addTagString(quickTag)}
                    className="text-[10px] font-bold bg-[#F4F1EA] hover:bg-[#5F7161] hover:text-white text-[#5F7161] px-2 py-0.5 rounded-lg border border-[#E6E2D3] transition-colors"
                  >
                    + {quickTag}
                  </button>
                )
              )}
            </div>

            {/* Active Added Tags */}
            <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-[#F4F1EA]/50 rounded-xl border border-[#E6E2D3]/60">
              {tags.length === 0 ? (
                <span className="text-[11px] text-[#8C8479] py-0.5">등록된 태그가 없습니다.</span>
              ) : (
                tags.map((t, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#5F7161] bg-white px-2.5 py-1 rounded-lg border border-[#5F7161]/30 shadow-2xs animate-in fade-in"
                  >
                    <Tag className="w-3 h-3 text-[#5F7161]" />
                    {t.startsWith('#') ? t : `#${t}`}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="text-[#8C8479] hover:text-rose-600 hover:bg-rose-50 rounded-full w-4 h-4 inline-flex items-center justify-center font-bold ml-1 transition-colors"
                      title="태그 삭제"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Secret Post Checkbox */}
          <div className="bg-[#F4F1EA] border border-[#E6E2D3] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-xs font-bold text-[#2D2926] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSecret}
                  onChange={(e) => setIsSecret(e.target.checked)}
                  className="w-4 h-4 text-[#5F7161] rounded-md focus:ring-[#5F7161]"
                />
                <span className="flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-rose-600" /> 비밀글로 등록하기 (비밀번호 설정)
                </span>
              </label>
            </div>

            {isSecret ? (
              <div className="pt-2 border-t border-[#E6E2D3] space-y-2">
                <p className="text-[11px] text-rose-700 font-semibold">
                  🔒 비밀글 설정 시 작성 본인 및 관리자만 열람이 가능하며, 4자리 PIN 비밀번호를 함께 설정합니다.
                </p>
                <label className="block text-xs text-[#8C8479] font-semibold mb-1">
                  열람 및 수정/삭제용 4자리 비밀번호 (PIN)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={secretPin}
                  onChange={(e) => setSecretPin(e.target.value)}
                  placeholder="PIN 4자리"
                  className="w-32 px-3 py-1.5 rounded-xl border border-[#E6E2D3] font-bold text-center tracking-widest text-sm focus:outline-none focus:ring-2 focus:ring-[#5F7161] bg-white text-[#2D2926]"
                />
              </div>
            ) : (
              <p className="text-[11px] text-[#5F7161] font-semibold pt-1 border-t border-[#E6E2D3]">
                🌐 비밀번호 없이 건의하시면 작성 직후 메인 건의 목록 최상단에 공개글로 등록되어 모든 학우가 함께 볼 수 있습니다.
              </p>
            )}
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-600 font-bold bg-rose-50 p-3 rounded-xl border border-rose-200">
              ⚠️ {errorMsg}
            </p>
          )}

          {/* Cultural respect note */}
          <div className="text-[11px] text-[#5F7161] bg-[#F4F1EA] p-3 rounded-2xl border border-[#E6E2D3] flex items-center space-x-2 font-medium">
            <Heart className="w-4 h-4 text-[#5F7161] shrink-0" />
            <span>비속어 없는 정중하고 구체적인 언어 표현은 건의 수용률을 높입니다.</span>
          </div>

          {/* Submit */}
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl border border-[#E6E2D3] text-xs font-bold text-[#8C8479] hover:bg-[#F4F1EA]"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-2xl bg-[#5F7161] hover:bg-[#4D5C4F] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              <span>건의 등록하기</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};


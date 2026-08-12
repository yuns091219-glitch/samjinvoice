import React, { useState, useEffect } from 'react';
import { Category } from '../types';
import { CATEGORY_LABELS } from './SuggestionCard';
import { getRandomAnonymousNickname } from '../data/initialData';
import { X, MessageSquarePlus, Lock, Tag, Heart, Send } from 'lucide-react';

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
      setAuthorNickname(getRandomAnonymousNickname());
      setTitle('');
      setContent('');
      setIsSecret(false);
      setSecretPin('');
      setErrorMsg('');
    }
  }, [isOpen]);

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    const cleanTag = tagInput.trim().startsWith('#') ? tagInput.trim() : `#${tagInput.trim()}`;
    if (!tags.includes(cleanTag)) {
      setTags([...tags, cleanTag]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
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

    onSubmit({
      category,
      title: title.trim(),
      content: content.trim(),
      authorNickname: authorNickname.trim() || '익명의 삼진인',
      isSecret,
      secretPin: isSecret ? secretPin.trim() : undefined,
      tags,
    });

    // Reset Form
    setTitle('');
    setContent('');
    setIsSecret(false);
    setSecretPin('');
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
              <label className="text-xs font-bold text-[#2D2926]">익명 닉네임</label>
              <span className="text-[11px] text-[#5F7161] font-bold bg-[#5F7161]/10 px-2 py-0.5 rounded-md">
                자동 부여 (수정 불가)
              </span>
            </div>
            <input
              type="text"
              value={authorNickname}
              readOnly
              tabIndex={-1}
              className="w-full px-4 py-2.5 rounded-2xl border border-[#E6E2D3] text-sm font-bold bg-[#EFECE6] text-[#2D2926] cursor-not-allowed select-none focus:outline-none"
            />
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
            <label className="block text-xs font-bold text-[#2D2926] mb-1.5">
              태그 추가 (#버튼 클릭 또는 엔터)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="예: 급식개선, 야자실환경"
                className="flex-1 px-3 py-2 rounded-xl border border-[#E6E2D3] text-xs focus:outline-none focus:ring-2 focus:ring-[#5F7161] text-[#2D2926]"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="bg-[#2D2926] text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-[#4A443F]"
              >
                태그 추가
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {tags.map((t, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#5F7161] bg-[#F4F1EA] px-3 py-1 rounded-xl border border-[#E6E2D3]"
                >
                  <Tag className="w-3 h-3" />
                  {t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="text-[#8C8479] hover:text-[#2D2926] font-bold ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
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
                  🔒 비밀글 설정 시 본인만 알 수 있는 4자리 PIN 비밀번호를 설정합니다.
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


import React, { useState, useEffect } from 'react';
import { Suggestion, Status, Comment, isSecretSuggestion, isPostUnlocked, markPostAsUnlocked, stripMetadataMarkers, deduplicateComments } from '../types';
import { STATUS_CONFIG, CATEGORY_LABELS } from './SuggestionCard';
import { getRandomAnonymousNickname } from '../data/initialData';
import { verifySuggestionPin } from '../lib/supabase';
import { X, ThumbsUp, MessageSquare, Lock, Send, ShieldCheck, CheckCircle2, AlertCircle, Trash2, KeyRound, Bot } from 'lucide-react';

interface SuggestionDetailModalProps {
  suggestion: Suggestion | null;
  isOpen: boolean;
  onClose: () => void;
  onUpvote: (id: string) => void;
  onAddComment: (suggestionId: string, nickname: string, content: string, isOfficial?: boolean) => void;
  onDeleteComment?: (suggestionId: string, commentId: string) => void;
  onUpdateStatus: (id: string, status: Status, responseContent?: string) => void;
  onDeleteSuggestion: (id: string, pin?: string) => void;
  isAdmin: boolean;
  adminPin: string;
  isUpvoted?: boolean;
}

export const SuggestionDetailModal: React.FC<SuggestionDetailModalProps> = ({
  suggestion,
  isOpen,
  onClose,
  onUpvote,
  onAddComment,
  onDeleteComment,
  onUpdateStatus,
  onDeleteSuggestion,
  isAdmin,
  adminPin,
  isUpvoted = false,
}) => {
  if (!isOpen || !suggestion) return null;

  // Local state
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(!suggestion.isSecret || isAdmin);
  const [unlockedSuggestion, setUnlockedSuggestion] = useState<Suggestion | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [commentNickname, setCommentNickname] = useState(() => getRandomAnonymousNickname());
  const [commentContent, setCommentContent] = useState('');

  // Admin response state
  const [newStatus, setNewStatus] = useState<Status>(suggestion.status);
  const [responseDepartment, setResponseDepartment] = useState('제53대 삼진고 학생회');
  const [responseAuthor, setResponseAuthor] = useState('학생회장 김삼진');
  const [responseContent, setResponseContent] = useState(suggestion.officialResponse?.content || '');

  // AI draft state
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<any>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const activeSuggestion = unlockedSuggestion || suggestion;

  useEffect(() => {
    setPinInput('');
    setPinError('');

    if (!suggestion) return;

    const isSecretPost = isSecretSuggestion(suggestion);
    const unlocked = isPostUnlocked(suggestion.id, isAdmin);

    if (isAdmin) {
      setIsUnlocked(true);
      setUnlockedSuggestion(suggestion);
      fetch(`/api/suggestions/${suggestion.id}?isAdmin=true&adminPin=${adminPin}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) {
            setUnlockedSuggestion(data);
          }
        })
        .catch(() => {});
    } else if (isSecretPost) {
      if (unlocked) {
        setIsUnlocked(true);
        setUnlockedSuggestion(suggestion);
      } else {
        setIsUnlocked(false);
        setUnlockedSuggestion(null);
      }
    } else {
      // Regular public post
      setIsUnlocked(true);
      setUnlockedSuggestion(suggestion);
    }
  }, [suggestion?.id, isOpen, isAdmin, adminPin]);

  // Sync unlockedSuggestion when suggestion prop updates (e.g. new comments, upvotes, status)
  useEffect(() => {
    if (!suggestion) return;
    if (unlockedSuggestion && String(unlockedSuggestion.id) === String(suggestion.id)) {
      setUnlockedSuggestion((prev) => {
        if (!prev) return suggestion;
        return {
          ...prev,
          comments: deduplicateComments(suggestion.comments || prev.comments || []),
          upvotes: suggestion.upvotes,
          status: suggestion.status,
          officialResponse: suggestion.officialResponse,
          tags: suggestion.tags || prev.tags,
        };
      });
    }
  }, [suggestion]);

  const handleVerifyPin = async () => {
    const typedPin = pinInput.trim();
    if (!typedPin) {
      setPinError('비밀번호 4자리를 입력해 주세요.');
      return;
    }
    setPinError('');
    setIsVerifying(true);

    let verified = false;
    let unmaskedData: Suggestion | null = null;

    // 1. Direct local verify check (Works offline, Netlify static, and all browsers)
    if (verifySuggestionPin(suggestion, typedPin, adminPin)) {
      verified = true;
      unmaskedData = suggestion;
    }

    // 2. Try server API verify-pin if local check didn't immediately match
    if (!verified) {
      try {
        const res = await fetch(`/api/suggestions/${suggestion.id}/verify-pin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: typedPin }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.verified && data.suggestion) {
            verified = true;
            unmaskedData = data.suggestion;
          }
        }
      } catch (err) {
        console.warn('Verify PIN API error:', err);
      }
    }

    if (verified) {
      markPostAsUnlocked(suggestion.id);
      setIsUnlocked(true);
      setPinError('');
      setUnlockedSuggestion(unmaskedData || suggestion);
    } else {
      setPinError('비밀번호(PIN 4자리)가 일치하지 않습니다.');
    }
    setIsVerifying(false);
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim() || isSubmittingComment) return;
    const contentToSubmit = commentContent.trim();
    const nickToSubmit = commentNickname;

    setIsSubmittingComment(true);
    setCommentContent('');
    setCommentNickname(getRandomAnonymousNickname());

    try {
      await onAddComment(activeSuggestion.id, nickToSubmit, contentToSubmit, isAdmin);
    } finally {
      setTimeout(() => {
        setIsSubmittingComment(false);
      }, 500);
    }
  };

  const handleAdminStatusSave = () => {
    onUpdateStatus(activeSuggestion.id, newStatus, responseContent);
  };

  const handleGenerateAiResponse = async () => {
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeSuggestion.title,
          content: activeSuggestion.content,
          category: activeSuggestion.category,
        }),
      });
      const data = await res.json();
      setAiDraft(data);
      if (data.draftResponse) {
        setResponseContent(data.draftResponse);
      }
      if (data.suggestedStatus) {
        setNewStatus(data.suggestedStatus);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleDelete = () => {
    if (confirm('정말로 이 건의사항을 삭제하시겠습니까?')) {
      onDeleteSuggestion(activeSuggestion.id, pinInput || adminPin);
      onClose();
    }
  };

  const statusInfo = STATUS_CONFIG[activeSuggestion.status];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-x-hidden">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2.5 sm:px-3 py-1 rounded-lg">
              {CATEGORY_LABELS[activeSuggestion.category]}
            </span>
            <span className={`text-xs font-semibold px-2.5 sm:px-3 py-1 rounded-full border ${statusInfo.badgeClass}`}>
              {statusInfo.label}
            </span>
            {activeSuggestion.isSecret && (
              <span className="text-xs font-semibold bg-rose-100 text-rose-800 px-2 sm:px-2.5 py-1 rounded-lg flex items-center gap-1">
                <Lock className="w-3 h-3" /> 비밀글
              </span>
            )}
          </div>

          <button
            id="btn-close-modal"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto overflow-x-hidden space-y-6 flex-1 max-w-full">
          
          {/* Secret Post Password Verification Box */}
          {(isSecretSuggestion(activeSuggestion) || isSecretSuggestion(suggestion)) && !isUnlocked ? (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-8 text-center space-y-4 max-w-full overflow-hidden">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
                <KeyRound className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base sm:text-lg">비밀 건의글입니다</h3>
                <p className="text-slate-600 text-xs mt-1">
                  작성 시 설정한 4자리 비밀번호(PIN)를 입력하세요.
                </p>
              </div>

              <div className="max-w-xs sm:max-w-sm mx-auto flex flex-row items-stretch justify-center gap-2 w-full">
                <input
                  id="input-secret-pin"
                  type="password"
                  maxLength={10}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleVerifyPin();
                    }
                  }}
                  placeholder="PIN 4자리"
                  className="w-full min-w-0 px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl border-2 border-rose-300 text-center font-bold text-base sm:text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white text-slate-900 shadow-xs"
                />
                <button
                  id="btn-verify-pin"
                  onClick={handleVerifyPin}
                  disabled={isVerifying}
                  className="bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-bold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm transition-all shadow-xs disabled:opacity-50 shrink-0 whitespace-nowrap inline-flex items-center justify-center min-w-[60px] sm:min-w-[72px]"
                >
                  {isVerifying ? '확인 중...' : '확인'}
                </button>
              </div>

              {pinError && <p className="text-xs text-rose-600 font-bold">{pinError}</p>}
            </div>
          ) : (
            <>
              {/* Proposal Header Title & Meta */}
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug mb-3">
                  {stripMetadataMarkers(activeSuggestion.title) || '제목 없음'}
                </h2>

                <div className="flex items-center justify-between text-xs text-slate-500 pb-4 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md">
                      {activeSuggestion.authorNickname}
                    </span>
                    <span>•</span>
                    <span>{new Date(activeSuggestion.createdAt).toLocaleString('ko-KR')}</span>
                  </div>

                  <button
                    id="btn-detail-upvote"
                    onClick={() => onUpvote(activeSuggestion.id)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-bold transition-all border ${
                      isUpvoted
                        ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-xs'
                        : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                    }`}
                    title={isUpvoted ? '공감 취소' : '이 건의에 공감합니다'}
                  >
                    <ThumbsUp className={`w-4 h-4 ${isUpvoted ? 'fill-current' : ''}`} />
                    <span>공감 {activeSuggestion.upvotes}</span>
                  </button>
                </div>
              </div>

              {/* Suggestion Body Content */}
              <div className="text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-wrap bg-slate-50/60 p-5 rounded-2xl border border-slate-200/70">
                {stripMetadataMarkers(activeSuggestion.content)}
              </div>

              {/* Tags */}
              {activeSuggestion.tags && activeSuggestion.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activeSuggestion.tags.map((tag, idx) => (
                    <span key={idx} className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              )}

              {/* Official Response Section (If Published) */}
              {activeSuggestion.officialResponse && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300/80 rounded-2xl p-5 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        공식
                      </div>
                      <div>
                        <h4 className="font-bold text-emerald-950 text-sm">
                          [{activeSuggestion.officialResponse.department}] {activeSuggestion.officialResponse.authorName}
                        </h4>
                        <span className="text-[11px] text-emerald-700">
                          답변 일자: {new Date(activeSuggestion.officialResponse.updatedAt).toLocaleString('ko-KR')}
                        </span>
                      </div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>

                  <p className="text-emerald-900 text-sm leading-relaxed pt-2 border-t border-emerald-200/60 whitespace-pre-wrap">
                    {activeSuggestion.officialResponse.content}
                  </p>
                </div>
              )}

              {/* Admin / Student Council Management Box */}
              {isAdmin && (
                <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-4 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="w-5 h-5 text-amber-400" />
                      <h3 className="font-bold text-sm text-amber-300">학생회/교사 관리자 답변 작성 및 상태 변경</h3>
                    </div>

                    <button
                      id="btn-gemini-ai-draft"
                      onClick={handleGenerateAiResponse}
                      disabled={isAiLoading}
                      className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                    >
                      <Bot className="w-4 h-4 text-indigo-200" />
                      <span>{isAiLoading ? 'AI 분석 중...' : 'Gemini AI 답변 초안 생성'}</span>
                    </button>
                  </div>

                  {/* Status Radio / Select */}
                  <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">상태 변경:</span>
                    {(['RECEIVED', 'IN_REVIEW', 'ANSWERED', 'APPLIED', 'ON_HOLD'] as Status[]).map((st) => (
                      <button
                        key={st}
                        onClick={() => setNewStatus(st)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition-all whitespace-nowrap ${
                          newStatus === st
                            ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        {STATUS_CONFIG[st].label}
                      </button>
                    ))}
                  </div>

                  {/* Official Response Textarea */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={responseDepartment}
                        onChange={(e) => setResponseDepartment(e.target.value)}
                        placeholder="소속 (예: 제53대 삼진고 학생회)"
                        className="bg-slate-800 border border-slate-700 text-xs text-white p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      <input
                        type="text"
                        value={responseAuthor}
                        onChange={(e) => setResponseAuthor(e.target.value)}
                        placeholder="작성자 (예: 학생회장 김삼진)"
                        className="bg-slate-800 border border-slate-700 text-xs text-white p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                    <textarea
                      rows={3}
                      value={responseContent}
                      onChange={(e) => setResponseContent(e.target.value)}
                      placeholder="학우들에게 전달할 공식 답변 내용을 입력하세요..."
                      className="w-full bg-slate-800 border border-slate-700 text-sm text-white p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={handleDelete}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> 건의글 삭제
                    </button>

                    <button
                      id="btn-save-admin-response"
                      onClick={handleAdminStatusSave}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md"
                    >
                      답변 저장 및 상태 반영
                    </button>
                  </div>
                </div>
              )}

              {/* Anonymous Comments Section */}
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    익명 댓글 ({activeSuggestion.comments?.length || 0})
                  </h3>
                </div>

                {/* Comment Input */}
                <form onSubmit={handleCommentSubmit} className="space-y-2">
                  <div className="flex gap-2">
                    <div className="w-1/3 min-w-[120px]">
                      <input
                        type="text"
                        value={commentNickname}
                        readOnly
                        tabIndex={-1}
                        title="자동 부여된 익명 닉네임 (수정 불가)"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-100 text-slate-600 font-bold cursor-not-allowed select-none focus:outline-none"
                      />
                    </div>
                    <input
                      type="text"
                      value={commentContent}
                      onChange={(e) => setCommentContent(e.target.value)}
                      placeholder="따뜻한 응원이나 의견 댓글을 남겨주세요..."
                      className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shrink-0 flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" /> 등록
                    </button>
                  </div>
                </form>

                {/* Comment List */}
                <div className="space-y-2.5">
                  {activeSuggestion.comments?.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">첫 번째 익명 댓글을 작성해 보세요!</p>
                  ) : (
                    activeSuggestion.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className={`p-3 rounded-xl border text-xs leading-relaxed ${
                          comment.isOfficial
                            ? 'bg-blue-50/80 border-blue-200 text-blue-950 font-medium'
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold flex items-center gap-1">
                            {comment.isOfficial && (
                              <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-md">
                                {comment.officialRole || '학생회'}
                              </span>
                            )}
                            {comment.authorNickname}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">
                              {new Date(comment.createdAt).toLocaleDateString('ko-KR', {
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {isAdmin && onDeleteComment && (
                              <button
                                type="button"
                                onClick={() => onDeleteComment(activeSuggestion.id, comment.id)}
                                className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 rounded-sm"
                                title="관리자 권한으로 댓글 삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
};

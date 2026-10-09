import React, { useState } from 'react';
import { Suggestion, AdminStats, Status, normalizeCategory, stripMetadataMarkers } from '../types';
import { CATEGORY_LABELS, CATEGORY_ICONS } from './SuggestionCard';
import { ShieldCheck, Award, CheckCircle2, Clock, FileSearch, AlertCircle, X, BarChart3, TrendingUp, KeyRound, Trash2 } from 'lucide-react';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: Suggestion[];
  stats: AdminStats;
  isAdmin: boolean;
  onLoginAdmin: (pin: string) => Promise<boolean> | boolean;
  onLogoutAdmin: () => void;
  onSelectSuggestion: (suggestion: Suggestion) => void;
  onApproveSuggestion?: (id: string) => void;
  onDeleteSuggestion?: (id: string) => void;
  adminToken?: string | null;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isOpen,
  onClose,
  suggestions,
  stats,
  isAdmin,
  onLoginAdmin,
  onLogoutAdmin,
  onSelectSuggestion,
  onApproveSuggestion,
  onDeleteSuggestion,
  adminToken,
}) => {
  if (!isOpen) return null;

  const [inputPin, setInputPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Change PIN modal state
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [changePinMsg, setChangePinMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [isChangingPin, setIsChangingPin] = useState(false);

  const [dashboardTab, setDashboardTab] = useState<'pending' | 'all'>(() => {
    const hasPending = suggestions.some((s) => s.status === 'PENDING_APPROVAL' || s.isApproved === false);
    return hasPending ? 'pending' : 'pending';
  });

  const pendingSuggestions = suggestions.filter(
    (s) => s.status === 'PENDING_APPROVAL' || s.isApproved === false
  );

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPin.trim()) return;
    setIsLoggingIn(true);
    setErrorMsg('');
    try {
      const success = await onLoginAdmin(inputPin.trim());
      if (!success) {
        setErrorMsg('관리자 비밀번호가 올바르지 않습니다.');
      } else {
        setErrorMsg('');
        setInputPin('');
      }
    } catch {
      setErrorMsg('로그인 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNewPin = newPinInput.trim();
    if (cleanNewPin.length < 4) {
      setChangePinMsg({ text: '새 비밀번호는 4자 이상 입력해 주세요.', isError: true });
      return;
    }
    setIsChangingPin(true);
    setChangePinMsg(null);
    try {
      const res = await fetch('/api/admin/change-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken || ''}`,
          'x-admin-token': adminToken || '',
        },
        body: JSON.stringify({ newPin: cleanNewPin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChangePinMsg({ text: '✅ 새 비밀번호로 안전하게 변경되었습니다.', isError: false });
        setTimeout(() => {
          setIsChangePinOpen(false);
          setNewPinInput('');
          setChangePinMsg(null);
        }, 1500);
      } else {
        setChangePinMsg({ text: data.error || '비밀번호 변경에 실패했습니다.', isError: true });
      }
    } catch {
      setChangePinMsg({ text: '네트워크 통신 오류가 발생했습니다.', isError: true });
    } finally {
      setIsChangingPin(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">제53대 삼진고 학생회 대시보드</h2>
              <p className="text-xs text-slate-400">익명 건의 심사/승인 관리 및 공개 게시판 운영</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isAdmin && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsChangePinOpen(!isChangePinOpen)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 font-medium px-3 py-1.5 rounded-xl border border-slate-700 flex items-center space-x-1.5 transition-colors"
                  title="관리자 비밀번호 변경"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>비밀번호 변경</span>
                </button>
                <button
                  onClick={onLogoutAdmin}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-3 py-1.5 rounded-xl border border-slate-700"
                >
                  로그아웃
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Change PIN Dropdown Banner (When toggled by admin) */}
        {isAdmin && isChangePinOpen && (
          <div className="bg-amber-50 border-b border-amber-200 p-4 animate-in slide-in-from-top-2">
            <form onSubmit={handleChangePinSubmit} className="max-w-md mx-auto flex flex-col sm:flex-row items-center gap-2">
              <div className="w-full flex-1">
                <label className="block text-xs font-bold text-amber-900 mb-1">
                  새 관리자 비밀번호 (학생들에게 절대 노출되지 않음)
                </label>
                <input
                  type="password"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder="새 비밀번호 입력 (4자 이상)"
                  disabled={isChangingPin}
                  className="w-full px-3 py-1.5 text-xs bg-white rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                />
              </div>
              <div className="flex items-center space-x-2 self-end mt-2 sm:mt-0">
                <button
                  type="submit"
                  disabled={isChangingPin}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-2 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  {isChangingPin ? '변경 중...' : '비밀번호 저장'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsChangePinOpen(false);
                    setChangePinMsg(null);
                  }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs px-2.5 py-2 rounded-lg transition-colors"
                >
                  취소
                </button>
              </div>
            </form>
            {changePinMsg && (
              <p className={`text-center text-xs mt-2 font-medium ${changePinMsg.isError ? 'text-rose-600' : 'text-emerald-700'}`}>
                {changePinMsg.text}
              </p>
            )}
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
          
          {/* If NOT logged in as admin */}
          {!isAdmin ? (
            <div className="max-w-md mx-auto my-8 bg-white p-8 rounded-3xl border border-slate-200 shadow-md text-center space-y-4">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl mx-auto flex items-center justify-center">
                <KeyRound className="w-6 h-6" />
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-lg">학생회 / 교사 인증</h3>
                <p className="text-xs text-slate-500 mt-1">
                  승인 대기 건의글 검토(통과) 및 공식 답변 작성을 위해 관리자 PIN을 입력하세요.
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-3">
                <input
                  type="password"
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value)}
                  placeholder="관리자 비밀번호 입력"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-center font-bold text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
                />

                {errorMsg && <p className="text-xs text-rose-600 font-medium">{errorMsg}</p>}

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-60"
                >
                  {isLoggingIn ? '인증 확인 중...' : '대시보드 로그인'}
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Top Stats Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 sm:gap-3">
                
                {/* 1. 승인 대기 카드 (가장 중요) */}
                <div
                  onClick={() => setDashboardTab('pending')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                    dashboardTab === 'pending'
                      ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400'
                      : 'bg-white border-amber-300 hover:border-amber-400 text-slate-900 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={`font-bold flex items-center gap-1 ${dashboardTab === 'pending' ? 'text-amber-100' : 'text-amber-700'}`}>
                      <Clock className="w-3.5 h-3.5" />
                      승인 대기
                    </span>
                    {pendingSuggestions.length > 0 && (
                      <span className={`w-2 h-2 rounded-full ${dashboardTab === 'pending' ? 'bg-white animate-ping' : 'bg-amber-500 animate-ping'}`} />
                    )}
                  </div>
                  <div className={`text-2xl font-black ${dashboardTab === 'pending' ? 'text-white' : 'text-amber-600'}`}>
                    {pendingSuggestions.length}
                  </div>
                  <div className={`text-[10px] mt-1 font-semibold ${dashboardTab === 'pending' ? 'text-amber-100' : 'text-amber-800'}`}>
                    검토/통과 필요
                  </div>
                </div>

                <div
                  onClick={() => setDashboardTab('all')}
                  className={`bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs cursor-pointer hover:border-slate-300 transition-all ${
                    dashboardTab === 'all' ? 'ring-2 ring-slate-800' : ''
                  }`}
                >
                  <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                    <span className="font-semibold flex items-center gap-1">
                      <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                      전체 건의
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900">{stats.totalSuggestions}</div>
                  <div className="text-[10px] text-slate-400 mt-1">총 누적 건수</div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-2xs">
                  <div className="flex items-center justify-between text-emerald-700 text-xs mb-1">
                    <span className="font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      접수 완료
                    </span>
                  </div>
                  <div className="text-2xl font-black text-emerald-900">{stats.receivedCount}</div>
                  <div className="text-[10px] text-emerald-600 mt-1">공개 접수됨</div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-sky-200 shadow-2xs">
                  <div className="flex items-center justify-between text-sky-700 text-xs mb-1">
                    <span className="font-semibold flex items-center gap-1">
                      <FileSearch className="w-3.5 h-3.5 text-sky-500" />
                      검토 중
                    </span>
                  </div>
                  <div className="text-2xl font-black text-sky-900">{stats.inReviewCount}</div>
                  <div className="text-[10px] text-sky-600 mt-1">담당 협의 진행</div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-indigo-200 shadow-2xs">
                  <div className="flex items-center justify-between text-indigo-700 text-xs mb-1">
                    <span className="font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                      답변 완료
                    </span>
                  </div>
                  <div className="text-2xl font-black text-indigo-900">{stats.answeredCount}</div>
                  <div className="text-[10px] text-indigo-600 mt-1">공식 답변 등록</div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-purple-200 shadow-2xs">
                  <div className="flex items-center justify-between text-purple-700 text-xs mb-1">
                    <span className="font-semibold flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-purple-500" />
                      반영 완료
                    </span>
                  </div>
                  <div className="text-2xl font-black text-purple-900">{stats.appliedCount}</div>
                  <div className="text-[10px] text-purple-600 mt-1">학교 개선 반영</div>
                </div>

              </div>

              {/* Tab Navigation */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  onClick={() => setDashboardTab('pending')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    dashboardTab === 'pending'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>승인 대기 건의함</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    dashboardTab === 'pending' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {pendingSuggestions.length}
                  </span>
                </button>

                <button
                  onClick={() => setDashboardTab('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    dashboardTab === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>전체 건의사항 목록</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    dashboardTab === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {suggestions.length}
                  </span>
                </button>
              </div>

              {/* TAB 1: PENDING APPROVAL QUEUE */}
              {dashboardTab === 'pending' && (
                <div className="bg-white rounded-2xl p-5 border border-amber-200 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        승인 대기 건의함 (검토 후 통과시키기)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        학생들이 등록한 건의글은 이곳에서 관리자가 <strong>'통과'</strong>를 누를 때까지 일반 학우들에게 공개되지 않습니다.
                      </p>
                    </div>
                  </div>

                  {pendingSuggestions.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-slate-900 text-sm">현재 대기 중인 건의가 없습니다!</p>
                      <p className="text-xs text-slate-500">
                        모든 학생 건의사항이 검토 및 통과되어 공개 게시판에 정상 등록되었습니다.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingSuggestions.map((s) => {
                        const normCat = normalizeCategory(s.category);
                        const CatIcon = CATEGORY_ICONS[normCat] || CATEGORY_ICONS['OTHER'];
                        const rawTitle = stripMetadataMarkers(s.title) || '제목 없음';
                        const rawContent = stripMetadataMarkers(s.content);

                        return (
                          <div
                            key={s.id}
                            className="p-4 rounded-2xl border border-amber-200/80 bg-amber-50/30 hover:bg-amber-50/60 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                                  <CatIcon className="w-3 h-3 text-[#5F7161]" />
                                  <span>{CATEGORY_LABELS[normCat] || s.category}</span>
                                </span>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                                  ⏳ 승인 대기중
                                </span>
                                {s.isSecret && (
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 border border-rose-300">
                                    🔒 비밀글
                                  </span>
                                )}
                                <span className="text-xs text-slate-400">
                                  {new Date(s.createdAt).toLocaleString('ko-KR')}
                                </span>
                              </div>

                              <h4
                                onClick={() => onSelectSuggestion(s)}
                                className="font-bold text-slate-900 text-base hover:text-[#5F7161] cursor-pointer transition-colors"
                              >
                                {rawTitle}
                              </h4>

                              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                {rawContent}
                              </p>

                              <div className="text-[11px] text-slate-500 font-medium">
                                작성자: <strong>{s.authorNickname || '익명의 삼진인'}</strong>
                              </div>
                            </div>

                            {/* Action Buttons for Pending item */}
                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              <button
                                onClick={() => onSelectSuggestion(s)}
                                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-colors shadow-2xs"
                              >
                                상세 확인
                              </button>

                              {onDeleteSuggestion && (
                                <button
                                  onClick={() => {
                                    onDeleteSuggestion(s.id);
                                  }}
                                  className="px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors shadow-2xs"
                                >
                                  반려/삭제
                                </button>
                              )}

                              {onApproveSuggestion && (
                                <button
                                  onClick={() => onApproveSuggestion(s.id)}
                                  className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
                                  title="이 건의글을 승인하여 모든 학우가 볼 수 있는 게시판에 등록합니다"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>✨ 통과 (게시판 공개)</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: ALL SUGGESTIONS TABLE */}
              {dashboardTab === 'all' && (
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-bold text-slate-900 text-base">전체 건의사항 현황 및 바로가기</h3>
                    <span className="text-xs text-slate-500">클릭 시 상세 모달이 열립니다</span>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {suggestions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => onSelectSuggestion(s)}
                        className="py-3 px-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2 mb-0.5">
                            {(() => {
                              const normCat = normalizeCategory(s.category);
                              const CatIcon = CATEGORY_ICONS[normCat] || CATEGORY_ICONS['OTHER'];
                              return (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                  <CatIcon className="w-2.5 h-2.5 text-[#5F7161]" />
                                  <span>{CATEGORY_LABELS[normCat] || s.category}</span>
                                </span>
                              );
                            })()}
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {stripMetadataMarkers(s.title) || '제목 없음'}
                            </span>
                            {(s.status === 'PENDING_APPROVAL' || s.isApproved === false) && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded">
                                심사대기
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 truncate">
                            {s.authorNickname || '익명의 삼진인'} • 👍 {s.upvotes ?? 0} • 👎 {s.downvotes ?? 0} • {new Date(s.createdAt).toLocaleDateString('ko-KR')}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {(s.status === 'PENDING_APPROVAL' || s.isApproved === false) && onApproveSuggestion && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onApproveSuggestion(s.id);
                              }}
                              className="text-[11px] font-extrabold px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs"
                            >
                              통과(승인)
                            </button>
                          )}

                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap border ${
                              s.status === 'PENDING_APPROVAL' || s.isApproved === false
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : s.status === 'RECEIVED'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : s.status === 'IN_REVIEW'
                                ? 'bg-sky-100 text-sky-800 border-sky-300'
                                : s.status === 'ANSWERED'
                                ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                                : s.status === 'APPLIED'
                                ? 'bg-purple-100 text-purple-900 border-purple-300'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            {s.status === 'PENDING_APPROVAL' || s.isApproved === false
                              ? '승인대기'
                              : s.status === 'RECEIVED'
                              ? '접수됨'
                              : s.status === 'IN_REVIEW'
                              ? '검토중'
                              : s.status === 'ANSWERED'
                              ? '답변완료'
                              : s.status === 'APPLIED'
                              ? '반영완료'
                              : '보류'}
                          </span>

                          {onDeleteSuggestion && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSuggestion(s.id);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="이 건의글 삭제하기"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </>
          )}

        </div>

      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Suggestion, AdminStats, Status, normalizeCategory } from '../types';
import { CATEGORY_LABELS } from './SuggestionCard';
import { ShieldCheck, Award, CheckCircle2, Clock, FileSearch, AlertCircle, X, BarChart3, TrendingUp, KeyRound } from 'lucide-react';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: Suggestion[];
  stats: AdminStats;
  isAdmin: boolean;
  onLoginAdmin: (pin: string) => boolean;
  onLogoutAdmin: () => void;
  onSelectSuggestion: (suggestion: Suggestion) => void;
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
}) => {
  if (!isOpen) return null;

  const [inputPin, setInputPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = onLoginAdmin(inputPin);
    if (!success) {
      setErrorMsg('관리자 비밀번호가 올바르지 않습니다.');
    } else {
      setErrorMsg('');
      setInputPin('');
    }
  };

  // Applied improvements list - removed as requested

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
              <h2 className="font-bold text-lg text-white">제53대 삼진고 학생회 & 학교 행정실 대시보드</h2>
              <p className="text-xs text-slate-400">익명 건의 처리 현황 및 공약/개선 반영 타임라인</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isAdmin && (
              <button
                onClick={onLogoutAdmin}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-3 py-1.5 rounded-xl border border-slate-700"
              >
                로그아웃
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

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
                  건의글 상태 변경 및 공식 답변 작성을 위해 관리자 PIN을 입력하세요.
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
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-sm transition-all"
                >
                  대시보드 로그인
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Top Stats Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                    <span>전체 건의</span>
                    <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">{stats.totalSuggestions}</div>
                  <div className="text-[10px] text-slate-400 mt-1">학생들 소통 건수</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs">
                  <div className="flex items-center justify-between text-amber-700 text-xs mb-1">
                    <span>🟡 접수됨</span>
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <div className="text-2xl font-black text-amber-900">{stats.receivedCount}</div>
                  <div className="text-[10px] text-amber-600 mt-1">검토 대기중</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-sky-200 shadow-2xs">
                  <div className="flex items-center justify-between text-sky-700 text-xs mb-1">
                    <span>🔵 검토 중</span>
                    <FileSearch className="w-3.5 h-3.5 text-sky-500" />
                  </div>
                  <div className="text-2xl font-black text-sky-900">{stats.inReviewCount}</div>
                  <div className="text-[10px] text-sky-600 mt-1">부서 협의 진행</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs">
                  <div className="flex items-center justify-between text-emerald-700 text-xs mb-1">
                    <span>🟢 답변 완료</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-black text-emerald-900">{stats.answeredCount}</div>
                  <div className="text-[10px] text-emerald-600 mt-1">학생회/학교 답변</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-2xs col-span-2 sm:col-span-1">
                  <div className="flex items-center justify-between text-purple-700 text-xs mb-1">
                    <span>🟣 반영 완료!</span>
                    <Award className="w-3.5 h-3.5 text-purple-500" />
                  </div>
                  <div className="text-2xl font-black text-purple-900">{stats.appliedCount}</div>
                  <div className="text-[10px] text-purple-600 mt-1">실제 학교 개선됨</div>
                </div>

              </div>


              {/* All Suggestions Table for Quick Status Toggle */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                <h3 className="font-bold text-slate-900 text-base">전체 건의사항 현황 및 바로가기</h3>

                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {suggestions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => onSelectSuggestion(s)}
                      className="py-3 px-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 mb-0.5">
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            {CATEGORY_LABELS[normalizeCategory(s.category)] || s.category}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">{s.title}</span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{s.authorNickname} • 공감 {s.upvotes}개</p>
                      </div>

                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap border ${
                          s.status === 'RECEIVED'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : s.status === 'IN_REVIEW'
                            ? 'bg-sky-100 text-sky-800 border-sky-300'
                            : s.status === 'ANSWERED'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : s.status === 'APPLIED'
                            ? 'bg-purple-100 text-purple-900 border-purple-300'
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        {s.status === 'RECEIVED'
                          ? '접수됨'
                          : s.status === 'IN_REVIEW'
                          ? '검토중'
                          : s.status === 'ANSWERED'
                          ? '답변완료'
                          : s.status === 'APPLIED'
                          ? '반영완료'
                          : '보류'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </>
          )}

        </div>

      </div>
    </div>
  );
};

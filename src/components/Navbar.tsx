import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ShieldCheck, MessageSquarePlus, BarChart3, CheckCircle2, Clock, LogOut } from 'lucide-react';
import { AdminStats } from '../types';

interface NavbarProps {
  isAdmin: boolean;
  onToggleAdminMode: () => void;
  onOpenCreateModal: () => void;
  onOpenAdminDashboard: () => void;
  stats: AdminStats;
}

export const Navbar: React.FC<NavbarProps> = ({
  isAdmin,
  onToggleAdminMode,
  onOpenCreateModal,
  onOpenAdminDashboard,
  stats,
}) => {
  const [isPressing, setIsPressing] = useState(false);
  const [pressProgress, setPressProgress] = useState(0);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const clickCountRef = useRef(0);
  const clickResetTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAdminUnlock = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(50);
      } catch {}
    }
    setIsPressing(false);
    setPressProgress(0);
    onOpenAdminDashboard();
  }, [onOpenAdminDashboard]);

  const handlePressStart = () => {
    if (isAdmin) return;

    setIsPressing(true);
    setPressProgress(0);

    const startTime = Date.now();
    const duration = 1500; // 1.5초간 꾹 누르면 관리자 창 호출

    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.floor((elapsed / duration) * 100));
      setPressProgress(progress);
    }, 40);

    pressTimerRef.current = setTimeout(() => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      triggerAdminUnlock();
    }, duration);
  };

  const handlePressEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setIsPressing(false);
    setPressProgress(0);
  };

  // 이스터에그 보조: 5회 빠른 연속 클릭 시에도 관리자 인증 모달 오픈
  const handleBrandClick = () => {
    if (isAdmin) {
      onOpenAdminDashboard();
      return;
    }

    clickCountRef.current += 1;
    if (clickResetTimerRef.current) clearTimeout(clickResetTimerRef.current);

    if (clickCountRef.current >= 5) {
      clickCountRef.current = 0;
      triggerAdminUnlock();
      return;
    }

    clickResetTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 1800);
  };

  useEffect(() => {
    return () => {
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (clickResetTimerRef.current) clearTimeout(clickResetTimerRef.current);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-[#F4F1EA]/95 backdrop-blur-md text-[#2D2926] border-b border-[#E6E2D3] shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 sm:gap-4">
          
          {/* Logo & School Title (좌측 상단 아이콘 또는 '삼진보이스' 글자 꾹 누르기로 관리자 창 호출) */}
          <div className="flex items-center justify-between">
            <div
              className={`flex items-center space-x-2.5 sm:space-x-3 select-none cursor-pointer group relative ${
                isPressing ? 'scale-[0.98]' : 'active:scale-[0.99]'
              } transition-transform duration-200`}
              onMouseDown={handlePressStart}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              onTouchStart={handlePressStart}
              onTouchEnd={handlePressEnd}
              onTouchCancel={handlePressEnd}
              onClick={handleBrandClick}
              role="button"
              tabIndex={0}
              aria-label="마산삼진고등학교 삼진보이스"
              title={isAdmin ? '관리자 대시보드 열기' : '마산삼진고등학교 익명 소통 창구 삼진보이스'}
            >
              {/* App Icon */}
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F4EEDC] border border-[#E6E2D3] flex items-center justify-center p-0.5 shadow-xs shrink-0 overflow-hidden">
                <img
                  src="/logo.svg"
                  alt="삼진보이스 로고"
                  className="w-full h-full object-contain pointer-events-none"
                  referrerPolicy="no-referrer"
                />

                {/* 꾹 누를 때 자연스럽게 차오르는 진행 표시 (외부인에게는 노출되지 않는 부드러운 피드백) */}
                {isPressing && !isAdmin && (
                  <div className="absolute inset-0 bg-[#5F7161]/20 rounded-xl sm:rounded-2xl flex items-end overflow-hidden pointer-events-none">
                    <div
                      className="w-full bg-[#5F7161] transition-all duration-75"
                      style={{ height: `${pressProgress}%`, opacity: 0.65 }}
                    />
                  </div>
                )}
              </div>

              {/* Title & Badge */}
              <div>
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <span className="bg-[#E6E2D3] text-[#5F7161] text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full font-bold tracking-wider uppercase">
                    마산삼진고등학교
                  </span>
                  <span className="text-xs text-[#8C8479] hidden sm:inline-block">익명 소통 창구</span>

                  {isAdmin && (
                    <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 shadow-xs animate-in fade-in">
                      <ShieldCheck className="w-3 h-3 text-amber-700 shrink-0" />
                      <span>관리자 모드</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <h1 className="text-base sm:text-xl font-bold tracking-tight text-[#2D2926]">
                    삼진보이스
                  </h1>
                  {isAdmin && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                      ADMIN
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Summary Bar */}
          <div className="hidden lg:flex items-center space-x-4 bg-white/80 px-4 py-2 rounded-2xl border border-[#E6E2D3] text-xs">
            <div className="flex items-center space-x-1.5 text-[#4A443F]">
              <span className="text-[#8C8479]">누적 접수</span>
              <span className="font-bold text-[#2D2926] bg-[#F4F1EA] px-2 py-0.5 rounded-md">
                {stats.totalSuggestions}건
              </span>
            </div>
            <div className="h-3 w-px bg-[#E6E2D3]"></div>
            <div className="flex items-center space-x-1.5 text-[#5F7161]">
              <Clock className="w-3.5 h-3.5" />
              <span>검토 중</span>
              <span className="font-bold text-[#5F7161] bg-[#5F7161]/10 px-2 py-0.5 rounded-md border border-[#5F7161]/20">
                {stats.inReviewCount}건
              </span>
            </div>
            <div className="h-3 w-px bg-[#E6E2D3]"></div>
            <div className="flex items-center space-x-1.5 text-[#4D5C4F]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>답변/반영</span>
              <span className="font-bold text-[#4D5C4F] bg-[#E6E2D3] px-2 py-0.5 rounded-md">
                {stats.answeredCount + stats.appliedCount}건
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto">
            {/* Create Suggestion Button */}
            <button
              id="btn-create-suggestion"
              onClick={onOpenCreateModal}
              className="flex-1 md:flex-none inline-flex items-center justify-center space-x-1.5 sm:space-x-2 bg-[#5F7161] hover:bg-[#4D5C4F] text-white text-xs sm:text-sm font-bold px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl shadow-xs transition-all active:scale-98"
            >
              <MessageSquarePlus className="w-4 h-4 shrink-0" />
              <span>익명 건의하기</span>
            </button>

            {/* Admin Controls - ONLY shown when logged in as Admin */}
            {isAdmin && (
              <>
                <button
                  id="btn-admin-dashboard"
                  onClick={onOpenAdminDashboard}
                  className="inline-flex items-center space-x-1.5 bg-[#5F7161] hover:bg-[#4D5C4F] text-white text-xs sm:text-sm font-bold px-3 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl transition-colors shadow-xs shrink-0"
                  title="학생회 및 학교 관리자 현황판"
                >
                  <BarChart3 className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>대시보드</span>
                </button>

                <button
                  id="btn-logout-admin"
                  onClick={onToggleAdminMode}
                  className="inline-flex items-center space-x-1 text-xs sm:text-sm font-semibold px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl transition-all border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 shrink-0"
                  title="관리자 세션 종료 (일반 모드로 복귀)"
                >
                  <LogOut className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                  <span>관리자 종료</span>
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};


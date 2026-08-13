import React from 'react';
import { ShieldCheck, MessageSquarePlus, Lock, BarChart3, CheckCircle2, Clock } from 'lucide-react';
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
  return (
    <header className="sticky top-0 z-30 bg-[#F4F1EA]/95 backdrop-blur-md text-[#2D2926] border-b border-[#E6E2D3] shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 sm:gap-4">
          
          {/* Logo & School Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 sm:space-x-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white border border-[#E6E2D3] flex items-center justify-center p-1 shadow-xs shrink-0 overflow-hidden">
                <img src="/favicon.svg" alt="마산삼진고등학교 교표" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <span className="bg-[#E6E2D3] text-[#5F7161] text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full font-bold tracking-wider uppercase">
                    마산삼진고등학교
                  </span>
                  <span className="text-xs text-[#8C8479] hidden sm:inline-block">익명 소통 창구</span>
                </div>
                <h1 className="text-base sm:text-xl font-bold tracking-tight text-[#2D2926]">
                  삼진보이스
                </h1>
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

            {/* Admin Dashboard Button - ONLY shown when in Admin Mode */}
            {isAdmin && (
              <button
                id="btn-admin-dashboard"
                onClick={onOpenAdminDashboard}
                className="inline-flex items-center space-x-1 bg-[#5F7161] hover:bg-[#4D5C4F] text-white text-xs sm:text-sm font-bold px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl transition-colors shadow-xs shrink-0"
                title="학생회 및 학교 관리자 현황판"
              >
                <BarChart3 className="w-4 h-4 text-amber-300 shrink-0" />
                <span className="hidden xs:inline">대시보드</span>
              </button>
            )}

            {/* Admin Mode Toggle */}
            <button
              id="btn-toggle-admin"
              onClick={onToggleAdminMode}
              className={`inline-flex items-center space-x-1.5 text-xs sm:text-sm font-semibold px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl transition-all border shrink-0 ${
                isAdmin
                  ? 'bg-amber-100/80 text-amber-900 border-amber-300'
                  : 'bg-white hover:bg-[#F4F1EA] text-[#4A443F] border-[#E6E2D3]'
              }`}
            >
              {isAdmin ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>관리자 On</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-[#8C8479] shrink-0" />
                  <span>관리자</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};


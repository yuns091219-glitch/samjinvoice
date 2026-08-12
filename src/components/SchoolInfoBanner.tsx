import React from 'react';
import { Shield, Mailbox, MessageSquare } from 'lucide-react';

interface SchoolInfoBannerProps {
  onOpenCreateModal: () => void;
}

export const SchoolInfoBanner: React.FC<SchoolInfoBannerProps> = ({
  onOpenCreateModal,
}) => {
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-4 sm:mt-6">
      <div className="bg-[#F4F1EA] rounded-2xl sm:rounded-[32px] p-4 sm:p-8 border border-[#E6E2D3] shadow-xs flex flex-col justify-between relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-48 h-48 bg-[#5F7161]/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="space-y-2 sm:space-y-3 relative z-10">
          <div className="inline-flex items-center space-x-1.5 bg-[#E6E2D3] text-[#5F7161] text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span>100% 철저한 익명성 보장</span>
          </div>

          <h2 className="text-lg sm:text-2xl font-bold text-[#2D2926] leading-tight">
            학생들의 목소리로 만들어가는 더 나은 마산삼진고 🏫
          </h2>

          <p className="text-xs sm:text-sm text-[#8C8479] leading-relaxed max-w-3xl">
            교내 시설, 학습 환경, 학생회 행사 등 개선이 필요한 의견을 자유롭게 건의해주세요. 
            제출된 내용은 학생회와 학교 관리자가 직접 검토하여 반영합니다.
          </p>
        </div>

        <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-[#E6E2D3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-start sm:items-center space-x-2 text-xs text-[#5F7161] font-semibold">
            <Mailbox className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
            <span>건의글 작성 시 비밀번호를 설정하면 내 건의글을 스스로 관리할 수 있습니다</span>
          </div>

          <button
            onClick={onOpenCreateModal}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 bg-[#5F7161] hover:bg-[#4D5C4F] text-white text-xs font-bold px-4 py-2.5 rounded-xl sm:rounded-2xl transition-all shadow-xs shrink-0 active:scale-98"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>지금 건의하기</span>
          </button>
        </div>
      </div>
    </div>
  );
};

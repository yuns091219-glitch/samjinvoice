import React, { useState } from 'react';
import { Wrench, Shield, Clock, Lock, Sparkles, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface MaintenanceScreenProps {
  onAdminLogin: (pin: string) => boolean;
  isAdmin: boolean;
  onExitMaintenancePreview?: () => void;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({
  onAdminLogin,
  isAdmin,
  onExitMaintenancePreview,
}) => {
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const success = onAdminLogin(pinInput);
    if (!success) {
      setLoginError('관리자 비밀번호가 일치하지 않습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#2D2926] flex flex-col justify-between selection:bg-[#5F7161] selection:text-white font-sans antialiased">
      {/* Top School Header */}
      <header className="border-b border-[#E6E2D3] bg-[#F4F1EA]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#5F7161] text-white flex items-center justify-center font-black text-sm sm:text-base shadow-xs">
              삼진
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-[#2D2926] text-sm sm:text-base tracking-tight">
                  삼진보이스 <span className="text-[#5F7161] font-semibold text-xs sm:text-sm">Samjin Voice</span>
                </span>
                <span className="hidden sm:inline-block text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#5F7161]/10 text-[#5F7161]">
                  학생 소통함
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-[#8C8479] font-medium">
                마산삼진고등학교 학생회 공식 익명 건의 플랫폼
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdminLogin(true)}
              className="text-xs font-bold text-[#5F7161] hover:text-[#2D2926] bg-white border border-[#E6E2D3] px-3 py-1.5 rounded-xl hover:bg-[#F4F1EA] transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>학생회 관리자</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col items-center justify-center text-center">
        {/* Animated Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm font-bold mb-6 animate-pulse">
          <Wrench className="w-4 h-4 text-amber-600" />
          <span>시스템 일시 점검 중 • Maintenance Mode</span>
        </div>

        {/* Hero Headline */}
        <h1 className="text-2xl sm:text-4xl font-black text-[#2D2926] tracking-tight leading-snug sm:leading-tight mb-4">
          더 나은 학생 소통 환경을 위해<br className="hidden sm:inline" />
          <span className="text-[#5F7161] relative inline-block">
            시스템 점검
            <span className="absolute bottom-1 left-0 w-full h-2 bg-[#5F7161]/15 -z-10 rounded"></span>
          </span>을 진행하고 있습니다
        </h1>

        <p className="text-[#686054] text-sm sm:text-base max-w-xl mx-auto leading-relaxed mb-8 sm:mb-10">
          마산삼진고등학교 학우 여러분의 소중한 의견을 더욱 안정적으로 접수하고 관리하기 위해 학생 소리함 서버 점검 및 데이터 정비 작업을 진행하고 있습니다.
        </p>

        {/* Info Card Grid */}
        <div className="w-full bg-white rounded-2xl sm:rounded-3xl border border-[#E6E2D3] p-5 sm:p-8 text-left shadow-sm space-y-4 mb-8">
          <h2 className="text-xs sm:text-sm font-extrabold text-[#2D2926] flex items-center gap-2 border-b border-[#F4F1EA] pb-3">
            <Clock className="w-4 h-4 text-[#5F7161]" />
            점검 안내 사항
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div className="bg-[#FAF8F5] p-3.5 sm:p-4 rounded-xl border border-[#EBE7DD]">
              <span className="text-[11px] font-bold text-[#8C8479] block mb-1">점검 일시</span>
              <p className="text-xs sm:text-sm font-extrabold text-[#2D2926]">
                현재 점검 진행 중
              </p>
              <p className="text-[11px] text-[#8C8479] mt-0.5">점검 완료 후 즉시 정상 재개됩니다.</p>
            </div>

            <div className="bg-[#FAF8F5] p-3.5 sm:p-4 rounded-xl border border-[#EBE7DD]">
              <span className="text-[11px] font-bold text-[#8C8479] block mb-1">점검 내용</span>
              <p className="text-xs sm:text-sm font-extrabold text-[#2D2926]">
                데이터베이스 안정화 및 기능 점검
              </p>
              <p className="text-[11px] text-[#8C8479] mt-0.5">서버 환경 최적화 및 답변 처리 정비</p>
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 sm:p-4 text-emerald-900 text-xs leading-relaxed flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-emerald-950">학우 여러분의 데이터는 안전하게 보관되고 있습니다</p>
              <p className="text-emerald-800 text-[11px] mt-0.5">
                기존에 등록해주신 건의사항 및 답변 데이터는 클라우드 데이터베이스에 철저히 안전하게 보존되어 있으니 안심하시기 바랍니다.
              </p>
            </div>
          </div>
        </div>

        {/* Admin Login Modal / Panel */}
        {showAdminLogin && (
          <div className="w-full max-w-md bg-white rounded-2xl border-2 border-[#5F7161] p-6 shadow-xl text-left animate-in fade-in zoom-in-95 duration-200 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#5F7161]" />
                <h3 className="font-extrabold text-sm text-[#2D2926]">학생회 관리자 인증</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAdminLogin(false);
                  setLoginError('');
                  setPinInput('');
                }}
                className="text-xs text-[#8C8479] hover:text-[#2D2926] font-bold"
              >
                닫기
              </button>
            </div>
            <p className="text-xs text-[#8C8479] mb-4">
              학생회 임원 및 담당자는 비밀번호를 입력하여 점검 중에도 관리자 모드로 접속할 수 있습니다.
            </p>

            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div>
                <input
                  type="password"
                  placeholder="관리자 비밀번호 입력"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E6E2D3] rounded-xl px-3.5 py-2.5 text-xs text-[#2D2926] focus:outline-none focus:border-[#5F7161] font-medium"
                  autoFocus
                />
                {loginError && (
                  <p className="text-xs text-rose-600 font-bold mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {loginError}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#5F7161] hover:bg-[#4d5c4f] text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-xs active:scale-95"
                >
                  관리자 모드 접속
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdminLogin(false)}
                  className="bg-[#F4F1EA] hover:bg-[#EAE5D9] text-[#686054] font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="text-xs text-[#8C8479] flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#5F7161]" />
          <span>점검이 완료되는 대로 신속하게 서비스를 재개하겠습니다. 감사합니다.</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#F4F1EA] text-[#8C8479] text-xs py-6 border-t border-[#E6E2D3]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-1">
          <p className="font-bold text-[#2D2926]">
            마산삼진고등학교 학생회 • 삼진보이스 (Samjin Voice)
          </p>
          <p className="text-[11px] text-[#8C8479]">
            경상남도 창원시 마산합포구 진동면 삼진의거대로 488 • 제53대 학생회 운영
          </p>
        </div>
      </footer>
    </div>
  );
};

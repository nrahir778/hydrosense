import React from 'react';
import { Download, X, Smartphone, Sparkles } from 'lucide-react';
import { useInstallPrompt } from '../utils/androidOptimizations';

export const AndroidInstallBanner: React.FC = () => {
  const { isInstallable, promptInstall, dismissInstall } = useInstallPrompt();

  if (!isInstallable) return null;

  return (
    <div className="bg-gradient-to-r from-sky-800 via-blue-900 to-indigo-950 text-white px-4 py-2.5 shadow-md border-b border-sky-600/30">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 text-center sm:text-left">
          <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center shrink-0 text-sky-300">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold flex items-center gap-1.5 justify-center sm:justify-start">
              <span>Android પર એપ તરીકે ઇન્સ્ટોલ કરો</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            </div>
            <div className="text-[11px] text-sky-200">
              હોમ સ્ક્રીન પરથી ડાયરેક્ટ ફુલ-સ્ક્રીન ચલાવો (WebAPK / Standalone PWA)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => promptInstall()}
            className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ઇન્સ્ટોલ (Install)</span>
          </button>
          <button
            onClick={dismissInstall}
            className="p-1.5 rounded-xl hover:bg-white/10 text-sky-200 hover:text-white transition-colors cursor-pointer"
            aria-label="બંધ કરો"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

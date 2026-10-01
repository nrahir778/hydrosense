import React from 'react';
import { ShieldCheck, Wifi, GraduationCap, Sparkles } from 'lucide-react';
import { HardwareConnectionState } from '../types';

interface FooterProps {
  connectionState: HardwareConnectionState;
  onSelectTab: (tab: 'hardware' | 'safety' | 'ai') => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab }) => {
  return (
    <footer className="w-full border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-950 mt-12 py-6 mb-16 md:mb-0 text-xs text-slate-500 dark:text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-center md:text-left">
          <div className="w-6 h-6 rounded-full bg-sky-500/10 flex items-center justify-center shrink-0">
            <GraduationCap className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
              શ્રી સરકારી માધ્યમિક અને ઉચ્ચ. માધ્યમિક શાળા–લાખાપર
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              વિજ્ઞાન અને ટેકનોલોજી સ્માર્ટ વોટર મેનેજમેન્ટ IoT પ્રોજેક્ટ (Arduino Uno R3 + HC-05 Bluetooth + HC-SR04 અલ્ટ્રાસોનિક + Gemini AI)
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-4 text-xs font-semibold">
          <button
            onClick={() => onSelectTab('ai')}
            className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center gap-1.5 text-sky-600 dark:text-sky-400"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            AI વોઇસ & લર્નિંગ
          </button>
          <button
            onClick={() => onSelectTab('safety')}
            className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            સુરક્ષા અને E-Stop
          </button>
          <button
            onClick={() => onSelectTab('hardware')}
            className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center gap-1.5"
          >
            <Wifi className="w-4 h-4 text-sky-500" />
            હાર્ડવેર વાયરિંગ અને કોડ
          </button>
        </div>
      </div>
    </footer>
  );
};

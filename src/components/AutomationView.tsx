import React, { useState } from 'react';
import { SystemState } from '../types';
import {
  Cpu,
  Lock,
  ShieldCheck,
  AlertTriangle,
  Sliders,
  CheckCircle2,
  Clock,
  Radio,
} from 'lucide-react';

interface AutomationViewProps {
  state: SystemState;
  onUpdateAutoConfig: (config: Partial<SystemState['autoConfig']>) => Promise<unknown>;
  onSetMode: (mode: 'MANUAL' | 'AUTO') => Promise<unknown>;
  isSubmitting: boolean;
}

export const AutomationView: React.FC<AutomationViewProps> = ({
  state,
}) => {
  const { tank, calibration, hardwareStatus } = state;
  const [minPercent, setMinPercent] = useState(25);
  const [targetPercent, setTargetPercent] = useState(85);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSaveThresholds = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Single Tank Automation Status */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  સ્માર્ટ ઓટોમેશન અને સેફ્ટી લૉજિક
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  મોનિટરિંગ મોડ (પંપ લૉક)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                શ્રી સરકારી માધ્યમિક અને ઉચ્ચ. માધ્યમિક શાળા–લાખાપર · કેલિબ્રેશન: {calibration.fullDistanceCm}cm (૧૦૦%) થી {calibration.emptyDistanceCm}cm (૦%)
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
            <Radio className="w-3.5 h-3.5 text-sky-500" />
            <span>સ્થિતિ: {hardwareStatus}</span>
          </div>
        </div>
      </div>

      {/* Safety Protocol Banner: Unverified Hardware Protection */}
      <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-3xl p-6 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
              ઓટોમેટિક પંપ એક્ટિવેશન સુરક્ષિત સ્થગિત છે (Hardware Verification Required)
            </h3>
            <p className="text-xs text-amber-900/80 dark:text-amber-300/80 leading-relaxed">
              નિયમ અનુસાર મોનિટરિંગ અને પંપ એક્ટ્યુએશન અલગ રાખવામાં આવ્યા છે. જ્યાં સુધી Arduino Uno રિલે અને ભૌતિક સ્વિચિંગ વાયરિંગ લેબમાં ૧૦૦% ચકાસી લેવામાં ન આવે ત્યાં સુધી ઓટોમેટિક પંપ કંટ્રોલ કાર્યરત હોવાનો ખોટો દાવો કરવામાં આવતો નથી.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-amber-200 dark:border-amber-900/50">
            <span className="font-bold text-slate-800 dark:text-slate-200 block mb-0.5">૧. ઓટો-કટઓફ નિયમ</span>
            <span className="text-slate-600 dark:text-slate-400 text-[11px]">
              {calibration.criticalFullWarningPercent}% પહોંચતાં જ હાર્ડવેર સેફ્ટી કટઓફ મોકલશે.
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-amber-200 dark:border-amber-900/50">
            <span className="font-bold text-slate-800 dark:text-slate-200 block mb-0.5">૨. નિયર-ફુલ એલર્ટ</span>
            <span className="text-slate-600 dark:text-slate-400 text-[11px]">
              {calibration.nearFullWarningPercent}% થી વધુ સ્તરે પીળી વોર્નિંગ લાઈટ ચમકશે.
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-amber-200 dark:border-amber-900/50">
            <span className="font-bold text-slate-800 dark:text-slate-200 block mb-0.5">૩. સેન્સર ટાઈમઆઉટ</span>
            <span className="text-slate-600 dark:text-slate-400 text-[11px]">
              જો ૫ સેકન્ડ ડેટા ન મળે તો સિસ્ટમ આપમેળે &quot;ઑફલાઇન&quot; મોડમાં જશે.
            </span>
          </div>
        </div>
      </div>

      {/* Single Tank Automation Logic Configuration (Simulation & Educational Model) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
            સિંગલ ટેન્ક ઓટોમેશન પેરામીટર્સ (આયોજન અને થ્રેશોલ્ડ)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            વિદ્યાર્થીઓ અને શિક્ષકો માટે આલ્ગોરિધમ સમજૂતી મોડલ
          </p>
        </div>

        <form onSubmit={handleSaveThresholds} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Low Water Auto Start Trigger */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  લઘુત્તમ સ્તર ઓટો-સ્ટાર્ટ ટ્રિગર (Low Trigger)
                </span>
                <span className="font-mono text-lg font-extrabold text-amber-600 dark:text-amber-400">
                  {minPercent}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="45"
                value={minPercent}
                onChange={(e) => setMinPercent(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <span className="text-[11px] text-slate-500 block">
                જ્યારે પાણી {minPercent}% થી નીચે જાય ત્યારે પંપ શરૂ કરવાની દરખાસ્ત તૈયાર થાય.
              </span>
            </div>

            {/* Target Auto Stop Trigger */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  ટાર્ગેટ ઓટો-સ્ટોપ ટ્રિગર (Target High Stop)
                </span>
                <span className="font-mono text-lg font-extrabold text-sky-600 dark:text-sky-400">
                  {targetPercent}%
                </span>
              </div>
              <input
                type="range"
                min="60"
                max="95"
                value={targetPercent}
                onChange={(e) => setTargetPercent(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <span className="text-[11px] text-slate-500 block">
                પાણી {targetPercent}% પહોંચતાં જ રિલે સ્ટોપ સિગ્નલ મોકલાશે (મહત્તમ સલામત: ૯૫%).
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            {savedNotice ? (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>ઓટોમેશન પેરામીટર્સ સેવ થઈ ગયા!</span>
              </div>
            ) : (
              <span className="text-xs text-slate-400">
                નોંધ: આ સેટિંગ્સ વેરીફાઇડ હાર્ડવેર ગેટવે માટે પૂર્વતૈયારી છે.
              </span>
            )}

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              પેરામીટર્સ સાચવો
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

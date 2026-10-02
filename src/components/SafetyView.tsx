import React, { useState } from 'react';
import { SystemState } from '../types';
import {
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Activity,
  Radio,
  Bell,
  Filter,
} from 'lucide-react';

interface SafetyViewProps {
  state: SystemState;
  onSetEmergencyStop: (active: boolean, reason?: string) => Promise<unknown>;
  isSubmitting: boolean;
}

export const SafetyView: React.FC<SafetyViewProps> = ({
  state,
  onSetEmergencyStop,
  isSubmitting,
}) => {
  const { safety, tank, calibration, recentLogs } = state;
  const [logFilter, setLogFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'SECURITY'>('ALL');
  const [confirmClear, setConfirmClear] = useState(false);

  const filteredLogs = recentLogs.filter((log) => {
    if (logFilter === 'ALL') return true;
    return log.level === logFilter;
  });

  const handleEStopToggle = async () => {
    if (safety.emergencyStop) {
      if (!confirmClear) {
        setConfirmClear(true);
        return;
      }
      await onSetEmergencyStop(false);
      setConfirmClear(false);
    } else {
      await onSetEmergencyStop(true, 'વેબ ઇન્ટરફેસમાંથી ઓપરેટર દ્વારા ઈમરજન્સી સ્ટોપ દબાવવામાં આવ્યો');
    }
  };

  return (
    <div className="space-y-6">
      {/* Emergency Stop Hero Card */}
      <div className={`rounded-2xl p-6 border transition-all ${
        safety.emergencyStop
          ? 'bg-rose-500/10 dark:bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-500/10'
          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80 shadow-xs'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              safety.emergencyStop
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50'
            }`}>
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  મુખ્ય ઈમરજન્સી શટડાઉન (Master E-Stop)
                </h2>
                {safety.emergencyStop && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-rose-600 text-white animate-bounce">
                    સક્રિય છે (ENGAGED)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
                તત્કાલ હાર્ડવેર કટઓફ: પંપ મોટરના હાઇ-વોલ્ટેજ રીલે (Pin D7) તાત્કાલિક ખુલ્લા (ઓપન સર્કિટ) કરી દે છે, પંપ સંપૂર્ણ બંધ કરે છે અને Arduino Uno બઝર (Pin D8) એલાર્મ શરૂ કરે છે.
              </p>
              {safety.emergencyStop && (
                <div className="mt-2 text-xs font-bold text-rose-700 dark:text-rose-300">
                  ટ્રિગર સ્ત્રોત: {safety.emergencyStopSource || 'ઓપરેટર'} · તમામ મોટર સંચાલન સ્થગિત છે.
                </div>
              )}
            </div>
          </div>

          <div>
            {safety.emergencyStop ? (
              <div className="flex items-center gap-2">
                {confirmClear ? (
                  <button
                    onClick={handleEStopToggle}
                    disabled={isSubmitting}
                    className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    સામાન્ય સ્થિતિ પુનઃસ્થાપિત કરો
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="px-5 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs flex items-center gap-2 transition-all shadow-xs"
                  >
                    <RotateCcw className="w-4 h-4" />
                    E-Stop ક્લિયર કરો
                  </button>
                )}
                {confirmClear && (
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="px-3 py-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                  >
                    રદ કરો
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={handleEStopToggle}
                disabled={isSubmitting}
                className="w-full md:w-auto px-6 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 transition-all"
              >
                <ShieldAlert className="w-5 h-5 fill-current" />
                ઈમરજન્સી સ્ટોપ ટ્રિગર કરો
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Safety Interlock Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Sensor Error Detection */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
              અલ્ટ્રાસોનિક સેન્સર ડાયગ્નોસ્ટિક્સ
            </span>
            <Activity className="w-4 h-4 text-sky-500" />
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400">મુખ્ય ટાંકી (HC-SR04):</span>
                <span className={`font-bold font-mono ${tank.sensorHealth === 'OK' ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {tank.sensorHealth === 'OK' ? 'સામાન્ય (OK)' : tank.sensorHealth}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                ટાંકી સ્તર: {tank.currentPercent !== null ? `${tank.currentPercent}% ભરાયેલ` : 'ડેટા પ્રતિક્ષામાં'}
              </div>
              <div className="text-[11px] text-sky-600 dark:text-sky-400 font-bold">
                ઓટો-કટઓફ માર્જિન: {Math.max(0, tank.targetPercent - 2)}% (ટાર્ગેટ: {tank.targetPercent}%)
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            વાયર તૂટવા કે અયોગ્ય રીડિંગ આવવા પર અકસ્માત રોકવા સેન્સર એરર સ્થિતિ સક્રિય થાય છે.
          </p>
        </div>

        {/* 2. Communication Watchdog */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
              કમ્યુનિકેશન વોચડોગ
            </span>
            <Radio className="w-4 h-4 text-sky-500" />
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">ગેટવે જોડાણ:</span>
              <span className={`font-bold ${safety.isHardwareOnline ? 'text-emerald-500' : 'text-amber-500'}`}>
                {safety.isHardwareOnline ? 'ઓનલાઇન' : 'પ્રતિક્ષામાં (ઓફલાઇન)'}
              </span>
            </div>
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-500 font-sans">ટાઈમઆઉટ મર્યાદા:</span>
              <span className="text-slate-900 dark:text-white font-semibold">5,000 ms</span>
            </div>
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-500 font-sans">Mega હાર્ડવેર વોચડોગ:</span>
              <span className="text-slate-900 dark:text-white font-semibold">6.0 સેકન્ડ</span>
            </div>
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-500 font-sans">હાર્ડવેર E-Stop પિન:</span>
              <span className="text-slate-900 dark:text-white font-semibold">Mega INT4 (D2)</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            જો Wi-Fi કે નેટવર્ક ૫ સેકન્ડ માટે કપાય તો Arduino Mega સિસ્ટમને સેફ સ્ટેટમાં રાખે છે.
          </p>
        </div>

        {/* 3. Overflow & Cutoffs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
              ભૌતિક સેફ્ટી કટઓફ
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">ક્રિટિકલ ઓવરફ્લો એલર્ટ:</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold font-mono">&gt;= {calibration.criticalFullWarningPercent}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">નિયર-ફુલ ચેતવણી સ્તર:</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold font-mono">&gt; {calibration.nearFullWarningPercent}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">મોટર પંપ સ્થિતિ:</span>
              <span className="text-slate-900 dark:text-white font-semibold font-mono">સુરક્ષિત લૉક (અલગ)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">ચેતવણી બઝર:</span>
              <span className="text-slate-900 dark:text-white font-semibold font-mono">પિન D28 સક્રિય</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            ફર્મવેર સ્તરના સુરક્ષા નિયમો સોફ્ટવેર કમાન્ડ કરતા સર્વોપરી છે.
          </p>
        </div>
      </div>

      {/* Real-time Audit Trail Console */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-sky-500" />
              લાઈવ સુરક્ષા અને ટેલિમેટ્રી ઓડિટ લોગ્સ
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              મોટર હેન્ડશેક, સેફ્ટી કટઓફ અને વોચડોગ ક્રિયાઓનો વાસ્તવિક સમયનો ઈતિહાસ.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-mono">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
            {(['ALL', 'INFO', 'WARN', 'ERROR', 'SECURITY'] as const).map((filter) => {
              const labelMap: Record<string, string> = {
                ALL: 'બધું',
                INFO: 'માહિતી',
                WARN: 'ચેતવણી',
                ERROR: 'ભૂલ',
                SECURITY: 'સુરક્ષા',
              };
              return (
                <button
                  key={filter}
                  onClick={() => setLogFilter(filter)}
                  className={`px-2 py-1 rounded transition-colors ${
                    logFilter === filter
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  {labelMap[filter]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Log Entries */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              પસંદ કરેલ ફિલ્ટરમાં કોઈ લોગ ઉપલબ્ધ નથી.
            </div>
          ) : (
            filteredLogs.map((log) => {
              let badgeColor = 'text-slate-600 dark:text-slate-400';
              if (log.level === 'SECURITY') badgeColor = 'text-rose-600 dark:text-rose-400 font-bold';
              if (log.level === 'ERROR') badgeColor = 'text-rose-500 dark:text-rose-400 font-semibold';
              if (log.level === 'WARN') badgeColor = 'text-amber-600 dark:text-amber-400 font-semibold';
              if (log.level === 'INFO') badgeColor = 'text-sky-600 dark:text-sky-400';

              const timeStr = new Date(log.timestamp).toLocaleTimeString();

              return (
                <div key={log.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="text-slate-400 text-[11px] shrink-0 mt-0.5">
                      {timeStr}
                    </span>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 uppercase shrink-0 ${badgeColor}`}>
                      {log.level}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold shrink-0">
                      [{log.source}]
                    </span>
                    <span className="text-slate-800 dark:text-slate-200 font-sans">
                      {log.message}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

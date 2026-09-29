import React from 'react';
import { TankState, PhysicalTankCalibration, HardwareStatus } from '../types';
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  RotateCw,
  Radio,
  Clock,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';

interface TankGraphicProps {
  tank: TankState;
  calibration: PhysicalTankCalibration;
  hardwareStatus: HardwareStatus;
  lastUpdatedText?: string;
  isCompact?: boolean;
}

export const TankGraphic: React.FC<TankGraphicProps> = ({
  tank,
  calibration,
  hardwareStatus,
  lastUpdatedText,
  isCompact = false,
}) => {
  const hasReading =
    tank.hasRealTelemetry &&
    tank.currentPercent !== null &&
    tank.currentDistanceCm !== null &&
    tank.sensorHealth === 'OK';

  const percent = hasReading ? Math.max(0, Math.min(100, tank.currentPercent!)) : 0;
  const heightPx = isCompact ? 320 : 400;

  // Determine warning levels
  const isNearFull = hasReading && percent > calibration.nearFullWarningPercent;
  const isCriticalFull = hasReading && percent >= calibration.criticalFullWarningPercent;
  const isLowWater = hasReading && percent <= calibration.lowWaterWarningPercent;

  // Gradient & wave styling
  let waterGradientClass = 'from-sky-400 via-blue-500 to-indigo-600';
  let waveFillColor = 'rgba(56, 189, 248, 0.4)';

  if (isCriticalFull) {
    waterGradientClass = 'from-rose-500 via-red-600 to-red-800 animate-pulse';
    waveFillColor = 'rgba(244, 63, 94, 0.5)';
  } else if (isNearFull) {
    waterGradientClass = 'from-amber-400 via-amber-500 to-orange-600';
    waveFillColor = 'rgba(251, 191, 36, 0.4)';
  } else if (isLowWater) {
    waterGradientClass = 'from-amber-500 via-amber-600 to-red-600';
    waveFillColor = 'rgba(245, 158, 11, 0.35)';
  }

  // Calculate pixel positions for calibration guidelines
  const topCriticalPct = 100 - calibration.criticalFullWarningPercent; // e.g. 3% from top
  const topNearFullPct = 100 - calibration.nearFullWarningPercent;     // e.g. 10% from top

  return (
    <div className="relative flex flex-col items-center w-full select-none">
      {/* Ultrasonic Sensor Cap */}
      <div className="relative z-20 flex flex-col items-center mb-1">
        {/* Physical HC-SR04 Housing Graphic */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 text-slate-100 border border-slate-700 shadow-lg">
          <div className="relative w-4 h-4 rounded-full bg-slate-950 border border-slate-600 flex items-center justify-center">
            {hardwareStatus === 'ONLINE' ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            )}
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-mono font-bold text-sky-300 tracking-wider">
              HC-SR04 અલ્ટ્રાસોનિક સેન્સર
            </span>
            <span className="text-[9px] text-slate-400 font-mono">
              ફુલ: {calibration.fullDistanceCm}cm · ખાલી: {calibration.emptyDistanceCm}cm
            </span>
          </div>
          <div className="w-4 h-4 rounded-full bg-slate-950 border border-slate-600 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
          </div>
        </div>

        {/* Ultrasonic Waves Emitted */}
        {hardwareStatus === 'ONLINE' ? (
          <div className="relative flex flex-col items-center h-4 w-12 overflow-hidden opacity-80 pt-0.5">
            <div className="w-3 h-0.5 border-t-2 border-sky-400 rounded-full animate-bounce" />
            <div className="w-5 h-0.5 border-t-2 border-sky-400 rounded-full animate-bounce delay-75" />
            <div className="w-7 h-0.5 border-t-2 border-sky-400 rounded-full animate-bounce delay-150" />
          </div>
        ) : (
          <div className="h-4 flex items-center text-[10px] text-slate-400 font-mono">
            {hardwareStatus === 'CONNECTING' ? 'કનેક્ટ થઈ રહ્યું છે...' : 'સેન્સર ઑફલાઇન'}
          </div>
        )}
      </div>

      {/* Main Tank Graphic Container with Height Calibration Ruler */}
      <div className="relative w-full max-w-[340px] flex items-stretch">
        {/* Left Side: Physical Distance & Calibration Ruler */}
        <div className="w-16 flex flex-col justify-between py-2 text-[10px] font-mono text-slate-500 dark:text-slate-400 text-right pr-2 shrink-0 border-r border-dashed border-slate-300 dark:border-slate-700">
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-200">૧૦૦%</span>
            <div className="text-[9px] text-sky-600 dark:text-sky-400 font-semibold">{calibration.fullDistanceCm} cm</div>
          </div>

          <div className="my-auto py-2">
            <span className="text-amber-500 font-semibold">૯૦%</span>
            <div className="text-[9px] text-amber-500/80">ચેતવણી</div>
          </div>

          <div>
            <span className="font-bold text-slate-800 dark:text-slate-200">૦%</span>
            <div className="text-[9px] text-slate-500 font-semibold">{calibration.emptyDistanceCm} cm</div>
          </div>
        </div>

        {/* Center: The Glass Tank Vessel */}
        <div
          className="relative flex-1 rounded-b-3xl rounded-t-xl border-3 border-slate-400/80 dark:border-slate-600 bg-slate-100/90 dark:bg-slate-900/80 overflow-hidden shadow-2xl backdrop-blur-md"
          style={{ height: `${heightPx}px` }}
        >
          {/* Target/Warning Threshold Line 97% (Critical Cutoff) */}
          <div
            className="absolute left-0 right-0 z-20 border-b border-rose-500/80 flex items-center justify-end pr-2 pointer-events-none"
            style={{ top: `${topCriticalPct}%` }}
          >
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-600 text-white shadow-xs">
              ૯૭% ક્રિટિકલ કટઓફ
            </span>
          </div>

          {/* Near-Full Threshold Line 90% */}
          <div
            className="absolute left-0 right-0 z-20 border-b border-dashed border-amber-400/80 flex items-center justify-end pr-2 pointer-events-none"
            style={{ top: `${topNearFullPct}%` }}
          >
            <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-amber-500 text-slate-950 shadow-xs">
              ૯૦% એલર્ટ
            </span>
          </div>

          {/* Water Column and Dynamic Waves */}
          {hasReading ? (
            <div
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${waterGradientClass} transition-all duration-700 ease-out`}
              style={{ height: `${percent}%` }}
            >
              {/* Wave surface SVG */}
              <div className="absolute -top-3 left-0 right-0 h-4 overflow-hidden pointer-events-none">
                <svg
                  className="w-[200%] h-full animate-[wave_4s_linear_infinite]"
                  viewBox="0 0 1200 120"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0,0 C150,90 350,-40 500,50 C650,140 900,10 1200,40 L1200,120 L0,120 Z"
                    fill={waveFillColor}
                  />
                </svg>
              </div>

              {/* Water surface highlight bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-white/40 shadow-xs" />

              {/* Subtle bubble reflections */}
              <div className="absolute inset-0 bg-white/5 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />
            </div>
          ) : (
            /* Empty / Unconnected Placeholder Water Base */
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-slate-300 dark:bg-slate-800 opacity-50" />
          )}

          {/* Center Overlay: Level Display OR Waiting for Hardware Connection */}
          {hasReading ? (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none">
              <div className="bg-white/80 dark:bg-slate-950/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl flex flex-col items-center text-center">
                <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight font-sans">
                  {percent.toFixed(1)}%
                </span>
                <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                  અંતર: {tank.currentDistanceCm} સે.મી.
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {tank.currentLiters} લિટર પાણી
                </span>
              </div>
            </div>
          ) : (
            /* Explicit "Waiting for hardware connection" screen requirement */
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 text-center bg-slate-900/60 backdrop-blur-xs">
              <div className="p-3 rounded-full bg-slate-800/90 text-amber-400 border border-slate-700 shadow-xl mb-3">
                {hardwareStatus === 'CONNECTING' ? (
                  <RotateCw className="w-8 h-8 animate-spin" />
                ) : hardwareStatus === 'SENSOR_ERROR' ? (
                  <AlertTriangle className="w-8 h-8 text-rose-500 animate-bounce" />
                ) : (
                  <Radio className="w-8 h-8 animate-pulse text-amber-400" />
                )}
              </div>

              <div className="font-extrabold text-white text-base leading-tight">
                {hardwareStatus === 'SENSOR_ERROR'
                  ? 'સેન્સર ખામી (Sensor Error)'
                  : 'હાર્ડવેર કનેક્શનની પ્રતિક્ષામાં છે...'}
              </div>

              <div className="text-xs text-slate-300 mt-1 max-w-[200px]">
                {hardwareStatus === 'SENSOR_ERROR'
                  ? tank.sensorErrorMessage || 'HC-SR04 રીડિંગ રેન્જ બહાર છે.'
                  : 'ESP8266 ગેટવે પાસેથી ટેલિમેટ્રી ડેટાની રાહ જોવાઈ રહી છે.'}
              </div>

              <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Waiting for hardware connection</span>
              </div>
            </div>
          )}

          {/* Upper Glass Specular Highlight Reflection */}
          <div className="absolute top-0 left-0 bottom-0 w-8 bg-gradient-to-r from-white/20 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Warning Banners Under Tank Graphic */}
      <div className="w-full max-w-[340px] mt-3 space-y-2">
        {/* Critical Full Warning (>= 97%) */}
        {isCriticalFull && (
          <div className="p-2.5 rounded-xl bg-rose-600 text-white flex items-center gap-2 text-xs font-bold shadow-lg animate-pulse">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <div className="leading-tight">
              ક્રિટિકલ ઓવરફ્લો ચેતવણી: ટાંકી {percent}% ભરાઈ ગઈ છે! (અંતર: {tank.currentDistanceCm} cm)
            </div>
          </div>
        )}

        {/* Near Full Warning (> 90% and < 97%) */}
        {isNearFull && !isCriticalFull && (
          <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 flex items-center gap-2 text-xs font-bold shadow-md">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <div className="leading-tight">
              ચેતવણી: ટાંકી પૂર્ણ થવાની નજીક છે ({percent}% &gt; {calibration.nearFullWarningPercent}%)
            </div>
          </div>
        )}

        {/* Low Water Warning (<= 15%) */}
        {isLowWater && (
          <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center gap-2 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>પાણીનું સ્તર ઓછું છે ({percent}%).</span>
          </div>
        )}

        {/* Live Status Footnote */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1 pt-1 font-mono">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>છેલ્લું અપડેટ: {lastUpdatedText || 'પ્રતિક્ષામાં'}</span>
          </div>
          <div>
            ક્ષમતા: <strong>{tank.capacityLiters} L</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

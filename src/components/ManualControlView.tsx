import React, { useState } from 'react';
import { SystemState, TankId } from '../types';
import { TankGraphic } from './TankGraphic';
import { UsbConnectionStatus, SerialConnectionMode, ArduinoTelemetry } from '../services/webSerial';
import {
  Lock,
  Sliders,
  AlertTriangle,
  ShieldCheck,
  Radio,
  Clock,
  Play,
  Square,
  AlertOctagon,
  Cable,
  Bluetooth,
  CheckCircle2,
  Cpu,
  RotateCw,
  Terminal,
  Smartphone,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface ManualControlViewProps {
  state: SystemState;
  onControlPump: (
    tankId: TankId,
    action: 'START' | 'STOP',
    targetPercent?: number,
    autoStopAtTarget?: boolean
  ) => Promise<unknown>;
  isSubmitting: boolean;
  actionError: string | null;
  onClearError: () => void;
  // USB & Bluetooth Web Serial
  usbStatus?: UsbConnectionStatus;
  serialMode?: SerialConnectionMode;
  usbError?: string | null;
  usbTelemetry?: ArduinoTelemetry | null;
  isUsbSupported?: boolean;
  isPermissionsDisallowed?: boolean;
  isAndroid?: boolean;
  onOpenAndroidGuide?: () => void;
  onConnectUsb?: () => Promise<boolean>;
  onConnectBluetooth?: () => Promise<boolean>;
  onDisconnectUsb?: () => Promise<void>;
  onStartFilling?: (targetPercent: number) => Promise<boolean>;
  onStopPump?: () => Promise<boolean>;
  onEmergencyStop?: () => Promise<boolean>;
  onSetUsbTarget?: (pct: number) => Promise<boolean>;
  onEnableAutoMode?: (targetPercent: number) => Promise<boolean>;
  onDisableAutoMode?: () => Promise<boolean>;
}

export const ManualControlView: React.FC<ManualControlViewProps> = ({
  state,
  actionError,
  onClearError,
  isSubmitting,
  usbStatus = 'DISCONNECTED',
  serialMode = 'USB',
  usbError = null,
  usbTelemetry = null,
  isUsbSupported = true,
  isPermissionsDisallowed = false,
  isAndroid = false,
  onOpenAndroidGuide,
  onConnectUsb,
  onConnectBluetooth,
  onDisconnectUsb,
  onStartFilling,
  onStopPump,
  onEmergencyStop,
  onSetUsbTarget,
  onEnableAutoMode,
  onDisableAutoMode,
}) => {
  const { tank, calibration, hardwareStatus } = state;
  // Target percentage strictly 20% to 90%
  const [targetPercent, setTargetPercent] = useState<number>(() => {
    const initial = tank.targetPercent || 75;
    return Math.max(20, Math.min(90, Math.round(initial / 5) * 5));
  });
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Sync targetPercent from Arduino telemetry
  React.useEffect(() => {
    if (usbTelemetry?.targetPercent && usbTelemetry.targetPercent >= 20 && usbTelemetry.targetPercent <= 90) {
      setTargetPercent(usbTelemetry.targetPercent);
    }
  }, [usbTelemetry?.targetPercent]);

  const isUsbConnected = usbStatus === 'CONNECTED';
  const hasValidSensorData = isUsbConnected && tank.hasRealTelemetry && tank.currentPercent !== null;
  const isPumpRunning = tank.pumpStatus === 'RUNNING';
  const isStale = Boolean(usbTelemetry?.isStale);

  const operatingMode = usbTelemetry?.operatingMode || tank.operatingMode || 'MANUAL';
  const isAutoModeActive = operatingMode === 'AUTO';

  const handleTargetChange = (val: number) => {
    // Strictly clamped 20% to 90% - never above 90%
    const clamped = Math.max(20, Math.min(90, Math.round(val / 5) * 5));
    setTargetPercent(clamped);
    if (onSetUsbTarget && isUsbConnected) {
      onSetUsbTarget(clamped);
    }
  };

  const handleToggleAutoMode = async () => {
    setFeedbackMsg(null);
    if (!isUsbConnected) {
      setFeedbackMsg('કંટ્રોલર જોડાયેલ નથી. કૃપા કરીને પહેલા કનેક્ટ કરો.');
      return;
    }
    if (!hasValidSensorData) {
      setFeedbackMsg('માન્ય સેન્સર રીડિંગ મળ્યું નથી. સેન્સર ફીડબેક વગર ઓટો મોડ સક્રિય કરી શકાતો નથી.');
      return;
    }
    if (isAutoModeActive) {
      if (onDisableAutoMode) {
        const ok = await onDisableAutoMode();
        if (ok) {
          setFeedbackMsg('ઓટો મોડ બંધ: સિસ્ટમ MANUAL મોડમાં છે (MODE:MANUAL).');
        }
      }
    } else {
      if (onEnableAutoMode) {
        const ok = await onEnableAutoMode(targetPercent);
        if (ok) {
          setFeedbackMsg(`ઓટો મોડ સક્રિય: TARGET:${targetPercent} & MODE:AUTO મોકલ્યો.`);
        }
      }
    }
  };

  const handleStartFilling = async () => {
    setFeedbackMsg(null);
    if (!isUsbConnected) {
      setFeedbackMsg('USB જોડાયેલ નથી. કૃપા કરીને પહેલા "Connect USB" પર ક્લિક કરો.');
      return;
    }
    if (!hasValidSensorData) {
      setFeedbackMsg('માન્ય સેન્સર રીડિંગ મળ્યું નથી. સેન્સર ફીડબેક વગર પંપ શરૂ કરી શકાતો નથી.');
      return;
    }
    if (tank.currentPercent !== null && tank.currentPercent >= targetPercent) {
      setFeedbackMsg(`પાણીનું સ્તર (${tank.currentPercent}%) પહેલેથી જ લક્ષ્યાંક (${targetPercent}%) પર કે તેથી વધુ છે.`);
      return;
    }
    if (onStartFilling) {
      const ok = await onStartFilling(targetPercent);
      if (ok) {
        setFeedbackMsg(`પાણી ભરવાનું શરૂ કર્યું: Arduino Uno આપમેળે ${targetPercent}% પર પંપ બંધ કરશે.`);
      }
    }
  };

  const handleStopPump = async () => {
    setFeedbackMsg(null);
    if (onStopPump) {
      await onStopPump();
      setFeedbackMsg('મોટર પંપ તાત્કાલિક બંધ કરવામાં આવ્યો છે (STOP મોકલ્યો).');
    }
  };

  const handleEmergencyStop = async () => {
    setFeedbackMsg(null);
    if (onEmergencyStop) {
      await onEmergencyStop();
      setFeedbackMsg('🚨 EMERGENCY STOP: પંપ તાત્કાલિક શટડાઉન કરવામાં આવ્યો!');
    }
  };

  const formatLastUpdate = (timestamp: number | null) => {
    if (!timestamp) return 'પ્રતિક્ષામાં (કોઈ ડેટા નથી)';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 3) return 'હમણાં જ (Live)';
    if (seconds < 60) return `${seconds} સેકન્ડ પહેલા`;
    const mins = Math.floor(seconds / 60);
    return `${mins} મિનિટ પહેલા (${new Date(timestamp).toLocaleTimeString('gu-IN')})`;
  };

  return (
    <div className="space-y-6">
      {/* Title Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Sliders className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              <span>Arduino Uno / HC-05 વોટર-લેવલ કંટ્રોલ સ્ટેશન</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              શ્રી સરકારી માધ્યમિક અને ઉચ્ચ. માધ્યમિક શાળા–લાખાપર · ડાયરેક્ટ Web Serial કમાન્ડ ઇન્ટરફેસ (USB & Bluetooth)
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {isUsbConnected ? (
              <>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
                  serialMode === 'BLUETOOTH'
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                }`}>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  {serialMode === 'BLUETOOTH' ? (
                    <Bluetooth className="w-3.5 h-3.5 text-blue-600" />
                  ) : (
                    <Cable className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>
                    {serialMode === 'BLUETOOTH'
                      ? 'Bluetooth HC-05 Connected (9600 Baud)'
                      : 'USB Serial Connected (115200 Baud)'}
                  </span>
                </div>
                {onDisconnectUsb && (
                  <button
                    onClick={onDisconnectUsb}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <span>{serialMode === 'BLUETOOTH' ? 'Disconnect BT' : 'Disconnect USB'}</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>Offline</span>
                </div>
                {onConnectUsb && (
                  <button
                    onClick={onConnectUsb}
                    disabled={!isUsbSupported || isSubmitting}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    title="Arduino Uno USB સાથે જોડાઓ (115200 Baud)"
                  >
                    <Cable className="w-3.5 h-3.5" />
                    <span>Connect USB</span>
                  </button>
                )}
                {onConnectBluetooth && (
                  <button
                    onClick={onConnectBluetooth}
                    disabled={!isUsbSupported || isSubmitting}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    title="HC-05 Bluetooth Virtual COM Port સાથે જોડાઓ (9600 Baud)"
                  >
                    <Bluetooth className="w-3.5 h-3.5" />
                    <span>Connect Bluetooth</span>
                  </button>
                )}
                {onOpenAndroidGuide && (
                  <button
                    onClick={onOpenAndroidGuide}
                    className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Android પર HC-05 કનેક્ટ કરવાની રીત જુઓ"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="hidden sm:inline">Android મદદ</span>
                    <span className="sm:hidden">Android</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* USB Connection Error / Permissions Policy Alert */}
      {usbError && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl p-4 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">USB કનેક્શન સ્ટેટસ / સૂચના:</span>
            <p>{usbError}</p>
            {(isPermissionsDisallowed || (usbError && (usbError.includes('iframe') || usbError.includes('સુરક્ષા પ્રતિબંધ') || usbError.includes('પોલિસી')))) && typeof window !== 'undefined' && (
              <div className="pt-2">
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  <span>નવી ટેબમાં એપ ખોલો (Open in Direct Tab) ↗</span>
                </a>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                  બ્રાઉઝર સિક્યુરિટી નિયમ મુજબ પ્રીવ્યુ આઈફ્રેમમાં Web Serial પોર્ટ બ્લોક હોય છે. નવી ડાયરેક્ટ ટેબમાં ખોલ્યા પછી "Connect USB" પર ક્લિક કરવાથી પોર્ટ સિલેક્ટર તરત ખૂલી જશે.
                </p>
              </div>
            )}
            <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1">
              સલાહ: જો COM પોર્ટ વ્યસ્ત (BUSY) બતાવે, તો Arduino IDE નો Serial Monitor બંધ કરો અને ફરી Connect USB પર ક્લિક કરો.
            </p>
          </div>
        </div>
      )}

      {/* Action Error Banner */}
      {actionError && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl p-3 text-xs flex items-center justify-between text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={onClearError}
            className="text-rose-600 dark:text-rose-400 hover:underline font-bold"
          >
            બંધ કરો
          </button>
        </div>
      )}

      {/* Action Feedback Banner */}
      {feedbackMsg && (
        <div className="bg-sky-50 dark:bg-sky-950/50 border border-sky-300 dark:border-sky-800 rounded-xl p-3 text-xs flex items-center justify-between text-sky-900 dark:text-sky-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-sky-700 dark:text-sky-300 hover:underline font-bold"
          >
            બંધ કરો
          </button>
        </div>
      )}

      {/* Stale Data Warning */}
      {isStale && isUsbConnected && (
        <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2 animate-pulse">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-bold">
            ચેતવણી: છેલ્લી ૩.૫ સેકન્ડથી Arduino Uno માંથી નવો ટેલિમેટ્રી ડેટા મળ્યો નથી (Stale Data).
          </span>
        </div>
      )}

      {/* Main Split: Left Tank Graphic, Right Control Station & Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Tank Graphic */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-3.5 sm:p-6 shadow-sm flex flex-col items-center justify-center">
          <TankGraphic
            tank={tank}
            calibration={calibration}
            hardwareStatus={hardwareStatus}
            lastUpdatedText={formatLastUpdate(tank.lastReadingTime)}
          />
        </div>

        {/* Right Column: Full Water-Level Control Station */}
        <div className="lg:col-span-7 space-y-5 sm:space-y-6">
          {/* Real-time Status Card: Target vs Actual, Distance, Pump Status */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-sky-500" />
                <span>વાસ્તવિક સ્થિતિ અને ટેલિમેટ્રી (Live Status)</span>
              </h3>
              <span className="text-[11px] sm:text-xs font-mono text-slate-400">
                115200 Baud / 9600 Baud
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {/* Selected Target Level */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50">
                <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                  લક્ષ્યાંક (Target)
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-indigo-900 dark:text-indigo-100 mt-1 font-mono">
                  {targetPercent}%
                </div>
                <div className="text-[10px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                  કટઓફ સેટપોઇન્ટ
                </div>
              </div>

              {/* Actual Measured Level */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/50">
                <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                  વાસ્તવિક (Actual)
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-sky-900 dark:text-sky-100 mt-1 font-sans">
                  {tank.currentPercent !== null ? `${tank.currentPercent}%` : '--'}
                </div>
                <div className="text-[10px] text-sky-700 dark:text-sky-300 mt-0.5">
                  {tank.currentLiters !== null ? `${tank.currentLiters} L` : 'ઓફલાઇન'}
                </div>
              </div>

              {/* Measured Ultrasonic Distance */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                  અંતર (Distance)
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 font-mono">
                  {tank.currentDistanceCm !== null ? `${tank.currentDistanceCm} cm` : '--'}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  HC-SR04 ઇકો
                </div>
              </div>

              {/* Physical Pump Status */}
              <div className={`p-3 sm:p-3.5 rounded-2xl border transition-colors ${
                isPumpRunning
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
              }`}>
                <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                  પંપ રિલે (Pump)
                </span>
                <div className={`text-base sm:text-xl font-extrabold mt-1 flex items-center gap-1.5 ${
                  isPumpRunning ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'
                }`}>
                  {isPumpRunning ? (
                    <>
                      <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                      <span>ON (ચાલુ)</span>
                    </>
                  ) : (
                    <span>OFF (બંધ)</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Pin D7 Active-LOW
                </div>
              </div>
            </div>

            {/* Operating Mode & Communication Timestamp */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-500">ટેલિમેટ્રી પ્રતિસાદ:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                  {formatLastUpdate(tank.lastReadingTime)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded-md font-bold font-mono text-[11px] ${
                  isAutoModeActive ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  MODE: {operatingMode}
                </span>
                <span className={`font-bold font-mono ${tank.sensorHealth === 'OK' ? 'text-emerald-600' : 'text-amber-500'}`}>
                  સેન્સર: {tank.sensorHealth === 'OK' ? 'OK' : tank.sensorHealth}
                </span>
              </div>
            </div>
          </div>

          {/* Automatic Mode Toggle Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  ઓટોમેટિક મોડ (AUTO MODE TOGGLE)
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  isAutoModeActive ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}>
                  {isAutoModeActive ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                સક્રિય કરતાં: TARGET:{targetPercent} & MODE:AUTO મોકલશે. પાણી &lt;= 15% એ પંપ શરૂ થઈ {targetPercent}% એ બંધ થશે.
              </p>
            </div>

            <button
              onClick={handleToggleAutoMode}
              disabled={!isUsbConnected}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                !isUsbConnected
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : isAutoModeActive
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
              }`}
            >
              {isAutoModeActive ? (
                <>
                  <ToggleRight className="w-5 h-5 text-white" />
                  <span>Auto Mode ચાલુ</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-5 h-5 text-slate-400" />
                  <span>Auto Mode બંધ</span>
                </>
              )}
            </button>
          </div>

          {/* Water-Level Control: Target Selector (20% to 90%, 5% increments) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  લક્ષ્યાંક પાણી સ્તર સિલેક્ટર (Water Target Slider: 20% - 90%)
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                  પસંદ કરેલ લક્ષ્યાંક તે સાયકલ માટેની મહત્તમ મર્યાદા છે. સિસ્ટમ ક્યારેય ૯૦% થી વધુ ટાર્ગેટ મોકલતી નથી.
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl sm:text-3xl font-extrabold text-sky-600 dark:text-sky-400 font-mono tabular-nums">
                  {targetPercent}%
                </span>
                <div className="text-[10px] text-slate-400 font-medium">Max Limit: 90%</div>
              </div>
            </div>

            {/* Slider with -5% / +5% buttons */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleTargetChange(targetPercent - 5)}
                  disabled={targetPercent <= 20}
                  className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-colors active:scale-95 shrink-0"
                  title="5% ઘટાડો (ન્યૂનતમ 20%)"
                >
                  -5%
                </button>

                <input
                  type="range"
                  min="20"
                  max="90"
                  step="5"
                  value={targetPercent}
                  onChange={(e) => handleTargetChange(parseInt(e.target.value, 10))}
                  className="flex-1 h-3 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-600 dark:accent-sky-400 py-1"
                />

                <button
                  onClick={() => handleTargetChange(targetPercent + 5)}
                  disabled={targetPercent >= 90}
                  className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-colors active:scale-95 shrink-0"
                  title="5% વધારો (મહત્તમ 90%)"
                >
                  +5%
                </button>
              </div>

              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>૨૦% (લઘુત્તમ)</span>
                <span>૩૫%</span>
                <span>૫૦%</span>
                <span>૬૫%</span>
                <span>૮૦%</span>
                <span>૯૦% (મહત્તમ હાર્ડ લિમિટ)</span>
              </div>

              {/* Preset Buttons */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-xs text-slate-500 font-medium">ઝડપી સેટિંગ:</span>
                {[20, 30, 40, 50, 60, 70, 75, 80, 85, 90].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handleTargetChange(pct)}
                    className={`px-3 py-1 text-xs rounded-lg font-mono font-bold transition-colors cursor-pointer ${
                      targetPercent === pct
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons: START PUMP, STOP PUMP, EMERGENCY STOP */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. START PUMP Button */}
                <button
                  onClick={handleStartFilling}
                  disabled={!isUsbConnected || !hasValidSensorData || isPumpRunning || (tank.currentPercent !== null && tank.currentPercent >= targetPercent)}
                  className={`px-4 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                    !isUsbConnected || !hasValidSensorData || isPumpRunning || (tank.currentPercent !== null && tank.currentPercent >= targetPercent)
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                      : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white cursor-pointer shadow-emerald-600/20'
                  }`}
                  title={
                    !isUsbConnected
                      ? 'USB જોડાયેલ નથી'
                      : !hasValidSensorData
                      ? 'સેન્સર રીડિંગ ઉપલબ્ધ નથી'
                      : isPumpRunning
                      ? 'પંપ પહેલેથી ચાલુ છે'
                      : `START PUMP (TARGET:${targetPercent} -> MODE:MANUAL -> START)`
                  }
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>START PUMP (શરૂ કરો)</span>
                </button>

                {/* 2. STOP PUMP Button */}
                <button
                  onClick={handleStopPump}
                  disabled={!isUsbConnected || !isPumpRunning}
                  className={`px-4 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                    !isUsbConnected || !isPumpRunning
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                      : 'bg-amber-600 hover:bg-amber-700 active:scale-95 text-white cursor-pointer shadow-amber-600/20'
                  }`}
                  title="મોટર પંપ તાત્કાલિક બંધ કરો (STOP આદેશ મોકલે છે)"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>STOP PUMP (બંધ કરો)</span>
                </button>

                {/* 3. Emergency Stop Button */}
                <button
                  onClick={handleEmergencyStop}
                  disabled={!isUsbConnected}
                  className={`px-4 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                    !isUsbConnected
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                      : 'bg-rose-600 hover:bg-rose-700 active:scale-95 text-white cursor-pointer shadow-rose-600/30'
                  }`}
                  title="તાત્કાલિક ઈમરજન્સી સ્ટોપ આદેશ મોકલો (STOP x 2)"
                >
                  <AlertOctagon className="w-4 h-4" />
                  <span>Emergency Stop</span>
                </button>
              </div>

              {/* Requirement Hint when Start is disabled */}
              {(!isUsbConnected || !hasValidSensorData) && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    {!isUsbConnected
                      ? 'પંપ શરૂ કરવા માટે પહેલા "Connect USB" અથવા "Connect Bluetooth" પર ક્લિક કરીને Arduino Uno જોડો.'
                      : 'સુરક્ષા નિયમ: માન્ય અલ્ટ્રાસોનિક સેન્સર રીડિંગ્સ મળ્યા પછી જ પંપ શરૂ કરવાની મંજૂરી મળશે.'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Arduino Communication Protocol & Safety Reference */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-500" />
              <span>Arduino Uno સીરીયલ પ્રોટોકોલ વિગતો (115200 Baud / 9600 Baud)</span>
            </h4>

            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
              <p>
                વેબ એપ્લિકેશન ન્યૂલાઇન-ડિલિમિટેડ (\n) આદેશો મોકલે છે:
              </p>
              <div className="p-3 rounded-xl bg-slate-950 font-mono text-emerald-400 text-xs space-y-1">
                <div>TARGET:75    {'->'} લક્ષ્યાંક ૭૫% સેટ કરે છે (20% થી 90% ની વચ્ચે)</div>
                <div>MODE:MANUAL  {'->'} ઓપરેટિંગ મોડ MANUAL સેટ કરે છે</div>
                <div>MODE:AUTO    {'->'} ઓટો મોડ સક્રિય કરે છે (પાણી &lt;=15% એ સ્ટાર્ટ, ટાર્ગેટ પર સ્ટોપ)</div>
                <div>START        {'->'} પંપ ઓટો-ફિલિંગ શરૂ કરે છે</div>
                <div>STOP         {'->'} પંપ તાત્કાલિક બંધ કરે છે અને ઓટો મોડ રીસેટ કરે છે</div>
                <div>STATUS       {'->'} તાત્કાલિક ટેલિમેટ્રી રીડિંગ માંગે છે</div>
              </div>
              <p className="pt-1">
                Arduino Uno દર ૧ સેકન્ડે પુષ્ટિ ટેલિમેટ્રી પ્રસારિત કરે છે:
              </p>
              <div className="p-3 rounded-xl bg-slate-950 font-mono text-sky-300 text-xs">
                LEVEL:45.0,DISTANCE:7.28,PUMP:ON,TARGET:75,MODE:MANUAL,ERROR:NONE
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

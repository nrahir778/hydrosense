import React, { useState } from 'react';
import {
  SystemState,
  PhysicalTankCalibration,
} from '../types';
import { TankGraphic } from './TankGraphic';
import { UsbConnectionStatus, SerialConnectionMode, ArduinoTelemetry } from '../services/webSerial';
import {
  RotateCw,
  Sliders,
  AlertTriangle,
  Radio,
  Clock,
  Lock,
  RefreshCcw,
  ShieldCheck,
  Cable,
  Bluetooth,
  Play,
  Square,
  AlertOctagon,
  CheckCircle2,
  Save,
  HelpCircle,
  Smartphone,
} from 'lucide-react';

interface DashboardViewProps {
  state: SystemState;
  onRefresh: () => Promise<unknown>;
  onUpdateConfig: (payload: {
    authToken?: string;
    requireAuth?: boolean;
    calibration?: Partial<PhysicalTankCalibration>;
  }) => Promise<unknown>;
  onNavigateTab: (tab: 'manual' | 'automation' | 'safety' | 'hardware' | 'ai') => void;
  isSubmitting: boolean;
  // USB & Bluetooth Web Serial integration
  usbStatus?: UsbConnectionStatus;
  serialMode?: SerialConnectionMode;
  usbError?: string | null;
  usbTelemetry?: ArduinoTelemetry | null;
  isUsbSupported?: boolean;
  isPermissionsDisallowed?: boolean;
  onConnectUsb?: () => Promise<boolean>;
  onConnectBluetooth?: () => Promise<boolean>;
  onDisconnectUsb?: () => Promise<void>;
  onStartFilling?: (targetPercent: number) => Promise<boolean>;
  onStopPump?: () => Promise<boolean>;
  onEmergencyStop?: () => Promise<boolean>;
  onSetUsbTarget?: (pct: number) => Promise<boolean>;
  isAndroid?: boolean;
  onOpenAndroidGuide?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  onRefresh,
  onUpdateConfig,
  onNavigateTab,
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
}) => {
  const { tank, hardwareStatus, calibration } = state;
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<number>(() => tank.targetPercent || 85);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Calibration Form State
  const [emptyDist, setEmptyDist] = useState(calibration.emptyDistanceCm.toString());
  const [fullDist, setFullDist] = useState(calibration.fullDistanceCm.toString());
  const [nearFullPct, setNearFullPct] = useState(calibration.nearFullWarningPercent.toString());
  const [criticalPct, setCriticalPct] = useState(calibration.criticalFullWarningPercent.toString());
  const [lowWaterPct, setLowWaterPct] = useState(calibration.lowWaterWarningPercent.toString());

  const isUsbConnected = usbStatus === 'CONNECTED';
  const hasValidSensorData = isUsbConnected && tank.hasRealTelemetry && tank.currentPercent !== null;
  const isPumpRunning = tank.pumpStatus === 'RUNNING';
  const isStale = Boolean(usbTelemetry?.isStale);

  const handleTargetChange = (val: number) => {
    const clamped = Math.max(10, Math.min(100, Math.round(val / 5) * 5));
    setSelectedTarget(clamped);
    if (onSetUsbTarget && isUsbConnected) {
      onSetUsbTarget(clamped);
    }
  };

  const handleStartFilling = async () => {
    setActionFeedback(null);
    if (!isUsbConnected) {
      setActionFeedback('USB જોડાયેલ નથી. કૃપા કરીને પહેલા "Connect USB" પર ક્લિક કરો.');
      return;
    }
    if (!hasValidSensorData) {
      setActionFeedback('માન્ય સેન્સર રીડિંગ મળ્યું નથી. સેન્સર ફીડબેક વગર પંપ શરૂ કરી શકાતો નથી.');
      return;
    }
    if (tank.currentPercent !== null && tank.currentPercent >= selectedTarget) {
      setActionFeedback(`પાણીનું સ્તર (${tank.currentPercent}%) પહેલેથી જ લક્ષ્યાંક (${selectedTarget}%) પર કે તેથી વધુ છે.`);
      return;
    }
    if (onStartFilling) {
      const ok = await onStartFilling(selectedTarget);
      if (ok) {
        setActionFeedback(`પાણી ભરવાનું શરૂ કર્યું: ટાર્ગેટ ${selectedTarget}% પર પહોંચતા પંપ આપમેળે બંધ થશે.`);
      }
    }
  };

  const handleStopPump = async () => {
    setActionFeedback(null);
    if (onStopPump) {
      await onStopPump();
      setActionFeedback('પંપ તાત્કાલિક બંધ કરવામાં આવ્યો છે.');
    }
  };

  const handleEmergencyStop = async () => {
    setActionFeedback(null);
    if (onEmergencyStop) {
      await onEmergencyStop();
      setActionFeedback('🚨 ઈમરજન્સી સ્ટોપ સક્રિય: પંપ તાત્કાલિક બંધ થયો!');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateConfig({
      calibration: {
        emptyDistanceCm: parseFloat(emptyDist) || 13.26,
        fullDistanceCm: parseFloat(fullDist) || 2.40,
        nearFullWarningPercent: parseFloat(nearFullPct) || 90.0,
        criticalFullWarningPercent: parseFloat(criticalPct) || 97.0,
        lowWaterWarningPercent: parseFloat(lowWaterPct) || 15.0,
      },
    });
    setShowSettingsModal(false);
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
      {/* Top Header Card with USB Status & Connect Button */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center flex-wrap gap-2.5">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <Cable className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <span>સિંગલ વોટર ટેન્ક મોનિટરિંગ & કંટ્રોલ સ્ટેશન</span>
              </h2>
              {/* Hardware Connection Badge */}
              {isUsbConnected ? (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold ${
                  serialMode === 'BLUETOOTH'
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                }`}>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  {serialMode === 'BLUETOOTH' ? (
                    <Bluetooth className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Cable className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>
                    {serialMode === 'BLUETOOTH'
                      ? 'HC-05 Bluetooth Connected (9600 Baud)'
                      : 'Arduino Uno USB Connected (115200 Baud)'}
                  </span>
                </div>
              ) : usbStatus === 'CONNECTING' ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold">
                  <RotateCw className="w-4 h-4 animate-spin text-amber-500" />
                  <span>Connecting...</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>Controller offline (Disconnected)</span>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              શ્રી સરકારી માધ્યમિક અને ઉચ્ચ. માધ્યમિક શાળા–લાખાપર · કેલિબ્રેશન: ખાલી: {calibration.emptyDistanceCm}cm | પૂર્ણ: {calibration.fullDistanceCm}cm
            </p>
          </div>

          {/* Action Buttons: Connect USB, Connect Bluetooth, Refresh, and Settings */}
          <div className="flex items-center flex-wrap gap-2.5">
            {!isUsbConnected ? (
              <>
                <button
                  onClick={onConnectUsb}
                  disabled={!isUsbSupported || isSubmitting}
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all transform active:scale-95 cursor-pointer"
                  title="Arduino Uno USB સીરીયલ પોર્ટ સાથે જોડાઓ (115200 Baud)"
                >
                  <Cable className="w-4 h-4" />
                  <span>Connect USB</span>
                </button>
                {onConnectBluetooth && (
                  <button
                    onClick={onConnectBluetooth}
                    disabled={!isUsbSupported || isSubmitting}
                    className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all transform active:scale-95 cursor-pointer"
                    title="HC-05 Bluetooth Virtual COM Port સાથે જોડાઓ (9600 Baud)"
                  >
                    <Bluetooth className="w-4 h-4" />
                    <span>Connect Bluetooth</span>
                  </button>
                )}
                {onOpenAndroidGuide && (
                  <button
                    onClick={onOpenAndroidGuide}
                    className="px-3 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Android પર HC-05 કનેક્ટ કરવાની રીત જુઓ"
                  >
                    <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="hidden sm:inline">Android મદદ</span>
                    <span className="sm:hidden">Android</span>
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={onDisconnectUsb}
                disabled={isSubmitting}
                className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title={serialMode === 'BLUETOOTH' ? 'HC-05 Bluetooth ડિસ્કનેક્ટ કરો' : 'USB ડિસ્કનેક્ટ કરો'}
              >
                <span>{serialMode === 'BLUETOOTH' ? 'Disconnect Bluetooth' : 'Disconnect USB'}</span>
              </button>
            )}

            <button
              onClick={() => onRefresh()}
              disabled={isSubmitting}
              className="px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all transform active:scale-95 cursor-pointer"
              title="હાર્ડવેર સ્ટેટસ તરત રીફ્રેશ કરો"
            >
              <RefreshCcw className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
              <span>રીફ્રેશ</span>
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="ચેતવણી થ્રેશોલ્ડ અને કેલિબ્રેશન સેટિંગ્સ"
            >
              <Sliders className="w-4 h-4 text-sky-500" />
              <span>કેલિબ્રેશન</span>
            </button>
          </div>
        </div>
      </div>

      {/* Web Serial Browser Compatibility Alert */}
      {!isUsbSupported && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Web Serial API આ બ્રાઉઝરમાં સપોર્ટેડ નથી:</span>
            <p>
              Arduino Uno સાથે સીધા USB સંચાર માટે કૃપા કરીને <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong>, અથવા <strong>Opera</strong> (Desktop) બ્રાઉઝર વાપરો. Firefox અથવા Safari માં Web Serial ઉપલબ્ધ નથી.
            </p>
          </div>
        </div>
      )}

      {/* USB Connection Error Alert */}
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

      {/* Stale Data Warning Banner */}
      {isStale && isUsbConnected && (
        <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-2xl p-3 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-bold">ચેતવણી: છેલ્લી ૩.૫ સેકન્ડથી Arduino Uno માંથી નવો ડેટા મળ્યો નથી (Stale Data).</span>
          </div>
          <span className="text-[11px] font-mono text-amber-800 dark:text-amber-300">
            કેબલ કનેક્શન અને 115200 Baud દર તપાસો
          </span>
        </div>
      )}

      {/* Action Feedback Toast */}
      {actionFeedback && (
        <div className="bg-sky-50 dark:bg-sky-950/50 border border-sky-300 dark:border-sky-800 rounded-2xl p-3 text-xs text-sky-900 dark:text-sky-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-sky-700 dark:text-sky-300 hover:underline font-bold"
          >
            બંધ કરો
          </button>
        </div>
      )}

      {/* Main Grid: Left Animated Tank Graphic, Right Telemetry & Control Station */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Animated Tank Graphic (lg:col-span-5) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 shadow-md flex flex-col items-center justify-center">
          <TankGraphic
            tank={tank}
            calibration={calibration}
            hardwareStatus={hardwareStatus}
            lastUpdatedText={formatLastUpdate(tank.lastReadingTime)}
          />
        </div>

        {/* Right Column: Water-Level Control & Live Metrics (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Key Measurement Indicators: Target vs Actual, Distance, Pump Status */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-sky-500" />
                <span>વાસ્તવિક સેન્સર રીડિંગ્સ અને સ્થિતિ (Live Telemetry)</span>
              </h3>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                પ્રોટોકોલ: 115200 Baud USB
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* 1. Actual Measured Water Level */}
              <div className="p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/50">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                  વાસ્તવિક સ્તર (Actual)
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-sky-900 dark:text-sky-100 mt-1 font-sans">
                  {tank.currentPercent !== null ? `${tank.currentPercent}%` : '--'}
                </div>
                <div className="text-[10px] text-sky-700 dark:text-sky-300 mt-1 truncate">
                  {tank.currentLiters !== null ? `${tank.currentLiters} L` : 'ઓફલાઇન'}
                </div>
              </div>

              {/* 2. Selected Target Water Level */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                  લક્ષ્યાંક સ્તર (Target)
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-indigo-900 dark:text-indigo-100 mt-1 font-mono">
                  {selectedTarget}%
                </div>
                <div className="text-[10px] text-indigo-700 dark:text-indigo-300 mt-1">
                  ઓટો-કટઓફ સેટ
                </div>
              </div>

              {/* 3. Measured Distance to Water Surface */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                  માપેલું અંતર (Distance)
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 font-mono">
                  {tank.currentDistanceCm !== null ? `${tank.currentDistanceCm} cm` : '--'}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                  HC-SR04 ઇકો
                </div>
              </div>

              {/* 4. Physical Pump Status */}
              <div className={`p-3.5 rounded-2xl border transition-colors ${
                isPumpRunning
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
              }`}>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                  પંપ સ્થિતિ (Pump)
                </span>
                <div className={`text-xl sm:text-2xl font-extrabold mt-1 flex items-center gap-1.5 ${
                  isPumpRunning ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'
                }`}>
                  {isPumpRunning ? (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                      <span>ON (ચાલુ)</span>
                    </>
                  ) : (
                    <span>OFF (બંધ)</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                  Relay Pin D7
                </div>
              </div>
            </div>

            {/* Last Communication Time & Sensor Health Detail */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-500 dark:text-slate-400">છેલ્લો સંપર્ક:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                  {formatLastUpdate(tank.lastReadingTime)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">સેન્સર ડાયગ્નોસ્ટિક:</span>
                <span className={`font-bold font-mono ${tank.sensorHealth === 'OK' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                  {tank.sensorHealth === 'OK' ? 'સામાન્ય (OK)' : tank.sensorHealth}
                </span>
              </div>
            </div>
          </div>

          {/* Water-Level Control Station: Target Selector & Action Buttons */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                  <span>વોટર-લેવલ કંટ્રોલ સ્ટેશન (Arduino Uno Direct Control)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  લક્ષ્યાંક સ્તર પસંદ કરો (૧૦% થી ૧૦૦%, ૫% ના વધારા સાથે) અને પંપ શરૂ કરો.
                </p>
              </div>

              {/* Big Target Level Indicator */}
              <div className="text-right">
                <span className="text-3xl font-extrabold text-sky-600 dark:text-sky-400 font-mono tabular-nums">
                  {selectedTarget}%
                </span>
              </div>
            </div>

            {/* Target Level Slider (10% to 100%, 5% increments) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-medium">
                <span>લક્ષ્યાંક સ્તર સિલેક્ટર (Target Level):</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {selectedTarget}%
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleTargetChange(selectedTarget - 5)}
                  disabled={selectedTarget <= 10}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
                  title="5% ઘટાડો"
                >
                  -5%
                </button>

                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={selectedTarget}
                  onChange={(e) => handleTargetChange(parseInt(e.target.value, 10))}
                  className="flex-1 h-3 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-600 dark:accent-sky-400"
                />

                <button
                  onClick={() => handleTargetChange(selectedTarget + 5)}
                  disabled={selectedTarget >= 100}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
                  title="5% વધારો"
                >
                  +5%
                </button>
              </div>

              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>૧૦% (લઘુત્તમ)</span>
                <span>૨૫%</span>
                <span>૫૦%</span>
                <span>૭૫%</span>
                <span>૯૦%</span>
                <span>૧૦૦% (મહત્તમ)</span>
              </div>

              {/* Quick Preset Chips */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-xs text-slate-500 font-medium">ઝડપી લક્ષ્યાંક:</span>
                {[25, 50, 75, 80, 85, 90, 95, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handleTargetChange(pct)}
                    className={`px-3 py-1 text-xs rounded-lg font-mono font-bold transition-colors cursor-pointer ${
                      selectedTarget === pct
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons: Start Filling, Stop Pump, Emergency Stop */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Start Filling Button */}
                <button
                  onClick={handleStartFilling}
                  disabled={!isUsbConnected || !hasValidSensorData || isPumpRunning || (tank.currentPercent !== null && tank.currentPercent >= selectedTarget)}
                  className={`px-4 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                    !isUsbConnected || !hasValidSensorData || isPumpRunning || (tank.currentPercent !== null && tank.currentPercent >= selectedTarget)
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
                      : (tank.currentPercent !== null && tank.currentPercent >= selectedTarget)
                      ? 'ટાંકી પહેલેથી જ લક્ષ્યાંક પર છે'
                      : `પાણી ભરો (TARGET:${selectedTarget} & START)`
                  }
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Filling (શરૂ કરો)</span>
                </button>

                {/* 2. Stop Pump Button */}
                <button
                  onClick={handleStopPump}
                  disabled={!isUsbConnected || !isPumpRunning}
                  className={`px-4 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                    !isUsbConnected || !isPumpRunning
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                      : 'bg-amber-600 hover:bg-amber-700 active:scale-95 text-white cursor-pointer shadow-amber-600/20'
                  }`}
                  title="મોટર પંપ તાત્કાલિક બંધ કરો (STOP)"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop Pump (બંધ કરો)</span>
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
                  title="તાત્કાલિક ઈમરજન્સી સ્ટોપ આદેશ મોકલો (STOP)"
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
                      ? 'સુરક્ષા નિયમ: પંપ શરૂ કરવા માટે પહેલા "Connect USB" પર ક્લિક કરીને Arduino Uno ને જોડો.'
                      : 'સુરક્ષા નિયમ: માન્ય અલ્ટ્રાસોનિક સેન્સર ડેટા મળ્યા પછી જ પંપ શરૂ કરવાની મંજૂરી મળશે.'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Autonomous Safety & Hardware Protection Notice */}
          <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-3xl p-5 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>હાર્ડવેર સેફ્ટી & ઓટો-કટઓફ સિદ્ધાંત</span>
            </div>
            <ul className="text-xs text-amber-900/90 dark:text-amber-200/90 space-y-1 list-disc list-inside leading-relaxed pl-1">
              <li>
                <strong>સ્વતંત્ર ઓટો-કટઓફ:</strong> બ્રાઉઝર હેંગ થાય કે USB કેબલ ડિસ્કનેક્ટ થાય તો પણ Arduino Uno ફર્મવેર જાતે જ લક્ષ્યાંક ({selectedTarget}%) પર પંપ બંધ કરશે.
              </li>
              <li>
                <strong>ક્રિટિકલ ઓવરફ્લો સંરક્ષણ:</strong> ટાંકી ૯૭% કે તેથી વધુ ભરાતા માઇક્રોકંટ્રોલર સ્વતંત્ર રીતે મોટર બંધ કરીને બઝર એલાર્મ વગાડશે.
              </li>
              <li>
                <strong>પાવર સેફ્ટી:</strong> પંપ મોટરને ક્યારેય Arduino ના 5V અથવા USB પિનથી ચલાવશો નહીં. સ્વતંત્ર 12V DC/230V AC સપ્લાય રિલે મારફત જ જોડવો.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Calibration Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-sky-500" />
                <span>ટાંકી કેલિબ્રેશન અને એલર્ટ થ્રેશોલ્ડ</span>
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    ખાલી અંતર (Empty Distance - 0%):
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.01"
                      value={emptyDist}
                      onChange={(e) => setEmptyDist(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold"
                    />
                    <span className="text-slate-500">cm</span>
                  </div>
                  <span className="text-[10px] text-slate-400">ડીફોલ્ટ: 13.26 cm</span>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    પૂર્ણ અંતર (Full Distance - 100%):
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.01"
                      value={fullDist}
                      onChange={(e) => setFullDist(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold"
                    />
                    <span className="text-slate-500">cm</span>
                  </div>
                  <span className="text-[10px] text-slate-400">ડીફોલ્ટ: 2.40 cm</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    ઓછું પાણી:
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={lowWaterPct}
                      onChange={(e) => setLowWaterPct(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                    />
                    <span>%</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    નિયર-ફુલ ચેતવણી:
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={nearFullPct}
                      onChange={(e) => setNearFullPct(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                    />
                    <span>%</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    ક્રિટિકલ કટઓફ:
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={criticalPct}
                      onChange={(e) => setCriticalPct(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-rose-600"
                    />
                    <span>%</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  રદ કરો
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold flex items-center gap-2 shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>સેવ કરો</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

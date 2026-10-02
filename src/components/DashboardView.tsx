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
  Eye,
  EyeOff,
  Zap,
  ToggleLeft,
  ToggleRight,
  Cpu,
  Terminal,
} from 'lucide-react';
import {
  requestScreenWakeLock,
  releaseScreenWakeLock,
  triggerHaptic,
} from '../utils/androidOptimizations';
import { BaudRateSelector } from './BaudRateSelector';
import { SerialMonitorModal } from './SerialMonitorModal';

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
  usbBaudRate?: number;
  onSelectBaudRate?: (rate: number) => void;
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
  onEnableAutoMode?: (targetPercent: number) => Promise<boolean>;
  onDisableAutoMode?: () => Promise<boolean>;
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
  usbBaudRate = 9600,
  onSelectBaudRate,
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
  const { tank, hardwareStatus, calibration } = state;
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSerialMonitor, setShowSerialMonitor] = useState(false);
  // Target filling percentage: strictly 20% to 90% (never above 90%)
  const [selectedTarget, setSelectedTarget] = useState<number>(() => {
    const initial = tank.targetPercent || 75;
    return Math.max(20, Math.min(90, Math.round(initial / 5) * 5));
  });
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Sync selectedTarget if Arduino reports an updated target within 20% to 90%
  React.useEffect(() => {
    if (usbTelemetry?.targetPercent && usbTelemetry.targetPercent >= 20 && usbTelemetry.targetPercent <= 90) {
      setSelectedTarget(usbTelemetry.targetPercent);
    }
  }, [usbTelemetry?.targetPercent]);

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

  // Operating Mode directly confirmed by Arduino telemetry ('AUTO' | 'MANUAL')
  const operatingMode = usbTelemetry?.operatingMode || tank.operatingMode || 'MANUAL';
  const isAutoModeActive = operatingMode === 'AUTO';

  // Android Screen Wake Lock state (keeps screen awake while filling or observing)
  const [keepAwake, setKeepAwake] = useState<boolean>(false);

  React.useEffect(() => {
    if (keepAwake || isPumpRunning) {
      requestScreenWakeLock();
    } else {
      releaseScreenWakeLock();
    }
    return () => {
      releaseScreenWakeLock();
    };
  }, [keepAwake, isPumpRunning]);

  const toggleKeepAwake = async () => {
    triggerHaptic('tap');
    if (keepAwake) {
      await releaseScreenWakeLock();
      setKeepAwake(false);
    } else {
      const ok = await requestScreenWakeLock();
      setKeepAwake(ok);
    }
  };

  const handleTargetChange = (val: number) => {
    triggerHaptic('tap');
    // Enforce strict 20% to 90% range - never send above 90%
    const clamped = Math.max(20, Math.min(90, Math.round(val / 5) * 5));
    setSelectedTarget(clamped);
    if (onSetUsbTarget && isUsbConnected) {
      onSetUsbTarget(clamped);
    }
  };

  const handleToggleAutoMode = async () => {
    triggerHaptic('tap');
    setActionFeedback(null);
    if (!isUsbConnected) {
      setActionFeedback('કંટ્રોલર (USB/Bluetooth) જોડાયેલ નથી. ઓટો મોડ સક્રિય કરવા માટે પહેલા કનેક્ટ કરો.');
      return;
    }
    if (!hasValidSensorData) {
      setActionFeedback('માન્ય સેન્સર રીડિંગ મળ્યું નથી. સેન્સર ફીડબેક વગર ઓટો મોડ સક્રિય કરી શકાતો નથી.');
      return;
    }
    if (isAutoModeActive) {
      if (onDisableAutoMode) {
        const ok = await onDisableAutoMode();
        if (ok) {
          setActionFeedback('ઓટો મોડ બંધ: સિસ્ટમ હવે MANUAL મોડમાં છે (MODE:MANUAL મોકલ્યો).');
        }
      }
    } else {
      if (onEnableAutoMode) {
        const ok = await onEnableAutoMode(selectedTarget);
        if (ok) {
          setActionFeedback(`ઓટો મોડ સક્રિય: TARGET:${selectedTarget} & MODE:AUTO મોકલ્યો. પાણી <= 15% થતાં પંપ આપમેળે શરૂ થશે અને ${selectedTarget}% પર બંધ થશે.`);
        }
      }
    }
  };

  const handleStartFilling = async () => {
    triggerHaptic('start');
    setActionFeedback(null);
    if (!isUsbConnected) {
      setActionFeedback('કંટ્રોલર (USB/Bluetooth) જોડાયેલ નથી. કૃપા કરીને પહેલા "Connect USB" પર ક્લિક કરો.');
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
    if (selectedTarget > 90) {
      setActionFeedback('સુરક્ષા મર્યાદા: લક્ષ્યાંક ૯૦% થી વધુ સેટ કરી શકાતો નથી.');
      return;
    }
    if (onStartFilling) {
      const ok = await onStartFilling(selectedTarget);
      if (ok) {
        setActionFeedback(`મેન્યુઅલ મોડ: TARGET:${selectedTarget} -> MODE:MANUAL -> START મોકલ્યો. Arduino Uno પંપ શરૂ કરી ${selectedTarget}% પર આપમેળે બંધ કરશે.`);
      }
    }
  };

  const handleStopPump = async () => {
    triggerHaptic('stop');
    setActionFeedback(null);
    if (onStopPump) {
      await onStopPump();
      setActionFeedback('પંપ તાત્કાલિક બંધ કરવામાં આવ્યો છે (STOP આદેશ મોકલ્યો).');
    }
  };

  const handleEmergencyStop = async () => {
    triggerHaptic('emergency');
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
        emptyDistanceCm: parseFloat(emptyDist) || 11.32,
        fullDistanceCm: parseFloat(fullDist) || 2.37,
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
                      : `Arduino Uno USB Connected (${usbBaudRate || 9600} Baud)`}
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
              શ્રી સરકારી માધ્યમિક અને ઉચ્ચ. માધ્યમિક શાળા–લાખાપર · સ્માર્ટ વોટર ટેન્ક મોનિટરિંગ અને કંટ્રોલ સિસ્ટમ
            </p>
          </div>

          {/* Action Buttons: Connect USB, Connect Bluetooth, Refresh, and Settings */}
          <div className="flex items-center flex-wrap gap-2.5">
            {!isUsbConnected ? (
              <>
                {onSelectBaudRate && (
                  <BaudRateSelector
                    value={usbBaudRate || 9600}
                    onChange={onSelectBaudRate}
                    disabled={isSubmitting}
                    label="USB Baud:"
                  />
                )}
                <button
                  onClick={onConnectUsb}
                  disabled={!isUsbSupported || isSubmitting}
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all transform active:scale-95 cursor-pointer"
                  title={`Arduino Uno USB સીરીયલ પોર્ટ સાથે જોડાઓ (${usbBaudRate || 9600} Baud)`}
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

            {/* Screen Wake Lock Button (Android Display & Screen Awake Optimizer) */}
            <button
              onClick={toggleKeepAwake}
              className={`px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                keepAwake || isPumpRunning
                  ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
              }`}
              title="Android પર સ્ક્રીન સતત ચાલુ રાખો (Screen Wake Lock)"
            >
              {keepAwake || isPumpRunning ? (
                <Eye className="w-4 h-4 text-amber-600 animate-pulse" />
              ) : (
                <EyeOff className="w-4 h-4 text-slate-400" />
              )}
              <span className="hidden sm:inline">
                {keepAwake || isPumpRunning ? 'સ્ક્રીન Awake' : 'સ્ક્રીન સ્લીપ'}
              </span>
              <span className="sm:hidden">Awake</span>
            </button>

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
              onClick={() => {
                triggerHaptic('tap');
                setShowSerialMonitor(true);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="લાઈવ સીરીયલ મોનિટર અને રો-ડેટા કન્સોલ ખોલો"
            >
              <Terminal className="w-4 h-4 text-sky-500" />
              <span>Serial Monitor</span>
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

      {/* Android Mobile USB-OTG & Bluetooth Helper Card */}
      {isAndroid && !isUsbConnected && (
        <div className="bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 dark:from-sky-950/40 dark:via-blue-950/40 dark:to-indigo-950/40 border border-sky-200 dark:border-sky-800/80 rounded-2xl p-4 text-xs space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 font-bold text-sky-900 dark:text-sky-200">
              <Smartphone className="w-4 h-4 text-sky-600" />
              <span>Android સ્માર્ટફોન કનેક્શન સહાયક (OTG & Bluetooth):</span>
            </div>
            <span className="text-[11px] text-sky-700 dark:text-sky-300 font-medium">
              {usbBaudRate || 9600} Baud USB (ડીફોલ્ટ 9600) / 9600 Baud HC-05
            </span>
          </div>
          <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
            તમારા Android ફોનમાં Type-C to USB-A OTG એડેપ્ટર જોડી <strong>Connect USB</strong> પર ટેપ કરો. જો કનેક્ટ ન થાય, તો ફોનના <span className="font-semibold text-slate-800 dark:text-slate-200">Settings &gt; Additional Settings &gt; OTG Connection</span> ચાલુ કરો.
          </p>
          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            <button
              onClick={() => {
                triggerHaptic('tap');
                onConnectUsb?.();
              }}
              disabled={!isUsbSupported || isSubmitting}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer min-h-[44px]"
            >
              <Cable className="w-3.5 h-3.5" />
              <span>Connect USB ({usbBaudRate || 9600} Baud)</span>
            </button>
            <button
              onClick={() => {
                triggerHaptic('tap');
                onConnectBluetooth?.();
              }}
              disabled={!isUsbSupported || isSubmitting}
              className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer min-h-[44px]"
            >
              <Bluetooth className="w-3.5 h-3.5" />
              <span>Connect Bluetooth</span>
            </button>
            {onOpenAndroidGuide && (
              <button
                onClick={() => {
                  triggerHaptic('tap');
                  onOpenAndroidGuide();
                }}
                className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
              >
                <span>વિગતવાર માર્ગદર્શિકા ↗</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Serial Monitor Troubleshooting Guide Card */}
      {!isUsbConnected && (
        <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 text-xs space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
              <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Arduino IDE Serial Monitor માં લેવલ દેખાય છે પણ એપમાં કેમ નથી દેખાતું?</span>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('tap');
                setShowSerialMonitor(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
            >
              <Terminal className="w-3 h-3" />
              <span>લાઈવ Serial Monitor ખોલો</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-[11px] text-slate-700 dark:text-slate-300">
            <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-amber-200/70 dark:border-amber-900/40 space-y-1">
              <span className="font-bold text-amber-800 dark:text-amber-300 block">૧. Arduino IDE Serial Monitor બંધ કરો</span>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                કમ્પ્યુટરમાં USB/COM પોર્ટ ફક્ત ૧ સોફ્ટવેરમાં એક સમયે ચાલે છે. જો Arduino IDE નું Serial Monitor ચાલુ હશે તો બ્રાઉઝર પોર્ટ ઓપન નહીં કરી શકે. પહેલા તે વિન્ડો બંધ કરો.
              </p>
            </div>
            <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-amber-200/70 dark:border-amber-900/40 space-y-1">
              <span className="font-bold text-amber-800 dark:text-amber-300 block">૨. Connect USB ({usbBaudRate || 9600}) ક્લિક કરો</span>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Arduino IDE Serial Monitor બંધ કર્યા પછી, આ એપમાં <strong>Connect USB</strong> બટન દબાવો અને તમારા Arduino Uno નો COM પોર્ટ પસંદ કરો (Baud દર: ૯૬૦૦).
              </p>
            </div>
            <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-amber-200/70 dark:border-amber-900/40 space-y-1">
              <span className="font-bold text-amber-800 dark:text-amber-300 block">૩. ડેટા ફોર્મેટ &amp; Serial.println</span>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                એપ <code className="text-sky-600 dark:text-sky-400 font-mono">LEVEL:45.0...</code> તેમજ <code className="text-sky-600 dark:text-sky-400 font-mono">Level: 45%</code> કે ફક્ત <code className="text-sky-600 dark:text-sky-400 font-mono">45%</code> જેવા તમામ સામાન્ય ફોર્મેટને આપોઆપ પારખી લે છે. દરેક રીડિંગમાં <code className="font-mono">Serial.println()</code> જરૂરી છે.
              </p>
            </div>
          </div>
        </div>
      )}

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
            <div className="pt-1.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('tap');
                  setShowSerialMonitor(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Terminal className="w-3.5 h-3.5 text-sky-400" />
                <span>લાઈવ સીરીયલ મોનિટર ખોલો</span>
              </button>
            </div>
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
            કેબલ કનેક્શન અને {usbBaudRate || 9600} Baud દર તપાસો
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Left Column: Animated Tank Graphic (lg:col-span-5) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-3.5 sm:p-6 shadow-md flex flex-col items-center justify-center">
          <TankGraphic
            tank={tank}
            calibration={calibration}
            hardwareStatus={hardwareStatus}
            lastUpdatedText={formatLastUpdate(tank.lastReadingTime)}
          />
        </div>

        {/* Right Column: Water-Level Control & Live Metrics (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-5 sm:space-y-6">
          {/* Key Measurement Indicators: Live Telemetry & System Diagnostics */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-sky-500" />
                <span>વાસ્તવિક લાઈવ ડેશબોર્ડ (Live Arduino Telemetry)</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('tap');
                    setShowSerialMonitor(true);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                  title="Arduino માંથી આવતો રો-ડેટા (Raw Serial Data) જુઓ"
                >
                  <Terminal className="w-3.5 h-3.5 text-sky-500" />
                  <span className="hidden sm:inline">સીરીયલ મોનિટર</span>
                  <span className="sm:hidden">મોનિટર</span>
                </button>
                <span className="text-[11px] sm:text-xs font-mono text-slate-500 dark:text-slate-400">
                  {isUsbConnected
                    ? serialMode === 'BLUETOOTH'
                      ? 'HC-05 BT (9600 Baud)'
                      : `USB Serial (${usbBaudRate || 9600} Baud)`
                    : 'ઓફલાઇન'}
                </span>
                <span className={`w-2 h-2 rounded-full ${isUsbConnected ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
              </div>
            </div>

            {/* 6 Key Telemetry Cards: Level, Distance, Target, Pump ON/OFF, Mode, Connection & Error */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2.5 sm:gap-3">
              {/* 1. Actual Measured Water Level */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/50">
                <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                  ૧. પાણીનું સ્તર (Water Level)
                </span>
                <div className="text-xl sm:text-3xl font-extrabold text-sky-900 dark:text-sky-100 mt-1 font-sans">
                  {tank.currentPercent !== null ? `${tank.currentPercent}%` : '--'}
                </div>
                <div className="text-[10px] text-sky-700 dark:text-sky-300 mt-1 truncate">
                  {tank.currentLiters !== null ? `${tank.currentLiters} L / ૧૦૦૦ L` : 'વાસ્તવિક ડેટા પ્રતિક્ષામાં'}
                </div>
              </div>

              {/* 2. Tank Water Level Status */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                  ૨. ટાંકી સ્થિતિ (Status)
                </span>
                <div className="text-base sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-1.5">
                  {tank.currentPercent === null ? (
                    '--'
                  ) : tank.currentPercent >= 90 ? (
                    <span className="text-amber-600 dark:text-amber-400">મહત્તમ સ્તર (Full)</span>
                  ) : tank.currentPercent <= 15 ? (
                    <span className="text-rose-600 dark:text-rose-400">ઓછું સ્તર (Low)</span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">સામાન્ય સ્તર (Normal)</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {tank.currentPercent !== null ? `ઓટો-કટઓફ માર્જિન: ${Math.max(0, selectedTarget - 2)}%` : 'સેન્સર પ્રતિક્ષામાં'}
                </div>
              </div>

              {/* 3. Selected Target Water Level */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50">
                <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                  ૩. લક્ષ્યાંક સ્તર (Selected Target)
                </span>
                <div className="text-xl sm:text-3xl font-extrabold text-indigo-900 dark:text-indigo-100 mt-1 font-mono">
                  {selectedTarget}%
                </div>
                <div className="text-[10px] text-indigo-700 dark:text-indigo-300 mt-1 font-medium">
                  ચક્ર મહત્તમ મર્યાદા (Max 90%)
                </div>
              </div>

              {/* 4. Physical Pump Status (Verified strictly against Arduino responses) */}
              <div className={`p-3 sm:p-3.5 rounded-2xl border transition-colors ${
                isPumpRunning
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
              }`}>
                <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                  ૪. પંપ સ્થિતિ (Pump Status)
                </span>
                <div className={`text-base sm:text-2xl font-extrabold mt-1 flex items-center gap-1.5 ${
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
                  {isPumpRunning ? 'Arduino પુષ્ટિ: રિલે Pin D7 સક્રિય' : 'Arduino પુષ્ટિ: પંપ બંધ છે'}
                </div>
              </div>

              {/* 5. Operating Mode (Direct from Arduino: AUTO or MANUAL) */}
              <div className={`p-3 sm:p-3.5 rounded-2xl border transition-colors ${
                isAutoModeActive
                  ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-800'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
              }`}>
                <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                  ૫. ઓપરેટિંગ મોડ (Operating Mode)
                </span>
                <div className={`text-base sm:text-2xl font-extrabold mt-1 flex items-center gap-1.5 ${
                  isAutoModeActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'
                }`}>
                  {isAutoModeActive ? (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                      <span>AUTO MODE</span>
                    </>
                  ) : (
                    <span>MANUAL MODE</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {isAutoModeActive ? 'ઓટો સાયકલ: <=15% પર શરૂ' : 'મેન્યુઅલ કંટ્રોલ સક્રિય'}
                </div>
              </div>

              {/* 6. Connection & Sensor Diagnostics */}
              <div className={`p-3 sm:p-3.5 rounded-2xl border transition-colors ${
                (usbTelemetry?.sensorError || tank.sensorError)
                  ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800'
                  : isUsbConnected
                  ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
                  : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50'
              }`}>
                <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                  ૬. સેન્સર / કનેક્શન સ્થિતિ
                </span>
                <div className={`text-sm sm:text-lg font-bold mt-1 truncate ${
                  (usbTelemetry?.sensorError || tank.sensorError)
                    ? 'text-rose-600 dark:text-rose-400 font-mono'
                    : isUsbConnected
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {(usbTelemetry?.sensorError || tank.sensorError)
                    ? `ખામી: ${usbTelemetry?.sensorError || tank.sensorError}`
                    : isUsbConnected
                    ? 'સામાન્ય (OK - ખામી નથી)'
                    : 'ડિસ્કનેક્ટેડ'}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {formatLastUpdate(tank.lastReadingTime)}
                </div>
              </div>
            </div>

            {/* Sensor Error Alert Banner if Sensor Error Present */}
            {(usbTelemetry?.sensorError || tank.sensorError) && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>સેન્સર ચેતવણી:</strong> Arduino એ <strong>{usbTelemetry?.sensorError || tank.sensorError}</strong> રિપોર્ટ કર્યું છે. સલામતી ખાતર પંપ બંધ કરવામાં આવ્યો છે અને ઓટો મોડ પોઝ થયો છે.
                </span>
              </div>
            )}
          </div>

          {/* Automatic Mode Toggle Station */}
          <div className={`border rounded-3xl p-4 sm:p-6 shadow-sm transition-all ${
            isAutoModeActive
              ? 'bg-linear-to-r from-blue-50/90 via-sky-50/90 to-indigo-50/90 dark:from-blue-950/40 dark:via-sky-950/40 dark:to-indigo-950/40 border-blue-300 dark:border-blue-700'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    ઓટોમેટિક મોડ (AUTOMATIC MODE TOGGLE)
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    isAutoModeActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {isAutoModeActive ? 'AUTO MODE: ON (સક્રિય)' : 'AUTO MODE: OFF (બંધ)'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  જ્યારે સક્રિય હોય, ત્યારે Arduino Uno ને <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400">TARGET:{selectedTarget}</code> અને <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400">MODE:AUTO</code> મોકલવામાં આવે છે.
                </p>
              </div>

              {/* Clearly Visible AUTO MODE Toggle Switch Button */}
              <button
                onClick={handleToggleAutoMode}
                disabled={!isUsbConnected}
                className={`flex items-center justify-center gap-3 px-5 py-3 rounded-2xl font-bold text-sm transition-all transform active:scale-95 cursor-pointer shadow-sm ${
                  !isUsbConnected
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    : isAutoModeActive
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 ring-2 ring-blue-400/50'
                    : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                }`}
                title={
                  !isUsbConnected
                    ? 'ઓટો મોડ માટે પહેલા કંટ્રોલર કનેક્ટ કરો'
                    : isAutoModeActive
                    ? 'ઓટો મોડ બંધ કરો (Switch to MANUAL)'
                    : 'ઓટો મોડ ચાલુ કરો (Enable AUTO MODE)'
                }
              >
                {isAutoModeActive ? (
                  <>
                    <ToggleRight className="w-6 h-6 text-white" />
                    <span>ઓટો મોડ ચાલુ (ACTIVE)</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-6 h-6 text-slate-400" />
                    <span>ઓટો મોડ બંધ (INACTIVE)</span>
                  </>
                )}
              </button>
            </div>

            {/* Auto Mode Cycle Rule Card */}
            <div className="mt-3.5 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="font-bold text-blue-700 dark:text-blue-300 shrink-0">સાયકલ નિયમ:</span>
                <span>
                  પાણીનું સ્તર <strong>૧૫% કે તેથી નીચે</strong> પહોંચતાં જ Arduino Uno આપમેળે પંપ શરૂ કરશે, અને પસંદ કરેલા ટાર્ગેટ (<strong>{selectedTarget}%</strong>) પર પહોંચતાં આપમેળે બંધ કરશે. જો પાણી પાછળથી ફરી ૧૫% કે તેથી નીચે જશે, તો સાયકલ પુનરાવર્તિત થશે.
                </span>
              </div>
              <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                <span className="font-bold shrink-0">સુરક્ષા નિયમ:</span>
                <span>
                  મેન્યુઅલ STOP આદેશ અથવા સેન્સર ખામી બાદ, જ્યાં સુધી તમે સ્પષ્ટપણે અહીંથી ફરી ઓટો મોડ સક્રિય ન કરો ત્યાં સુધી પંપ આપમેળે પુનઃ શરૂ થશે નહીં.
                </span>
              </div>
            </div>
          </div>

          {/* Water-Level Control Station: 20% to 90% Target Slider & Action Buttons */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                  <span>વોટર-લેવલ ટાર્ગેટ સ્લાઈડર (Water Target Slider: 20% to 90%)</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                  પસંદ કરેલ લક્ષ્યાંક એ તે ફિલિંગ સાયકલ માટેનું મહત્તમ માન્ય સ્તર છે. સિસ્ટમ ક્યારેય ૯૦% થી વધુ ટાર્ગેટ મોકલતી નથી.
                </p>
              </div>

              {/* Prominent Target Percentage Display */}
              <div className="text-right">
                <div className="text-2xl sm:text-4xl font-extrabold text-sky-600 dark:text-sky-400 font-mono tabular-nums">
                  {selectedTarget}%
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  ચક્ર મહત્તમ: {selectedTarget}%
                </div>
              </div>
            </div>

            {/* Target Level Slider (Strictly 20% to 90%, 5% increments) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-medium">
                <span>લક્ષ્યાંક સ્તર સિલેક્ટર (20% - 90% Range):</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {selectedTarget}% (મહત્તમ માન્ય મર્યાદા: 90%)
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleTargetChange(selectedTarget - 5)}
                  disabled={selectedTarget <= 20}
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
                  value={selectedTarget}
                  onChange={(e) => handleTargetChange(parseInt(e.target.value, 10))}
                  className="flex-1 h-3 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-600 dark:accent-sky-400 py-1"
                />

                <button
                  onClick={() => handleTargetChange(selectedTarget + 5)}
                  disabled={selectedTarget >= 90}
                  className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-colors active:scale-95 shrink-0"
                  title="5% વધારો (મહત્તમ 90%)"
                >
                  +5%
                </button>
              </div>

              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>૨૦%</span>
                <span>૩૫%</span>
                <span>૫૦%</span>
                <span>૬૫%</span>
                <span>૮૦%</span>
                <span>૯૦% (Max)</span>
              </div>

              {/* Quick Preset Chips within 20% to 90% */}
              <div className="flex items-center gap-1.5 sm:gap-2 pt-1 flex-wrap">
                <span className="text-xs text-slate-500 font-medium">ઝડપી લક્ષ્યાંક:</span>
                {[20, 30, 40, 50, 60, 70, 75, 80, 85, 90].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handleTargetChange(pct)}
                    className={`px-2.5 sm:px-3 py-1.5 text-xs rounded-lg font-mono font-bold transition-all cursor-pointer active:scale-95 min-h-[36px] flex items-center justify-center ${
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

            {/* Action Buttons: START PUMP, STOP PUMP, EMERGENCY STOP */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. START PUMP Button: sends TARGET:xx -> MODE:MANUAL -> START */}
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
                      ? 'કંટ્રોલર જોડાયેલ નથી'
                      : !hasValidSensorData
                      ? 'સેન્સર રીડિંગ ઉપલબ્ધ નથી'
                      : isPumpRunning
                      ? 'પંપ પહેલેથી ચાલુ છે'
                      : (tank.currentPercent !== null && tank.currentPercent >= selectedTarget)
                      ? 'ટાંકી પહેલેથી જ લક્ષ્યાંક પર છે'
                      : `START PUMP (TARGET:${selectedTarget} -> MODE:MANUAL -> START)`
                  }
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>START PUMP (શરૂ કરો)</span>
                </button>

                {/* 2. STOP PUMP Button: sends STOP immediately */}
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
                      ? 'સુરક્ષા નિયમ: પંપ શરૂ કરવા માટે પહેલા "Connect USB" અથવા "Connect Bluetooth" પર ક્લિક કરીને Arduino Uno ને જોડો.'
                      : 'સુરક્ષા નિયમ: માન્ય અલ્ટ્રાસોનિક સેન્સર ડેટા મળ્યા પછી જ પંપ શરૂ કરવાની મંજૂરી મળશે.'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Autonomous Safety & Target Margin Display */}
          <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-3xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>હાર્ડવેર સેફ્ટી અને સેફ્ટી માર્જિન (Safety & Limits)</span>
              </div>
              <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-300">
                સેફ્ટી માર્જિન: {100 - selectedTarget}% બફર
              </span>
            </div>

            {/* Visual Safety Margin Bar */}
            <div className="space-y-1">
              <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 flex overflow-hidden">
                {/* 0-15% Auto-start zone */}
                <div className="h-full bg-amber-400" style={{ width: '15%' }} title="ઓટો-સ્ટાર્ટ ઝોન (<=15%)" />
                {/* 15% to Target filling zone */}
                <div className="h-full bg-sky-500" style={{ width: `${Math.max(0, selectedTarget - 15)}%` }} title={`ફિલિંગ ઝોન (${selectedTarget}%)`} />
                {/* Target to 90% available zone */}
                <div className="h-full bg-slate-300 dark:bg-slate-700" style={{ width: `${Math.max(0, 90 - selectedTarget)}%` }} title="અન્ય અનુમતિ રેન્જ" />
                {/* 90% to 97% Hardware Safety Buffer */}
                <div className="h-full bg-amber-500" style={{ width: '7%' }} title="સુરક્ષા માર્જિન બફર (90% to 97%)" />
                {/* 97% to 100% Critical Overflow Cutoff */}
                <div className="h-full bg-rose-600" style={{ width: '3%' }} title="ક્રિટિકલ ઓવરફ્લો કટઓફ (>=97%)" />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                <span>0% (ખાલી ટાંકી)</span>
                <span>15% (ઓટો-સ્ટાર્ટ)</span>
                <span>{selectedTarget}% (ટાર્ગેટ)</span>
                <span>90% (હાર્ડ લિમિટ)</span>
                <span>97% (ઓવરફ્લો કટઓફ)</span>
              </div>
            </div>

            <ul className="text-xs text-amber-900/90 dark:text-amber-200/90 space-y-1 list-disc list-inside leading-relaxed pl-1">
              <li>
                <strong>સ્વતંત્ર ઓટો-કટઓફ:</strong> બ્રાઉઝર બંધ હોય કે કેબલ અલગ થાય, Arduino Uno પોતે જ લક્ષ્યાંક (<strong>{selectedTarget}%</strong>) પર પંપ બંધ કરશે.
              </li>
              <li>
                <strong>૯૦% મહત્તમ હાર્ડ લિમિટ:</strong> એપ્લિકેશન અને ફર્મવેર બંને ૯૦% થી વધુ લક્ષ્યાંક ક્યારેય સ્વીકારતા નથી. {100 - selectedTarget}% ની સુરક્ષા ગાળો સતત રહે છે.
              </li>
              <li>
                <strong>ઓટો ૧૫% થ્રેશોલ્ડ:</strong> ઓટો મોડમાં પાણી ૧૫% કે તેથી નીચે જતાં આપમેળે ભરવાનું શરૂ થશે અને {selectedTarget}% પર બંધ થશે.
              </li>
              <li>
                <strong>સેન્સર ફોલ્ટ શટડાઉન:</strong> અલ્ટ્રાસોનિક સેન્સર ડિસ્કનેક્ટ થતાં અથવા ટાઈમઆઉટ થતાં Arduino તત્કાલ પંપ બંધ કરે છે.
              </li>
              <li>
                <strong>ક્રિટિકલ ઓવરફ્લો (૯૭%):</strong> ટાંકી ૯૭% કે તેથી વધુ ભરાતાં માઇક્રોકંટ્રોલર સ્વતંત્ર રીતે મોટર બંધ કરી સતત બઝર સાયરન વગાડશે.
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
                  <span className="text-[10px] text-slate-400">ડીફોલ્ટ: 11.32 cm</span>
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
                  <span className="text-[10px] text-slate-400">ડીફોલ્ટ: 2.37 cm</span>
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

      {/* Real-time Serial Monitor Console Modal */}
      <SerialMonitorModal
        isOpen={showSerialMonitor}
        onClose={() => setShowSerialMonitor(false)}
        usbStatus={usbStatus}
        usbBaudRate={usbBaudRate || 9600}
        onSelectBaudRate={onSelectBaudRate}
        onConnectUsb={onConnectUsb}
        onDisconnectUsb={onDisconnectUsb}
        usbTelemetry={usbTelemetry}
        usbError={usbError}
        isUsbSupported={isUsbSupported}
      />
    </div>
  );
};

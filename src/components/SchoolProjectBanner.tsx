import React from 'react';
import { ShieldCheck, ChevronRight, Cable, Bluetooth, Smartphone, AlertTriangle, AlertOctagon, ExternalLink } from 'lucide-react';
import { HardwareConnectionState } from '../types';
import { UsbConnectionStatus, SerialConnectionMode } from '../services/webSerial';
import { triggerHaptic } from '../utils/androidOptimizations';

interface SchoolProjectBannerProps {
  connectionState: HardwareConnectionState;
  isControllerConnected: boolean;
  onRetryConnection?: () => void;
  isCheckingConnection?: boolean;
  onOpenHardware: () => void;
  onOpenSafety: () => void;
  usbStatus?: UsbConnectionStatus;
  serialMode?: SerialConnectionMode;
  isAndroid?: boolean;
  onOpenAndroidGuide?: () => void;
  onConnectUsb?: () => void;
  onConnectBluetooth?: () => void;
  onDisconnectUsb?: () => void;
  usbError?: string | null;
  isPermissionsDisallowed?: boolean;
  isUsbSupported?: boolean;
  isSubmitting?: boolean;
}

export const SchoolProjectBanner: React.FC<SchoolProjectBannerProps> = ({
  isControllerConnected,
  onOpenHardware,
  onOpenSafety,
  usbStatus = 'DISCONNECTED',
  serialMode = 'USB',
  isAndroid = false,
  onOpenAndroidGuide,
  onConnectUsb,
  onConnectBluetooth,
  onDisconnectUsb,
  usbError = null,
  isPermissionsDisallowed = false,
  isUsbSupported = true,
  isSubmitting = false,
}) => {
  const isIframeOrBlocked =
    isPermissionsDisallowed ||
    (usbError &&
      (usbError.includes('iframe') ||
        usbError.includes('સુરક્ષા પ્રતિબંધ') ||
        usbError.includes('પોલિસી')));

  return (
    <div className={`border-b transition-colors px-3 sm:px-4 py-2 text-xs select-none ${
      isControllerConnected
        ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60'
        : 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200/90 dark:border-amber-900/60'
    }`}>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        {/* Left: Status Message & School Attribution */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Connection Status Chip */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-xs ${
              isControllerConnected
                ? serialMode === 'BLUETOOTH'
                  ? 'bg-blue-600'
                  : 'bg-emerald-600'
                : 'bg-amber-600'
            }`}
          >
            {isControllerConnected ? (
              serialMode === 'BLUETOOTH' ? (
                <>
                  <Bluetooth className="w-3.5 h-3.5 animate-pulse" />
                  <span>HC-05 Bluetooth Connected</span>
                </>
              ) : (
                <>
                  <Cable className="w-3.5 h-3.5 animate-pulse" />
                  <span>Arduino Uno USB Connected</span>
                </>
              )
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Controller Offline</span>
              </>
            )}
          </span>

          <span className="font-bold text-slate-900 dark:text-white hidden sm:inline">
            શ્રી સરકારી માધ્યમિક અને ઉચ્ચ. માધ્યમિક શાળા–લાખાપર
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700 hidden sm:inline">·</span>

          <span className="text-slate-700 dark:text-slate-300 text-[11px] sm:text-xs">
            {isControllerConnected ? (
              serialMode === 'BLUETOOTH' ? (
                'HC-05 SPP (9600 Baud) લાઈવ ટેલિમેટ્રી સક્રિય.'
              ) : (
                'Arduino Uno Web Serial (115200 Baud) લાઈવ ટેલિમેટ્રી સક્રિય.'
              )
            ) : usbError ? (
              <span className="text-rose-700 dark:text-rose-300 font-medium">{usbError}</span>
            ) : (
              'Arduino Uno (USB) અથવા HC-05 (Bluetooth) જોડો.'
            )}
          </span>
        </div>

        {/* Right: Action Buttons & Helpful Links */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {!isControllerConnected ? (
            <>
              {isIframeOrBlocked && typeof window !== 'undefined' && (
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                  title="એપને નવી ટેબમાં ખોલો જેથી વેબ સીરીયલ પોર્ટ ખૂલે"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Direct Tab ↗</span>
                </a>
              )}

              {onConnectUsb && (
                <button
                  onClick={() => {
                    triggerHaptic('tap');
                    onConnectUsb();
                  }}
                  disabled={!isUsbSupported || isSubmitting}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95 min-h-[36px]"
                  title="Arduino Uno USB સાથે જોડાઓ (115200 Baud)"
                >
                  <Cable className="w-3.5 h-3.5" />
                  <span>Connect USB</span>
                </button>
              )}

              {onConnectBluetooth && (
                <button
                  onClick={() => {
                    triggerHaptic('tap');
                    onConnectBluetooth();
                  }}
                  disabled={!isUsbSupported || isSubmitting}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95 min-h-[36px]"
                  title="HC-05 Bluetooth Virtual COM Port સાથે જોડાઓ (9600 Baud)"
                >
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>Connect Bluetooth</span>
                </button>
              )}

              {onOpenAndroidGuide && (
                <button
                  onClick={() => {
                    triggerHaptic('tap');
                    onOpenAndroidGuide();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer min-h-[36px]"
                  title="Android સ્માર્ટફોન પર HC-05 કનેક્ટ કરવાની મદદ"
                >
                  <Smartphone className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span className="hidden sm:inline">Android HC-05 મદદ</span>
                  <span className="sm:hidden">Android</span>
                </button>
              )}
            </>
          ) : (
            <>
              {onDisconnectUsb && (
                <button
                  onClick={() => {
                    triggerHaptic('tap');
                    onDisconnectUsb();
                  }}
                  disabled={isSubmitting}
                  className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
                >
                  <span>Disconnect</span>
                </button>
              )}
            </>
          )}

          {/* Quick shortcuts on laptop/desktop */}
          <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-300 dark:border-slate-700 text-xs">
            <button
              onClick={onOpenHardware}
              className="text-sky-700 dark:text-sky-400 hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
            >
              <span>વાયરિંગ & કોડ</span>
              <ChevronRight className="w-3 h-3" />
            </button>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">|</span>
            <button
              onClick={onOpenSafety}
              className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 font-medium cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>સેફ્ટી</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

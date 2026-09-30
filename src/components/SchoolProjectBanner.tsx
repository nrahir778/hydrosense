import React from 'react';
import { ShieldCheck, ChevronRight, Cable, Bluetooth, Smartphone, CheckCircle2 } from 'lucide-react';
import { HardwareConnectionState } from '../types';
import { UsbConnectionStatus, SerialConnectionMode } from '../services/webSerial';

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
}) => {
  return (
    <div className="bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 px-4 py-2 text-xs">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold text-white shadow-xs ${
            isControllerConnected
              ? serialMode === 'BLUETOOTH' ? 'bg-blue-600' : 'bg-emerald-600'
              : 'bg-slate-600'
          }`}>
            {serialMode === 'BLUETOOTH' ? <Bluetooth className="w-3.5 h-3.5" /> : <Cable className="w-3.5 h-3.5" />}
            {isControllerConnected
              ? serialMode === 'BLUETOOTH' ? 'HC-05 Bluetooth Connected' : 'Arduino Uno USB Connected'
              : 'Controller Offline'}
          </span>
          <span className="font-semibold text-slate-900 dark:text-white">
            શ્રી સરકારી માધ્યમિક અને ઉચ્ચ. માધ્યમિક શાળા–લાખાપર
          </span>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <span className="text-slate-600 dark:text-slate-300">
            {isControllerConnected
              ? serialMode === 'BLUETOOTH'
                ? 'HC-05 Bluetooth Virtual COM Port (9600 Baud) દ્વારા સીધો સંપર્ક સક્રિય છે.'
                : 'Arduino Uno સાથે Web Serial API (115200 Baud) દ્વારા સીધો USB સંપર્ક સક્રિય છે.'
              : 'વાસ્તવિક Arduino Uno / HC-05 હાર્ડવેર જોડાયેલ નથી. લાઈવ સેન્સર ડેટા માટે USB અથવા Bluetooth જોડો.'}
          </span>
          {!isControllerConnected && (
            <div className="inline-flex items-center gap-1.5 ml-1">
              {onConnectUsb && (
                <button
                  onClick={onConnectUsb}
                  className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                  title="Arduino Uno USB સાથે જોડાઓ (115200 Baud)"
                >
                  <Cable className="w-3 h-3" />
                  <span>Connect USB</span>
                </button>
              )}
              {onConnectBluetooth && (
                <button
                  onClick={onConnectBluetooth}
                  className="px-2.5 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                  title="HC-05 Bluetooth Virtual COM Port સાથે જોડાઓ (9600 Baud)"
                >
                  <Bluetooth className="w-3 h-3" />
                  <span>Connect Bluetooth</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {onOpenAndroidGuide && (
            <button
              onClick={onOpenAndroidGuide}
              className="text-xs text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              title="Android પર HC-05 બ્લૂટૂથ કનેક્ટ કરવાની રીત"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android HC-05</span>
            </button>
          )}
          {onOpenAndroidGuide && <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">|</span>}
          <button
            onClick={onOpenHardware}
            className="text-xs text-sky-700 dark:text-sky-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
          >
            Arduino Uno વાયરિંગ & ફર્મવેર કોડ
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">|</span>
          <button
            onClick={onOpenSafety}
            className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 font-medium cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            સેફ્ટી સિસ્ટમ
          </button>
        </div>
      </div>
    </div>
  );
};


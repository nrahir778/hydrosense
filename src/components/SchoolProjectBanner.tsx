import React from 'react';
import { ShieldCheck, ChevronRight, Cable, CheckCircle2 } from 'lucide-react';
import { HardwareConnectionState } from '../types';
import { UsbConnectionStatus } from '../services/webSerial';

interface SchoolProjectBannerProps {
  connectionState: HardwareConnectionState;
  isControllerConnected: boolean;
  onRetryConnection?: () => void;
  isCheckingConnection?: boolean;
  onOpenHardware: () => void;
  onOpenSafety: () => void;
  usbStatus?: UsbConnectionStatus;
  onConnectUsb?: () => void;
  onDisconnectUsb?: () => void;
}

export const SchoolProjectBanner: React.FC<SchoolProjectBannerProps> = ({
  isControllerConnected,
  onOpenHardware,
  onOpenSafety,
  usbStatus = 'DISCONNECTED',
  onConnectUsb,
  onDisconnectUsb,
}) => {
  return (
    <div className="bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 px-4 py-2 text-xs">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold text-white shadow-xs ${
            isControllerConnected ? 'bg-emerald-600' : 'bg-slate-600'
          }`}>
            <Cable className="w-3.5 h-3.5" />
            {isControllerConnected ? 'Arduino Uno USB Connected' : 'Arduino Uno USB Offline'}
          </span>
          <span className="font-semibold text-slate-900 dark:text-white">
            શ્રી સરકારી માધ્યમિક અને ઉચ્ચ. માધ્યમિક શાળા–લાખાપર
          </span>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <span className="text-slate-600 dark:text-slate-300">
            {isControllerConnected
              ? 'Arduino Uno સાથે Web Serial API (115200 Baud) દ્વારા સીધો USB સંપર્ક સક્રિય છે.'
              : 'વાસ્તવિક Arduino Uno હાર્ડવેર જોડાયેલ નથી. લાઈવ સેન્સર ડેટા અને કંટ્રોલ માટે USB કેબલ જોડો.'}
          </span>
          {!isControllerConnected && onConnectUsb && (
            <button
              onClick={onConnectUsb}
              className="ml-1 px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
            >
              <Cable className="w-3 h-3" />
              <span>Connect USB</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
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


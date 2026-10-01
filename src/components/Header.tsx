import React from 'react';
import { ShieldAlert, Sun, Moon, Cpu, GraduationCap, Sparkles, RotateCw, Cable, CheckCircle2, Power, Bluetooth, Smartphone } from 'lucide-react';
import { HardwareConnectionState } from '../types';
import { UsbConnectionStatus, SerialConnectionMode } from '../services/webSerial';
import { triggerHaptic } from '../utils/androidOptimizations';

export type ActiveTab = 'dashboard' | 'manual' | 'automation' | 'safety' | 'hardware' | 'ai';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  connectionState: HardwareConnectionState;
  isControllerConnected: boolean;
  onRetryConnection?: () => void;
  isCheckingConnection?: boolean;
  emergencyStop: boolean;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenSafety: () => void;
  usbStatus?: UsbConnectionStatus;
  serialMode?: SerialConnectionMode;
  onConnectUsb?: () => void;
  onConnectBluetooth?: () => void;
  onDisconnectUsb?: () => void;
  isUsbSupported?: boolean;
  isPermissionsDisallowed?: boolean;
  isAndroid?: boolean;
  onOpenAndroidGuide?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  connectionState,
  isControllerConnected,
  onRetryConnection,
  isCheckingConnection = false,
  emergencyStop,
  isDarkMode,
  onToggleTheme,
  onOpenSafety,
  usbStatus = 'DISCONNECTED',
  serialMode = 'USB',
  onConnectUsb,
  onConnectBluetooth,
  onDisconnectUsb,
  isUsbSupported = true,
  isPermissionsDisallowed = false,
  isAndroid = false,
  onOpenAndroidGuide,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-xs">
      {/* Top Banner: Big School Name Bar (વિદ્યાલય ગૌરવ પટ્ટી) */}
      <div className="bg-linear-to-r from-sky-700 via-blue-800 to-indigo-900 text-white py-2 px-4 shadow-inner">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-1.5 text-center md:text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/30 shadow-xs">
              <GraduationCap className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              {/* School Name in Big, Proud Font */}
              <h1 className="text-base sm:text-xl md:text-2xl font-extrabold tracking-wide drop-shadow-xs leading-tight font-sans">
                શ્રી સરકારી માધ્યમિક અને ઉચ્ચ. માધ્યમિક શાળા–લાખાપર
              </h1>
              <div className="text-[11px] sm:text-xs text-sky-200 font-medium">
                વિજ્ઞાન અને ટેકનોલોજી ઇનોવેશન પ્રોજેક્ટ · સ્માર્ટ વોટર મેનેજમેન્ટ સિસ્ટમ
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] sm:text-xs font-mono bg-white/10 px-3 py-1 rounded-full border border-white/20">
            <Cable className="w-3.5 h-3.5 text-emerald-300" />
            <span>Arduino Uno USB Serial (115200 Baud)</span>
          </div>
        </div>
      </div>

      {/* Main Navbar: Navigation and System Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Project Branding */}
        <button
          onClick={() => onSelectTab('dashboard')}
          className="text-left group flex items-center gap-2"
        >
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 dark:bg-sky-400/10 border border-sky-500/20 dark:border-sky-400/20 flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold text-sm tracking-tight font-mono">
            H₂O
          </div>
          <div className="flex flex-col">
            <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
              હાઈડ્રોસેન્સ IoT
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              Arduino Uno USB (૧૩.૨૬ / ૨.૪૦ cm)
            </span>
          </div>
        </button>

        {/* Navigation Tabs (Desktop) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`transition-colors py-1.5 ${
              activeTab === 'dashboard'
                ? 'text-sky-600 dark:text-sky-400 font-bold border-b-2 border-sky-500 dark:border-sky-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            ડેશબોર્ડ
          </button>
          <button
            onClick={() => onSelectTab('manual')}
            className={`transition-colors py-1.5 ${
              activeTab === 'manual'
                ? 'text-sky-600 dark:text-sky-400 font-bold border-b-2 border-sky-500 dark:border-sky-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            વોટર કંટ્રોલ & પંપ
          </button>
          <button
            onClick={() => onSelectTab('automation')}
            className={`transition-colors py-1.5 ${
              activeTab === 'automation'
                ? 'text-sky-600 dark:text-sky-400 font-bold border-b-2 border-sky-500 dark:border-sky-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            ઓટોમેશન
          </button>
          <button
            onClick={() => onSelectTab('ai')}
            className={`transition-colors py-1.5 flex items-center gap-1.5 ${
              activeTab === 'ai'
                ? 'text-sky-600 dark:text-sky-400 font-bold border-b-2 border-sky-500 dark:border-sky-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>AI વોઇસ & લર્નિંગ</span>
          </button>
          <button
            onClick={() => onSelectTab('safety')}
            className={`transition-colors py-1.5 flex items-center gap-1.5 ${
              activeTab === 'safety'
                ? 'text-sky-600 dark:text-sky-400 font-bold border-b-2 border-sky-500 dark:border-sky-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            સુરક્ષા અને લોગ્સ
            {emergencyStop && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>
          <button
            onClick={() => onSelectTab('hardware')}
            className={`transition-colors py-1.5 ${
              activeTab === 'hardware'
                ? 'text-sky-600 dark:text-sky-400 font-bold border-b-2 border-sky-500 dark:border-sky-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            હાર્ડવેર વાયરિંગ
          </button>
        </nav>

        {/* Primary Hardware Status & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick AI Voice Button */}
          <button
            onClick={() => onSelectTab('ai')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'ai'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-900/50'
            }`}
            title="AI વોઇસ આસિસ્ટન્ટ ખોલો"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">AI વોઇસ</span>
          </button>

          {/* Android Mobile HC-05 Helper Button */}
          {onOpenAndroidGuide && (
            <button
              onClick={onOpenAndroidGuide}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 dark:text-sky-300 dark:border-sky-900/50 cursor-pointer"
              title="Android પર HC-05 Bluetooth કનેક્શન માર્ગદર્શિકા"
            >
              <Smartphone className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span className="hidden md:inline">Android HC-05</span>
              <span className="md:hidden">Android</span>
            </button>
          )}

          {/* Serial Connection Status & Controls (USB & HC-05 Bluetooth) */}
          {usbStatus === 'CONNECTED' ? (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
              serialMode === 'BLUETOOTH'
                ? 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
            }`}>
              {serialMode === 'BLUETOOTH' ? (
                <Bluetooth className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              ) : (
                <Cable className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              )}
              <span className="hidden sm:inline">
                {serialMode === 'BLUETOOTH' ? 'Bluetooth HC-05 Connected' : 'USB Connected'}
              </span>
              <span className="sm:hidden">
                {serialMode === 'BLUETOOTH' ? 'BT On' : 'USB On'}
              </span>
              {onDisconnectUsb && (
                <button
                  onClick={() => {
                    triggerHaptic('tap');
                    onDisconnectUsb();
                  }}
                  className={`ml-1 px-2 py-1 rounded-md text-white text-[10px] font-bold cursor-pointer transition-colors active:scale-95 ${
                    serialMode === 'BLUETOOTH' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                  title={serialMode === 'BLUETOOTH' ? 'HC-05 Bluetooth ડિસ્કનેક્ટ કરો' : 'Arduino Uno USB ડિસ્કનેક્ટ કરો'}
                >
                  Disconnect
                </button>
              )}
            </div>
          ) : usbStatus === 'CONNECTING' ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold border bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
              <RotateCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
              <span>Connecting...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700">
              <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
              <span className="hidden sm:inline">Offline</span>
              {isPermissionsDisallowed && typeof window !== 'undefined' ? (
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 px-2.5 py-1 rounded-md bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                  title="એપને નવી ટેબમાં ખોલો જેથી બ્રાઉઝર સીરીયલ પોર્ટની પરવાનગી આપે"
                >
                  <span>Open Tab ↗</span>
                </a>
              ) : (
                <div className="flex items-center gap-1">
                  {onConnectUsb && (
                    <button
                      onClick={() => {
                        triggerHaptic('tap');
                        onConnectUsb();
                      }}
                      disabled={!isUsbSupported}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-xs active:scale-95 min-h-[36px]"
                      title="Arduino Uno USB સાથે જોડાઓ (115200 Baud)"
                    >
                      <Cable className="w-3.5 h-3.5" />
                      <span>USB</span>
                    </button>
                  )}
                  {onConnectBluetooth && (
                    <button
                      onClick={() => {
                        triggerHaptic('tap');
                        onConnectBluetooth();
                      }}
                      disabled={!isUsbSupported}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-xs active:scale-95 min-h-[36px]"
                      title="HC-05 Bluetooth Virtual COM Port સાથે જોડાઓ (9600 Baud)"
                    >
                      <Bluetooth className="w-3.5 h-3.5" />
                      <span>Bluetooth</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Quick E-Stop Action Trigger */}
          <button
            onClick={() => {
              triggerHaptic('alarm');
              onOpenSafety();
            }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 min-h-[36px] ${
              emergencyStop
                ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-600/30'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-900/50'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {emergencyStop ? 'ઈમરજન્સી સ્ટોપ સક્રિય!' : 'ઈમરજન્સી સ્ટોપ'}
            </span>
            <span className="sm:hidden">
              {emergencyStop ? 'E-STOP' : 'E-Stop'}
            </span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => {
              triggerHaptic('tap');
              onToggleTheme();
            }}
            aria-label="થીમ બદલો"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors active:scale-95 cursor-pointer"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};


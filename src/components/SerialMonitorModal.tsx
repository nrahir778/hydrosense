import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  X,
  Trash2,
  Send,
  AlertTriangle,
  Cable,
  CheckCircle2,
  RotateCw,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import { webSerial, UsbConnectionStatus, ArduinoTelemetry } from '../services/webSerial';
import { BaudRateSelector } from './BaudRateSelector';
import { triggerHaptic } from '../utils/androidOptimizations';

interface SerialMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  usbStatus: UsbConnectionStatus;
  usbBaudRate: number;
  onSelectBaudRate?: (rate: number) => void;
  onConnectUsb?: () => void;
  onDisconnectUsb?: () => void;
  usbTelemetry?: ArduinoTelemetry | null;
  usbError?: string | null;
  isUsbSupported?: boolean;
}

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'rx' | 'tx' | 'info' | 'error';
  text: string;
}

export const SerialMonitorModal: React.FC<SerialMonitorModalProps> = ({
  isOpen,
  onClose,
  usbStatus,
  usbBaudRate,
  onSelectBaudRate,
  onConnectUsb,
  onDisconnectUsb,
  usbTelemetry,
  usbError,
  isUsbSupported = true,
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [customCmd, setCustomCmd] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Subscribe to raw logs from WebSerialService
    const unsubscribe = webSerial.onLog((msg, type) => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
      setLogs((prev) => [
        ...prev.slice(-300), // Keep last 300 entries
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: timeStr,
          type,
          text: msg,
        },
      ]);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  useEffect(() => {
    if (autoScroll && consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  if (!isOpen) return null;

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCmd.trim()) return;
    triggerHaptic('tap');
    await webSerial.sendCommand(customCmd.trim());
    setCustomCmd('');
  };

  const handleClear = () => {
    triggerHaptic('tap');
    setLogs([]);
  };

  const handleCopyLogs = () => {
    triggerHaptic('tap');
    const text = logs.map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const isPortBusy =
    usbError &&
    (usbError.includes('Busy') ||
      usbError.includes('Serial Monitor') ||
      usbError.includes('લોક') ||
      usbError.includes('failed to open') ||
      usbError.includes('already open'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 dark:bg-sky-400/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>લાઈવ સીરીયલ મોનિટર (Serial Monitor)</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    usbStatus === 'CONNECTED'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : usbStatus === 'CONNECTING'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {usbStatus === 'CONNECTED' ? `CONNECTED (${usbBaudRate} Baud)` : usbStatus}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Arduino Uno માંથી આવતા લાઈવ રો-ડેટા (Raw Data) અને લેવલ ટેલિમેટ્રીનું રીઅલ-ટાઇમ નિરીક્ષણ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyLogs}
              disabled={logs.length === 0}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              title="લોગ કોપી કરો"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleClear}
              disabled={logs.length === 0}
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              title="કન્સોલ ક્લિયર કરો"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Arduino IDE Serial Monitor Conflict Alert */}
        <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">
                Serial Monitor માં લેવલ દેખાય છે પણ એપમાં કેમ નથી દેખાતું? (મુખ્ય કારણો અને ઉકેલ):
              </span>
              <p className="text-[11px] leading-relaxed">
                ૧. <strong>Arduino IDE નું Serial Monitor બંધ કરો:</strong> જો તમારા કમ્પ્યુટરમાં Arduino IDE નું Serial Monitor ખુલ્લું હશે, તો ઓપરેટિંગ સિસ્ટમ તે COM પોર્ટને લોક કરી દે છે, જેથી બ્રાઉઝર પોર્ટ ઓપન કરી શકતું નથી. બંને એક સાથે ચાલી શકતા નથી.
              </p>
              <p className="text-[11px] leading-relaxed">
                ૨. <strong>Connect USB પર ક્લિક કરો:</strong> Arduino IDE નું Serial Monitor વિન્ડો બંધ કર્યા પછી, આ એપમાં આપેલ <strong>Connect USB</strong> બટન દબાવીને તમારા બોર્ડનો COM પોર્ટ પસંદ કરો.
              </p>
              <p className="text-[11px] leading-relaxed">
                ૩. <strong>Baud Rate 9600 મેળવો:</strong> Arduino કોડમાં <code className="bg-amber-200/70 dark:bg-amber-900/70 px-1 py-0.5 rounded font-mono">Serial.begin(9600);</code> છે, એટલે એપમાં પણ <strong>9600 Baud</strong> પસંદ હોવું જોઈએ.
              </p>
              <p className="text-[11px] leading-relaxed">
                ૪. <strong>આઉટપુટ ફોર્મેટ:</strong> એપ હવે <code className="bg-amber-200/70 dark:bg-amber-950 px-1 py-0.5 rounded font-mono">LEVEL:45.0,DISTANCE:7.28...</code> ઉપરાંત <code className="bg-amber-200/70 dark:bg-amber-950 px-1 py-0.5 rounded font-mono">Level: 45%</code>, <code className="bg-amber-200/70 dark:bg-amber-950 px-1 py-0.5 rounded font-mono">Distance: 12 cm</code> કે ફક્ત <code className="bg-amber-200/70 dark:bg-amber-950 px-1 py-0.5 rounded font-mono">45%</code> જેવા તમામ સામાન્ય ફોર્મેટને આપોઆપ પારખી લે છે. દરેક રીડિંગ પછી <code className="bg-amber-200/70 dark:bg-amber-950 px-1 py-0.5 rounded font-mono">Serial.println(...)</code> હોવું જરૂરી છે.
              </p>
            </div>
          </div>
        </div>

        {/* Current Parsed Metrics Ribbon */}
        <div className="px-5 py-2.5 bg-slate-100/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-3 font-mono">
            <span>
              પાણી લેવલ:{' '}
              <strong className="text-sky-600 dark:text-sky-400 font-bold">
                {usbTelemetry?.levelPercent !== undefined ? `${usbTelemetry.levelPercent}%` : '--'}
              </strong>
            </span>
            <span>·</span>
            <span>
              અંતર:{' '}
              <strong className="text-slate-800 dark:text-slate-200 font-bold">
                {usbTelemetry?.distanceCm !== undefined ? `${usbTelemetry.distanceCm} cm` : '--'}
              </strong>
            </span>
            <span>·</span>
            <span>
              પંપ:{' '}
              <strong className={usbTelemetry?.pumpStatus === 'ON' ? 'text-emerald-500 font-bold' : 'text-slate-500'}>
                {usbTelemetry?.pumpStatus || 'OFF'}
              </strong>
            </span>
            <span>·</span>
            <span>
              મોડ: <strong className="text-blue-500">{usbTelemetry?.operatingMode || 'MANUAL'}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onSelectBaudRate && usbStatus !== 'CONNECTED' && (
              <BaudRateSelector
                compact
                value={usbBaudRate}
                onChange={onSelectBaudRate}
                disabled={!isUsbSupported}
              />
            )}
            {usbStatus !== 'CONNECTED' ? (
              <button
                onClick={onConnectUsb}
                disabled={!isUsbSupported}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
              >
                <Cable className="w-3.5 h-3.5" />
                <span>Connect USB ({usbBaudRate})</span>
              </button>
            ) : (
              <button
                onClick={onDisconnectUsb}
                className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer active:scale-95"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* Live Terminal Output Box */}
        <div className="flex-1 p-4 bg-slate-950 font-mono text-xs overflow-y-auto space-y-1.5 min-h-[260px] max-h-[400px]">
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12 space-y-2">
              <Terminal className="w-8 h-8 opacity-40 animate-pulse" />
              <p>કોઈ સીરીયલ ડેટા પ્રાપ્ત થયો નથી (Waiting for serial data)...</p>
              <p className="text-[11px] text-slate-600">
                Arduino Uno ને USB થી જોડો અને ઉપર "Connect USB" પર ક્લિક કરો.
              </p>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={`flex items-start gap-2 leading-relaxed ${
                  log.type === 'rx'
                    ? 'text-sky-300'
                    : log.type === 'tx'
                    ? 'text-emerald-400'
                    : log.type === 'error'
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}
              >
                <span className="text-slate-600 select-none shrink-0">[{log.timestamp}]</span>
                <span
                  className={`text-[10px] px-1 rounded-xs font-bold uppercase shrink-0 ${
                    log.type === 'rx'
                      ? 'bg-sky-950 text-sky-400 border border-sky-800'
                      : log.type === 'tx'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : log.type === 'error'
                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                      : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  {log.type}
                </span>
                <span className="break-all whitespace-pre-wrap">{log.text}</span>
              </div>
            ))
          )}
          <div ref={consoleBottomRef} />
        </div>

        {/* Footer: Quick Command Send & AutoScroll Toggle */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <form onSubmit={handleSendCommand} className="flex-1 flex items-center gap-2 w-full">
            <input
              type="text"
              value={customCmd}
              onChange={(e) => setCustomCmd(e.target.value)}
              placeholder="આદેશ મોકલો (દા.ત. STATUS, START, STOP, TARGET:80)..."
              disabled={usbStatus !== 'CONNECTED'}
              className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs text-slate-900 dark:text-slate-100 disabled:opacity-50 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
            <button
              type="submit"
              disabled={usbStatus !== 'CONNECTED' || !customCmd.trim()}
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>

          <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-sky-600 focus:ring-sky-500"
              />
              <span>Auto-scroll</span>
            </label>

            {/* Quick Command Chips */}
            <div className="hidden sm:flex items-center gap-1">
              <button
                type="button"
                onClick={() => webSerial.sendCommand('STATUS')}
                disabled={usbStatus !== 'CONNECTED'}
                className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-[10px] font-mono font-bold disabled:opacity-40"
              >
                STATUS
              </button>
              <button
                type="button"
                onClick={() => webSerial.sendCommand('STOP')}
                disabled={usbStatus !== 'CONNECTED'}
                className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-200 text-[10px] font-mono font-bold disabled:opacity-40"
              >
                STOP
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Bluetooth,
  Cable,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  AlertOctagon,
  Terminal,
  Radio,
  Laptop,
  Copy,
  Check,
} from 'lucide-react';
import { UsbConnectionStatus, SerialConnectionMode } from '../services/webSerial';

interface AndroidBluetoothModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectBluetooth?: () => void;
  onConnectBluetoothSerial?: () => void;
  onConnectBluetoothBridge?: (url: string) => void;
  onConnectUsb?: () => void;
  isIframeEmbedded?: boolean;
  usbError?: string | null;
  usbStatus?: UsbConnectionStatus;
  serialMode?: SerialConnectionMode;
  initialBridgeUrl?: string;
}

export const AndroidBluetoothModal: React.FC<AndroidBluetoothModalProps> = ({
  isOpen,
  onClose,
  onConnectBluetooth,
  onConnectBluetoothSerial,
  onConnectBluetoothBridge,
  onConnectUsb,
  isIframeEmbedded = false,
  usbError = null,
  usbStatus = 'DISCONNECTED',
  serialMode = 'BLUETOOTH',
  initialBridgeUrl = 'ws://localhost:8088',
}) => {
  const [bridgeUrl, setBridgeUrl] = useState<string>(initialBridgeUrl);
  const [activeTab, setActiveTab] = useState<'bridge' | 'serial' | 'otg'>('bridge');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCopyBridgeCommand = () => {
    navigator.clipboard?.writeText('python bluetooth_bridge.py');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleConnectBridge = () => {
    if (onConnectBluetoothBridge) {
      onConnectBluetoothBridge(bridgeUrl);
    } else if (onConnectBluetooth) {
      onConnectBluetooth();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="android-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400">
              <Bluetooth className="w-5 h-5" />
            </div>
            <div>
              <h3 id="android-modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>HC-05 Bluetooth (9600 Baud) કનેક્શન કેન્દ્ર</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Arduino Uno HC-05 Bluetooth Classic SPP મોડ્યુલ કનેક્શન અને બ્રિજ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            aria-label="બંધ કરો"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Error Display (if any) */}
        {usbError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 space-y-1.5 text-xs text-rose-900 dark:text-rose-200">
            <div className="flex items-center gap-1.5 font-bold text-rose-800 dark:text-rose-300">
              <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
              <span>હાલની કનેક્શન ભૂલ વિગત:</span>
            </div>
            <p className="leading-relaxed font-mono text-[11px] bg-rose-100/70 dark:bg-rose-900/40 p-2 rounded-xl border border-rose-200/50 dark:border-rose-800/50">
              {usbError}
            </p>
          </div>
        )}

        {/* Honest Technical Explanation: Why Serial Bluetooth Terminal works vs Web Browser */}
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>બ્રાઉઝર મર્યાદા અને સ્પષ્ટ ટેકનિકલ સત્ય (HC-05 SPP 9600 Baud):</span>
          </div>
          <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed text-[11px]">
            <strong>Serial Bluetooth Terminal કેમ ચાલે છે?</strong> Android ની નેટિવ એપ હોવાથી તે ઓપરેટિંગ સિસ્ટમના નેટિવ <strong>Bluetooth Classic RFCOMM SPP સોકેટ</strong> (UUID: <code className="font-mono text-[10px] bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">00001101-0000-1000-8000-00805f9b34fb</code>) નો ઉપયોગ કરે છે.
            <br />
            <strong>નેટલિફાય વેબ એપ કેમ સીધું નથી ચાલતું?</strong> વેબ બ્રાઉઝર્સનું Web Bluetooth API ફક્ત <em>BLE (Bluetooth Low Energy GATT)</em> ને સપોર્ટ કરે છે અને સુરક્ષા નિયમ મુજબ Classic RFCOMM ને બ્લોક કરે છે. નીચે આપેલ ત્રણ વ્યવહારુ અને સાચી પદ્ધતિઓમાંથી પસંદ કરો:
          </p>
        </div>

        {/* Iframe Notice */}
        {isIframeEmbedded && typeof window !== 'undefined' && (
          <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/50 space-y-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-sky-900 dark:text-sky-200">પ્રીવ્યુ આઇફ્રેમમાં પોર્ટ બ્લોક હોઈ શકે છે:</span>
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open in Tab ↗</span>
              </a>
            </div>
          </div>
        )}

        {/* Navigation Tabs for 3 Practical Connection Solutions */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('bridge')}
            className={`flex-1 py-2 px-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'bridge'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>૧. Bluetooth Bridge (Android & PC)</span>
          </button>
          <button
            onClick={() => setActiveTab('serial')}
            className={`flex-1 py-2 px-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'serial'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>૨. Laptop COM (9600)</span>
          </button>
          <button
            onClick={() => setActiveTab('otg')}
            className={`flex-1 py-2 px-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'otg'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Cable className="w-3.5 h-3.5" />
            <span>૩. USB-OTG (9600/115200)</span>
          </button>
        </div>

        {/* Tab 1: Bluetooth WebSocket Bridge */}
        {activeTab === 'bridge' && (
          <div className="space-y-3 text-xs animate-in fade-in duration-150">
            <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 space-y-2.5">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span>Bluetooth WebSocket Bridge (સૌથી શ્રેષ્ઠ વાયરલેસ ઉપાય):</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                આ રીતમાં એક હળવી સ્ક્રિપ્ટ (દા.ત. <code className="font-mono bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded">bluetooth_bridge.py</code>) તમારા લેપટોપ અથવા Android Termux માં ચાલે છે. તે HC-05 સાથે 9600 Baud SPP પર જોડાય છે અને Netlify વેબ એપ સાથે WebSocket વડે લાઈવ ટેલિમેટ્રી સાંકળે છે.
              </p>

              {/* Bridge URL Input */}
              <div className="space-y-1 pt-1">
                <label className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                  WebSocket Bridge URL:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={bridgeUrl}
                    onChange={(e) => setBridgeUrl(e.target.value)}
                    placeholder="ws://localhost:8088"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <button
                    onClick={handleConnectBridge}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer"
                  >
                    <span>Connect Bridge</span>
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  ડિફોલ્ટ: <code className="font-mono">ws://localhost:8088</code> (જો ફોન પર હોય તો લોકલ IP વાપરો, દા.ત. <code className="font-mono">ws://192.168.1.15:8088</code>)
                </span>
              </div>

              {/* Bridge Command Helper */}
              <div className="p-2.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span className="flex items-center gap-1">
                    <Terminal className="w-3 h-3 text-emerald-400" />
                    <span>Run bridge command:</span>
                  </span>
                  <button
                    onClick={handleCopyBridgeCommand}
                    className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="text-emerald-400 selection:bg-emerald-900">
                  python bluetooth_bridge.py
                </div>
                <div className="text-slate-400 text-[10px]">
                  (આ પ્રોજેક્ટ રૂટમાં <code className="text-slate-300">bluetooth_bridge.py</code> પહેલેથી તૈયાર ઉપલબ્ધ છે)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Laptop Paired Bluetooth COM Port */}
        {activeTab === 'serial' && (
          <div className="space-y-3 text-xs animate-in fade-in duration-150">
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/50 space-y-2.5">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                <span>લૅપટોપ Bluetooth Virtual COM Port (9600 Baud Web Serial):</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                Windows, macOS, અથવા Linux લેપટોપમાં જ્યારે તમે HC-05 ને બ્લૂટૂથ દ્વારા પેર (Pair) કરો છો, ત્યારે OS આપમેળે એક <strong>Virtual COM Port</strong> (દા.ત. Standard Serial over Bluetooth link COM4) બનાવે છે.
              </p>
              <div className="space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                <p>૧. લેપટોપના Settings &gt; Bluetooth માં જઈ <strong>HC-05</strong> પેર કરો (PIN: 1234).</p>
                <p>૨. નીચે આપેલ બટન દબાવી Chrome પોર્ટ સિલેક્ટરમાંથી HC-05 COM પોર્ટ પસંદ કરો.</p>
                <p>૩. એપ <strong>9600 Baud</strong> પર સીધો ડેટા મેળવશે.</p>
              </div>

              {onConnectBluetoothSerial && (
                <div className="pt-1">
                  <button
                    onClick={() => {
                      onClose();
                      onConnectBluetoothSerial();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Bluetooth className="w-4 h-4" />
                    <span>Connect Paired Bluetooth COM Port (9600 Baud)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: USB-OTG Direct Connection */}
        {activeTab === 'otg' && (
          <div className="space-y-3 text-xs animate-in fade-in duration-150">
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/50 space-y-2.5">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>USB-OTG કેબલ વડે જોડાણ (Android & Laptop સૌથી વિશ્વસનીય):</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                તમારા Android ફોનમાં Type-C OTG એડેપ્ટર વડે Arduino Uno ની USB કેબલ જોડો. Google Chrome માં Web Serial API દ્વારા 9600 Baud (ડીફોલ્ટ) અથવા 115200 Baud પર ૧૦૦% સ્થિર અને સીધું લાઈવ મોનિટરિંગ થાય છે.
              </p>
              {onConnectUsb && (
                <div className="pt-1">
                  <button
                    onClick={() => {
                      onClose();
                      onConnectUsb();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Cable className="w-4 h-4" />
                    <span>Connect USB-OTG</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
            <span className={`w-2 h-2 rounded-full ${usbStatus === 'CONNECTED' ? 'bg-emerald-500' : usbStatus === 'CONNECTING' ? 'bg-amber-500 animate-spin' : 'bg-slate-400'}`} />
            <span>સ્થિતિ: {usbStatus === 'CONNECTED' ? `જોડાયેલ (${serialMode})` : usbStatus === 'CONNECTING' ? 'જોડાઈ રહ્યું છે...' : 'ડિસ્કનેક્ટ'}</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-colors cursor-pointer"
          >
            <span>બંધ કરો</span>
          </button>
        </div>
      </div>
    </div>
  );
};

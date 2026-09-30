import React from 'react';
import { X, Smartphone, Bluetooth, Cable, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';

interface AndroidBluetoothModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectBluetooth?: () => void;
  onConnectUsb?: () => void;
  isIframeEmbedded?: boolean;
}

export const AndroidBluetoothModal: React.FC<AndroidBluetoothModalProps> = ({
  isOpen,
  onClose,
  onConnectBluetooth,
  onConnectUsb,
  isIframeEmbedded = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="android-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 id="android-modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Android પર HC-05 Bluetooth કનેક્શન</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                તમારા Android સ્માર્ટફોન પરથી ટાંકીનું લાઈવ મોનિટરિંગ
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

        {/* Iframe Notice for Mobile */}
        {isIframeEmbedded && typeof window !== 'undefined' && (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>મહત્વપૂર્ણ: નવી ટેબમાં ખોલો</span>
            </div>
            <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
              Android Chrome ની સુરક્ષા નીતિ અનુસાર આઇફ્રેમમાં Bluetooth પોપઅપ બ્લોક થઈ શકે છે. સરળ કનેક્શન માટે એપને અલગ ટેબમાં ખોલો:
            </p>
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Direct Tab (નવી ટેબમાં ખોલો)</span>
            </a>
          </div>
        )}

        {/* Steps Guide */}
        <div className="space-y-3 text-xs">
          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>HC-05 કનેક્ટ કરવાના ૪ સરળ પગલાં:</span>
          </div>

          <div className="space-y-2.5 font-sans">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">૧</span>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Android Bluetooth માં HC-05 પેર કરો:</p>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                  ફોનના <strong>Settings → Bluetooth</strong> માં જાઓ. "Pair new device" પર ટેપ કરો, <strong>HC-05</strong> પસંદ કરો અને PIN <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded font-mono text-blue-600 dark:text-blue-300">1234</code> અથવા <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded font-mono text-blue-600 dark:text-blue-300">0000</code> નાખો.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">૨</span>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Google Chrome બ્રાઉઝર વાપરો:</p>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                  આ વેબસાઇટ તમારા Android ફોનમાં <strong>Google Chrome</strong> માં ખોલો (HTTPS સાથે સુસંગત).
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">૩</span>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">"Connect Bluetooth" પર ટેપ કરો:</p>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                  નીચે આપેલા અથવા હેડરના બટન પર ટેપ કરો. Chrome ના બ્લૂટૂથ સિલેક્ટરમાંથી <strong>HC-05</strong> પસંદ કરો.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">૪</span>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">લાઈવ વોટર લેવલ અને પંપ કંટ્રોલ:</p>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                  વાસ્તવિક ડેટા (<code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded font-mono text-emerald-600 dark:text-emerald-400">DISTANCE:4.37,LEVEL:81.8%</code>) સાથે ટાંકીનું એનિમેશન અને પંપ કંટ્રોલ તરત જ સક્રિય થશે!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* USB-OTG Notice */}
        <div className="p-3 rounded-2xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/50 space-y-1 text-xs">
          <p className="font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
            <Cable className="w-3.5 h-3.5 text-sky-600" />
            <span>વૈકલ્પિક: USB-OTG કેબલ દ્વારા પણ જોડાઈ શકે છે</span>
          </p>
          <p className="text-sky-800/80 dark:text-sky-300/80 text-[11px] leading-relaxed">
            જો તમે બ્લૂટૂથને બદલે વાયર્ડ કનેક્શન ઈચ્છતા હોવ, તો USB Type-C to Type-A OTG એડેપ્ટર વડે Arduino Uno કેબલ સીધો ફોનમાં જોડીને <strong>"Connect USB"</strong> પણ કરી શકો છો.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {onConnectUsb && (
            <button
              onClick={() => {
                onClose();
                onConnectUsb();
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Cable className="w-3.5 h-3.5 text-emerald-600" />
              <span>Connect USB (OTG)</span>
            </button>
          )}

          {onConnectBluetooth && (
            <button
              onClick={() => {
                onClose();
                onConnectBluetooth();
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Bluetooth className="w-4 h-4" />
              <span>Connect Bluetooth (HC-05)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

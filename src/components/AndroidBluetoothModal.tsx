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

        {/* HC-05 Classic SPP Technical Note */}
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>HC-05 Bluetooth Classic (SPP) અને બ્રાઉઝર મર્યાદા:</span>
          </div>
          <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed text-[11px]">
            HC-05 મોડ્યુલ <strong>Bluetooth Classic SPP (Serial Port Profile)</strong> વાપરે છે. વેબ બ્રાઉઝર્સનું Web Bluetooth API ફક્ત <em>Bluetooth Low Energy (BLE)</em> ને સપોર્ટ કરે છે. આથી બ્રાઉઝર સીધું HC-05 Classic સાથે વેબ બ્લૂટૂથ કનેક્શન કરી શકતું નથી.
          </p>
        </div>

        {/* Steps Guide: Compatible Android Connection Method */}
        <div className="space-y-3 text-xs">
          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Android પર સુસંગત કનેક્શન પદ્ધતિ (USB-OTG Web Serial):</span>
          </div>

          <div className="space-y-2.5 font-sans">
            <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/50 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">૧</span>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">USB-OTG એડેપ્ટર વડે Arduino Uno જોડો (સૌથી વિશ્વસનીય):</p>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                  તમારા Android ફોનના ચાર્જિંગ પોર્ટમાં <strong>Type-C to USB-A OTG એડેપ્ટર</strong> લગાવો અને Arduino Uno ની USB કેબલ જોડો. (ફોનના Settings માં જરૂર પડે તો "OTG Connection" ચાલુ કરો).
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">૨</span>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Android Google Chrome માં ખોલો:</p>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                  આ એપ્લિકેશનને Android પર <strong>Google Chrome</strong> માં ખોલો (HTTPS ટેબમાં).
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">૩</span>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">"Connect USB" પર ટેપ કરો:</p>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                  <strong>Connect USB</strong> બટન દબાવો. Chrome માં USB ડિવાઇસ પરવાનગી પોપઅપ આવશે, તેમાં Arduino પસંદ કરી <strong>Connect</strong> આપો.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">૪</span>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">લાઈવ 115200 Baud Web Serial:</p>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                  Android Chrome Web Serial API દ્વારા લાઈવ સેન્સર રીડિંગ (<code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded font-mono text-emerald-600 dark:text-emerald-400">DISTANCE:xx,LEVEL:xx%</code>) અને રિલે પંપ કંટ્રોલ સીધું કાર્ય કરશે.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* HC-05 Alternative App Note */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
          <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Bluetooth className="w-3.5 h-3.5 text-blue-600" />
            <span>HC-05 Bluetooth SPP માટે નોંધ:</span>
          </p>
          <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
            જો તમે વાયરલેસ HC-05 Bluetooth વાપરવા માંગતા હોવ, તો Android પર <em>Serial Bluetooth Terminal</em> જેવી નેટિવ SPP એપ દ્વારા સીધો 9600 Baud પર કમાન્ડ મોકલી શકાય છે, કારણ કે વેબ બ્રાઉઝર્સ સુરક્ષા કારણોસર Classic RFCOMM પ્રોફાઇલને સપોર્ટ કરતા નથી.
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

import { ARDUINO_UNO_FIRMWARE_CODE } from '../hardware/arduinoCode';
import React, { useState } from 'react';
import {
  ARDUINO_UNO_PINOUT,
  RELAY_SAFETY_NOTES,
  USB_CONNECTION_GUIDE,
  BLUETOOTH_CONNECTION_GUIDE,
  ANDROID_HC05_CONNECTION_GUIDE,
} from '../hardware/hardwareDocs';
import {
  Download,
  Copy,
  Check,
  Cpu,
  Terminal,
  ShieldAlert,
  Code2,
  Cable,
  Bluetooth,
  Smartphone,
  AlertTriangle,
  ExternalLink,
  BookOpen,
} from 'lucide-react';

export const HardwareDocsView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'wiring' | 'firmware' | 'guide' | 'protocol'>('wiring');
  const [copiedCode, setCopiedCode] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const unoCode = ARDUINO_UNO_FIRMWARE_CODE;

  const downloadFile = (filename: string, content: string) => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6">
      {/* Navigation Sub-Tabs Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Cable className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              Arduino Uno USB હાર્ડવેર વાયરિંગ & ફર્મવેર ગાઈડ
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              શ્રી સરકારી માધ્યમિક અને ઉચ્ચ. માધ્યમિક શાળા–લાખાપર · Arduino Uno (9600 Baud Default / 115200 Web Serial)
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold gap-1 sm:gap-0">
            <button
              onClick={() => setActiveSubTab('wiring')}
              className={`px-3 py-2 sm:py-1.5 rounded-lg transition-colors cursor-pointer text-center min-h-[38px] flex items-center justify-center ${
                activeSubTab === 'wiring'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              વાયરિંગ અને પિનઆઉટ
            </button>
            <button
              onClick={() => setActiveSubTab('firmware')}
              className={`px-3 py-2 sm:py-1.5 rounded-lg transition-colors cursor-pointer text-center min-h-[38px] flex items-center justify-center ${
                activeSubTab === 'firmware'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Arduino Uno ફર્મવેર (.ino)
            </button>
            <button
              onClick={() => setActiveSubTab('guide')}
              className={`px-3 py-2 sm:py-1.5 rounded-lg transition-colors cursor-pointer text-center min-h-[38px] flex items-center justify-center ${
                activeSubTab === 'guide'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              USB કનેક્શન & ગાઈડ
            </button>
            <button
              onClick={() => setActiveSubTab('protocol')}
              className={`px-3 py-2 sm:py-1.5 rounded-lg transition-colors cursor-pointer text-center min-h-[38px] flex items-center justify-center ${
                activeSubTab === 'protocol'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              સીરીયલ પ્રોટોકોલ
            </button>
          </div>
        </div>
      </div>

      {/* 1. Wiring & Pinout Tab */}
      {activeSubTab === 'wiring' && (
        <div className="space-y-6">
          {/* Hardware Connection Pinout Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-sky-500" />
                <span>Arduino Uno R3 હાર્ડવેર પિનઆઉટ મેટ્રિક્સ</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-400">Atmega328P · 16MHz</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3">Arduino Pin</th>
                    <th className="py-2.5 px-3">Component</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Voltage</th>
                    <th className="py-2.5 px-3">Safety & Wiring Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {ARDUINO_UNO_PINOUT.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-bold text-sky-600 dark:text-sky-400">{item.pin}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-200 font-sans">{item.component}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-sans">{item.role}</td>
                      <td className="py-2.5 px-3 text-amber-600 dark:text-amber-400">{item.voltage}</td>
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 text-[11px] font-sans">{item.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Safety & Motor Power Warning */}
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              <span>અતિ મહત્વપૂર્ણ ઇલેક્ટ્રિકલ સુરક્ષા ચેતવણી:</span>
            </div>
            <pre className="p-4 rounded-xl bg-slate-900 text-amber-300 font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed">
              {RELAY_SAFETY_NOTES}
            </pre>
          </div>
        </div>
      )}

      {/* 2. Firmware Code Tab */}
      {activeSubTab === 'firmware' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-emerald-500" />
                  <span>Arduino_Uno_WaterTank_Controller.ino</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Arduino IDE 1.8.x અથવા 2.x માં ખોલીને Uno બોર્ડ પર ૧૧૫૨૦૦ બાઉડ રેટ સાથે અપલોડ કરો.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(unoCode)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'કોપી થયું!' : 'કોડ કોપી કરો'}</span>
                </button>

                <button
                  onClick={() => downloadFile('Arduino_Uno_WaterTank_Controller.ino', unoCode)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.ino ડાઉનલોડ કરો</span>
                </button>
              </div>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto max-h-[500px] leading-relaxed border border-slate-800">
              {unoCode}
            </pre>
          </div>
        </div>
      )}

      {/* 3. USB Connection Guide & Troubleshooting */}
      {activeSubTab === 'guide' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-sky-500" />
              <span>Arduino Uno USB કનેક્શન અને ટ્રબલશૂટિંગ માર્ગદર્શિકા</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/50 space-y-2">
                <span className="font-bold text-sm text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                  ૧. USB કેબલ જોડાણ
                </span>
                <p className="text-xs text-sky-800/80 dark:text-sky-300/80 leading-relaxed">
                  Arduino Uno ને સ્ટાન્ડર્ડ USB Type-A to Type-B કેબલ દ્વારા તમારા કમ્પ્યુટર સાથે જોડો. Windows માં ડિવાઇસ મેનેજરમાં <strong>Ports (COM & LPT)</strong> માં Arduino Uno અથવા CH340 પોર્ટ દેખાશે.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                <span className="font-bold text-sm text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  ૨. બ્રાઉઝર પરવાનગી (Web Serial)
                </span>
                <p className="text-xs text-indigo-800/80 dark:text-indigo-300/80 leading-relaxed">
                  વેબ એપ્લિકેશનમાં <strong>Connect USB</strong> બટન પર ક્લિક કરો. બ્રાઉઝર પોપઅપમાં તમારું Arduino Uno પોર્ટ પસંદ કરો અને Connect પર ક્લિક કરો. બ્રાઉઝર ડિફોલ્ટ 9600 બાઉડ (અથવા તમારી પસંદ કરેલી બાઉડ રેટ) પર પોર્ટ ઓપન કરશે.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50 space-y-2">
                <span className="font-bold text-sm text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  ૩. COM Port Busy નિવારણ
                </span>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                  જો તમને <strong>"પોર્ટ પહેલેથી જ ખુલ્લો છે (BUSY)"</strong> ભૂલ આવે, તો કૃપા કરીને <strong>Arduino IDE નો Serial Monitor બંધ કરો</strong>, કારણ કે એક COM પોર્ટ એક જ સમયે બે સોફ્ટવેર વાપરી શકતા નથી.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 space-y-2">
                <span className="font-bold text-sm text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  ૪. સ્વાયત્ત હાર્ડવેર સેફ્ટી
                </span>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed">
                  લક્ષ્યાંક સ્તર પહોંચવા પર (દા.ત. ૫૦%) અથવા સેન્સર એરર થવા પર Arduino Uno ફર્મવેર <strong>બ્રાઉઝર પર નિર્ભર રહ્યા વગર જાતે જ રિલે બંધ કરે છે</strong>, જેથી ઓવરફ્લો અટકે છે.
                </p>
              </div>
            </div>

            {/* Android HC-05 Bluetooth Connection Section */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-sky-500" />
                <span>📱 Android પર સુસંગત કનેક્શન & HC-05 Bluetooth SPP માર્ગદર્શિકા</span>
              </h4>
              <pre className="p-4 rounded-xl bg-slate-900 text-sky-200 font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed border border-sky-900/40">
                {ANDROID_HC05_CONNECTION_GUIDE}
              </pre>
            </div>

            {/* HC-05 Bluetooth Connection Section */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bluetooth className="w-4 h-4 text-blue-500" />
                <span>💻 HC-05 Bluetooth Classic (SPP) અને કનેક્શન માર્ગદર્શિકા</span>
              </h4>
              <pre className="p-4 rounded-xl bg-slate-900 text-blue-200 font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed border border-blue-900/40">
                {BLUETOOTH_CONNECTION_GUIDE}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* 4. Serial Protocol Tab */}
      {activeSubTab === 'protocol' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-500" />
              <span>વેબ એપ્લિકેશન અને Arduino Uno વચ્ચે ન્યૂલાઇન-ડિલિમિટેડ પ્રોટોકોલ</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                ૧. વેબ એપ્લિકેશન તરફથી મોકલાતા કમાન્ડ્સ (TX):
              </div>
              <div className="p-4 rounded-xl bg-slate-950 font-mono text-emerald-400 space-y-2">
                <div><strong>TARGET:50\n</strong> — લક્ષ્યાંક પાણી સ્તર ૫૦% સેટ કરે છે (૧૦ થી ૧૦૦%)</div>
                <div><strong>START\n</strong> — ઓટોમેટિક પંપ ફિલિંગ શરૂ કરે છે</div>
                <div><strong>STOP\n</strong> — મોટર પંપ તાત્કાલિક બંધ કરે છે (અથવા ઈમરજન્સી સ્ટોપ)</div>
                <div><strong>STATUS\n</strong> — તાત્કાલિક ટેલિમેટ્રી પ્રતિસાદ માંગે છે</div>
              </div>

              <div className="font-semibold text-slate-800 dark:text-slate-200 pt-2">
                ૨. Arduino Uno / HC-05 તરફથી આવતો ટેલિમેટ્રી પ્રતિસાદ (RX):
              </div>
              <div className="p-4 rounded-xl bg-slate-950 font-mono text-sky-300 space-y-3">
                <div>
                  <div className="text-emerald-400 font-bold">ફોર્મેટ ૧ (સ્ટાન્ડર્ડ):</div>
                  <div>DISTANCE:4.37,LEVEL:81.8%\n</div>
                  <div className="text-slate-400 text-[11px]">
                    અર્થ: અલ્ટ્રાસોનિક અંતર=૪.૩૭ સેમી, ટાંકી વોટર લેવલ=૮૧.૮%
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <div className="text-emerald-400 font-bold">ફોર્મેટ ૨ (વિગતવાર):</div>
                  <div>LEVEL:45.0,DISTANCE:7.28,PUMP:ON,TARGET:50\n</div>
                  <div className="text-slate-400 text-[11px]">
                    અર્થ: સ્તર=૪૫.૦%, અંતર=૭.૨૮ સેમી, પંપ=ચાલુ (ON), લક્ષ્યાંક=૫૦%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

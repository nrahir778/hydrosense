import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  VolumeX,
  Send,
  RotateCw,
  Clock,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Brain,
  Zap,
  Info,
  Sliders,
  Square,
  UserCheck,
} from 'lucide-react';
import { SystemState, AiVoiceCommandResult } from '../types';
import { playHumanSpeech, stopAllSpeech } from '../utils/audioPlayer';

interface AiAssistantViewProps {
  state: SystemState;
  onExecuteAiCommand: (query: string) => Promise<AiVoiceCommandResult>;
  isThinking: boolean;
}

export function AiAssistantView({
  state,
  onExecuteAiCommand,
  isThinking,
}: AiAssistantViewProps) {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<'Kore' | 'Zephyr' | 'Puck'>('Kore');
  const [history, setHistory] = useState<
    Array<{
      id: string;
      query: string;
      result: AiVoiceCommandResult;
      timestamp: number;
    }>
  >([]);

  // Speech Recognition instance ref
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check Speech Recognition support in browser
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      // Primary Gujarati, with browser fallback
      recognition.lang = 'gu-IN';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        if (transcript) {
          handleSendCommand(transcript);
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }

    return () => {
      stopAllSpeech();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleListening = () => {
    stopAllSpeech();
    if (!speechSupported) {
      alert('તમારા બ્રાઉઝરમાં માઇક્રોફોન સ્પીચ ઓળખ સપોર્ટેડ નથી. કૃપા કરીને નીચે ટાઇપ કરીને કમાન્ડ આપો.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        setIsListening(true);
        recognitionRef.current?.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
        setIsListening(false);
      }
    }
  };

  const playSpeech = (text: string, audioBase64?: string) => {
    if (!ttsEnabled) return;

    playHumanSpeech({
      audioBase64,
      text,
      voiceName: selectedVoice,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
    });
  };

  const handleSendCommand = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;
    setInputText('');
    stopAllSpeech();

    try {
      const res = await onExecuteAiCommand(trimmed);
      const newEntry = {
        id: 'ai-hist-' + Date.now(),
        query: trimmed,
        result: res,
        timestamp: Date.now(),
      };
      setHistory((prev) => [newEntry, ...prev]);

      if (res.responseGujarati) {
        playSpeech(res.responseGujarati, res.audioBase64);
      }
    } catch (err) {
      console.error('Error executing AI command:', err);
    }
  };

  const testHumanVoice = () => {
    const sampleText = 'નમસ્તે! હું શ્રી સરકારી માધ્યમિક અને ઉચ્ચ માધ્યમિક શાળા લાખાપરનો AI વોઇસ આસિસ્ટન્ટ છું. હાલ પાણીની મુખ્ય ટાંકીનું સેન્સર મોનિટરિંગ સામાન્ય રીતે કાર્ય કરી રહ્યું છે.';
    playSpeech(sampleText);
  };

  const sampleVoiceChips = [
    { label: 'ટાંકીમાં કેટલું પાણી છે?', icon: '💧' },
    { label: 'સેન્સર અંતર કેટલું છે?', icon: '📏' },
    { label: 'ટાંકીનું પાણી કેટલો સમય ચાલશે?', icon: '⏳' },
    { label: 'કેલિબ્રેશન માહિતી આપો', icon: '⚙️' },
    { label: '૯૦% અને ૯૭% ચેતવણીઓ શું છે?', icon: '⚠️' },
    { label: 'હાર્ડવેર કનેક્શન સ્થિતિ શું છે?', icon: '📡' },
  ];

  const { tank, calibration, aiMetrics, hardwareStatus } = state;

  return (
    <div className="space-y-6">
      {/* School Header & AI Hero Banner */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-sky-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-700/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold tracking-wide border border-indigo-500/30">
              <Brain className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
              <span>શ્રી સરકારી માધ્યમિક અને ઉચ્ચ. માધ્યમિક શાળા–લાખાપર</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Sparkles className="w-7 h-7 text-amber-400" />
              <span>AI વોઇસ આસિસ્ટન્ટ & સ્માર્ટ લર્નિંગ મોડલ</span>
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              વોઇસ કમાન્ડ દ્વારા ટાંકીનું વર્તમાન લેવલ પૂછો, સેન્સર અંતર ચકાસો અથવા AI દ્વારા શીખેલી વપરાશ પેટર્ન આધારે પાણી કેટલો સમય ચાલશે તે જાણી લો.
            </p>
          </div>

          {/* Quick Voice Mode, Persona & TTS Controls */}
          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/10">
            {/* Voice Persona Selector */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-slate-900/60 border border-white/10 text-xs">
              <UserCheck className="w-3.5 h-3.5 text-sky-400" />
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value as 'Kore' | 'Zephyr' | 'Puck')}
                className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
                title="માનવીય અવાજ શૈલી પસંદ કરો"
              >
                <option value="Kore" className="bg-slate-900 text-white">કોરે (મધુર સ્ત્રી અવાજ)</option>
                <option value="Zephyr" className="bg-slate-900 text-white">ઝેફિર (શાંત પુરુષ અવાજ)</option>
                <option value="Puck" className="bg-slate-900 text-white">પક (ઉત્સાહી અવાજ)</option>
              </select>
            </div>

            {/* Test Voice Button */}
            <button
              onClick={testHumanVoice}
              disabled={isSpeaking}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              title="જેમિની માનવીય ગુજરાતી અવાજનો ડેમો સાંભળો"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>અવાજ ટેસ્ટ</span>
            </button>

            {/* Mute/Unmute Toggle */}
            <button
              onClick={() => setTtsEnabled(!ttsEnabled)}
              title={ttsEnabled ? 'અવાજ પ્રતિભાવ ચાલુ છે' : 'અવાજ પ્રતિભાવ મ્યૂટ છે'}
              className={`p-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
                ttsEnabled
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Live Audio Speaking Indicator Banner */}
        {isSpeaking && (
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between bg-sky-500/20 px-4 py-2.5 rounded-2xl border border-sky-400/30">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-4 bg-sky-400 rounded-full animate-pulse" />
                <span className="w-1.5 h-6 bg-sky-300 rounded-full animate-bounce" />
                <span className="w-1.5 h-5 bg-sky-400 rounded-full animate-pulse" />
                <span className="w-1.5 h-7 bg-indigo-300 rounded-full animate-bounce" />
                <span className="w-1.5 h-3 bg-sky-400 rounded-full animate-pulse" />
              </div>
              <span className="text-xs font-bold text-sky-200">
                AI માનવીય અવાજમાં બોલી રહ્યું છે ({selectedVoice === 'Kore' ? 'કોરે' : selectedVoice === 'Zephyr' ? 'ઝેફિર' : 'પક'})...
              </span>
            </div>
            <button
              onClick={() => stopAllSpeech()}
              className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>અવાજ રોકો</span>
            </button>
          </div>
        )}
      </div>

      {/* Voice Input & Interactive Microphone Console */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-md border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Mic className="w-5 h-5 text-sky-500" />
              <span>ગુજરાતી વોઇસ અથવા ટેક્સ્ટ કમાન્ડ આપો</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              માઇક બટન દબાવીને બોલો (દા.ત. &quot;ટાંકી ૨ ની મોટર ચાલુ કરો&quot; અથવા &quot;ટાંકી ૨ માં કેટલું પાણી છે?&quot;)
            </p>
          </div>

          {isListening && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-semibold animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span>સાંભળી રહ્યું છે... બોલો...</span>
            </div>
          )}
        </div>

        {/* Big Interactive Mic Button & Waves */}
        <div className="flex flex-col items-center justify-center py-6 gap-4">
          <div className="relative">
            {isListening && (
              <>
                <span className="absolute inset-0 rounded-full bg-sky-500/30 animate-ping" />
                <span className="absolute -inset-4 rounded-full bg-sky-500/10 animate-pulse" />
              </>
            )}
            <button
              onClick={toggleListening}
              disabled={isThinking}
              aria-label={isListening ? 'માઇક બંધ કરો' : 'માઇક ચાલુ કરો'}
              className={`relative z-10 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center shadow-xl transition-all transform active:scale-95 ${
                isListening
                  ? 'bg-rose-600 text-white shadow-rose-500/40 ring-4 ring-rose-300 dark:ring-rose-800'
                  : 'bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-sky-500/30 hover:scale-105'
              }`}
            >
              {isListening ? (
                <MicOff className="w-8 h-8 sm:w-9 sm:h-9" />
              ) : (
                <Mic className="w-8 h-8 sm:w-9 sm:h-9" />
              )}
              <span className="text-[10px] font-bold mt-1 tracking-tight">
                {isListening ? 'સાંભળે છે' : 'બોલવા દબાવો'}
              </span>
            </button>
          </div>

          <div className="text-center">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {isListening
                ? 'હવે સ્પષ્ટ અવાજે કહો: દા.ત. "ટાંકીમાં કેટલું પાણી છે?"'
                : 'માઇક્રોફોન પર ટેપ કરો અથવા નીચેથી પ્રશ્ન પસંદ કરો'}
            </span>
          </div>
        </div>

        {/* Quick Voice Suggestion Chips */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            ઝડપી અજમાયશ કમાન્ડ્સ:
          </div>
          <div className="flex flex-wrap gap-2">
            {sampleVoiceChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendCommand(chip.label)}
                disabled={isThinking}
                className="text-xs px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-sky-50 hover:text-sky-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium transition-all flex items-center gap-1.5"
              >
                <span>{chip.icon}</span>
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Text Input Fallback */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendCommand(inputText);
          }}
          className="flex gap-2 pt-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="અહીં ગુજરાતી અથવા અંગ્રેજીમાં લખો (દા.ત. ટાંકીમાં કેટલું પાણી છે?)..."
            disabled={isThinking}
            className="flex-1 px-4 py-3 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isThinking}
            className="px-5 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold text-sm flex items-center gap-2 shadow-sm transition-colors"
          >
            {isThinking ? (
              <RotateCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>મોકલો</span>
          </button>
        </form>
      </div>

      {/* Real-time AI Learned Predictions & Usage Patterns Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Single Physical Tank Live Metrics Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-md border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                💧
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {tank.nameGujarati}
                </h3>
                <span className="text-xs text-slate-500">HC-SR04 અલ્ટ્રાસોનિક સેન્સર ({tank.capacityLiters} L)</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-extrabold text-sky-600 dark:text-sky-400">
                {tank.currentPercent !== null ? `${tank.currentPercent}%` : '--'}
              </span>
              <div className="text-[11px] text-slate-500">
                {tank.currentDistanceCm !== null ? `${tank.currentDistanceCm} cm અંતર` : 'પ્રતિક્ષામાં'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/50">
              <div className="flex items-center gap-1.5 text-xs text-sky-700 dark:text-sky-300 font-semibold mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>પાણી કેટલો સમય ચાલશે</span>
              </div>
              <div className="text-xl font-extrabold text-sky-950 dark:text-sky-100">
                {aiMetrics.tank1.estimatedHoursRemaining} <span className="text-xs font-normal">કલાક</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                શાળા વપરાશ દર: {aiMetrics.tank1.averageDrainRateLitersPerHour} L/કલાક
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50">
              <div className="flex items-center gap-1.5 text-xs text-indigo-700 dark:text-indigo-300 font-semibold mb-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>પૂરી ભરાતા અંદાજિત સમય</span>
              </div>
              <div className="text-xl font-extrabold text-indigo-950 dark:text-indigo-100">
                {aiMetrics.tank1.estimatedFullFillDurationMin} <span className="text-xs font-normal">મિનિટ</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                સરેરાશ ઇનફ્લો દર: {aiMetrics.tank1.averageFillRateLitersPerMin} L/મિનિટ
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl flex items-center justify-between">
            <span>હાર્ડવેર સ્થિતિ: <strong className="text-sky-600 font-mono">{hardwareStatus}</strong></span>
            <span>સેન્સર હેલ્થ: <strong>{tank.sensorHealth}</strong></span>
          </div>
        </div>

        {/* Physical Calibration & Warning Limits Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-md border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                ⚙️
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  કેલિબ્રેશન અને ચેતવણી મર્યાદાઓ
                </h3>
                <span className="text-xs text-slate-500">ભૌતિક અંતર અને ઓવરફ્લો સેફ્ટી લિમિટ્સ</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <span className="text-xs text-slate-500 block mb-1">ખાલી ટાંકી અંતર (૦%):</span>
              <span className="text-lg font-extrabold text-slate-800 dark:text-slate-200 font-mono">
                {calibration.emptyDistanceCm} cm
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <span className="text-xs text-slate-500 block mb-1">પૂર્ણ ટાંકી અંતર (૧૦૦%):</span>
              <span className="text-lg font-extrabold text-slate-800 dark:text-slate-200 font-mono">
                {calibration.fullDistanceCm} cm
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50">
              <span className="text-xs text-amber-800 dark:text-amber-300 block mb-1">પૂર્ણ ચેતવણી:</span>
              <span className="text-lg font-extrabold text-amber-900 dark:text-amber-100 font-mono">
                &gt; {calibration.nearFullWarningPercent}%
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50">
              <span className="text-xs text-rose-800 dark:text-rose-300 block mb-1">ક્રિટિકલ ઓવરફ્લો:</span>
              <span className="text-lg font-extrabold text-rose-900 dark:text-rose-100 font-mono">
                &gt;= {calibration.criticalFullWarningPercent}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Smart Insights & School Timing Pattern Card */}
      <div className="bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10 dark:from-sky-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 rounded-3xl p-6 border border-sky-200 dark:border-sky-800/50 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                AI સ્માર્ટ સલાહ & શાળા વપરાશ પેટર્ન
              </h4>
              <p className="text-slate-700 dark:text-slate-200 text-sm mt-1 leading-relaxed">
                {aiMetrics.smartRecommendation}
              </p>
            </div>
          </div>

          <button
            onClick={() => playSpeech(aiMetrics.smartRecommendation)}
            className="p-2 rounded-xl bg-white/60 dark:bg-slate-800/60 hover:bg-sky-100 dark:hover:bg-slate-700 text-sky-600 dark:text-sky-300 transition-colors shrink-0 shadow-xs flex items-center gap-1 text-xs font-semibold"
            title="આ સલાહ માનવીય અવાજમાં સાંભળો"
          >
            <Volume2 className="w-4 h-4" />
            <span className="hidden sm:inline">સાંભળો</span>
          </button>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800/60">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-sky-500" />
            <span>શાળા પીક વપરાશ સમય: <strong>{aiMetrics.peakUsageHour}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-indigo-500" />
            <span>હાર્ડવેર લર્નિંગ: <strong>Arduino Mega 2560 & HC-SR04 સેન્સર ટેલિમેટ્રી</strong></span>
          </div>
        </div>
      </div>

      {/* Interaction History / Recent AI Command Logs */}
      {history.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-md border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>તાજેતરના AI વોઇસ કમાન્ડ્સ અને જવાબો</span>
          </h3>

          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2"
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    તમે કહ્યું: &quot;{item.query}&quot;
                  </span>
                  <span>{new Date(item.timestamp).toLocaleTimeString('gu-IN')}</span>
                </div>

                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">
                    {item.result.responseGujarati}
                  </div>
                  <button
                    onClick={() => playSpeech(item.result.responseGujarati, item.result.audioBase64)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-sky-500 transition-colors"
                    title="માનવીય અવાજમાં ફરી સાંભળો"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                {item.result.actionExecuted && item.result.actionExecuted.type !== 'INFO' && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>હાર્ડવેર એક્શન: {item.result.actionExecuted.type} ({item.result.actionExecuted.reason || 'સફળ'})</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

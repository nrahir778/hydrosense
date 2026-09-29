/**
 * High-fidelity human-like speech player for Gujarati AI Assistant
 * Plays Gemini 3.8 Flash Lite TTS neural audio (24kHz 16-bit PCM/WAV)
 */

let currentAudio: HTMLAudioElement | null = null;

/**
 * Converts PCM base64 audio to a playable WAV Blob URL with a valid 44-byte RIFF header
 */
export function pcmBase64ToWavUrl(base64Audio: string, sampleRate = 24000): string {
  const binaryString = atob(base64Audio);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Check if it already has a RIFF/WAVE header
  const isAlreadyWav =
    bytes.length >= 4 &&
    bytes[0] === 0x52 && // 'R'
    bytes[1] === 0x49 && // 'I'
    bytes[2] === 0x46 && // 'F'
    bytes[3] === 0x46;   // 'F'

  if (isAlreadyWav) {
    const blob = new Blob([bytes], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }

  // Build standard 44-byte WAV header for 1-channel, 16-bit PCM @ sampleRate Hz
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = bytes.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF Chunk Descriptor
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + dataSize, true); // ChunkSize
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // "fmt " Sub-chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);          // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);           // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true);  // SampleRate (24000)
  view.setUint32(28, byteRate, true);    // ByteRate
  view.setUint16(32, blockAlign, true);  // BlockAlign
  view.setUint16(34, bitsPerSample, true); // BitsPerSample

  // "data" Sub-chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);    // Subchunk2Size

  new Uint8Array(buffer, 44).set(bytes);
  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

/**
 * Stop any ongoing audio playback
 */
export function stopAllSpeech(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Play human-like speech from base64 audio or fetch from server TTS
 */
export async function playHumanSpeech(
  options: {
    audioBase64?: string;
    text?: string;
    voiceName?: 'Kore' | 'Zephyr' | 'Puck' | 'Charon' | 'Fenrir';
    onStart?: () => void;
    onEnd?: () => void;
  }
): Promise<void> {
  stopAllSpeech();

  const { audioBase64, text, voiceName = 'Kore', onStart, onEnd } = options;

  let base64ToPlay = audioBase64;

  // If no base64 provided but text is given, fetch neural audio from server
  if (!base64ToPlay && text) {
    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceName }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          base64ToPlay = data.audioBase64;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch server TTS, falling back to browser synthesis:', err);
    }
  }

  // Play neural audio if available
  if (base64ToPlay) {
    try {
      const audioUrl = pcmBase64ToWavUrl(base64ToPlay, 24000);
      const audio = new Audio(audioUrl);
      currentAudio = audio;

      audio.onplay = () => {
        onStart?.();
      };

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        onEnd?.();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        // Fallback to browser synthesis if playback fails
        if (text) {
          playBrowserSynthesisFallback(text, onStart, onEnd);
        } else {
          onEnd?.();
        }
      };

      await audio.play();
      return;
    } catch (err) {
      console.warn('HTML Audio play error, trying browser fallback:', err);
    }
  }

  // Fallback to browser speech synthesis if neural audio is not available
  if (text) {
    playBrowserSynthesisFallback(text, onStart, onEnd);
  }
}

function playBrowserSynthesisFallback(
  text: string,
  onStart?: () => void,
  onEnd?: () => void
): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'gu-IN';
  utterance.rate = 0.95;
  utterance.pitch = 1.0;

  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();

  const voices = window.speechSynthesis.getVoices();
  const guVoice = voices.find((v) => v.lang.includes('gu') || v.lang.includes('hi'));
  if (guVoice) {
    utterance.voice = guVoice;
  }

  window.speechSynthesis.speak(utterance);
}

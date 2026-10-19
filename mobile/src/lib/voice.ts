// Voice for Ask and notes: answers and briefs read aloud, and questions or notes
// spoken instead of typed. Ported from the prototype's demo/js/voice.js.
//
// Reading aloud uses expo-speech, which works in Expo Go and in browsers.
// Listening uses the browser's speech recognition on web. On a phone it needs a
// native speech module in a development build, so until then the mic is hidden there.

import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

// ---- Reading aloud ----------------------------------------------------------

export const canSpeak = (): boolean => Platform.OS !== 'web' || typeof globalThis.speechSynthesis?.speak === 'function';

/**
 * Reads text aloud, replacing anything already being read. `onEnd` runs once,
 * when it finishes or is stopped, so the screen can drop its "reading" state.
 */
export function speak(text: string, { onEnd }: { onEnd?: () => void } = {}): void {
  if (!canSpeak() || !text) {
    onEnd?.();
    return;
  }
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    onEnd?.();
  };
  // Stopping what was playing ends it, so its own onEnd runs first.
  void Speech.stop();
  Speech.speak(text, { language: 'en-US', rate: 1.0, onDone: end, onStopped: end, onError: end });
}

export function stopSpeaking(): void {
  if (canSpeak()) void Speech.stop();
}

// ---- Listening ----------------------------------------------------------------

/** The parts of the Web Speech API this uses. */
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionClass = new () => Recognition;

const recognitionClass = (): RecognitionClass | null => {
  if (Platform.OS !== 'web') return null;
  const g = globalThis as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
};

export const canListen = (): boolean => !!recognitionClass();

export type VoiceError = 'unsupported' | 'not-allowed' | 'service-not-allowed' | 'audio-capture' | 'no-speech' | 'network' | 'aborted';

/** What to tell the rep when listening fails, keyed by the Web Speech error code. */
export const VOICE_ERRORS: Record<VoiceError, string> = {
  unsupported: 'This device can’t turn speech into text yet. Type instead.',
  'not-allowed': 'Microphone access is blocked. Allow it in the browser’s site settings, or type instead.',
  'service-not-allowed': 'Microphone access is blocked. Allow it in the browser’s site settings, or type instead.',
  'audio-capture': 'No microphone was found. Type instead.',
  'no-speech': 'Didn’t catch that. Tap the mic and try again.',
  network: 'Voice needs a connection to the browser’s speech service. Type instead.',
  aborted: '',
};

export interface Listening {
  /** Stop and keep what was heard. */
  stop: () => void;
  /** Stop and throw it away. */
  cancel: () => void;
}

/**
 * Listens once (push-to-talk). `onText` gets the running transcript, `onDone`
 * the final text and `onError` an error code.
 */
export function listen({
  onText,
  onDone,
  onError,
  continuous = false,
  lang = 'en-US',
}: {
  onText: (text: string) => void;
  onDone: (text: string) => void;
  onError: (error: VoiceError) => void;
  /** Keep listening through pauses, for dictating a note. */
  continuous?: boolean;
  lang?: string;
}): Listening {
  const SR = recognitionClass();
  if (!SR) {
    queueMicrotask(() => onError('unsupported'));
    return { stop() {}, cancel() {} };
  }
  const rec = new SR();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = continuous;
  rec.maxAlternatives = 1;

  let text = '';
  let cancelled = false;
  let failed = false;
  rec.onresult = (event) => {
    text = Array.from(event.results, (r) => r[0].transcript)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    onText(text);
  };
  rec.onerror = (event) => {
    failed = true;
    if (!cancelled) onError((event.error as VoiceError) || 'unsupported');
  };
  rec.onend = () => {
    if (cancelled || failed) return;
    if (text) onDone(text);
    else onError('no-speech');
  };
  try {
    rec.start();
  } catch {
    failed = true;
    queueMicrotask(() => onError('unsupported'));
  }
  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        // Already stopped.
      }
    },
    cancel: () => {
      cancelled = true;
      try {
        rec.abort();
      } catch {
        // Already stopped.
      }
    },
  };
}

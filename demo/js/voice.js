// Push-to-talk voice input and spoken answers, using the browser's Web Speech
// API. In the React Native app the same roles are played by on-device speech
// recognition (iOS Speech / Android SpeechRecognizer) and text-to-speech.

const Recognition = () => globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition || null;

export const canListen = () => !!Recognition();
export const canSpeak = () => typeof globalThis.speechSynthesis?.speak === 'function' && typeof globalThis.SpeechSynthesisUtterance === 'function';

/** What to tell the rep when listening fails, keyed by the Web Speech error code. */
export const VOICE_ERRORS = {
  unsupported: 'This browser can’t turn speech into text. Type your question, or try a sample voice question.',
  'not-allowed': 'Microphone access is blocked. Allow it in your browser’s site settings, or type your question.',
  'service-not-allowed': 'Microphone access is blocked. Allow it in your browser’s site settings, or type your question.',
  'audio-capture': 'No microphone was found. Type your question instead.',
  'no-speech': 'Didn’t catch that. Tap the mic and try again.',
  network: 'Voice needs a connection to the browser’s speech service. Type your question, or try a sample voice question.',
  aborted: '',
};

/**
 * Starts listening once (push-to-talk). Calls onText with the running
 * transcript, onDone with the final text, onError with an error code.
 * Returns { stop, cancel }: stop keeps what was heard, cancel discards it.
 */
export function listen({ onText, onDone, onError, lang = 'en-US' }) {
  const SR = Recognition();
  if (!SR) {
    queueMicrotask(() => onError('unsupported'));
    return { stop() {}, cancel() {} };
  }
  const rec = new SR();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  let text = '';
  let cancelled = false;
  let failed = false;
  rec.onresult = (event) => {
    text = Array.from(event.results, (r) => r[0].transcript).join('').trim();
    onText(text);
  };
  rec.onerror = (event) => {
    failed = true;
    if (!cancelled) onError(event.error || 'unsupported');
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
    stop: () => { try { rec.stop(); } catch { /* already stopped */ } },
    cancel: () => { cancelled = true; try { rec.abort(); } catch { /* already stopped */ } },
  };
}

/**
 * Plays a transcript word by word, for browsers without speech recognition
 * and for demos in noisy rooms. The UI labels it as simulated.
 */
export function simulate(text, { onText, onDone, wordMs = 140 }) {
  const words = text.split(' ');
  let i = 0;
  let timer = null;
  const tick = () => {
    i += 1;
    onText(words.slice(0, i).join(' '));
    timer = i < words.length ? setTimeout(tick, wordMs) : setTimeout(() => onDone(text), 450);
  };
  timer = setTimeout(tick, 500);
  return { stop: () => { clearTimeout(timer); onDone(text); }, cancel: () => clearTimeout(timer) };
}

let speaking = 0;

/**
 * Reads text aloud, replacing anything already being read. onEnd runs when
 * it finishes on its own (not when interrupted), so hands-free mode can
 * listen again.
 */
export function speak(text, { onEnd } = {}) {
  if (!canSpeak() || !text) {
    onEnd?.();
    return;
  }
  const synth = globalThis.speechSynthesis;
  const id = ++speaking;
  synth.cancel();
  const u = new globalThis.SpeechSynthesisUtterance(text);
  u.rate = 1.03;
  const done = (event) => {
    if (id === speaking && !['interrupted', 'canceled'].includes(event?.error)) onEnd?.();
  };
  u.onend = done;
  u.onerror = done;
  synth.speak(u);
}

export function stopSpeaking() {
  speaking += 1;
  if (canSpeak()) globalThis.speechSynthesis.cancel();
}

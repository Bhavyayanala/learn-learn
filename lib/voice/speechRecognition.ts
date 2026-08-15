// LearnNest — speech recognition wrapper (master prompt section 21:
// explicitly NOT continuous listening — the mic activates once per tap,
// captures one utterance, and stops).
//
// SpeechRecognition is a browser-only API (Chrome/Edge; Safari has
// partial support; Firefox does not support it at all as of this
// writing) — this can't be verified by running code in this sandbox,
// only by feature-detecting correctly and writing against the
// documented, stable Web Speech API shape. isVoiceSupported() lets the
// UI hide/disable the mic button gracefully on unsupported browsers
// instead of showing a broken control.

type RecognitionResultHandler = (transcript: string) => void;
type RecognitionErrorHandler = (error: string) => void;

// Minimal shape of the browser's SpeechRecognition — not in TypeScript's
// standard DOM lib, declared locally rather than pulling in a types
// package for a handful of fields.
interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

function getRecognitionConstructor(): (new () => BrowserSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceSupported(): boolean {
  return getRecognitionConstructor() !== null;
}

export function listenOnce(
  onResult: RecognitionResultHandler,
  onError: RecognitionErrorHandler,
  onEnd: () => void
): { stop: () => void } {
  const Ctor = getRecognitionConstructor();
  if (!Ctor) {
    onError("unsupported");
    return { stop: () => {} };
  }

  const recognition = new Ctor();
  recognition.lang = "en-IN"; // Indian English — closer match for accent/vocabulary than en-US
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: any) => {
    const transcript = event.results?.[0]?.[0]?.transcript ?? "";
    onResult(transcript);
  };

  recognition.onerror = (event: any) => {
    onError(event.error ?? "unknown");
  };

  recognition.onend = onEnd;

  try {
    recognition.start();
  } catch {
    onError("start-failed");
  }

  return { stop: () => recognition.stop() };
}

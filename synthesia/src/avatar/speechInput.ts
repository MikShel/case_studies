// Minimal typing for the (still prefixed in Chrome) Web Speech recognition API.
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => RecognitionLike;

export interface Recognizer {
  supported: boolean;
  start(onFinal: (text: string) => void, onEnd: () => void): void;
  stop(): void;
}

export function createRecognizer(): Recognizer {
  const w = globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  let current: RecognitionLike | null = null;

  return {
    supported: Boolean(Ctor),
    start(onFinal, onEnd) {
      if (!Ctor) return;
      current?.stop();
      const r = new Ctor();
      r.lang = 'en-US';
      r.interimResults = false;
      r.continuous = false;
      r.onresult = (e) => {
        const text = e.results[0]?.[0]?.transcript?.trim();
        if (text) onFinal(text);
      };
      r.onend = () => {
        if (current === r) current = null;
        onEnd();
      };
      r.onerror = () => r.onend?.();
      current = r;
      r.start();
    },
    stop() {
      current?.stop();
    },
  };
}

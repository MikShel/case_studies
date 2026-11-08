/**
 * THE SEAM where a real interactive avatar plugs in.
 *
 * Today (PoC): a static portrait + browser speechSynthesis, with captions in the UI.
 *
 * With a real Synthesia real-time avatar (assumptions — to confirm with the Synthesia API docs):
 *  - The brain stays on our side: the session engine (or an LLM grounded on the creator's
 *    knowledge + boundary, with the same "no source → no instruction" and "never instruct a
 *    Needs-admin step" checks applied to its output) decides WHAT to say.
 *  - An adapter implementing this interface sends that text to a real-time avatar session, which
 *    speaks it and renders video. Synthesia's real-time avatars can be embedded via the LiveKit SDK
 *    and connected to your own LLM or knowledge base; the video track replaces the portrait.
 *  - The user's speech comes back from the same session (instead of speechInput.ts) and is passed
 *    to the engine's respond(), exactly like typed text.
 *  - speak() resolves when the avatar finishes the utterance; stop() interrupts it (barge-in).
 * Nothing else in the app needs to change: the director only talks to this interface.
 */
export type AvatarMood = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface AvatarAdapter {
  speak(text: string): Promise<void>;
  stop(): void;
  setMuted(muted: boolean): void;
  setMood(mood: AvatarMood): void;
  onMood(cb: (mood: AvatarMood) => void): () => void;
}

/** Pacing when speech is muted or unavailable. Recordings can speed it up via globalThis.__avaMsPerChar. */
export function speechDelayMs(text: string): number {
  const perChar = (globalThis as { __avaMsPerChar?: number }).__avaMsPerChar ?? 60;
  return Math.max(1200, perChar * text.length);
}

export interface VoiceOptions {
  /** preferred voice names, e.g. a different voice for other people on a call */
  prefer?: RegExp;
  pitch?: number;
}

function pickVoice(synth: SpeechSynthesis, prefer: RegExp): SpeechSynthesisVoice | undefined {
  const voices = synth.getVoices();
  return (
    voices.find((v) => v.lang.startsWith('en') && prefer.test(v.name)) ??
    voices.find((v) => v.lang.startsWith('en'))
  );
}

export function createSimulatedAvatar(synth: SpeechSynthesis | undefined = globalThis.speechSynthesis, opts: VoiceOptions = {}): AvatarAdapter {
  const prefer = opts.prefer ?? /samantha|google us english|aria|jenny/i;
  const listeners = new Set<(m: AvatarMood) => void>();
  let muted = false;
  let finishCurrent: (() => void) | null = null;

  const emit = (m: AvatarMood) => listeners.forEach((cb) => cb(m));

  return {
    speak(text) {
      this.stop();
      emit('speaking');
      return new Promise<void>((resolve) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const finish = () => {
          if (finishCurrent !== finish) return;
          finishCurrent = null;
          clearTimeout(timer);
          emit('idle');
          resolve();
        };
        finishCurrent = finish;

        if (!synth || muted) {
          timer = setTimeout(finish, speechDelayMs(text));
          return;
        }
        const u = new SpeechSynthesisUtterance(text);
        const voice = pickVoice(synth, prefer);
        if (voice) u.voice = voice;
        u.rate = 1.05;
        if (opts.pitch) u.pitch = opts.pitch;
        u.onend = finish;
        u.onerror = finish;
        // safety net: some browsers never fire onend
        timer = setTimeout(finish, speechDelayMs(text) * 2 + 2000);
        synth.speak(u);
      });
    },
    stop() {
      if (synth && !muted) synth.cancel();
      finishCurrent?.();
    },
    setMuted(m) {
      muted = m;
      if (m) synth?.cancel();
    },
    setMood(m) {
      emit(m);
    },
    onMood(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

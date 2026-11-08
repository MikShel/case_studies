import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSimulatedAvatar, speechDelayMs } from '../src/avatar/AvatarAdapter';

describe('SimulatedAvatar without speechSynthesis', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('speak resolves after the timed delay', async () => {
    const a = createSimulatedAvatar(undefined);
    let done = false;
    a.speak('hello').then(() => (done = true));
    await vi.advanceTimersByTimeAsync(1199);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });

  it('stop resolves pending speech immediately and emits idle', async () => {
    const a = createSimulatedAvatar(undefined);
    const moods: string[] = [];
    a.onMood((m) => moods.push(m));
    const p = a.speak('hello there');
    a.stop();
    await p;
    expect(moods).toEqual(['speaking', 'idle']);
  });

  it('muted speech still paces with the delay', async () => {
    const synth = { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [] } as unknown as SpeechSynthesis;
    const a = createSimulatedAvatar(synth);
    a.setMuted(true);
    let done = false;
    a.speak('x'.repeat(50)).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(3000);
    expect(done).toBe(true);
    expect(synth.speak).not.toHaveBeenCalled();
  });
});

it('delay formula', () => {
  expect(speechDelayMs('x'.repeat(100))).toBe(6000);
  expect(speechDelayMs('hi')).toBe(1200);
});

it('pacing can be sped up for recordings, default unchanged', () => {
  const g = globalThis as { __avaMsPerChar?: number };
  expect(speechDelayMs('x'.repeat(100))).toBe(6000);
  g.__avaMsPerChar = 30;
  expect(speechDelayMs('x'.repeat(100))).toBe(3000);
  delete g.__avaMsPerChar;
});

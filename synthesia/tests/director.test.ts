import { describe, expect, it } from 'vitest';
import type { AvatarAdapter } from '../src/avatar/AvatarAdapter';
import { runSteps, type DirectorDeps } from '../src/avatar/director';
import type { HandoffRequest } from '../src/data/types';
import type { Step } from '../src/engine/session';

function fakeAvatar(log: string[]): AvatarAdapter {
  return {
    speak: async (t) => {
      log.push(`speak:${t}`);
    },
    stop: () => log.push('stop'),
    setMuted: () => {},
    setMood: () => {},
    onMood: () => () => {},
  };
}

function deps(log: string[], signal = new AbortController().signal): DirectorDeps {
  return {
    avatar: fakeAvatar(log),
    setTab: (t) => log.push(`tab:${t}`),
    highlight: (ids) => log.push(`hl:${ids.join(',')}`),
    clearHighlight: () => log.push('hl:none'),
    pageAction: (a, label) => log.push(`act:${a.length}:${label}`),
    addMessage: (m) => log.push(`msg:${m.text}`),
    setStep: (s) => log.push(`step:${s ? s.label : 'none'}`),
    showCard: (d) => log.push(`card:${d ? d.change : 'none'}`),
    send: (d) => log.push(`send:${d.change}`),
    addInfo: (id, t) => log.push(`info:${id}:${t}`),
    startCall: (d, who) => log.push(`call:${who}:${d.change}`),
    participantSay: async (who, t) => {
      log.push(`${who}:${t}`);
    },
    showSummary: (lines) => log.push(`summary:${lines.length}`),
    showAdminCard: (f) => log.push(`admincard:${f ? f.scope : 'none'}`),
    pauseMs: 0,
    signal,
  };
}

const draft = { change: 'Add Jordan Lee to cost centre SALES-DE' } as HandoffRequest;

describe('runSteps', () => {
  it('plays steps in order: UI first, then speech', async () => {
    const log: string[] = [];
    const steps: Step[] = [
      { kind: 'tab', tab: 'new-expense' },
      { kind: 'highlight', ids: ['exp-cc-filter'] },
      { kind: 'instruct', text: 'Switch the filter.', source: 'Expensio rollout guide · §3.2', label: 'Step 1 of 3' },
      { kind: 'say', text: 'Can you see it?' },
      { kind: 'handoffCard', draft },
      { kind: 'send', draft },
    ];
    await runSteps(steps, deps(log));
    expect(log).toEqual([
      'tab:new-expense',
      'hl:exp-cc-filter',
      'step:Step 1 of 3',
      'msg:Switch the filter.',
      'speak:Switch the filter.',
      'msg:Can you see it?',
      'speak:Can you see it?',
      `card:${draft.change}`,
      `send:${draft.change}`,
      'card:none',
    ]);
  });

  it('plays call steps: participants speak, summary and admin card shown', async () => {
    const log: string[] = [];
    await runSteps(
      [
        { kind: 'startCall', draft, with: 'lee' },
        { kind: 'participantSay', who: 'lee', text: 'Hi, Lee here.' },
        { kind: 'summaryCard', lines: [{ label: 'Problem', text: 'x' }] },
        { kind: 'say', text: 'Hi Lee.' },
        { kind: 'adminCard', fix: { scope: 'team', label: 'Map', affects: '38' } },
      ],
      deps(log),
    );
    expect(log).toEqual([`call:lee:${draft.change}`, 'lee:Hi, Lee here.', 'summary:1', 'msg:Hi Lee.', 'speak:Hi Lee.', 'admincard:team']);
  });

  it('stops at once when aborted', async () => {
    const log: string[] = [];
    const ctrl = new AbortController();
    const d = deps(log, ctrl.signal);
    d.avatar.speak = async (t) => {
      log.push(`speak:${t}`);
      ctrl.abort();
    };
    await runSteps(
      [
        { kind: 'say', text: 'one' },
        { kind: 'say', text: 'two' },
        { kind: 'handoffCard', draft },
      ],
      d,
    );
    expect(log).toEqual(['msg:one', 'speak:one']);
  });

  it('does nothing if already aborted', async () => {
    const log: string[] = [];
    const ctrl = new AbortController();
    ctrl.abort();
    await runSteps([{ kind: 'say', text: 'x' }], deps(log, ctrl.signal));
    expect(log).toEqual([]);
  });
});

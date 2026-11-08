import type { HandoffRequest, MockAction, MockTab } from '../data/types';
import type { AdminFix } from '../engine/call';
import type { Step } from '../engine/session';
import type { AvatarAdapter } from './AvatarAdapter';

export interface CurrentStep {
  label: string;
  source: string;
  text: string;
}

export interface DirectorDeps {
  avatar: AvatarAdapter;
  setTab(tab: MockTab): void;
  highlight(ids: string[]): void;
  clearHighlight(): void;
  /** Ava acts on the employee's screen (only ever after their yes) */
  pageAction(actions: MockAction[], label: string): void;
  addMessage(m: { from: 'avatar' | 'user'; text: string }): void;
  setStep(s: CurrentStep | null): void;
  showCard(draft: HandoffRequest | null): void;
  /** the employee said yes on the visible card: the request goes to the admin's inbox */
  send(draft: HandoffRequest): void;
  addInfo(requestId: string, text: string): void;
  /** the employee chose to call an available admin: the call view takes over */
  startCall(draft: HandoffRequest, withId: string): void;
  /** another person on the call speaks (resolves when done) */
  participantSay(who: string, text: string): Promise<void>;
  showSummary(lines: { label: string; text: string }[]): void;
  showAdminCard(fix: AdminFix | null): void;
  /** pause after moving the UI so the viewer's eye can follow */
  pauseMs: number;
  signal: AbortSignal;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Plays the engine's steps against the UI. Stops as soon as `signal` aborts (the user interrupted). */
export async function runSteps(steps: Step[], d: DirectorDeps): Promise<void> {
  for (const step of steps) {
    if (d.signal.aborted) return;
    switch (step.kind) {
      case 'tab':
        d.setTab(step.tab);
        if (d.pauseMs) await wait(d.pauseMs);
        break;
      case 'highlight':
        d.highlight(step.ids);
        if (d.pauseMs) await wait(d.pauseMs);
        break;
      case 'clearHighlight':
        d.clearHighlight();
        d.setStep(null);
        break;
      case 'pageAction':
        d.pageAction(step.actions, step.label);
        if (d.pauseMs) await wait(d.pauseMs);
        break;
      case 'instruct':
        d.setStep({ label: step.label, source: step.source, text: step.text });
        d.addMessage({ from: 'avatar', text: step.text });
        await d.avatar.speak(step.text);
        break;
      case 'say':
        d.addMessage({ from: 'avatar', text: step.text });
        await d.avatar.speak(step.text);
        break;
      case 'handoffCard':
        d.showCard(step.draft);
        break;
      case 'send':
        d.send(step.draft);
        d.showCard(null);
        break;
      case 'addInfo':
        d.addInfo(step.requestId, step.text);
        break;
      case 'startCall':
        d.startCall(step.draft, step.with);
        break;
      case 'participantSay':
        await d.participantSay(step.who, step.text);
        break;
      case 'summaryCard':
        d.showSummary(step.lines);
        break;
      case 'adminCard':
        d.showAdminCard(step.fix);
        break;
    }
  }
}

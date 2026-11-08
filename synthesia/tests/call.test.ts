import { describe, expect, it } from 'vitest';
import { createHistory } from '../src/data/seed';
import type { Config, World } from '../src/data/types';
import { afterApproval, callTurn, canCall, endCall, leeLines, openCall, type CallState } from '../src/engine/call';
import { insights } from '../src/engine/insights';
import { newSession, respond, type Session, type Step } from '../src/engine/session';
import { buildRequest } from '../src/engine/handoff';
import { resolveOnCall, sendRequest } from '../src/engine/world';
import { config, world } from './fixtures';

const history = createHistory();
const said = (steps: Step[]) =>
  steps
    .filter((x) => x.kind === 'say')
    .map((x) => (x as { text: string }).text)
    .join(' ');

/** Plays the cost-centre flow up to the visible handoff card. */
function toCard(c: Config, w: World): Session {
  let s = newSession;
  for (const line of ["I can't see my cost centre", 'yes', 'yes']) s = respond(c, w, s, line, false).session;
  expect(s.awaiting).toBe('handoff');
  return s;
}

function startedCall(): { c: Config; w: World; call: CallState; steps: Step[] } {
  const c = config();
  const w = world();
  const s = toCard(c, w);
  const { steps, call } = openCall(c, w, s.draft!, 'lee');
  return { c, w, call, steps };
}

describe('who can be called', () => {
  it('only available admins', () => {
    const w = world();
    expect(canCall(w, 'lee')).toBe(true);
    expect(canCall(w, 'tom')).toBe(false); // out of office
    expect(canCall(w, 'priya')).toBe(false); // not an admin
  });
});

describe('starting a call from the handoff card', () => {
  it('"Call Lee now" on a visible card starts the call', () => {
    const c = config();
    const w = world();
    const r = respond(c, w, toCard(c, w), 'Call Lee now', true);
    expect(r.steps).toContainEqual(expect.objectContaining({ kind: 'startCall', with: 'lee' }));
  });

  it('without a visible card, the card is shown again instead', () => {
    const c = config();
    const w = world();
    const r = respond(c, w, toCard(c, w), 'Call Lee now', false);
    expect(r.steps.some((x) => x.kind === 'startCall')).toBe(false);
    expect(r.steps.some((x) => x.kind === 'handoffCard')).toBe(true);
  });

  it('calling Tom, who is away, offers Lee instead', () => {
    const c = config();
    const w = world();
    const r = respond(c, w, toCard(c, w), 'Call Tom', true);
    expect(r.steps.some((x) => x.kind === 'startCall')).toBe(false);
    expect(said(r.steps)).toMatch(/out of office/);
    expect(said(r.steps)).toMatch(/Lee/);
  });
});

describe('the call', () => {
  it('Ava opens with the summary: diagnosis, what she checked, tried, change, source', () => {
    const { steps } = startedCall();
    const card = steps.find((x): x is Extract<Step, { kind: 'summaryCard' }> => x.kind === 'summaryCard')!;
    expect(card.lines.map((l) => l.label)).toEqual(['Problem', 'Checked', 'Already tried', 'Fix', 'Source']);
    const text = said(steps);
    expect(text).toMatch(/^Hi Lee/);
    expect(text).toMatch(/SALES-DE/);
    expect(text).toMatch(/switch(ed)? the cost-centre filter/i);
    expect(text).toMatch(/Known issues|rollout guide/);
  });

  it("Lee's first options include the check and a direct fix", () => {
    const { call } = startedCall();
    expect(leeLines(call)).toEqual(['Is anyone else hitting this?', "OK, I'll fix it for Jordan."]);
  });

  it('"anyone else?" is answered from anonymised insights: counts, no names', () => {
    const { c, w, call } = startedCall();
    const r = callTurn(c, w, history, call, 'admin', 'Is anyone else hitting this?');
    const text = said(r.steps);
    expect(text).toMatch(/38 people/);
    expect(text).toMatch(/Sales Germany/);
    for (const name of ['Priya', 'Marco', 'Tom']) expect(text).not.toContain(name);
    expect(r.call.phase).toBe('checked');
    expect(leeLines(r.call)).toContain("I'll fix the mapping for all of Sales Germany.");
  });

  it('Lee choosing the team fix shows an admin card; Ava never changes anything herself', () => {
    const { c, w, call } = startedCall();
    const r1 = callTurn(c, w, history, call, 'admin', 'Is anyone else hitting this?');
    const r2 = callTurn(c, w, history, r1.call, 'admin', "I'll fix the mapping for all of Sales Germany.");
    const card = r2.steps.find((x): x is Extract<Step, { kind: 'adminCard' }> => x.kind === 'adminCard')!;
    expect(card.fix.scope).toBe('team');
    for (const steps of [r1.steps, r2.steps]) expect(steps.some((x) => x.kind === 'send')).toBe(false);
  });

  it('after approval, Ava confirms only what she can see', () => {
    const { c, w, call } = startedCall();
    const r = callTurn(c, w, history, call, 'admin', "OK, I'll fix it for Jordan.");
    const notChanged = afterApproval(c, w, r.call);
    expect(said(notChanged.steps)).toMatch(/can't see/);
    const fixed = resolveOnCall(w, call.draft, 'lee', r.call.fix!, 'recap');
    const yes = afterApproval(c, fixed, r.call);
    expect(said(yes.steps)).toMatch(/SALES-DE on Jordan's account now/);
    expect(yes.call.phase).toBe('approved');
  });

  it('ending before approval says nothing was changed', () => {
    const { c, w, call } = startedCall();
    const r = endCall(c, w, call);
    expect(r.recap).toMatch(/No change was made/);
  });

  it('ending after approval recaps who changed what', () => {
    const { c, w, call } = startedCall();
    const r1 = callTurn(c, w, history, call, 'admin', 'Is anyone else hitting this?');
    const r2 = callTurn(c, w, history, r1.call, 'admin', "I'll fix the mapping for all of Sales Germany.");
    const fixed = resolveOnCall(w, call.draft, 'lee', r2.call.fix!, 'recap');
    const r3 = afterApproval(c, fixed, r2.call);
    const end = endCall(c, fixed, r3.call);
    expect(end.recap).toMatch(/Lee Wong/);
    expect(end.recap).toMatch(/Sales Germany/);
    expect(said(end.steps)).toMatch(/re-submit/);
  });
});

describe('resolving on the call', () => {
  it('one approved request with the recap, and the change applied', () => {
    const { w, call } = startedCall();
    const fixed = resolveOnCall(w, call.draft, 'lee', { scope: 'one', label: 'x', affects: 'y' }, 'Resolved on a call');
    expect(fixed.requests).toHaveLength(1);
    expect(fixed.requests[0]).toMatchObject({ status: 'approved', approvedBy: 'lee', note: 'Resolved on a call' });
    expect(fixed.employee.costCentres).toContain('SALES-DE');
    expect(fixed.configFixedBy).toBeUndefined();
  });

  it('team scope fixes the mapping, once', () => {
    const { w, call } = startedCall();
    const team = { scope: 'team' as const, label: 'x', affects: 'y' };
    const fixed = resolveOnCall(resolveOnCall(w, call.draft, 'lee', team, 'r'), call.draft, 'lee', team, 'r');
    expect(fixed.configFixedBy).toBe('lee');
    expect(fixed.requests).toHaveLength(1);
    expect(insights(history, fixed).actionable).toMatch(/fixed by Lee Wong/);
  });
});

describe('call review fixes', () => {
  it('C1: every Lee chip maps to its own branch; "Thanks, all good." never reopens an approval', () => {
    const { c, w, call } = startedCall();
    const r = callTurn(c, w, history, call, 'admin', "OK, I'll fix it for Jordan.");
    const fixed = resolveOnCall(w, call.draft, 'lee', r.call.fix!, 'recap');
    const approved = afterApproval(c, fixed, r.call).call;
    for (const chip of leeLines(approved)) {
      const t = callTurn(c, fixed, history, approved, 'admin', chip);
      expect(t.steps.some((x) => x.kind === 'adminCard'), chip).toBe(false);
      expect(t.call.phase).toBe('approved');
    }
    // team chip only offered after the check, and only it produces a team fix
    const checked = callTurn(c, w, history, call, 'admin', 'Is anyone else hitting this?').call;
    for (const chip of leeLines(checked)) {
      const t = callTurn(c, w, history, checked, 'admin', chip);
      expect(t.call.fix?.scope).toBe(chip.includes('Sales Germany') ? 'team' : 'one');
    }
  });

  it('C2: ending before approval puts the request card back, and "yes" sends it', () => {
    const { c, w, call } = startedCall();
    const end = endCall(c, w, call);
    expect(end.steps.some((x) => x.kind === 'handoffCard')).toBe(true);
    expect(end.session.awaiting).toBe('handoff');
    const yes = respond(c, w, end.session, 'yes', true);
    expect(yes.steps[0]).toMatchObject({ kind: 'send' });
  });

  it.each(["No, don't call anyone, just send it", "I'm on my phone, yes send it", 'no call'])('I3: "%s" does not start a call', (t) => {
    const c = config();
    const w = world();
    expect(respond(c, w, toCard(c, w), t, true).steps.some((x) => x.kind === 'startCall')).toBe(false);
  });

  it.each(['Call Lee now', 'please call Lee', 'call the backup admin'])('I3: "%s" starts a call', (t) => {
    const c = config();
    const w = world();
    expect(respond(c, w, toCard(c, w), t, true).steps).toContainEqual(expect.objectContaining({ kind: 'startCall', with: 'lee' }));
  });

  it('I4: a Payroll card cannot be turned into a call to an expense admin', () => {
    const c = config();
    const w = world();
    let s = newSession;
    for (const line of ['can you change my bank account', 'yes']) s = respond(c, w, s, line, false).session;
    expect(s.draft?.to).toBe('payroll');
    const r = respond(c, w, s, 'Call Lee', true);
    expect(r.steps.some((x) => x.kind === 'startCall')).toBe(false);
    expect(said(r.steps)).toMatch(/Payroll/);
  });

  it('I5: with nothing to approve (unknown issue), Lee can only take it over, never "fix" it', () => {
    const c = config();
    const w = world();
    const s = respond(c, w, newSession, 'How do I book a flight to Hamburg?', false).session;
    const { call } = openCall(c, w, s.draft!, 'lee');
    expect(leeLines(call)).not.toContain("OK, I'll fix it for Jordan.");
    const t = callTurn(c, w, history, call, 'admin', leeLines(call).at(-1)!);
    expect(t.steps.some((x) => x.kind === 'adminCard')).toBe(false);
    const end = endCall(c, w, t.call);
    expect(end.steps.some((x) => x.kind === 'handoffCard')).toBe(true);
  });

  it('I6: request ids stay unique and unrelated requests are kept', () => {
    const c = config();
    let w = world();
    w = sendRequest(w, buildRequest(c, w, 'unknown', [], 'flight booking'));
    w = resolveOnCall(w, buildRequest(c, w, 'cost-centre', []), 'lee', { scope: 'one', label: 'x', affects: 'y' }, 'r');
    w = sendRequest(w, buildRequest(c, w, 'unknown', [], 'hotel'));
    expect(w.requests.filter((r) => r.issueId === 'unknown')).toHaveLength(2);
    expect(new Set(w.requests.map((r) => r.id)).size).toBe(w.requests.length);
  });

  it('I7: the check answer is computed: how many, how many at the same step, which team', () => {
    const { c, w, call } = startedCall();
    const text = said(callTurn(c, w, history, call, 'admin', 'Is anyone else hitting this?').steps);
    expect(text).toMatch(/38 people/);
    expect(text).toMatch(/36 of them/);
    expect(text).toMatch(/all in Sales Germany/);
  });

  it('I7: unknown requests are not counted as one issue', () => {
    const c = config();
    const w = world();
    const s = respond(c, w, newSession, 'How do I book a flight to Hamburg?', false).session;
    const { call } = openCall(c, w, s.draft!, 'lee');
    const text = said(callTurn(c, w, history, call, 'admin', 'Is anyone else hitting this?').steps);
    expect(text).not.toMatch(/\d+ people/);
  });

  it('I9: "yes" to "call Lee instead?" calls Lee, not Tom', () => {
    const c = config();
    const w = world();
    const r1 = respond(c, w, toCard(c, w), 'Call Tom', true);
    expect(r1.steps.some((x) => x.kind === 'handoffCard')).toBe(true);
    const r2 = respond(c, w, r1.session, 'yes', true);
    expect(r2.steps).toContainEqual(expect.objectContaining({ kind: 'startCall', with: 'lee' }));
  });

  it('M16: the team fix says who it affects accurately', () => {
    const { c, w, call } = startedCall();
    const checked = callTurn(c, w, history, call, 'admin', 'Is anyone else hitting this?').call;
    const t = callTurn(c, w, history, checked, 'admin', "I'll fix the mapping for all of Sales Germany.");
    expect(t.call.fix?.affects).toBe('38 people in Sales Germany from week 1, plus Jordan');
  });
});

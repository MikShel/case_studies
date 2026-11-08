import { describe, expect, it } from 'vitest';
import type { Config, MockTab, Permission, World } from '../src/data/types';
import { respond, startFromContext, newSession, type Session, type Step } from '../src/engine/session';
import { applyMock, sendRequest } from '../src/engine/world';
import { config, world, withTag } from './fixtures';

const said = (steps: Step[]) =>
  steps
    .filter((x) => x.kind === 'say' || x.kind === 'instruct')
    .map((x) => (x as { text: string }).text)
    .join(' ');
const questions = (steps: Step[]) => steps.filter((x) => x.kind === 'say' && x.text.trim().endsWith('?')).length;
const without = (c: Config, ...ps: Permission[]): Config => ({ ...c, role: { ...c.role, ...Object.fromEntries(ps.map((p) => [p, false])) } });

/** Plays turns like the UI: page actions Ava performs land in the world; sends too. */
function play(c: Config, w: World, tab: MockTab, first: { steps: Step[]; session: Session }, lines: string[]) {
  const turns = [first];
  let s = first.session;
  const land = (steps: Step[]) => {
    for (const x of steps) {
      if (x.kind === 'pageAction') for (const a of x.actions) w = applyMock(w, a);
      if (x.kind === 'tab') tab = x.tab;
      if (x.kind === 'send') w = sendRequest(w, x.draft);
    }
  };
  land(first.steps);
  for (const l of lines) {
    const card = turns.at(-1)!.steps.some((x) => x.kind === 'handoffCard');
    const t = respond(c, w, s, l, card, tab);
    turns.push(t);
    s = t.session;
    land(t.steps);
  }
  return { turns, world: w, all: turns.flatMap((t) => t.steps) };
}

describe('looking is free, acting needs consent', () => {
  it('Ava starts from the page and offers to do the first step — no "can you see it?" question', () => {
    const r = startFromContext(config(), world(), 'cost-centre', 'new-expense');
    const text = said(r.steps);
    expect(text).toMatch(/I can see/);
    expect(text).toMatch(/I can switch the filter to All for you\. Shall I\?/);
    expect(text).not.toMatch(/Can you see SALES-DE/);
    expect(questions(r.steps)).toBe(1);
    expect(r.steps.some((x) => x.kind === 'pageAction')).toBe(false);
  });

  it('yes: Ava does it on the page, checks the page herself and moves on', () => {
    const { turns } = play(config(), world(), 'new-expense', startFromContext(config(), world(), 'cost-centre', 'new-expense'), ['yes']);
    const act = turns[1].steps.find((x): x is Extract<Step, { kind: 'pageAction' }> => x.kind === 'pageAction')!;
    expect(act.actions).toEqual([{ type: 'setFilter', v: 'all' }]);
    expect(said(turns[1].steps)).toMatch(/still isn't in the list/);
    expect(said(turns[1].steps)).toMatch(/I can press Refresh for you/);
  });

  it('no: the employee does it, Ava waits and then looks at the page', () => {
    const { turns } = play(config(), world(), 'new-expense', startFromContext(config(), world(), 'cost-centre', 'new-expense'), ['no', 'done']);
    expect(turns[1].steps.some((x) => x.kind === 'pageAction')).toBe(false);
    expect(said(turns[1].steps)).toMatch(/go ahead/i);
    expect(said(turns[2].steps)).toMatch(/still isn't in the list/);
  });

  it('switching to another tab is an action too', () => {
    const r = startFromContext(config(), world(), 'approval', 'new-expense');
    expect(said(r.steps)).toMatch(/I can open My approvals for you\. Shall I\?/);
    expect(r.steps.some((x) => x.kind === 'tab')).toBe(false);
  });

  it('receipt: Ava sees the file on the page and fixes it with one yes', () => {
    const w = applyMock(world(), { type: 'upload' });
    const first = startFromContext(config(), w, 'receipt', 'receipt');
    expect(said(first.steps)).toMatch(/HEIC/);
    expect(said(first.steps)).toMatch(/14\.2 MB/);
    const { turns, world: after } = play(config(), w, 'receipt', first, ['yes']);
    expect(after.employee.receipt.status).toBe('uploaded');
    expect(said(turns[1].steps)).toMatch(/upload worked/i);
  });

  it('every page action Ava takes is recorded in the audit log as done with the employee\'s OK', () => {
    const { all } = play(config(), world(), 'new-expense', startFromContext(config(), world(), 'cost-centre', 'new-expense'), ['yes']);
    const act = all.find((x): x is Extract<Step, { kind: 'pageAction' }> => x.kind === 'pageAction')!;
    expect(act.label).toMatch(/filter/i);
  });

  it('the re-tag twist: Ava offers to join SALES-DE and it resolves', () => {
    const c = withTag(config(), 'cost-centre', 'a3', 'user');
    const { turns, world: after } = play(c, world(), 'new-expense', startFromContext(c, world(), 'cost-centre', 'new-expense'), ['yes', 'yes', 'yes']);
    expect(after.employee.costCentres).toContain('SALES-DE');
    expect(said(turns[3].steps)).toMatch(/SALES-DE is there now/);
  });
});

describe("Ava's role: what she may check beyond the page", () => {
  const toAdmin = (c: Config) => play(c, world(), 'new-expense', startFromContext(c, world(), 'cost-centre', 'new-expense'), ['yes', 'yes']);

  it('with the full role, Ava finds the root cause in the audit log', () => {
    const text = said(toAdmin(config()).all);
    expect(text).toMatch(/I checked your account/);
    expect(text).toMatch(/audit log shows/);
    expect(text).toMatch(/mapped Sales Germany to DE-GENERAL/);
  });

  it('without the audit log, Ava says she is not allowed instead of guessing', () => {
    const { all } = toAdmin(without(config(), 'auditLog'));
    expect(said(all)).toMatch(/I'm not allowed to check the audit log/);
    expect(said(all)).not.toMatch(/mapped Sales Germany/);
    const card = all.find((x): x is Extract<Step, { kind: 'handoffCard' }> => x.kind === 'handoffCard')!;
    expect(card.draft.notChecked).toEqual(['the audit log']);
  });

  it("without the employee's account, the request carries no account diagnosis", () => {
    const { all } = toAdmin(without(config(), 'account'));
    expect(said(all)).not.toMatch(/I checked your account/);
    const card = all.find((x): x is Extract<Step, { kind: 'handoffCard' }> => x.kind === 'handoffCard')!;
    expect(card.draft.notChecked).toContain("Jordan's account");
    expect(card.draft.diagnosis).not.toMatch(/isn't assigned/);
  });

  it('without users and roles, Ava cannot tell who is available, so no call', () => {
    const c = without(config(), 'directory');
    const { turns } = toAdmin(c);
    const s = turns.at(-1)!.session;
    const r = respond(c, world(), s, 'Call Lee now', true, 'new-expense');
    expect(r.steps.some((x) => x.kind === 'startCall')).toBe(false);
    expect(said(r.steps)).toMatch(/not allowed to check who's available/);
  });

  it('nothing is ever changed as an admin, whatever the role', () => {
    const { all } = toAdmin(config());
    expect(all.some((x) => x.kind === 'send')).toBe(false);
    expect(newSession.awaiting).toBe('describe');
  });
});

it('"done" after doing a step yourself is thanked, not doubted; only an "it works" claim gets "can\'t see that yet"', () => {
  const first = startFromContext(config(), world(), 'cost-centre', 'new-expense');
  const done = play(config(), world(), 'new-expense', first, ['no', 'done']).turns[2];
  expect(said(done.steps)).not.toMatch(/can't see that/);
  expect(said(done.steps)).toMatch(/still isn't in the list/);
  const claim = play(config(), world(), 'new-expense', first, ['no', 'it works now']).turns[2];
  expect(said(claim.steps)).toMatch(/can't see that on the page yet/);
});

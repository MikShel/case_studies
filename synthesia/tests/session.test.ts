import { describe, expect, it } from 'vitest';
import type { Config, MockTab, World } from '../src/data/types';
import { effectiveTag } from '../src/engine/boundary';
import { closeGap } from '../src/engine/creatorTest';
import { isNo, isYes } from '../src/engine/intents';
import { followUp, newSession, respond, type Session, type Step } from '../src/engine/session';
import { answerInfo, applyMock, approveRequest, askInfo, sendRequest } from '../src/engine/world';
import { config, step, withTag, world } from './fixtures';

type Turn = { steps: Step[]; session: Session };

/** Plays lines like the UI does: a card is "visible" once a turn has shown it; sends land in the world. */
function drive(c: Config, w: World, lines: string[], s: Session = newSession): { turns: Turn[]; world: World; session: Session } {
  const turns: Turn[] = [];
  let cardVisible = false;
  let tab: MockTab = 'new-expense';
  for (const line of lines) {
    const t = respond(c, w, s, line, cardVisible, tab);
    turns.push(t);
    s = t.session;
    cardVisible = t.steps.some((x) => x.kind === 'handoffCard');
    for (const x of t.steps) {
      if (x.kind === 'send') w = sendRequest(w, x.draft);
      if (x.kind === 'pageAction') for (const a of x.actions) w = applyMock(w, a);
      if (x.kind === 'tab') tab = x.tab;
    }
  }
  return { turns, world: w, session: s };
}

const all = (turns: Turn[]) => turns.flatMap((t) => t.steps);
const said = (steps: Step[]) =>
  steps
    .filter((x) => x.kind === 'say' || x.kind === 'instruct')
    .map((x) => (x as { text: string }).text)
    .join(' ');

describe('yes/no', () => {
  it('only short replies count', () => {
    expect(isYes('yes please')).toBe(true);
    expect(isYes('Okay, so what about my receipt?')).toBe(false);
    expect(isNo('no thanks')).toBe(true);
    expect(isNo('no wait, my receipt is also broken')).toBe(false);
  });
});

describe('hard rules', () => {
  const lines = ['yes', 'no', 'no', 'no', 'no', 'yes'];
  const problems = ["I can't see my cost centre", 'my receipt upload fails', 'my approval is stuck', "can't open the team expense report", 'change my bank account', 'how do I book a flight'];
  for (const cfg of [
    ['seed', config()],
    ['gap closed', closeGap(config())],
    ['a3 user', withTag(config(), 'cost-centre', 'a3', 'user')],
  ] as const) {
    for (const p of problems) {
      it(`${cfg[0]}: "${p}" never instructs a non-user step, everything sourced, ≤ 1 question per turn`, () => {
        const c = cfg[1];
        const { turns } = drive(c, world(), [p, ...lines]);
        const instructions = all(turns).filter((x): x is Extract<Step, { kind: 'instruct' }> => x.kind === 'instruct');
        for (const ins of instructions) {
          expect(ins.source, ins.text).toBeTruthy();
          const s = c.issues.flatMap((i) => [...i.steps, ...(i.workaround ? [i.workaround] : [])]).find((x) => x.instruction === ins.text);
          if (s) expect(effectiveTag(s), ins.text).toBe('user');
        }
        for (const t of turns) {
          const questions = t.steps.filter((x) => x.kind === 'say' && x.text.trim().endsWith('?'));
          expect(questions.length, said(t.steps)).toBeLessThanOrEqual(1);
        }
      });
    }
  }

  it('never sends without a yes on a visible card', () => {
    const c = config();
    const t1 = respond(c, world(), newSession, "I can't see my cost centre", false);
    const t2 = respond(c, world(), t1.session, 'yes', false);
    const t4 = respond(c, world(), t2.session, 'yes', false); // reaches the card
    expect(t4.steps.some((x) => x.kind === 'handoffCard')).toBe(true);
    const hidden = respond(c, world(), t4.session, 'yes', false);
    expect(hidden.steps.some((x) => x.kind === 'send')).toBe(false);
    const visible = respond(c, world(), t4.session, 'yes', true);
    expect(visible.steps.some((x) => x.kind === 'send')).toBe(true);
  });

  it('a long sentence starting with "okay" does not send', () => {
    const c = config();
    const { turns } = drive(c, world(), ["I can't see my cost centre", 'yes', 'yes', 'Okay, so what about my receipt then?']);
    expect(all(turns).some((x) => x.kind === 'send')).toBe(false);
  });
});

describe('issue b: fully self-resolved', () => {
  it('Ava sees the file on the page, fixes it with one yes, and no card is needed', () => {
    const c = config();
    // typed from New expense: the first yes opens the Receipt tab, the second uploads the JPG
    const r = drive(c, applyMock(world(), { type: 'upload' }), ['My receipt upload keeps failing', 'yes', 'yes']);
    expect(said(all(r.turns))).toMatch(/IMG_2041\.HEIC/);
    expect(said(r.turns[2].steps)).toMatch(/upload worked/i);
    expect(all(r.turns).some((x) => x.kind === 'handoffCard')).toBe(false);
  });

  it('if the user says it worked but the page disagrees, Ava says what she sees', () => {
    const c = config();
    const r = drive(c, world(), ['My receipt upload keeps failing', 'yes', 'no', 'yes it works']);
    expect(said(r.turns[3].steps)).toMatch(/still/i);
    expect(said(r.turns[3].steps)).not.toMatch(/upload worked/i);
  });
});

describe('issue a: user steps, then a clean handoff', () => {
  const c = config();
  const r = drive(c, world(), ["I can't see my cost centre", 'yes', 'yes', 'yes']);
  const card = all(r.turns).find((x): x is Extract<Step, { kind: 'handoffCard' }> => x.kind === 'handoffCard')!;

  it('highlights each user step in the mock app with its source', () => {
    const ins = all(r.turns).filter((x): x is Extract<Step, { kind: 'instruct' }> => x.kind === 'instruct');
    expect(ins[0]).toMatchObject({ source: 'Expensio rollout guide · §3.2', label: 'Step 1 of 3' });
    expect(all(r.turns)).toContainEqual({ kind: 'highlight', ids: ['exp-cc-filter'] });
  });

  it('says plainly that the next part needs an admin, and why', () => {
    expect(said(all(r.turns))).toMatch(/needs an admin/);
    expect(said(all(r.turns))).toMatch(/not assigned to SALES-DE/);
  });

  it('offers the workaround with its source', () => {
    const w = all(r.turns).find((x): x is Extract<Step, { kind: 'instruct' }> => x.kind === 'instruct' && x.text.includes('DE-GENERAL'));
    expect(w).toMatchObject({ source: 'Expensio FAQ · Q5', label: 'Meanwhile' });
  });

  it('the card is a ready-to-approve request', () => {
    expect(card.draft).toMatchObject({
      issueId: 'cost-centre',
      change: 'Add Jordan Lee to cost centre SALES-DE',
      undocumented: false,
      to: 'tom',
      effect: { type: 'addCostCentre', cc: 'SALES-DE' },
    });
    expect(card.draft.tried).toEqual([step(c, 'cost-centre', 'a1').instruction, step(c, 'cost-centre', 'a2').instruction]);
    expect(card.draft.diagnosis).toMatch(/SALES-DE/);
  });

  it('after sending: waiting status, workaround reminder, promise to follow up', () => {
    const sent = r.turns.at(-1)!;
    expect(sent.steps[0]).toMatchObject({ kind: 'send' });
    expect(said(sent.steps)).toMatch(/waiting for admin/i);
    expect(said(sent.steps)).toMatch(/DE-GENERAL/);
    expect(said(sent.steps)).toMatch(/let you know when it's approved/);
    expect(r.world.requests).toHaveLength(1);
  });

  it('asking again does not create a duplicate', () => {
    const again = drive(c, r.world, ["I still can't see my cost centre"], r.session);
    expect(again.turns[0].steps.some((x) => x.kind === 'handoffCard')).toBe(false);
    expect(said(again.turns[0].steps)).toMatch(/already sent/);
  });

  it('after approval Ava follows up and offers to re-submit', () => {
    const approved = approveRequest(r.world, r.world.requests[0].id, 'tom');
    const f = followUp(c, approved, approved.requests[0], r.session);
    expect(said(f.steps)).toMatch(/SALES-DE/);
    expect(said(f.steps)).toMatch(/re-submit/);
    const yes = respond(c, approved, f.session, 'yes', false);
    expect(yes.steps).toContainEqual({ kind: 'tab', tab: 'new-expense' });
  });
});

describe('the boundary drives the session live', () => {
  it('re-tagging a3 to "User can do" mid-session changes the next step', () => {
    const c = config();
    const r1 = drive(c, world(), ["I can't see my cost centre", 'yes']);
    const retagged = withTag(c, 'cost-centre', 'a3', 'user');
    const r2 = drive(retagged, r1.world, ['yes'], r1.session);
    expect(said(r2.turns[0].steps)).toMatch(/join SALES-DE for you/);
    expect(r2.turns[0].steps.some((x) => x.kind === 'handoffCard')).toBe(false);
    const r3 = drive(retagged, r2.world, ['yes'], r2.session);
    expect(r3.turns[0].steps).toContainEqual({ kind: 'tab', tab: 'profile' });
    expect(said(r3.turns[0].steps)).toMatch(/SALES-DE is there now/);
  });
});

describe('issue c: the gap', () => {
  it('on the seed the request is flagged undocumented', () => {
    const r = drive(config(), world(), ['my approval is stuck', 'yes']);
    const card = all(r.turns).find((x): x is Extract<Step, { kind: 'handoffCard' }> => x.kind === 'handoffCard')!;
    expect(card.draft.undocumented).toBe(true);
    expect(said(all(r.turns))).toMatch(/Priya Shah/);
  });

  it('after closing the gap, Ava first suggests a colleague, and the request is documented', () => {
    const r = drive(closeGap(config()), world(), ['my approval is stuck', 'yes', 'no']);
    expect(said(all(r.turns))).toMatch(/Marco Rossi/);
    const card = all(r.turns).find((x): x is Extract<Step, { kind: 'handoffCard' }> => x.kind === 'handoffCard')!;
    expect(card.draft).toMatchObject({ undocumented: false, effect: { type: 'setDelegate', forId: 'priya', delegateId: 'marco' } });
  });
});

describe('issue d: explains why without exposing anyone', () => {
  it('names the missing role and no other people', () => {
    const r = drive(config(), world(), ["I can't open the team expense report", 'yes']);
    const text = said(all(r.turns));
    expect(text).toMatch(/Report viewer/);
    // the admin it's sent to may be named; colleagues and their data may not
    for (const name of ['Priya', 'Marco']) expect(text).not.toContain(name);
    expect(text).not.toMatch(/€/);
  });
});

describe('never via avatar and unknown requests', () => {
  it('bank details go to Payroll without collecting anything', () => {
    const r = drive(config(), world(), ['can you change my bank account', 'yes']);
    const card = all(r.turns).find((x): x is Extract<Step, { kind: 'handoffCard' }> => x.kind === 'handoffCard')!;
    expect(card.draft.to).toBe('payroll');
    expect(said(all(r.turns))).toMatch(/never handle/);
  });

  it('unknown: "I don\'t know that one", then an honest handoff', () => {
    const r = drive(config(), world(), ['How do I book a flight?']);
    expect(said(r.turns[0].steps)).toMatch(/I don't know that one/);
    const card = r.turns[0].steps.find((x): x is Extract<Step, { kind: 'handoffCard' }> => x.kind === 'handoffCard')!;
    expect(card.draft).toMatchObject({ issueId: 'unknown', undocumented: true });
    expect(r.turns[0].steps.some((x) => x.kind === 'instruct')).toBe(false);
  });

  it('a garbled reply during a check moves on instead of repeating the question', () => {
    const r = drive(config(), world(), ["I can't see my cost centre", 'yes', 'blorp']);
    const q1 = r.turns[1].steps.filter((x) => x.kind === 'say').at(-1);
    const q2 = r.turns[2].steps.filter((x) => x.kind === 'say').at(-1);
    expect(q1).not.toEqual(q2);
  });
});


describe('final review fixes', () => {
  it('C1: after the re-tag, "no" to the last step then "yes" sends instead of crashing', () => {
    const c = withTag(config(), 'cost-centre', 'a3', 'user');
    const r = drive(c, world(), ["I can't see my cost centre", 'yes', 'yes', 'no', 'done', 'yes']);
    expect(r.turns.at(-1)!.steps[0]).toMatchObject({ kind: 'send' });
  });

  it('M1: the "ran out of steps" request has no source and is undocumented', () => {
    const c = withTag(config(), 'cost-centre', 'a3', 'user');
    const r = drive(c, world(), ["I can't see my cost centre", 'yes', 'yes', 'no', 'done']);
    const card = r.turns.at(-1)!.steps.find((x): x is Extract<Step, { kind: 'handoffCard' }> => x.kind === 'handoffCard')!;
    expect(card.draft).toMatchObject({ undocumented: true, source: undefined });
  });

  it.each(['Correct', "That's right", 'exactly', 'yup'])('I1: "%s" accepts Ava\'s offer', (t) => {
    const r = drive(config(), world(), ["I can't see my cost centre", t]);
    expect(r.turns[1].steps.some((x) => x.kind === 'pageAction')).toBe(true);
  });

  it('I1: an unclear reply to an offer leaves the step to the employee instead of opening a handoff', () => {
    const r = drive(config(), world(), ["I can't see my cost centre", 'hmm']);
    expect(r.turns[1].steps.some((x) => x.kind === 'handoffCard' || x.kind === 'pageAction')).toBe(false);
    expect(r.turns[1].session.awaiting).toBe('check');
  });

  it.each(['Thanks!', 'thank you', "that's all"])('I1: "%s" closes politely, no handoff', (t) => {
    const r = drive(config(), world(), ['My receipt upload keeps failing', t]);
    expect(r.turns[1].steps.some((x) => x.kind === 'handoffCard')).toBe(false);
  });

  it('I1: a very short unknown request asks for more instead of handing off', () => {
    const r = drive(config(), world(), ['hmm ok']);
    expect(r.turns[0].steps.some((x) => x.kind === 'handoffCard')).toBe(false);
  });

  it('I2: re-tagging an admin step to Never does not talk about payment data or Payroll', () => {
    const c = withTag(config(), 'cost-centre', 'a3', 'never');
    const r = drive(c, world(), ["I can't see my cost centre", 'yes', 'yes']);
    const text = said(all(r.turns));
    expect(text).not.toMatch(/payment|Payroll|bank/);
    const card = all(r.turns).find((x): x is Extract<Step, { kind: 'handoffCard' }> => x.kind === 'handoffCard')!;
    expect(card.draft.to).toBe('tom');
  });

  it('I3: the admin line reports the boundary, not a claim about the account', () => {
    const r = drive(config(), world(), ["I can't see my cost centre", 'yes', 'yes']);
    expect(said(all(r.turns))).not.toMatch(/not something you can do from your account/);
  });

  it('I6: after "ask for info", the reply goes into the request and it is waiting again', () => {
    let w = drive(config(), world(), ["I can't see my cost centre", 'yes', 'yes', 'yes']).world;
    w = askInfo(w, w.requests[0].id, 'lee', 'Which expense is this for?');
    const f = followUp(config(), w, w.requests[0], newSession);
    const reply = respond(config(), w, f.session, 'The taxi to Hamburg Messe', false);
    const add = reply.steps.find((x): x is Extract<Step, { kind: 'addInfo' }> => x.kind === 'addInfo')!;
    expect(add).toMatchObject({ requestId: w.requests[0].id, text: 'The taxi to Hamburg Messe' });
    const w2 = answerInfo(w, add.requestId, add.text);
    expect(w2.requests[0].status).toBe('waiting');
    expect(w2.requests[0].note).toMatch(/Hamburg Messe/);
  });

  it('M10: resolving or sending clears the step panel', () => {
    const r = drive(config(), world(), ["I can't see my cost centre", 'yes', 'yes', 'yes']);
    expect(r.turns.at(-1)!.steps.some((x) => x.kind === 'clearHighlight')).toBe(true);
  });
});

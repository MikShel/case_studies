import { useEffect, useState } from 'react';
import { useStore, type StoreAction, type StoreState } from '../store/AppStore';
import { AVA_CALL_EVENT, AVA_SAY_EVENT } from './employee/AvaPanel';

type Ctx = { dispatch: (a: StoreAction) => void; get: () => StoreState; say: (t: string) => void };
/** returns a hint instead of advancing when the demo state isn't ready for this action */
type Action = { label: string; run: (c: Ctx) => string | void };
type Beat = { title: string; talk: string; actions: Action[] };

const say = (t: string): Action => ({
  label: `Jordan: "${t}"`,
  run: (c) => {
    if (c.get().view !== 'employee') c.dispatch({ type: 'setView', view: 'employee' });
    if (!c.get().support.open) c.dispatch({ type: 'openSupport', issueId: null });
    c.say(t);
  },
});
/** the presenter plays the admin on the live call */
const onCall = (label: string, detail: { type: 'line' | 'approve' | 'end'; text?: string }): Action => ({
  label,
  run: (c) => {
    if (c.get().view !== 'employee') c.dispatch({ type: 'setView', view: 'employee' });
    setTimeout(() => window.dispatchEvent(new CustomEvent(AVA_CALL_EVENT, { detail })), 80);
  },
});
const lee = (t: string) => onCall(`Lee: "${t}"`, { type: 'line', text: t });

const go = (label: string, ...acts: StoreAction[]): Action => ({ label, run: (c) => acts.forEach(c.dispatch) });

const BEATS: Beat[] = [
  {
    title: '1 · Creator: draw the boundary, test, publish',
    talk: 'The creator connects the rollout docs. Ava flags a gap. Unclear steps default to Needs admin. Publish is locked until the tests pass.',
    actions: [
      go('Connect the rollout sources', { type: 'setView', view: 'creator' }, { type: 'setCreatorTab', tab: 'knowledge' }, { type: 'connect' }),
      go('Open the boundary editor', { type: 'setCreatorTab', tab: 'boundary' }),
      go('Run the tests: the approval scenario fails', { type: 'setCreatorTab', tab: 'test' }),
      go('Close the gap: rollout note + new step', { type: 'closeGap' }),
      go('Publish', { type: 'publish' }),
    ],
  },
  {
    title: '2 · Employee: a receipt, fully self-resolved',
    talk: "Help opens where it failed. Ava sees the page (file, format, size), so there's no 'is it broken?'. She offers to fix it; one yes and she does it on Jordan's screen. Not everything escalates.",
    actions: [
      go('Open the employee session', { type: 'setView', view: 'employee' }),
      go('Jordan uploads IMG_2041.HEIC: it fails', { type: 'setMockTab', tab: 'receipt' }, { type: 'mock', action: { type: 'upload' } }),
      go('Jordan clicks "Get help": Ava starts from the failed upload', { type: 'openSupport', issueId: 'receipt' }),
      say('Yes'),
    ],
  },
  {
    title: '3 · Employee: cost centre, a clean async handoff',
    talk: "Ava sees the page and offers each user step ('Shall I?'); every click is Jordan's OK. Then she says plainly it needs an admin, uses her role to find why (account, audit log), gives a workaround, and prepares the request. Tom is away.",
    actions: [
      go('Jordan can\'t find SALES-DE and clicks "Get help"', { type: 'setMockTab', tab: 'new-expense' }, { type: 'openSupport', issueId: 'cost-centre' }),
      say('Yes'),
      say('Yes'),
      say('Yes'),
    ],
  },
  {
    title: '4 · Admin: approve in one click',
    talk: 'Lee, the backup admin, gets a ready-to-approve request: diagnosis, exact change, steps tried, source.',
    actions: [
      go('Open the admin inbox as Lee', { type: 'setView', view: 'admin' }, { type: 'setAdminTab', tab: 'inbox' }, { type: 'setInboxAs', who: 'lee' }),
      {
        label: 'Approve',
        run: (c) => {
          const r = c.get().world.requests.find((x) => x.status === 'waiting');
          if (!r) return 'Nothing is waiting yet: go back and send the request from the handoff card first.';
          c.dispatch({ type: 'approve', id: r.id, by: 'lee' });
        },
      },
      go('Back to Jordan: Ava follows up', { type: 'setView', view: 'employee' }),
      say('Yes'),
    ],
  },
  {
    title: '5 · Insights: fix the config, not the tickets',
    talk: 'Week 1, aggregated and anonymised. 38 people stuck on the same step points to the rollout config, not to 38 tickets.',
    actions: [go('Open rollout insights', { type: 'setView', view: 'admin' }, { type: 'setAdminTab', tab: 'insights' })],
  },
  {
    title: '6 · Live twist: the boundary drives the session',
    talk: 'The creator decides Sales can join SALES-DE themselves. One tag change, and the same problem now resolves without a ticket.',
    actions: [
      go('Creator: open the boundary editor', { type: 'setView', view: 'creator' }, { type: 'setCreatorTab', tab: 'boundary' }),
      go('Re-tag "Join SALES-DE yourself" → User can do', { type: 'setTag', issueId: 'cost-centre', stepId: 'a3', tag: 'user' }),
      go('New employee session (Jordan reset)', { type: 'resetEmployee' }, { type: 'setView', view: 'employee' }),
      go('Jordan can\'t find SALES-DE and clicks "Get help"', { type: 'setMockTab', tab: 'new-expense' }, { type: 'openSupport', issueId: 'cost-centre' }),
      say('Yes'),
      say('Yes'),
      { label: 'Jordan: "Yes" (Ava opens Profile and joins SALES-DE)', run: (c) => say('Yes').run(c) },
    ],
  },
  {
    title: '7 · Escalate live: call the backup admin',
    talk: "Async is the default, but Lee is around. Jordan calls; Ava opens with the summary so nobody repeats anything. Lee asks Ava to check, then fixes the mapping for everyone.",
    actions: [
      go(
        'New Jordan session; "Join SALES-DE yourself" back to Needs admin',
        { type: 'setTag', issueId: 'cost-centre', stepId: 'a3', tag: undefined },
        { type: 'resetEmployee' },
        { type: 'setView', view: 'employee' },
      ),
      go('Jordan can\'t find SALES-DE and clicks "Get help"', { type: 'setMockTab', tab: 'new-expense' }, { type: 'openSupport', issueId: 'cost-centre' }),
      say('Yes'),
      say('Yes'),
      { label: 'Jordan taps "📞 Call Lee now": Ava joins and gives the summary', run: (c) => say('Call Lee now').run(c) },
      lee('Is anyone else hitting this?'),
      lee("I'll fix the mapping for all of Sales Germany."),
      onCall('Lee approves on the call', { type: 'approve' }),
      onCall('End call: recap saved', { type: 'end' }),
      go('Insights: fixed on a call', { type: 'setView', view: 'admin' }, { type: 'setAdminTab', tab: 'insights' }),
    ],
  },
  {
    title: "8 · Ava's role: least privilege",
    talk: "The admin decides what Ava may check beyond the screen. Take away the audit log, and Ava says she isn't allowed to look instead of guessing; the request says what wasn't checked.",
    actions: [
      go("Admin: open Ava's role", { type: 'setView', view: 'admin' }, { type: 'setAdminTab', tab: 'role' }),
      go('Switch off "The audit log"', { type: 'setPermission', permission: 'auditLog', allowed: false }),
      go('New Jordan session', { type: 'resetEmployee' }, { type: 'setView', view: 'employee' }),
      go('Jordan can\'t find SALES-DE and clicks "Get help"', { type: 'setMockTab', tab: 'new-expense' }, { type: 'openSupport', issueId: 'cost-centre' }),
      say('Yes'),
      say('Yes'),
      go("Admin: back to Ava's role (the audit log shows every action Ava took with Jordan's OK)", { type: 'setView', view: 'admin' }, { type: 'setAdminTab', tab: 'role' }),
    ],
  },
];

export function GuidedDemo() {
  const { dispatch, get, avaBusy, generation } = useStore();
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [hint, setHint] = useState('');
  const [beat, setBeat] = useState(0);
  const [done, setDone] = useState(0);
  const [min, setMin] = useState(false);
  // let the employee view mount/activate before Ava hears the line
  const ctx: Ctx = { dispatch, get, say: (t) => setTimeout(() => window.dispatchEvent(new CustomEvent(AVA_SAY_EVENT, { detail: t })), 80) };

  // "Reset demo" starts the script over too
  useEffect(() => {
    setBeat(0);
    setDone(0);
    setHint('');
  }, [generation]);

  const start = () => {
    dispatch({ type: 'resetAll' });
    setStarted(true);
    setOpen(true);
  };
  const b = BEATS[beat];
  const next = () => {
    if (done < b.actions.length) {
      const problem = b.actions[done].run(ctx);
      setHint(problem ?? '');
      if (!problem) setDone(done + 1);
    } else if (beat < BEATS.length - 1) {
      setBeat(beat + 1);
      setDone(0);
    }
  };

  return (
    <>
      <button className="btn btn-primary" onClick={started ? () => setOpen(true) : start}>
        ▶ Guided demo
      </button>
      {open && (
        <div className={`guide ${min ? 'guide-min' : ''}`} role="dialog" aria-label="Guided demo">
          <div className="guide-head">
            <b>{b.title}</b>
            <span>
              <button className="icon" title={min ? 'Expand' : 'Collapse'} onClick={() => setMin(!min)}>
                {min ? '▴' : '▾'}
              </button>
              <button className="icon" title="Restart the demo" onClick={start}>
                ↺
              </button>
              <button className="icon" title="Hide (keeps your place)" onClick={() => setOpen(false)}>
                ✕
              </button>
            </span>
          </div>
          {!min && <p className="small">{b.talk}</p>}
          <ol className="guide-actions" hidden={min}>
            {b.actions.map((a, i) => (
              <li key={a.label + i} className={i < done ? 'done' : i === done ? 'current' : ''}>
                {a.label}
              </li>
            ))}
          </ol>
          {hint && <div className="guide-hint">{hint}</div>}
          {avaBusy && <div className="small muted">Ava is talking… Next unlocks when she's done.</div>}
          <div className="guide-nav">
            <button className="btn btn-ghost" disabled={beat === 0} onClick={() => (setBeat(beat - 1), setDone(0))}>
              ◀ Beat
            </button>
            <span className="small muted">
              {beat + 1} / {BEATS.length}
            </span>
            <button className="btn btn-primary" data-guide-next onClick={next} disabled={avaBusy || (done >= b.actions.length && beat === BEATS.length - 1)}>
              {done < b.actions.length ? 'Next ▶' : 'Next beat ▶▶'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

import type { Config, HandoffRequest, IssueId, PastSession, World } from '../data/types';
import { issueById, sourceLabel } from './boundary';
import { diagnose, isResolved } from './diagnose';
import { isThanks } from './intents';
import { newSession, type Session, type Step } from './session';
import { formatDay } from './time';

/** What the admin approves on the call. Ava proposes nothing herself; she only shows Lee's own choice. */
export interface AdminFix {
  scope: 'one' | 'team';
  label: string;
  affects: string;
}

export interface CallState {
  draft: HandoffRequest;
  with: string;
  phase: 'summary' | 'checked' | 'deciding' | 'approved' | 'handed' | 'ended';
  fix?: AdminFix;
}

type Result = { steps: Step[]; call: CallState };

const say = (text: string): Step => ({ kind: 'say', text });
const person = (w: World, id: string) => w.people.find((p) => p.id === id);
const first = (name: string) => name.split(' ')[0];

const ASK_OTHERS = 'Is anyone else hitting this?';
const FIX_ONE = "OK, I'll fix it for Jordan.";
const FIX_TEAM = "I'll fix the mapping for all of Sales Germany.";
const THANKS = 'Thanks, all good.';
const TAKE_OVER = "I'll take it from here.";

/** Is there a concrete, documented change the admin could approve on the call? */
function fixable(d: HandoffRequest): boolean {
  return d.effect.type !== 'none' && !d.undocumented;
}

/** Only admins who are around right now can be called. */
export function canCall(w: World, personId: string): boolean {
  const p = person(w, personId);
  return !!p && /admin/i.test(p.role) && !p.outOfOfficeUntil;
}

/** Who a "call …" request means; undefined unless it's an explicit request to call someone. */
export function callTarget(w: World, text: string): string | undefined {
  const t = text.toLowerCase().trim();
  const m = /^(please\s+)?(can you\s+)?(call|ring)\s+(lee|tom|the backup( admin)?|an admin|the admin)\b/.exec(t);
  if (!m) return undefined;
  if (m[4] === 'tom') return 'tom';
  if (m[4] === 'lee' || m[4].startsWith('the backup')) return 'lee';
  return w.people.find((p) => canCall(w, p.id))?.id;
}

/** What Ava looked at on the employee's account, in one line, for the admin. */
function checked(id: IssueId | 'unknown', w: World): string {
  const e = w.employee;
  switch (id) {
    case 'cost-centre':
      return `${first(e.name)}'s cost centres are ${e.costCentres.join(', ')} only, so SALES-DE can't be picked.`;
    case 'report':
      return `${first(e.name)}'s roles are ${e.roles.join(', ')}; no Report viewer.`;
    case 'approval': {
      const approver = person(w, e.approval.approverId);
      return `The expense is waiting on ${approver?.name}${approver?.outOfOfficeUntil ? `, out of office until ${formatDay(approver.outOfOfficeUntil)}` : ''}, with no delegate.`;
    }
    case 'unknown':
      return "It isn't covered by the troubleshooting guide.";
    default:
      return diagnose(id, w).why;
  }
}

/** What Ava looked at, honest about what her role didn't let her check. */
function checkedText(draft: HandoffRequest, w: World): string {
  const not = draft.notChecked ?? [];
  const accountBlocked = not.some((n) => /account/.test(n));
  const seen = accountBlocked ? '' : checked(draft.issueId, w);
  return [seen, not.length ? `Not allowed to check: ${not.join(', ')}.` : ''].filter(Boolean).join(' ');
}

function lowerFirst(t: string): string {
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/** Ava's opening: the summary, so the admin doesn't have to ask the employee to repeat anything. */
export function openCall(c: Config, w: World, draft: HandoffRequest, withId: string): Result {
  const admin = person(w, withId)!;
  const src = sourceLabel(c, draft.source);
  const tried = draft.tried.map((t) => lowerFirst(t).replace(/\.$/, ''));
  const lines = [
    { label: 'Problem', text: draft.diagnosis },
    { label: 'Checked', text: checkedText(draft, w) },
    { label: 'Already tried', text: tried.length ? tried.join('; ') : 'Nothing yet' },
    { label: 'Fix', text: draft.change },
    { label: 'Source', text: src ?? 'Undocumented: needs investigation' },
  ];
  return {
    steps: [
      { kind: 'participantSay', who: withId, text: `Hi, ${first(admin.name)} here.` },
      { kind: 'summaryCard', lines },
      say(`Hi ${first(admin.name)}, thanks for jumping on. Quick summary.`),
      say(draft.diagnosis),
      say(`I checked: ${checkedText(draft, w)}`),
      ...(tried.length ? [say(`We already tried: ${tried.join(', and ')}.`)] : []),
      say(src ? `The documented fix, from ${src}, is: ${lowerFirst(draft.change)}.` : `There's no documented fix, so it needs investigating: ${lowerFirst(draft.change)}.`),
      say('How would you like to handle it?'),
    ],
    call: { draft, with: withId, phase: 'summary' },
  };
}

/** The admin's suggested lines, for the presenter to click. */
export function leeLines(call: CallState): string[] {
  const team = call.draft.issueId === 'cost-centre';
  const decide = fixable(call.draft) ? FIX_ONE : TAKE_OVER;
  switch (call.phase) {
    case 'summary':
      return call.draft.issueId === 'unknown' ? [decide] : [ASK_OTHERS, decide];
    case 'checked':
      return team && fixable(call.draft) ? [FIX_TEAM, FIX_ONE] : [decide];
    case 'approved':
    case 'handed':
      return [THANKS];
    default:
      return [];
  }
}

function weekCount(h: PastSession[], id: IssueId | 'unknown'): number {
  return h.filter((s) => s.issueId === id).length;
}

/** "Anyone else?" — computed from the anonymised history: how many, how many at the same step, which team. */
function othersAnswer(h: PastSession[], id: IssueId | 'unknown'): string[] {
  if (id === 'unknown') return ["Questions the guide doesn't cover aren't tracked as one issue, so I can't compare this one."];
  const sessions = h.filter((s) => s.issueId === id);
  const byStep = new Map<string, number>();
  for (const s of sessions) if (s.stuckStepId) byStep.set(s.stuckStepId, (byStep.get(s.stuckStepId) ?? 0) + 1);
  const same = Math.max(0, ...byStep.values());
  const teams = [...new Set(sessions.map((s) => s.team))];
  const lines = [`I checked the rollout insights: ${sessions.length} people hit this in week 1, and ${same} of them got stuck at the same step.`];
  if (teams.length === 1 && teams[0]) lines.push(`They're all in ${teams[0]}.`);
  return lines;
}

/** One turn on the call. Ava checks things and reports; the admin decides. */
export function callTurn(c: Config, w: World, h: PastSession[], call: CallState, who: 'admin' | 'employee', text: string): Result {
  const t = text.toLowerCase();
  const admin = first(person(w, call.with)?.name ?? 'there');

  if (who === 'employee') {
    if (isThanks(text)) return { steps: [say(`You're welcome, ${first(w.employee.name)}.`)], call };
    return { steps: [say(`I'll let ${admin} take that one.`)], call };
  }

  // once decided, Lee's lines can only be pleasantries — never reopen a decision
  if (call.phase === 'approved' || call.phase === 'handed' || call.phase === 'deciding') {
    if (isThanks(text) || /\bthanks\b/.test(t)) return { steps: [say(`Thanks, ${admin}.`)], call };
    return { steps: [say(`Sorry, ${admin}, I didn't catch that.`)], call };
  }

  if (/anyone else|other people|\bothers\b|how many/.test(t)) {
    if (!c.role.insights) return { steps: [say("I'm not allowed to look at rollout insights, so I can't tell.")], call: { ...call, phase: 'checked' } };
    const lines = othersAnswer(h, call.draft.issueId);
    const steps: Step[] = lines.map(say);
    if (call.draft.issueId === 'cost-centre') {
      steps.push(say("That points to the rollout mapping rather than Jordan's account."), say('Do you want to fix it just for Jordan, or the mapping for everyone?'));
    } else if (fixable(call.draft)) {
      steps.push(say('Shall we fix it for Jordan now?'));
    }
    return { steps, call: { ...call, phase: 'checked' } };
  }

  if (/take it from here/.test(t)) {
    return { steps: [say(`Thanks, ${admin}. When we hang up I'll put the request on Jordan's screen, so it's tracked to you.`)], call: { ...call, phase: 'handed' } };
  }

  const team = call.draft.issueId === 'cost-centre' && fixable(call.draft) && /\ball of\b|\beveryone\b|\bmapping\b/.test(t);
  const one = fixable(call.draft) && /fix it for|\bjust jordan\b|\bonly jordan\b/.test(t);
  if (team || one) {
    const n = weekCount(h, call.draft.issueId);
    const fix: AdminFix = team
      ? { scope: 'team', label: 'Map Sales Germany to SALES-DE in the rollout config', affects: `${n} people in Sales Germany from week 1, plus Jordan` }
      : { scope: 'one', label: call.draft.change, affects: call.draft.affects };
    return {
      steps: [say(`OK. ${admin}, it's on your screen to approve.`), { kind: 'adminCard', fix }],
      call: { ...call, phase: 'deciding', fix },
    };
  }

  return { steps: [say(`Sorry, ${admin}, I didn't catch that.`)], call };
}

const CONFIRM: Partial<Record<IssueId, string>> = {
  'cost-centre': "I can see SALES-DE on Jordan's account now.",
  report: "I can see the Report viewer role on Jordan's account now.",
  approval: 'I can see a delegate covering the approval now.',
};

/** After the admin approved: Ava only confirms what she can actually see. */
export function afterApproval(c: Config, w: World, call: CallState): Result {
  void c;
  const id = call.draft.issueId;
  if (id === 'unknown' || !isResolved(id, w)) {
    return { steps: [say(`I can't see the change on Jordan's account yet. ${first(person(w, call.with)?.name ?? '')}, could you check it went through?`)], call };
  }
  const steps: Step[] = [say(CONFIRM[id] ?? 'I can see the change now.')];
  if (call.fix?.scope === 'team' && w.configFixedBy) steps.push(say('The mapping now covers all of Sales Germany, so the others shouldn’t need a ticket.'));
  return { steps, call: { ...call, phase: 'approved' } };
}

export function recapFor(w: World, call: CallState, approved: boolean): string {
  const admin = person(w, call.with)?.name ?? call.with;
  if (!approved && call.phase === 'handed') return `Call with ${admin} ended. ${first(admin)} is taking it from here; no change was made yet.`;
  if (!approved) return `Call with ${admin} ended. No change was made.`;
  const scope = call.fix?.scope === 'team' ? ' (covers all of Sales Germany)' : '';
  return `Resolved on a call with ${admin}. Checked: ${checked(call.draft.issueId, w)} Changed: ${call.fix?.label ?? call.draft.change}${scope}.`;
}

/** Ends the call. If nothing was approved, the request card comes back so it isn't lost. */
export function endCall(c: Config, w: World, call: CallState): Result & { recap: string; session: Session } {
  const approved = call.phase === 'approved';
  const recap = recapFor(w, call, approved);
  const admin = first(person(w, call.with)?.name ?? '');
  const issue = call.draft.issueId === 'unknown' ? undefined : issueById(c, call.draft.issueId);
  if (approved) {
    return {
      steps: [say(`Thanks, ${admin}. I've saved a recap on the request.`), say(issue?.id === 'cost-centre' ? 'Jordan, you can re-submit your expense with SALES-DE now.' : "Jordan, you're all set.")],
      call: { ...call, phase: 'ended' },
      recap,
      session: { ...newSession, awaiting: 'done' },
    };
  }
  const draft = { ...call.draft, to: call.with };
  return {
    steps: [say('Call ended. Nothing was changed on the account.'), { kind: 'handoffCard', draft }, say(`Shall I send this request to ${admin}, so it's tracked?`)],
    call: { ...call, phase: 'ended' },
    recap,
    session: { issueId: draft.issueId, stepIdx: 0, tried: draft.tried, revealed: true, awaiting: 'handoff', draft },
  };
}

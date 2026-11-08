import type { Config, FixStep, HandoffRequest, IssueId, MockAction, MockTab, World } from '../data/types';
import { effectiveTag, isInstructable, issueById, matchIssue, sourceLabel } from './boundary';
import { isResolved } from './diagnose';
import { callTarget, canCall, type AdminFix } from './call';
import { contextLine } from './context';
import { cardLabel, notAllowedLine, pageFacts, requestDiagnosis, roleFacts } from './facts';
import { buildRequest } from './handoff';
import { isNo, isThanks, isYes, wordCount } from './intents';
import { planPath } from './plan';
import { formatDay } from './time';
import { applyMock, waitingRequest } from './world';

export type Step =
  | { kind: 'say'; text: string }
  /** an instruction the user carries out — always sourced, always a "User can do" step */
  | { kind: 'instruct'; text: string; source: string; label: string }
  | { kind: 'tab'; tab: MockTab }
  | { kind: 'highlight'; ids: string[] }
  | { kind: 'clearHighlight' }
  /** Ava does something on the employee's screen — only after they said yes to her offer */
  | { kind: 'pageAction'; actions: MockAction[]; label: string }
  | { kind: 'handoffCard'; draft: HandoffRequest }
  | { kind: 'send'; draft: HandoffRequest }
  /** the employee answered an admin's question: it goes into the request */
  | { kind: 'addInfo'; requestId: string; text: string }
  /** the employee chose to call an available admin from the visible card */
  | { kind: 'startCall'; draft: HandoffRequest; with: string }
  /** a (scripted) person on the call speaks */
  | { kind: 'participantSay'; who: string; text: string }
  | { kind: 'summaryCard'; lines: { label: string; text: string }[] }
  /** the admin's own decision, shown for the admin to approve */
  | { kind: 'adminCard'; fix: AdminFix };

export interface Session {
  issueId: IssueId | 'unknown' | null;
  stepIdx: number;
  /** instructions already tried, for the handoff */
  tried: string[];
  /** page facts already said */
  revealed: boolean;
  /** 'offer': Ava offered to do the current step on the page and waits for yes/no */
  awaiting: 'describe' | 'offer' | 'check' | 'handoff' | 'followUp' | 'info' | 'done';
  draft?: HandoffRequest;
  infoRequestId?: string;
  /** Ava offered to call this admin instead; a "yes" on the card means the call */
  offeredCall?: string;
}

export const newSession: Session = { issueId: null, stepIdx: 0, tried: [], revealed: false, awaiting: 'describe' };

type Result = { steps: Step[]; session: Session };

const say = (text: string): Step => ({ kind: 'say', text });
const person = (w: World, id: string) => w.people.find((p) => p.id === id);
const firstName = (name: string) => name.split(' ')[0];
const ANYTHING_ELSE = 'Anything else I can help with?';

const RESOLVED: Record<IssueId, string> = {
  'cost-centre': 'SALES-DE is there now. You can pick it on your expense.',
  receipt: 'The upload worked, and your receipt is attached.',
  approval: 'Your expense is moving again.',
  report: 'You can open Team reports now.',
  bank: '',
};

/** The card's recipient can be changed by the user before they say yes. */
export function withRecipient(s: Session, to: string): Session {
  return s.draft ? { ...s, draft: { ...s.draft, to } } : s;
}

function stepLabel(c: Config, id: IssueId, step: FixStep): string {
  const counted = planPath(c, id).filter((b) => b.kind === 'instruct' || b.kind === 'admin' || b.kind === 'never');
  const n = counted.findIndex((b) => 'step' in b && b.step.id === step.id);
  return `Step ${n + 1} of ${counted.length}`;
}

const TAB_LABEL: Record<MockTab, string> = { 'new-expense': 'New expense', receipt: 'Receipt', approvals: 'My approvals', reports: 'Reports', profile: 'Profile' };

/** What Ava sees on the page when a step didn't fix it. */
const STILL: Record<IssueId, string> = {
  'cost-centre': "SALES-DE still isn't in the list.",
  receipt: 'The upload still fails.',
  approval: "It's still waiting for approval.",
  report: 'Team reports is still locked.',
  bank: "It still isn't marked Paid.",
};

/** Pointing is fine without asking; switching tabs is an action, so Ava only points at what's on the current tab. */
function instructSteps(c: Config, step: FixStep, label: string, tab: MockTab): Step[] {
  const out: Step[] = [];
  if (step.target && step.target.tab === tab) out.push({ kind: 'highlight', ids: [step.target.hl] });
  out.push({ kind: 'instruct', text: step.instruction, source: sourceLabel(c, step.source)!, label });
  return out;
}

function offerFor(step: FixStep, tab: MockTab): string | undefined {
  const needTab = !!step.target && step.target.tab !== tab;
  if (step.actions?.length && step.offer) return step.offer;
  if (needTab) return `I can open ${TAB_LABEL[step.target!.tab]} for you.`;
  return undefined;
}

function actionLabel(step: FixStep): string {
  if (step.offer) {
    const t = step.offer.replace(/^I can /, '').replace(/ for you\.?$/, '');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  return `Opened ${step.target ? TAB_LABEL[step.target.tab] : 'the page'}`;
}

function recipientLine(w: World, to: string): string {
  const p = person(w, to);
  if (!p) return '';
  if (p.outOfOfficeUntil) return `${p.name} is out of office until ${formatDay(p.outOfOfficeUntil)}, so Lee Wong, the backup admin, can pick it up too.`;
  return '';
}

function cardSteps(w: World, draft: HandoffRequest, lead: Step[]): Step[] {
  const to = person(w, draft.to)?.name ?? draft.to;
  const line = recipientLine(w, draft.to);
  return [...lead, { kind: 'handoffCard', draft }, ...(line ? [say(line)] : []), say(`Shall I send this request to ${draft.to === 'payroll' ? 'Payroll' : firstName(to)}?`)];
}

function resolvedSteps(id: IssueId, lead: Step[]): Result {
  return { steps: [...lead, { kind: 'clearHighlight' }, say(RESOLVED[id]), say(ANYTHING_ELSE)], session: { ...newSession, awaiting: 'done' } };
}

/** The request only carries what Ava's role let her check, and says what she couldn't. */
function draftFor(c: Config, w: World, id: IssueId, s: Session): HandoffRequest {
  const d = buildRequest(c, w, id, s.tried);
  const { missing } = roleFacts(id, w, c.role);
  return { ...d, diagnosis: requestDiagnosis(id, w, c.role, issueById(c, id).title), notChecked: missing.map((p) => cardLabel(p, w)) };
}

/** Ava opens from the page: what she sees there, then straight into the first step. */
export function startFromContext(c: Config, w: World, id: IssueId, tab: MockTab = 'new-expense'): Result {
  const existing = waitingRequest(w, id);
  if (existing) {
    const to = person(w, existing.to)?.name ?? existing.to;
    return {
      steps: [say(`I've already sent that to ${to}. Status: ${existing.status === 'info' ? 'more information requested' : 'waiting for admin'}.`), say("I'll let you know when it's approved.")],
      session: { ...newSession, awaiting: 'done' },
    };
  }
  return advance(c, w, { ...newSession, issueId: id, awaiting: 'check' }, [say(contextLine(id, w))], tab);
}

/** Moves to the next step Ava may take, reading the creator's config fresh every time. */
function advance(c: Config, w: World, s: Session, lead: Step[] = [], tab: MockTab = 'new-expense'): Result {
  const id = s.issueId as IssueId;
  const issue = issueById(c, id);
  if (isResolved(id, w)) return resolvedSteps(id, lead);

  for (let i = s.stepIdx; i < issue.steps.length; i++) {
    const step = issue.steps[i];
    const tag = effectiveTag(step);
    if (tag === 'user') {
      if (!isInstructable(step)) continue; // no source → Ava doesn't say it
      const out = [...lead, ...instructSteps(c, step, stepLabel(c, id, step), tab)];
      const offer = offerFor(step, tab);
      if (offer) return { steps: [...out, say(`${offer} Shall I?`)], session: { ...s, stepIdx: i, awaiting: 'offer' } };
      if (step.observe) {
        // Ava reads the result off the page herself — no question needed
        lead = s.revealed ? out : [...out, ...pageFacts(id, w).map(say)];
        s = { ...s, revealed: true, tried: [...s.tried, step.instruction], stepIdx: i + 1 };
        continue;
      }
      return { steps: [...out, say(step.check)], session: { ...s, stepIdx: i, awaiting: 'check' } };
    }
    const draft = draftFor(c, w, id, s);
    const steps: Step[] = [{ kind: 'clearHighlight' }];
    if (tag === 'never') {
      if (issue.recipient === 'payroll') {
        steps.push(
          say(`${step.instruction.replace(/\.$/, '')} is something I never handle here, to keep your payment data safe.`),
          say("I can ask Payroll to get in touch, and I won't collect any bank details from you."),
        );
      } else {
        steps.push(say(`The next part isn't something I handle here: ${lowerFirst(step.adminRequest ?? step.instruction).replace(/\.$/, '')}. A person needs to do it.`));
      }
    } else {
      steps.push(say(`This next part needs an admin: ${lowerFirst(step.adminRequest ?? step.instruction).replace(/\.$/, '')}. It's outside what I'm allowed to walk you through, so I'll prepare a request.`));
      const facts = roleFacts(id, w, c.role);
      steps.push(...facts.lines.map(say), ...facts.missing.map((p) => say(notAllowedLine(p))));
      if (issue.workaround && isInstructable(issue.workaround)) steps.push(...instructSteps(c, issue.workaround, 'Meanwhile', tab));
    }
    return { steps: cardSteps(w, draft, [...lead, ...steps]), session: { ...s, stepIdx: i, awaiting: 'handoff', draft } };
  }

  // ran out of documented steps
  const draft = { ...draftFor(c, w, id, s), undocumented: true, source: undefined, change: `Investigate: ${issue.title}` };
  return {
    steps: cardSteps(w, draft, [...lead, { kind: 'clearHighlight' }, say("I've run out of documented steps for this one, and I'd rather not guess.")]),
    session: { ...s, awaiting: 'handoff', draft },
  };
}

function describe(c: Config, w: World, text: string, tab: MockTab = 'new-expense'): Result {
  if (isNo(text)) return { steps: [say("OK. I'm here if anything else comes up.")], session: { ...newSession, awaiting: 'done' } };
  if (isYes(text)) return { steps: [say("Tell me in a sentence what's going wrong in Expensio.")], session: newSession };
  if (isThanks(text)) return { steps: [say("You're welcome. I'm here if anything else comes up.")], session: { ...newSession, awaiting: 'done' } };

  const id = matchIssue(c, text);
  if (id === null && wordCount(text) <= 3) {
    return { steps: [say("Could you tell me a bit more about what's going wrong in Expensio?")], session: newSession };
  }
  if (id === null) {
    const draft = buildRequest(c, w, 'unknown', [], text);
    return {
      steps: cardSteps(w, draft, [say("I don't know that one, and I'd rather not guess."), say('I can pass on what you told me so the right person picks it up.')]),
      session: { ...newSession, issueId: 'unknown', awaiting: 'handoff', draft },
    };
  }

  if (!waitingRequest(w, id) && isResolved(id, w)) return { steps: [say(RESOLVED[id] || 'That looks fine now.'), say(ANYTHING_ELSE)], session: { ...newSession, awaiting: 'done' } };
  return startFromContext(c, w, id, tab);
}

/** The employee did the step themselves (or answered the check): Ava looks at the page and moves on. */
function afterCheck(c: Config, w: World, s: Session, text: string, tab: MockTab): Result {
  const id = s.issueId as IssueId;
  const step = issueById(c, id).steps[s.stepIdx];
  const lead: Step[] = [];
  const tried = step ? [...s.tried, step.instruction] : s.tried;
  let revealed = s.revealed;
  if (!isResolved(id, w)) {
    if (step?.observe && !s.revealed) {
      lead.push(...pageFacts(id, w).map(say));
      revealed = true;
    } else {
      // only a claim that it's fixed gets "I can't see that"; "done" just means they did the step
      const claimsFixed = /\b(works?|working|fixed|solved|there now|i can see it)\b/i.test(text);
      lead.push(say(claimsFixed ? `Hmm, I can't see that on the page yet. ${STILL[id]}` : `Thanks. ${STILL[id]}`));
    }
  }
  return advance(c, w, { ...s, tried, revealed, stepIdx: s.stepIdx + 1 }, lead, tab);
}

/** Yes to Ava's offer: she does it on the page, then reads the result herself. */
function acceptOffer(c: Config, w: World, s: Session, tab: MockTab): Result {
  const id = s.issueId as IssueId;
  const step = issueById(c, id).steps[s.stepIdx];
  const out: Step[] = [];
  let now = tab;
  if (step.target && step.target.tab !== tab) {
    out.push({ kind: 'tab', tab: step.target.tab });
    now = step.target.tab;
  }
  if (step.target) out.push({ kind: 'highlight', ids: [step.target.hl] });
  const actions = step.actions ?? [];
  out.push({ kind: 'pageAction', actions, label: actionLabel(step) });
  const after = actions.reduce(applyMock, w);
  const next: Session = { ...s, tried: [...s.tried, step.instruction], stepIdx: s.stepIdx + 1 };
  if (isResolved(id, after)) return resolvedSteps(id, out);
  if (step.observe && !s.revealed) {
    out.push(...pageFacts(id, after).map(say));
    next.revealed = true;
  } else if (!step.observe) {
    out.push(say(`Done. ${STILL[id]}`));
  }
  return advance(c, after, next, out, now);
}

function offerTurn(c: Config, w: World, s: Session, text: string, tab: MockTab): Result {
  if (isYes(text)) return acceptOffer(c, w, s, tab);
  const id = s.issueId as IssueId;
  const other = matchIssue(c, text);
  if (other !== null && other !== id) return describe(c, w, text, tab);
  if (other === id) {
    const offer = offerFor(issueById(c, id).steps[s.stepIdx], tab);
    return { steps: [say("Yes, that's the one I'm looking at."), say(`${offer} Shall I?`)], session: s };
  }
  // no, or anything else: the employee keeps control and does it themselves
  return { steps: [say("OK, go ahead. Tell me when you've done it.")], session: { ...s, awaiting: 'check' } };
}

function send(c: Config, w: World, s: Session): Result {
  const draft = s.draft!;
  const to = person(w, draft.to)?.name ?? draft.to;
  const steps: Step[] = [{ kind: 'send', draft }, { kind: 'clearHighlight' }, say(`Sent to ${to}. Status: waiting for ${draft.to === 'payroll' ? 'Payroll' : 'admin'}.`)];
  const issue = draft.issueId === 'unknown' ? undefined : issueById(c, draft.issueId);
  const stop = issue?.steps[s.stepIdx];
  if (issue?.workaround && isInstructable(issue.workaround) && stop && effectiveTag(stop) === 'admin') {
    steps.push(say(`Meanwhile: ${issue.workaround.instruction}`));
  }
  steps.push(say("I'll let you know when it's approved."));
  return { steps, session: { ...newSession, awaiting: 'done' } };
}

export function respond(c: Config, w: World, s: Session, text: string, cardVisible: boolean, tab: MockTab = 'new-expense'): Result {
  switch (s.awaiting) {
    case 'handoff': {
      if (s.offeredCall && s.draft && isYes(text) && cardVisible) {
        return { steps: [{ kind: 'startCall', draft: { ...s.draft, to: s.offeredCall }, with: s.offeredCall }], session: { ...newSession, awaiting: 'done' } };
      }
      const target = s.draft ? callTarget(w, text) : undefined;
      if (target && s.draft) {
        if (!cardVisible) return { steps: cardSteps(w, s.draft, []), session: s };
        if (!c.role.directory) {
          return { steps: cardSteps(w, s.draft, [say(notAllowedLine('directory').replace('.', ', so I can\'t set up a call.'))]), session: s };
        }
        if (s.draft.to === 'payroll') {
          return { steps: [say("This one goes to Payroll, so I can't call an expense admin about it."), { kind: 'handoffCard', draft: s.draft }, say('Shall I send it to Payroll?')], session: s };
        }
        if (!canCall(w, target)) {
          const p = person(w, target);
          const backup = w.people.find((x) => canCall(w, x.id));
          const away = p?.outOfOfficeUntil ? `${p.name} is out of office until ${formatDay(p.outOfOfficeUntil)}, so I can't call them.` : `I can't call ${p?.name ?? 'them'}.`;
          return {
            steps: [say(away), { kind: 'handoffCard', draft: s.draft }, ...(backup ? [say(`${backup.name}, the backup admin, is available. Want me to call ${firstName(backup.name)} instead?`)] : [])],
            session: { ...s, offeredCall: backup?.id },
          };
        }
        return { steps: [{ kind: 'startCall', draft: { ...s.draft, to: target }, with: target }], session: { ...newSession, awaiting: 'done' } };
      }
      if (isYes(text) && s.draft) {
        if (cardVisible) return send(c, w, s);
        return { steps: cardSteps(w, s.draft, []), session: s }; // show the card first
      }
      if (isNo(text)) return { steps: [{ kind: 'clearHighlight' }, say("OK, I won't send it. You can ask me again any time.")], session: { ...newSession, awaiting: 'done' } };
      return describe(c, w, text, tab);
    }
    case 'offer':
      return offerTurn(c, w, s, text, tab);
    case 'info': {
      const r = w.requests.find((x) => x.id === s.infoRequestId);
      const by = person(w, r?.approvedBy ?? '')?.name ?? 'the admin';
      return {
        steps: [{ kind: 'addInfo', requestId: s.infoRequestId!, text: text.trim() }, say(`Thanks, I've added that to your request, and it's back with ${by}.`)],
        session: { ...newSession, awaiting: 'done' },
      };
    }
    case 'check':
      return afterCheck(c, w, s, text, tab);
    case 'followUp':
      if (isYes(text)) return followUpYes(c, s);
      return describe(c, w, text, tab);
    default:
      return describe(c, w, text, tab);
  }
}

/** What Ava says when the admin has acted on a request. */
export function followUp(c: Config, w: World, r: HandoffRequest, s: Session): Result {
  void c;
  const by = person(w, r.approvedBy ?? '')?.name ?? 'The admin';
  if (r.status === 'info') {
    return {
      steps: [say(`${by} needs a bit more information: "${r.note ?? ''}"`), say('What should I tell them?')],
      session: { ...newSession, awaiting: 'info', infoRequestId: r.id },
    };
  }
  switch (r.issueId) {
    case 'cost-centre':
      return {
        steps: [say(`Good news: ${by} approved your request, so you're on cost centre SALES-DE now.`), say('Want to re-submit your expense with SALES-DE?')],
        session: { ...newSession, issueId: 'cost-centre', awaiting: 'followUp' },
      };
    case 'report':
      return {
        steps: [say(`Good news: ${by} gave you the Report viewer role.`), say('Want me to open Team reports?')],
        session: { ...newSession, issueId: 'report', awaiting: 'followUp' },
      };
    case 'approval': {
      const a = w.employee.approval;
      const delegate = person(w, a.delegateId ?? '')?.name ?? 'a delegate';
      const approver = person(w, a.approverId)?.name ?? 'the approver';
      return { steps: [say(`Good news: ${by} approved it. ${delegate} is covering ${approver}'s approvals, so your expense is moving again.`)], session: { ...s, awaiting: 'done' } };
    }
    default:
      return { steps: [say(`${by} has picked up your request and marked it done.`)], session: { ...s, awaiting: 'done' } };
  }
}

function followUpYes(c: Config, s: Session): Result {
  if (s.issueId === 'cost-centre') {
    const resubmit: FixStep = {
      id: 'resubmit',
      instruction: 'Open New expense, pick SALES-DE and press Submit.',
      tag: 'user',
      source: { docId: 'guide', sectionId: 'g2' },
      target: { tab: 'new-expense', hl: 'exp-costcentre' },
      check: '',
    };
    // "yes" to "want to re-submit?" is the OK to open New expense
    return { steps: [{ kind: 'tab', tab: 'new-expense' }, ...instructSteps(c, resubmit, 'Re-submit', 'new-expense')], session: { ...newSession, awaiting: 'done' } };
  }
  return {
    steps: [{ kind: 'tab', tab: 'reports' }, { kind: 'highlight', ids: ['reports-team-tab'] }, say("Here's Team reports.")],
    session: { ...newSession, awaiting: 'done' },
  };
}

function lowerFirst(t: string): string {
  return t.charAt(0).toLowerCase() + t.slice(1);
}

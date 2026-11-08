import { ACCEPTED_FORMATS, MAX_RECEIPT_MB, RECEIPT_FILES, type HandoffRequest, type MockAction, type World } from '../data/types';
import type { AdminFix } from './call';

export type { MockAction };

/** Cost centres an employee may join themselves (Expensio config for their department). */
export const SELF_JOIN = ['SALES-DE'];

const emp = (w: World, patch: Partial<World['employee']>): World => ({ ...w, employee: { ...w.employee, ...patch } });

export function visibleCostCentres(w: World): string[] {
  return w.employee.costCentres;
}

export function applyMock(w: World, a: MockAction): World {
  const e = w.employee;
  switch (a.type) {
    case 'setFilter':
      return emp(w, { ccFilter: a.v });
    case 'refresh':
      return w;
    case 'selectFile':
      return emp(w, { receipt: { selected: a.f, status: 'idle' } });
    case 'upload': {
      if (!e.receipt.selected) return w;
      const f = RECEIPT_FILES[e.receipt.selected];
      const ok = ACCEPTED_FORMATS.includes(f.format) && f.sizeMb <= MAX_RECEIPT_MB;
      return emp(w, { receipt: { ...e.receipt, status: ok ? 'uploaded' : 'failed' } });
    }
    case 'join':
      if (!SELF_JOIN.includes(a.cc) || e.costCentres.includes(a.cc)) return w;
      return emp(w, { costCentres: [...e.costCentres, a.cc] });
    case 'pickCostCentre':
      if (!visibleCostCentres(w).includes(a.cc)) return w;
      return emp(w, { draft: { ...e.draft, costCentre: a.cc } });
    case 'submit':
      if (!e.draft.costCentre) return w;
      return emp(w, { draft: { ...e.draft, submitted: true } });
  }
}

export function waitingRequest(w: World, issueId: HandoffRequest['issueId']): HandoffRequest | undefined {
  return w.requests.find((r) => r.issueId === issueId && r.status !== 'approved');
}

/** Ava acted on the employee's screen with their OK: do it, and leave a trace in the audit log. */
export function avaActs(w: World, actions: MockAction[], label: string): World {
  const done = actions.reduce(applyMock, w);
  const entry = { id: `au-${w.audit.length + 1}`, at: w.now, actor: `Ava (with ${w.employee.name}'s OK)`, text: label };
  return { ...done, audit: [...done.audit, entry] };
}

/** Ids never collide, even after requests are added in different ways. */
function nextRequestId(w: World): string {
  const max = Math.max(0, ...w.requests.map((r) => Number(r.id.replace(/^r-/, '')) || 0));
  return `r-${max + 1}`;
}

/** Adds the request — unless one for the same issue is already waiting. */
export function sendRequest(w: World, r: HandoffRequest): World {
  if (r.issueId !== 'unknown' && waitingRequest(w, r.issueId)) return w;
  return { ...w, requests: [...w.requests, { ...r, id: nextRequestId(w), createdAt: w.now, status: 'waiting' }] };
}

/** The admin's one-click approval: applies the requested change. */
export function approveRequest(w: World, id: string, by: string): World {
  const r = w.requests.find((x) => x.id === id);
  if (!r || r.status === 'approved') return w;
  let next = w;
  const e = w.employee;
  switch (r.effect.type) {
    case 'addCostCentre':
      if (!e.costCentres.includes(r.effect.cc)) next = emp(w, { costCentres: [...e.costCentres, r.effect.cc] });
      break;
    case 'addRole':
      if (!e.roles.includes(r.effect.role)) next = emp(w, { roles: [...e.roles, r.effect.role] });
      break;
    case 'setDelegate':
      next = emp(w, { approval: { ...e.approval, delegateId: r.effect.delegateId } });
      break;
    case 'none':
      break;
  }
  return { ...next, requests: next.requests.map((x) => (x.id === id ? { ...x, status: 'approved', approvedBy: by } : x)) };
}

/**
 * The admin approved live on a call: one approved request carrying the recap, and the change applied.
 * A team fix also corrects the rollout mapping for everyone.
 */
export function resolveOnCall(w: World, draft: HandoffRequest, by: string, fix: AdminFix, recap: string): World {
  let next = w;
  if (!w.requests.some((r) => r.onCall && r.issueId === draft.issueId)) {
    next = { ...w, requests: [...w.requests, { ...draft, id: nextRequestId(w), createdAt: w.now, to: by, status: 'waiting', onCall: true }] };
    const id = next.requests.at(-1)!.id;
    next = approveRequest(next, id, by);
    next = { ...next, requests: next.requests.map((r) => (r.id === id ? { ...r, note: recap } : r)) };
  }
  if (fix.scope === 'team' && !next.configFixedBy) next = { ...next, configFixedBy: by };
  return next;
}

/** The employee's answer goes into the request, and it is back with the admin. */
export function answerInfo(w: World, id: string, text: string): World {
  return {
    ...w,
    requests: w.requests.map((x) => (x.id === id ? { ...x, status: 'waiting', note: `${x.note ?? ''}\n${w.employee.name}: ${text}`.trim() } : x)),
  };
}

export function askInfo(w: World, id: string, by: string, note: string): World {
  return { ...w, requests: w.requests.map((x) => (x.id === id ? { ...x, status: 'info', approvedBy: by, note } : x)) };
}

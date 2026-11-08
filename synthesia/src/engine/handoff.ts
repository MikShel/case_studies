import type { Config, Effect, HandoffRequest, IssueId, World } from '../data/types';
import { effectiveTag, issueById } from './boundary';
import { diagnose } from './diagnose';

const EFFECTS: Record<IssueId, Effect> = {
  'cost-centre': { type: 'addCostCentre', cc: 'SALES-DE' },
  receipt: { type: 'none' },
  approval: { type: 'setDelegate', forId: 'priya', delegateId: 'marco' },
  report: { type: 'addRole', role: 'Report viewer' },
  bank: { type: 'none' },
};

function affects(w: World, id: IssueId | 'unknown'): string {
  const e = w.employee;
  const who = `${e.name} (${e.team}, ${e.city})`;
  switch (id) {
    case 'cost-centre':
      return `${who} · 1 expense waiting for the right cost centre`;
    case 'approval':
      return `${who} · "${e.approval.title}" and anything else waiting on this approver`;
    case 'report':
      return `${who} · read access to Team reports`;
    case 'bank':
      return `${who} · no bank details were collected`;
    default:
      return who;
  }
}

/**
 * The ready-to-approve request: diagnosis, exact change, impact, what was tried, the source.
 * Ava never makes the change herself — this is a request, not an action.
 */
export function buildRequest(c: Config, w: World, id: IssueId | 'unknown', tried: string[], userText = ''): HandoffRequest {
  const base = { id: 'draft', tried, status: 'waiting' as const, createdAt: w.now, affects: affects(w, id) };
  if (id === 'unknown') {
    return {
      ...base,
      issueId: 'unknown',
      diagnosis: `${w.employee.name} asked something the troubleshooting guide doesn't cover: "${userText.trim()}"`,
      change: `Investigate and reply to ${w.employee.name}`,
      undocumented: true,
      to: 'tom',
      effect: { type: 'none' },
    };
  }
  const issue = issueById(c, id);
  const stop = issue.steps.find((s) => effectiveTag(s) !== 'user') ?? issue.steps.at(-1);
  return {
    ...base,
    issueId: id,
    diagnosis: diagnose(id, w).summary,
    change: stop?.adminRequest ?? `Investigate: ${issue.title}`,
    source: stop?.source,
    undocumented: !stop?.source,
    to: issue.recipient === 'payroll' ? 'payroll' : 'tom',
    effect: EFFECTS[id],
  };
}

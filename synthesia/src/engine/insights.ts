import type { Config, IssueId, PastSession, World } from '../data/types';
import { effectiveTag } from './boundary';

export interface Insights {
  total: number;
  top: { issueId: IssueId | 'unknown'; count: number }[];
  /** where people get stuck, by step, across all issues */
  stuckSteps: { stepId: string; count: number }[];
  selfPct: number;
  handoffPct: number;
  medianMinutes: number;
  /** handoffs approved without back-and-forth */
  firstTimeApprovalPct: number;
  actionable: string;
  /** requests sent in today's (live) sessions, shown next to the week-1 numbers */
  liveToday: number;
}

/** A step as rollout owners see it: no employee names. */
export function stuckLabel(c: Config, stepId: string, w: World): string {
  for (const issue of c.issues) {
    const s = issue.steps.find((x) => x.id === stepId);
    if (!s) continue;
    const text = effectiveTag(s) === 'user' ? s.instruction : (s.adminRequest ?? s.instruction);
    let anon = text.split(w.employee.name).join('someone');
    for (const p of w.people) anon = anon.split(p.name).join('a colleague');
    return `${issue.title}: ${anon.replace(/\.$/, '')}`;
  }
  return stepId;
}

function median(xs: number[]): number {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function countBy<T extends string>(xs: (T | undefined)[]): { key: T; count: number }[] {
  const m = new Map<T, number>();
  for (const x of xs) if (x !== undefined) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

export function insights(history: PastSession[], w: World): Insights {
  const all = history;
  const total = all.length;
  const top = countBy(all.map((s) => s.issueId)).map(({ key, count }) => ({ issueId: key, count }));
  const stuckSteps = countBy(all.map((s) => s.stuckStepId)).map(({ key, count }) => ({ stepId: key, count }));
  const self = all.filter((s) => s.outcome === 'self').length;
  const selfPct = Math.round((self / total) * 100);
  const decided = all.filter((s) => s.approvedFirstTime !== undefined);
  const firstTimeApprovalPct = decided.length ? Math.round((decided.filter((s) => s.approvedFirstTime).length / decided.length) * 100) : 0;

  const lead = top[0];
  const tickets = all.filter((s) => s.issueId === lead?.issueId && s.outcome === 'handoff').length;
  const fixer = w.people.find((p) => p.id === w.configFixedBy)?.name;
  const actionable = fixer && lead?.issueId === 'cost-centre'
    ? `✓ ${lead.count} people stuck on the cost centre → the Sales Germany mapping was fixed by ${fixer} on a call. New cost-centre sessions should drop to zero.`
    : lead?.issueId === 'cost-centre'
      ? `${lead.count} people stuck on the cost centre → the rollout config probably didn't map Sales DE to SALES-DE — fix the config, not ${tickets} tickets.`
      : `Most sessions are about "${lead?.issueId}": check the rollout config for that area first.`;

  return {
    total,
    top,
    stuckSteps,
    selfPct,
    handoffPct: 100 - selfPct,
    medianMinutes: median(all.map((s) => s.minutes)),
    firstTimeApprovalPct,
    actionable,
    liveToday: w.requests.length,
  };
}

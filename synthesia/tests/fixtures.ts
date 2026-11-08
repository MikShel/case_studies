import { createConfig, createWorld } from '../src/data/seed';
import type { Config, FixStep, IssueId, Tag, World } from '../src/data/types';

export const NOW = new Date('2026-10-26T10:00:00Z');

export const config = () => createConfig();
export const world = () => createWorld(NOW);

export function step(c: Config, issueId: IssueId, stepId: string): FixStep {
  const s = c.issues.find((i) => i.id === issueId)!.steps.find((x) => x.id === stepId);
  if (!s) throw new Error(`no step ${stepId}`);
  return s;
}

export function withTag(c: Config, issueId: IssueId, stepId: string, tag: Tag | undefined): Config {
  return {
    ...c,
    issues: c.issues.map((i) => (i.id !== issueId ? i : { ...i, steps: i.steps.map((s) => (s.id === stepId ? { ...s, tag } : s)) })),
  };
}

export function withEmployee(w: World, patch: Partial<World['employee']>): World {
  return { ...w, employee: { ...w.employee, ...patch } };
}

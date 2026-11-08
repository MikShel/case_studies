import type { Config, FixStep, IssueId } from '../data/types';
import { effectiveTag, isInstructable, issueById } from './boundary';

export type Beat =
  | { kind: 'instruct'; step: FixStep }
  | { kind: 'skipped'; step: FixStep; reason: 'no-source' }
  | { kind: 'admin'; step: FixStep }
  | { kind: 'never'; step: FixStep }
  | { kind: 'workaround'; step: FixStep }
  | { kind: 'handoff'; documented: boolean }
  | { kind: 'resolved' }
  | { kind: 'unknown' };

/**
 * The path Ava takes through an issue, assuming none of the user's steps fixes it.
 * Used by the live session (to pick the next beat) and by the creator's "Test before publish".
 */
export function planPath(c: Config, id: IssueId | null): Beat[] {
  if (id === null) return [{ kind: 'unknown' }, { kind: 'handoff', documented: false }];
  const issue = issueById(c, id);
  const beats: Beat[] = [];
  for (const step of issue.steps) {
    const tag = effectiveTag(step);
    if (tag === 'user') {
      beats.push(isInstructable(step) ? { kind: 'instruct', step } : { kind: 'skipped', step, reason: 'no-source' });
      continue;
    }
    beats.push(tag === 'never' ? { kind: 'never', step } : { kind: 'admin', step });
    if (tag === 'admin' && issue.workaround && isInstructable(issue.workaround)) beats.push({ kind: 'workaround', step: issue.workaround });
    beats.push({ kind: 'handoff', documented: step.source !== undefined });
    return beats;
  }
  beats.push({ kind: 'resolved' });
  return beats;
}

import type { Config, FixStep, Issue, IssueId, SourceRef, Tag } from '../data/types';

/** The boundary rule: anything the creator hasn't tagged, or isn't sure about, needs an admin. */
export function effectiveTag(s: FixStep): Tag {
  return s.tag ?? 'admin';
}

/** Ava may only tell a user to do a step that is theirs AND documented. */
export function isInstructable(s: FixStep): boolean {
  return effectiveTag(s) === 'user' && s.source !== undefined;
}

/** Index of the first step that isn't the user's to do — "self-service ends here". */
export function selfServiceEnd(issue: Issue): number {
  const i = issue.steps.findIndex((s) => effectiveTag(s) !== 'user');
  return i === -1 ? issue.steps.length : i;
}

export function sourceLabel(c: Config, ref: SourceRef | undefined): string | undefined {
  if (!ref) return undefined;
  const doc = c.docs.find((d) => d.id === ref.docId);
  const section = doc?.sections.find((s) => s.id === ref.sectionId);
  if (!doc || !section) return undefined;
  const short = /^(§[\d.]+|Q\d+|#\d+)\b/.exec(section.heading)?.[1];
  return short ? `${doc.title} · ${short}` : doc.title;
}

export function issueById(c: Config, id: IssueId): Issue {
  const issue = c.issues.find((i) => i.id === id);
  if (!issue) throw new Error(`unknown issue ${id}`);
  return issue;
}

/** Picks the issue whose symptom phrases appear most often in what the user said. */
export function matchIssue(c: Config, text: string): IssueId | null {
  const t = text.toLowerCase();
  let best: IssueId | null = null;
  let bestScore = 0;
  for (const issue of c.issues) {
    const score = issue.symptoms.filter((s) => t.includes(s)).length;
    if (score > bestScore) {
      best = issue.id;
      bestScore = score;
    }
  }
  return best;
}

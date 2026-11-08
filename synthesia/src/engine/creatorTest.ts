import type { Config, FixStep, IssueId, SourceRef } from '../data/types';
import { effectiveTag, matchIssue } from './boundary';
import { planPath, type Beat } from './plan';

export interface Scenario {
  id: string;
  line: string;
  expectIssue: IssueId | null;
}

/** What the creator "plays" as a stuck employee before publishing. */
export const SCENARIOS: Scenario[] = [
  { id: 's1', line: "I can't see my cost centre SALES-DE on the expense form", expectIssue: 'cost-centre' },
  { id: 's2', line: 'My receipt upload keeps failing', expectIssue: 'receipt' },
  { id: 's3', line: 'My approval has been stuck for days, my manager is on holiday', expectIssue: 'approval' },
  { id: 's4', line: "I can't open the team expense report", expectIssue: 'report' },
  { id: 's5', line: "My reimbursement hasn't arrived. Can you change my bank account?", expectIssue: 'bank' },
  { id: 's6', line: 'How do I book a flight for the Hamburg client meeting?', expectIssue: null },
];

export interface ScenarioResult {
  scenario: Scenario;
  beats: Beat[];
  /** invariant 1: never tells a user to do a Needs admin or Never step */
  neverInstructsAdmin: boolean;
  /** invariant 2: every instruction (and every request to an admin) has a source */
  everythingSourced: boolean;
  pass: boolean;
  problem?: string;
}

export function runScenarios(c: Config): ScenarioResult[] {
  return SCENARIOS.map((scenario) => {
    const matched = matchIssue(c, scenario.line);
    const beats = planPath(c, matched);
    const instructed = beats.flatMap((b) => (b.kind === 'instruct' || b.kind === 'workaround' ? [b.step] : []));
    const neverInstructsAdmin = instructed.every((s) => effectiveTag(s) === 'user');
    const skipped = beats.find((b): b is Extract<Beat, { kind: 'skipped' }> => b.kind === 'skipped');
    const stop = beats.find((b): b is Extract<Beat, { kind: 'admin' | 'never' }> => b.kind === 'admin' || b.kind === 'never');
    const undocumented = matched !== null && beats.some((b) => b.kind === 'handoff' && !b.documented);
    const everythingSourced = !skipped && !undocumented;

    let problem: string | undefined;
    if (matched !== scenario.expectIssue) problem = `Ava matched this to "${matched ?? 'nothing'}" instead of "${scenario.expectIssue ?? 'nothing'}".`;
    else if (skipped) problem = `"${skipped.step.instruction}" has no source, so Ava can't say it.`;
    else if (undocumented && stop) problem = `"${stop.step.adminRequest ?? stop.step.instruction}" has no source, so the request to the admin would be undocumented.`;
    else if (!neverInstructsAdmin) problem = 'Ava would tell the user to do a step that needs an admin.';

    return { scenario, beats, neverInstructsAdmin, everythingSourced, pass: problem === undefined, problem };
  });
}

export function canPublish(c: Config): boolean {
  return runScenarios(c).every((r) => r.pass);
}

export const DELEGATION_NOTE: SourceRef = { docId: 'note-delegation', sectionId: 'n1' };

/** The creator's fix for the gap: write a rollout note, cite it, and add the step a user CAN take. */
export function closeGap(c: Config): Config {
  if (c.docs.some((d) => d.id === DELEGATION_NOTE.docId)) return c;
  const colleagueStep: FixStep = {
    id: 'c1b',
    instruction: 'Ask a colleague with approver rights, like Marco Rossi, to approve it, or request delegation.',
    tag: 'user',
    source: DELEGATION_NOTE,
    target: { tab: 'approvals', hl: 'approval-row' },
    check: 'Is someone with approver rights able to pick it up?',
  };
  return {
    ...c,
    docs: [
      ...c.docs,
      {
        id: DELEGATION_NOTE.docId,
        title: 'Rollout note: absent approvers',
        kind: 'note',
        sections: [
          {
            id: DELEGATION_NOTE.sectionId,
            heading: 'Absent approvers',
            text: 'If an approver is away, ask a colleague with approver rights to approve, or request delegation. Admins set delegates in Admin → Approvals → Delegates.',
          },
        ],
      },
    ],
    issues: c.issues.map((i) => {
      if (i.id !== 'approval') return i;
      const steps = i.steps.flatMap((s) => {
        if (s.id === 'c1') return [s, colleagueStep];
        if (s.id === 'c2') return [{ ...s, source: DELEGATION_NOTE }];
        return [s];
      });
      return { ...i, steps, gap: undefined };
    }),
  };
}

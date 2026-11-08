import { describe, expect, it } from 'vitest';
import { canPublish, closeGap, runScenarios, SCENARIOS } from '../src/engine/creatorTest';
import { planPath } from '../src/engine/plan';
import { config, withTag } from './fixtures';

const c = config();
const kinds = (beats: { kind: string }[]) => beats.map((b) => b.kind);

describe('planPath', () => {
  it('cost centre: two user steps, then admin, workaround, documented handoff', () => {
    expect(kinds(planPath(c, 'cost-centre'))).toEqual(['instruct', 'instruct', 'admin', 'workaround', 'handoff']);
    expect(planPath(c, 'cost-centre').at(-1)).toEqual({ kind: 'handoff', documented: true });
  });

  it('receipt is fully self-service', () => {
    expect(kinds(planPath(c, 'receipt'))).toEqual(['instruct', 'instruct', 'resolved']);
  });

  it('bank details: never via avatar', () => {
    expect(kinds(planPath(c, 'bank'))).toEqual(['instruct', 'never', 'handoff']);
  });

  it('unknown request: honest handoff', () => {
    expect(planPath(c, null)).toEqual([{ kind: 'unknown' }, { kind: 'handoff', documented: false }]);
  });

  it('re-tagging a3 as "User can do" removes the handoff', () => {
    expect(kinds(planPath(withTag(c, 'cost-centre', 'a3', 'user'), 'cost-centre'))).toEqual(['instruct', 'instruct', 'instruct', 'resolved']);
  });

  it('untagging b2 makes it a Needs admin stop', () => {
    expect(kinds(planPath(withTag(c, 'receipt', 'b2', undefined), 'receipt'))).toEqual(['instruct', 'admin', 'handoff']);
  });

  it('an unsourced user step is skipped, never instructed', () => {
    const noSource = { ...c, issues: c.issues.map((i) => (i.id !== 'receipt' ? i : { ...i, steps: i.steps.map((s) => (s.id === 'b1' ? { ...s, source: undefined } : s)) })) };
    expect(kinds(planPath(noSource, 'receipt'))).toEqual(['skipped', 'instruct', 'resolved']);
  });
});

describe('creator test before publish', () => {
  it('has six scenarios', () => {
    expect(SCENARIOS).toHaveLength(6);
  });

  it('on the seed, only the approval scenario fails, because of the delegation gap', () => {
    const results = runScenarios(c);
    expect(results.filter((r) => !r.pass).map((r) => r.scenario.expectIssue)).toEqual(['approval']);
    const failed = results.find((r) => !r.pass)!;
    expect(failed.everythingSourced).toBe(false);
    expect(failed.neverInstructsAdmin).toBe(true);
    expect(failed.problem).toMatch(/Set a delegate/);
    expect(failed.problem).toMatch(/no source/);
    expect(canPublish(c)).toBe(false);
  });

  it('closing the gap adds a documented step and unlocks publish', () => {
    const fixed = closeGap(c);
    expect(runScenarios(fixed).every((r) => r.pass)).toBe(true);
    expect(canPublish(fixed)).toBe(true);
    const path = planPath(fixed, 'approval');
    expect(kinds(path)).toEqual(['instruct', 'instruct', 'admin', 'handoff']);
    expect(path[1]).toMatchObject({ kind: 'instruct', step: { id: 'c1b' } });
    expect(fixed.docs.some((d) => d.kind === 'note')).toBe(true);
  });

  it('closing the gap twice changes nothing more', () => {
    expect(closeGap(closeGap(c))).toEqual(closeGap(c));
  });

  it('removing a source breaks a passing scenario', () => {
    const fixed = closeGap(c);
    const broken = { ...fixed, issues: fixed.issues.map((i) => (i.id !== 'receipt' ? i : { ...i, steps: i.steps.map((s) => (s.id === 'b1' ? { ...s, source: undefined } : s)) })) };
    expect(canPublish(broken)).toBe(false);
  });

});

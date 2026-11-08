import { describe, expect, it } from 'vitest';
import { effectiveTag, isInstructable, matchIssue, selfServiceEnd, sourceLabel } from '../src/engine/boundary';
import { diagnose, isResolved } from '../src/engine/diagnose';
import { config, step, withEmployee, world } from './fixtures';

const c = config();
const w = world();
const issue = (id: string) => c.issues.find((i) => i.id === id)!;

describe('boundary rules', () => {
  it('untagged means Needs admin', () => {
    expect(effectiveTag(step(c, 'cost-centre', 'a3'))).toBe('admin');
    expect(effectiveTag(step(c, 'cost-centre', 'a1'))).toBe('user');
  });

  it('only sourced user steps are instructable', () => {
    expect(isInstructable(step(c, 'cost-centre', 'a1'))).toBe(true);
    expect(isInstructable(step(c, 'cost-centre', 'a3'))).toBe(false); // untagged
    expect(isInstructable({ ...step(c, 'cost-centre', 'a1'), source: undefined })).toBe(false); // no source
    expect(isInstructable(step(c, 'bank', 'e2'))).toBe(false); // never
  });

  it('marks where self-service ends', () => {
    expect(selfServiceEnd(issue('cost-centre'))).toBe(2);
    expect(selfServiceEnd(issue('receipt'))).toBe(2);
    expect(selfServiceEnd(issue('approval'))).toBe(1);
  });

  it('labels sources by doc and section', () => {
    expect(sourceLabel(c, { docId: 'faq', sectionId: 'q5' })).toBe('Expensio FAQ · Q5');
    expect(sourceLabel(c, { docId: 'guide', sectionId: 'g32' })).toBe('Expensio rollout guide · §3.2');
    expect(sourceLabel(c, undefined)).toBeUndefined();
  });
});

describe('matchIssue', () => {
  it.each([
    ["I can't see my cost centre", 'cost-centre'],
    ["My receipt won't upload", 'receipt'],
    ['My approval is stuck', 'approval'],
    ["I can't open the team expense report", 'report'],
    ['Can I change my bank account?', 'bank'],
    ['How do I book a flight?', null],
  ])('%s → %s', (text, id) => {
    expect(matchIssue(c, text)).toBe(id);
  });
});

describe('diagnose', () => {
  it('a: not on SALES-DE', () => {
    expect(diagnose('cost-centre', w).why).toMatch(/SALES-DE/);
    expect(isResolved('cost-centre', w)).toBe(false);
    expect(isResolved('cost-centre', withEmployee(w, { costCentres: ['DE-GENERAL', 'SALES-DE'] }))).toBe(true);
  });

  it('b: HEIC and too big', () => {
    expect(diagnose('receipt', w).why).toMatch(/HEIC/);
    expect(diagnose('receipt', w).why).toMatch(/14\.2 MB/);
    expect(isResolved('receipt', withEmployee(w, { receipt: { selected: 'jpg', status: 'uploaded' } }))).toBe(true);
  });

  it('c: approver out of office', () => {
    expect(diagnose('approval', w).why).toMatch(/Priya Shah/);
    expect(diagnose('approval', w).why).toMatch(/out of office/);
    expect(isResolved('approval', withEmployee(w, { approval: { ...w.employee.approval, delegateId: 'marco' } }))).toBe(true);
  });

  it('d: missing Report viewer, without exposing anyone else', () => {
    const d = diagnose('report', w);
    expect(d.why).toMatch(/Report viewer/);
    const others = w.people.map((p) => p.name);
    for (const name of others) expect(`${d.summary} ${d.why}`).not.toContain(name);
    expect(isResolved('report', withEmployee(w, { roles: ['Submitter', 'Report viewer'] }))).toBe(true);
  });

  it('summaries are one sentence', () => {
    for (const id of ['cost-centre', 'receipt', 'approval', 'report'] as const) {
      expect(diagnose(id, w).summary.split(/[.!?]\s/).length, id).toBe(1);
    }
  });
});

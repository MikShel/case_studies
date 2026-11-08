import { describe, expect, it } from 'vitest';
import { createConfig, createHistory, createWorld } from '../src/data/seed';

const NOW = new Date('2026-10-26T10:00:00Z');
const c = createConfig();
const w = createWorld(NOW);
const step = (issue: string, id: string) => c.issues.find((i) => i.id === issue)!.steps.find((s) => s.id === id)!;

describe('seed', () => {
  it('has the three knowledge sources, not yet connected', () => {
    expect(c.docs.map((d) => d.title)).toEqual(['Expensio rollout guide', 'Expensio FAQ', 'Known issues, week 1']);
    expect(c.connected).toBe(false);
    expect(c.published).toBe(false);
  });

  it('has five issues a–e', () => {
    expect(c.issues.map((i) => i.id)).toEqual(['cost-centre', 'receipt', 'approval', 'report', 'bank']);
  });

  it('a3 is untagged and asks an admin to add Jordan to SALES-DE', () => {
    expect(step('cost-centre', 'a3').tag).toBeUndefined();
    expect(step('cost-centre', 'a3').adminRequest).toBe('Add Jordan Lee to cost centre SALES-DE');
  });

  it('the approval issue has the documented gap', () => {
    expect(step('approval', 'c2').source).toBeUndefined();
    expect(c.issues.find((i) => i.id === 'approval')!.gap).toMatch(/delegation/);
  });

  it('bank details are never handled by the avatar', () => {
    expect(step('bank', 'e2').tag).toBe('never');
  });

  it('every source reference points at a real section', () => {
    for (const issue of c.issues) {
      for (const s of [...issue.steps, ...(issue.workaround ? [issue.workaround] : [])]) {
        if (!s.source) continue;
        const doc = c.docs.find((d) => d.id === s.source!.docId);
        expect(doc?.sections.some((sec) => sec.id === s.source!.sectionId), `${s.id}`).toBe(true);
      }
    }
  });

  it('Jordan starts without SALES-DE or Report viewer', () => {
    expect(w.employee.name).toBe('Jordan Lee');
    expect(w.employee.costCentres).toEqual(['DE-GENERAL']);
    expect(w.employee.roles).not.toContain('Report viewer');
    expect(w.employee.receipt).toEqual({ selected: 'heic', status: 'idle' }); // the first upload fails live
  });

  it('Priya and Tom are out of office; Lee is the backup admin', () => {
    const p = (id: string) => w.people.find((x) => x.id === id)!;
    expect(p('priya').outOfOfficeUntil).toBeDefined();
    expect(p('tom').outOfOfficeUntil).toBeDefined();
    expect(p('lee').role).toMatch(/backup/i);
  });

  it('history has 120 sessions, 38 on the cost centre', () => {
    const h = createHistory();
    expect(h).toHaveLength(120);
    expect(h.filter((x) => x.issueId === 'cost-centre')).toHaveLength(38);
  });
});

import { describe, expect, it } from 'vitest';
import { createHistory } from '../src/data/seed';
import { isResolved } from '../src/engine/diagnose';
import { buildRequest } from '../src/engine/handoff';
import { insights, stuckLabel } from '../src/engine/insights';
import { applyMock, approveRequest, askInfo, sendRequest } from '../src/engine/world';
import { config, world } from './fixtures';

const c = config();

describe('mock Expensio', () => {
  it('upload fails for the HEIC file and works for the JPG', () => {
    const w = world();
    expect(applyMock(w, { type: 'upload' }).employee.receipt.status).toBe('failed');
    const jpg = applyMock(applyMock(w, { type: 'selectFile', f: 'jpg' }), { type: 'upload' });
    expect(jpg.employee.receipt.status).toBe('uploaded');
  });

  it('only SALES-DE can be joined by the employee', () => {
    expect(applyMock(world(), { type: 'join', cc: 'SALES-DE' }).employee.costCentres).toContain('SALES-DE');
    expect(applyMock(world(), { type: 'join', cc: 'FIN-DE' }).employee.costCentres).not.toContain('FIN-DE');
  });

  it('cannot pick or submit with a cost centre you are not on', () => {
    const w = applyMock(world(), { type: 'pickCostCentre', cc: 'SALES-DE' });
    expect(w.employee.draft.costCentre).toBeNull();
    expect(applyMock(w, { type: 'submit' }).employee.draft.submitted).toBe(false);
  });
});

describe('requests', () => {
  it('approving applies each change, and the issue is resolved', () => {
    for (const id of ['cost-centre', 'approval', 'report'] as const) {
      let w = sendRequest(world(), buildRequest(c, world(), id, []));
      expect(isResolved(id, w)).toBe(false);
      w = approveRequest(w, w.requests[0].id, 'lee');
      expect(isResolved(id, w), id).toBe(true);
      expect(w.requests[0]).toMatchObject({ status: 'approved', approvedBy: 'lee' });
    }
  });

  it('sending twice for the same issue keeps one request', () => {
    const r = buildRequest(c, world(), 'cost-centre', []);
    const w = sendRequest(sendRequest(world(), r), r);
    expect(w.requests).toHaveLength(1);
  });

  it('ask for info keeps it open with a note', () => {
    let w = sendRequest(world(), buildRequest(c, world(), 'report', []));
    w = askInfo(w, w.requests[0].id, 'tom', 'Which team report do you need?');
    expect(w.requests[0]).toMatchObject({ status: 'info', note: 'Which team report do you need?' });
    expect(isResolved('report', w)).toBe(false);
  });
});

describe('insights', () => {
  const h = createHistory();

  it('aggregates the seeded week', () => {
    const i = insights(h, world());
    expect(i.total).toBe(120);
    expect(i.top[0]).toEqual({ issueId: 'cost-centre', count: 38 });
    expect(i.selfPct + i.handoffPct).toBe(100);
    expect(i.selfPct).toBe(32); // 38 of 120 self-resolved
    expect(i.stuckSteps[0]).toEqual({ stepId: 'a3', count: 36 });
    expect(i.medianMinutes).toBeGreaterThan(0);
    expect(i.firstTimeApprovalPct).toBeGreaterThan(50);
    expect(i.actionable).toMatch(/38 people stuck on the cost centre/);
    expect(i.actionable).toMatch(/fix the config, not 36 tickets/); // 2 of the 38 self-resolved
  });

  it('week-1 numbers stay fixed; today\'s live sessions are reported separately', () => {
    const w = sendRequest(world(), buildRequest(c, world(), 'cost-centre', []));
    const i = insights(h, w);
    expect(i.total).toBe(120);
    expect(i.top[0].count).toBe(38);
    expect(i.liveToday).toBe(1);
  });

  it('step labels are anonymised', () => {
    const i = insights(h, world());
    expect(i.stuckSteps.map((s) => s.stepId)).toContain('a3');
    expect(stuckLabel(c, 'a3', world())).toBe("Can't see my cost centre: Add someone to cost centre SALES-DE");
    expect(stuckLabel(c, 'b2', world())).toMatch(/^Receipt upload fails: Export the photo/);
    expect(stuckLabel(c, 'c2', world())).not.toMatch(/Priya/);
  });
});

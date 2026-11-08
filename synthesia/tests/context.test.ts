import { describe, expect, it } from 'vitest';
import { contextIssue } from '../src/engine/context';
import { respond, startFromContext, type Step } from '../src/engine/session';
import { applyMock } from '../src/engine/world';
import { config, world } from './fixtures';

const said = (steps: Step[]) =>
  steps
    .filter((x) => x.kind === 'say' || x.kind === 'instruct')
    .map((x) => (x as { text: string }).text)
    .join(' ');
const questions = (steps: Step[]) => steps.filter((x) => x.kind === 'say' && x.text.trim().endsWith('?')).length;

describe('page context', () => {
  it('knows the problem from where the employee is and what failed', () => {
    const w = world();
    expect(contextIssue(w, 'receipt')).toBeNull(); // nothing failed yet
    expect(contextIssue(applyMock(w, { type: 'upload' }), 'receipt')).toBe('receipt');
    expect(contextIssue(w, 'new-expense')).toBe('cost-centre');
    expect(contextIssue(applyMock(w, { type: 'join', cc: 'SALES-DE' }), 'new-expense')).toBeNull();
    expect(contextIssue(w, 'approvals')).toBe('approval');
    expect(contextIssue(w, 'reports')).toBe('report');
    expect(contextIssue(w, 'profile')).toBeNull();
  });
});

it('describing the same problem while Ava waits on an offer is acknowledged, and the offer repeated', () => {
  const start = startFromContext(config(), world(), 'cost-centre', 'new-expense');
  const r = respond(config(), world(), start.session, "I can't see my cost centre", false, 'new-expense');
  expect(said(r.steps)).toMatch(/that's the one I'm looking at/);
  expect(said(r.steps)).toMatch(/Shall I\?/);
  expect(questions(r.steps)).toBe(1);
});

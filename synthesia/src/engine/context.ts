import { RECEIPT_FILES, type IssueId, type MockTab, type World } from '../data/types';

/**
 * Ava starts from what's on the employee's screen: the page they're on and what just failed there.
 * This is page context (what the employee can already see), not an account check.
 */
export function contextIssue(w: World, tab: MockTab): IssueId | null {
  const e = w.employee;
  switch (tab) {
    case 'new-expense':
      return e.costCentres.includes('SALES-DE') ? null : 'cost-centre';
    case 'receipt':
      return e.receipt.status === 'failed' ? 'receipt' : null;
    case 'approvals':
      return e.approval.status === 'pending' && !e.approval.delegateId ? 'approval' : null;
    case 'reports':
      return e.roles.includes('Report viewer') ? null : 'report';
    default:
      return null;
  }
}

/** One sentence: what Ava can see on the page. */
export function contextLine(id: IssueId, w: World): string {
  const e = w.employee;
  switch (id) {
    case 'cost-centre':
      return "I can see you're on New expense, and SALES-DE isn't in your cost-centre list.";
    case 'receipt': {
      const f = e.receipt.selected ? RECEIPT_FILES[e.receipt.selected] : undefined;
      return e.receipt.status === 'failed' && f ? `I can see the upload of ${f.name} just failed.` : "I can see you're trying to attach a receipt.";
    }
    case 'approval':
      return `I can see your expense "${e.approval.title}" is still waiting for approval.`;
    case 'report':
      return 'I can see Team reports is locked for you.';
    case 'bank':
      return "I can see you're asking about a reimbursement.";
  }
}

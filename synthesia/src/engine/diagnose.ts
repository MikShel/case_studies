import { ACCEPTED_FORMATS, MAX_RECEIPT_MB, RECEIPT_FILES, type IssueId, type World } from '../data/types';
import { formatDay } from './time';

export interface Diagnosis {
  /** one sentence, for the admin's handoff card */
  summary: string;
  /** what Ava tells the employee: their own account only, never anyone else's data */
  why: string;
}

const person = (w: World, id: string) => w.people.find((p) => p.id === id)!;

export function isResolved(id: IssueId, w: World): boolean {
  const e = w.employee;
  switch (id) {
    case 'cost-centre':
      return e.costCentres.includes('SALES-DE');
    case 'receipt':
      return e.receipt.status === 'uploaded';
    case 'approval':
      return e.approval.status === 'approved' || e.approval.delegateId !== undefined;
    case 'report':
      return e.roles.includes('Report viewer');
    case 'bank':
      return false;
  }
}

export function diagnose(id: IssueId, w: World): Diagnosis {
  const e = w.employee;
  switch (id) {
    case 'cost-centre':
      return isResolved(id, w)
        ? { summary: `${e.name} is assigned to cost centre SALES-DE.`, why: "You're on SALES-DE now, so it shows up in the list." }
        : {
            summary: `${e.name} isn't assigned to cost centre SALES-DE, so it can't be picked on expenses.`,
            why: "I checked your account: you're not assigned to SALES-DE yet, so it can't show up in the list.",
          };
    case 'receipt': {
      const f = e.receipt.selected ? RECEIPT_FILES[e.receipt.selected] : undefined;
      if (!f) return { summary: `${e.name} hasn't picked a receipt file yet.`, why: "You haven't picked a file yet." };
      const badFormat = !ACCEPTED_FORMATS.includes(f.format);
      const tooBig = f.sizeMb > MAX_RECEIPT_MB;
      if (!badFormat && !tooBig) {
        return { summary: `Receipt ${f.name} meets the upload rules.`, why: `${f.name} is a ${f.format} of ${f.sizeMb} MB, which Expensio accepts.` };
      }
      const problems = [badFormat && `a ${f.format} photo`, tooBig && `${f.sizeMb} MB`].filter(Boolean).join(' and ');
      return {
        summary: `Receipt ${f.name} is rejected because it is ${problems}, outside the JPG/PNG/PDF and ${MAX_RECEIPT_MB} MB limits.`,
        why: `Your file, ${f.name}, is ${problems} — Expensio takes JPG, PNG or PDF up to ${MAX_RECEIPT_MB} MB.`,
      };
    }
    case 'approval': {
      const approver = person(w, e.approval.approverId);
      if (isResolved(id, w)) {
        const delegate = e.approval.delegateId ? person(w, e.approval.delegateId) : undefined;
        return {
          summary: `${e.name}'s expense is with ${delegate?.name ?? approver.name} for approval.`,
          why: delegate ? `It's with ${delegate.name} now, who's covering ${approver.name}'s approvals.` : 'It has been approved.',
        };
      }
      const until = approver.outOfOfficeUntil ? ` until ${formatDay(approver.outOfOfficeUntil)}` : '';
      return {
        summary: `${e.name}'s expense is stuck with approver ${approver.name}, who is out of office${until} with no delegate set.`,
        why: `It's waiting on ${approver.name}, who's out of office${until}, and no delegate is set.`,
      };
    }
    case 'report':
      return isResolved(id, w)
        ? { summary: `${e.name} has the Report viewer role.`, why: 'You have the Report viewer role now.' }
        : {
            summary: `${e.name} can't open Team reports because the account doesn't have the Report viewer role.`,
            why: "Team reports need the Report viewer role, and your account doesn't have it yet. That's also why I can't show you anything from the report.",
          };
    case 'bank':
      return { summary: `${e.name} has a question about reimbursement and bank details.`, why: 'Anything touching bank details is handled by Payroll, not by me.' };
  }
}

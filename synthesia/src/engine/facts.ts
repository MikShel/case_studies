import type { AvaRole, IssueId, Permission, World } from '../data/types';
import { diagnose } from './diagnose';
import { formatDay } from './time';

/**
 * What Ava can say about an issue.
 *  - page facts: visible on the employee's screen — always allowed
 *  - role facts: need a permission the admin granted in Ava's role; otherwise Ava says she isn't allowed
 */
const person = (w: World, id: string) => w.people.find((p) => p.id === id);

export function pageFacts(id: IssueId, w: World): string[] {
  const e = w.employee;
  switch (id) {
    case 'receipt':
      return [diagnose('receipt', w).why];
    case 'approval': {
      const a = person(w, e.approval.approverId);
      return [`It's waiting on ${a?.name}${a?.outOfOfficeUntil ? `, who's out of office until ${formatDay(a.outOfOfficeUntil)}` : ''}.`];
    }
    case 'report':
      return ['Team reports needs the Report viewer role.'];
    case 'bank':
      return ["It isn't marked Paid yet."];
    default:
      return [];
  }
}

const SPOKEN: Record<Permission, string> = {
  account: 'your account',
  costCentres: 'the cost-centre list',
  directory: "who's available",
  approvalChain: 'the approval chain',
  auditLog: 'the audit log',
  insights: 'rollout insights',
};
const CANT_TELL: Partial<Record<Permission, string>> = {
  account: "why it's happening",
  auditLog: 'what changed',
  approvalChain: 'whether a delegate is set',
};

export function cardLabel(p: Permission, w: World): string {
  return p === 'account' ? `${w.employee.name.split(' ')[0]}'s account` : SPOKEN[p];
}

export function notAllowedLine(p: Permission): string {
  return `I'm not allowed to check ${SPOKEN[p]}${CANT_TELL[p] ? `, so I can't tell ${CANT_TELL[p]}` : ''}.`;
}

/** Facts beyond the page, as far as Ava's role allows, plus what she couldn't check. */
export function roleFacts(id: IssueId, w: World, role: AvaRole): { lines: string[]; missing: Permission[] } {
  const lines: string[] = [];
  const missing: Permission[] = [];
  const need = (p: Permission, line: string) => (role[p] ? lines.push(line) : missing.push(p));
  switch (id) {
    case 'cost-centre': {
      need('account', diagnose('cost-centre', w).why);
      if (role.costCentres) lines.push("SALES-DE exists: it's the Sales Germany cost centre.");
      const imp = w.audit.find((a) => /Rollout import/.test(a.text));
      if (imp) need('auditLog', `The audit log shows why: the rollout import on ${formatDay(imp.at)} mapped Sales Germany to DE-GENERAL.`);
      break;
    }
    case 'approval':
      need('approvalChain', `No delegate is set for ${person(w, w.employee.approval.approverId)?.name}'s approvals.`);
      break;
    case 'report':
      need('account', `Your account only has the ${w.employee.roles.join(', ')} role.`);
      break;
    default:
      break;
  }
  return { lines, missing };
}

/** The one-sentence-or-so diagnosis on the request, built only from what Ava was allowed to see. */
export function requestDiagnosis(id: IssueId, w: World, role: AvaRole, title: string): string {
  const e = w.employee;
  switch (id) {
    case 'cost-centre': {
      if (!role.account) return `${e.name} reported: ${title.toLowerCase()}.`;
      const audit = role.auditLog && w.audit.some((a) => /Rollout import/.test(a.text)) ? ' The rollout import mapped Sales Germany to DE-GENERAL.' : '';
      return `${diagnose(id, w).summary}${audit}`;
    }
    case 'approval': {
      if (role.approvalChain) return diagnose(id, w).summary;
      const a = person(w, e.approval.approverId);
      return `${e.name}'s expense is waiting on ${a?.name}, who is out of office.`;
    }
    case 'report':
      return role.account ? diagnose(id, w).summary : `${e.name} can't open Team reports.`;
    default:
      return diagnose(id, w).summary;
  }
}

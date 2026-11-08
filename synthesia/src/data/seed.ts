import type { Config, KnowledgeDoc, PastSession, World } from './types';

const DAY = 24 * 60 * 60 * 1000;

export function createConfig(): Config {
  return { connected: false, published: false, role: { ...DEFAULT_ROLE }, docs: structuredClone(DOCS), issues: structuredClone(ISSUES) };
}

export const DEFAULT_ROLE: Config['role'] = {
  account: true,
  costCentres: true,
  directory: true,
  approvalChain: true,
  auditLog: true,
  insights: true,
}

const DOCS: KnowledgeDoc[] = [
  {
    id: 'guide',
    title: 'Expensio rollout guide',
    kind: 'doc',
    sections: [
      { id: 'g2', heading: '§2 Your first expense', text: 'Open New expense, pick a cost centre, attach a receipt and press Submit.' },
      { id: 'g32', heading: '§3.2 Finding your cost centre', text: "The cost-centre list shows 'My cost centres' by default. Switch the filter to 'All' to see every cost centre you are assigned to." },
      { id: 'g33', heading: '§3.3 Joining a cost centre', text: 'Cost centres are normally assigned by the Expensio admin. Some departments allow employees to join their own cost centre from Profile → Cost centres.' },
      { id: 'g4', heading: '§4 Receipts', text: 'Expensio accepts JPG, PNG and PDF files up to 10 MB. iPhone photos are HEIC by default: export them as JPG, or upload from the Expensio mobile app, which converts automatically.' },
      { id: 'g5', heading: '§5 Approvals', text: 'My approvals shows each expense you submitted and who it is waiting on.' },
      { id: 'g6', heading: '§6 Reports', text: "Team reports are available to people with the 'Report viewer' role." },
    ],
  },
  {
    id: 'faq',
    title: 'Expensio FAQ',
    kind: 'doc',
    sections: [
      { id: 'q4', heading: 'Q4 The form looks out of date', text: 'Press Refresh at the top of the form to reload your cost centres.' },
      { id: 'q5', heading: 'Q5 My cost centre is missing — can I still submit?', text: 'Yes. Submit with your default cost centre (DE-GENERAL in Germany). Finance can re-assign it later.' },
      { id: 'q8', heading: 'Q8 When will I be reimbursed?', text: "Paid expenses show the status 'Paid'. The money arrives within 5 working days." },
      { id: 'q9', heading: 'Q9 Changing bank details', text: 'Bank details are managed by Payroll in the HR portal.' },
    ],
  },
  {
    id: 'known',
    title: 'Known issues, week 1',
    kind: 'doc',
    sections: [
      { id: 'k1', heading: '#1 SALES-DE missing for Sales Germany', text: "The rollout config didn't map Sales Germany to SALES-DE. Admin fix: add the person to SALES-DE in Admin → Cost centres." },
      { id: 'k2', heading: '#2 HEIC receipts rejected', text: 'See rollout guide §4.' },
      { id: 'k3', heading: '#3 Team reports: access denied', text: "People need the 'Report viewer' role, granted by an admin in Admin → Roles." },
      { id: 'k4', heading: '#4 Approvals stuck', text: 'Expenses waiting on an approver who is away. No fix documented yet.' },
    ],
  },
];

const ISSUES: Config['issues'] = [
  {
    id: 'cost-centre',
    title: "Can't see my cost centre",
    symptoms: ['cost centre', 'cost center', 'costcentre', 'sales-de'],
    recipient: 'admin',
    steps: [
      {
        id: 'a1',
        instruction: "Switch the cost-centre filter from 'My cost centres' to 'All'.",
        tag: 'user',
        source: { docId: 'guide', sectionId: 'g32' },
        target: { tab: 'new-expense', hl: 'exp-cc-filter' },
        check: 'Can you see SALES-DE now?',
        actions: [{ type: 'setFilter', v: 'all' }],
        offer: 'I can switch the filter to All for you.',
      },
      {
        id: 'a2',
        instruction: 'Press Refresh at the top of the form.',
        tag: 'user',
        source: { docId: 'faq', sectionId: 'q4' },
        target: { tab: 'new-expense', hl: 'exp-refresh' },
        check: 'Is it there after refreshing?',
        actions: [{ type: 'refresh' }],
        offer: 'I can press Refresh for you.',
      },
      {
        id: 'a3',
        instruction: 'Join SALES-DE yourself in Profile → Cost centres.',
        adminRequest: 'Add Jordan Lee to cost centre SALES-DE',
        source: { docId: 'guide', sectionId: 'g33' },
        target: { tab: 'profile', hl: 'profile-join-SALES-DE' },
        check: 'Can you pick SALES-DE in the form now?',
        actions: [{ type: 'join', cc: 'SALES-DE' }],
        offer: 'I can open Profile and join SALES-DE for you.',
      },
    ],
    workaround: {
      id: 'aw',
      instruction: 'Submit with your default cost centre, DE-GENERAL. Finance can re-assign it to SALES-DE later.',
      tag: 'user',
      source: { docId: 'faq', sectionId: 'q5' },
      target: { tab: 'new-expense', hl: 'exp-costcentre' },
      check: '',
    },
  },
  {
    id: 'receipt',
    title: 'Receipt upload fails',
    symptoms: ['receipt', 'upload', 'heic', 'photo', 'file'],
    recipient: 'admin',
    steps: [
      {
        id: 'b1',
        instruction: 'Look at the file you picked: Expensio takes JPG, PNG or PDF, up to 10 MB.',
        tag: 'user',
        source: { docId: 'guide', sectionId: 'g4' },
        target: { tab: 'receipt', hl: 'receipt-file' },
        check: 'Is your file a HEIC photo, or bigger than 10 MB?',
        observe: true,
      },
      {
        id: 'b2',
        instruction: 'Export the photo as JPG (or use the Expensio mobile app), then pick IMG_2041.jpg and press Upload.',
        tag: 'user',
        source: { docId: 'guide', sectionId: 'g4' },
        target: { tab: 'receipt', hl: 'receipt-upload' },
        check: 'Did the upload work?',
        actions: [{ type: 'selectFile', f: 'jpg' }, { type: 'upload' }],
        offer: 'I can pick IMG_2041.jpg and upload it for you.',
      },
    ],
  },
  {
    id: 'approval',
    title: 'Approval is stuck',
    symptoms: ['approval', 'approve', 'approver', 'stuck', 'pending'],
    recipient: 'admin',
    gap: 'Approval stuck with an absent manager: no doc covers delegation.',
    steps: [
      {
        id: 'c1',
        instruction: "Open My approvals and look at who it's waiting on.",
        tag: 'user',
        source: { docId: 'guide', sectionId: 'g5' },
        target: { tab: 'approvals', hl: 'approval-row' },
        check: "Can you see who it's waiting on?",
        observe: true,
      },
      {
        id: 'c2',
        instruction: "Set a delegate for Priya Shah's approvals.",
        adminRequest: "Set a delegate for Priya Shah's approvals",
        tag: 'admin',
        check: '',
      },
    ],
  },
  {
    id: 'report',
    title: "Can't open the team expense report",
    symptoms: ['report', 'reports', 'team expense'],
    recipient: 'admin',
    steps: [
      {
        id: 'd1',
        instruction: "Open Reports and choose the 'Team reports' tab.",
        tag: 'user',
        source: { docId: 'guide', sectionId: 'g6' },
        target: { tab: 'reports', hl: 'reports-team-tab' },
        check: 'Can you open it now?',
        observe: true,
      },
      {
        id: 'd2',
        instruction: 'Grant Jordan Lee the Report viewer role.',
        adminRequest: 'Grant Jordan Lee the Report viewer role',
        tag: 'admin',
        source: { docId: 'known', sectionId: 'k3' },
        check: '',
      },
    ],
  },
  {
    id: 'bank',
    title: 'Reimbursement and bank details',
    symptoms: ['bank', 'reimburse', 'reimbursement', 'reimbursed', 'payment', 'paid'],
    recipient: 'payroll',
    steps: [
      {
        id: 'e1',
        instruction: "Open My approvals and check whether the expense shows 'Paid'.",
        tag: 'user',
        source: { docId: 'faq', sectionId: 'q8' },
        target: { tab: 'approvals', hl: 'approval-row' },
        check: "Does it show 'Paid'?",
        observe: true,
      },
      {
        id: 'e2',
        instruction: 'Change your bank details.',
        adminRequest: 'Payroll to contact Jordan Lee about bank details',
        tag: 'never',
        source: { docId: 'faq', sectionId: 'q9' },
        check: '',
      },
    ],
  },
];

function nextWeekday(now: Date, weekday: number): string {
  const d = new Date(now);
  d.setUTCHours(17, 0, 0, 0);
  do d.setTime(d.getTime() + DAY);
  while (d.getUTCDay() !== weekday);
  return d.toISOString();
}

export function createWorld(now: Date): World {
  return {
    now: now.toISOString(),
    people: [
      { id: 'priya', name: 'Priya Shah', role: 'Sales manager · approver', outOfOfficeUntil: nextWeekday(new Date(now.getTime() + 3 * DAY), 1) },
      { id: 'tom', name: 'Tom Becker', role: 'Expensio admin', outOfOfficeUntil: nextWeekday(now, 4) },
      { id: 'lee', name: 'Lee Wong', role: 'Backup admin' },
      { id: 'marco', name: 'Marco Rossi', role: 'Sales lead · approver rights' },
      { id: 'payroll', name: 'Payroll team', role: 'Payroll' },
    ],
    employee: {
      id: 'jordan',
      name: 'Jordan Lee',
      team: 'Sales',
      city: 'Berlin',
      costCentres: ['DE-GENERAL'],
      roles: ['Submitter'],
      ccFilter: 'mine',
      receipt: { selected: 'heic', status: 'idle' },
      approval: { title: 'Client dinner, Hamburg · €184.50', approverId: 'priya', status: 'pending' },
      draft: { costCentre: null, submitted: false },
    },
    requests: [],
    audit: [
      { id: 'au-1', at: new Date(now.getTime() - 5 * DAY).toISOString(), actor: 'Tom Becker', text: 'Rollout import: Sales Germany mapped to cost centre DE-GENERAL (SALES-DE not assigned).' },
      { id: 'au-2', at: new Date(now.getTime() - 4 * DAY).toISOString(), actor: 'Tom Becker', text: 'Set out of office until Thursday.' },
    ],
  };
}

/** ~120 anonymised past sessions from the first rollout week, generated deterministically. */
export function createHistory(): PastSession[] {
  const out: PastSession[] = [];
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const add = (n: number, s: Omit<PastSession, 'minutes' | 'approvedFirstTime'>, minutes: [number, number]) => {
    for (let i = 0; i < n; i++) {
      out.push({
        ...s,
        minutes: Math.round(minutes[0] + rand() * (minutes[1] - minutes[0])),
        ...(s.outcome === 'handoff' ? { approvedFirstTime: rand() < 0.86 } : {}),
      });
    }
  };
  add(36, { issueId: 'cost-centre', outcome: 'handoff', stuckStepId: 'a3', team: 'Sales Germany' }, [240, 1800]);
  add(2, { issueId: 'cost-centre', outcome: 'self', stuckStepId: 'a1', team: 'Sales Germany' }, [3, 6]);
  add(10, { issueId: 'receipt', outcome: 'self', stuckStepId: 'b1' }, [2, 5]);
  add(24, { issueId: 'receipt', outcome: 'self', stuckStepId: 'b2' }, [3, 8]);
  add(20, { issueId: 'approval', outcome: 'handoff', stuckStepId: 'c2' }, [300, 2400]);
  add(2, { issueId: 'approval', outcome: 'self', stuckStepId: 'c1' }, [2, 4]);
  add(14, { issueId: 'report', outcome: 'handoff', stuckStepId: 'd2' }, [120, 1500]);
  add(5, { issueId: 'bank', outcome: 'handoff', stuckStepId: 'e2' }, [600, 2880]);
  add(7, { issueId: 'unknown', outcome: 'handoff' }, [200, 2000]);
  return out;
}

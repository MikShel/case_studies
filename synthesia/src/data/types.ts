/** Boundary tag the creator puts on each fix step. Untagged means "Needs admin" (see engine/boundary.ts). */
export type Tag = 'user' | 'admin' | 'never';

export interface SourceRef {
  docId: string;
  sectionId: string;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  kind: 'doc' | 'note';
  sections: { id: string; heading: string; text: string }[];
}

export type MockTab = 'new-expense' | 'receipt' | 'approvals' | 'reports' | 'profile';

/** Things done on the employee's screen in the mock Expensio app (by the employee, or by Ava with their OK). */
export type MockAction =
  | { type: 'setFilter'; v: 'mine' | 'all' }
  | { type: 'refresh' }
  | { type: 'selectFile'; f: 'heic' | 'jpg' }
  | { type: 'upload' }
  | { type: 'join'; cc: string }
  | { type: 'pickCostCentre'; cc: string }
  | { type: 'submit' };

/** What the admin lets Ava check beyond the page. Looking at the page is always allowed; acting on it needs the employee's OK. */
export type Permission = 'account' | 'costCentres' | 'directory' | 'approvalChain' | 'auditLog' | 'insights';
export type AvaRole = Record<Permission, boolean>;

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  text: string;
}

export interface FixStep {
  id: string;
  /** what Ava tells the user, if the step is theirs to do */
  instruction: string;
  /** the exact change, if an admin does it */
  adminRequest?: string;
  tag?: Tag;
  source?: SourceRef;
  target?: { tab: MockTab; hl: string };
  /** the one question Ava asks after the step, when she can't see the result on the page */
  check: string;
  /** what Ava can do on the page for the employee, with their OK */
  actions?: MockAction[];
  /** how Ava offers it: "I can switch the filter to All for you." */
  offer?: string;
  /** Ava reads the result straight off the page after this step (no question needed) */
  observe?: boolean;
}

export type IssueId = 'cost-centre' | 'receipt' | 'approval' | 'report' | 'bank';

export interface Issue {
  id: IssueId;
  title: string;
  symptoms: string[];
  steps: FixStep[];
  workaround?: FixStep;
  recipient: 'admin' | 'payroll';
  /** knowledge gap found when connecting sources */
  gap?: string;
}

export interface Config {
  connected: boolean;
  published: boolean;
  /** Ava's role: granted by the admin */
  role: AvaRole;
  docs: KnowledgeDoc[];
  issues: Issue[];
}

export interface Person {
  id: string;
  name: string;
  role: string;
  outOfOfficeUntil?: string;
}

export interface Employee {
  id: string;
  name: string;
  team: string;
  city: string;
  costCentres: string[];
  roles: string[];
  ccFilter: 'mine' | 'all';
  receipt: { selected: 'heic' | 'jpg' | null; status: 'idle' | 'failed' | 'uploaded' };
  approval: { title: string; approverId: string; delegateId?: string; status: 'pending' | 'approved' };
  draft: { costCentre: string | null; submitted: boolean };
}

export type Effect =
  | { type: 'addCostCentre'; cc: string }
  | { type: 'addRole'; role: string }
  | { type: 'setDelegate'; forId: string; delegateId: string }
  | { type: 'none' };

export interface HandoffRequest {
  id: string;
  issueId: IssueId | 'unknown';
  diagnosis: string;
  change: string;
  affects: string;
  tried: string[];
  source?: SourceRef;
  /** no documented fix: the admin has to investigate */
  undocumented: boolean;
  /** what Ava wasn't allowed to check (her role), shown to the admin */
  notChecked?: string[];
  to: string;
  status: 'waiting' | 'approved' | 'info';
  createdAt: string;
  effect: Effect;
  /** who approved it, or asked for more info */
  approvedBy?: string;
  /** resolved live on a call with the admin */
  onCall?: boolean;
  note?: string;
}

export interface World {
  now: string;
  people: Person[];
  employee: Employee;
  requests: HandoffRequest[];
  /** an admin fixed the rollout mapping for the whole team */
  configFixedBy?: string;
  audit: AuditEntry[];
}

export interface PastSession {
  issueId: IssueId | 'unknown';
  outcome: 'self' | 'handoff';
  stuckStepId?: string;
  /** team of the (anonymised) employee, for aggregate checks */
  team?: string;
  minutes: number;
  approvedFirstTime?: boolean;
}

export const RECEIPT_FILES = {
  heic: { name: 'IMG_2041.HEIC', sizeMb: 14.2, format: 'HEIC' },
  jpg: { name: 'IMG_2041.jpg', sizeMb: 2.1, format: 'JPG' },
} as const;

export const ACCEPTED_FORMATS = ['JPG', 'PNG', 'PDF'];
export const MAX_RECEIPT_MB = 10;

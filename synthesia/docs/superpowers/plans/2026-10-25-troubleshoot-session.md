# Troubleshooting Session PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot the repo to a three-view prototype (Creator studio · Employee session · Admin & insights). In it, a creator's boundary
config drives a simulated avatar, Ava, that troubleshoots Expensio issues and ends in a clean async handoff.

**Architecture:** A pure, tested engine (`src/engine/`) reads `Config` (creator knowledge + boundary) and `World` (Jordan's
Expensio state, people, requests), and returns `Step`s. The same `planPath` powers both the live session and the creator's
"Test before publish". The UI director plays the steps (speak, switch the mock tab, highlight, show the handoff card).
State lives in one useReducer store.

**Tech Stack:** Vite + React 19 + TypeScript, Vitest, plain CSS.

**Spec:** `docs/superpowers/specs/2026-10-25-troubleshoot-session-design.md`

## Global Constraints
- No network, no LLM, no Synthesia API. Static build with relative asset paths (`base: './'`).
- Ava never instructs a step whose effective tag isn't `user`. **Untagged = `admin`**. No source means no instruction.
- A yes only counts for a visible card. Only short replies (≤ 4 words) count as yes/no.
- Each Ava turn asks **at most one question** (at most one `say` ending in "?").
- People are named, never referred to with gendered pronouns. Times are in UTC (`src/engine/time.ts`).
- Fonts ≥ 15px base for screen sharing.
- Never publish or deploy without asking the user.

## Review Focus
1. **Re-tag mid-session:** if the creator re-tags a step while the employee session is mid-flow, the next step uses the new tag (the engine reads config on every respond) → test in Task 4.
2. **The user says "yes, it works" but the state disagrees:** Ava says what she sees, never "great, fixed" → test in Task 4.
3. **Unknown or garbled input during a check step:** treat it as "didn't help" and move on. Never re-ask the same question twice in a row → test in Task 4.
4. **Two handoffs for the same issue:** re-asking after a request was sent shows the existing request status instead of a duplicate → test in Task 4.
5. **Issue (d) exposure:** nothing Ava says contains another person's name or any amount from the team report → test in Task 4.

---

### Task 1: Clean slate, types, seed

**Files:** delete the old engine/ui/tests (keep `time.ts`, `AvatarAdapter.ts`, `speechInput.ts`, `director.ts` and their tests).
Create `src/data/types.ts` and `src/data/seed.ts` (`createConfig()`, `createWorld(now)`, `createHistory()`). Test: `tests/seed.test.ts`.

**Interfaces (produces):**
```ts
type Tag = 'user' | 'admin' | 'never';
interface SourceRef { docId: string; sectionId: string }
interface KnowledgeDoc { id: string; title: string; kind: 'doc' | 'note'; sections: { id: string; heading: string; text: string }[] }
type MockTab = 'new-expense' | 'receipt' | 'approvals' | 'reports' | 'profile';
interface FixStep { id: string; instruction: string; adminRequest?: string; tag?: Tag; source?: SourceRef;
  target?: { tab: MockTab; hl: string }; check: string }
type IssueId = 'cost-centre' | 'receipt' | 'approval' | 'report' | 'bank';
interface Issue { id: IssueId; title: string; symptoms: string[]; confirm: string; steps: FixStep[]; workaround?: FixStep;
  recipient: 'admin' | 'payroll'; gap?: string }
interface Config { connected: boolean; published: boolean; docs: KnowledgeDoc[]; issues: Issue[] }
interface Person { id: string; name: string; role: string; outOfOfficeUntil?: string }
interface Employee { id: string; name: string; team: string; city: string; costCentres: string[]; roles: string[];
  ccFilter: 'mine' | 'all'; receipt: { selected: 'heic' | 'jpg' | null; status: 'idle' | 'failed' | 'uploaded' };
  approval: { title: string; approverId: string; delegateId?: string; status: 'pending' | 'approved' };
  draft: { costCentre: string | null; submitted: boolean } }
type Effect = { type: 'addCostCentre'; cc: string } | { type: 'addRole'; role: string } | { type: 'setDelegate'; forId: string; delegateId: string } | { type: 'none' };
interface HandoffRequest { id: string; issueId: IssueId | 'unknown'; diagnosis: string; change: string; affects: string;
  tried: string[]; source?: SourceRef; undocumented: boolean; to: string; status: 'waiting' | 'approved' | 'info'; createdAt: string; effect: Effect; note?: string }
interface World { now: string; people: Person[]; employee: Employee; requests: HandoffRequest[] }
interface PastSession { issueId: IssueId | 'unknown'; outcome: 'self' | 'handoff'; stuckStepId?: string; minutes: number; approvedFirstTime?: boolean }
const RECEIPT_FILES = { heic: { name: 'IMG_2041.HEIC', sizeMb: 14.2, format: 'HEIC' }, jpg: { name: 'IMG_2041.jpg', sizeMb: 2.1, format: 'JPG' } };
```
Seed values are pinned by the spec table. Step ids: `a1 a2 a3 aw`, `b1 b2`, `c1 c2`, `d1 d2`, `e1 e2`. People ids: `priya`, `tom`, `lee`, `marco`.

- [ ] Step 1: write the failing `tests/seed.test.ts`:
  - 3 docs titled exactly as in the spec.
  - 5 issues in the order a–e.
  - `a3` has no tag, and its adminRequest is "Add Jordan Lee to cost centre SALES-DE".
  - `c2.source` is undefined, and `c.gap` is set.
  - `e2.tag === 'never'`.
  - Jordan's `costCentres` is `['DE-GENERAL']` and doesn't contain 'Report viewer'.
  - Priya and Tom have `outOfOfficeUntil`.
  - `createHistory()` has length 120, with 38 `cost-centre` entries.
- [ ] Step 2: `npm test` → FAIL. Step 3: implement. Step 4: `npm test` → PASS; `npm run build` OK (with a placeholder `main.tsx`). Step 5: commit.

### Task 2: Boundary rules, diagnosis, issue matching

**Files:** `src/engine/boundary.ts`, `src/engine/diagnose.ts`. Test: `tests/boundary.test.ts`, `tests/diagnose.test.ts`.

**Produces:**
```ts
function effectiveTag(s: FixStep): Tag                 // tag ?? 'admin'
function isInstructable(s: FixStep): boolean           // effective 'user' && source
function selfServiceEnd(issue: Issue): number          // index of first step whose effective tag !== 'user' (steps.length if none)
function sourceLabel(c: Config, ref?: SourceRef): string | undefined   // "Expensio FAQ · Q5"
function matchIssue(c: Config, text: string): IssueId | null
function diagnose(id: IssueId, w: World): { summary: string; why: string }   // summary = one sentence for the handoff
function isResolved(id: IssueId, w: World): boolean
```
- [ ] Tests:
  - The default tag is admin; untagged and unsourced user steps are not instructable.
  - `selfServiceEnd(a) === 2`.
  - Matching: "I can't see my cost centre" → cost-centre; "receipt won't upload" → receipt; "my approval is stuck" → approval;
    "can't open the team expense report" → report; "change my bank account" → bank; "book a flight" → null.
  - Diagnoses: a mentions SALES-DE; b mentions HEIC and 14.2 MB; c mentions Priya Shah and out of office; d mentions Report viewer.
  - `isResolved` flips after each world change.
  - **The d diagnosis contains no other person's name.**
- [ ] RED → implement → GREEN → commit.

### Task 3: Path planning, creator test, publish gating

**Files:** `src/engine/plan.ts`, `src/engine/creatorTest.ts`. Test: `tests/creatorTest.test.ts`.

**Produces:**
```ts
type Beat = { kind: 'instruct'; step: FixStep } | { kind: 'skipped'; step: FixStep; reason: 'no-source' }
  | { kind: 'admin'; step: FixStep } | { kind: 'never'; step: FixStep } | { kind: 'workaround'; step: FixStep }
  | { kind: 'handoff'; documented: boolean } | { kind: 'resolved' } | { kind: 'unknown' };
function planPath(c: Config, id: IssueId | null): Beat[]
interface Scenario { id: string; line: string; expectIssue: IssueId | null }
const SCENARIOS: Scenario[]        // 6
interface ScenarioResult { scenario: Scenario; beats: Beat[]; neverInstructsAdmin: boolean; everythingSourced: boolean; pass: boolean; problem?: string }
function runScenarios(c: Config): ScenarioResult[]
function canPublish(c: Config): boolean
function closeGap(c: Config, now: string): Config    // adds note doc 'note-delegation', attaches it to c2, inserts new user step 'c1b' after c1
```
Path: walk the steps in order. A user step is `instruct` if sourced, else `skipped` (an invariant-2 failure). The first non-user
step ends self-service: `admin` (or `never`), then `workaround` if instructable, then `handoff` (documented iff that step has a source).
If all steps are user steps, the path ends with `resolved`. If there's no match, `[unknown, handoff(documented: false)]` counts as a pass
(an unknown request is honest).

- [ ] Tests:
  - On the seed, scenario c fails with a problem mentioning "Set a delegate" and "no source", and all others pass.
  - `canPublish(seed) === false`; after `closeGap`, everything passes, `canPublish` is true, and c's path includes the new step.
  - Untagging b2 makes scenario b's path stop at b2 as `admin`.
  - Tagging a3 as user makes the cost-centre path end in `resolved` with no handoff.
  - Removing the source of b1 makes b fail.
- [ ] RED → implement → GREEN → commit.

### Task 4: Session engine and handoff

**Files:** `src/engine/session.ts`, `src/engine/handoff.ts`, `src/engine/intents.ts` (yes/no). Test: `tests/session.test.ts`.

**Produces:**
```ts
type Step =
  | { kind: 'say'; text: string }
  | { kind: 'instruct'; text: string; source: string; stepNo: number; total: number }
  | { kind: 'tab'; tab: MockTab } | { kind: 'highlight'; ids: string[] } | { kind: 'clearHighlight' }
  | { kind: 'handoffCard'; draft: HandoffRequest } | { kind: 'send'; draft: HandoffRequest };
interface Session { issueId: IssueId | 'unknown' | null; stepIdx: number; tried: string[];
  awaiting: 'describe' | 'confirmIssue' | 'check' | 'handoff' | 'followUp' | 'done'; draft?: HandoffRequest; lastQuestion?: string }
const newSession: Session;
function buildRequest(c: Config, w: World, id: IssueId | 'unknown', tried: string[], text?: string): HandoffRequest
function respond(c: Config, w: World, s: Session, text: string, cardVisible: boolean): { steps: Step[]; session: Session }
function followUp(c: Config, w: World, r: HandoffRequest): Step[]   // after approval
function isYes(t: string): boolean; function isNo(t: string): boolean   // short replies only
```
Handoff: `to` is 'tom' by default (or 'payroll' for bank). `change` is the step's adminRequest, or "Investigate: <user's words>"
for unknown. `tried` holds the instructions of the steps that were tried. `affects`: "Jordan Lee (Sales, Berlin): 1 expense
waiting". `effect` follows the issue.

Flow (see spec):
- describe → match → confirm question.
- yes → step loop. Each user step emits `tab`, `highlight`, `instruct` and one `say(check?)`.
- After any reply, check `isResolved` → resolved message, or "I still can't see that on your account" when the user claimed yes.
- At an admin step: plain "needs an admin" + why + workaround (`instruct` with source) + `handoffCard` + one question "Shall I send it to Tom?".
- yes (card visible) → `send` + status lines (no question, or one "Anything else?").
- never → decline + Payroll card.
- unknown → "I don't know that one" + card.

- [ ] Tests:
  - **Hard rules:** for every issue, both seed and after `closeGap`, scripted through to the end: no `instruct` refers to a step with effective tag ≠ user; every `instruct` has a source; no `send` happens without yes + `cardVisible`.
  - Each turn has ≤ 1 question.
  - Flow b ends resolved with no card after the world changes to uploaded.
  - Flow a reaches a card whose draft change is "Add Jordan Lee to cost centre SALES-DE", tried = [a1, a2] instructions, workaround spoken with "DE-GENERAL".
  - Re-tagging a3 to user mid-session → the next step is an instruct pointing at the profile tab.
  - The c card is marked undocumented on the seed and documented after `closeGap`.
  - d says "Report viewer" and no other names.
  - Unknown → card with `issueId: 'unknown'`.
  - A duplicate ask after sending → reports the waiting status, no second card.
  - `followUp` for an approved a request mentions SALES-DE and asks to re-submit.
- [ ] RED → implement → GREEN → commit.

### Task 5: World updates and insights

**Files:** `src/engine/world.ts`, `src/engine/insights.ts`. Test: `tests/world.test.ts`.

**Produces:**
```ts
type MockAction = { type: 'setFilter'; v: 'mine' | 'all' } | { type: 'selectFile'; f: 'heic' | 'jpg' } | { type: 'upload' }
  | { type: 'join'; cc: string } | { type: 'pickCostCentre'; cc: string } | { type: 'submit' };
function applyMock(w: World, a: MockAction): World
function sendRequest(w: World, r: HandoffRequest): World            // dedupes per issue while waiting
function approveRequest(w: World, id: string): World                // applies the effect, status → approved
function askInfo(w: World, id: string): World
function visibleCostCentres(w: World): string[]
interface Insights { total: number; top: { issueId: IssueId | 'unknown'; count: number }[]; stuckSteps: { stepId: string; count: number }[];
  selfPct: number; handoffPct: number; medianMinutes: number; firstTimeApprovalPct: number; actionable: string }
function insights(history: PastSession[], w: World): Insights
```
- [ ] Tests:
  - Upload fails for heic and succeeds for jpg.
  - Join works only for SALES-DE.
  - Approve applies each effect, and the diagnoses flip.
  - Sending twice keeps one waiting request.
  - Insights on the seed: total 120, top = cost-centre 38, and actionable contains "38 people stuck on the cost centre".
  - A live sent request increments the count.
- [ ] RED → implement → GREEN → commit.

### Task 6: Store, shell, Creator studio

**Files:** `src/store/AppStore.tsx` (rewrite), `src/ui/App.tsx`, `src/ui/TopBar.tsx`, `src/ui/creator/{Knowledge,Boundary,TestPublish}.tsx`,
`src/notes.ts`, `src/ui/Note.tsx`, `src/ui/styles.css`, `src/main.tsx`.

Store actions:
- `setView`, `setCreatorTab`, `setAdminTab`, `toggleNotes`
- `connect`, `setTag(issueId, stepId, tag | null)`, `closeGap`, `publish`
- `mock(MockAction)`, `setMockTab`, `highlight`, `clearHighlight`
- `send(draft)`, `approve(id)`, `askInfo(id)`
- `resetEmployee` (world + session epoch), `resetAll`

Publish is guarded by `canPublish`. Notes: `NOTES: Record<NoteId, { title; decision; why; metric }>` covering the 8 required topics.
- [ ] Build the views; `npm run build` OK.
- [ ] Manual check via the headless Chrome script: tags change, the test results update live, Publish is enabled only after Close gap.
- [ ] Commit.

### Task 7: Employee session

**Files:** `src/ui/employee/{MockExpensio,AvaPanel,HandoffCard,StepPanel}.tsx`; modify `src/avatar/director.ts` (new Step kinds) + its test.
- [ ] Update `tests/director.test.ts` for `instruct` / `tab` / `handoffCard` / `send` (RED → GREEN).
- [ ] AvaPanel:
  - Reuse the interruption and visible-card logic from the old AvatarPanel.
  - Add the video-style frame, the "AI avatar" label, captions (the current line), chips per issue, input, mic, mute and the StepPanel.
  - Follow-up: when the panel sees an approved request it hasn't announced, it plays `followUp`.
- [ ] Manual e2e: flows b, a (→ send), approve, follow-up; the re-tag twist; 0 console errors.
- [ ] Commit.

### Task 8: Admin & insights, guided demo, README, deploy prep

**Files:** `src/ui/admin/{Inbox,Insights,Governance,Metrics}.tsx`, `src/ui/GuidedDemo.tsx`, `README.md`, `src/avatar/AvatarAdapter.ts`
(seam comment), `vite.config.ts` (`base: './'`), `docs/DEPLOY.md`.
- [ ] Inbox: switch between Tom and Lee, request cards, Approve / Ask for info.
- [ ] Insights: bars rendered as plain CSS.
- [ ] Governance: credits, retention, disclosure.
- [ ] Metrics & learning.
- [ ] Guided demo: 6 beats, each with "Do it for me" + a hint of what to say.
- [ ] Full e2e run of the demo script; `npm test`, `npm run build`, and `npx vite preview` smoke check. Commit.

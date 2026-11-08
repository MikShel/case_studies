# Admin Call (live escalation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Let Jordan call the available backup admin from the handoff card; Ava joins, opens with a summary, answers Lee's
check from anonymised insights, and Lee approves on the call (for Jordan or the whole team).
**Architecture:** Pure `src/engine/call.ts` (summary, Lee's check, verification, recap) returns `Step`s; new Step kinds are
played by the director; world gains `resolveOnCall` and `configFixedBy`; the call UI replaces Ava's panel body.
**Spec:** `docs/superpowers/specs/2026-10-25-troubleshoot-session-design.md` (Addendum 2026-10-27)

## Global Constraints
- Ava never emits a state-changing step on the call; only Lee's "Approve as Lee" button changes the world.
- Calls only to available admins (`!outOfOfficeUntil`); Jordan initiates on a visible card.
- Ava's check answer uses aggregate counts only (no names). Post-approval, Ava confirms only what `isResolved` says.

## Review Focus
1. "Call Tom" while Tom is away → Ava says so and offers Lee; no call → test T1.
2. "Call Lee" with no visible card → re-show the card, no call → test T1.
3. Lee approves but state didn't change (e.g. reset mid-call) → Ava says she can't see it yet → test T1.
4. Ending the call before approval → request stays unsent/unchanged, recap says nothing was changed → test T1.
5. Team fix twice / insights after team fix → idempotent; insights banner → test T2.

### Task 1: Call engine
**Files:** `src/engine/call.ts`, modify `src/engine/session.ts` (new Step kinds + "call" intent), test `tests/call.test.ts`.
**Produces:**
```ts
type AdminFix = { scope: 'one' | 'team'; label: string; affects: string };
// new Step kinds in session.ts:
| { kind: 'startCall'; draft: HandoffRequest; with: string }
| { kind: 'participantSay'; who: string; text: string }
| { kind: 'summaryCard'; lines: { label: string; text: string }[] }
| { kind: 'adminCard'; fix: AdminFix }
function canCall(w: World, personId: string): boolean
interface CallState { draft: HandoffRequest; with: string; phase: 'summary' | 'checked' | 'deciding' | 'approved' | 'ended'; fix?: AdminFix }
function openCall(c: Config, w: World, draft: HandoffRequest, withId: string): { steps: Step[]; call: CallState }
function leeLines(call: CallState): string[]
function callTurn(c: Config, w: World, h: PastSession[], call: CallState, who: 'admin' | 'employee', text: string): { steps: Step[]; call: CallState }
function afterApproval(c: Config, w: World, call: CallState): { steps: Step[]; call: CallState }
function endCall(c: Config, w: World, call: CallState): { steps: Step[]; call: CallState; recap: string }
```
- [ ] Failing tests (canCall; respond "call Lee" → startCall only with visible card & available; summary content; check answer = 38, no names; no send/apply on call; adminCard for one/team; afterApproval honest; endCall recap) → implement → green → commit.

### Task 2: World + insights
**Files:** `src/data/types.ts` (`World.configFixedBy?`), `src/engine/world.ts` (`resolveOnCall(w, draft, by, fix, recap)`), `src/engine/insights.ts` (`fixedBy` banner), tests in `tests/call.test.ts`.
- [ ] Tests: resolveOnCall creates one approved request with recap note; team scope sets configFixedBy and adds SALES-DE; idempotent; insights.actionable mentions "fixed by Lee Wong". → implement → green → commit.

### Task 3: UI + guided beat + notes
**Files:** `src/avatar/AvatarAdapter.ts` (voice options), `src/avatar/director.ts` (+ test), `src/ui/employee/{AvaPanel,HandoffCard,CallView}.tsx`, `src/ui/GuidedDemo.tsx` (beat 7), `src/notes.ts`, `src/ui/admin/Insights.tsx`, styles.
- [ ] Director test for new kinds (RED→GREEN). Build UI. E2E: beat 7 end-to-end, 0 console errors; full guided demo still passes. Commit.

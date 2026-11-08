# Troubleshooting Sessions: a new session type for real-time avatars (prototype)

Northwind Labs is rolling out **Expensio**, a fictional expense tool. Employees get stuck, and the Expensio admin
(Tom Becker) is out of office. **Ava**, a real-time avatar, troubleshoots with the employee. She asks one question at a time,
walks them through what *they* can do, with a source on every step, and when the fix needs admin rights she prepares a
**ready-to-approve request**. The employee always leaves with progress: a workaround plus a status, never a dead end.

Three views:
- **Creator:** an IT/enablement lead connects docs, draws the boundary (*User can do*, *Needs admin*, *Never via avatar*;
  unclear defaults to *Needs admin*) and must pass a test run before publishing.
- **Employee session:** a mock Expensio app with Ava.
- **Admin & insights:** a one-click approval inbox, anonymised rollout insights, governance and cost, metrics.

Everything is simulated: no Synthesia API, no LLM, no network. The Creator's boundary really drives the session.

## Run
```bash
npm install
npm run dev     # open the printed URL in Chrome
npm test        # engine tests (boundary rules, sourcing, diagnoses, handoff, re-tag)
npm run build   # static site in dist/ (relative paths, host anywhere)
```
Chrome is recommended. The mic uses the Web Speech API; without it you type, and voice output can be muted.

## Demo script (~9 min): press **▶ Guided demo**, then **Next ▶**
1. **Creator:**
   - Connect the sources. Ava flags a gap: no doc covers delegation.
   - The boundary editor shows "unclear → Needs admin".
   - The test fails on the approval scenario. Close the gap (a rollout note plus a new step) → 6/6 pass → Publish.
2. **Employee, receipt upload:**
   - Support is hidden until needed: the upload fails, and Jordan clicks **Get help** right there.
   - Ava sees the page (file, format, size), so she never asks "is it broken?" or "can you see it now?".
   - **Looking is free, acting needs a yes:** she offers ("I can pick IMG_2041.jpg and upload it for you. Shall I?") and only clicks after Jordan agrees. Each action lands in the audit log as "Ava (with Jordan Lee's OK)".
   - It's fully self-resolved, with a source on every step. The support window can be docked or popped out over the portal (⇱).
3. **Employee, missing cost centre:**
   - First the user steps, each offered with "Shall I?".
   - Using her role, Ava checks the account and the audit log: the rollout import mapped Sales Germany to DE-GENERAL.
   - Then Ava says plainly that it "needs an admin", says why, gives a workaround, and shows the handoff card.
   - The employee sends it, then sees the status "waiting for admin".
4. **Admin:** Lee (the backup admin) approves in one click. Back to Jordan: Ava follows up and offers to re-submit.
5. **Insights:** "38 people stuck on the cost centre → fix the config, not 36 tickets." (2 of the 38 solved it themselves.)
6. **Live twist:**
   - Re-tag "Join SALES-DE yourself" to *User can do* in the Creator view.
   - In a new session, the same problem resolves with no ticket.
7. **Escalate live:** the backup admin, Lee, is available, so Jordan taps **📞 Call Lee now**.
   - Ava joins and opens with the summary: problem, what she checked, what was tried, the fix and its source.
   - Lee asks "anyone else?". Ava answers from anonymised insights: 38 in week 1, 36 at the same step, all Sales Germany.
   - Lee fixes the mapping for everyone and approves on the call. Ava confirms only what she can see, and saves a recap.
8. **Ava's role (least privilege):** in Admin & insights → Ava's role, the admin grants what Ava may check beyond the screen.
   - The switches are the account, cost centres, users and roles, the approval chain, the audit log and insights.
   - Switch the audit log off, and Ava says "I'm not allowed to check the audit log" instead of guessing. The request lists what wasn't checked.

Toggle **Product notes** to see the Decision · Why · Metric callouts on each key screen (`src/notes.ts`).

## How it's built
- `src/engine/`: a pure, tested brain.
  - `boundary.ts`: tag rules, with untagged meaning Needs admin.
  - `plan.ts`: Ava's path through an issue. The live session and the creator's tests both use it.
  - `session.ts`: one question at a time; returns Steps.
  - `diagnose.ts`: computed from live state.
  - `handoff.ts`: the ready-to-approve request.
  - `creatorTest.ts`: scenarios, invariants, publish gating.
  - `insights.ts`
- `src/avatar/director.ts` plays the Steps against the UI (tab, highlight, speak, card) and can be interrupted.
- `src/store/AppStore.tsx`: a useReducer + context store, with in-memory seed data relative to "now".

## Plugging in a real interactive avatar
`src/avatar/AvatarAdapter.ts` is the only seam:
- The engine decides **what** to say. Alternatively, an LLM grounded on the creator's knowledge and boundary could, with the same
  source and boundary checks applied to its output.
- An adapter sends that text to a real-time avatar stream, which speaks and renders video. It also receives the user's
  speech back, which goes into `respond()` like typed text.
- Synthesia's real-time avatars can be embedded via the LiveKit SDK and connected to your own LLM or knowledge base.

Exact SDK calls are *assumptions, to be confirmed with the Synthesia API docs*. The director and the rest of the UI don't change.

Deploying: see `docs/DEPLOY.md`.

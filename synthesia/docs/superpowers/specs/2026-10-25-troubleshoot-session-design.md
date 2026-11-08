# Troubleshooting Sessions for internal software rollouts — PoC design

Date: 2026-10-25 · Deadline: Mon 26 Oct (evening) · Branch: `troubleshoot-pivot`

## Why
A prototype for a Synthesia PM interview (60-min product-thinking session). It shows a **new session type** for
Synthesia's real-time interactive avatars, next to "Roleplay Sessions": **Troubleshooting Sessions** for internal
software rollouts. The interview assesses product thinking: how a creator **authors** the session, how an end user
**experiences** it, and why each UX choice changes behaviour, trust or adoption. It must be shareable via a link.
Finished beats complete.

## Concept
Northwind Labs is rolling out **Expensio** (a fictional expense tool). Employees get stuck. The Expensio admin,
**Tom Becker**, is out of office until Thursday (the backup admin is **Lee Wong**). **Ava** troubleshoots with the employee:
she listens, asks one question at a time, walks them through what *they* can do, and when the fix needs admin rights she
prepares a **ready-to-approve request** that an admin approves later in one click. The user always leaves with progress
(a workaround plus a status), never a dead end.

**The two moments to nail**
1. **Creation:** the creator (IT/enablement lead) defines the boundary between steps a user can do and steps that need an admin.
2. **Consumption:** the admin isn't available, so the session ends in a clean async handoff, not "please contact your admin".

## Goals / non-goals / anti-goals
- **Goals:** three views behind a top switcher (Creator · Employee session · Admin & insights), a Product notes toggle,
  a Guided demo, hard rules enforced in the engine and tested, a static build that can be deployed.
- **Non-goals:** real Synthesia API, real LLM, auth, backend, mobile layout, persistence, multiple languages (v2 note only), visual polish beyond clean and readable.
- **Anti-goals:** Ava instructs a "Needs admin" or "Never" step; Ava says anything without a source; Ava contradicts the
  screen; Ava exposes other people's data; the boundary editor is decorative (it must drive the session live).

## Domain model (seeded, in memory, relative to "now")
- **Knowledge sources:** "Expensio rollout guide", "Expensio FAQ", "Known issues, week 1". Each has numbered sections that steps cite.
  Creator-written **rollout notes** are also sources.
- **Issues** (found in the knowledge). Each has symptom phrases, a deterministic `diagnose(world)`, an `isResolved(world)`,
  an ordered list of **fix steps**, and an optional **workaround**.
- **Fix step:** an instruction for the user, the `adminRequest` (the exact change if an admin does it), a **tag**
  (`user` | `admin` | `never` | untagged), a **source** (doc + section) or none, and a mock-app target (tab + highlight id).
  **Untagged or unclear means "Needs admin"**, and the UI shows this rule.
- **World:** Jordan Lee (Sales, Berlin), with cost centres, roles, the receipt being uploaded and the pending approval.
  It also holds people (Priya Shah, the approver, out of office; Tom, OOO until Thu; Lee Wong, backup admin; Marco Rossi,
  a colleague with approver rights) and **requests** (handoffs).
- **Historical sessions:** ~120, generated deterministically, for insights. 38 of them are stuck on the cost centre.

### The 5 issues
| | Issue | Diagnosis from live state | Steps (seed tags) | Workaround |
|---|---|---|---|---|
| a | "I can't see my cost centre" | Jordan isn't assigned to **SALES-DE** | 1 switch the cost-centre filter to "All" (user) · 2 refresh the form (user) · 3 "Join SALES-DE yourself in Profile → Cost centres" (**untagged → Needs admin**; adminRequest "Add Jordan Lee to cost centre SALES-DE") | submit with the default cost centre DE-GENERAL and re-assign later (user, FAQ) |
| b | "Receipt upload fails" | the selected file is **HEIC** and **14.2 MB** (limit: JPG/PNG/PDF, 10 MB) | 1 check the format and size (user) · 2 export as JPG or use the mobile app, then upload IMG_2041.jpg (user) | n/a: fully self-resolved |
| c | "My approval is stuck" | approver **Priya Shah** is out of office, with no delegate | 1 open My approvals to see who it's waiting on (user) · 2 "Set a delegate for Priya Shah's approvals" (admin, **NO SOURCE**: this is the gap) | none: Ava shows the status |
| d | "I can't open the team expense report" | Jordan lacks the **Report viewer** role | 1 open Reports → Team reports (user) · 2 "Grant Jordan Lee the Report viewer role" (admin) | none |
| e | "Reimbursement / bank details" (creator and test only) | n/a | 1 check the expense shows "Paid" (user) · 2 change bank details (**Never via avatar**) | none: handed to Payroll without collecting details |

**The gap (1a):** "Approval stuck with an absent manager: no doc covers delegation". The creator closes it by writing a
**rollout note** (a new source), attaching it to c-step-2, and **adding a step**: "Ask a colleague with approver rights
(e.g. Marco Rossi) to approve it, or request delegation" (user, sourced by the note).

## View 1: Creator studio (Moment 1)
- **1a Knowledge:** connected sources (pre-seeded, "Connect" just reveals them), the issues found with counts, and a **gap callout**.
- **1b Boundary editor:** per issue, ordered steps, each with a tag chip (green User can do / amber Needs admin /
  red Never via avatar; untagged shows "Needs admin (default)"), a **source chip** or a ⚠ "No source: Ava won't say this",
  and a **"self-service ends here"** marker before the first non-user step. You can change tags, add a step with a source,
  and write a rollout note. The rule "Untagged or unclear → Needs admin" is shown at the top.
- **1c Test before publish:** 6 pre-written scenarios (a–e, plus an unknown request: "How do I book a flight?").
  Each shows **Ava's path** (the beats from the same engine the session uses) and pass/fail on two invariants:
  (1) never tells the user to do a Needs admin / Never step; (2) every instruction **and every handoff request** has a source.
  **Publish is disabled until all pass.** Scenario c fails at first ("'Set a delegate…' has no source; the request
  would be undocumented"). After closing the gap, it passes. Results recompute live from the config.

## View 2: Employee session (Moment 2)
- **Left: mock Expensio** with tabs New expense (cost-centre dropdown + filter + refresh + submit), Receipt (file picker +
  upload), My approvals, Reports (Team reports), Profile → Cost centres (Join). Elements carry `data-hl` ids.
- **Right: Ava's panel:** a video-style avatar frame with an "AI avatar" label, captions, transcript, chips, text input,
  mic, mute, and a **step panel** ("Step 2 of 4" + source chip for the current step).
- **Flow rules (engine):**
  - Intake matches an issue. If nothing matches: "I don't know that one", then an offer to hand off (never a guess).
  - Ava confirms her understanding with one question, then goes step by step. For each user step she highlights the
    target, gives the instruction with its source, and asks one check question.
  - After each reply she checks `isResolved(world)`, so she never contradicts the screen. If it's resolved, she says so.
    If the user says "yes" but the state disagrees, she says what she sees.
  - When the next step is Needs admin, she says so plainly and says *why* (the diagnosis, with no other people's data),
    then offers the workaround (if it's sourced and user-doable), then the **handoff card**.
  - When the next step is Never via avatar, she declines to handle it and offers a handoff to Payroll without collecting details.
  - Unsourced steps are never spoken. At runtime they are skipped and the handoff says "no documented fix; admin to investigate".
- **Handoff card:** a one-sentence diagnosis, the exact change, who and what it affects, the steps already tried, the source,
  and the recipient: "Send to Tom Becker (out of office until Thu)" or "the backup admin (Lee Wong)". It's sent with an
  explicit yes on the visible card (voice, typing or the button). After sending, Ava shows: status "Waiting for admin",
  the workaround if any, and "I'll let you know when it's approved."

## View 3: Admin & insights
- **3a Admin inbox** (viewing as Tom / Lee): request cards. **Approve** applies the change to the world in one click;
  **Ask for info** sets a canned question. Back in the employee view, Ava follows up ("Your cost centre is fixed. Want to re-submit?").
- **3b Rollout insights:** computed from the historical sessions plus live ones: top issues, where users get stuck (by step),
  self-resolved vs handed off, median time to resolution, and % of requests approved without back-and-forth.
  The actionable insight: "38 people stuck on the cost centre → the rollout config probably didn't map Sales DE; fix the config, not 38 tickets."
- **3c Governance & economics:** credits "1,240 of 2,000 used", retention "30 days, aggregated analytics only by default",
  the AI-avatar disclosure, and "Ava never acts with admin rights; the handoff is a request, not an action".
- **Metrics & learning:**
  - North star: % of issues resolved without a ticket.
  - Handoff quality: % of requests approved without back-and-forth.
  - Guardrail: wrong-instruction rate.
  - Creation: time to publish.
  - Learning plan: 3 design partners mid-rollout for 6 weeks.

## Product notes
The **Product notes** toggle shows callouts (from `src/notes.ts`) with Decision · Why · Metric. They cover: the unclear → Needs
admin default, test-before-publish gating, one question at a time, source chips, the handoff card, workaround + status,
anonymised insights, and the credit budget.

## Guided demo (~6 min)
A button that resets and shows a small script panel. Each beat has "Do it for me" (it performs the clicks and sends the
employee's line to Ava) or the presenter does it live:
1. Creator: gap → boundary → test fails on c → close the gap → all pass → publish.
2. Employee: issue b, self-resolved.
3. Employee: issue a, user steps → needs admin → handoff → sent, workaround shown.
4. Admin: approve → employee, Ava confirms.
5. Insights: "38 stuck on cost centre → fix the config".
6. Live twist: the Creator re-tags a-step-3 to "User can do", then "Reset employee" and issue a again: Ava walks Jordan to
   Profile → Join SALES-DE and it resolves **with no handoff**.

## Hard rules (engine, tested)
- Ava never performs an admin action. She never instructs a Needs admin / Never / untagged step.
- No source means no instruction. Handoff requests also cite a source, or are flagged undocumented.
- Answers come from live state and never contradict the screen. Other people's data is never exposed (d).
- One question per Ava turn. Only short replies count as yes/no. A yes only counts for a visible card.
- People are referred to by name, with no gendered pronouns. Times are in UTC.
- The Creator config drives the session live: re-tagging changes the path (tested).

## Avatar seam
`AvatarAdapter.ts` gets a comment block, and the README a section "Plugging in a real interactive avatar". In that model, the engine
(or an LLM grounded on the creator's knowledge + boundary) produces the text. The adapter streams it to a real-time avatar
that speaks and renders video, and receives the user's speech back. Synthesia's real-time avatars can be embedded via the
LiveKit SDK and connected to your own LLM or knowledge base. Specifics are marked "to confirm with the Synthesia API docs",
and no API method names are invented.

## Delivery
- `npm test` green. New tests cover: the boundary rules, no source → no instruction, the 4 diagnoses, handoff contents,
  re-tag changes the session, creator-test invariants and gating, insights numbers.
- `npm run build` produces a static site with relative asset paths. Deploy instructions for Netlify / Vercel / GitHub Pages.
  **Ask the user before publishing.**
- README: a 10-line overview, how to run, the demo script, the avatar seam.

## Calls I made (not in the brief)
- The twist uses **a-step-3 "Join SALES-DE yourself"**, seeded *untagged*. This shows the default rule *and* the live re-tag in one place.
- The gap fix = a rollout note (a new source) + a new user step + attaching the note to the admin step.
- A 5th issue (e) exists only to show "Never via avatar" in the creator and tests. In the session it routes to Payroll.
- Recipient choice on the card: Tom by default, Lee as the alternative. Voice "yes" sends to Tom.
- The avatar panel is docked only (no float/minimize). Big fonts for screen sharing.

## Addendum (2026-10-27): live escalation — call the backup admin

Approved by the user in chat.

- **Where:** the handoff card. When the chosen admin is **available** (not out of office), a **"📞 Call Lee now"** button
  appears next to "Send request". Tom (out of office) only gets the async request. Async stays the default; the call is the
  escalation when someone is around. Jordan explicitly chooses it (button on the visible card, or saying "call Lee").
- **Ava sets up the call and joins.** The call takes over Ava's panel: tiles for Ava, Jordan, Lee ("joining…" → joined), captions.
- **Ava opens with the summary**, spoken and pinned as a "Summary shared" card: diagnosis · what she checked on the
  account · steps already tried · the exact change · source.
- **A real troubleshooting call:** Lee asks Ava to check something. Scripted Lee lines are clickable chips; the
  presenter can still type/talk as Jordan.
  - "Is anyone else hitting this?" → Ava answers from the anonymised insights (counts only, no names): 38 people this week,
    same step, all Sales Germany → looks like the rollout mapping.
  - Lee decides: fix it for Jordan, or **fix the mapping for all of Sales Germany**.
- **Lee approves on the call** via an "Approve as Lee" action card (Lee's action, never Ava's). Ava then checks Jordan's
  account and confirms only what she can see. A team fix shows on Insights as "✓ Config fixed by Lee Wong on a call".
- **End call → recap** saved on the request (resolved on a call by Lee, what was checked, what changed); Jordan is told
  they can re-submit.
- **Guided demo beat 7:** "Escalate live: call Lee" on a fresh Jordan session with a3 back to its default tag.
- **Product notes:** "Live escalation when someone's available" and "Ava checks, the admin decides".
- Hard rules unchanged: Ava never changes anything; every line is computed from live state; no colleague names.

## Addendum (2026-10-27, b): looking vs acting, and Ava's role

Approved by the user in chat. Replaces the "consent before account checks" rule from the previous change.

- **Looking at the page is free.** Ava sees what's on the employee's screen (page, errors, file names, statuses) without asking.
  Because she can see the page, she doesn't ask "can you see it now?" after a step; she checks the page herself.
- **Acting on the page needs the employee's consent, per action.** Switching tabs, pressing Refresh, changing a filter,
  picking a file: Ava explains the step and offers once ("I can switch the filter to All for you. Shall I?").
  Yes → she does it visibly, and an audit line records "Ava (with Jordan Lee's OK)". No → "OK, go ahead", and the employee does it.
- **Ava's role (Admin & insights → "Ava's role")**: the admin grants what Ava may check beyond the page, one switch each:
  the employee's own account · the cost-centre list · users and their roles · the approval chain · the audit log ·
  anonymised rollout insights. Fixed, visible rows: look at the page (always) · act on the page (only with the employee's OK) ·
  admin changes (never; a request or the admin's approval is always needed).
- **Without a permission, Ava says so instead of guessing** ("I'm not allowed to check the audit log, so I can't see why"),
  and the handoff/call summary lists what wasn't checked. Toggling a permission changes the session live.
- With the audit log allowed, Ava finds the root cause for the cost centre: the rollout import mapped Sales Germany to DE-GENERAL.
- The call button requires "users and their roles" (to know who is available); the admin's "anyone else?" requires insights.

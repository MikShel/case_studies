# Demo video: narration script

Generated from `scripts/demo/segments.mjs` (the same text the voice-over uses). Times are where each line starts in `demo/troubleshooting-sessions-demo.mp4`. To re-record in your own voice, read each line at its time; on-screen actions are driven by the in-app Guided demo.


## Title card

- **00:00**: Troubleshooting Sessions. A new session type for Synthesia's real-time avatars, for the moment employees get stuck in an internal software rollout, and the admin isn't around.

## The problem

- **00:10**: Northwind Labs is rolling out Expensio, a new expense tool. In week one, people get stuck, and Tom, the admin, is out of office until Thursday. Today that's a ticket and a wait. Two moments are easy to get wrong: how a creator defines what the avatar may tell people to do, and what happens when the fix needs an admin who isn't there.

## Creator

- **00:31**: This is the creator: the IT lead running the rollout. They connect the rollout docs: a guide, an FAQ, and the known issues from week one. Ava flags a gap right away. Nothing documents what to do when an approver is away.
- **00:45**: In the boundary editor, every step gets a tag: user can do, needs admin, or never via avatar. Anything untagged counts as needs admin, because one wrong self-service instruction is how IT stops trusting a rollout. Every step shows its source. No source, and Ava won't say it.
- **01:03**: Before publishing, the creator plays the employee. These paths come from the same engine as the live session, and they're checked against two rules: never tell someone to do an admin step, and cite a source for everything. One scenario fails, so publish stays locked.
- **01:19**: The creator writes a short rollout note and adds a step people can take themselves. All six pass, and the session is published.

## Employee

- **01:27**: Now the employee, Jordan, in Sales, in Berlin. There's no chat window in the way. Jordan uploads a receipt, and it fails.
- **01:35**: Jordan clicks Get help, right where it failed. Ava can already see the page: a HEIC photo, over ten megabytes. So she doesn't ask whether something is broken. She explains the fix, and offers to do it, because acting on Jordan's screen needs a yes.
- **01:51**: One yes, and Ava picks the JPG and uploads it. Solved, with a source for every step, and no ticket. Not everything needs to escalate.
- **02:01**: A harder one. Jordan can't find the Sales Germany cost centre. Ava starts with the documented steps Jordan can take, one at a time, each with its source.
- **02:11**: Switching the filter to All doesn't help, and Ava sees that on the page herself. No "can you see it now?" questions.
- **02:18**: Neither does Refresh. So she says it plainly: this needs an admin. With the role the admin gave her, she checks Jordan's account and the audit log, and finds the real cause: the rollout import mapped Sales Germany to the wrong cost centre. Jordan gets a workaround, and a request that's ready to approve: the diagnosis, the exact change, what was tried, and the source.
- **02:41**: Tom is out of office, so Lee, the backup admin, can pick it up. Jordan sends it, and leaves with a status and a workaround. Not a dead end.

## Admin

- **02:50**: Here's Lee's inbox. Everything an admin needs is on the card, so approving is one click, with no back and forth.
- **02:58**: Back with Jordan, Ava follows up on her own. The cost centre is fixed, and she offers to re-submit the expense.

## Insights

- **03:05**: Across the first week, the rollout owner sees aggregated, anonymised insights. The headline: thirty-eight people stuck on the same step. That's one configuration fix, not thirty-six tickets.

## Live boundary

- **03:18**: And the boundary is live. The creator decides people in Sales can join their own cost centre, and re-tags a single step.
- **03:25**: Same problem, new session. This time Ava offers to join the cost centre for Jordan, and it is solved without a ticket. One tag changed the behaviour for everyone.

## Live escalation

- **03:45**: When an admin is available, Jordan doesn't have to wait. Same problem, a new session. Ava walks through the steps again and prepares the request, and this time the card shows that Lee, the backup admin, is available right now.
- **04:12**: So Jordan calls Lee. Ava joins the call and opens with a summary: the problem, what she checked, what was tried, and the fix. Nobody has to repeat themselves.
- **04:25**: Lee asks Ava to check whether anyone else is affected. Ava answers from the anonymised insights, with counts and no names: thirty-eight people, thirty-six stuck at the same step, all in Sales Germany.
- **04:37**: So Lee fixes the mapping for everyone, and approves it right on the call. Ava checks and reports. The admin decides.
- **04:45**: A recap is saved on the request, and the insight now shows the fix.

## Ava's role

- **04:50**: Last, Ava's role. The admin grants what she may check beyond the employee's screen, one switch at a time. Let's take away the audit log.
- **04:59**: In a new session, Ava still helps with everything on the screen, and still asks before every click.
- **05:05**: But where she'd need the audit log, she says she isn't allowed to check, instead of guessing. And the request records what wasn't checked, so the admin knows where to look.
- **05:26**: And every action Ava took on Jordan's screen is in the audit log, done with Jordan's OK.

## Metrics & learning

- **05:31**: What we'd measure: the share of issues resolved without a ticket, as the north star. Requests approved without back and forth, for handoff quality. And a wrong-instruction rate that has to stay at zero. Next step: three design partners, mid-rollout, for six weeks. Thank you.

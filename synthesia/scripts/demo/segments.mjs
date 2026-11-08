// One narrated segment = what the narrator says + what happens on screen meanwhile.
// `next`: how many "Next ▶" clicks of the in-app Guided demo to run (each is one demo action);
// `beat: true` first moves to the next beat. `card`: a full-screen title card instead of the app.

export const SEGMENTS = [
  {
    card: 'title',
    text: "Troubleshooting Sessions. A new session type for Synthesia's real-time avatars, for the moment employees get stuck in an internal software rollout, and the admin isn't around.",
  },
  {
    card: 'problem',
    text: "Northwind Labs is rolling out Expensio, a new expense tool. In week one, people get stuck, and Tom, the admin, is out of office until Thursday. Today that's a ticket and a wait. Two moments are easy to get wrong: how a creator defines what the avatar may tell people to do, and what happens when the fix needs an admin who isn't there.",
  },
  {
    chapter: 'Creator',
    next: 1,
    scroll: 'gap',
    text: "This is the creator: the IT lead running the rollout. They connect the rollout docs: a guide, an FAQ, and the known issues from week one. Ava flags a gap right away. Nothing documents what to do when an approver is away.",
  },
  {
    next: 1,
    scroll: 'boundary',
    text: "In the boundary editor, every step gets a tag: user can do, needs admin, or never via avatar. Anything untagged counts as needs admin, because one wrong self-service instruction is how IT stops trusting a rollout. Every step shows its source. No source, and Ava won't say it.",
  },
  {
    next: 1,
    text: "Before publishing, the creator plays the employee. These paths come from the same engine as the live session, and they're checked against two rules: never tell someone to do an admin step, and cite a source for everything. One scenario fails, so publish stays locked.",
  },
  {
    next: 2,
    text: 'The creator writes a short rollout note and adds a step people can take themselves. All six pass, and the session is published.',
  },
  {
    chapter: 'Employee',
    beat: true,
    next: 2,
    text: "Now the employee, Jordan, in Sales, in Berlin. There's no chat window in the way. Jordan uploads a receipt, and it fails.",
  },
  {
    next: 1,
    text: "Jordan clicks Get help, right where it failed. Ava can already see the page: a HEIC photo, over ten megabytes. So she doesn't ask whether something is broken. She explains the fix, and offers to do it, because acting on Jordan's screen needs a yes.",
  },
  {
    next: 1,
    text: 'One yes, and Ava picks the JPG and uploads it. Solved, with a source for every step, and no ticket. Not everything needs to escalate.',
  },
  {
    beat: true,
    next: 1,
    text: "A harder one. Jordan can't find the Sales Germany cost centre. Ava starts with the documented steps Jordan can take, one at a time, each with its source.",
  },
  {
    next: 1,
    text: 'Switching the filter to All doesn\'t help, and Ava sees that on the page herself. No "can you see it now?" questions.',
  },
  {
    next: 1,
    text: "Neither does Refresh. So she says it plainly: this needs an admin. With the role the admin gave her, she checks Jordan's account and the audit log, and finds the real cause: the rollout import mapped Sales Germany to the wrong cost centre. Jordan gets a workaround, and a request that's ready to approve: the diagnosis, the exact change, what was tried, and the source.",
  },
  {
    next: 1,
    text: 'Tom is out of office, so Lee, the backup admin, can pick it up. Jordan sends it, and leaves with a status and a workaround. Not a dead end.',
  },
  {
    chapter: 'Admin',
    beat: true,
    next: 2,
    text: "Here's Lee's inbox. Everything an admin needs is on the card, so approving is one click, with no back and forth.",
  },
  {
    next: 2,
    text: 'Back with Jordan, Ava follows up on her own. The cost centre is fixed, and she offers to re-submit the expense.',
  },
  {
    chapter: 'Insights',
    beat: true,
    next: 1,
    text: "Across the first week, the rollout owner sees aggregated, anonymised insights. The headline: thirty-eight people stuck on the same step. That's one configuration fix, not thirty-six tickets.",
  },
  {
    chapter: 'Live boundary',
    beat: true,
    next: 2,
    text: 'And the boundary is live. The creator decides people in Sales can join their own cost centre, and re-tags a single step.',
  },
  {
    next: 5,
    text: 'Same problem, new session. This time Ava offers to join the cost centre for Jordan, and it is solved without a ticket. One tag changed the behaviour for everyone.',
  },
  {
    chapter: 'Live escalation',
    beat: true,
    next: 4,
    text: "When an admin is available, Jordan doesn't have to wait. Same problem, a new session. Ava walks through the steps again and prepares the request, and this time the card shows that Lee, the backup admin, is available right now.",
  },
  {
    next: 1,
    text: 'So Jordan calls Lee. Ava joins the call and opens with a summary: the problem, what she checked, what was tried, and the fix. Nobody has to repeat themselves.',
  },
  {
    next: 1,
    text: 'Lee asks Ava to check whether anyone else is affected. Ava answers from the anonymised insights, with counts and no names: thirty-eight people, thirty-six stuck at the same step, all in Sales Germany.',
  },
  {
    next: 2,
    text: 'So Lee fixes the mapping for everyone, and approves it right on the call. Ava checks and reports. The admin decides.',
  },
  {
    next: 2,
    text: 'A recap is saved on the request, and the insight now shows the fix.',
  },
  {
    chapter: "Ava's role",
    beat: true,
    next: 2,
    text: "Last, Ava's role. The admin grants what she may check beyond the employee's screen, one switch at a time. Let's take away the audit log.",
  },
  {
    next: 2,
    text: 'In a new session, Ava still helps with everything on the screen, and still asks before every click.',
  },
  {
    next: 2,
    text: "But where she'd need the audit log, she says she isn't allowed to check, instead of guessing. And the request records what wasn't checked, so the admin knows where to look.",
  },
  {
    next: 1,
    text: "And every action Ava took on Jordan's screen is in the audit log, done with Jordan's OK.",
  },
  {
    card: 'closing',
    text: "What we'd measure: the share of issues resolved without a ticket, as the north star. Requests approved without back and forth, for handoff quality. And a wrong-instruction rate that has to stay at zero. Next step: three design partners, mid-rollout, for six weeks. Thank you.",
  },
];

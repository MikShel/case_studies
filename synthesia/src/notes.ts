/** Product notes shown on key screens when "Product notes" is on: Decision · Why · Metric. */
export type NoteId =
  | 'default-admin'
  | 'test-gating'
  | 'gap'
  | 'one-question'
  | 'source-chips'
  | 'handoff-card'
  | 'workaround-status'
  | 'insights-anon'
  | 'credit-budget'
  | 'disclosure'
  | 'live-escalation'
  | 'checks-decides'
  | 'context-consent'
  | 'ava-role';

export interface Note {
  title: string;
  decision: string;
  why: string;
  metric: string;
}

export const NOTES: Record<NoteId, Note> = {
  'default-admin': {
    title: 'Unclear means "Needs admin"',
    decision: 'Any step the creator hasn\'t tagged, or isn\'t sure about, defaults to "Needs admin".',
    why: "One wrong self-service instruction is the incident that kills IT's trust in the rollout. The safe default lets creators publish before every step is perfect.",
    metric: 'Wrong-instruction rate (evals) ≈ 0 · % of steps explicitly tagged.',
  },
  'test-gating': {
    title: 'Test before publish',
    decision: 'The creator plays the user on real "stuck" scenarios. Publish stays locked until two invariants pass on every one.',
    why: 'Creators trust what they have seen work. Gating turns "I hope the avatar behaves" into evidence, and catches gaps in the docs before employees hit them.',
    metric: 'Time to publish · % of sessions published with all scenarios passing · post-publish incidents.',
  },
  gap: {
    title: 'Surface knowledge gaps at authoring time',
    decision: 'When connecting sources, issues without a documented fix are flagged, not silently improvised around.',
    why: 'An avatar that guesses is worse than no avatar. Showing the gap makes the creator the author of the answer.',
    metric: 'Gaps found before publish vs. "I don\'t know" rate in live sessions.',
  },
  'one-question': {
    title: 'One question at a time',
    decision: 'Every Ava turn ends with at most one question, and each step has one check.',
    why: 'People troubleshooting are stressed and multitasking. One question keeps them oriented, and keeps the transcript clean for the handoff.',
    metric: 'Session completion rate · turns per resolution · drop-off by step.',
  },
  'source-chips': {
    title: 'Every instruction shows its source',
    decision: 'Ava only says steps that come from the creator\'s knowledge, and the step panel shows which doc and section.',
    why: 'Employees can verify the step, and IT can audit and fix the doc instead of arguing with the avatar.',
    metric: 'Unsourced instructions = 0 (enforced) · source-chip clicks · doc fixes per week.',
  },
  'handoff-card': {
    title: 'The handoff is a ready-to-approve request',
    decision: 'When a fix needs an admin, Ava prepares the exact change, impact, steps tried and source, and the employee sends it on a visible card.',
    why: 'The admin is away. A one-click request replaces a vague ticket and a week of back-and-forth, and the employee stays in control of what is sent.',
    metric: '% of requests approved without back-and-forth · time from send to approval.',
  },
  'workaround-status': {
    title: 'Leave with progress, never a dead end',
    decision: 'After a handoff the employee gets a workaround (if one is documented), a clear status, and a promise of follow-up.',
    why: '"Contact your admin" feels like failure. Progress plus status keeps the rollout moving and protects adoption.',
    metric: 'Re-contact rate for the same issue · CSAT after handoff · expenses submitted via workaround.',
  },
  'insights-anon': {
    title: 'Aggregated, anonymised insights',
    decision: 'Rollout owners see patterns (top issues, where people get stuck), never individual transcripts by default.',
    why: 'Employees speak openly when they are not being watched, and IT fixes the config instead of 38 tickets.',
    metric: 'Config fixes driven by insights · tickets avoided · % of issues resolved without a ticket.',
  },
  'credit-budget': {
    title: 'A visible credit budget per rollout',
    decision: 'Real-time avatar minutes are metered against a budget the rollout owner sets.',
    why: 'Interactive avatars cost per minute. A budget makes the ROI conversation explicit (minutes vs. tickets avoided) and prevents surprise bills.',
    metric: 'Credits per resolved issue · cost per ticket avoided · budget utilisation.',
  },
  'live-escalation': {
    title: 'Live escalation when someone is around',
    decision: 'The async request stays the default; when an admin is available, the card offers a call and Ava opens it with the summary.',
    why: 'A five-minute call beats a day of waiting, but only if nobody has to repeat themselves. The summary turns the call into a decision, not an interview.',
    metric: 'Time from call start to fix · % of calls resolved on the call · admin call minutes per fix.',
  },
  'checks-decides': {
    title: 'Ava checks, the admin decides',
    decision: 'On the call Ava answers checks from live data and anonymised insights; only the admin’s own button changes anything.',
    why: 'Admins trust an assistant that brings evidence ("38 people, same step") and never acts on their behalf. It turns one ticket into a config fix.',
    metric: 'Team-level fixes per call · repeat tickets on the same step after a fix.',
  },
  'context-consent': {
    title: 'Looking is free, acting needs a yes',
    decision: 'Help opens where the employee failed. Ava sees the page, so she never asks "is it broken?" or "can you see it now?". Before she clicks anything on their screen, she asks.',
    why: 'Re-explaining a problem is what people hate about support. But their screen is theirs: Ava offering ("Shall I?") keeps the employee in control, and the audit trail shows every action was agreed.',
    metric: 'Time to first useful step · offer acceptance rate · steps done by Ava vs. the employee.',
  },
  'ava-role': {
    title: 'The admin gives Ava a role',
    decision: 'What Ava may check beyond the page (account, cost centres, users, approvals, audit log, insights) is a role the admin grants, one switch each. Without a permission, Ava says so.',
    why: 'IT already thinks in roles and least privilege. A visible, minimal role is what gets an AI agent approved by security; "I\'m not allowed to check that" beats a confident guess.',
    metric: 'Permissions granted per rollout · resolution rate by permission set · requests flagged "not checked".',
  },
  disclosure: {
    title: 'Always disclose the AI avatar',
    decision: 'The session is labelled "AI avatar", and Ava never acts with admin rights.',
    why: 'Trust depends on people knowing what they are talking to and what it can do.',
    metric: 'Trust score in post-session survey · complaints about misleading behaviour = 0.',
  },
};

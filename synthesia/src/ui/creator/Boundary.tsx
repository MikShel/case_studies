import { Fragment, useState } from 'react';
import type { FixStep, Issue, Tag } from '../../data/types';
import { effectiveTag, selfServiceEnd, sourceLabel } from '../../engine/boundary';
import { useHl, useStore } from '../../store/AppStore';
import { Note } from '../Note';

const TAG_LABEL: Record<Tag, string> = { user: 'User can do', admin: 'Needs admin', never: 'Never via avatar' };

function TagChip({ issue, step }: { issue: Issue; step: FixStep }) {
  const { dispatch } = useStore();
  const tag = effectiveTag(step);
  return (
    <label className={`tag tag-${tag}`}>
      <select
        aria-label={`Tag for ${step.id}`}
        data-step={step.id}
        value={step.tag ?? ''}
        onChange={(e) => dispatch({ type: 'setTag', issueId: issue.id, stepId: step.id, tag: (e.target.value || undefined) as Tag | undefined })}
      >
        <option value="user">{TAG_LABEL.user}</option>
        <option value="admin">{TAG_LABEL.admin}</option>
        <option value="never">{TAG_LABEL.never}</option>
        <option value="">Unclear → Needs admin (default)</option>
      </select>
    </label>
  );
}

function StepRow({ issue, step, n }: { issue: Issue; step: FixStep; n: string }) {
  const { config } = useStore();
  const hl = useHl();
  const src = sourceLabel(config, step.source);
  const tag = effectiveTag(step);
  return (
    <li {...hl(`step-${step.id}`, `step-row step-${tag}`)}>
      <span className="step-n">{n}</span>
      <div className="step-body">
        <div className="step-text">{tag === 'user' ? step.instruction : (step.adminRequest ?? step.instruction)}</div>
        <div className="step-meta">
          {src ? <span className="source">📄 {src}</span> : <span className="source source-missing">⚠ No source: Ava won't say this</span>}
          {!step.tag && <span className="muted small">untagged</span>}
        </div>
      </div>
      <TagChip issue={issue} step={step} />
    </li>
  );
}

function GapFix() {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className="gap" data-hl="gap-fix">
        <div>
          <b>⚠ Gap:</b> no doc covers delegation when an approver is away.
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          Close the gap
        </button>
      </div>
    );
  }
  return (
    <div className="gap gap-open">
      <div>
        <b>New rollout note</b> (becomes a source):
        <blockquote>If an approver is away, ask a colleague with approver rights to approve, or request delegation. Admins set delegates in Admin → Approvals → Delegates.</blockquote>
        <b>New step</b> <span className="tag-inline tag-user">User can do</span>: Ask a colleague with approver rights, like Marco Rossi, to approve it, or request delegation.
        <div className="muted small">The note is also attached as the source for "Set a delegate…".</div>
      </div>
      <button className="btn btn-primary" onClick={() => dispatch({ type: 'closeGap' })}>
        Save note &amp; add step
      </button>
    </div>
  );
}

export function Boundary() {
  const { config } = useStore();
  return (
    <>
      <h1>Boundary editor</h1>
      <div className="rule">
        <b>Rule:</b> any step that is untagged or unclear counts as <span className="tag-inline tag-admin">Needs admin</span>. Ava only tells people to do{' '}
        <span className="tag-inline tag-user">User can do</span> steps that have a source.
      </div>
      <Note id="default-admin" />
      {config.issues.map((issue) => {
        const end = selfServiceEnd(issue);
        return (
          <section key={issue.id} className="card issue">
            <h2>{issue.title}</h2>
            <ol className="steps">
              {issue.steps.map((s, i) => (
                <Fragment key={s.id}>
                  {i === end && <li className="ss-end">Self-service ends here</li>}
                  <StepRow issue={issue} step={s} n={String(i + 1)} />
                </Fragment>
              ))}
              {end === issue.steps.length && <li className="ss-end ss-none">Fully self-service</li>}
            </ol>
            {issue.workaround && (
              <ol className="steps workaround">
                <StepRow issue={issue} step={issue.workaround} n="↺" />
              </ol>
            )}
            {issue.gap && <GapFix />}
          </section>
        );
      })}
      <Note id="source-chips" />
    </>
  );
}

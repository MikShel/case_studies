import type { HandoffRequest } from '../../data/types';
import { sourceLabel } from '../../engine/boundary';
import { canCall } from '../../engine/call';
import { formatDay } from '../../engine/time';
import { useStore } from '../../store/AppStore';

export function HandoffCard({
  draft,
  to,
  onTo,
  onAnswer,
  onCall,
}: {
  draft: HandoffRequest;
  to: string;
  onTo: (to: string) => void;
  onAnswer: (send: boolean) => void;
  onCall: (firstName: string) => void;
}) {
  const { config, world } = useStore();
  const p = (id: string) => world.people.find((x) => x.id === id)!;
  const src = sourceLabel(config, draft.source);
  const recipients = draft.to === 'payroll' ? ['payroll'] : ['tom', 'lee'];
  // knowing who is available needs the "users and their roles" permission
  const canSeeWho = config.role.directory;
  const callable = canSeeWho ? (recipients.find((id) => id === to && canCall(world, id)) ?? recipients.find((id) => canCall(world, id))) : undefined;

  return (
    <div className="handoff" role="dialog" aria-label="Request for an admin" data-hl="handoff-card">
      <div className="handoff-head">Request for {draft.to === 'payroll' ? 'Payroll' : 'an admin'} · ready to approve</div>
      <dl>
        <dt>Diagnosis</dt>
        <dd>{draft.diagnosis}</dd>
        <dt>Change</dt>
        <dd>
          <b>{draft.change}</b>
        </dd>
        <dt>Affects</dt>
        <dd>{draft.affects}</dd>
        <dt>Already tried</dt>
        <dd>{draft.tried.length ? <ul>{draft.tried.map((t) => <li key={t}>{t}</li>)}</ul> : <span className="muted">Nothing yet</span>}</dd>
        <dt>Source</dt>
        <dd>{src ? <span className="source">📄 {src}</span> : <span className="source source-missing">⚠ Undocumented: admin to investigate</span>}</dd>
        {draft.notChecked && draft.notChecked.length > 0 && (
          <>
            <dt>Not checked</dt>
            <dd className="muted">Ava has no access to {draft.notChecked.join(', ')}</dd>
          </>
        )}
      </dl>
      <div className="recipients">
        {recipients.map((id) => {
          const person = p(id);
          return (
            <label key={id} className={to === id ? 'on' : ''}>
              <input type="radio" name="to" checked={to === id} onChange={() => onTo(id)} />
              {id === 'lee' ? 'or the backup admin, ' : 'Send to '}
              <b>{person.name}</b>
              {person.outOfOfficeUntil && <span className="muted"> (out of office until {formatDay(person.outOfOfficeUntil)})</span>}
              {canSeeWho && canCall(world, id) && <span className="available"> ● available now</span>}
            </label>
          );
        })}
      </div>
      <div className="actions">
        <button className="btn btn-primary" onClick={() => onAnswer(true)}>
          Send request
        </button>
        {callable && (
          <button className="btn btn-call" data-call onClick={() => onCall(p(callable).name.split(' ')[0])}>
            📞 Call {p(callable).name.split(' ')[0]} now
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => onAnswer(false)}>
          Not now
        </button>
      </div>
    </div>
  );
}

import { sourceLabel } from '../../engine/boundary';
import { formatDay, formatStamp } from '../../engine/time';
import { useStore } from '../../store/AppStore';
import { Note } from '../Note';

const INFO_QUESTION = 'Which expense is this for, and is it urgent?';

export function Inbox() {
  const { world, config, inboxAs, dispatch } = useStore();
  const me = world.people.find((p) => p.id === inboxAs)!;
  const name = (id: string) => world.people.find((p) => p.id === id)?.name ?? id;
  const requests = world.requests.filter((r) => r.to !== 'payroll').slice().reverse();

  return (
    <>
      <div className="title-row">
        <h1>Admin inbox</h1>
        <div className="seg">
          {(['tom', 'lee'] as const).map((who) => (
            <button key={who} className={inboxAs === who ? 'on' : ''} onClick={() => dispatch({ type: 'setInboxAs', who })}>
              Viewing as {name(who)}
            </button>
          ))}
        </div>
      </div>
      {me.outOfOfficeUntil && (
        <div className="rule">
          {me.name} is out of office until {formatDay(me.outOfOfficeUntil)}. Lee Wong, the backup admin, sees the same requests.
        </div>
      )}
      {requests.length === 0 && <p className="muted lead">No requests yet. They appear here when an employee sends one from a session.</p>}
      {requests.map((r) => (
        <section key={r.id} className={`card request req-${r.status}`} data-hl={`request-${r.id}`}>
          <div className="request-head">
            <b>{r.change}</b>
            <span className="muted small">
              from Jordan Lee via Ava · {formatStamp(r.createdAt)} · to {name(r.to)}
            </span>
          </div>
          <dl>
            <dt>Diagnosis</dt>
            <dd>{r.diagnosis}</dd>
            <dt>Affects</dt>
            <dd>{r.affects}</dd>
            <dt>Already tried</dt>
            <dd>{r.tried.length ? r.tried.join(' · ') : '—'}</dd>
            <dt>Source</dt>
            <dd>{sourceLabel(config, r.source) ?? <span className="source-missing">Undocumented: needs investigation</span>}</dd>
            {r.notChecked && r.notChecked.length > 0 && (
              <>
                <dt>Not checked</dt>
                <dd className="muted">Ava has no access to {r.notChecked.join(', ')}</dd>
              </>
            )}
            {r.note && r.status === 'waiting' && (
              <>
                <dt>Follow-up</dt>
                <dd style={{ whiteSpace: 'pre-line' }}>{r.note}</dd>
              </>
            )}
          </dl>
          {r.status === 'waiting' ? (
            <div className="actions">
              <button className="btn btn-primary" data-approve={r.id} onClick={() => dispatch({ type: 'approve', id: r.id, by: inboxAs })}>
                Approve
              </button>
              <button className="btn btn-ghost" onClick={() => dispatch({ type: 'askInfo', id: r.id, by: inboxAs, note: INFO_QUESTION })}>
                Ask for info
              </button>
            </div>
          ) : (
            <div className={r.status === 'approved' ? 'ok' : 'muted'}>
              {r.status === 'approved'
                ? r.onCall
                  ? `✓ Fixed live on a call by ${name(r.approvedBy ?? '')}. ${r.note ?? ''}`
                  : `✓ Approved by ${name(r.approvedBy ?? '')}. The change was applied.`
                : `❓ ${name(r.approvedBy ?? '')} asked: "${r.note}"`}
            </div>
          )}
        </section>
      ))}
      <Note id="handoff-card" />
    </>
  );
}

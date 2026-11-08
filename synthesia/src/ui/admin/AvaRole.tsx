import type { Permission } from '../../data/types';
import { formatStamp } from '../../engine/time';
import { useStore } from '../../store/AppStore';
import { Note } from '../Note';

const PERMISSIONS: { id: Permission; label: string; why: string }[] = [
  { id: 'account', label: "The employee's own account", why: 'Cost centres and roles: "you\'re not assigned to SALES-DE".' },
  { id: 'costCentres', label: 'The cost-centre list', why: 'Which cost centres exist and who they belong to.' },
  { id: 'directory', label: 'Users and their roles', why: 'Who can approve or help, and who is available for a call.' },
  { id: 'approvalChain', label: 'The approval chain', why: 'Who an approval waits on, and whether a delegate is set.' },
  { id: 'auditLog', label: 'The audit log', why: 'What changed: finds root causes like the rollout import.' },
  { id: 'insights', label: 'Anonymised rollout insights', why: 'How many others hit the same problem (counts only).' },
];

export function AvaRoleView() {
  const { config, world, dispatch } = useStore();
  return (
    <>
      <h1>Ava's role</h1>
      <p className="lead">What Ava may check beyond the employee's screen. She never acts as an admin, whatever you allow here.</p>
      <div className="two-col">
        <section className="card">
          <h2>Ava may check</h2>
          {PERMISSIONS.map((p) => (
            <div key={p.id} className="setting" data-hl={`perm-${p.id}`}>
              <div>
                <div className="setting-label">{p.label}</div>
                <div className="muted small">{p.why}</div>
              </div>
              <button
                role="switch"
                aria-checked={config.role[p.id]}
                data-perm={p.id}
                className={`switch ${config.role[p.id] ? 'on' : ''}`}
                onClick={() => dispatch({ type: 'setPermission', permission: p.id, allowed: !config.role[p.id] })}
              >
                <span />
              </button>
            </div>
          ))}
        </section>
        <section className="card">
          <h2>Always the same</h2>
          <ul className="checks">
            <li>
              <b>Look at the employee's screen:</b> always. It's what they see.
            </li>
            <li>
              <b>Act on the employee's screen</b> (switch tabs, press Refresh, pick a file): only after the employee says yes, every time.
            </li>
            <li>
              <b>Admin changes:</b> never. A request, or the admin's own approval on a call, is always needed.
            </li>
          </ul>
          <h2 style={{ marginTop: 20 }}>Audit log</h2>
          <ul className="audit">
            {world.audit
              .slice()
              .reverse()
              .map((a) => (
                <li key={a.id}>
                  <span className="muted small">{formatStamp(a.at)}</span> <b>{a.actor}</b>: {a.text}
                </li>
              ))}
          </ul>
        </section>
      </div>
      <Note id="ava-role" />
    </>
  );
}

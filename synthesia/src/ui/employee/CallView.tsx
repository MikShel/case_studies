import type { AvatarMood } from '../../avatar/AvatarAdapter';
import type { AdminFix } from '../../engine/call';

export interface CallViewProps {
  adminName: string;
  avaMood: AvatarMood;
  adminSpeaking: boolean;
  caption: string;
  summary: { label: string; text: string }[] | null;
  fix: AdminFix | null;
  adminLines: string[];
  busy: boolean;
  avatarImage: string;
  onAdminLine(text: string): void;
  onApprove(): void;
  onDecline(): void;
  onEnd(): void;
}

/** The live call: Ava, Jordan and the admin. Only the admin's own button changes anything. */
export function CallView(p: CallViewProps) {
  const first = p.adminName.split(' ')[0];
  return (
    <div className="call" data-hl="call">
      <div className="call-head">
        <b>📞 Call · Expensio help</b>
        <span className="call-live">● live</span>
        <button className="btn btn-end" onClick={p.onEnd}>
          End call
        </button>
      </div>
      <div className="call-tiles">
        <div className={`call-tile ${p.avaMood === 'speaking' ? 'speaking' : ''}`}>
          <img src={p.avatarImage} alt="Ava" />
          <span>
            Ava <span className="ai-label">AI</span>
          </span>
        </div>
        <div className="call-tile">
          <span className="call-face">🙂</span>
          <span>Jordan</span>
        </div>
        <div className={`call-tile ${p.adminSpeaking ? 'speaking' : ''}`}>
          <span className="call-face">🔧</span>
          <span>{first} · admin</span>
        </div>
      </div>
      {p.caption && <div className="call-caption">{p.caption}</div>}

      {p.summary && (
        <div className="summary-card" data-hl="call-summary">
          <div className="summary-head">Summary shared by Ava</div>
          <dl>
            {p.summary.map((l) => (
              <div key={l.label} className="summary-row">
                <dt>{l.label}</dt>
                <dd>{l.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {p.fix && (
        <div className="admin-card" data-hl="admin-card">
          <div className="admin-card-head">{first}'s decision · needs {first}'s approval</div>
          <b>{p.fix.label}</b>
          <div className="small">Affects: {p.fix.affects}</div>
          <div className="actions">
            <button className="btn btn-primary" data-approve-call onClick={p.onApprove}>
              Approve as {first}
            </button>
            <button className="btn btn-ghost" onClick={p.onDecline}>
              Not now
            </button>
          </div>
        </div>
      )}

      {p.adminLines.length > 0 && (
        <div className="chips-row">
          {p.adminLines.map((l) => (
            <button key={l} className="chip chip-admin" disabled={p.busy} onClick={() => p.onAdminLine(l)}>
              {first}: “{l}”
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

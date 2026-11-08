import { RECEIPT_FILES, type IssueId, type MockTab } from '../../data/types';
import { formatDay } from '../../engine/time';
import { SELF_JOIN, visibleCostCentres } from '../../engine/world';
import { useHl, useStore } from '../../store/AppStore';

const TABS: { id: MockTab; label: string }[] = [
  { id: 'new-expense', label: 'New expense' },
  { id: 'receipt', label: 'Receipt' },
  { id: 'approvals', label: 'My approvals' },
  { id: 'reports', label: 'Reports' },
  { id: 'profile', label: 'Profile' },
];

/** "Get help" right where it failed: Ava starts from this context. */
function GetHelp({ issueId, label = 'Get help' }: { issueId: IssueId; label?: string }) {
  const { dispatch } = useStore();
  return (
    <button className="get-help" data-get-help={issueId} onClick={() => dispatch({ type: 'openSupport', issueId })}>
      💬 {label}
    </button>
  );
}

function NewExpense() {
  const { world, dispatch } = useStore();
  const hl = useHl();
  const e = world.employee;
  const options = visibleCostCentres(world);
  return (
    <div className="form">
      <label>
        Description
        <input value="Taxi to Hamburg Messe" readOnly />
      </label>
      <label>
        Amount
        <input value="€42.00" readOnly />
      </label>
      <div className="field">
        <div className="field-row">
          <span>Cost centre</span>
          <div {...hl('exp-cc-filter', 'seg')}>
            {(['mine', 'all'] as const).map((v) => (
              <button key={v} className={e.ccFilter === v ? 'on' : ''} onClick={() => dispatch({ type: 'mock', action: { type: 'setFilter', v } })}>
                {v === 'mine' ? 'My cost centres' : 'All'}
              </button>
            ))}
          </div>
          <button {...hl('exp-refresh', 'btn btn-ghost small')} onClick={() => dispatch({ type: 'mock', action: { type: 'setFilter', v: e.ccFilter } })}>
            ⟳ Refresh
          </button>
        </div>
        <select
          {...hl('exp-costcentre')}
          value={e.draft.costCentre ?? ''}
          onChange={(ev) => dispatch({ type: 'mock', action: { type: 'pickCostCentre', cc: ev.target.value } })}
        >
          <option value="">Select a cost centre…</option>
          {options.map((cc) => (
            <option key={cc} value={cc}>
              {cc}
            </option>
          ))}
        </select>
        {!e.costCentres.includes('SALES-DE') && (
          <span className="field-help">
            Can't find your cost centre? <GetHelp issueId="cost-centre" />
          </span>
        )}
      </div>
      <button {...hl('exp-submit', 'btn btn-primary')} disabled={!e.draft.costCentre || e.draft.submitted} onClick={() => dispatch({ type: 'mock', action: { type: 'submit' } })}>
        {e.draft.submitted ? '✓ Submitted' : 'Submit'}
      </button>
      {e.draft.submitted && <div className="ok">Submitted with {e.draft.costCentre}.</div>}
    </div>
  );
}

function Receipt() {
  const { world, dispatch } = useStore();
  const hl = useHl();
  const r = world.employee.receipt;
  return (
    <div className="form">
      <div {...hl('receipt-file', 'files')}>
        {(['heic', 'jpg'] as const).map((f) => (
          <label key={f} className={`file ${r.selected === f ? 'on' : ''}`}>
            <input type="radio" name="file" checked={r.selected === f} onChange={() => dispatch({ type: 'mock', action: { type: 'selectFile', f } })} />
            <span className="file-icon">🖼</span>
            <span>
              <b>{RECEIPT_FILES[f].name}</b>
              <span className="muted small">
                {' '}
                · {RECEIPT_FILES[f].format} · {RECEIPT_FILES[f].sizeMb} MB
              </span>
            </span>
          </label>
        ))}
      </div>
      <button {...hl('receipt-upload', 'btn btn-primary')} onClick={() => dispatch({ type: 'mock', action: { type: 'upload' } })}>
        Upload
      </button>
      {r.status === 'failed' && (
        <div className="error-row">
          <span className="bad">✗ Upload failed: file type or size not supported.</span>
          <GetHelp issueId="receipt" />
        </div>
      )}
      {r.status === 'uploaded' && <div className="ok">✓ Receipt attached.</div>}
    </div>
  );
}

function Approvals() {
  const { world } = useStore();
  const hl = useHl();
  const a = world.employee.approval;
  const who = (id: string) => world.people.find((p) => p.id === id)!;
  const approver = who(a.approverId);
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Expense</th>
          <th>Status</th>
          <th>Waiting on</th>
        </tr>
      </thead>
      <tbody>
        <tr {...hl('approval-row')}>
          <td>{a.title}</td>
          <td>{a.delegateId ? 'With delegate' : 'Pending · 4 days'}</td>
          <td>
            {a.delegateId ? (
              <>
                {who(a.delegateId).name} <span className="muted small">(covering {approver.name})</span>
              </>
            ) : (
              <>
                {approver.name}
                {approver.outOfOfficeUntil && <span className="pill pill-warn">Out of office until {formatDay(approver.outOfOfficeUntil)}</span>}
                <GetHelp issueId="approval" label="Stuck? Get help" />
              </>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function Reports() {
  const { world } = useStore();
  const hl = useHl();
  const allowed = world.employee.roles.includes('Report viewer');
  return (
    <div>
      <div className="seg">
        <button>My reports</button>
        <button {...hl('reports-team-tab', 'on')}>Team reports</button>
      </div>
      {allowed ? (
        <table className="table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Team total</th>
              <th>Expenses</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>October</td>
              <td>€8,420</td>
              <td>63</td>
            </tr>
            <tr>
              <td>September</td>
              <td>€7,915</td>
              <td>58</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <div className="locked">
          🔒 You don't have access to Team reports. Requires the "Report viewer" role. <GetHelp issueId="report" />
        </div>
      )}
    </div>
  );
}

function Profile() {
  const { world, dispatch } = useStore();
  const hl = useHl();
  const e = world.employee;
  return (
    <div className="form">
      <div>
        <b>{e.name}</b> · {e.team}, {e.city}
      </div>
      <div className="field">
        <span>Cost centres</span>
        <ul className="cc-list">
          {['DE-GENERAL', ...SELF_JOIN].map((cc) => (
            <li key={cc}>
              {cc}
              {e.costCentres.includes(cc) ? (
                <span className="ok"> ✓ assigned</span>
              ) : (
                <button {...hl(`profile-join-${cc}`, 'btn btn-ghost small')} onClick={() => dispatch({ type: 'mock', action: { type: 'join', cc } })}>
                  Join
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="muted small">Roles: {e.roles.join(', ')}</div>
    </div>
  );
}

export function MockExpensio() {
  const { mockTab, dispatch } = useStore();
  return (
    <div className="mock">
      <div className="mock-bar">
        <span className="mock-logo">Expensio</span>
        <span className="muted small">Jordan Lee · Sales, Berlin</span>
      </div>
      <div className="mock-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={mockTab === t.id ? 'on' : ''} onClick={() => dispatch({ type: 'setMockTab', tab: t.id })}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="mock-body">
        {mockTab === 'new-expense' && <NewExpense />}
        {mockTab === 'receipt' && <Receipt />}
        {mockTab === 'approvals' && <Approvals />}
        {mockTab === 'reports' && <Reports />}
        {mockTab === 'profile' && <Profile />}
      </div>
    </div>
  );
}

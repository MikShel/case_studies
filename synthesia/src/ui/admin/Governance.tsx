import { Note } from '../Note';

const USED = 1240;
const BUDGET = 2000;

export function Governance() {
  return (
    <>
      <h1>Governance &amp; cost</h1>
      <div className="two-col">
        <section className="card">
          <h2>Credit budget · Expensio rollout</h2>
          <div className="budget">
            <span style={{ width: `${(USED / BUDGET) * 100}%` }} />
          </div>
          <p>
            <b>{USED.toLocaleString('en-GB')}</b> of {BUDGET.toLocaleString('en-GB')} credits used · 62% · resets at the end of the rollout
          </p>
          <p className="muted">Alert at 80%. When the budget runs out, sessions fall back to text-only help instead of stopping.</p>
          <Note id="credit-budget" />
        </section>
        <section className="card">
          <h2>Trust &amp; data</h2>
          <ul className="checks">
            <li>
              <b>Transcript retention:</b> 30 days, aggregated analytics only by default
            </li>
            <li>
              <b>Disclosure:</b> every session shows an "AI avatar" label, and Ava says so in her first line
            </li>
            <li>
              <b>Ava never acts with admin rights.</b> The handoff is a request, not an action
            </li>
            <li>
              <b>Never via avatar:</b> payroll and bank details are always routed to people
            </li>
            <li>
              <b>Sources only:</b> Ava says nothing that isn't in the creator's knowledge
            </li>
          </ul>
          <Note id="disclosure" />
        </section>
      </div>
    </>
  );
}

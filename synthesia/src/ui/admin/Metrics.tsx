const METRICS = [
  { kind: 'North star', name: '% of issues resolved without a ticket', why: 'The reason a rollout team buys this: fewer tickets, faster adoption.' },
  { kind: 'Handoff quality', name: '% of requests approved without back-and-forth', why: "Proves the handoff card carries what an admin needs: it's the async promise." },
  { kind: 'Guardrail', name: 'Wrong-instruction rate', why: 'Any instruction outside the boundary or without a source. Target ≈ 0, measured with evals on every publish.' },
  { kind: 'Creation', name: 'Time to publish', why: 'From connecting docs to all scenarios passing. If authoring is slow, IT won\'t make a session per rollout.' },
];

export function Metrics() {
  return (
    <>
      <h1>Metrics &amp; learning</h1>
      <div className="metrics">
        {METRICS.map((m) => (
          <section key={m.kind} className="card metric">
            <div className="metric-kind">{m.kind}</div>
            <h2>{m.name}</h2>
            <p className="muted">{m.why}</p>
          </section>
        ))}
      </div>
      <section className="card">
        <h2>Learning plan</h2>
        <ul className="checks">
          <li>
            <b>3 design partners</b> mid-rollout of a real internal tool, for <b>6 weeks</b>.
          </li>
          <li>Weeks 1–2: creators author with us. Measure time to publish and where the boundary editor confuses.</li>
          <li>Weeks 3–6: live sessions. Track the north star against their ticket baseline, handoff quality, and the guardrail on every publish.</li>
          <li>Kill / scale signal: ≥ 40% resolved without a ticket and ≥ 80% first-time approvals, with zero wrong instructions.</li>
        </ul>
        <p className="muted small">v2 ideas: multiple languages, Slack/Teams handoff, LLM grounded on the same boundary, creator analytics per doc section.</p>
      </section>
    </>
  );
}

import { useStore } from '../../store/AppStore';
import { Note } from '../Note';

export function Knowledge() {
  const { config, history, dispatch } = useStore();
  const counts = (id: string) => history.filter((h) => h.issueId === id).length;
  const gaps = config.issues.filter((i) => i.gap);

  return (
    <>
      <h1>Knowledge</h1>
      <p className="lead">Connect the docs Ava may use. Ava only says what these sources say.</p>
      {!config.connected ? (
        <button className="btn btn-primary" onClick={() => dispatch({ type: 'connect' })}>
          Connect rollout sources
        </button>
      ) : (
        <>
          <div className="docs">
            {config.docs.map((d) => (
              <section key={d.id} className={`card doc ${d.kind === 'note' ? 'doc-note' : ''}`}>
                <h2>
                  {d.kind === 'note' ? '✍️' : '📄'} {d.title}
                </h2>
                <ul>
                  {d.sections.map((s) => (
                    <li key={s.id}>
                      <b>{s.heading}</b>
                      <div className="muted small">{s.text}</div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <h2 className="section-title">Issues found</h2>
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Steps</th>
                  <th>Sessions, week 1</th>
                </tr>
              </thead>
              <tbody>
                {config.issues.map((i) => (
                  <tr key={i.id}>
                    <td>{i.title}</td>
                    <td>{i.steps.length}</td>
                    <td>{counts(i.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {gaps.map((g) => (
            <div key={g.id} className="gap" data-hl={`gap-${g.id}`}>
              <div>
                <b>⚠ Gap:</b> {g.gap}
              </div>
              <button className="btn" onClick={() => dispatch({ type: 'setCreatorTab', tab: 'boundary' })}>
                Fix in boundary editor →
              </button>
            </div>
          ))}
          <Note id="gap" />
        </>
      )}
    </>
  );
}

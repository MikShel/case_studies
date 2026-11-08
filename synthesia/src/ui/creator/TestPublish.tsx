import { sourceLabel } from '../../engine/boundary';
import { canPublish, runScenarios } from '../../engine/creatorTest';
import type { Beat } from '../../engine/plan';
import { useStore } from '../../store/AppStore';
import { Note } from '../Note';

function BeatChip({ beat, honest }: { beat: Beat; honest: boolean }) {
  const { config } = useStore();
  switch (beat.kind) {
    case 'instruct':
      return (
        <span className="beat beat-user" title={sourceLabel(config, beat.step.source)}>
          {beat.step.instruction}
        </span>
      );
    case 'skipped':
      return <span className="beat beat-bad">✗ unsourced: "{beat.step.instruction}"</span>;
    case 'admin':
      return <span className="beat beat-admin">Needs admin: {beat.step.adminRequest ?? beat.step.instruction}</span>;
    case 'never':
      return <span className="beat beat-never">Never via avatar: {beat.step.instruction}</span>;
    case 'workaround':
      return <span className="beat beat-user">Meanwhile: {beat.step.instruction}</span>;
    case 'handoff':
      if (honest) return <span className="beat beat-handoff">→ Passes on what they said</span>;
      return <span className={`beat ${beat.documented ? 'beat-handoff' : 'beat-bad'}`}>{beat.documented ? '→ Handoff card' : '→ Handoff (undocumented)'}</span>;
    case 'resolved':
      return <span className="beat beat-ok">✓ Resolved</span>;
    case 'unknown':
      return <span className="beat beat-admin">"I don't know that one"</span>;
  }
}

export function TestPublish() {
  const { config, dispatch } = useStore();
  const results = runScenarios(config);
  const ok = canPublish(config);
  const passed = results.filter((r) => r.pass).length;

  return (
    <>
      <div className="title-row">
        <h1>Test before publish</h1>
        <div className="publish">
          <span className={ok ? 'ok' : 'bad'}>
            {passed} / {results.length} pass
          </span>
          {config.published ? (
            <span className="badge badge-ok">● Published</span>
          ) : (
            <button className="btn btn-primary" disabled={!ok} data-hl="publish" onClick={() => dispatch({ type: 'publish' })} title={ok ? '' : 'Every scenario must pass first'}>
              Publish
            </button>
          )}
        </div>
      </div>
      <p className="lead">
        Play the employee. Each path comes from the same engine as the live session. Two invariants must hold: <b>(1)</b> Ava never tells someone to do a step that needs an admin, and{' '}
        <b>(2)</b> every instruction and request has a source.
      </p>
      <Note id="test-gating" />
      <div className="scenarios">
        {results.map((r) => (
          <section key={r.scenario.id} className={`card scenario ${r.pass ? 'pass' : 'fail'}`} data-hl={`scenario-${r.scenario.id}`}>
            <div className="scenario-head">
              <span className="scenario-line">"{r.scenario.line}"</span>
              <span className={r.pass ? 'ok' : 'bad'}>{r.pass ? '✓ Pass' : '✗ Fail'}</span>
            </div>
            <div className="path">
              {r.beats.map((b, i) => (
                <BeatChip key={i} beat={b} honest={r.beats[0]?.kind === 'unknown'} />
              ))}
            </div>
            <div className="invariants small">
              <span className={r.neverInstructsAdmin ? 'ok' : 'bad'}>{r.neverInstructsAdmin ? '✓' : '✗'} never instructs an admin step</span>
              <span className={r.everythingSourced ? 'ok' : 'bad'}>{r.everythingSourced ? '✓' : '✗'} everything sourced</span>
            </div>
            {r.problem && <div className="problem">{r.problem}</div>}
          </section>
        ))}
      </div>
    </>
  );
}

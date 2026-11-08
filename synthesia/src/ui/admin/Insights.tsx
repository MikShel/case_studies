import { insights, stuckLabel } from '../../engine/insights';
import { useStore } from '../../store/AppStore';
import { Note } from '../Note';

function hours(min: number): string {
  return min < 90 ? `${min} min` : `${(min / 60).toFixed(1)} h`;
}

export function InsightsView() {
  const { history, world, config, dispatch } = useStore();
  const i = insights(history, world);
  const title = (id: string) => config.issues.find((x) => x.id === id)?.title ?? 'Not covered by the guide';
  const max = i.top[0]?.count ?? 1;
  const maxStuck = i.stuckSteps[0]?.count ?? 1;

  return (
    <>
      <h1>Rollout insights</h1>
      <p className="lead">Expensio rollout, week 1 · aggregated and anonymised · {i.total} sessions{i.liveToday > 0 && ` · +${i.liveToday} today`}</p>
      <div className="kpis">
        <div className="kpi">
          <span className="kpi-v">{i.selfPct}%</span>
          <span>resolved without a ticket</span>
        </div>
        <div className="kpi">
          <span className="kpi-v">{i.handoffPct}%</span>
          <span>handed off as a ready request</span>
        </div>
        <div className="kpi">
          <span className="kpi-v">{hours(i.medianMinutes)}</span>
          <span>median time to resolution</span>
        </div>
        <div className="kpi">
          <span className="kpi-v">{i.firstTimeApprovalPct}%</span>
          <span>requests approved without back-and-forth</span>
        </div>
      </div>

      <div className="insight" data-hl="insight-actionable">
        <b>💡 {i.actionable}</b>
        <button className="btn" onClick={() => dispatch({ type: 'setView', view: 'creator' })}>
          Open the rollout config
        </button>
      </div>

      <div className="two-col">
        <section className="card">
          <h2>Top issues</h2>
          {i.top.map((t) => (
            <div key={t.issueId} className="bar-row">
              <span className="bar-label">{title(t.issueId)}</span>
              <span className="bar">
                <span style={{ width: `${(t.count / max) * 100}%` }} />
              </span>
              <span className="bar-n">{t.count}</span>
            </div>
          ))}
        </section>
        <section className="card">
          <h2>Where people get stuck</h2>
          {i.stuckSteps.slice(0, 6).map((s) => (
            <div key={s.stepId} className="bar-row">
              <span className="bar-label">{stuckLabel(config, s.stepId, world)}</span>
              <span className="bar bar-warn">
                <span style={{ width: `${(s.count / maxStuck) * 100}%` }} />
              </span>
              <span className="bar-n">{s.count}</span>
            </div>
          ))}
        </section>
      </div>
      <Note id="insights-anon" />
    </>
  );
}

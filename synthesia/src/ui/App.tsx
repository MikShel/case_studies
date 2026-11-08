import type { ReactNode } from 'react';
import { canPublish } from '../engine/creatorTest';
import { useStore, type AdminTab, type CreatorTab, type View } from '../store/AppStore';
import { Governance } from './admin/Governance';
import { Inbox } from './admin/Inbox';
import { InsightsView } from './admin/Insights';
import { Metrics } from './admin/Metrics';
import { AvaRoleView } from './admin/AvaRole';
import { Boundary } from './creator/Boundary';
import { Knowledge } from './creator/Knowledge';
import { TestPublish } from './creator/TestPublish';
import { EmployeeView } from './employee/EmployeeView';
import { GuidedDemo } from './GuidedDemo';

const VIEWS: { id: View; label: string; who: string }[] = [
  { id: 'creator', label: 'Creator', who: 'IT / enablement lead' },
  { id: 'employee', label: 'Employee session', who: 'Jordan Lee' },
  { id: 'admin', label: 'Admin & insights', who: 'Tom · Lee · rollout owner' },
];

function TopBar() {
  const { view, notesOn, dispatch } = useStore();
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">▶</span>
        <div>
          <div className="brand-name">Troubleshooting Sessions</div>
          <div className="small muted">Expensio rollout · Northwind Labs · prototype</div>
        </div>
      </div>
      <nav className="switcher">
        {VIEWS.map((v) => (
          <button key={v.id} className={view === v.id ? 'active' : ''} data-view={v.id} onClick={() => dispatch({ type: 'setView', view: v.id })}>
            {v.label}
            <span className="who">{v.who}</span>
          </button>
        ))}
      </nav>
      <div className="top-actions">
        <label className="toggle">
          <input type="checkbox" checked={notesOn} onChange={() => dispatch({ type: 'toggleNotes' })} /> Product notes
        </label>
        <GuidedDemo />
        <button className="btn btn-ghost" onClick={() => dispatch({ type: 'resetAll' })}>
          ↺ Reset demo
        </button>
      </div>
    </header>
  );
}

function SubNav<T extends string>({ items, current, onPick }: { items: { id: T; label: string; badge?: ReactNode }[]; current: T; onPick: (t: T) => void }) {
  return (
    <nav className="subnav">
      {items.map((i, n) => (
        <button key={i.id} className={current === i.id ? 'active' : ''} data-tab={i.id} onClick={() => onPick(i.id)}>
          <span className="subnav-n">{n + 1}</span> {i.label} {i.badge}
        </button>
      ))}
    </nav>
  );
}

function CreatorView() {
  const { creatorTab, config, dispatch } = useStore();
  const ok = canPublish(config);
  const tabs: { id: CreatorTab; label: string; badge?: ReactNode }[] = [
    { id: 'knowledge', label: 'Knowledge', badge: config.issues.some((i) => i.gap) && config.connected ? <span className="dot dot-warn" /> : undefined },
    { id: 'boundary', label: 'Boundary' },
    { id: 'test', label: 'Test & publish', badge: config.published ? <span className="dot dot-ok" /> : !ok ? <span className="dot dot-bad" /> : undefined },
  ];
  return (
    <div className="split-view">
      <SubNav items={tabs} current={creatorTab} onPick={(tab) => dispatch({ type: 'setCreatorTab', tab })} />
      <main className="content">
        {creatorTab === 'knowledge' && <Knowledge />}
        {creatorTab === 'boundary' && <Boundary />}
        {creatorTab === 'test' && <TestPublish />}
      </main>
    </div>
  );
}

function AdminView() {
  const { adminTab, world, dispatch } = useStore();
  const waiting = world.requests.filter((r) => r.status === 'waiting').length;
  const tabs: { id: AdminTab; label: string; badge?: ReactNode }[] = [
    { id: 'inbox', label: 'Admin inbox', badge: waiting ? <span className="count">{waiting}</span> : undefined },
    { id: 'insights', label: 'Rollout insights' },
    { id: 'role', label: "Ava's role" },
    { id: 'governance', label: 'Governance & cost' },
    { id: 'metrics', label: 'Metrics & learning' },
  ];
  return (
    <div className="split-view">
      <SubNav items={tabs} current={adminTab} onPick={(tab) => dispatch({ type: 'setAdminTab', tab })} />
      <main className="content">
        {adminTab === 'inbox' && <Inbox />}
        {adminTab === 'insights' && <InsightsView />}
        {adminTab === 'role' && <AvaRoleView />}
        {adminTab === 'governance' && <Governance />}
        {adminTab === 'metrics' && <Metrics />}
      </main>
    </div>
  );
}

export function App() {
  const { view } = useStore();
  return (
    <div className="app">
      <TopBar />
      {view === 'creator' && <CreatorView />}
      <EmployeeView active={view === 'employee'} />
      {view === 'admin' && <AdminView />}
    </div>
  );
}

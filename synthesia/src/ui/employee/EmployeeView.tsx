import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { contextIssue } from '../../engine/context';
import { useStore } from '../../store/AppStore';
import { Note } from '../Note';
import { AvaPanel } from './AvaPanel';
import { MockExpensio } from './MockExpensio';

const FLOAT_W = 440;

/** Stays mounted while hidden, so the conversation survives switching views and closing support. */
export function EmployeeView({ active }: { active: boolean }) {
  const { highlights, notesOn, support, world, mockTab, dispatch } = useStore();
  const [pos, setPos] = useState(() => ({ x: Math.max(16, window.innerWidth - FLOAT_W - 32), y: 90 }));
  const docked = support.open && support.mode === 'docked';
  const floating = support.open && support.mode === 'floating';

  useEffect(() => {
    if (!active || highlights.length === 0) return;
    document.querySelector(`[data-hl="${highlights[0]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [active, highlights]);

  const onDragStart = (e: ReactPointerEvent) => {
    if (!floating || (e.target as HTMLElement).closest('button')) return;
    const start = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    const move = (ev: PointerEvent) =>
      setPos({
        x: Math.min(Math.max(0, ev.clientX - start.x), window.innerWidth - 120),
        y: Math.min(Math.max(0, ev.clientY - start.y), window.innerHeight - 80),
      });
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className={`employee ${docked ? 'with-support' : ''}`} hidden={!active}>
      <div className="employee-left">
        <MockExpensio />
        {notesOn && (
          <div className="notes-row">
            <Note id="context-consent" />
            <Note id="one-question" />
            <Note id="source-chips" />
            <Note id="handoff-card" />
            <Note id="workaround-status" />
            <Note id="disclosure" />
            <Note id="live-escalation" />
            <Note id="checks-decides" />
            <Note id="ava-role" />
          </div>
        )}
      </div>
      <div className={floating ? 'ava-float' : 'ava-dock'} hidden={!support.open} style={floating ? { left: pos.x, top: pos.y } : undefined}>
        <AvaPanel active={active} onDragStart={onDragStart} />
      </div>
      {!support.open && (
        <button className="help-fab" data-help-fab onClick={() => dispatch({ type: 'openSupport', issueId: contextIssue(world, mockTab) })}>
          💬 Need help?
        </button>
      )}
    </div>
  );
}

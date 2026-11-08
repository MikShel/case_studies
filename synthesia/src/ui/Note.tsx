import { NOTES, type NoteId } from '../notes';
import { useStore } from '../store/AppStore';

export function Note({ id }: { id: NoteId }) {
  const { notesOn } = useStore();
  if (!notesOn) return null;
  const n = NOTES[id];
  return (
    <aside className="note">
      <div className="note-title">📝 {n.title}</div>
      <p>
        <b>Decision</b> {n.decision}
      </p>
      <p>
        <b>Why</b> {n.why}
      </p>
      <p>
        <b>Metric</b> {n.metric}
      </p>
    </aside>
  );
}

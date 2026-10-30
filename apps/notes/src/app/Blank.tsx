import { BookOpen, PenLine } from 'lucide-react';
import { DIARY_GRADIENT } from './constants';

/** The right-hand side on a wide screen, before a note is opened. */
export function Blank({ onNew }: { onNew: () => void }) {
  return (
    <div className="hidden flex-1 place-items-center border-l border-line bg-panel-2/40 p-10 text-center md:grid">
      <div className="max-w-sm">
        <div className="mx-auto grid size-20 place-items-center rounded-3xl text-white shadow-lg" style={{ background: DIARY_GRADIENT }}>
          <BookOpen className="size-10" />
        </div>
        <h3 className="mt-5 text-xl font-semibold">Your private diary</h3>
        <p className="mt-2 text-sm text-muted">Pick a note on the left, or start a new one. Everything you write is end-to-end encrypted and synced to your devices.</p>
        <button onClick={onNew} className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110">
          <PenLine className="size-4" /> Start writing
        </button>
      </div>
    </div>
  );
}

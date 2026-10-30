import { useEffect, useRef, useState } from 'react';
import { SendHorizontal } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { IconButton } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { myName } from '../../../lib/engine';
import { cn } from '@sanga/ui/utils';
import { insertMention, mentionQuery, splitMentions } from '../../../lib/mentions';
import { nameOf, say, useGames, type ChatLine, type Game } from '../store';
import { QUICK_EMOJI, PHRASES } from './quickMessages';

const NO_LINES: ChatLine[] = []; // stable, so the store selector doesn't re-render forever

export function ChatSheet({ g, open, onOpenChange }: { g: Game; open: boolean; onOpenChange: (o: boolean) => void }) {
  const lines = useGames((s) => s.chat[g.id] || NO_LINES);
  const me = myName();
  const [text, setText] = useState('');
  const [tag, setTag] = useState<{ start: number; q: string } | null>(null); // "@na…" being typed
  const [pick, setPick] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) end.current?.scrollIntoView({ block: 'end' }); }, [open, lines.length]);
  const send = (x: string) => { const v = x.trim(); if (v) { say(g.id, v); setText(''); setTag(null); } };

  const users = g.players.filter((p) => p.state !== 'declined').map((p) => p.u);
  const others = g.players.filter((p) => p.u !== me && p.state !== 'declined');
  const matches = tag ? others.filter((p) => p.u.includes(tag.q) || (p.n || '').toLowerCase().includes(tag.q)).slice(0, 6) : [];
  const typed = (v: string, cursor: number) => { setText(v); setTag(mentionQuery(v, cursor)); setPick(0); };
  const choose = (u: string) => {
    if (!tag) return;
    const r = insertMention(text, box.current?.selectionStart ?? text.length, tag.start, u);
    setText(r.text);
    setTag(null);
    requestAnimationFrame(() => { box.current?.focus(); box.current?.setSelectionRange(r.cursor, r.cursor); });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Game chat"
      description="Seen by everyone in this game. Not end-to-end encrypted; deleted when the game ends.">
      <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
        {QUICK_EMOJI.map((e) => <button key={e} type="button" onClick={() => send(e)} className="shrink-0 rounded-xl px-1.5 py-1 text-2xl hover:bg-hover" aria-label={'Send ' + e}>{e}</button>)}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PHRASES.slice(0, 6).map((p) => <button key={p} type="button" onClick={() => send(p)} className="rounded-full border border-line px-3 py-1 text-sm hover:bg-hover">{p}</button>)}
      </div>
      <div className="h-[38dvh] space-y-1.5 overflow-y-auto rounded-xl bg-hover/40 p-2" aria-live="polite">
        {lines.length === 0 && <p className="py-8 text-center text-sm text-muted">No messages yet. Say hi!</p>}
        {lines.map((l, k) => (
          <div key={k} className={cn('flex', l.f === me ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[80%] rounded-2xl px-3 py-1.5 text-sm', l.f === me ? 'bg-accent text-accent-ink' : 'bg-panel shadow-bubble')}>
              {l.f !== me && <div className="text-xs font-semibold text-accent">{nameOf(g, l.f)}</div>}
              {splitMentions(l.x, users).map((part, i) => part.u ? (
                <span key={i} className={cn('font-semibold', part.u === me ? 'rounded bg-amber-300/90 px-0.5 text-amber-950' : l.f === me ? 'underline' : 'text-accent')}>{part.t}</span>
              ) : <span key={i}>{part.t}</span>)}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="relative mt-3 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (matches.length) choose(matches[pick].u); else send(text); }}>
        {matches.length > 0 && (
          <ul className="absolute bottom-full left-0 z-10 mb-2 w-full overflow-hidden rounded-2xl border border-line bg-panel shadow-xl" role="listbox" aria-label="Mention a player">
            {matches.map((p, i) => (
              <li key={p.u} role="option" aria-selected={i === pick}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(p.u)}
                  className={cn('flex w-full items-center gap-3 px-3 py-2 text-left', i === pick ? 'bg-hover' : 'hover:bg-hover')}>
                  <Avatar u={p.u} name={p.n} size={32} />
                  <span className="min-w-0 flex-1 truncate font-medium">{p.n || p.u}</span>
                  <span className="text-sm text-muted">@{p.u}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <input ref={box} value={text} maxLength={200} placeholder="Message everyone · @ to tag" aria-label="Game message"
          onChange={(e) => typed(e.target.value, e.target.selectionStart ?? e.target.value.length)}
          onKeyDown={(e) => {
            if (!matches.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setPick((i) => (i + 1) % matches.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setPick((i) => (i - 1 + matches.length) % matches.length); }
            else if (e.key === 'Tab') { e.preventDefault(); choose(matches[pick].u); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setTag(null); }
          }}
          className="h-11 min-w-0 flex-1 rounded-full border border-line bg-panel px-4 outline-none focus:border-accent" />
        <IconButton label="Send" type="submit" variant="primary" disabled={!text.trim()}><SendHorizontal /></IconButton>
      </form>
    </Dialog>
  );
}

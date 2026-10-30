import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { messageTexts } from '../../../lib/engine';
import { type Msg } from '../../../lib/types';
import { setApp, useApp } from '../../../state/app';

export function SearchBar() {
  const messages = useApp((s) => s.messages);
  const peer = useApp((s) => s.active);
  const query = useApp((s) => s.searchQuery);
  const [index, setIndex] = useState(-1); // -1: haven't jumped yet
  // The whole chat on this device, not just what's loaded on screen; the loaded ones are the freshest copies.
  const [stored, setStored] = useState<Pick<Msg, 'k' | 'ts' | 'text' | 'type'>[]>([]);
  useEffect(() => { if (peer) messageTexts(peer).then(setStored); }, [peer]);
  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const byK = new Map<string, Pick<Msg, 'k' | 'ts' | 'text' | 'type'>>(stored.map((m) => [m.k, m]));
    for (const m of messages) byK.set(m.k, m);
    return [...byK.values()].filter((m) => m.type !== 'deleted' && m.text?.toLowerCase().includes(q)).sort((a, b) => b.ts - a.ts); // newest first
  }, [messages, stored, query]);

  const go = (i: number) => {
    if (!hits.length) return;
    const n = (i + hits.length) % hits.length;
    setIndex(n);
    setApp({ highlight: hits[n].k });
  };
  // Typing jumps to the newest match after a moment; Enter and the arrows go through the rest.
  useEffect(() => {
    if (index !== -1 || !hits.length) return;
    const t = setTimeout(() => go(0), 400);
    return () => clearTimeout(t);
  }, [query, hits.length]);

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-line bg-panel px-2 py-1.5">
      <Search className="ml-2 size-4 text-muted" />
      <input autoFocus value={query} placeholder="Search messages"
        onChange={(e) => { setApp({ searchQuery: e.target.value }); setIndex(-1); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') go(e.shiftKey ? index - 1 : index + 1); // Enter: next older match
          if (e.key === 'Escape') { e.preventDefault(); setApp({ searchOpen: false, searchQuery: '' }); }
        }}
        className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" />
      <span className="text-xs text-muted tabular-nums">{query ? (hits.length ? `${Math.max(index, 0) + 1}/${hits.length}` : '0 results') : ''}</span>
      <IconButton label="Newer match" size="icon-sm" disabled={!hits.length} onClick={() => go(index - 1)}><ChevronDown /></IconButton>
      <IconButton label="Older match" size="icon-sm" disabled={!hits.length} onClick={() => go(index + 1)}><ChevronUp /></IconButton>
      <IconButton label="Close search" size="icon-sm" onClick={() => setApp({ searchOpen: false, searchQuery: '' })}><X /></IconButton>
    </div>
  );
}

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { senderOf } from '../../lib/controls';
import { loadOlder, loadUntil, me as myName, preview } from '../../lib/engine';
import { fmtDay } from '../../lib/format';
import { setApp, useApp } from '../../state/app';
import { useSettings } from '../../state/settings';
import { MessageBubble } from './MessageBubble';
import { cn } from '../../lib/utils';
import type { Msg } from '../../lib/types';

const GROUP_MS = 5 * 60e3;

/** Scrolls a message into view and flashes it (replies, pins, search). */
function flash(k: string) {
  const el = document.querySelector<HTMLElement>(`[data-k="${CSS.escape(k)}"]`)
    ?? document.querySelector<HTMLElement>(`[data-keys~="${CSS.escape(k)}"]`); // a photo inside an album
  if (!el) return false;
  el.scrollIntoView({ block: 'center' }); // instant: a smooth scroll would be cut short when older messages load in above
  el.classList.remove('animate-flash');
  void el.offsetWidth;
  el.classList.add('animate-flash');
  return true;
}

export function MessageList({ peer, peerName, unreadAtOpen }: { peer: string; peerName: string; unreadAtOpen: number }) {
  const messages = useApp((s) => s.messages);
  const selection = useApp((s) => s.selection);
  const highlight = useApp((s) => s.highlight);
  const pins = useApp((s) => s.chats.find((c) => c.peer === peer)?.pins);
  const wallpaper = useSettings((s) => s.wallpaper);
  const privacy = useSettings((s) => s.privacyScreen);
  const keep = useSettings((s) => s.privacyKeep);
  const box = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const bottomRef = useRef(true); // atBottom, for the observers
  const content = useRef<HTMLDivElement>(null);
  const [newCount, setNewCount] = useState(0);
  const lastLen = useRef(0);
  const olderLeft = useApp((s) => s.olderLeft);
  const edges = useRef({ first: '', last: '', height: 0, prepended: false }); // what was rendered last time, to tell older from newer
  const opened = useRef(false);
  const me = myName();

  const pinned = useMemo(() => new Set((pins || []).map((p) => p.k)), [pins]);
  const selected = useMemo(() => new Set(selection || []), [selection]);

  // Privacy screen: messages before this index are blurred (the newest `keep` stay readable).
  const blurBefore = useMemo(() => {
    if (!privacy) return 0;
    let i = messages.length, n = 0;
    while (i > 0 && n < keep) if (messages[--i].type !== 'sys') n++;
    return i;
  }, [privacy, keep, messages]);

  // Photos sent together (same album, same sender, one after another) show as one bubble,
  // drawn at the last of them; the others are skipped.
  const albums = useMemo(() => {
    const at = new Map<number, Msg[]>();
    const skip = new Set<number>();
    for (let i = 0; i < messages.length;) {
      const m = messages[i];
      let j = i + 1;
      if (m.type === 'img' && m.al) {
        while (j < messages.length && messages[j].type === 'img' && messages[j].al === m.al && senderOf(messages[j]) === senderOf(m)) j++;
      }
      if (j - i > 1) {
        at.set(j - 1, messages.slice(i, j));
        for (let n = i; n < j - 1; n++) skip.add(n);
      }
      i = j;
    }
    return { at, skip };
  }, [messages]);

  // The unread divider sits before the first of the messages that were unread when the chat opened.
  const dividerK = useMemo(() => {
    if (!unreadAtOpen) return null;
    const incoming = messages.filter((m) => !m.out);
    return incoming[incoming.length - unreadAtOpen]?.k ?? null;
  }, [unreadAtOpen, messages.length > 0]); // computed once, when the messages first load

  // First render: jump to the unread divider (or the bottom). Afterwards: follow new messages
  // if you're at the bottom or sent them yourself, otherwise count them on the ↓ button.
  // Older messages loaded above (scrolling up) keep what you're reading where it is.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !messages.length) return;
    if (!opened.current) {
      opened.current = true;
      const divider = dividerK && el.querySelector('[data-divider]');
      if (divider) (divider as HTMLElement).scrollIntoView({ block: 'start' });
      else el.scrollTop = el.scrollHeight;
    } else if (messages[0].k !== edges.current.first && messages[messages.length - 1].k === edges.current.last) {
      el.scrollTop += el.scrollHeight - edges.current.height;
      edges.current.prepended = true; // not new content at the bottom: don't follow it down
    } else if (messages.length > lastLen.current) {
      const last = messages[messages.length - 1];
      if (atBottom || last.out) el.scrollTop = el.scrollHeight;
      else setNewCount((n) => n + (messages.length - lastLen.current));
    }
    lastLen.current = messages.length;
    edges.current = { ...edges.current, first: messages[0].k, last: messages[messages.length - 1].k, height: el.scrollHeight };
  }, [messages, dividerK, atBottom]);

  // When the list gets shorter (the phone keyboard opens, a reply bar appears), keep the messages
  // at the bottom where they were instead of letting them slide behind the keyboard.
  // And when what's inside grows while you're at the bottom (photos loading, link previews), stay there.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let h = el.clientHeight;
    const ro = new ResizeObserver(() => {
      const now = el.clientHeight;
      if (now < h) el.scrollTop += h - now;
      h = now;
    });
    ro.observe(el);
    const grow = new ResizeObserver(() => {
      if (bottomRef.current && !edges.current.prepended) el.scrollTop = el.scrollHeight;
      edges.current.prepended = false;
      edges.current.height = el.scrollHeight;
    });
    if (content.current) grow.observe(content.current);
    return () => { ro.disconnect(); grow.disconnect(); };
  }, []);

  // Jumping to a message further up than what's loaded (a reply, pin or search hit) loads back to it first.
  useEffect(() => {
    if (!highlight) return;
    setApp({ highlight: null });
    bottomRef.current = false; // jumping away from the bottom
    if (flash(highlight)) return;
    loadUntil(highlight).then((ok) => {
      if (ok) requestAnimationFrame(() => flash(highlight));
      else toast('That message isn’t on this device anymore.');
    });
  }, [highlight]);

  const onScroll = () => {
    const el = box.current!;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAtBottom(bottom);
    bottomRef.current = bottom;
    if (el.scrollTop < 600 && olderLeft) loadOlder(); // getting near the top: load the next older page
    if (bottom) setNewCount(0);
  };

  const toBottom = () => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' }); setNewCount(0); };

  let lastDay = '';
  return (
    <div className="relative min-h-0 flex-1">
      <div ref={box} onScroll={onScroll} className={`wallpaper wp-${wallpaper} h-full overflow-x-hidden overflow-y-auto overscroll-contain py-3`} role="log" aria-live="polite">
        {!messages.length && (
          <div className="mx-auto mt-10 max-w-xs rounded-xl bg-panel/90 px-4 py-3 text-center text-sm text-muted shadow-bubble">
            🔒 Messages are end-to-end encrypted. Say hi to {peerName}!
          </div>
        )}
        <div ref={content}>
        {olderLeft && (
          <div className="flex h-10 items-center justify-center" role="status" aria-label="Loading older messages">
            <span className="size-5 animate-spin rounded-full border-2 border-muted/40 border-t-accent" />
          </div>
        )}
        {messages.map((m, i) => {
          const day = fmtDay(m.ts);
          const showDay = day !== lastDay;
          lastDay = day;
          const album = albums.at.get(i);
          const lead = album ? i - album.length + 1 : i; // where this bubble starts
          const prev = messages[lead - 1];
          const first = !prev || showDay || senderOf(prev) !== senderOf(m) || m.ts - prev.ts > GROUP_MS;
          return (
            <Fragment key={m.k}>
              {showDay && (
                <div className="pointer-events-none sticky top-1 z-10 my-2 flex justify-center">
                  <span className="rounded-lg bg-panel px-3 py-1 text-xs font-medium text-muted shadow-bubble">{day}</span>
                </div>
              )}
              {m.k === dividerK && (
                <div data-divider className="my-3 flex justify-center bg-panel/60 py-1">
                  <span className="rounded-full bg-panel px-3 py-0.5 text-xs font-semibold text-accent-ink shadow-bubble">
                    {unreadAtOpen} unread message{unreadAtOpen > 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {albums.skip.has(i) ? null : m.type === 'sys' ? (
                <div className={cn('my-2 flex justify-center px-6', i < blurBefore && 'priv-scope')} data-k={m.k}>
                  <span className="priv rounded-lg bg-panel/95 px-3 py-1 text-center text-xs text-muted shadow-bubble">{preview(m)}</span>
                </div>
              ) : (
                <MessageBubble m={m} me={me} peerName={peerName} first={first || prev?.type === 'sys'}
                  selecting={!!selection} pinned={album ? album.some((x) => pinned.has(x.k)) : pinned.has(m.k)} hidden={lead < blurBefore}
                  selected={album ? album.every((x) => selected.has(x.k)) : selected.has(m.k)} album={album} />
              )}
            </Fragment>
          );
        })}
        </div>
      </div>
      {!atBottom && (
        <button onClick={toBottom} aria-label="Scroll to latest messages"
          className="absolute right-4 bottom-4 grid size-11 place-items-center rounded-full bg-panel text-muted shadow-lg hover:text-ink">
          <ChevronDown className="size-6" />
          {newCount > 0 && (
            <span className="absolute -top-1.5 -right-1 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-xs leading-5 font-bold text-white">{newCount}</span>
          )}
        </button>
      )}
    </div>
  );
}

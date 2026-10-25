import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { senderOf } from '../../lib/controls';
import { me as myName } from '../../lib/engine';
import { fmtDay } from '../../lib/format';
import { setApp, useApp } from '../../state/app';
import { useSettings } from '../../state/settings';
import { MessageBubble } from './MessageBubble';

const GROUP_MS = 5 * 60e3;

/** Scrolls a message into view and flashes it (replies, pins, search). */
function flash(k: string) {
  const el = document.querySelector<HTMLElement>(`[data-k="${CSS.escape(k)}"]`);
  if (!el) return false;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
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
  const box = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const lastLen = useRef(0);
  const opened = useRef(false);
  const me = myName();

  const pinned = useMemo(() => new Set((pins || []).map((p) => p.k)), [pins]);
  const selected = useMemo(() => new Set(selection || []), [selection]);

  // The unread divider sits before the first of the messages that were unread when the chat opened.
  const dividerK = useMemo(() => {
    if (!unreadAtOpen) return null;
    const incoming = messages.filter((m) => !m.out);
    return incoming[incoming.length - unreadAtOpen]?.k ?? null;
  }, [unreadAtOpen, messages.length > 0]); // computed once, when the messages first load

  // First render: jump to the unread divider (or the bottom). Afterwards: follow new messages
  // if you're at the bottom or sent them yourself, otherwise count them on the ↓ button.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !messages.length) return;
    if (!opened.current) {
      opened.current = true;
      const divider = dividerK && el.querySelector('[data-divider]');
      if (divider) (divider as HTMLElement).scrollIntoView({ block: 'start' });
      else el.scrollTop = el.scrollHeight;
    } else if (messages.length > lastLen.current) {
      const last = messages[messages.length - 1];
      if (atBottom || last.out) el.scrollTop = el.scrollHeight;
      else setNewCount((n) => n + (messages.length - lastLen.current));
    }
    lastLen.current = messages.length;
  }, [messages, dividerK, atBottom]);

  useEffect(() => {
    if (!highlight) return;
    if (!flash(highlight)) toast('That message isn’t on this device anymore.');
    setApp({ highlight: null });
  }, [highlight]);

  const onScroll = () => {
    const el = box.current!;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAtBottom(bottom);
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
        {messages.map((m, i) => {
          const day = fmtDay(m.ts);
          const showDay = day !== lastDay;
          lastDay = day;
          const prev = messages[i - 1];
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
              <MessageBubble m={m} me={me} peerName={peerName} first={first}
                selecting={!!selection} selected={selected.has(m.k)} pinned={pinned.has(m.k)} />
            </Fragment>
          );
        })}
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

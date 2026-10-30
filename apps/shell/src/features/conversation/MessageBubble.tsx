import { memo, useEffect, useRef, useState } from 'react';
import { Check, Forward, Reply } from 'lucide-react';
import { senderOf } from '../../lib/controls';
import { emojiOnly } from '../../lib/emoji';
import { groupIdOf, isGroup, type Msg } from '../../lib/types';
import { cn, isTouch } from '@sanga/ui/utils';
import { setApp, useApp } from '../../state/app';
import { setChatUi, startReply } from './chatUi';
import { useMemberName } from './useMemberName';
import { Album } from './message-bubble/Album';
import { Body } from './message-bubble/Body';
import { Meta } from './message-bubble/Meta';
import { Quote } from './message-bubble/Quote';
import { Reactions } from './message-bubble/Reactions';
import { DesktopMenu } from './message-bubble/DesktopMenu';

interface Props {
  m: Msg;
  me: string;
  peerName: string;
  first: boolean;      // first in a run from the same sender: a bit more space above
  selecting: boolean;
  selected: boolean;
  pinned: boolean;
  hidden?: boolean;    // privacy screen: blurred until hovered or tapped
  album?: Msg[];       // photos sent together (m is the last): shown as one grid
}

// In groups, everyone's name gets its own steady colour, like WhatsApp.
const nameHue = (u: string) => { let h = 0; for (const ch of u) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; };

export const MessageBubble = memo(function MessageBubble({ m, me, peerName, first, selecting, selected, pinned, hidden, album }: Props) {
  const group = useApp((s) => (isGroup(m.peer) ? s.groups[groupIdOf(m.peer)] : undefined));
  const memberName = useMemberName();
  const from = senderOf(m);
  const showSender = isGroup(m.peer) && !m.out && first;
  const row = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [peek, setPeek] = useState(false); // privacy screen: tapped to read for a few seconds
  const peekTimer = useRef(0);
  useEffect(() => () => clearTimeout(peekTimer.current), []);
  const press = useRef<{ timer: number; x: number; y: number; dx: number; horizontal: boolean | null; long: boolean } | null>(null);
  const emoji = m.type === 'text' ? emojiOnly(m.text || '') : null; // big and animated, replies too
  const bare = (!!emoji && !m.re) || m.type === 'sticker'; // big emoji and stickers: no bubble, like WhatsApp (a reply keeps it, for the quote)
  const deleted = m.type === 'deleted';

  // ---- touch: long-press opens the action sheet, swipe right replies ----
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 1) return;
    const t = e.touches[0];
    const p = { timer: 0, x: t.clientX, y: t.clientY, dx: 0, horizontal: null as boolean | null, long: false };
    p.timer = window.setTimeout(() => {
      p.long = true;
      navigator.vibrate?.(12);
      if (selecting) toggleSelect();
      else setChatUi({ sheet: m, sheetAlbum: album || null });
    }, 450);
    press.current = p;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const p = press.current;
    if (!p) return;
    const t = e.touches[0];
    const mx = t.clientX - p.x, my = t.clientY - p.y;
    if (Math.abs(mx) > 8 || Math.abs(my) > 8) clearTimeout(p.timer);
    if (p.horizontal === null && (Math.abs(mx) > 10 || Math.abs(my) > 10)) {
      p.horizontal = !selecting && !deleted && mx > 0 && Math.abs(mx) > Math.abs(my) * 1.5;
    }
    if (!p.horizontal || !row.current) return;
    p.dx = Math.min(Math.max(mx, 0), 90);
    row.current.style.transition = 'none';
    row.current.style.transform = `translateX(${p.dx}px)`;
    row.current.dataset.ready = String(p.dx > 60);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const p = press.current;
    if (!p) return;
    clearTimeout(p.timer);
    // After a long-press, cancel the click the browser would fire when the finger lifts:
    // it would land on the sheet that just opened under the finger.
    if (p.long && e.cancelable) e.preventDefault();
    if (p.horizontal && p.dx > 60) {
      startReply(m); // focuses the message box during the swipe, so the keyboard opens
      if (e.cancelable) e.preventDefault(); // no click afterwards that would take focus away
    }
    if (row.current) { row.current.style.transition = ''; row.current.style.transform = ''; delete row.current.dataset.ready; }
    press.current = null;
  };

  function toggleSelect() {
    setApp((s) => {
      const sel = s.selection || [];
      const ks = album ? album.map((x) => x.k) : [m.k]; // an album is selected as a whole
      const next = ks.every((k) => sel.includes(k)) ? sel.filter((k) => !ks.includes(k)) : [...new Set([...sel, ...ks])];
      return { selection: next.length ? next : null };
    });
  }

  const onClick = (e: React.MouseEvent) => {
    if (press.current?.long) return;
    // Capture phase: while selecting, a tap on a link, photo or file inside selects the message instead
    if (selecting) { e.preventDefault(); e.stopPropagation(); toggleSelect(); return; }
    // Privacy screen: the first tap on a blurred message shows it (and doesn't open what's inside)
    if (hidden && !peek && !document.documentElement.hasAttribute('data-peek-all') && !matchMedia('(hover: hover)').matches) {
      e.preventDefault(); e.stopPropagation();
      setPeek(true);
      clearTimeout(peekTimer.current);
      peekTimer.current = window.setTimeout(() => setPeek(false), 6000);
    }
  };

  return (
    <div
      ref={row}
      data-k={m.k}
      data-keys={album ? album.map((x) => x.k).join(' ') : undefined}
      data-peek={peek || undefined}
      className={cn('group relative flex touch-pan-y items-end gap-2 px-3 transition-transform md:px-[6%] pointer-coarse:select-none pointer-coarse:[-webkit-touch-callout:none]', first ? 'mt-2' : 'mt-0.5',
        m.out ? 'justify-end' : 'justify-start', selected && 'bg-accent/10', selecting && 'cursor-pointer', hidden && 'priv-scope')}
      onClickCapture={onClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onContextMenu={(e) => {
        e.preventDefault(); // phones: no native text menu fighting the long-press
        if (!isTouch() && !selecting) setMenuOpen(true);
      }}
    >
      {/* reply arrow revealed while swiping */}
      <span className="pointer-events-none absolute top-1/2 -left-9 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-panel text-muted opacity-0 shadow-bubble transition group-data-[ready=true]:scale-110 group-data-[ready=true]:opacity-100 group-data-[ready=false]:opacity-50">
        <Reply className="size-4" />
      </span>

      {selecting && (
        <span className={cn('mb-2 grid size-5 shrink-0 place-items-center rounded-full border-2', m.out && 'order-first mr-auto',
          selected ? 'border-accent bg-accent text-white' : 'border-muted')}>
          {selected && <Check className="size-3" strokeWidth={3} />}
        </span>
      )}

      <div className={cn('relative flex max-w-[85%] flex-col md:max-w-[65%]', m.out ? 'items-end' : 'items-start', hidden && 'priv')}>
        <div className={cn(
          'relative min-w-0 text-[0.95rem] leading-snug',
          bare ? 'px-0' : 'rounded-2xl px-2.5 pt-1.5 pb-1 shadow-bubble',
          !bare && (m.out ? 'rounded-br-md bg-bubble-out' : 'rounded-bl-md bg-bubble-in'),
          (m.type === 'img' || m.type === 'gif') && 'p-1',
        )}>
          {!selecting && !deleted && !isTouch() && (
            <DesktopMenu m={m} album={album} open={menuOpen} onOpenChange={setMenuOpen} bare={bare} />
          )}
          {showSender && (
            <div className="px-0.5 pb-0.5 text-[13px] font-semibold" style={{ color: `hsl(${nameHue(from)} 55% 45%)` }}>{memberName(from, group)}</div>
          )}
          {m.fwd && <div className="flex items-center gap-1 px-0.5 text-xs text-muted italic"><Forward className="size-3" /> Forwarded</div>}
          {m.re && <Quote re={m.re} me={me} peerName={isGroup(m.peer) ? memberName(m.re.f, group) : peerName} />}
          {album ? <Album album={album} /> : <Body m={m} emoji={emoji} me={me} members={group?.members.map((x) => x.u)} />}
          <Meta m={m} pinned={pinned} bare={bare} {...(album && { onPhoto: !album.some((x) => x.text) })} />
        </div>
        {m.reacts && Object.keys(m.reacts).length > 0 && <Reactions m={m} me={me} />}
      </div>
    </div>
  );
});

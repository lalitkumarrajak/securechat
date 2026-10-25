import { memo, useRef, useState } from 'react';
import * as M from '@radix-ui/react-dropdown-menu';
import { Ban, Check, ChevronDown, Copy, Forward, Info, Lock, Pencil, Pin, Reply, RotateCcw, SmilePlus, SquareCheck, Trash2 } from 'lucide-react';
import { Ticks } from '../../components/Ticks';
import { reactionSummary } from '../../lib/controls';
import { emojiOnly, QUICK_REACTIONS } from '../../lib/emoji';
import { fmtClock } from '../../lib/format';
import type { Msg } from '../../lib/types';
import { cn, isTouch } from '../../lib/utils';
import { setApp } from '../../state/app';
import { BigEmoji } from './BigEmoji';
import { VoicePlayer } from './VoicePlayer';
import { actionsFor, canReact, myReaction, reactTo, setChatUi, startReply, type Action } from './chatUi';

export const ICONS: Record<string, React.ReactNode> = {
  retry: <RotateCcw />, reply: <Reply />, copy: <Copy />, forward: <Forward />, pin: <Pin />, edit: <Pencil />,
  select: <SquareCheck />, info: <Info />, delete: <Trash2 />,
};

interface Props {
  m: Msg;
  me: string;
  peerName: string;
  first: boolean;      // first in a run from the same sender: a bit more space above
  selecting: boolean;
  selected: boolean;
  pinned: boolean;
}

export const MessageBubble = memo(function MessageBubble({ m, me, peerName, first, selecting, selected, pinned }: Props) {
  const row = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const press = useRef<{ timer: number; x: number; y: number; dx: number; horizontal: boolean | null; long: boolean } | null>(null);
  const emoji = m.type === 'text' && !m.re ? emojiOnly(m.text || '') : null;
  const bare = !!emoji; // big emoji: no bubble background, like WhatsApp
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
      else setChatUi({ sheet: m });
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
      const next = sel.includes(m.k) ? sel.filter((k) => k !== m.k) : [...sel, m.k];
      return { selection: next.length ? next : null };
    });
  }

  const onClick = (e: React.MouseEvent) => {
    if (press.current?.long) return;
    if (selecting) { e.preventDefault(); toggleSelect(); }
  };

  return (
    <div
      ref={row}
      data-k={m.k}
      className={cn('group relative flex items-end gap-2 px-3 transition-transform md:px-[6%] pointer-coarse:select-none pointer-coarse:[-webkit-touch-callout:none]', first ? 'mt-2' : 'mt-0.5',
        m.out ? 'justify-end' : 'justify-start', selected && 'bg-accent/10', selecting && 'cursor-pointer')}
      onClick={onClick}
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

      <div className={cn('relative flex max-w-[85%] flex-col md:max-w-[65%]', m.out ? 'items-end' : 'items-start')}>
        <div className={cn(
          'relative min-w-0 text-[0.95rem] leading-snug',
          bare ? 'px-0' : 'rounded-2xl px-2.5 pt-1.5 pb-1 shadow-bubble',
          !bare && (m.out ? 'rounded-br-md bg-bubble-out' : 'rounded-bl-md bg-bubble-in'),
          m.type === 'img' && 'p-1',
        )}>
          {!selecting && !deleted && !isTouch() && (
            <DesktopMenu m={m} open={menuOpen} onOpenChange={setMenuOpen} bare={bare} />
          )}
          {m.fwd && <div className="flex items-center gap-1 px-0.5 text-xs text-muted italic"><Forward className="size-3" /> Forwarded</div>}
          {m.re && <Quote re={m.re} me={me} peerName={peerName} />}
          <Body m={m} emoji={emoji} />
          <Meta m={m} pinned={pinned} bare={bare} />
        </div>
        {m.reacts && Object.keys(m.reacts).length > 0 && <Reactions m={m} me={me} />}
      </div>
    </div>
  );
});

function Body({ m, emoji }: { m: Msg; emoji: string[] | null }) {
  if (m.type === 'deleted') {
    return <span className="flex items-center gap-1.5 pr-14 text-muted italic"><Ban className="size-4" /> {m.out ? 'You deleted this message' : 'This message was deleted'}</span>;
  }
  if (m.type === 'err') return <span className="flex items-center gap-1.5 pr-14 text-muted italic"><Lock className="size-4" /> This message couldn’t be decrypted</span>;
  if (emoji) return <BigEmoji parts={emoji} />;
  if (m.type === 'img') {
    return (
      <>
        <button className="block" onClick={(e) => { e.stopPropagation(); setChatUi({ viewer: m.src! }); }} aria-label="View photo">
          <img src={m.src} alt="Photo" loading="lazy" width={m.w || undefined} height={m.h || undefined}
            className="block h-auto max-h-80 w-auto max-w-[min(300px,70vw)] rounded-xl object-cover" />
        </button>
        {m.text && <p className="px-1.5 pt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{m.text}</p>}
      </>
    );
  }
  if (m.type === 'voice') return <VoicePlayer src={m.src!} dur={m.dur || 0} peaks={m.peaks || []} out={m.out} />;
  return <span className="whitespace-pre-wrap [overflow-wrap:anywhere]"><Linkify text={m.text || ''} /></span>;
}

// Links become clickable; everything is still rendered as text (never as HTML).
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])/g);
  return <>{parts.map((p, i) => (i % 2 ? <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="text-accent-ink underline underline-offset-2" onClick={(e) => e.stopPropagation()}>{p}</a> : p))}</>;
}

function Meta({ m, pinned, bare }: { m: Msg; pinned: boolean; bare: boolean }) {
  return (
    <span className={cn('float-right ml-2 flex translate-y-1 items-center gap-1 text-[11px] text-muted select-none',
      m.type === 'img' && !m.text && 'absolute right-2 bottom-2 translate-y-0 rounded-full bg-black/45 px-1.5 py-0.5 text-white',
      m.type === 'voice' && 'float-none -mt-1 justify-end',
      bare && 'float-none mt-1 justify-end rounded-full bg-bubble-in px-2 py-0.5 shadow-bubble')}>
      {pinned && <Pin className="size-3" aria-label="Pinned" />}
      {m.edited && m.type === 'text' && <span>edited</span>}
      <time dateTime={new Date(m.ts).toISOString()}>{fmtClock(m.ts)}</time>
      {m.out && m.type !== 'deleted' && <Ticks s={m.s} className="size-[15px]" />}
    </span>
  );
}

function Quote({ re, me, peerName }: { re: NonNullable<Msg['re']>; me: string; peerName: string }) {
  const jump = (e: React.MouseEvent) => { e.stopPropagation(); setApp({ highlight: re.f + '/' + re.c }); };
  return (
    <button onClick={jump} className="mb-1 block w-full min-w-40 rounded-lg border-l-4 border-accent bg-ink/5 px-2 py-1 text-left text-sm">
      <span className="block text-xs font-semibold text-accent-ink">{re.f === me ? 'You' : peerName}</span>
      <span className="line-clamp-2 text-muted [overflow-wrap:anywhere]">{re.p}</span>
    </button>
  );
}

function Reactions({ m, me }: { m: Msg; me: string }) {
  const summary = reactionSummary(m.reacts, me);
  return (
    <div className={cn('-mt-1.5 z-10 flex gap-1', m.out ? 'mr-2' : 'ml-2')}>
      {summary.map(({ e, n, mine }) => (
        <button key={e} onClick={(ev) => { ev.stopPropagation(); reactTo(m, e); }}
          title={mine ? 'Tap to remove your reaction' : 'React with ' + e}
          className={cn('flex h-6 items-center gap-0.5 rounded-full border bg-panel px-1.5 text-sm shadow-bubble',
            mine ? 'border-accent/60' : 'border-line')}>
          <span>{e}</span>{n > 1 && <span className="text-xs text-muted">{n}</span>}
        </button>
      ))}
    </div>
  );
}

/** Hover chevron (and right-click) menu on desktop, with quick reactions on top. */
function DesktopMenu({ m, open, onOpenChange, bare }: { m: Msg; open: boolean; onOpenChange: (o: boolean) => void; bare: boolean }) {
  const actions = actionsFor(m);
  return (
    <M.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <M.Trigger asChild>
        <button aria-label="Message options" onClick={(e) => e.stopPropagation()}
          className={cn('absolute top-1 right-1 z-10 grid size-6 place-items-center rounded-full text-muted opacity-0 transition group-hover:opacity-100 data-[state=open]:opacity-100',
            bare ? 'bg-panel shadow-bubble' : m.out ? 'bg-bubble-out' : 'bg-bubble-in')}>
          <ChevronDown className="size-4" />
        </button>
      </M.Trigger>
      <M.Portal>
        <M.Content align={m.out ? 'end' : 'start'} sideOffset={4} collisionPadding={8}
          onCloseAutoFocus={(e) => e.preventDefault()} // keep focus in the message box after Reply/Edit
          className="z-50 w-56 rounded-xl border border-line bg-panel p-1 text-ink shadow-xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
          {canReact(m) && (
            <div className="flex items-center justify-between gap-0.5 border-b border-line px-1 pt-1 pb-2">
              {QUICK_REACTIONS.map((e) => (
                <M.Item key={e} onSelect={() => reactTo(m, e)} aria-label={'React ' + e}
                  className={cn('grid size-8 cursor-pointer place-items-center rounded-full text-xl outline-none transition data-[highlighted]:scale-125 data-[highlighted]:bg-hover',
                    myReaction(m) === e && 'bg-accent/15')}>
                  {e}
                </M.Item>
              ))}
              <M.Item onSelect={() => setChatUi({ picker: m })} aria-label="More reactions"
                className="grid size-8 cursor-pointer place-items-center rounded-full text-muted outline-none data-[highlighted]:bg-hover">
                <SmilePlus className="size-5" />
              </M.Item>
            </div>
          )}
          <div className="pt-1">
            {actions.map((a) => <ActionItem key={a.key} a={a} />)}
          </div>
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}

function ActionItem({ a }: { a: Action }) {
  return (
    <M.Item onSelect={a.run}
      className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-hover [&_svg]:size-[18px]',
        a.danger ? 'text-danger' : '[&_svg]:text-muted')}>
      {ICONS[a.key]}{a.label}
    </M.Item>
  );
}

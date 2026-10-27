import { memo, useEffect, useRef, useState } from 'react';
import * as M from '@radix-ui/react-dropdown-menu';
import { Ban, Check, ChevronDown, Copy, Download, Forward, Info, Lock, Pencil, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Pin, Reply, RotateCcw, SmilePlus, SquareCheck, Trash2, Video } from 'lucide-react';
import { Ticks } from '../../components/Ticks';
import { reactionSummary } from '../../lib/controls';
import { emojiOnly, QUICK_REACTIONS } from '../../lib/emoji';
import { fmtClock, fmtDuration } from '../../lib/format';
import { callText } from '../../lib/engine';
import { startCall } from '../../lib/calls';
import { groupIdOf, isGroup, type Group, type Msg } from '../../lib/types';
import { senderOf } from '../../lib/controls';
import { splitMentions } from '../../lib/mentions';
import { cn, isTouch } from '../../lib/utils';
import { setApp, useApp } from '../../state/app';
import { BigEmoji, Emoji } from './BigEmoji';
import { FileCard, LinkPreviewCard, LocationCard } from './Attachments';
import { VoicePlayer } from './VoicePlayer';
import { actionsFor, canReact, myReaction, openGallery, reactTo, setChatUi, startReply, type Action } from './chatUi';

export const ICONS: Record<string, React.ReactNode> = {
  retry: <RotateCcw />, reply: <Reply />, copy: <Copy />, save: <Download />, forward: <Forward />, pin: <Pin />, edit: <Pencil />,
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
  hidden?: boolean;    // privacy screen: blurred until hovered or tapped
  album?: Msg[];       // photos sent together (m is the last): shown as one grid
}

// In groups, everyone's name gets its own steady colour, like WhatsApp.
const nameHue = (u: string) => { let h = 0; for (const ch of u) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; };

/** Display name of a group member (or friend) as I know them. */
export function useMemberName() {
  const friends = useApp((s) => s.friends);
  return (u: string, g?: Group, me?: string) => (u === me ? 'You' : friends[u]?.name || g?.members.find((x) => x.u === u)?.n || u);
}

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
  const emoji = m.type === 'text' && !m.re ? emojiOnly(m.text || '') : null;
  const bare = !!emoji || m.type === 'sticker'; // big emoji and stickers: no bubble, like WhatsApp
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

/** Photos sent together: a grid of up to four, the last showing "+N" for the rest, like WhatsApp. */
function Album({ album }: { album: Msg[] }) {
  const shown = album.slice(0, 4);
  const more = album.length - shown.length;
  const caption = album.findLast((x) => x.text)?.text;
  return (
    <>
      <div className={cn('grid w-[min(280px,68vw)] gap-1', shown.length > 1 && 'grid-cols-2')} role="group" aria-label={`${album.length} photos`}>
        {shown.map((x, n) => (
          <button key={x.k} onClick={(e) => { e.stopPropagation(); openGallery(x); }} aria-label={`View photo ${n + 1} of ${album.length}`}
            className={cn('relative block aspect-square overflow-hidden rounded-xl bg-panel-2', shown.length === 3 && n === 0 && 'col-span-2 aspect-[2/1]')}>
            <img src={x.src} alt="Photo" loading="lazy" className="size-full object-cover" />
            {more > 0 && n === 3 && <span className="absolute inset-0 grid place-items-center bg-black/50 text-2xl font-semibold text-white">+{more}</span>}
          </button>
        ))}
      </div>
      {caption && <p className="px-1.5 pt-1 whitespace-pre-wrap [overflow-wrap:anywhere]"><Marked text={caption} /></p>}
    </>
  );
}

function Body({ m, emoji, me, members }: { m: Msg; emoji: string[] | null; me: string; members?: string[] }) {
  if (m.type === 'deleted') {
    return <span className="flex items-center gap-1.5 pr-14 text-muted italic"><Ban className="size-4" /> {m.out ? 'You deleted this message' : 'This message was deleted'}</span>;
  }
  if (m.type === 'err') {
    return (
      <span className="flex items-center gap-1.5 pr-14 text-muted italic"><Lock className="size-4" />
        {m.pending ? 'Waiting for this message. It appears once the sender’s phone is online.' : 'This message couldn’t be decrypted'}
      </span>
    );
  }
  if (emoji) return <BigEmoji parts={emoji} />;
  if (m.type === 'img') {
    return (
      <>
        <button className="block" onClick={(e) => { e.stopPropagation(); openGallery(m); }} aria-label="View photo">
          <img src={m.src} alt="Photo" loading="lazy" width={m.w || undefined} height={m.h || undefined}
            className="block h-auto max-h-80 w-auto max-w-[min(300px,70vw)] rounded-xl object-cover" />
        </button>
        {m.text && <p className="px-1.5 pt-1 whitespace-pre-wrap [overflow-wrap:anywhere]"><Marked text={m.text} /></p>}
      </>
    );
  }
  if (m.type === 'sticker') {
    // Built-in stickers animate once (tap to replay); KLIPY stickers are animated images.
    if (m.src!.startsWith('noto:')) return <Emoji e={m.src!.slice(5)} size={128} />;
    return <img src={m.src} alt="Sticker" loading="lazy" referrerPolicy="no-referrer" className="block size-36 object-contain" />;
  }
  if (m.type === 'gif') {
    return (
      <span className="relative block">
        <img src={m.src} alt="GIF" loading="lazy" referrerPolicy="no-referrer" width={m.w || undefined} height={m.h || undefined}
          className="block h-auto max-h-72 w-auto max-w-[min(260px,65vw)] rounded-xl bg-panel-2 object-cover" />
        <span className="absolute top-1.5 left-1.5 rounded bg-black/50 px-1 text-[10px] font-bold text-white">GIF</span>
      </span>
    );
  }
  if (m.type === 'call' && m.call) return <CallCard m={m} />;
  if (m.type === 'file') return <FileCard m={m} />;
  if (m.type === 'location') return <LocationCard m={m} />;
  if (m.type === 'voice') return <VoicePlayer src={m.src!} dur={m.dur || 0} peaks={m.peaks || []} out={m.out} />;
  return (
    <>
      {m.lp && <LinkPreviewCard lp={m.lp} out={m.out} />}
      <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">
        {members ? splitMentions(m.text || '', members).map((part, i) => part.u ? (
          <span key={i} className={cn('font-semibold', part.u === me ? 'rounded bg-amber-300/80 px-0.5 text-amber-950' : 'text-accent-ink')}>{part.t}</span>
        ) : <Linkify key={i} text={part.t} />) : <Linkify text={m.text || ''} />}
      </span>
    </>
  );
}

// Links become clickable; everything is still rendered as text (never as HTML).
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])/g);
  return <>{parts.map((p, i) => (i % 2 ? <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="text-accent-ink underline underline-offset-2" onClick={(e) => e.stopPropagation()}><Marked text={p} /></a> : <Marked key={i} text={p} />))}</>;
}

/** While searching in the chat, the words you searched for are highlighted. */
function Marked({ text }: { text: string }) {
  const q = useApp((s) => (s.searchOpen ? s.searchQuery.trim().toLowerCase() : ''));
  if (!q || !text.toLowerCase().includes(q)) return <>{text}</>;
  const out: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  let at = 0;
  for (let i = lower.indexOf(q); i !== -1; i = lower.indexOf(q, at)) {
    out.push(text.slice(at, i), <mark key={i} className="rounded-sm bg-amber-300 px-px text-amber-950">{text.slice(i, i + q.length)}</mark>);
    at = i + q.length;
  }
  out.push(text.slice(at));
  return <>{out}</>;
}

function Meta({ m, pinned, bare, onPhoto = (m.type === 'img' && !m.text) || m.type === 'gif' }: { m: Msg; pinned: boolean; bare: boolean; onPhoto?: boolean }) {
  return (
    <span className={cn('float-right ml-2 flex translate-y-1 items-center gap-1 text-[11px] text-muted select-none',
      onPhoto && 'absolute right-2 bottom-2 translate-y-0 rounded-full bg-black/45 px-1.5 py-0.5 text-white',
      (m.type === 'voice' || m.type === 'file' || m.type === 'location') && 'float-none mt-1 justify-end translate-y-0',
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
function DesktopMenu({ m, album, open, onOpenChange, bare }: { m: Msg; album?: Msg[]; open: boolean; onOpenChange: (o: boolean) => void; bare: boolean }) {
  const actions = actionsFor(m, album);
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
    <M.Item onSelect={a.run} disabled={a.disabled}
      className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-hover data-[disabled]:cursor-default data-[disabled]:opacity-45 [&_svg]:size-[18px]',
        a.danger ? 'text-danger' : '[&_svg]:text-muted')}>
      {ICONS[a.key]}
      <span>{a.label}{a.hint && <span className="block text-xs text-muted">{a.hint}</span>}</span>
    </M.Item>
  );
}

/** A call in the chat: "Missed voice call", "Outgoing video call · 3:24", with a button to call back. */
function CallCard({ m }: { m: Msg }) {
  const c = m.call!;
  const missed = !m.out && c.st !== 'ok';
  const Icon = c.v ? Video : m.out ? PhoneOutgoing : missed ? PhoneMissed : PhoneIncoming;
  return (
    <span className="flex items-center gap-3 pr-12">
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', missed ? 'bg-danger/12 text-danger' : 'bg-accent/12 text-accent-ink')}><Icon className="size-[18px]" /></span>
      <span className="min-w-0">
        <span className="block font-medium">{callText(c, m.out)}</span>
        <span className="block text-xs text-muted">{c.st === 'ok' ? fmtDuration(c.dur) : missed ? 'Tap to call back' : ' '}</span>
      </span>
      {!isGroup(m.peer) && (
        <button onClick={(e) => { e.stopPropagation(); void startCall(m.peer, c.v); }} aria-label={`Call back${c.v ? ' (video)' : ''}`}
          className="ml-1 grid size-9 shrink-0 place-items-center rounded-full text-accent-ink hover:bg-hover">
          {c.v ? <Video className="size-5" /> : <Phone className="size-5" />}
        </button>
      )}
    </span>
  );
}

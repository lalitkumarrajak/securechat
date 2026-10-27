// Stories full screen: each plays for a few seconds, then the next, then the next friend's.
// Tap the right side for the next one, the left for the one before; hold to pause; swipe down to close.
// Friends' stories can be liked and commented on; on your own you see who viewed, liked and commented.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as D from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Eye, Heart, ImagePlus, MoreVertical, Pause, Play, Send, Trash2, X } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { Spinner } from '@sanga/ui/button';
import { confirm } from '@sanga/ui/confirm';
import { Dialog } from '@sanga/ui/dialog';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@sanga/ui/menu';
import { myName } from '../../lib/engine';
import { fmtAgo } from '@sanga/ui/format';
import { BACKGROUNDS, closeStories, commentOn, deleteComment, deleteStory, likeStory, loadStory, markSeen, openComposer, storyActivity, useStories,
  type StoryActivity, type StoryContent, type StoryMeta } from '../../lib/stories';
import { displayName } from '../../lib/types';
import { cn } from '@sanga/ui/utils';
import { useApp } from '../../state/app';
import { showProfile } from '../friends/ProfileCard';

const PHOTO_MS = 6000;
const textMs = (t: string) => Math.min(12000, 4000 + t.length * 40);

export function StoryViewer() {
  const open = useStories((s) => !!s.viewer);
  return (
    <D.Root open={open} onOpenChange={(o) => !o && closeStories()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black animate-fade-in" />
        <D.Content className="fixed inset-0 z-50 flex justify-center bg-black text-white outline-none" aria-describedby={undefined}>
          <D.Title className="sr-only">Stories</D.Title>
          {open && <Player />}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

function Player() {
  const v = useStories((s) => s.viewer)!;
  const list = useStories((s) => s.list);
  const friends = useApp((s) => s.friends);
  const me = myName();
  const owner = v.owners[v.oi];
  const stories = useMemo(() => list.filter((s) => s.u === owner), [list, owner]);
  const si = Math.min(v.si, stories.length - 1);
  const s: StoryMeta | undefined = stories[si];
  const content = useStories((st) => (s ? st.content[s.id] : undefined));
  const mine = owner === me;
  const name = mine ? 'Your story' : displayName(friends[owner], owner);

  const [held, setHeld] = useState(false);
  const [stopped, setStopped] = useState(false); // the pause button
  const [typing, setTyping] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [menu, setMenu] = useState(false);
  const [hidden, setHidden] = useState(document.visibilityState !== 'visible');
  useEffect(() => {
    const f = () => setHidden(document.visibilityState !== 'visible');
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, []);

  // Nothing left of this person's stories (deleted while watching): on to the next person.
  useEffect(() => { if (!s) go(1); }, [s]); // eslint-disable-line react-hooks/exhaustive-deps

  function go(dir: 1 | -1) {
    const st = useStories.getState();
    const cur = st.viewer;
    if (!cur) return;
    const n = st.list.filter((x) => x.u === cur.owners[cur.oi]).length;
    if (dir === 1 && cur.si + 1 < n) return useStories.setState({ viewer: { ...cur, si: cur.si + 1 } });
    if (dir === -1 && cur.si > 0) return useStories.setState({ viewer: { ...cur, si: cur.si - 1 } });
    const oi = cur.oi + dir;
    if (oi < 0) return useStories.setState({ viewer: { ...cur, si: 0 } });
    if (oi >= cur.owners.length) return closeStories();
    const next = st.list.filter((x) => x.u === cur.owners[oi]);
    useStories.setState({ viewer: { ...cur, oi, si: dir === 1 ? Math.max(0, next.findIndex((x) => !x.seen)) : 0 } });
  }

  // Load this story and the next one.
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!s) return;
    setFailed(false);
    loadStory(s).catch(() => setFailed(true));
    const after = stories[si + 1];
    if (after) loadStory(after).catch(() => {});
  }, [s?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = !!content && content !== 'err';
  useEffect(() => { if (s && ready) markSeen(s); }, [s?.id, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // The progress bar: runs while the story is on screen and nothing pauses it.
  const paused = held || stopped || typing || sheet || menu || hidden || !ready;
  const duration = ready ? (content.type === 'text' ? textMs(content.text) : PHOTO_MS) : PHOTO_MS;
  const bar = useRef<HTMLSpanElement>(null);
  const elapsed = useRef(0);
  useEffect(() => { elapsed.current = 0; if (bar.current) bar.current.style.transform = 'scaleX(0)'; }, [s?.id]);
  useEffect(() => {
    if (paused) return;
    let last = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      elapsed.current += t - last;
      last = t;
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, elapsed.current / duration)})`;
      if (elapsed.current >= duration) { go(1); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, duration, s?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tap left or right, hold to pause, swipe down to close.
  const press = useRef<{ x: number; y: number; t: number; timer: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    press.current = { x: e.clientX, y: e.clientY, t: Date.now(), timer: window.setTimeout(() => setHeld(true), 220) };
  };
  const onUp = (e: React.PointerEvent) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    clearTimeout(p.timer);
    setHeld(false);
    if (e.clientY - p.y > 90) return closeStories();
    if (Date.now() - p.t > 220 || Math.abs(e.clientX - p.x) > 30) return;
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    go(e.clientX - box.left < box.width * 0.3 ? -1 : 1);
  };
  const onCancel = () => { if (press.current) clearTimeout(press.current.timer); press.current = null; setHeld(false); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return null;
  const c = ready ? content as StoryContent : null;
  const tagged = c?.tags?.includes(me) && !mine;

  return (
    <div className="relative flex h-full w-full max-w-[min(100vw,calc(100dvh*0.5625+120px))] flex-col select-none">
      {/* progress, who and when */}
      <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-6">
        <div className="flex gap-1" aria-hidden data-testid="story-progress">
          {stories.map((x, i) => (
            <span key={x.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35">
              <span ref={i === si ? bar : undefined} className="block h-full origin-left bg-white"
                style={{ transform: `scaleX(${i < si ? 1 : 0})` }} />
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          <button onClick={() => !mine && showProfile(owner)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" aria-label={`${name}’s profile`}>
            <Avatar u={owner} name={name} size={36} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{name}</span>
              <span className="block truncate text-xs text-white/75">
                {fmtAgo(s.ts)}{c?.via ? ` · from ${c.via === me ? 'your story' : displayName(friends[c.via], c.via) + '’s story'}` : ''}
              </span>
            </span>
          </button>
          {held && <span className="text-xs text-white/75">Paused</span>}
          <button onClick={() => setStopped(!stopped)} aria-label={stopped ? 'Play' : 'Pause'} className="grid size-10 place-items-center rounded-full hover:bg-white/10">
            {stopped ? <Play className="size-5" /> : <Pause className="size-5" />}
          </button>
          {mine && (
            <Menu onOpenChange={setMenu}>
              <MenuTrigger asChild>
                <button aria-label="Story options" className="grid size-10 place-items-center rounded-full hover:bg-white/10"><MoreVertical className="size-5" /></button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem icon={<Trash2 />} danger onSelect={async () => {
                  setMenu(true);
                  const ok = await confirm({ title: 'Delete this story?', description: 'It’s removed for everyone who could see it, with its likes and comments.', confirmText: 'Delete', destructive: true });
                  setMenu(false);
                  if (ok) deleteStory(s.id).then(() => toast('Story deleted')).catch((e) => toast.error(e.message));
                }}>Delete story</MenuItem>
              </MenuContent>
            </Menu>
          )}
          <D.Close aria-label="Close stories" className="grid size-10 place-items-center rounded-full hover:bg-white/10"><X className="size-6" /></D.Close>
        </div>
      </div>

      {/* the story; tapping it moves through them */}
      <div className="relative min-h-0 flex-1 touch-none" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onCancel} onPointerLeave={onCancel}
        onContextMenu={(e) => e.preventDefault()} data-testid="story">
        {!content ? (
          <div className="grid h-full place-items-center">{failed ? <p className="text-sm text-white/75">No connection. Tap to try the next one.</p> : <Spinner />}</div>
        ) : content === 'err' ? (
          <div className="grid h-full place-items-center px-8 text-center text-sm text-white/75">This story can’t be opened on this device.</div>
        ) : content.type === 'img' ? (
          <div className="grid h-full place-items-center">
            <img src={content.src} alt={content.text || `${name}’s photo`} className="max-h-full max-w-full object-contain" draggable={false} />
            {content.text && (
              <p className="absolute inset-x-0 bottom-4 mx-auto w-fit max-w-[90%] rounded-xl bg-black/55 px-3 py-2 text-center text-[15px] whitespace-pre-wrap">{content.text}</p>
            )}
          </div>
        ) : (
          <div className="grid h-full place-items-center p-8" style={{ background: BACKGROUNDS[content.bg] }}>
            <p className={cn('text-center font-semibold whitespace-pre-wrap break-words', content.text.length > 160 ? 'text-xl' : content.text.length > 60 ? 'text-2xl' : 'text-4xl')}>
              {content.text}
            </p>
          </div>
        )}
      </div>

      {/* tags */}
      {c?.tags?.length ? (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2 text-sm">
          <span className="text-white/75">with</span>
          {c.tags.map((t) => (
            <button key={t} onClick={() => t !== me && showProfile(t)} className="rounded-full bg-white/15 px-2.5 py-0.5 font-medium">
              {t === me ? 'you' : displayName(friends[t], t)}
            </button>
          ))}
          {tagged && (
            <button onClick={() => { closeStories(); openComposer({ ...c, tags: [], via: owner }); }}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-semibold text-black">
              <ImagePlus className="size-4" /> Add to your story
            </button>
          )}
        </div>
      ) : null}

      <footer className="px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {mine ? (
          <button onClick={() => setSheet(true)} className="flex items-center gap-4 rounded-full px-3 py-2 text-sm hover:bg-white/10" aria-label="Viewers, likes and comments">
            <span className="inline-flex items-center gap-1.5"><Eye className="size-5" />{s.views ?? 0}</span>
            <span className="inline-flex items-center gap-1.5"><Heart className="size-5" />{s.likes ?? 0}</span>
            <span className="text-white/75">Activity</span>
          </button>
        ) : (
          <ReplyBar s={s} name={name} onTyping={setTyping} />
        )}
      </footer>
      {sheet && <ActivitySheet s={s} onClose={() => setSheet(false)} />}
    </div>
  );
}

function ReplyBar({ s, name, onTyping }: { s: StoryMeta; name: string; onTyping: (t: boolean) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setText(''), [s.id]);
  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await commentOn(s, t);
      setText('');
      toast.success(`Comment sent to ${name}`, { description: 'Only they can see it.' });
      (document.activeElement as HTMLElement | null)?.blur();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };
  return (
    <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={`Comment to ${name}…`} aria-label="Comment"
        onFocus={() => onTyping(true)} onBlur={() => onTyping(false)} enterKeyHint="send"
        className="h-11 min-w-0 flex-1 rounded-full border border-white/40 bg-transparent px-4 text-[15px] text-white outline-none placeholder:text-white/60 focus:border-white" />
      {text.trim() ? (
        <button type="submit" aria-label="Send comment" disabled={busy} className="grid size-11 place-items-center rounded-full bg-accent text-white disabled:opacity-60">
          {busy ? <Spinner /> : <Send className="size-5" />}
        </button>
      ) : (
        <button type="button" aria-label={s.liked ? 'Unlike' : 'Like'} aria-pressed={s.liked}
          onClick={() => likeStory(s, !s.liked).catch((e) => toast.error(e.message))}
          className="grid size-11 place-items-center rounded-full active:scale-90">
          <Heart className={cn('size-7 transition', s.liked && 'scale-110 fill-rose-500 text-rose-500')} />
        </button>
      )}
    </form>
  );
}

/** Your story: who viewed it (a heart if they liked it) and the comments. */
function ActivitySheet({ s, onClose }: { s: StoryMeta; onClose: () => void }) {
  const friends = useApp((st) => st.friends);
  const bump = useStories((st) => st.activity);
  const [a, setA] = useState<StoryActivity | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { storyActivity(s).then(setA, (e) => setErr(e.message)); }, [s.id, bump]); // eslint-disable-line react-hooks/exhaustive-deps
  const nameOf = (u: string) => displayName(friends[u], u);
  const remove = async (cid: string) => {
    try { await deleteComment(s, cid); setA((x) => x && { ...x, comments: x.comments.filter((c) => c.id !== cid) }); }
    catch (e) { toast.error((e as Error).message); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Story activity">
      {!a ? <div className="grid place-items-center py-8">{err ? <p className="text-sm text-muted">{err}</p> : <Spinner />}</div> : (
        <div className="space-y-5">
          <section>
            <h3 className="mb-1 text-sm font-semibold text-muted">Viewed by {a.views?.length ?? 0}</h3>
            {!a.views?.length ? <p className="py-2 text-sm text-muted">No one has seen it yet.</p> : (
              <ul>
                {a.views.map((v) => (
                  <li key={v.u} className="flex items-center gap-3 py-1.5">
                    <Avatar u={v.u} name={nameOf(v.u)} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{nameOf(v.u)}</span>
                      <span className="block text-xs text-muted">{fmtAgo(v.ts)}</span>
                    </span>
                    {v.liked && <Heart className="size-5 fill-rose-500 text-rose-500" aria-label="Liked" />}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="mb-1 text-sm font-semibold text-muted">Comments {a.comments.length ? `(${a.comments.length})` : ''}</h3>
            {!a.comments.length ? <p className="py-2 text-sm text-muted">No comments yet. Only you see the comments on your story.</p> : (
              <ul>
                {a.comments.map((c) => (
                  <li key={c.id} className="flex items-start gap-3 py-1.5">
                    <Avatar u={c.u} name={nameOf(c.u)} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm"><b className="font-semibold">{nameOf(c.u)}</b> <span className="text-xs text-muted">{fmtAgo(c.ts)}</span></span>
                      <span className="block text-sm break-words whitespace-pre-wrap">{c.text}</span>
                    </span>
                    <button onClick={() => remove(c.id)} aria-label="Delete comment" className="rounded-full p-1.5 text-muted hover:bg-hover hover:text-danger">
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Dialog>
  );
}

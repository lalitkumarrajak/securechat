import { useEffect, useMemo, useRef, useState } from 'react';
import * as D from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Eye, Heart, ImagePlus, MoreVertical, Pause, Play, Trash2, X } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { Spinner } from '@sanga/ui/button';
import { confirm } from '@sanga/ui/confirm';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@sanga/ui/menu';
import { myName } from '../../../lib/engine';
import { fmtAgo } from '@sanga/ui/format';
import { BACKGROUNDS, closeStories, deleteStory, loadStory, markSeen, openComposer, useStories, type StoryContent, type StoryMeta } from '../../../lib/stories';
import { displayName } from '../../../lib/types';
import { cn } from '@sanga/ui/utils';
import { useApp } from '../../../state/app';
import { showProfile } from '../../friends/ProfileCard';
import { ReplyBar } from './ReplyBar';
import { ActivitySheet } from './ActivitySheet';

const PHOTO_MS = 6000;

const textMs = (t: string) => Math.min(12000, 4000 + t.length * 40);

export function Player() {
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
            <img src={content.src} alt={content.text || `${name}’s photo`} className="absolute inset-0 size-full object-contain" draggable={false} />
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

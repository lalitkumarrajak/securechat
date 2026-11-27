// A chat's "Media, links and docs", like WhatsApp's: in the contact or group info, a row with how many
// there are and the latest photos; tapping it opens them all, in three tabs. Photos and videos as a
// grid by month (a photo opens full screen, a video in the chat where it plays); documents as a list
// to open or save; links with their preview, to open. Each can also be shown in the chat.
// Everything comes from this device's copy of the chat: photos are loaded only as they scroll into view.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ChevronRight, Download, ExternalLink, FileText, Image as ImageIcon, Link2, MessageSquare, Play } from 'lucide-react';
import { IconButton, Spinner } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { locale, t } from '@sanga/i18n';
import { countOfType, fileMessages, findMessage, LINK_RE, linkMessages, photoKeys } from '../../../lib/engine';
import * as db from '../../../lib/db';
import { downloadDataUrl, fileExt, fmtSize } from '../../../lib/files';
import type { Msg } from '../../../lib/types';
import { setApp } from '../../../state/app';
import { openGallery } from '../chatUi';

type Tab = 'media' | 'docs' | 'links';
const isVideo = (m: Msg) => !!m.file?.mime.startsWith('video/');
const linkOf = (m: Msg) => m.lp?.url ?? LINK_RE.exec(m.text ?? '')?.[0] ?? '';
const showInChat = (k: string) => setApp({ panel: null, highlight: k });

/** A photo's picture, read from the device only while its tile is on (or near) the screen. */
function usePhoto(k: string, on: boolean) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    if (!on) { setSrc(undefined); return; }
    let gone = false;
    void findMessage(k).then((m) => { if (!gone) setSrc(m?.src); });
    return () => { gone = true; };
  }, [k, on]);
  return src;
}
function useNear<T extends Element>(margin = '600px') {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, near] as const;
}

// ---------- the row in the contact / group info ----------
export function MediaSummary({ peer, onOpen }: { peer: string; onOpen: () => void }) {
  const [count, setCount] = useState<number | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    let gone = false;
    void (async () => {
      const [photos, files, links, keys] = await Promise.all([countOfType(peer, 'img'), countOfType(peer, 'file'), linkMessages(peer), photoKeys(peer)]);
      if (gone) return;
      setCount(photos + files + links.length);
      setRecent(keys.slice(-8).reverse());
    })().catch(() => setCount(0));
    return () => { gone = true; };
  }, [peer]);

  return (
    <section className="mt-2 bg-panel py-2">
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-6 py-2.5 text-left hover:bg-hover">
        <span className="min-w-0 flex-1 font-medium">{t('Media, links and docs')}</span>
        <span className="text-sm text-muted tabular-nums">{count ?? ''}</span>
        <ChevronRight className="size-5 text-muted" />
      </button>
      {recent.length > 0 && (
        <ul className="flex gap-2 overflow-x-auto px-6 pt-1 pb-2 [scrollbar-width:none]">
          {recent.map((k) => <Thumb key={k} k={k} peer={peer} />)}
        </ul>
      )}
    </section>
  );
}

function Thumb({ k, peer }: { k: string; peer: string }) {
  const src = usePhoto(k, true);
  return (
    <li className="shrink-0">
      <button type="button" onClick={() => openGallery({ peer, k } as Msg)} aria-label={t('Photo')}
        className="block size-20 overflow-hidden rounded-xl bg-panel-2">
        {src && <img src={src} alt="" className="size-full object-cover" draggable={false} />}
      </button>
    </li>
  );
}

// ---------- everything, in tabs ----------
export function MediaBrowser({ peer, name, onBack }: { peer: string; name: string; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('media');
  const [media, setMedia] = useState<Msg[] | null>(null);
  const [docs, setDocs] = useState<Msg[] | null>(null);
  const [links, setLinks] = useState<Msg[] | null>(null);

  useEffect(() => {
    let gone = false;
    void (async () => {
      const [photos, files, ls] = await Promise.all([db.lightOfType(peer, 'img'), fileMessages(peer), linkMessages(peer)]);
      if (gone) return;
      setMedia([...photos, ...files.filter(isVideo)].sort((a, b) => b.ts - a.ts));
      setDocs(files.filter((m) => !isVideo(m)));
      setLinks(ls);
    })();
    return () => { gone = true; };
  }, [peer]);

  const tabs: [Tab, string][] = [['media', t('Media')], ['docs', t('Docs')], ['links', t('Links')]];
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 bg-panel px-3">
        <IconButton label={t('Back')} onClick={onBack}><ArrowLeft /></IconButton>
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{name}</h2>
      </header>
      <div role="tablist" aria-label={t('Media, links and docs')} className="flex shrink-0 border-b border-line bg-panel">
        {tabs.map(([v, label]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className={cn('flex-1 border-b-2 py-3 text-sm font-semibold transition', tab === v ? 'border-accent text-accent-ink' : 'border-transparent text-muted hover:text-ink')}>
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" role="tabpanel">
        {tab === 'media' && (media == null ? <Busy /> : !media.length ? <Nothing icon={<ImageIcon />} text={t('No photos or videos in this chat yet')} /> // i18n-ok
          : <MediaGrid peer={peer} items={media} />)}
        {tab === 'docs' && (docs == null ? <Busy /> : !docs.length ? <Nothing icon={<FileText />} text={t('No documents in this chat yet')} /> // i18n-ok
          : <ByMonth items={docs} render={(m) => <DocRow key={m.k} m={m} />} list />)}
        {tab === 'links' && (links == null ? <Busy /> : !links.length ? <Nothing icon={<Link2 />} text={t('No links in this chat yet')} /> // i18n-ok
          : <ByMonth items={links} render={(m) => <LinkRow key={m.k} m={m} />} list />)}
      </div>
    </>
  );
}

const Busy = () => <div className="grid place-items-center py-16"><Spinner className="size-6 text-accent" /></div>;
function Nothing({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="px-8 py-16 text-center text-muted">
      <span className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-panel-2 [&_svg]:size-7">{icon}</span>
      <p className="text-sm">{text}</p>
    </div>
  );
}

/** "This week", "This month", then "March 2026". */
function monthOf(ts: number, now = new Date()) {
  const d = new Date(ts);
  if (now.getTime() - ts < 7 * 864e5) return t('This week');
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return t('This month');
  return d.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
}
function groups(items: Msg[]) {
  const out: { label: string; items: Msg[] }[] = [];
  for (const m of items) {
    const label = monthOf(m.ts);
    if (out.at(-1)?.label === label) out.at(-1)!.items.push(m);
    else out.push({ label, items: [m] });
  }
  return out;
}

function ByMonth({ items, render, list }: { items: Msg[]; render: (m: Msg) => ReactNode; list?: boolean }) {
  return (
    <>
      {groups(items).map((g) => (
        <section key={g.label} aria-label={g.label}>
          <h3 className="sticky top-0 z-10 bg-bg/95 px-4 py-2 text-xs font-semibold tracking-wide text-muted uppercase backdrop-blur">{g.label}</h3>
          <ul className={list ? 'divide-y divide-line/60 bg-panel' : 'grid grid-cols-3 gap-0.5 sm:grid-cols-4'}>{g.items.map(render)}</ul>
        </section>
      ))}
    </>
  );
}

function MediaGrid({ peer, items }: { peer: string; items: Msg[] }) {
  return <ByMonth items={items} render={(m) => <Tile key={m.k} peer={peer} m={m} />} />;
}

function Tile({ peer, m }: { peer: string; m: Msg }) {
  const [ref, near] = useNear<HTMLLIElement>();
  const video = isVideo(m);
  const src = usePhoto(m.k, near && !video);
  return (
    <li ref={ref} className="relative aspect-square bg-panel-2">
      <button type="button" className="block size-full" aria-label={video ? t('Video') : t('Photo')}
        onClick={() => (video ? showInChat(m.k) : openGallery({ peer, k: m.k } as Msg))}>
        {video
          ? (m.file?.thumb ? <img src={m.file.thumb} alt="" className="size-full object-cover" draggable={false} /> : null)
          : src && <img src={src} alt="" className="size-full object-cover" draggable={false} />}
        {video && (
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-9 place-items-center rounded-full bg-black/55 text-white"><Play className="size-4 fill-current" /></span>
          </span>
        )}
      </button>
    </li>
  );
}

const when = (ts: number) => new Date(ts).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });

function DocRow({ m }: { m: Msg }) {
  const f = m.file!;
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try { const full = await findMessage(m.k); if (full?.src) downloadDataUrl(full.src, f.name); } finally { setBusy(false); }
  };
  return (
    <li className="flex items-center gap-1 pr-2">
      <button type="button" onClick={() => void open()} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-hover">
        <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-accent/15 text-accent-ink">
          {f.thumb ? <img src={f.thumb} alt="" className="size-full object-cover object-top" /> : <FileText className="size-5" />}
          <span className="absolute right-0 bottom-0 left-0 bg-accent py-px text-center text-[9px] leading-3 font-bold text-white uppercase">{fileExt(f.name, f.mime)}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{f.name}</span>
          <span className="block truncate text-xs text-muted">{[fmtSize(f.size), when(m.ts)].join(' · ')}</span>
        </span>
        {busy ? <Spinner className="size-4" /> : <Download className="size-4 shrink-0 text-muted" aria-hidden />}
      </button>
      <IconButton label={t('Show in chat')} size="icon-sm" onClick={() => showInChat(m.k)}><MessageSquare /></IconButton>
    </li>
  );
}

function LinkRow({ m }: { m: Msg }) {
  const url = linkOf(m);
  let host = '';
  try { host = new URL(url).host.replace(/^www\./, ''); } catch { /* shown as written */ }
  return (
    <li className="flex items-center gap-1 pr-2">
      <a href={url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-hover">
        <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-panel-2 text-muted">
          {m.lp?.img ? <img src={m.lp.img} alt="" className="size-full object-cover" /> : <Link2 className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{m.lp?.title || host || url}</span>
          <span className="block truncate text-xs text-accent-ink">{url}</span>
          <span className="block truncate text-xs text-muted">{when(m.ts)}</span>
        </span>
        <ExternalLink className="size-4 shrink-0 text-muted" aria-hidden />
      </a>
      <IconButton label={t('Show in chat')} size="icon-sm" onClick={() => showInChat(m.k)}><MessageSquare /></IconButton>
    </li>
  );
}

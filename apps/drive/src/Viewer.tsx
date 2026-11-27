// A file opened full screen: photos (zoom with a double tap, pinch or the mouse wheel, drag to look
// around), videos, music, PDFs page by page, and text, code and CSV tables. Swipe, the arrow keys or
// the side buttons go to the next or previous file in the folder.
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { ChevronLeft, ChevronRight, Download, EllipsisVertical, Lock, Music, Star, TriangleAlert, WrapText, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button, IconButton, Spinner } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { t } from '@sanga/i18n';
import { ext, fmtSize, isHeic, kindName, previewable } from './kinds';
import { ItemMenu, KindIcon, kindOfEntry, type Action } from './parts';
import { download, fileBlob, useDrive, type Entry, type Source } from './store';
import { fromHeic, loadPdf } from './thumbs';
import { parseCsv } from './csv';

const dark = 'text-white/80 hover:bg-white/10 hover:text-white';

export function Viewer({ list, id, onNav, onClose, onAction, srcOf, readOnly, noClose }: {
  list: Entry[]; id: string; onNav: (id: string) => void; onClose: () => void; onAction?: (a: Action, e: Entry) => void;
  /** Where a file's pieces come from, for files someone shared (yours by default). */
  srcOf?: (e: Entry) => Source | undefined;
  /** Someone else's: only Download. */
  readOnly?: boolean;
  /** The whole page (a shared file opened from its link): nothing to close to. */
  noClose?: boolean;
}) {
  const live = useDrive((s) => (readOnly ? undefined : s.entries[id]));
  const i = list.findIndex((x) => x.id === id);
  const e = live && !live.deleted ? live : list[i];
  const prev = i > 0 ? list[i - 1] : null, next = i >= 0 && i < list.length - 1 ? list[i + 1] : null;
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const key = (ev: KeyboardEvent) => {
      if (document.querySelector('[role=dialog]:not([data-viewer]),[role=menu]')) return; // a window or menu over the preview has the keys
      if (ev.key === 'Escape') onClose();
      else if (ev.key === 'ArrowLeft' && prev) onNav(prev.id);
      else if (ev.key === 'ArrowRight' && next) onNav(next.id);
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [prev, next, onNav, onClose]);
  useEffect(() => { if (!e) onClose(); }, [e, onClose]);

  // A sideways swipe (not while zoomed in) goes to the next or previous file.
  const touch = useRef<{ x: number; y: number } | null>(null);
  if (!e) return null;
  const k = kindOfEntry(e);
  const src = srcOf?.(e);

  return (
    <div role="dialog" aria-modal aria-label={e.name} data-viewer className="fixed inset-0 z-40 flex flex-col bg-[#0b0d10] text-white animate-fade-in"
      onTouchStart={(ev) => { if (ev.touches.length === 1) touch.current = { x: ev.touches[0].clientX, y: ev.touches[0].clientY }; else touch.current = null; }}
      onTouchEnd={(ev) => {
        const s = touch.current; touch.current = null;
        if (!s || zoomed || (k !== 'image' && k !== 'audio' && k !== 'other')) return;
        const dx = ev.changedTouches[0].clientX - s.x, dy = ev.changedTouches[0].clientY - s.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { const to = dx < 0 ? next : prev; if (to) onNav(to.id); }
      }}>
      <header className="flex h-14 shrink-0 items-center gap-2 bg-gradient-to-b from-black/60 to-transparent px-2 pt-[env(safe-area-inset-top)]">
        {noClose ? <span className="w-2" /> : <IconButton label={t('Close')} className={dark} onClick={onClose}><X /></IconButton>}
        <KindIcon e={e} className="size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-medium">{e.name}{e.starred && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label={t('Starred')} />}</p>
          <p className="truncate text-xs text-white/55">{kindName(k)} · {fmtSize(e.size ?? 0)}{list.length > 1 && i >= 0 ? ` · ${t('{i} of {n}', { i: i + 1, n: list.length })}` : ''}</p>
        </div>
        <IconButton label={t('Download')} className={dark} onClick={() => void download(e, src).catch(() => {})}><Download /></IconButton>
        {!readOnly && onAction && <ItemMenu e={e} onAction={onAction} trigger={<IconButton label={t('More')} className={dark}><EllipsisVertical /></IconButton>} />}
      </header>

      <div className="relative min-h-0 flex-1">
        <Content key={e.id} e={e} src={src} onZoom={setZoomed} />
        {prev && <Side side="left" label={t('Previous')} onClick={() => onNav(prev.id)} />}
        {next && <Side side="right" label={t('Next')} onClick={() => onNav(next.id)} />}
      </div>
    </div>
  );
}

function Side({ side, label, onClick }: { side: 'left' | 'right'; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className={cn('absolute top-1/2 z-10 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/70 md:grid', side === 'left' ? 'left-4' : 'right-4')}>
      {side === 'left' ? <ChevronLeft className="size-6" /> : <ChevronRight className="size-6" />}
    </button>
  );
}

/** The file's contents, fetched and opened, as an object URL (and the Blob, for PDFs and text). */
function useFile(e: Entry, enabled: boolean, src?: Source) {
  const [state, setState] = useState<{ url?: string; blob?: Blob; error?: boolean }>({});
  useEffect(() => {
    if (!enabled) return;
    let url = '', gone = false;
    (async () => {
      let blob = await fileBlob(e, src);
      if (isHeic(e.mime ?? '', e.name)) blob = await fromHeic(blob);
      url = URL.createObjectURL(blob);
      if (gone) URL.revokeObjectURL(url); else setState({ url, blob });
    })().catch(() => { if (!gone) setState({ error: true }); });
    return () => { gone = true; if (url) URL.revokeObjectURL(url); };
  }, [e.id, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

function Content({ e, src, onZoom }: { e: Entry; src?: Source; onZoom: (z: boolean) => void }) {
  const k = kindOfEntry(e);
  const can = previewable(e.mime ?? '', e.name, e.size ?? 0);
  const { url, blob, error } = useFile(e, can, src);
  const progress = useDrive((s) => s.fetching[e.id]);

  if (!can) return <NoPreview e={e} src={src} />;
  if (error) return <NoPreview e={e} src={src} failed />;
  if (!url || !blob) {
    return (
      <div className="absolute inset-0 grid place-items-center">
        {e.thumb && <img src={e.thumb} alt="" className="absolute inset-0 size-full scale-110 object-contain opacity-40 blur-2xl" aria-hidden />}
        <div className="relative flex flex-col items-center gap-3" role="status">
          {e.thumb && (k === 'image' || k === 'video') && <img src={e.thumb} alt="" className="max-h-[50dvh] max-w-[80vw] rounded-lg object-contain opacity-80" />}
          <span className="flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm backdrop-blur">
            <Spinner className="size-4" />{progress != null && progress > 0 ? t('Opening… {p}%', { p: Math.round(progress * 100) }) : t('Opening…')}
          </span>
        </div>
      </div>
    );
  }
  if (k === 'image') return <ZoomImage url={url} alt={e.name} onZoom={onZoom} />;
  if (k === 'video') return <div className="absolute inset-0 grid place-items-center p-2"><video src={url} controls autoPlay playsInline className="max-h-full max-w-full rounded-lg bg-black" /></div>;
  if (k === 'audio') {
    return (
      <div className="absolute inset-0 grid place-items-center p-6">
        <div className="w-full max-w-md rounded-3xl bg-white/[0.06] p-8 text-center ring-1 ring-white/10">
          <span className="mx-auto grid size-28 place-items-center rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-700 shadow-2xl"><Music className="size-14" /></span>
          <p className="mt-5 truncate text-lg font-semibold">{e.name.replace(/\.[^.]+$/, '')}</p>
          <audio src={url} controls autoPlay className="mt-5 w-full" />
        </div>
      </div>
    );
  }
  if (k === 'pdf') return <PdfView blob={blob} />;
  return <TextView blob={blob} name={e.name} />;
}

function NoPreview({ e, src, failed }: { e: Entry; src?: Source; failed?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="absolute inset-0 grid place-items-center p-6 text-center">
      <div>
        <span className="mx-auto grid size-24 place-items-center rounded-3xl bg-white/[0.07] ring-1 ring-white/10">
          {failed ? <TriangleAlert className="size-11 text-amber-400" /> : <KindIcon e={e} className="size-12" />}
        </span>
        <p className="mt-4 max-w-sm truncate text-lg font-semibold">{e.name}</p>
        <p className="mt-1 text-sm text-white/60">{failed ? t('Couldn’t open this file. Check your connection and try again.') : t('No preview for this kind of file.')}</p>
        <Button className="mt-5" loading={busy} onClick={() => { setBusy(true); void download(e, src).catch(() => {}).finally(() => setBusy(false)); }}>
          <Download className="size-4" />{t('Download')} · {fmtSize(e.size ?? 0)}
        </Button>
      </div>
    </div>
  );
}

// ---------- photos ----------
interface View { s: number; x: number; y: number }
const MAX_ZOOM = 8;

function ZoomImage({ url, alt, onZoom }: { url: string; alt: string; onZoom: (z: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [v, setV] = useState<View>({ s: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; v: View; cx: number; cy: number } | null>(null);
  const lastTap = useRef(0);

  useEffect(() => { onZoom(v.s > 1.01); }, [v.s, onZoom]);

  /** Zoom to `s`, keeping the point (cx, cy) (relative to the centre) where it is. */
  const zoomAt = useCallback((s: number, cx: number, cy: number, from: View) => {
    s = Math.min(MAX_ZOOM, Math.max(1, s));
    if (s === 1) return { s: 1, x: 0, y: 0 };
    const r = s / from.s;
    return { s, x: cx - (cx - from.x) * r, y: cy - (cy - from.y) * r };
  }, []);
  const rel = (cx: number, cy: number) => {
    const b = box.current!.getBoundingClientRect();
    return [cx - b.left - b.width / 2, cy - b.top - b.height / 2] as const;
  };

  useEffect(() => {
    const el = box.current!;
    const wheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const [cx, cy] = rel(ev.clientX, ev.clientY);
      setV((cur) => zoomAt(cur.s * Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0018)), cx, cy, cur));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [zoomAt]);

  const toggle = (cx: number, cy: number) => {
    const [x, y] = rel(cx, cy);
    setV((cur) => (cur.s > 1.01 ? { s: 1, x: 0, y: 0 } : zoomAt(2.5, x, y, cur)));
  };

  const down = (ev: RPointerEvent) => {
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const [cx, cy] = rel((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), v, cx, cy };
    } else if (ev.pointerType !== 'mouse') {
      const t0 = Date.now();
      if (t0 - lastTap.current < 300) { toggle(ev.clientX, ev.clientY); lastTap.current = 0; } else lastTap.current = t0;
    }
  };
  const move = (ev: RPointerEvent) => {
    const p = pointers.current.get(ev.pointerId);
    if (!p) return;
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const pc = pinch.current;
      setV(zoomAt(pc.v.s * (Math.hypot(a.x - b.x, a.y - b.y) / pc.d), pc.cx, pc.cy, pc.v));
    } else if (v.s > 1.01) {
      setV((cur) => ({ ...cur, x: cur.x + dx, y: cur.y + dy }));
    }
  };
  const up = (ev: RPointerEvent) => {
    pointers.current.delete(ev.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const step = (f: number) => setV((cur) => zoomAt(cur.s * f, 0, 0, cur));

  return (
    <>
      <div ref={box} className={cn('absolute inset-0 overflow-hidden select-none', v.s > 1.01 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in')}
        style={{ touchAction: v.s > 1.01 ? 'none' : 'pan-y pinch-zoom' }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onDoubleClick={(ev) => toggle(ev.clientX, ev.clientY)}>
        <img src={url} alt={alt} draggable={false}
          className="absolute inset-0 m-auto max-h-full max-w-full object-contain transition-transform duration-75 ease-out will-change-transform"
          style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.s})` }} />
      </div>
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/55 p-1 backdrop-blur pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        <IconButton label={t('Zoom out')} size="icon-sm" className={dark} disabled={v.s <= 1.01} onClick={() => step(1 / 1.5)}><ZoomOut /></IconButton>
        <button type="button" className="min-w-14 rounded-full px-2 text-sm tabular-nums text-white/85 hover:text-white" onClick={() => setV({ s: 1, x: 0, y: 0 })} title={t('Fit to screen')}>{Math.round(v.s * 100)}%</button>
        <IconButton label={t('Zoom in')} size="icon-sm" className={dark} disabled={v.s >= MAX_ZOOM} onClick={() => step(1.5)}><ZoomIn /></IconButton>
      </div>
    </>
  );
}

// ---------- PDFs ----------
type PdfDoc = Awaited<Awaited<ReturnType<typeof loadPdf>>['promise']>;

function PdfView({ blob }: { blob: Blob }) {
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [ratio, setRatio] = useState(1.414);
  const [failed, setFailed] = useState(false);
  const [locked, setLocked] = useState<null | 'ask' | 'wrong'>(null);
  const [password, setPassword] = useState<string | undefined>();
  const [scale, setScale] = useState(1);
  const [page, setPage] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let task: Awaited<ReturnType<typeof loadPdf>> | null = null, gone = false;
    (async () => {
      task = await loadPdf(await blob.arrayBuffer(), password);
      const d = await task.promise;
      const p1 = await d.getPage(1);
      const vp = p1.getViewport({ scale: 1 });
      if (!gone) { setRatio(vp.height / vp.width); setDoc(d); setLocked(null); }
    })().catch((e) => {
      if (gone) return;
      if ((e as { name?: string })?.name === 'PasswordException') setLocked(password ? 'wrong' : 'ask');
      else setFailed(true);
    });
    return () => { gone = true; void task?.destroy(); };
  }, [blob, password]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc]);

  if (failed) return <div className="absolute inset-0 grid place-items-center text-white/70">{t('This PDF can’t be shown. Download it to open it.')}</div>;
  if (locked) return <PdfPassword wrong={locked === 'wrong'} onTry={setPassword} />;
  if (!doc) return <div className="absolute inset-0 grid place-items-center"><Spinner className="size-6" /></div>;
  const pageW = Math.max(200, Math.min(width - 24, 900) * scale);

  return (
    <>
      <div ref={scroller} className="absolute inset-0 overflow-auto px-3 pt-2 pb-20"
        onScroll={(ev) => {
          const el = ev.currentTarget;
          const h = pageW * ratio + 12;
          setPage(Math.min(doc.numPages, Math.max(1, Math.round(el.scrollTop / h) + 1)));
        }}>
        {width > 0 && Array.from({ length: doc.numPages }, (_, i) => <PdfPage key={i} doc={doc} n={i + 1} width={pageW} ratio={ratio} />)}
      </div>
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/60 p-1 backdrop-blur">
        <span className="px-3 text-sm tabular-nums text-white/85">{t('Page {i} of {n}', { i: page, n: doc.numPages })}</span>
        <IconButton label={t('Zoom out')} size="icon-sm" className={dark} disabled={scale <= 1} onClick={() => setScale(Math.max(1, scale / 1.25))}><ZoomOut /></IconButton>
        <IconButton label={t('Zoom in')} size="icon-sm" className={dark} disabled={scale >= 3} onClick={() => setScale(Math.min(3, scale * 1.25))}><ZoomIn /></IconButton>
      </div>
    </>
  );
}

/** A locked PDF (bank statements often are): its password, used only here to open it, never saved. */
function PdfPassword({ wrong, onTry }: { wrong: boolean; onTry: (p: string) => void }) {
  const [p, setP] = useState('');
  return (
    <div className="absolute inset-0 grid place-items-center p-6">
      <form className="w-full max-w-sm rounded-3xl bg-white/[0.06] p-6 text-center ring-1 ring-white/10" onSubmit={(ev) => { ev.preventDefault(); if (p) onTry(p); }}>
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/10"><Lock className="size-7" /></span>
        <p className="mt-3 font-semibold">{t('This PDF is locked')}</p>
        <p className="mt-1 text-sm text-white/60">{t('Enter its password to open it.')}</p>
        <input type="password" autoFocus value={p} onChange={(ev) => setP(ev.target.value)} aria-label={t('PDF password')}
          className="mt-4 h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-white outline-none focus:border-accent" />
        {wrong && <p className="mt-2 text-sm text-red-300" role="alert">{t('That password didn’t open it.')}</p>}
        <Button type="submit" className="mt-4 w-full" disabled={!p}>{t('Open')}</Button>
      </form>
    </div>
  );
}

/** One page, drawn when it scrolls near the screen (and again, sharper, when zoomed). */
function PdfPage({ doc, n, width, ratio }: { doc: PdfDoc; n: number; width: number; ratio: number }) {
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(n <= 2);
  const [h, setH] = useState(width * ratio);

  useEffect(() => {
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) setNear(true); }, { rootMargin: '800px 0px' }); // i18n-ok
    io.observe(holder.current!);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let cancel: (() => void) | null = null, gone = false;
    const timer = setTimeout(async () => {
      try {
        const page = await doc.getPage(n);
        const vp1 = page.getViewport({ scale: 1 });
        const s = width / vp1.width;
        const vp = page.getViewport({ scale: s * Math.min(3, devicePixelRatio || 1) });
        const c = canvas.current;
        if (!c || gone) return;
        c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        setH(width * (vp1.height / vp1.width));
        const task = page.render({ canvas: c, viewport: vp });
        cancel = () => task.cancel();
        await task.promise;
      } catch { /* cancelled, or a page that can't be drawn */ }
    }, 60);
    return () => { gone = true; clearTimeout(timer); cancel?.(); };
  }, [near, doc, n, width]);

  return (
    <div ref={holder} className="relative mx-auto mb-3 overflow-hidden rounded-sm bg-white shadow-lg" style={{ width, height: h }}>
      <canvas ref={canvas} className="block size-full" aria-label={t('Page {n}', { n })} />
    </div>
  );
}

// ---------- text, code, CSV ----------
const MAX_TEXT = 2_000_000;

function TextView({ blob, name }: { blob: Blob; name: string }) {
  const [text, setText] = useState<string | null>(null);
  const [wrap, setWrap] = useState(true);
  useEffect(() => { void blob.slice(0, MAX_TEXT).text().then(setText, () => setText('')); }, [blob]);
  if (text == null) return <div className="absolute inset-0 grid place-items-center"><Spinner className="size-6" /></div>;
  const e = ext(name);
  const table = e === 'csv' || e === 'tsv' ? parseCsv(text, e === 'tsv' ? '\t' : ',') : null;

  return (
    <div className="absolute inset-0 overflow-auto px-3 pt-2 pb-6 md:px-6">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl bg-panel text-ink shadow-2xl">
        {table ? (
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {table.map((r, i) => (
                  <tr key={i} className={i === 0 ? 'sticky top-0 bg-panel-2 font-semibold' : 'odd:bg-panel even:bg-panel-2/50'}>
                    <td className="border-r border-line px-2 py-1.5 text-right text-xs text-muted tabular-nums select-none">{i + 1}</td>
                    {r.map((c, j) => <td key={j} className="max-w-xs truncate border-r border-line/60 px-3 py-1.5 whitespace-nowrap" title={c}>{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-end border-b border-line px-2 py-1">
              <IconButton label={wrap ? t('Don’t wrap lines') : t('Wrap lines')} size="icon-sm" className={cn(wrap && 'text-accent')} onClick={() => setWrap(!wrap)}><WrapText /></IconButton>
            </div>
            <pre className={cn('overflow-x-auto p-4 font-mono text-[13px] leading-relaxed md:p-6', wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre')}>{text || ' '}</pre>
          </>
        )}
        {blob.size > MAX_TEXT && <p className="border-t border-line px-4 py-2 text-sm text-muted">{t('Showing the start of the file. Download it to see all of it.')}</p>}
      </div>
    </div>
  );
}

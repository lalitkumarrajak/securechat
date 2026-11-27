// What a Drive share link opens (/apps/drive/share.html#<id>.<key>), for anyone, signed in to Sanga or
// not. The key is after the #, so it never reaches the server: this page fetches the sealed list of
// what's shared and the files' sealed pieces, and opens them here. A shared file opens straight away;
// a shared folder shows what's in it, to browse, preview and download.
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Download, HardDrive, Link2Off } from 'lucide-react';
import { t, tn, useI18n } from '@sanga/i18n';
import { UI_DICTS } from '@sanga/ui/locale';
import { IconButton, Spinner } from '@sanga/ui/button';
import { DRIVE_DICTS } from './locale';
import { fmtSize } from './kinds';
import { Preview } from './parts';
import { download, openShare, parseShareHash, shareSource, sorted, type Entry, type Manifest } from './store';
import { Viewer } from './Viewer';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'failed'), { status: res.status });
  return data;
}

type State = { kind: 'loading' } | { kind: 'broken' } | { kind: 'gone' } | { kind: 'ok'; id: string; m: Manifest };

function SharePageInner() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [folder, setFolder] = useState('');
  const [opened, setOpened] = useState<string | null>(null);

  useEffect(() => {
    const link = parseShareHash(location.hash);
    if (!link) { setState({ kind: 'broken' }); return; }
    (async () => {
      const { box } = await get<{ box: string }>(`/api/drive/public?id=${link.id}`);
      const m = await openShare(link.key, link.id, box);
      if (!m) setState({ kind: 'broken' });
      else if (m.gone) setState({ kind: 'gone' });
      else { setState({ kind: 'ok', id: link.id, m }); setFolder(m.root); }
    })().catch((e) => setState({ kind: (e as { status?: number }).status === 404 ? 'gone' : 'broken' }));
  }, []);

  const ok = state.kind === 'ok' ? state : null;
  const src = useMemo(() => ok && shareSource(ok.id, ok.m.owner, (p) => get(p)), [ok]);
  const byId = useMemo(() => new Map((ok?.m.items ?? []).map((x) => [x.id, x])), [ok]);
  const root = ok ? byId.get(ok.m.root) : undefined;
  const here = useMemo(() => sorted((ok?.m.items ?? []).filter((x) => x.parent === folder && x.id !== ok?.m.root), 'name'), [ok, folder]);
  const files = here.filter((x) => x.type === 'file');
  const crumbs = useMemo(() => {
    const out: Entry[] = [];
    for (let x = byId.get(folder), i = 0; x && i < 100; i++) { out.unshift(x); if (x.id === ok?.m.root) break; x = byId.get(x.parent); }
    return out;
  }, [byId, folder, ok]);
  const countIn = (id: string) => (ok?.m.items ?? []).filter((x) => x.parent === id).length;

  useEffect(() => { document.title = root ? `${root.name} · Sanga Drive` : 'Sanga Drive'; }, [root]); // i18n-ok

  if (state.kind === 'loading') {
    return <div className="grid min-h-dvh place-items-center bg-bg"><span className="flex items-center gap-2 text-muted"><Spinner className="size-5 text-accent" />{t('Opening…')}</span></div>;
  }
  if (!ok || !root || !src) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg p-6 text-center">
        <div>
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-panel-2 text-muted"><Link2Off className="size-8" /></span>
          <h1 className="mt-4 text-xl font-bold">{state.kind === 'gone' ? t('This link doesn’t work any more') : t('This link is incomplete')}</h1>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{state.kind === 'gone' ? t('Whoever shared it may have stopped sharing it, or deleted it.') : t('Ask for the link again and open the whole of it.')}</p>
          <a href="/" className="mt-6 inline-block text-sm font-medium text-accent">{t('Open Sanga')}</a>
        </div>
      </div>
    );
  }

  // A single file: straight to its preview.
  if (root.type === 'file') return <Viewer list={[root]} id={root.id} onNav={() => {}} onClose={() => {}} readOnly noClose srcOf={() => src} />;

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white"><HardDrive className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">{root.name}</h1>
            <p className="truncate text-xs text-muted">{t('Shared with you through Sanga Drive · encrypted end-to-end')}</p>
          </div>
          <a href="/" className="hidden shrink-0 rounded-xl border border-line px-3 py-1.5 text-sm font-medium hover:bg-hover sm:block">{t('Open Sanga')}</a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        {crumbs.length > 1 && (
          <nav aria-label={t('Folders')} className="mb-3 flex flex-wrap items-center gap-0.5 font-semibold">
            {crumbs.map((c, i) => (
              <span key={c.id} className="flex items-center gap-0.5">
                {i > 0 && <ChevronRight className="size-4 text-muted" aria-hidden />}
                {i < crumbs.length - 1
                  ? <button type="button" onClick={() => setFolder(c.id)} className="rounded-lg px-1.5 py-0.5 text-muted hover:bg-hover hover:text-ink">{c.name}</button>
                  : <span className="px-1">{c.name}</span>}
              </span>
            ))}
          </nav>
        )}
        {!here.length ? <p className="py-16 text-center text-muted">{t('This folder is empty')}</p> : (
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {here.map((x) => x.type === 'folder' ? (
              <li key={x.id} className="col-span-1">
                <button type="button" onClick={() => setFolder(x.id)} className="flex w-full items-center gap-3 rounded-2xl border border-line/70 bg-panel p-3 text-left shadow-sm hover:border-accent/40">
                  <Preview e={x} className="size-10 shrink-0 rounded-xl" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{x.name}</span>
                    <span className="block truncate text-xs text-muted">{tn(countIn(x.id), '{n} item', '{n} items')}</span>
                  </span>
                </button>
              </li>
            ) : (
              <li key={x.id} className="overflow-hidden rounded-2xl border border-line/70 bg-panel shadow-sm">
                <button type="button" onClick={() => setOpened(x.id)} className="block w-full" aria-label={x.name}><Preview e={x} big className="aspect-[4/3] w-full" /></button>
                <div className="flex items-center gap-1 py-1.5 pr-1 pl-3">
                  <button type="button" onClick={() => setOpened(x.id)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium">{x.name}</span>
                    <span className="block truncate text-xs text-muted">{fmtSize(x.size ?? 0)}</span>
                  </button>
                  <IconButton label={t('Download')} size="icon-sm" className="[&_svg]:size-[1.1rem]" onClick={() => void download(x, src).catch(() => {})}><Download /></IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {opened && <Viewer list={files} id={opened} onNav={setOpened} onClose={() => setOpened(null)} readOnly srcOf={() => src} />}
    </div>
  );
}

export default function SharePage() {
  useI18n({ ...DRIVE_DICTS, ...UI_DICTS });
  return <SharePageInner />;
}

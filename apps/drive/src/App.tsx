// Drive: your files and folders, like a cloud drive. Make folders, upload files (or a whole folder,
// or drop them on the window), and open any of them in a full-screen preview. Grid or list, sorted
// your way; Recent, Starred and a Trash that empties itself after 30 days. Everything is sealed
// end-to-end (see store.ts). A separate Sanga app, opened from More; it also runs on its own at
// /apps/drive/.
import { t, tn, useI18n } from '@sanga/i18n';
import { UI_DICTS } from '@sanga/ui/locale';
import { DRIVE_DICTS } from './locale';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Check, ChevronRight, Clock, CloudUpload, FolderPlus, FolderUp, HardDrive,
  LayoutGrid, List, Plus, Search, Star, Trash2, Upload, Users, WifiOff, X,
} from 'lucide-react';
import { Button, IconButton, Spinner } from '@sanga/ui/button';
import { Input } from '@sanga/ui/input';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@sanga/ui/menu';
import { fmtListTime } from '@sanga/ui/format';
import { cn } from '@sanga/ui/utils';
import { sdk, type AppProps } from '@sanga/sdk';
import {
  all, children, deleteForever, download, emptyTrash, folderOk, inTrash, matches, move, newFolder, pathTo, refreshUsage, rename,
  loadShared, restore, shareFile, shareSource, sorted, star, startDrive, trash, TRASH_DAYS, upload, uploadTree, useDrive,
  type Entry, type Shared, type Sort, type Source,
} from './store';
import { fmtSize } from './kinds';
import { ItemMenu, Preview, SharedMark, type Action } from './parts';
import { ShareDialog } from './ShareDialog';
import { InfoDialog, MoveDialog, NameDialog } from './dialogs';
import { Uploads } from './Uploads';
import { Viewer } from './Viewer';

type View = 'drive' | 'shared' | 'recent' | 'starred' | 'trash';
type Layout = 'grid' | 'list';
type Pop = null | { kind: 'folder' } | { kind: 'rename' | 'move' | 'info' | 'share'; e: Entry };

const pref = <T extends string>(k: string, d: T): T => { try { return (localStorage.getItem('drive.' + k) as T) || d; } catch { return d; } };
const keepPref = (k: string, v: string) => { try { localStorage.setItem('drive.' + k, v); } catch { /* private window */ } };

function DriveAppInner({ onClose, tab }: AppProps) {
  const [view, setView] = useState<View>('drive');
  const [folder, setFolder] = useState('');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [layout, setLayoutS] = useState<Layout>(() => pref('layout', 'grid'));
  const [sort, setSortS] = useState<Sort>(() => pref('sort', 'name'));
  const [desc, setDesc] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const [pop, setPop] = useState<Pop>(null);
  const [undo, setUndo] = useState<Entry | null>(null);
  const [dragging, setDragging] = useState(false);
  /** In "Shared with me": the share and the folder of it you're in (null: the list of shares). */
  const [inShare, setInShare] = useState<{ share: string; folder: string } | null>(null);
  const filesIn = useRef<HTMLInputElement>(null), folderIn = useRef<HTMLInputElement>(null);

  const online = sdk().useOnline();
  const loaded = useDrive((s) => s.loaded);
  const failed = useDrive((s) => s.failed);
  const map = useDrive((s) => s.entries);
  const usage = useDrive((s) => s.usage);
  const fetching = useDrive((s) => s.fetching);
  const sharedList = useDrive((s) => s.shared);
  const chats = sdk().useChats();
  const nameOf = (u: string) => chats.find((c) => c.peer === u)?.name ?? u;

  useEffect(() => { void startDrive().catch(() => {}); void refreshUsage(); }, []);
  // The folder you're in went away (deleted on another device, or trashed): back to its nearest folder that's left.
  useEffect(() => { if (loaded && folder && !folderOk(folder, map)) setFolder(pathTo(folder, map).filter((x) => folderOk(x.id, map)).at(-1)?.id ?? ''); }, [loaded, folder, map]);
  useEffect(() => { if (!undo) return; const id = setTimeout(() => setUndo(null), 6000); return () => clearTimeout(id); }, [undo]);

  // The phone's Back steps back inside Drive (closes the preview or a window, leaves the search, goes up a
  // folder, back to My Drive from Recent, Starred or the Trash) before it leaves Drive. Like an open chat,
  // Drive adds one history entry while you're anywhere but My Drive, and puts it back after each step.
  const atRoot = view === 'drive' && !folder && !opened && !searching && !q && !pop;
  const now = useRef({ view, folder, opened, searching, q, pop, map, onClose, inShare, sharedList });
  now.current = { view, folder, opened, searching, q, pop, map, onClose, inShare, sharedList };
  const skipPop = useRef(false), leaving = useRef(false);
  useEffect(() => {
    if (!atRoot && !history.state?.drive) history.pushState({ ...history.state, drive: 1 }, '');
    else if (atRoot && history.state?.drive) { skipPop.current = true; history.back(); }
  }, [atRoot]);
  useEffect(() => {
    const onPop = () => {
      if (skipPop.current) { skipPop.current = false; return; }
      if (history.state?.drive) return;
      if (leaving.current) { leaving.current = false; now.current.onClose(); return; }
      const c = now.current;
      if (c.pop) setPop(null);
      else if (c.opened) setOpened(null);
      else if (c.searching || c.q) { setQ(''); setSearching(false); }
      else if (c.view === 'drive' && c.folder) setFolder(c.map[c.folder]?.parent ?? '');
      else if (c.view === 'shared' && c.inShare) {
        const sh = c.sharedList.find((x) => x.id === c.inShare!.share);
        const up = sh?.m.items.find((x) => x.id === c.inShare!.folder);
        setInShare(!sh || !up || up.id === sh.m.root ? null : { share: sh.id, folder: up.parent });
      }
      else { setView('drive'); setFolder(''); }
      // Still somewhere inside: the entry goes back, for the next Back.
      queueMicrotask(() => { if (!history.state?.drive) history.pushState({ ...history.state, drive: 1 }, ''); });
    };
    addEventListener('popstate', onPop);
    return () => {
      removeEventListener('popstate', onPop);
      if (history.state?.drive) history.replaceState({ ...history.state, drive: undefined }, ''); // left by switching tabs
    };
  }, []);
  /** The arrow at the top: one step back, like the phone's Back; out of Drive from My Drive. */
  const up = () => {
    if (history.state?.drive) { if (atRoot) leaving.current = true; history.back(); }
    else onClose();
  };

  // A safety net: if a window ever closes but leaves the page not taking taps, give them back.
  useEffect(() => {
    const fix = () => {
      if (document.body.style.pointerEvents !== 'none') return;
      if (document.querySelector('[role=dialog][data-state=open],[role=alertdialog][data-state=open],[role=menu][data-state=open]')) return;
      document.body.style.pointerEvents = '';
    };
    const mo = new MutationObserver(() => setTimeout(fix, 350));
    mo.observe(document.body, { attributes: true, attributeFilter: ['style'], childList: true });
    return () => mo.disconnect();
  }, []);

  const setLayout = (l: Layout) => { setLayoutS(l); keepPref('layout', l); };
  const setSort = (s: Sort) => { if (s === sort) setDesc(!desc); else { setSortS(s); setDesc(false); keepPref('sort', s); } };
  const go = (v: View) => { setView(v); setFolder(''); setQ(''); setSearching(false); setInShare(null); if (v === 'shared') void loadShared(); };
  const openFolder = (id: string) => { setView('drive'); setFolder(id); setQ(''); setSearching(false); };

  /** Shared with me: the share each item came from, and its folders' contents. */
  const shareOfItem = useMemo(() => {
    const m = new Map<string, Shared>();
    for (const sh of sharedList) for (const x of sh.m.items) if (!m.has(x.id)) m.set(x.id, sh);
    return m;
  }, [sharedList]);
  const srcOf = useCallback((e: Entry): Source | undefined => {
    const sh = (inShare && sharedList.find((x) => x.id === inShare.share)) || shareOfItem.get(e.id);
    return sh ? shareSource(sh.id, sh.owner, (path) => sdk().api(path)) : undefined;
  }, [inShare, sharedList, shareOfItem]);
  const sharedItems = useMemo(() => {
    if (!inShare) return sharedList.map((sh) => sh.m.items.find((x) => x.id === sh.m.root)).filter(Boolean) as Entry[];
    const sh = sharedList.find((x) => x.id === inShare.share);
    return sh ? sh.m.items.filter((x) => x.parent === inShare.folder && x.id !== sh.m.root) : [];
  }, [sharedList, inShare]);
  const sharedCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const sh of sharedList) for (const x of sh.m.items) if (x.id !== sh.m.root) c.set(x.parent, (c.get(x.parent) ?? 0) + 1);
    return c;
  }, [sharedList]);

  const shown = useMemo(() => {
    if (view === 'shared') return inShare ? sorted(sharedItems, sort, desc) : sharedItems;
    const live = all(map).filter((x) => !inTrash(x, map));
    if (q.trim()) return sorted(live.filter((x) => matches(x, q)), sort, desc);
    if (view === 'recent') return live.filter((x) => x.type === 'file').sort((a, b) => b.edited - a.edited).slice(0, 200);
    if (view === 'starred') return sorted(live.filter((x) => x.starred), sort, desc);
    if (view === 'trash') {
      return all(map).filter((x) => x.trashed && !(map[x.parent] && inTrash(map[x.parent], map))).sort((a, b) => (b.trashed ?? 0) - (a.trashed ?? 0));
    }
    return sorted(children(folder, map), sort, desc);
  }, [map, q, view, folder, sort, desc, sharedItems, inShare]);
  const folders = shown.filter((x) => x.type === 'folder');
  const fileList = shown.filter((x) => x.type === 'file');
  const ownCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const x of Object.values(map)) if (!x.deleted && !x.trashed) c.set(x.parent, (c.get(x.parent) ?? 0) + 1);
    return c;
  }, [map]);
  const counts = view === 'shared' ? sharedCounts : ownCounts;
  const crumbs = useMemo(() => pathTo(folder, map), [folder, map]);
  const shareCrumbs = useMemo(() => {
    const sh = inShare && sharedList.find((x) => x.id === inShare.share);
    if (!sh) return [];
    const byId = new Map(sh.m.items.map((x) => [x.id, x]));
    const out: Entry[] = [];
    for (let x = byId.get(inShare!.folder), i = 0; x && i < 100; i++) { out.unshift(x); if (x.id === sh.m.root) break; x = byId.get(x.parent); }
    return out;
  }, [inShare, sharedList]);
  const target = view === 'drive' && !q.trim() ? folder : '';

  const act = useCallback(async (a: Action, e: Entry) => {
    if (view === 'shared') {
      if (a === 'open') { if (e.type === 'folder') setInShare({ share: (inShare && inShare.share) || shareOfItem.get(e.id)!.id, folder: e.id }); else setOpened(e.id); }
      else if (a === 'download') void download(e, srcOf(e)).catch(() => {});
      else if (a === 'send') void shareFile(e, srcOf(e)).catch(() => {});
      return;
    }
    if (a === 'open') { if (e.type === 'folder') openFolder(e.id); else setOpened(e.id); }
    else if (a === 'download') void download(e).catch(() => {});
    else if (a === 'send') void shareFile(e).catch(() => {});
    else if (a === 'rename' || a === 'move' || a === 'info' || a === 'share') setPop({ kind: a, e });
    else if (a === 'star') await star(e, !e.starred);
    else if (a === 'trash') { await trash(e); setUndo(e); if (opened === e.id) setOpened(null); }
    else if (a === 'restore') { await restore(e); setUndo(null); }
    else if (a === 'forever') {
      if (await sdk().confirm({ title: t('Delete “{name}” forever?', { name: e.name }), description: t('It goes from all your devices and can’t be brought back.'), confirmText: t('Delete forever'), destructive: true })) {
        await deleteForever(e);
        if (opened === e.id) setOpened(null);
      }
    }
  }, [opened, view, inShare, shareOfItem, srcOf]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- dropping files and folders on the window ----------
  const hasFiles = (ev: DragEvent) => [...ev.dataTransfer.types].includes('Files');
  const onDrop = async (ev: DragEvent) => {
    ev.preventDefault();
    setDragging(false);
    if (view === 'trash' || view === 'shared') return;
    const items = [...ev.dataTransfer.items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[];
    if (items.some((x) => x.isDirectory)) await uploadTree(await readEntries(items), target);
    else upload([...ev.dataTransfer.files], target);
  };

  const pick = (input: HTMLInputElement | null, tree: boolean) => {
    if (!input?.files?.length) return;
    const list = [...input.files];
    if (tree) void uploadTree(list.map((f) => ({ file: f, path: f.webkitRelativePath || f.name })), target);
    else upload(list, target);
    input.value = '';
  };

  const newMenu = (trigger: ReactNode) => (
    <Menu modal={false}>
      <MenuTrigger asChild>{trigger}</MenuTrigger>
      <MenuContent align="end" className="min-w-56">
        <MenuItem icon={<FolderPlus />} onSelect={() => { setTimeout(() => setPop({ kind: 'folder' }), 0); }}>{t('New folder')}</MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Upload />} onSelect={() => filesIn.current?.click()}>{t('Upload files')}</MenuItem>
        <MenuItem icon={<FolderUp />} onSelect={() => folderIn.current?.click()}>{t('Upload a folder')}</MenuItem>
      </MenuContent>
    </Menu>
  );

  /** In the list of shares: who shared it. */
  const fromOf = (e: Entry) => (view === 'shared' && !inShare && shareOfItem.get(e.id) ? t('From {name}', { name: nameOf(shareOfItem.get(e.id)!.owner) }) : undefined);
  const title = q.trim() ? t('Search results') : view === 'recent' ? t('Recent') : view === 'starred' ? t('Starred') : view === 'trash' ? t('Trash') : null;
  const busyDownload = !opened && Object.entries(fetching)[0];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-bg"
      onDragEnter={(ev) => { if (hasFiles(ev) && view !== 'trash' && view !== 'shared') { ev.preventDefault(); setDragging(true); } }}
      onDragOver={(ev) => { if (hasFiles(ev) && view !== 'trash' && view !== 'shared') { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; } }}
      onDragLeave={(ev) => { if (ev.currentTarget === ev.target || !ev.currentTarget.contains(ev.relatedTarget as Node)) setDragging(false); }}
      onDrop={(ev) => void onDrop(ev)}>
      <header className="flex h-16 shrink-0 items-center gap-1 px-3">
        {(!tab || !atRoot) && !searching && <IconButton label={t('Back')} onClick={up}><ArrowLeft /></IconButton>}
        {searching ? (
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search in Drive')} aria-label={t('Search in Drive')} className="pl-9"
              onKeyDown={(e) => { if (e.key === 'Escape') { setQ(''); setSearching(false); } }} />
          </div>
        ) : (
          <h1 className="flex min-w-0 flex-1 items-center gap-2 truncate text-xl font-bold tracking-tight">
            <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white"><HardDrive className="size-[18px]" /></span>
            {t('Drive')}
          </h1>
        )}
        {searching
          ? <IconButton label={t('Close search')} onClick={() => { setQ(''); setSearching(false); }}><X /></IconButton>
          : <IconButton label={t('Search')} onClick={() => setSearching(true)}><Search /></IconButton>}
        {view !== 'trash' && view !== 'shared' && newMenu(<Button className="ml-1 hidden md:inline-flex"><Plus className="size-4" />{t('New')}</Button>)}
      </header>

      {!online && <p className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-warn-bg px-3 py-2 text-sm"><WifiOff className="size-4" />{t('Offline. Changes are saved and sent when you’re back.')}</p>}

      <nav aria-label={t('Drive sections')} className="flex shrink-0 gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
        {([['drive', t('My Drive'), <HardDrive key="d" />], ['shared', t('Shared with me'), <Users key="u" />], ['recent', t('Recent'), <Clock key="r" />], ['starred', t('Starred'), <Star key="s" />], ['trash', t('Trash'), <Trash2 key="t" />]] as const).map(([v, label, icon]) => (
          <button key={v} type="button" onClick={() => go(v)} aria-current={view === v && !q.trim() ? 'page' : undefined}
            className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition [&_svg]:size-4',
              view === v && !q.trim() ? 'border-transparent bg-accent/15 text-accent-ink' : 'border-line bg-panel text-muted hover:bg-hover hover:text-ink')}>
            {icon}{label}
          </button>
        ))}
      </nav>

      <div className="flex min-h-11 shrink-0 items-center gap-1 px-3">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-lg font-semibold [scrollbar-width:none]">
          {view === 'shared' && !q.trim() ? (
            <>
              <Crumb label={t('Shared with me')} onClick={inShare ? () => setInShare(null) : undefined} />
              {shareCrumbs.map((c, i) => (
                <span key={c.id} className="flex min-w-0 items-center gap-0.5">
                  <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                  <Crumb label={c.name} onClick={i < shareCrumbs.length - 1 ? () => setInShare({ share: inShare!.share, folder: c.id }) : undefined} />
                </span>
              ))}
            </>
          ) : title ? <span className="truncate px-1">{title}</span> : (
            <>
              <Crumb label={t('My Drive')} onClick={crumbs.length ? () => setFolder('') : undefined} />
              {crumbs.map((c, i) => (
                <span key={c.id} className="flex min-w-0 items-center gap-0.5">
                  <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                  <Crumb label={c.name} onClick={i < crumbs.length - 1 ? () => setFolder(c.id) : undefined} />
                </span>
              ))}
            </>
          )}
        </div>
        {view === 'trash' && !q.trim() && shown.length > 0 && (
          <Button variant="ghost" size="sm" className="text-danger" onClick={async () => {
            if (await sdk().confirm({ title: t('Empty the Trash?'), description: t('Everything in it is deleted forever, from all your devices.'), confirmText: t('Empty Trash'), destructive: true })) await emptyTrash();
          }}>{t('Empty Trash')}</Button>
        )}
        {view !== 'recent' && view !== 'trash' && !(view === 'shared' && !inShare) && (
          <Menu modal={false}>
            <MenuTrigger asChild><IconButton label={t('Sort')} size="icon-sm" className="[&_svg]:size-[1.15rem]"><ArrowUpDown /></IconButton></MenuTrigger>
            <MenuContent className="min-w-48">
              {([['name', t('Name')], ['edited', t('Last modified')], ['size', t('Size')]] as const).map(([s, label]) => (
                <MenuItem key={s} icon={sort === s ? (desc ? <ArrowUp /> : <ArrowDown />) : <span className="size-[18px]" />} onSelect={(ev) => { ev.preventDefault(); setSort(s); }}>
                  <span className="flex-1">{label}</span>{sort === s && <Check className="size-4 text-accent" />}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        )}
        <IconButton label={layout === 'grid' ? t('List view') : t('Grid view')} size="icon-sm" className="[&_svg]:size-[1.15rem]" onClick={() => setLayout(layout === 'grid' ? 'list' : 'grid')}>
          {layout === 'grid' ? <List /> : <LayoutGrid />}
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-3 pt-1 pb-28 md:px-5 md:pb-10">
          {view === 'trash' && !q.trim() && shown.length > 0 && (
            <p className="mb-3 rounded-xl bg-panel-2 px-3 py-2 text-sm text-muted">{t('Items in the Trash are deleted forever after {n} days.', { n: TRASH_DAYS })}</p>
          )}
          {!loaded ? <Loading layout={layout} />
            : failed && !shown.length ? <p className="py-10 text-center text-muted" role="alert">{t('Couldn’t open your Drive on this device.')}</p> // i18n-ok
            : !shown.length ? <Empty view={q.trim() ? 'search' : view} q={q} folder={!!folder || !!inShare} onNew={() => filesIn.current?.click()} />
            : null}
          {loaded && shown.length > 0 && (layout === 'grid' ? (
              <>
                {folders.length > 0 && (
                  <section aria-label={t('Folders')} className="mb-5">
                    <h2 className="mb-2 px-1 text-sm font-medium text-muted">{t('Folders')}</h2>
                    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {folders.map((f) => <FolderTile key={f.id} e={f} n={counts.get(f.id) ?? 0} onAction={act} readOnly={view === 'shared'} from={fromOf(f)} />)}
                    </ul>
                  </section>
                )}
                {fileList.length > 0 && (
                  <section aria-label={t('Files')}>
                    <h2 className="mb-2 px-1 text-sm font-medium text-muted">{t('Files')}</h2>
                    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {fileList.map((f) => <FileCard key={f.id} e={f} sub={fromOf(f) ?? sub(f, view, map, q)} onAction={act} readOnly={view === 'shared'} />)}
                    </ul>
                  </section>
                )}
              </>
            ) : (
              <ul className="divide-y divide-line/70 overflow-hidden rounded-3xl border border-line/70 bg-panel shadow-sm">
                {shown.map((x) => <Row key={x.id} e={x} n={counts.get(x.id) ?? 0} sub={sub(x, view, map, q)} from={fromOf(x)} onAction={act} readOnly={view === 'shared'} />)}
              </ul>
            ))}
          {usage && view === 'drive' && !q.trim() && <Usage used={usage.used} max={usage.max} />}
        </div>
      </div>

      {view !== 'trash' && view !== 'shared' && newMenu(
        <button type="button" aria-label={t('New')} title={t('New')}
          className="absolute right-4 bottom-4 z-20 grid size-14 place-items-center rounded-2xl bg-accent text-white shadow-xl transition hover:brightness-110 active:scale-95 md:hidden">
          <Plus className="size-7" />
        </button>,
      )}

      <input ref={filesIn} type="file" multiple hidden onChange={(e) => pick(e.currentTarget, false)} />
      <input ref={folderIn} type="file" multiple hidden onChange={(e) => pick(e.currentTarget, true)} {...{ webkitdirectory: '', directory: '' }} />

      <Uploads />

      {undo && (
        <div role="status" className="absolute bottom-20 left-1/2 z-30 flex w-[min(28rem,calc(100%-1.5rem))] -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#1d2733] py-2 pr-2 pl-4 text-sm text-white shadow-2xl md:bottom-6">
          <span className="min-w-0 flex-1 truncate">{t('“{name}” moved to the Trash', { name: undo.name })}</span>
          <Button variant="ghost" size="sm" className="text-sky-300 hover:bg-white/10" onClick={() => { void restore(undo); setUndo(null); }}>{t('Undo')}</Button>
        </div>
      )}
      {busyDownload && !undo && (
        <div role="status" className="absolute bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#1d2733] px-4 py-2 text-sm text-white shadow-2xl md:bottom-6">
          <Spinner className="size-4" />{t('Getting “{name}” ready… {p}%', { name: map[busyDownload[0]]?.name ?? '', p: Math.round(busyDownload[1] * 100) })}
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-30 grid place-items-center rounded-3xl border-2 border-dashed border-accent bg-accent/10 backdrop-blur-[2px]">
          <div className="text-center">
            <CloudUpload className="mx-auto size-14 text-accent" />
            <p className="mt-2 text-lg font-semibold">{t('Drop to upload')}</p>
            <p className="text-sm text-muted">{t('To {folder}', { folder: crumbs.at(-1)?.name && target ? crumbs.at(-1)!.name : t('My Drive') })}</p>
          </div>
        </div>
      )}

      {pop?.kind === 'folder' && <NameDialog title={t('New folder')} initial="" action={t('Create')} onDone={(n) => void newFolder(n, target)} onClose={() => setPop(null)} />}
      {pop?.kind === 'rename' && <NameDialog title={t('Rename')} initial={pop.e.name} action={t('Rename')} onDone={(n) => void rename(pop.e, n)} onClose={() => setPop(null)} />}
      {pop?.kind === 'move' && <MoveDialog e={pop.e} onDone={(to) => void move(pop.e, to)} onClose={() => setPop(null)} />}
      {pop?.kind === 'info' && <InfoDialog e={pop.e} onClose={() => setPop(null)} />}
      {pop?.kind === 'share' && <ShareDialog e={pop.e} onClose={() => setPop(null)} />}

      {opened && <Viewer list={fileList} id={opened} onNav={setOpened} onClose={() => setOpened(null)} onAction={act}
        readOnly={view === 'shared'} srcOf={view === 'shared' ? srcOf : undefined} />}
    </div>
  );
}

function Crumb({ label, onClick }: { label: string; onClick?: () => void }) {
  if (!onClick) return <span className="truncate px-1">{label}</span>;
  return <button type="button" onClick={onClick} className="shrink-0 truncate rounded-lg px-1.5 py-0.5 text-muted hover:bg-hover hover:text-ink">{label}</button>;
}

/** Under a file's name: where it is (in search, Recent and Starred) or when it changed, and its size. */
function sub(e: Entry, view: View, map: Record<string, Entry>, q: string) {
  const size = e.type === 'file' ? fmtSize(e.size ?? 0) : '';
  if (view === 'trash' && !q.trim()) return [t('Trashed {when}', { when: fmtListTime(e.trashed ?? 0) }), size].filter(Boolean).join(' · ');
  if (q.trim() || view === 'starred' || view === 'recent') {
    const where = map[e.parent]?.name ?? t('My Drive');
    return [where, size].filter(Boolean).join(' · ');
  }
  return [fmtListTime(e.edited), size].filter(Boolean).join(' · ');
}

function FolderTile({ e, n, onAction, readOnly, from }: { e: Entry; n: number; onAction: (a: Action, e: Entry) => void; readOnly?: boolean; from?: string }) {
  return (
    <li className="group flex min-w-0 items-center rounded-2xl border border-line/70 bg-panel shadow-sm transition hover:border-accent/40 hover:shadow-md">
      <button type="button" onClick={() => onAction('open', e)} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3.5 text-left">
        <Preview e={e} className="size-10 shrink-0 rounded-xl" />
        <span className="min-w-0">
          <span className="flex items-center gap-1 truncate font-medium">{e.name}{e.starred && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label={t('Starred')} />}{!readOnly && <SharedMark e={e} />}</span>
          <span className="block truncate text-xs text-muted">{from ?? (e.trashed && !readOnly ? t('In the Trash') : tn(n, '{n} item', '{n} items'))}</span>
        </span>
      </button>
      <ItemMenu e={e} onAction={onAction} className="mr-1.5" readOnly={readOnly} />
    </li>
  );
}

function FileCard({ e, sub, onAction, readOnly }: { e: Entry; sub: string; onAction: (a: Action, e: Entry) => void; readOnly?: boolean }) {
  return (
    <li className="group min-w-0 overflow-hidden rounded-2xl border border-line/70 bg-panel shadow-sm transition hover:border-accent/40 hover:shadow-md">
      <button type="button" onClick={() => onAction('open', e)} className="block w-full text-left" aria-label={e.name}>
        <Preview e={e} big className="aspect-[4/3] w-full" />
      </button>
      <div className="flex items-center gap-1 py-1.5 pr-1 pl-3">
        <button type="button" onClick={() => onAction('open', e)} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-1 truncate text-sm font-medium">{e.name}{e.starred && <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" aria-label={t('Starred')} />}{!readOnly && <SharedMark e={e} />}</span>
          <span className="block truncate text-xs text-muted">{sub}</span>
        </button>
        <ItemMenu e={e} onAction={onAction} readOnly={readOnly} />
      </div>
    </li>
  );
}

function Row({ e, n, sub: s, onAction, readOnly, from }: { e: Entry; n: number; sub: string; onAction: (a: Action, e: Entry) => void; readOnly?: boolean; from?: string }) {
  return (
    <li className="flex items-center gap-0.5 pr-2">
      <button type="button" onClick={() => onAction('open', e)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left hover:bg-hover">
        <Preview e={e} className="size-11 shrink-0 rounded-xl" />
        <span className="min-w-0">
          <span className="flex items-center gap-1 truncate font-medium">{e.name}{e.starred && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label={t('Starred')} />}{!readOnly && <SharedMark e={e} />}</span>
          <span className="block truncate text-sm text-muted">{from ?? (e.type === 'folder' && (readOnly || !e.trashed) ? tn(n, '{n} item', '{n} items') : s)}</span>
        </span>
      </button>
      <ItemMenu e={e} onAction={onAction} readOnly={readOnly} />
    </li>
  );
}

function Usage({ used, max }: { used: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (used / max) * 100) : 100;
  return (
    <div className="mt-8 rounded-2xl border border-line/70 bg-panel p-4 shadow-sm">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{t('Storage')}</span>
        <span className="text-muted">{t('{used} of {max} used', { used: fmtSize(used), max: fmtSize(max) })}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel-2">
        <div className={cn('h-full rounded-full', pct > 90 ? 'bg-danger' : 'bg-accent')} style={{ width: `${Math.max(pct, used ? 1 : 0)}%` }} />
      </div>
    </div>
  );
}

function Loading({ layout }: { layout: Layout }) {
  return (
    <ul className={layout === 'grid' ? 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'grid gap-2'} aria-busy aria-label={t('Loading…')}>
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i} className={cn('animate-pulse rounded-2xl bg-panel-2', layout === 'grid' ? 'aspect-[4/3.6]' : 'h-14')} />
      ))}
    </ul>
  );
}

function Empty({ view, q, folder, onNew }: { view: View | 'search'; q: string; folder: boolean; onNew: () => void }) {
  if (view === 'search') return <p className="py-12 text-center text-sm text-muted">{t('Nothing matches “{q}”.', { q: q.trim() })}</p>;
  const [icon, head, body] = view === 'shared' && !folder ? [<Users key="i" />, t('Nothing shared with you yet'), t('When friends share files or folders with you, they show up here.')]
    : view === 'trash' ? [<Trash2 key="i" />, t('The Trash is empty'), t('Things you delete wait here for {n} days, in case you change your mind.', { n: TRASH_DAYS })]
    : view === 'starred' ? [<Star key="i" />, t('Nothing starred yet'), t('Star the files and folders you open most to find them here.')]
    : view === 'recent' ? [<Clock key="i" />, t('No recent files'), t('Files you upload show up here.')]
    : folder ? [<FolderUp key="i" />, t('This folder is empty'), t('Upload files here, or drop them on this window.')]
    : [<HardDrive key="i" />, t('Your files, in one place'), t('Upload photos, videos, PDFs and documents and open them on any of your devices. Only your devices can read them.')];
  return (
    <div className="mt-4 rounded-3xl border border-line/70 bg-panel p-8 text-center shadow-sm">
      <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent/15 text-accent [&_svg]:size-8">{icon}</span>
      <h3 className="mt-4 text-lg font-bold">{head}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{body}</p>
      {(view === 'drive') && <Button className="mt-5" onClick={onNew}><Upload className="size-4" />{t('Upload files')}</Button>}
    </div>
  );
}

/** Dropped folders, read through: every file with its path ("Trip/Day 1/photo.jpg"). */
async function readEntries(entries: FileSystemEntry[]): Promise<{ file: File; path: string }[]> {
  const out: { file: File; path: string }[] = [];
  const walk = async (en: FileSystemEntry, dir: string): Promise<void> => {
    if (en.isFile) {
      const file = await new Promise<File>((res, rej) => (en as FileSystemFileEntry).file(res, rej));
      out.push({ file, path: dir + file.name });
    } else if (en.isDirectory) {
      const reader = (en as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const c of batch) await walk(c, `${dir}${en.name}/`);
      }
    }
  };
  for (const en of entries) await walk(en, '');
  return out;
}

/** Its words (and the UI kit's) for the language now on come first. */
export default function DriveApp(props: AppProps) {
  useI18n({ ...DRIVE_DICTS, ...UI_DICTS });
  return <DriveAppInner {...props} />;
}

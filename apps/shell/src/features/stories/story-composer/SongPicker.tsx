import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileAudio, HardDrive, Search } from 'lucide-react';
import { Spinner } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input } from '@sanga/ui/input';
import { CLIP_SECONDS, decodeSong, searchSongs, songTitle, type Song, type SongHit } from '../../../lib/songs';
import { SongRow } from './SongRow';
import { SongTrim } from './SongTrim';
import { DriveSongs } from './DriveSongs';
import { t } from '@sanga/i18n';

/** Add a song to a story: search for one (30-second previews), or pick one from your Drive or your phone
 *  and choose which part of it to use. */
export function SongPicker({ onPick, onClose }: { onPick: (song: Song) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SongHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [playing, setPlaying] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [view, setView] = useState<'search' | 'drive'>('search');
  const [trim, setTrim] = useState<{ song: AudioBuffer; title: string; from: 'search' | 'drive' } | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const file = useRef<HTMLInputElement>(null);

  // Search a moment after you stop typing.
  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits(null); setErr(''); setBusy(false); return; }
    setBusy(true);
    let live = true;
    const tm = setTimeout(() => {
      searchSongs(term).then((r) => { if (live) { setHits(r); setErr(''); } }, (e) => { if (live) setErr(e.message); }).finally(() => live && setBusy(false));
    }, 350);
    return () => { live = false; clearTimeout(tm); };
  }, [q]);

  const stop = () => { audio.current?.pause(); audio.current = null; setPlaying(null); };
  useEffect(() => stop, []);

  const preview = (s: SongHit) => {
    if (playing === s.id) return stop();
    stop();
    const a = new Audio(s.src);
    a.onended = () => setPlaying(null);
    a.play().then(() => setPlaying(s.id), () => toast.error(t('That preview can’t be played')));
    audio.current = a;
  };
  const use = (s: Song) => { stop(); onPick({ title: s.title, artist: s.artist, src: s.src, ...(s.art && { art: s.art }) }); };

  // A file (from the phone or the Drive): open it, then choose the part.
  const pickFile = async (f: File | undefined, from: 'search' | 'drive' = 'search') => {
    if (!f) return;
    stop(); setReading(true);
    try { setTrim({ song: await decodeSong(f), title: songTitle(f.name), from }); }
    catch (e) { toast.error((e as Error).message); }
    setReading(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && (stop(), onClose())} title={trim ? t('Choose the part') : view === 'drive' ? t('Songs in your Drive') : t('Add a song')}
      description={trim || view === 'drive' ? undefined : t('Search for a song, or use one from your Drive or your phone.')}>
      {trim ? <SongTrim song={trim.song} title={trim.title} onPick={use} onBack={() => { setView(trim.from); setTrim(null); }} />
      : view === 'drive' ? (reading ? <div className="grid place-items-center py-16"><Spinner /></div> : <DriveSongs onOpen={(f) => void pickFile(f, 'drive')} onBack={() => setView('search')} />)
      : <>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search songs or artists')} aria-label={t('Search songs')} className="pl-10" autoFocus />
      </div>

      <div className="mt-3 min-h-40">
        {busy && !hits ? <div className="grid place-items-center py-10"><Spinner /></div> // i18n-ok
          : err ? <p className="py-10 text-center text-sm text-muted">{err}</p>
          : hits === null ? <p className="py-10 text-center text-sm text-muted">{t('Type a song or an artist to find a 30-second preview.')}</p>
          : hits.length === 0 ? <p className="py-10 text-center text-sm text-muted">{t('No songs found.')}</p>
          : (
            <ul className="-mx-1 max-h-[45dvh] overflow-y-auto" aria-label={t('Songs')}>
              {hits.map((s) => <SongRow key={s.id} song={s} playing={playing === s.id} onPlay={() => preview(s)} onPick={() => use(s)} />)}
            </ul>
          )}
      </div>

      <button onClick={() => { stop(); setView('drive'); }} disabled={reading}
        className="mt-3 flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:bg-hover disabled:opacity-60">
        <HardDrive className="size-6 text-muted" />
        <span>
          <span className="block font-medium">{t('From my Drive')}</span>
          <span className="block text-sm text-muted">{t('Search the songs you keep in Drive, and pick the part you like.')}</span>
        </span>
      </button>
      <button onClick={() => file.current?.click()} disabled={reading}
        className="mt-3 flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:bg-hover disabled:opacity-60">
        {reading ? <Spinner /> : <FileAudio className="size-6 text-muted" />}
        <span>
          <span className="block font-medium">{t('From my phone')}</span>
          <span className="block text-sm text-muted">{t('An MP3, M4A or WAV file. You pick which {n} seconds.', { n: CLIP_SECONDS })}</span>
        </span>
      </button>
      </>}
      <input ref={file} type="file" accept="audio/*" hidden aria-label={t('Choose an audio file')} onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
    </Dialog>
  );
}

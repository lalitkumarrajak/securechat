import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileAudio, Search } from 'lucide-react';
import { Spinner } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input } from '@sanga/ui/input';
import { CLIP_SECONDS, clipFromFile, searchSongs, type Song, type SongHit } from '../../../lib/songs';
import { SongRow } from './SongRow';

/** Add a song to a story: search for one (30-second previews), or use a file from your phone. */
export function SongPicker({ onPick, onClose }: { onPick: (song: Song) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SongHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [playing, setPlaying] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const file = useRef<HTMLInputElement>(null);

  // Search a moment after you stop typing.
  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits(null); setErr(''); setBusy(false); return; }
    setBusy(true);
    let live = true;
    const t = setTimeout(() => {
      searchSongs(term).then((r) => { if (live) { setHits(r); setErr(''); } }, (e) => { if (live) setErr(e.message); }).finally(() => live && setBusy(false));
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  const stop = () => { audio.current?.pause(); audio.current = null; setPlaying(null); };
  useEffect(() => stop, []);

  const preview = (s: SongHit) => {
    if (playing === s.id) return stop();
    stop();
    const a = new Audio(s.src);
    a.onended = () => setPlaying(null);
    a.play().then(() => setPlaying(s.id), () => toast.error('That preview can’t be played'));
    audio.current = a;
  };
  const use = (s: Song) => { stop(); onPick({ title: s.title, artist: s.artist, src: s.src, ...(s.art && { art: s.art }) }); };

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    setReading(true);
    try { use(await clipFromFile(f)); }
    catch (e) { toast.error((e as Error).message); }
    setReading(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && (stop(), onClose())} title="Add a song" description="Search for a song, or use one from your phone.">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search songs or artists" aria-label="Search songs" className="pl-10" autoFocus />
      </div>

      <div className="mt-3 min-h-40">
        {busy && !hits ? <div className="grid place-items-center py-10"><Spinner /></div>
          : err ? <p className="py-10 text-center text-sm text-muted">{err}</p>
          : hits === null ? <p className="py-10 text-center text-sm text-muted">Type a song or an artist to find a 30-second preview.</p>
          : hits.length === 0 ? <p className="py-10 text-center text-sm text-muted">No songs found.</p>
          : (
            <ul className="-mx-1 max-h-[45dvh] overflow-y-auto" aria-label="Songs">
              {hits.map((s) => <SongRow key={s.id} song={s} playing={playing === s.id} onPlay={() => preview(s)} onPick={() => use(s)} />)}
            </ul>
          )}
      </div>

      <button onClick={() => file.current?.click()} disabled={reading}
        className="mt-3 flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:bg-hover disabled:opacity-60">
        {reading ? <Spinner /> : <FileAudio className="size-6 text-muted" />}
        <span>
          <span className="block font-medium">From my phone</span>
          <span className="block text-sm text-muted">An MP3, M4A or WAV file. The first {CLIP_SECONDS} seconds are used.</span>
        </span>
      </button>
      <input ref={file} type="file" accept="audio/*" hidden aria-label="Choose an audio file" onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
    </Dialog>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Music2, Volume2, VolumeX } from 'lucide-react';
import type { Song } from '../../../lib/songs';
import { t } from '@sanga/i18n';

// Muting sticks for the stories after this one, until the viewer is closed.
let muted = false;

/** A story's song: plays while the story plays (and loops), with its title and a mute button. */
export function SongChip({ song, paused }: { song: Song; paused: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [off, setOff] = useState(muted);
  const [blocked, setBlocked] = useState(false); // the browser wouldn't start it by itself: a tap does

  const want = !paused && !off;
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    if (!want) return a.pause();
    a.play().then(() => setBlocked(false), () => setBlocked(true));
  }, [want, song.src]);
  useEffect(() => () => { muted = false; }, []);

  const toggle = () => {
    if (blocked) { setOff(false); muted = false; audio.current?.play().then(() => setBlocked(false), () => {}); return; }
    muted = !off;
    setOff(!off);
  };

  return (
    <div className="absolute top-24 left-3 z-10 max-w-[80%]" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
      <audio ref={audio} src={song.src} loop preload="auto" />
      <button onClick={toggle} aria-label={blocked || off ? t('Play song {title}', { title: song.title }) : t('Mute song {title}', { title: song.title })}
        className="flex max-w-full items-center gap-2 rounded-full bg-black/55 py-1.5 pr-3 pl-2 text-sm backdrop-blur">
        {song.art ? <img src={song.art} alt="" className="size-6 rounded-full object-cover" /> : <Music2 className="size-4 shrink-0" />}
        <span className="truncate font-medium">{song.title}</span>
        {song.artist && <span className="truncate text-white/70">· {song.artist}</span>}
        {blocked || off ? <VolumeX className="size-4 shrink-0" /> : <Volume2 className="size-4 shrink-0" />}
      </button>
    </div>
  );
}

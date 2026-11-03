import { Music2, Pause, Play } from 'lucide-react';
import type { SongHit } from '../../../lib/songs';
import { t } from '@sanga/i18n';

/** One search result: tap the song to use it, or the button to hear it first. */
export function SongRow({ song, playing, onPlay, onPick }: { song: SongHit; playing: boolean; onPlay: () => void; onPick: () => void }) {
  return (
    <li className="flex items-center gap-1 rounded-xl hover:bg-hover">
      <button onClick={onPick} aria-label={t('Use {title}', { title: song.title })} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left">
        {song.art ? <img src={song.art} alt="" className="size-11 shrink-0 rounded-lg object-cover" /> : (
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-panel-2 text-muted"><Music2 className="size-5" /></span>
        )}
        <span className="min-w-0">
          <span className="block truncate font-medium">{song.title}</span>
          <span className="block truncate text-sm text-muted">{song.artist}</span>
        </span>
      </button>
      <button onClick={onPlay} aria-label={playing ? t('Pause {title}', { title: song.title }) : t('Preview {title}', { title: song.title })}
        className="mr-1 grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-ink">
        {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
      </button>
    </li>
  );
}

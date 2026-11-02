import { Music2, X } from 'lucide-react';
import type { Song } from '../../../lib/songs';

/** The song chosen for a story, with a way to take it off. */
export function ChosenSong({ song, onChange, onRemove }: { song: Song; onChange: () => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-white/12 py-1 pr-1 pl-3 text-sm text-white">
      <button onClick={onChange} aria-label={`Song: ${song.title}. Change it`} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <Music2 className="size-4 shrink-0" />
        <span className="truncate font-medium">{song.title}</span>
        {song.artist && <span className="truncate text-white/70">· {song.artist}</span>}
      </button>
      <button onClick={onRemove} aria-label="Remove song" className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/15"><X className="size-4" /></button>
    </div>
  );
}

// For the rest of Sanga: your Drive's songs, to pick one for a story. The shell loads this module
// ('drive/picker') only when you choose "From my Drive"; the files open here, on your device, as always.
import { all, fileBlob, inTrash, pathTo, startDrive, syncDrive, useDrive, type Entry } from './store';
import { kindOf } from './kinds';

/** Songs bigger than this aren't offered: the whole file is opened on the phone to cut a part out. */
export const MAX_SONG = 80e6;

export interface DriveSong { id: string; name: string; size: number; edited: number; folder: string }

const isSong = (e: Entry) => e.type === 'file' && !!e.key && !!e.chunks && kindOf(e.mime ?? '', e.name) === 'audio' && !inTrash(e);

/** Every song in your Drive (not the Trash), newest first, with the folder it's in. Fetches the latest list. */
export async function driveSongs(): Promise<DriveSong[]> {
  await startDrive();
  await syncDrive();
  return all()
    .filter(isSong)
    .sort((a, b) => b.edited - a.edited)
    .map((e) => ({ id: e.id, name: e.name, size: e.size ?? 0, edited: e.edited, folder: pathTo(e.parent).map((f) => f.name).join(' / ') }));
}

/** One of them, opened. `onProgress` hears how far along (0–1). */
export async function openDriveSong(id: string, onProgress?: (p: number) => void): Promise<File> {
  const e = useDrive.getState().entries[id];
  if (!e || !isSong(e)) throw new Error('missing');
  const off = onProgress ? useDrive.subscribe((s) => { const p = s.fetching[id]; if (p != null) onProgress(p); }) : () => {};
  try {
    const blob = await fileBlob(e);
    return new File([blob], e.name, { type: e.mime || blob.type });
  } finally { off(); }
}

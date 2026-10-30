import { EMOJI_PICKER } from '../../lib/emoji';
import { recent } from './expressionPanel';

export function EmojiTab({ onPick }: { onPick: (e: string) => void }) {
  const rec = recent('emoji');
  const grid = (list: string[]) => (
    <div className="grid grid-cols-8 gap-0.5 px-2 sm:grid-cols-10">
      {list.map((e, i) => (
        <button key={i + e} onClick={() => onPick(e)} className="grid aspect-square place-items-center rounded-lg text-[1.65rem] hover:bg-hover active:scale-90">{e}</button>
      ))}
    </div>
  );
  return (
    <div className="py-2">
      {rec.length > 0 && <><h3 className="px-4 pb-1 text-xs font-semibold text-muted">Recent</h3>{grid(rec)}</>}
      <h3 className="px-4 pt-2 pb-1 text-xs font-semibold text-muted">Smileys & more</h3>
      {grid(EMOJI_PICKER)}
    </div>
  );
}

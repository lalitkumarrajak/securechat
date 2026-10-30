import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Heart, Send } from 'lucide-react';
import { Spinner } from '@sanga/ui/button';
import { commentOn, likeStory, type StoryMeta } from '../../../lib/stories';
import { cn } from '@sanga/ui/utils';

export function ReplyBar({ s, name, onTyping }: { s: StoryMeta; name: string; onTyping: (t: boolean) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setText(''), [s.id]);
  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await commentOn(s, t);
      setText('');
      toast.success(`Comment sent to ${name}`, { description: 'Only they can see it.' });
      (document.activeElement as HTMLElement | null)?.blur();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };
  return (
    <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={`Comment to ${name}…`} aria-label="Comment"
        onFocus={() => onTyping(true)} onBlur={() => onTyping(false)} enterKeyHint="send"
        className="h-11 min-w-0 flex-1 rounded-full border border-white/40 bg-transparent px-4 text-[15px] text-white outline-none placeholder:text-white/60 focus:border-white" />
      {text.trim() ? (
        <button type="submit" aria-label="Send comment" disabled={busy} className="grid size-11 place-items-center rounded-full bg-accent text-white disabled:opacity-60">
          {busy ? <Spinner /> : <Send className="size-5" />}
        </button>
      ) : (
        <button type="button" aria-label={s.liked ? 'Unlike' : 'Like'} aria-pressed={s.liked}
          onClick={() => likeStory(s, !s.liked).catch((e) => toast.error(e.message))}
          className="grid size-11 place-items-center rounded-full active:scale-90">
          <Heart className={cn('size-7 transition', s.liked && 'scale-110 fill-rose-500 text-rose-500')} />
        </button>
      )}
    </form>
  );
}

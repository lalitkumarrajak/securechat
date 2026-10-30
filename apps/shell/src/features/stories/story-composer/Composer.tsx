import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, ImagePlus, Lock, Palette, Send, Type, UserPlus, Users, X } from 'lucide-react';
import { Spinner } from '@sanga/ui/button';
import { compressImage } from '../../../lib/image';
import { BACKGROUNDS, MAX_CAPTION, MAX_TEXT, postStory, type StoryContent } from '../../../lib/stories';
import { displayName } from '../../../lib/types';
import { useApp } from '../../../state/app';
import { FriendPicker } from '../../groups/FriendPicker';
import { Draft } from './types';
import { TextArea } from './TextArea';
import { Pill } from './Pill';
import { Choice } from './Choice';

export function Composer({ prefill, onClose }: { prefill?: StoryContent; onClose: () => void }) {
  const friends = useApp((s) => s.friends);
  const [draft, setDraft] = useState<Draft>(() => prefill?.type === 'img' ? { kind: 'img', src: prefill.src, w: prefill.w, h: prefill.h } : prefill ? { kind: 'text' } : null);
  const [text, setText] = useState(prefill?.text || '');
  const [bg, setBg] = useState(prefill?.type === 'text' ? prefill.bg : Math.floor(Math.random() * BACKGROUNDS.length));
  const [tags, setTags] = useState<string[]>([]);
  const [only, setOnly] = useState<string[] | null>(null); // null: all friends
  const [page, setPage] = useState<'edit' | 'tags' | 'audience'>('edit');
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const allFriends = Object.keys(friends);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const img = await compressImage(f, 1440);
      setDraft({ kind: 'img', ...img });
      setText('');
    } catch (e) { toast.error((e as Error).message || 'That photo can’t be opened'); }
    setBusy(false);
  };

  const share = async () => {
    if (!draft || busy) return;
    const audience = [...new Set([...(only ?? allFriends), ...tags])]; // tagged friends always see it
    const content: StoryContent = draft.kind === 'img'
      ? { type: 'img', src: draft.src, w: draft.w, h: draft.h, text: text.trim().slice(0, MAX_CAPTION) }
      : { type: 'text', text: text.trim().slice(0, MAX_TEXT), bg };
    if (content.type === 'text' && !content.text) return toast.error('Write something first');
    if (tags.length) content.tags = tags;
    if (prefill?.via) content.via = prefill.via;
    setBusy(true);
    try {
      await postStory(content, audience);
      toast.success('Story shared', { description: 'Your friends can see it for 24 hours.' });
      onClose();
    } catch (e) { toast.error((e as Error).message); setBusy(false); }
  };

  if (page !== 'edit') {
    const tagging = page === 'tags';
    return (
      <div className="flex h-full w-full max-w-lg flex-col bg-panel text-ink">
        <header className="flex h-16 shrink-0 items-center gap-2 px-3">
          <button onClick={() => setPage('edit')} aria-label="Back" className="grid size-10 place-items-center rounded-full hover:bg-hover"><ArrowLeft className="size-5" /></button>
          <h2 className="flex-1 text-lg font-semibold">{tagging ? 'Tag friends' : 'Who can see this story'}</h2>
          <button onClick={() => setPage('edit')} className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white">Done</button>
        </header>
        {tagging ? (
          <>
            <p className="px-4 pb-3 text-sm text-muted">Tagged friends get a notification, can always see it and can add it to their own story.</p>
            <FriendPicker picked={tags} onChange={setTags} max={20} />
          </>
        ) : (
          <>
            <div className="space-y-1 px-2 pb-2" role="radiogroup" aria-label="Who can see this story">
              <Choice on={only === null} onClick={() => setOnly(null)} icon={<Users />} title="All friends" sub={`${allFriends.length} friend${allFriends.length === 1 ? '' : 's'}`} />
              <Choice on={only !== null} onClick={() => setOnly(only ?? [])} icon={<Lock />} title="Only share with…" sub={only ? `${only.length} selected` : 'Pick friends'} />
            </div>
            {only !== null && <FriendPicker picked={only} onChange={setOnly} max={1000} />}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full max-w-[min(100vw,calc(100dvh*0.5625+120px))] flex-col">
      <header className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button onClick={() => (draft && !prefill ? setDraft(null) : onClose())} aria-label={draft && !prefill ? 'Back' : 'Close'}
          className="grid size-10 place-items-center rounded-full bg-black/30 hover:bg-black/50">{draft && !prefill ? <ArrowLeft className="size-5" /> : <X className="size-5" />}</button>
        <span className="flex-1" />
        {draft?.kind === 'text' && (
          <button onClick={() => setBg((bg + 1) % BACKGROUNDS.length)} aria-label="Change colour" className="grid size-10 place-items-center rounded-full bg-black/30 hover:bg-black/50">
            <Palette className="size-5" />
          </button>
        )}
      </header>

      <div className="relative grid min-h-0 flex-1 place-items-center overflow-hidden">
        {!draft ? (
          <div className="grid w-full max-w-xs gap-3 px-6">
            <h2 className="mb-2 text-center text-xl font-semibold">New story</h2>
            <button onClick={() => file.current?.click()} disabled={busy}
              className="flex items-center gap-4 rounded-2xl bg-white/10 px-5 py-4 text-left hover:bg-white/15">
              {busy ? <Spinner /> : <ImagePlus className="size-7" />}
              <span><span className="block font-semibold">Photo</span><span className="block text-sm text-white/70">From your gallery or camera</span></span>
            </button>
            <button onClick={() => setDraft({ kind: 'text' })} className="flex items-center gap-4 rounded-2xl bg-white/10 px-5 py-4 text-left hover:bg-white/15">
              <Type className="size-7" />
              <span><span className="block font-semibold">Text</span><span className="block text-sm text-white/70">A few words on a colour</span></span>
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-white/60"><Lock className="size-3.5" /> End-to-end encrypted · gone after 24 hours</p>
          </div>
        ) : draft.kind === 'img' ? (
          <img src={draft.src} alt="Your photo" className="absolute inset-0 size-full object-contain" />
        ) : (
          <div className="grid size-full place-items-center p-8" style={{ background: BACKGROUNDS[bg] }}>
            <TextArea value={text} onChange={setText} />
          </div>
        )}
      </div>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />

      {draft && (
        <footer className="space-y-2 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {draft.kind === 'img' && (
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_CAPTION} placeholder="Add a caption…" aria-label="Caption"
              className="h-11 w-full rounded-full bg-white/12 px-4 text-[15px] text-white outline-none placeholder:text-white/60 focus:bg-white/18" />
          )}
          {tags.length > 0 && (
            <p className="truncate px-1 text-sm text-white/80">with {tags.map((t) => displayName(friends[t], t)).join(', ')}</p>
          )}
          <div className="flex items-center gap-2">
            <Pill onClick={() => setPage('tags')} icon={<UserPlus className="size-4" />}>{tags.length ? `Tagged ${tags.length}` : 'Tag friends'}</Pill>
            <Pill onClick={() => setPage('audience')} icon={only ? <Lock className="size-4" /> : <Users className="size-4" />}>
              {only ? `${only.length} friend${only.length === 1 ? '' : 's'}` : 'All friends'}
            </Pill>
            <span className="flex-1" />
            <button onClick={share} disabled={busy || (only !== null && !only.length && !tags.length)} aria-label="Share story"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 font-semibold text-white disabled:opacity-50">
              {busy ? <Spinner /> : <Send className="size-4" />} Share
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

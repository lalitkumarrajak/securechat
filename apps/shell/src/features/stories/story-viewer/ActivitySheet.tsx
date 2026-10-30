import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Heart, Trash2 } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { Spinner } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { fmtAgo } from '@sanga/ui/format';
import { deleteComment, storyActivity, useStories, type StoryActivity, type StoryMeta } from '../../../lib/stories';
import { displayName } from '../../../lib/types';
import { useApp } from '../../../state/app';
import { CommentText } from './CommentText';

/** Your story: who viewed it (a heart if they liked it) and the comments. */
export function ActivitySheet({ s, onClose }: { s: StoryMeta; onClose: () => void }) {
  const friends = useApp((st) => st.friends);
  const bump = useStories((st) => st.activity);
  const [a, setA] = useState<StoryActivity | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { storyActivity(s).then(setA, (e) => setErr(e.message)); }, [s.id, bump]); // eslint-disable-line react-hooks/exhaustive-deps
  const nameOf = (u: string) => displayName(friends[u], u);
  const remove = async (cid: string) => {
    try { await deleteComment(s, cid); setA((x) => x && { ...x, comments: x.comments.filter((c) => c.id !== cid) }); }
    catch (e) { toast.error((e as Error).message); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Story activity">
      {!a ? <div className="grid place-items-center py-8">{err ? <p className="text-sm text-muted">{err}</p> : <Spinner />}</div> : (
        <div className="space-y-5">
          <section>
            <h3 className="mb-1 text-sm font-semibold text-muted">Viewed by {a.views?.length ?? 0}</h3>
            {!a.views?.length ? <p className="py-2 text-sm text-muted">No one has seen it yet.</p> : (
              <ul>
                {a.views.map((v) => (
                  <li key={v.u} className="flex items-center gap-3 py-1.5">
                    <Avatar u={v.u} name={nameOf(v.u)} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{nameOf(v.u)}</span>
                      <span className="block text-xs text-muted">{fmtAgo(v.ts)}</span>
                    </span>
                    {v.liked && <Heart className="size-5 fill-rose-500 text-rose-500" aria-label="Liked" />}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="mb-1 text-sm font-semibold text-muted">Comments {a.comments.length ? `(${a.comments.length})` : ''}</h3>
            {!a.comments.length ? <p className="py-2 text-sm text-muted">No comments yet. Only you see the comments on your story.</p> : (
              <ul>
                {a.comments.map((c) => (
                  <li key={c.id} className="flex items-start gap-3 py-1.5">
                    <Avatar u={c.u} name={nameOf(c.u)} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm"><b className="font-semibold">{nameOf(c.u)}</b> <span className="text-xs text-muted">{fmtAgo(c.ts)}</span></span>
                      <CommentText text={c.text} />
                    </span>
                    <button onClick={() => remove(c.id)} aria-label="Delete comment" className="rounded-full p-1.5 text-muted hover:bg-hover hover:text-danger">
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Dialog>
  );
}

import { Ban, Lock } from 'lucide-react';
import { type Msg } from '../../../lib/types';
import { splitMentions } from '../../../lib/mentions';
import { cn } from '@sanga/ui/utils';
import { BigEmoji } from '../BigEmoji';
import { Emoji } from '../Emoji';
import { FileCard } from '../FileCard';
import { LinkPreviewCard } from '../LinkPreviewCard';
import { LocationCard } from '../LocationCard';
import { VoicePlayer } from '../VoicePlayer';
import { openGallery } from '../chatUi';
import { Linkify } from './Linkify';
import { Marked } from './Marked';
import { CallCard } from './CallCard';

export function Body({ m, emoji, me, members }: { m: Msg; emoji: string[] | null; me: string; members?: string[] }) {
  if (m.type === 'deleted') {
    return <span className="flex items-center gap-1.5 pr-14 text-muted italic"><Ban className="size-4" /> {m.out ? 'You deleted this message' : 'This message was deleted'}</span>;
  }
  if (m.type === 'err') {
    return (
      <span className="flex items-center gap-1.5 pr-14 text-muted italic"><Lock className="size-4" />
        {m.pending ? 'Waiting for this message. It appears once the sender’s phone is online.' : 'This message couldn’t be decrypted'}
      </span>
    );
  }
  if (emoji) return <BigEmoji parts={emoji} className={m.re ? 'px-0.5 pt-1 pb-0.5' : undefined} />;
  if (m.type === 'img') {
    return (
      <>
        <button className="block" onClick={(e) => { e.stopPropagation(); openGallery(m); }} aria-label="View photo">
          <img src={m.src} alt="Photo" loading="lazy" width={m.w || undefined} height={m.h || undefined}
            className="block h-auto max-h-80 w-auto max-w-[min(300px,70vw)] rounded-xl object-cover" />
        </button>
        {m.text && <p className="px-1.5 pt-1 whitespace-pre-wrap [overflow-wrap:anywhere]"><Marked text={m.text} /></p>}
      </>
    );
  }
  if (m.type === 'sticker') {
    // Built-in stickers animate once (tap to replay); KLIPY stickers are animated images.
    if (m.src!.startsWith('noto:')) return <Emoji e={m.src!.slice(5)} size={128} />;
    return <img src={m.src} alt="Sticker" loading="lazy" referrerPolicy="no-referrer" className="block size-36 object-contain" />;
  }
  if (m.type === 'gif') {
    return (
      <span className="relative block">
        <img src={m.src} alt="GIF" loading="lazy" referrerPolicy="no-referrer" width={m.w || undefined} height={m.h || undefined}
          className="block h-auto max-h-72 w-auto max-w-[min(260px,65vw)] rounded-xl bg-panel-2 object-cover" />
        <span className="absolute top-1.5 left-1.5 rounded bg-black/50 px-1 text-[10px] font-bold text-white">GIF</span>
      </span>
    );
  }
  if (m.type === 'call' && m.call) return <CallCard m={m} />;
  if (m.type === 'file') return <FileCard m={m} />;
  if (m.type === 'location') return <LocationCard m={m} />;
  if (m.type === 'voice') return <VoicePlayer src={m.src!} dur={m.dur || 0} peaks={m.peaks || []} out={m.out} />;
  return (
    <>
      {m.lp && <LinkPreviewCard lp={m.lp} out={m.out} />}
      <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">
        {members ? splitMentions(m.text || '', members).map((part, i) => part.u ? (
          <span key={i} className={cn('font-semibold', part.u === me ? 'rounded bg-amber-300/80 px-0.5 text-amber-950' : 'text-accent-ink')}>{part.t}</span>
        ) : <Linkify key={i} text={part.t} />) : <Linkify text={m.text || ''} />}
      </span>
    </>
  );
}

// The panel under the message box (where the keyboard is), like WhatsApp: Emoji | GIFs | Stickers.
import { Delete, Smile, Sticker } from 'lucide-react';
import type { GifItem } from '../../lib/types';
import { useApp } from '../../state/app';
import { remember } from './expressionPanel';
import { TabButton } from './TabButton';
import { EmojiTab } from './EmojiTab';
import { StickerTab } from './StickerTab';
import { KlipyTab } from './KlipyTab';

export type PanelTab = 'emoji' | 'gifs' | 'stickers';

export function ExpressionPanel({ tab, setTab, onEmoji, onBackspace, onGif, onSticker }: {
  tab: PanelTab; setTab: (t: PanelTab) => void;
  onEmoji: (e: string) => void; onBackspace: () => void;
  onGif: (g: GifItem) => void; onSticker: (s: string | GifItem) => void;
}) {
  const gifs = useApp((s) => s.gifsEnabled);
  return (
    <div className="flex h-[300px] shrink-0 flex-col border-t border-line bg-panel" role="dialog" aria-label="Emoji, GIFs and stickers">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'emoji' && <EmojiTab onPick={(e) => { remember('emoji', e); onEmoji(e); }} />}
        {tab === 'gifs' && <KlipyTab kind="gifs" onPick={onGif} />}
        {tab === 'stickers' && <StickerTab onPick={(s) => { if (typeof s === 'string') remember('sticker', s); onSticker(s); }} />}
      </div>
      <div className="flex items-center gap-1 border-t border-line px-2 py-1">
        <TabButton active={tab === 'emoji'} onClick={() => setTab('emoji')} label="Emoji"><Smile className="size-5" /></TabButton>
        {gifs && <TabButton active={tab === 'gifs'} onClick={() => setTab('gifs')} label="GIFs"><span className="text-xs font-bold">GIF</span></TabButton>}
        <TabButton active={tab === 'stickers'} onClick={() => setTab('stickers')} label="Stickers"><Sticker className="size-5" /></TabButton>
        <span className="flex-1" />
        {tab === 'emoji' && (
          <button onClick={onBackspace} aria-label="Delete" className="grid size-10 place-items-center rounded-full text-muted hover:bg-hover"><Delete className="size-5" /></button>
        )}
      </div>
    </div>
  );
}

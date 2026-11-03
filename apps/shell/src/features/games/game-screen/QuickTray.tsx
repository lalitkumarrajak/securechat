import { X } from 'lucide-react';
import { t } from '@sanga/i18n';
import { QUICK_EMOJI, PHRASES } from './quickMessages';

export function QuickTray({ onPick, onClose }: { onPick: (x: string) => void; onClose: () => void }) {
  return (
    <div className="absolute bottom-full left-1/2 z-20 mb-2 w-[min(94vw,420px)] -translate-x-1/2 rounded-2xl bg-white p-3 text-slate-900 shadow-2xl animate-fade-in"
      role="menu" aria-label={t('Quick messages')}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{t('Send to everyone · tap a player to tease')}</span>
        <button type="button" onClick={onClose} aria-label={t('Close')} className="rounded-full p-1 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {QUICK_EMOJI.map((e) => (
          <button key={e} type="button" role="menuitem" onClick={() => onPick(e)} className="rounded-xl py-1.5 text-3xl hover:bg-slate-100" aria-label={e}>{e}</button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PHRASES.map((p) => (
          <button key={p} type="button" role="menuitem" onClick={() => onPick(t(p))}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium hover:bg-slate-200">{t(p)}</button>
        ))}
      </div>
    </div>
  );
}

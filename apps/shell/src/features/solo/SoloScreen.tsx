// A solo game, full screen: Back, its name, How to play (shown by itself the first time), and the
// game, whose code downloads now (the first time) behind a spinner.
import { Suspense, useEffect, useState } from 'react';
import { ArrowLeft, CircleHelp } from 'lucide-react';
import { IconButton, Spinner } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Button } from '@sanga/ui/button';
import { t } from '@sanga/i18n';
import { soloById } from './registry';
import { closeSolo, useSolo } from './store';

const SEEN = 'sanga-solo-howto';
const seen = (): string[] => { try { return JSON.parse(localStorage.getItem(SEEN) ?? '[]'); } catch { return []; } };
const markSeen = (id: string) => { try { localStorage.setItem(SEEN, JSON.stringify([...new Set([...seen(), id])])); } catch { /* shown again next time */ } };

export function SoloScreen() {
  const id = useSolo((s) => s.open);
  const g = id ? soloById(id) : undefined;
  const [help, setHelp] = useState(false);
  useEffect(() => { if (g && !seen().includes(g.id) && !seen().includes('*')) { markSeen(g.id); setHelp(true); } }, [g]);
  if (!g) return null;
  const name = t(g.name);
  return (
    <div className="fixed inset-0 z-30 flex flex-col text-white" style={{ background: g.background }} role="dialog" aria-label={name}>
      <header className="flex h-14 shrink-0 items-center gap-1 px-2 pt-[env(safe-area-inset-top)]">
        <IconButton label={t('Back')} className="text-white hover:bg-white/10" onClick={closeSolo}><ArrowLeft /></IconButton>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold tracking-wide"><span aria-hidden>{g.emoji} </span>{name}</h1>
        <IconButton label={t('How to play')} className="text-white hover:bg-white/10" onClick={() => setHelp(true)}><CircleHelp /></IconButton>
      </header>
      <main className="relative min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">
        <Suspense fallback={<div className="grid h-full place-items-center" role="status" aria-label={t('Loading {game}', { game: name })}><Spinner /></div>}>
          <g.Game />
        </Suspense>
      </main>
      <Dialog open={help} onOpenChange={setHelp} title={t('How to play {game}', { game: name })}>
        <div className="grid gap-4">
          <ol className="grid gap-2.5">
            {g.steps.map((s, i) => (
              <li key={s} className="flex gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent-ink">{i + 1}</span>
                <span className="pt-0.5">{t(s)}</span>
              </li>
            ))}
          </ol>
          <Button onClick={() => setHelp(false)}>{t('Got it')}</Button>
        </div>
      </Dialog>
    </div>
  );
}

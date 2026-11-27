// Share a file or folder: with friends you pick (they find it in their Drive under "Shared with me",
// read-only), and/or by a link anyone can open, even without Sanga. Both stay up to date as the folder
// changes, and both can be stopped at any time.
import { useMemo, useState } from 'react';
import { Check, Copy, Link2, Share2, Users } from 'lucide-react';
import { t } from '@sanga/i18n';
import { Button, IconButton } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Switch } from '@sanga/ui/switch';
import { cn } from '@sanga/ui/utils';
import { sdk } from '@sanga/sdk';
import { setLink, setPeople, shareUrl, useDrive, type Entry } from './store';

const MAX_PEOPLE = 50;

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const a = document.createElement('textarea');
    a.value = text; a.setAttribute('readonly', ''); a.style.position = 'fixed'; a.style.opacity = '0';
    document.body.appendChild(a); a.select();
    const ok = document.execCommand('copy');
    a.remove();
    return ok;
  }
}

export function ShareDialog({ e: e0, onClose }: { e: Entry; onClose: () => void }) {
  const e = useDrive((s) => s.entries[e0.id]) ?? e0;
  const chats = sdk().useChats();
  const was = e.share?.to ?? [];
  const [picked, setPicked] = useState<string[]>(was);
  const [busy, setBusy] = useState<'' | 'people' | 'link'>('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Friends only (not groups); the ones it's shared with first.
  const friends = useMemo(() => {
    const list = chats.filter((c) => !c.peer.startsWith('g:'));
    for (const u of was) if (!list.some((c) => c.peer === u)) list.push({ peer: u, name: u });
    return list.sort((a, b) => Number(was.includes(b.peer)) - Number(was.includes(a.peer)) || a.name.localeCompare(b.name));
  }, [chats, was]);
  const toggle = (u: string) => setPicked((p) => (p.includes(u) ? p.filter((x) => x !== u) : p.length >= MAX_PEOPLE ? p : [...p, u]));
  const changed = picked.length !== was.length || picked.some((u) => !was.includes(u));
  const url = e.link ? shareUrl(e.link) : '';

  const run = async (what: 'people' | 'link', fn: () => Promise<unknown>) => { // i18n-ok
    setBusy(what); setError('');
    try { await fn(); } catch (err) { setError((err as Error).message || t('Something went wrong')); }
    finally { setBusy(''); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t('Share “{name}”', { name: e.name })}>
      <section aria-label={t('People')}>
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Users className="size-4 text-muted" />{t('Friends')}</h3>
        <p className="mb-2 text-sm text-muted">{e.type === 'folder' ? t('They see this folder and what’s in it under “Shared with me”, and can’t change it.') : t('They see it under “Shared with me”, and can’t change it.')}</p>
        {!friends.length ? <p className="py-3 text-center text-sm text-muted">{t('Add friends to share with them.')}</p> : (
          <ul className="-mx-2 max-h-[32vh] overflow-y-auto" role="group" aria-label={t('Friends')}>
            {friends.map((f) => {
              const on = picked.includes(f.peer);
              const A = sdk().Avatar;
              return (
                <li key={f.peer}>
                  <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(f.peer)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-hover">
                    <A u={f.peer} name={f.name} size={34} />
                    <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                    <span className={cn('grid size-6 place-items-center rounded-full border-2 transition', on ? 'border-accent bg-accent text-white' : 'border-line')}>{on && <Check className="size-4" />}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {changed && (
          <div className="mt-2 flex justify-end">
            <Button size="sm" loading={busy === 'people'} onClick={() => void run('people', () => setPeople(e, picked))}>
              {picked.length ? t('Share with {n}', { n: picked.length }) : t('Stop sharing with friends')}
            </Button>
          </div>
        )}
      </section>

      <hr className="my-4 border-line" />

      <section aria-label={t('Link')}>
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent"><Link2 className="size-[18px]" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t('Anyone with the link')}</p>
            <p className="text-sm text-muted">{t('Can view and download it, even without Sanga.')}</p>
          </div>
          <Switch checked={!!e.link} disabled={busy === 'link'} label={t('Anyone with the link')}
            onCheckedChange={(on) => void run('link', () => setLink(e, on))} />
        </div>
        {url && (
          <div className="mt-3 flex items-center gap-1 rounded-xl border border-line bg-panel-2 py-1 pr-1 pl-3">
            <input readOnly value={url} aria-label={t('Link')} onFocus={(ev) => ev.currentTarget.select()}
              className="min-w-0 flex-1 truncate bg-transparent text-sm text-muted outline-none" />
            <IconButton label={copied ? t('Copied') : t('Copy link')} size="icon-sm" className={cn(copied && 'text-accent')}
              onClick={async () => { if (await copy(url)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }}>
              {copied ? <Check /> : <Copy />}
            </IconButton>
            {typeof navigator.share === 'function' && (
              <IconButton label={t('Send to…')} size="icon-sm" onClick={() => void navigator.share({ title: e.name, url }).catch(() => {})}><Share2 /></IconButton>
            )}
          </div>
        )}
      </section>

      {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
      <div className="mt-5 flex justify-end">
        <Button variant="ghost" onClick={onClose}>{t('Done')}</Button>
      </div>
    </Dialog>
  );
}

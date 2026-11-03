import { t } from '@sanga/i18n';
import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { sdk } from '@sanga/sdk';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label } from '@sanga/ui/input';
import { linkPerson, renamePerson, type GroupData } from './store';
import { PersonDot } from './PersonDot';
import type { Person } from './model';

/** Edit someone who isn't on Sanga: rename them, or link them to a friend who has joined since. */
export function GuestDialog({ g, p, onClose }: { g: GroupData; p: Person | null; onClose: () => void }) {
  const chats = sdk().useChats();
  const online = sdk().useOnline();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [seen, setSeen] = useState<Person | null>(null);
  if (p !== seen) { setSeen(p); setName(p?.name ?? ''); setError(''); }
  const friends = chats.filter((c) => !c.peer.startsWith('g:'));
  const inGroup = new Set(g.members.map((m) => m.u));

  const link = async (u: string, n: string) => {
    if (!p) return;
    const merge = g.meta?.people.some((x) => x.u === u);
    const ok = await sdk().confirm({
      title: t('Link {guest} to {friend}?', { guest: p.name, friend: n }),
      description: merge
        ? t('{friend} is already in this group. Everything {guest} paid or owes moves onto {friend}, and the two become one person.', { guest: p.name, friend: n })
        : t('{friend} will be added to the group and can see its whole history, including what was written before they joined. Everything {guest} paid or owes moves onto {friend}.', { guest: p.name, friend: n }),
      confirmText: merge ? t('Merge') : t('Link and add'),
    });
    if (!ok) return;
    setBusy(u); setError('');
    try { await linkPerson(g.gid, p.id, u, n); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : t('Couldn’t link them')); }
    finally { setBusy(null); }
  };

  return (
    <Dialog open={!!p} onOpenChange={(o) => { if (!o) onClose(); }} title={p ? p.name : ''} description={t('Someone who isn’t on Sanga. Only you keep their records.')}>
      <div className="space-y-5">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (p && name.trim()) { renamePerson(g.gid, p.id, name); onClose(); } }}>
          <div className="flex-1"><Label htmlFor="gn">{t('Name')}</Label><Input id="gn" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <Button type="submit" variant="secondary" className="mt-[1.65rem]" disabled={!name.trim() || name.trim() === p?.name}>{t('Rename')}</Button>
        </form>
        <section>
          <h3 className="mb-1 text-sm font-semibold">{t('They joined Sanga?')}</h3>
          <p className="mb-2 text-xs text-muted">{t('Link this name to their account. Nothing they paid or owe is lost.')}</p>
          {!online && <p className="mb-2 rounded-xl bg-warn-bg p-3 text-sm">{t('You’re offline. Connect to link.')}</p>}
          {friends.length === 0 ? <p className="text-sm text-muted">{t('Add them as a friend in Sanga first, then link them here.')}</p> : (
            <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {friends.map((f) => (
                <li key={f.peer} className="flex items-center gap-3 px-3 py-2">
                  <PersonDot p={{ id: f.peer, name: f.name, u: f.peer }} name={f.name} size={32} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}{inGroup.has(f.peer) && <span className="ml-1 text-xs font-normal text-muted">{t('in group')}</span>}</span>
                  <Button size="sm" variant="outline" loading={busy === f.peer} disabled={!online || busy !== null} onClick={() => void link(f.peer, f.name)}><Link2 className="size-4" />{t('Link')}</Button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      </div>
    </Dialog>
  );
}

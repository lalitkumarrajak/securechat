import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { LogOut } from 'lucide-react';
import { Button, Spinner } from '@sanga/ui/button';
import { confirm } from '@sanga/ui/confirm';
import { listSessions, revokeSession } from '../../../lib/engine';
import { deviceName } from '../../../lib/device';
import type { Session } from '../../../lib/types';
import { Section } from './Section';
import { SessionRow } from './SessionRow';
import { t, tn } from '@sanga/i18n';

export function Sessions() {
  const [list, setList] = useState<Session[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => listSessions().then(setList).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);

  async function signOut(s: Session) {
    if (!(await confirm({ title: t('Sign out {device}?', { device: deviceName(s.ua, s.device) }), description: t('That device will be signed out right away. Messages stored on it stay there until someone signs in again.'), confirmText: t('Sign out'), destructive: true }))) return;
    setBusy(s.id);
    try { await revokeSession(s.id); toast.success(t('Device signed out')); await load(); } catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  }
  async function signOutOthers() {
    const others = (list || []).filter((s) => !s.current);
    if (!(await confirm({ title: tn(others.length, 'Sign out {n} other device?', 'Sign out {n} other devices?'), description: t('You’ll stay signed in on this device.'), confirmText: t('Sign out others'), destructive: true }))) return;
    setBusy('others');
    try { for (const s of others) await revokeSession(s.id); toast.success(t('Other devices signed out')); await load(); } catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  }

  if (!list) return <div className="grid place-items-center py-16 text-accent"><Spinner className="size-6" /></div>;
  const others = list.filter((s) => !s.current);
  return (
    <>
      <Section className="px-5 py-4">
        <p className="text-sm text-muted">{t('These devices are signed in to your account. If you don’t recognise one, sign it out and change your password.')}</p>
        <p className="mt-2 text-xs text-muted">{t('Locations are approximate, worked out from each device’s internet address (IP).')}</p>
      </Section>
      <Section title={t('This device')}><ul>{list.filter((s) => s.current).map((s) => <SessionRow key={s.id} s={s} />)}</ul></Section>
      <Section title={t('Other devices ({n})', { n: others.length })}>
        {!others.length && <p className="px-5 py-4 text-sm text-muted">{t('You’re not signed in anywhere else.')}</p>}
        <ul>
          {others.map((s) => (
            <SessionRow key={s.id} s={s}>
              <Button size="sm" variant="outline" className="text-danger" loading={busy === s.id} onClick={() => signOut(s)}>{t('Sign out')}</Button>
            </SessionRow>
          ))}
        </ul>
        {others.length > 1 && (
          <div className="px-5 pt-1 pb-4">
            <Button variant="danger" className="w-full" loading={busy === 'others'} onClick={signOutOthers}><LogOut className="size-4" /> {t('Sign out all other devices')}</Button>
          </div>
        )}
      </Section>
    </>
  );
}

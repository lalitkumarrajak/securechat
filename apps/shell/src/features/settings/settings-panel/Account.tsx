import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { LogOut, MonitorSmartphone, UserRound } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { confirm } from '@sanga/ui/confirm';
import { Input, Label } from '@sanga/ui/input';
import { changePassword, logout } from '../../../lib/engine';
import { useApp } from '../../../state/app';
import { NavRow } from './NavRow';
import { Section } from './Section';
import type { Page } from './types';

export function Account({ go }: { go: (p: Page) => void }) {
  const me = useApp((s) => s.me)!;
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (next.length < 8) return setError('Use at least 8 characters.');
    if (next !== next2) return setError('The new passwords don’t match.');
    setBusy(true);
    try {
      await changePassword(cur, next);
      setCur(''); setNext(''); setNext2('');
      toast.success('Password changed', { description: 'Your other devices were signed out.' });
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  return (
    <>
      <Section title="Change password" className="px-5 pb-5">
        <form onSubmit={submit} className="mt-3 grid gap-3">
          <input type="text" autoComplete="username" value={me.u} readOnly hidden />
          <div><Label htmlFor="pw-cur">Current password</Label><Input id="pw-cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></div>
          <div><Label htmlFor="pw-new">New password</Label><Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /></div>
          <div><Label htmlFor="pw-new2">Confirm new password</Label><Input id="pw-new2" type="password" autoComplete="new-password" value={next2} onChange={(e) => setNext2(e.target.value)} required /></div>
          {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <p className="text-xs text-muted">Your messages stay readable: your encryption key is re-locked with the new password on this device.</p>
          <Button type="submit" loading={busy} disabled={!cur || !next}>Change password</Button>
        </form>
      </Section>
      <Section>
        <NavRow icon={<MonitorSmartphone />} label="Active sessions" sub="See where you’re signed in and sign out devices" onClick={() => go('sessions')} />
      </Section>
      <Section>
        <button onClick={async () => {
          if (await confirm({ title: 'Sign out?', description: 'Messages stored on this device will be removed.', confirmText: 'Sign out', destructive: true })) logout();
        }} className="flex w-full items-center gap-4 px-5 py-3.5 text-left text-danger hover:bg-hover"><LogOut className="size-5" /> Sign out</button>
        <button onClick={async () => {
          if (await confirm({ title: 'Sign out of all devices?', description: 'Every phone and browser signed in to your account will be signed out, including this one.', confirmText: 'Sign out everywhere', destructive: true })) logout(true);
        }} className="flex w-full items-center gap-4 px-5 py-3.5 text-left text-danger hover:bg-hover"><UserRound className="size-5" /> Sign out of all devices</button>
      </Section>
    </>
  );
}

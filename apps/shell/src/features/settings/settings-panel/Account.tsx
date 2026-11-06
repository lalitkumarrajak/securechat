import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, LogOut, MonitorSmartphone, UserRound } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { confirm } from '@sanga/ui/confirm';
import { Input, Label } from '@sanga/ui/input';
import { changePassword, logout, sendEmailCode, verifyEmail } from '../../../lib/engine';
import { useApp } from '../../../state/app';
import { NavRow } from './NavRow';
import { Section } from './Section';
import type { Page } from './types';
import { t } from '@sanga/i18n';

// Your email: to sign in with, and checked with a code before it's saved. Shown only to you.
function EmailSection() {
  const saved = useApp((s) => s.me?.email) || '';
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState(''); // the code went here; now asking for it
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const open = editing || !saved;

  async function run(fn: () => unknown) {
    setError('');
    setBusy(true);
    try { await fn(); } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }
  const send = (e?: FormEvent) => {
    e?.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setError(t('Enter a valid email address'));
    run(async () => { await sendEmailCode(email); setSentTo(email.trim()); setCode(''); });
  };
  const verify = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError(t('Enter the 6-digit code from the email.'));
    run(async () => {
      await verifyEmail(sentTo, code);
      setEditing(false); setSentTo(''); setEmail(''); setCode('');
      toast.success(t('Email verified'), { description: t('You can now sign in with it.') });
    });
  };

  return (
    <Section title={t('Email')} className="px-5 pb-5">
      {saved && (
        <div className="mt-2 flex items-center gap-3">
          <BadgeCheck className="size-5 shrink-0 text-green-600" aria-hidden />
          <div className="min-w-0 flex-1"><p className="truncate">{saved}</p><p className="text-xs text-muted">{t('Verified. You can sign in with it.')}</p></div>
          {!editing && <Button variant="outline" size="sm" onClick={() => { setEditing(true); setError(''); }}>{t('Change')}</Button>}
        </div>
      )}
      {!saved && <p className="mt-2 text-sm text-muted">{t('Add an email to sign in with it. We’ll send a code to check it’s yours.')}</p>}
      {open && !sentTo && (
        <form onSubmit={send} className="mt-3 grid gap-3" noValidate>
          <div><Label htmlFor="email-new">{saved ? t('New email') : t('Email')}</Label>
            <Input id="email-new" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            {editing && <Button type="button" variant="outline" onClick={() => { setEditing(false); setError(''); }}>{t('Cancel')}</Button>}
            <Button type="submit" loading={busy} disabled={!email.trim()} className="flex-1">{t('Send code')}</Button>
          </div>
        </form>
      )}
      {open && sentTo && (
        <form onSubmit={verify} className="mt-3 grid gap-3" noValidate>
          <p className="text-sm text-muted">{t('We sent a 6-digit code to {email}. It works for 10 minutes; check spam if you don’t see it.', { email: sentTo })}</p>
          <div><Label htmlFor="email-code">{t('Code from the email')}</Label>
            <Input id="email-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} autoFocus
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="text-center text-xl tracking-[0.4em]" required /></div>
          {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => { setSentTo(''); setError(''); }}>{t('Change email')}</Button>
            <Button type="submit" loading={busy} disabled={code.length !== 6} className="flex-1">{t('Verify')}</Button>
          </div>
        </form>
      )}
    </Section>
  );
}

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
    if (next.length < 8) return setError(t('Use at least 8 characters.'));
    if (next !== next2) return setError(t('The new passwords don’t match.'));
    setBusy(true);
    try {
      await changePassword(cur, next);
      setCur(''); setNext(''); setNext2('');
      toast.success(t('Password changed'), { description: t('Your other devices were signed out.') });
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  return (
    <>
      <EmailSection />
      <Section title={t('Change password')} className="px-5 pb-5">
        <form onSubmit={submit} className="mt-3 grid gap-3">
          <input type="text" autoComplete="username" value={me.u} readOnly hidden />
          <div><Label htmlFor="pw-cur">{t('Current password')}</Label><Input id="pw-cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></div>
          <div><Label htmlFor="pw-new">{t('New password')}</Label><Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /></div>
          <div><Label htmlFor="pw-new2">{t('Confirm new password')}</Label><Input id="pw-new2" type="password" autoComplete="new-password" value={next2} onChange={(e) => setNext2(e.target.value)} required /></div>
          {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <p className="text-xs text-muted">{t('Your messages stay readable: your encryption key is re-locked with the new password on this device.')}</p>
          <Button type="submit" loading={busy} disabled={!cur || !next}>{t('Change password')}</Button>
        </form>
      </Section>
      <Section>
        <NavRow icon={<MonitorSmartphone />} label={t('Active sessions')} sub={t('See where you’re signed in and sign out devices')} onClick={() => go('sessions')} />
      </Section>
      <Section>
        <button onClick={async () => {
          if (await confirm({ title: t('Sign out?'), description: t('Messages stored on this device will be removed.'), confirmText: t('Sign out'), destructive: true })) logout();
        }} className="flex w-full items-center gap-4 px-5 py-3.5 text-left text-danger hover:bg-hover"><LogOut className="size-5" /> {t('Sign out')}</button>
        <button onClick={async () => {
          if (await confirm({ title: t('Sign out of all devices?'), description: t('Every phone and browser signed in to your account will be signed out, including this one.'), confirmText: t('Sign out everywhere'), destructive: true })) logout(true);
        }} className="flex w-full items-center gap-4 px-5 py-3.5 text-left text-danger hover:bg-hover"><UserRound className="size-5" /> {t('Sign out of all devices')}</button>
      </Section>
    </>
  );
}

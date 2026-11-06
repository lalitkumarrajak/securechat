import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { Input, Label } from '@sanga/ui/input';
import { login, register, sendSignupCode } from '../../../lib/engine';
import { useApp } from '../../../state/app';
import { t } from '@sanga/i18n';

const USER_RE = /^[a-z0-9_.]{3,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function AuthForm({ mode }: { mode: 'signin' | 'signup' }) {
  const [u, setU] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'form' | 'code'>('form'); // sign-up with email: then the code from it
  const [wait, setWait] = useState(0); // seconds until another code can be sent
  const signup = mode === 'signup';
  const needEmail = useApp((s) => s.emailRequired) && signup;
  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function sendCode() {
    await sendSignupCode(u.trim().toLowerCase(), email);
    setStep('code');
    setCode('');
    setWait(30);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const name = u.trim().toLowerCase();
    if (signup) {
      if (!USER_RE.test(name)) return setError(t('Username: 3–24 characters, using a–z, 0–9, _ and .'));
      if (pw.length < 8) return setError(t('Use a password with at least 8 characters.'));
      if (pw !== pw2) return setError(t('The passwords don’t match.'));
      if (needEmail && !EMAIL_RE.test(email.trim())) return setError(t('Enter a valid email address'));
      if (needEmail && step === 'code' && !/^\d{6}$/.test(code.trim())) return setError(t('Enter the 6-digit code from the email.'));
    }
    setBusy(true);
    try {
      if (needEmail && step === 'form') { await sendCode(); setBusy(false); return; }
      await (signup ? register(name, pw, needEmail ? email : undefined, needEmail ? code.trim() : undefined) : login(name, pw));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const strength = pw.length >= 14 ? 3 : pw.length >= 10 && /\d/.test(pw) && /[^a-z0-9]/i.test(pw) ? 2 : pw.length >= 8 ? 1 : 0;

  if (step === 'code') return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <p className="text-sm text-muted">{t('We sent a 6-digit code to {email}. It works for 10 minutes; check spam if you don’t see it.', { email: email.trim() })}</p>
      <div>
        <Label htmlFor="signup-code">{t('Code from the email')}</Label>
        <Input id="signup-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric"
          autoComplete="one-time-code" maxLength={6} required autoFocus placeholder="123456" className="text-center text-xl tracking-[0.4em]" />
      </div>
      {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" loading={busy} className="w-full">{busy ? t('Securing your keys…') : t('Create account')}</Button>
      <div className="flex justify-between text-sm">
        <button type="button" className="text-accent-ink hover:underline" onClick={() => { setStep('form'); setError(''); }}>{t('Change email')}</button>
        <button type="button" className="text-accent-ink hover:underline disabled:text-muted disabled:no-underline" disabled={wait > 0 || busy}
          onClick={() => { setError(''); sendCode().catch((err) => setError((err as Error).message)); }}>
          {wait > 0 ? t('Send again in {n}s', { n: wait }) : t('Send the code again')}
        </button>
      </div>
    </form>
  );

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div>
        <Label htmlFor={mode + '-u'} hint={signup ? 'a–z, 0–9, _ .' : undefined}>{signup ? t('Username') : t('Username or email')}</Label>
        <Input id={mode + '-u'} value={u} onChange={(e) => setU(e.target.value)} autoComplete="username"
          autoCapitalize="none" spellCheck={false} maxLength={signup ? 24 : 254} required placeholder={t('e.g. ayansh')} />
      </div>
      {needEmail && (
        <div>
          <Label htmlFor="signup-email">{t('Email')}</Label>
          <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
            autoCapitalize="none" spellCheck={false} maxLength={254} required placeholder="you@example.com" />
          <p className="mt-1 text-xs text-muted">{t('We’ll send a code to check it. You can also sign in with it.')}</p>
        </div>
      )}
      <div>
        <Label htmlFor={mode + '-p'}>{t('Password')}</Label>
        <div className="relative">
          <Input id={mode + '-p'} type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)}
            autoComplete={signup ? 'new-password' : 'current-password'} required className="pr-11" />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? t('Hide password') : t('Show password')}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-ink">
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
        {signup && pw && (
          <div className="mt-2 flex items-center gap-2" aria-live="polite">
            <div className="flex flex-1 gap-1">
              {[1, 2, 3].map((i) => (
                <span key={i} className={`h-1 flex-1 rounded-full ${strength >= i ? ['', 'bg-amber-500', 'bg-lime-500', 'bg-green-600'][strength] : 'bg-line'}`} />
              ))}
            </div>
            <span className="text-xs text-muted">{[t('Too short'), t('OK'), t('Good'), t('Strong')][strength]}</span>
          </div>
        )}
      </div>
      {signup && (
        <div>
          <Label htmlFor="signup-p2">{t('Confirm password')}</Label>
          <Input id="signup-p2" type={show ? 'text' : 'password'} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
        </div>
      )}
      {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" loading={busy} className="mt-1 w-full">
        {busy ? (needEmail ? t('Sending the code…') : t('Securing your keys…')) : needEmail ? t('Continue') : signup ? t('Create account') : t('Sign in')}
      </Button>
    </form>
  );
}

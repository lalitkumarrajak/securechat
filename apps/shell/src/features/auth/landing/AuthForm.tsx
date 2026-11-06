import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { AlertCircle, Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { Input, Label } from '@sanga/ui/input';
import { cn } from '@sanga/ui/utils';
import { login, register, sendSignupCode, usernameFree } from '../../../lib/engine';
import { useApp } from '../../../state/app';
import { t } from '@sanga/i18n';

type Field = 'u' | 'email' | 'pw' | 'pw2' | 'code';
type Errors = Partial<Record<Field, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;
// Common slips in email domains: offered as "Did you mean …?".
const DOMAIN_FIX: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com',
  'gmail.in': 'gmail.com', 'gnail.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'yahoo.co': 'yahoo.com', 'yaho.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com', 'hotmail.co': 'hotmail.com', 'hotmial.com': 'hotmail.com', 'outlook.co': 'outlook.com', 'outlok.com': 'outlook.com',
  'rediffmail.co': 'rediffmail.com', 'icloud.co': 'icloud.com',
};
const fixEmail = (e: string) => {
  const [name, domain] = e.trim().toLowerCase().split('@');
  return name && domain && DOMAIN_FIX[domain] ? `${name}@${DOMAIN_FIX[domain]}` : '';
};

function usernameError(u: string): string {
  if (!u) return t('Choose a username.');
  if (/\s/.test(u)) return t('A username can’t have spaces. Use _ or . instead.');
  const bad = [...new Set(u.replace(/[a-z0-9_.]/g, ''))].join(' ');
  if (bad) return t('A username can only have small letters a–z, numbers 0–9, _ and . (not {chars}).', { chars: bad });
  if (u.length < 3) return t('Too short: a username needs at least 3 characters.');
  if (u.length > 24) return t('Too long: a username can have up to 24 characters.');
  return '';
}

function emailError(e: string): string {
  if (!e.trim()) return t('Enter your email.');
  if (!EMAIL_RE.test(e.trim())) return t('This doesn’t look like an email address, for example name@gmail.com.');
  return '';
}

function passwordError(pw: string, u: string): string {
  if (!pw) return t('Choose a password.');
  if (pw.length < 8) return t('Too short: use at least 8 characters ({n} more).', { n: 8 - pw.length });
  if (u.length >= 3 && pw.toLowerCase().includes(u)) return t('Don’t put your username in your password.');
  return '';
}

/** A message under a field: red for a problem, green for good news, grey for help. */
function Note({ id, kind, children }: { id: string; kind: 'error' | 'ok' | 'help'; children: ReactNode }) {
  return (
    <p id={id} className={cn('mt-1.5 flex items-start gap-1.5 text-xs', kind === 'error' ? 'text-danger' : kind === 'ok' ? 'text-green-600' : 'text-muted')}
      role={kind === 'error' ? 'alert' : undefined}>
      {kind === 'error' && <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />}
      {kind === 'ok' && <Check className="mt-px size-3.5 shrink-0" aria-hidden />}
      <span>{children}</span>
    </p>
  );
}

export function AuthForm({ mode }: { mode: 'signin' | 'signup' }) {
  const [u, setU] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); // about the whole form (no connection, too many tries…)
  const [errors, setErrors] = useState<Errors>({}); // from the server, for one field
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [tried, setTried] = useState(false); // pressed the button once: show every problem
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'form' | 'code'>('form'); // sign-up with email: then the code from it
  const [wait, setWait] = useState(0); // seconds until another code can be sent
  const [free, setFree] = useState<Record<string, boolean | 'checking'>>({}); // username → still free?
  const form = useRef<HTMLFormElement>(null);
  const signup = mode === 'signup';
  const needEmail = useApp((s) => s.emailRequired) && signup;
  const name = u.trim().toLowerCase();

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  // While a username is typed for sign-up, ask (after a pause) whether it's free.
  useEffect(() => {
    if (!signup || usernameError(name) || name in free) return;
    const id = setTimeout(() => {
      setFree((f) => ({ ...f, [name]: 'checking' }));
      usernameFree(name).then((ok) => setFree((f) => ({ ...f, [name]: ok })))
        .catch(() => setFree((f) => { const { [name]: _, ...rest } = f; return rest; }));
    }, 450);
    return () => clearTimeout(id);
  }, [name, signup, free]);

  // Each field's problem, shown once it has been left (or the button pressed).
  const local: Errors = signup ? {
    u: usernameError(name) || (free[name] === false ? t('This username is taken. Try another one.') : ''),
    email: needEmail ? emailError(email) : '',
    pw: passwordError(pw, name),
    pw2: !pw2 ? t('Type the password again.') : pw2 !== pw ? t('The passwords don’t match.') : '',
    code: step === 'code' && !/^\d{6}$/.test(code) ? t('Enter the 6-digit code from the email.') : '',
  } : {
    u: !name ? t('Enter your username or email.') : '',
    pw: !pw ? t('Enter your password.') : '',
  };
  // A taken username is said at once, while it's typed; other problems once the field is left.
  const taken = signup && free[name] === false;
  const shown = (f: Field) => errors[f] || ((tried || touched[f] || (f === 'u' && taken)) && local[f]) || '';
  const leave = (f: Field) => () => setTouched((x) => ({ ...x, [f]: true }));
  const edit = (f: Field, set: (v: string) => void) => (v: string) => {
    set(v);
    if (errors[f]) setErrors(({ [f]: _, ...rest }) => rest);
    setError('');
  };
  const capsCheck = (e: KeyboardEvent) => setCaps(e.getModifierState?.('CapsLock') ?? false);
  const field = (f: Field) => ({ 'aria-invalid': !!shown(f) || undefined, 'aria-describedby': `${mode}-${f}-note`, className: cn(shown(f) && 'border-danger focus:border-danger focus:ring-danger/15') });

  /** The server's answer, under the field it's about when there is one. */
  function fail(err: unknown) {
    const msg = (err as Error).message;
    const about: Field | null =
      msg === t('Username taken') ? 'u'
      : [t('Enter a valid email address'), t('This email is already used by another account')].includes(msg) ? (step === 'code' ? null : 'email')
      : [t('That code isn’t right'), t('That code has expired, ask for a new one')].includes(msg) ? 'code'
      : null;
    if (about === 'u') { setFree((f) => ({ ...f, [name]: false })); setStep('form'); }
    else if (about) setErrors((x) => ({ ...x, [about]: msg }));
    else setError(msg);
  }

  async function sendCode() {
    await sendSignupCode(name, email);
    setStep('code');
    setCode('');
    setErrors({});
    setWait(30);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setTried(true);
    const first = (Object.keys(local) as Field[]).find((f) => local[f] && (f !== 'code' || step === 'code'));
    if (first) {
      form.current?.querySelector<HTMLElement>(`#${mode}-${first}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      if (needEmail && step === 'form') { await sendCode(); setBusy(false); return; }
      await (signup ? register(name, pw, needEmail ? email : undefined, needEmail ? code : undefined) : login(name, pw));
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  }

  const strength = pw.length >= 14 ? 3 : pw.length >= 10 && /\d/.test(pw) && /[^a-z0-9]/i.test(pw) ? 2 : pw.length >= 8 ? 1 : 0;
  const formError = error && <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />{error}</p>;

  if (step === 'code') return (
    <form ref={form} onSubmit={submit} className="grid gap-4" noValidate>
      <p className="text-sm text-muted">{t('We sent a 6-digit code to {email}. It works for 10 minutes; check spam if you don’t see it.', { email: email.trim() })}</p>
      <div>
        <Label htmlFor={`${mode}-code`}>{t('Code from the email')}</Label>
        <Input id={`${mode}-code`} value={code} onChange={(e) => edit('code', setCode)(e.target.value.replace(/\D/g, '').slice(0, 6))} onBlur={leave('code')}
          inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus placeholder="123456"
          {...field('code')} className={cn('text-center text-xl tracking-[0.4em]', field('code').className)} />
        {shown('code') && <Note id={`${mode}-code-note`} kind="error">{shown('code')}</Note>}
      </div>
      {formError}
      <Button type="submit" size="lg" loading={busy} className="w-full">{busy ? t('Securing your keys…') : t('Create account')}</Button>
      <div className="flex justify-between text-sm">
        <button type="button" className="text-accent-ink hover:underline" onClick={() => { setStep('form'); setError(''); setErrors({}); }}>{t('Change email')}</button>
        <button type="button" className="text-accent-ink hover:underline disabled:text-muted disabled:no-underline" disabled={wait > 0 || busy}
          onClick={() => { setError(''); sendCode().catch(fail); }}>
          {wait > 0 ? t('Send again in {n}s', { n: wait }) : t('Send the code again')}
        </button>
      </div>
    </form>
  );

  const suggestion = needEmail && fixEmail(email);
  const uNote = shown('u') ? <Note id={`${mode}-u-note`} kind="error">{shown('u')}</Note>
    : !signup ? null
    : free[name] === true ? <Note id={`${mode}-u-note`} kind="ok">{t('{name} is available.', { name })}</Note>
    : free[name] === 'checking' ? <p id={`${mode}-u-note`} className="mt-1.5 flex items-center gap-1.5 text-xs text-muted"><Loader2 className="size-3.5 animate-spin" aria-hidden />{t('Checking…')}</p>
    : <Note id={`${mode}-u-note`} kind="help">{t('3–24 characters: small letters a–z, numbers 0–9, _ and . Friends find you by it.')}</Note>;

  const pwNote = shown('pw') ? <Note id={`${mode}-pw-note`} kind="error">{shown('pw')}</Note> // i18n-ok
    : caps ? <Note id={`${mode}-pw-note`} kind="help">{t('Caps Lock is on.')}</Note>
    : signup && !pw ? <Note id={`${mode}-pw-note`} kind="help">{t('At least 8 characters. Longer is safer; a few words together work well.')}</Note>
    : null;

  return (
    <form ref={form} onSubmit={submit} className="grid gap-4" noValidate>
      <div>
        <Label htmlFor={`${mode}-u`}>{signup ? t('Username') : t('Username or email')}</Label>
        <Input id={`${mode}-u`} value={u} onBlur={leave('u')} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          maxLength={signup ? 24 : 254} required placeholder={signup ? t('e.g. ayansh') : t('Username or email')} {...field('u')}
          // Usernames are lowercase: capitals are turned into small letters as they're typed.
          onChange={(e) => edit('u', setU)(signup ? e.target.value.toLowerCase() : e.target.value)} />
        {uNote}
      </div>
      {needEmail && (
        <div>
          <Label htmlFor={`${mode}-email`}>{t('Email')}</Label>
          <Input id={`${mode}-email`} type="email" inputMode="email" value={email} onChange={(e) => edit('email', setEmail)(e.target.value)} onBlur={leave('email')}
            autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={254} required placeholder="name@gmail.com" {...field('email')} />
          {shown('email') ? <Note id={`${mode}-email-note`} kind="error">{shown('email')}</Note>
            : suggestion ? (
              <p id={`${mode}-email-note`} className="mt-1.5 text-xs text-muted">
                {t('Did you mean {email}?', { email: suggestion })}{' '}
                <button type="button" className="font-medium text-accent-ink hover:underline" onClick={() => setEmail(suggestion)}>{t('Use it')}</button>
              </p>
            ) : <Note id={`${mode}-email-note`} kind="help">{t('We’ll send a code to check it. You can also sign in with it.')}</Note>}
        </div>
      )}
      <div>
        <Label htmlFor={`${mode}-pw`}>{t('Password')}</Label>
        <div className="relative">
          <Input id={`${mode}-pw`} type={show ? 'text' : 'password'} value={pw} onChange={(e) => edit('pw', setPw)(e.target.value)} onBlur={leave('pw')}
            onKeyUp={capsCheck} onKeyDown={capsCheck} autoComplete={signup ? 'new-password' : 'current-password'} required
            {...field('pw')} className={cn('pr-11', field('pw').className)} />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? t('Hide password') : t('Show password')}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-ink">
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
        {pwNote}
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
          <Label htmlFor={`${mode}-pw2`}>{t('Confirm password')}</Label>
          <Input id={`${mode}-pw2`} type={show ? 'text' : 'password'} value={pw2} onChange={(e) => edit('pw2', setPw2)(e.target.value)}
            onBlur={leave('pw2')} autoComplete="new-password" required {...field('pw2')} />
          {shown('pw2') ? <Note id={`${mode}-pw2-note`} kind="error">{shown('pw2')}</Note>
            : pw2 && pw2 === pw ? <Note id={`${mode}-pw2-note`} kind="ok">{t('The passwords match.')}</Note> : null}
        </div>
      )}
      {formError}
      <Button type="submit" size="lg" loading={busy} className="mt-1 w-full">
        {busy ? (needEmail ? t('Sending the code…') : t('Securing your keys…')) : needEmail ? t('Continue') : signup ? t('Create account') : t('Sign in')}
      </Button>
    </form>
  );
}

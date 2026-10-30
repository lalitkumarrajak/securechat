import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { Input, Label } from '@sanga/ui/input';
import { login, register } from '../../../lib/engine';

const USER_RE = /^[a-z0-9_.]{3,24}$/;

export function AuthForm({ mode }: { mode: 'signin' | 'signup' }) {
  const [u, setU] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const signup = mode === 'signup';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const name = u.trim().toLowerCase();
    if (signup) {
      if (!USER_RE.test(name)) return setError('Username: 3–24 characters, using a–z, 0–9, _ and .');
      if (pw.length < 8) return setError('Use a password with at least 8 characters.');
      if (pw !== pw2) return setError('The passwords don’t match.');
    }
    setBusy(true);
    try {
      await (signup ? register(name, pw) : login(name, pw));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const strength = pw.length >= 14 ? 3 : pw.length >= 10 && /\d/.test(pw) && /[^a-z0-9]/i.test(pw) ? 2 : pw.length >= 8 ? 1 : 0;

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div>
        <Label htmlFor={mode + '-u'} hint={signup ? 'a–z, 0–9, _ .' : undefined}>Username</Label>
        <Input id={mode + '-u'} value={u} onChange={(e) => setU(e.target.value)} autoComplete="username"
          autoCapitalize="none" spellCheck={false} maxLength={24} required placeholder="e.g. ayansh" />
      </div>
      <div>
        <Label htmlFor={mode + '-p'}>Password</Label>
        <div className="relative">
          <Input id={mode + '-p'} type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)}
            autoComplete={signup ? 'new-password' : 'current-password'} required className="pr-11" />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
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
            <span className="text-xs text-muted">{['Too short', 'OK', 'Good', 'Strong'][strength]}</span>
          </div>
        )}
      </div>
      {signup && (
        <div>
          <Label htmlFor="signup-p2">Confirm password</Label>
          <Input id="signup-p2" type={show ? 'text' : 'password'} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
        </div>
      )}
      {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" loading={busy} className="mt-1 w-full">
        {busy ? 'Securing your keys…' : signup ? 'Create account' : 'Sign in'}
      </Button>
    </form>
  );
}

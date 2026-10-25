// The PIN screen shown while the app is locked. Nothing else of the app is on the page.
import { useCallback, useEffect, useState } from 'react';
import { Delete } from 'lucide-react';
import { confirm } from '../../components/ui/confirm';
import { cn } from '../../lib/utils';
import { failedTries, forgetAndSignOut, MAX_TRIES, unlock, waitLeft } from '../../lib/applock';
import { useSettings } from '../../state/settings';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'forgot', '0', 'del'];

export function LockScreen() {
  const len = useSettings((s) => s.appLock?.len ?? 4);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);
  const [wait, setWait] = useState(waitLeft());

  useEffect(() => { // count down a forced wait
    if (!wait) return;
    const t = setInterval(() => setWait(waitLeft()), 500);
    return () => clearInterval(t);
  }, [wait]);

  const submit = useCallback(async (p: string) => {
    setBusy(true);
    const r = await unlock(p);
    setBusy(false);
    if (r === 'ok' || r === 'wiped') return;
    setPin('');
    setShake((n) => n + 1);
    navigator.vibrate?.([40, 60, 40]);
    if (r === 'wait' || waitLeft()) { setWait(waitLeft()); setError('Too many wrong PINs'); return; }
    const left = MAX_TRIES - failedTries();
    setError(left <= 5 ? `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left before this device is signed out.` : 'Wrong PIN');
  }, []);

  const press = useCallback((k: string) => {
    if (busy || waitLeft()) return;
    if (k === 'del') { setPin((p) => p.slice(0, -1)); return; }
    setError('');
    setPin((p) => {
      if (p.length >= len) return p;
      const next = p + k;
      if (next.length === len) submit(next);
      return next;
    });
  }, [busy, len, submit]);

  const forgot = async () => {
    const ok = await confirm({
      title: 'Forgot your PIN?',
      description: 'Sign out of Chattrix on this device. Chats saved here are erased; sign in with your password to get them back.',
      confirmText: 'Sign out', destructive: true,
    });
    if (ok) await forgetAndSignOut();
  };

  useEffect(() => { // typing on a keyboard works too
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      if (e.key === 'Escape') e.preventDefault(); // nothing to close here
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  const secs = Math.ceil(wait / 1000);
  return (
    <div className="fixed inset-0 z-[45] flex flex-col items-center justify-center gap-7 bg-gradient-to-b from-[#0b1240] to-[#040828] px-6 pb-[env(safe-area-inset-bottom)] text-white"
      role="dialog" aria-label="Chattrix is locked">
      <img src="/logo-mark.png" alt="" className="size-16 rounded-2xl shadow-lg" />
      <div className="text-center">
        <h1 className="text-xl font-semibold">Enter your PIN</h1>
        <p className={cn('mt-1 h-10 max-w-xs text-sm', error ? 'text-red-300' : 'text-white/60')} role="alert">
          {wait ? `Too many wrong PINs. Try again in ${secs} s.` : error || 'Chattrix is locked'}
        </p>
      </div>
      <div key={shake} className={cn('flex gap-4', shake && 'animate-shake')} aria-label={`${pin.length} of ${len} digits entered`}>
        {Array.from({ length: len }, (_, i) => (
          <span key={i} className={cn('size-3.5 rounded-full border-2 border-white/70 transition', i < pin.length && 'scale-110 bg-white')} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-x-7 gap-y-4">
        {KEYS.map((k) => k === 'forgot' ? (
          <button key={k} type="button" onClick={forgot} className="size-[72px] rounded-full text-sm text-white/70 hover:text-white">Forgot PIN?</button>
        ) : k === 'del' ? (
          <button key={k} type="button" onClick={() => press('del')} aria-label="Delete digit"
            className="grid size-[72px] place-items-center rounded-full text-white/80 hover:bg-white/10 active:bg-white/20"><Delete className="size-6" /></button>
        ) : (
          <button key={k} type="button" onClick={() => press(k)} disabled={!!wait} aria-label={k}
            className="size-[72px] rounded-full bg-white/10 text-2xl font-medium hover:bg-white/15 active:bg-white/25 disabled:opacity-40">{k}</button>
        ))}
      </div>
    </div>
  );
}

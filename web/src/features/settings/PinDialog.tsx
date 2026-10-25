// Setting, changing or confirming the app lock PIN.
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Input, Label } from '../../components/ui/input';
import { checkPin, PIN_RE } from '../../lib/pin';
import { useSettings } from '../../state/settings';

type Step = 'current' | 'new' | 'confirm';

/** mode "set": new PIN twice. "change": current, then new twice. "verify": current only. */
export function PinDialog({ mode, onDone, onClose }: {
  mode: 'set' | 'change' | 'verify'; onDone: (pin: string) => void | Promise<void>; onClose: () => void;
}) {
  const saved = useSettings((s) => s.appLock);
  const [step, setStep] = useState<Step>(mode === 'set' ? 'new' : 'current');
  const [value, setValue] = useState('');
  const [first, setFirst] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const titles: Record<Step, string> = { current: 'Enter your current PIN', new: 'Choose a PIN', confirm: 'Enter the PIN again' };

  async function next(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (step === 'current') {
      setBusy(true);
      const ok = saved ? await checkPin(value, saved) : false;
      setBusy(false);
      if (!ok) { setError('Wrong PIN'); setValue(''); return; }
      if (mode === 'verify') return onDone(value);
      setStep('new'); setValue(''); return;
    }
    if (step === 'new') {
      if (!PIN_RE.test(value)) { setError('Use 4 to 6 digits'); return; }
      if (/^(\d)\1+$/.test(value) || '0123456789'.includes(value) || '9876543210'.includes(value)) { setError('Too easy to guess. Avoid repeated or sequential digits.'); return; }
      setFirst(value); setStep('confirm'); setValue(''); return;
    }
    if (value !== first) { setError('PINs don’t match. Try again.'); setStep('new'); setValue(''); return; }
    setBusy(true);
    await onDone(value);
    setBusy(false);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={titles[step]}
      description={step === 'new' ? 'You’ll enter it whenever Chattrix is opened on this device. 4 to 6 digits.' : undefined}>
      <form onSubmit={next} className="grid gap-4">
        <div>
          <Label htmlFor="pin-input">PIN</Label>
          <Input id="pin-input" key={step} type="password" inputMode="numeric" autoComplete="off" autoFocus maxLength={6}
            value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} className="text-center text-2xl tracking-[0.5em]" />
          {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
        </div>
        <Button type="submit" loading={busy} disabled={value.length < 4}>{step === 'confirm' || mode === 'verify' ? 'Done' : 'Next'}</Button>
      </form>
    </Dialog>
  );
}

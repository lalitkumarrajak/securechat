import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@sanga/ui/utils';
import { LOCK_AFTER, removeLock, setPin } from '../../../lib/applock';
import { setSettings, useSettings } from '../../../state/settings';
import { PinDialog } from '../PinDialog';
import { Section } from './Section';
import { ToggleRow } from './ToggleRow';
import { t } from '@sanga/i18n';

export function AppLockSection() {
  const enabled = useSettings((s) => !!s.appLock);
  const after = useSettings((s) => s.lockAfterMs);
  const [dialog, setDialog] = useState<null | 'set' | 'change' | 'off'>(null);
  return (
    <Section title={t('App lock')}>
      <ToggleRow label={t('Lock with a PIN')} sub={t('Ask for a PIN whenever Sanga is opened on this device.')}
        checked={enabled} onChange={(v) => setDialog(v ? 'set' : 'off')} />
      {enabled && (
        <>
          <div className="px-5 pt-1 pb-3" role="radiogroup" aria-label={t('Lock automatically')}>
            <p className="mb-2 text-sm text-muted">{t('Lock automatically when I leave Sanga')}</p>
            <div className="flex flex-wrap gap-2">
              {LOCK_AFTER.map((o) => (
                <button key={o.ms} role="radio" aria-checked={after === o.ms} onClick={() => setSettings({ lockAfterMs: o.ms })}
                  className={cn('rounded-full border px-3 py-1.5 text-sm', after === o.ms ? 'border-accent bg-accent/12 font-medium text-accent-ink' : 'border-line hover:bg-hover')}>
                  {t(o.label)}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setDialog('change')} className="w-full px-5 py-3.5 text-left hover:bg-hover">{t('Change PIN')}</button>
        </>
      )}
      {dialog && (
        <PinDialog mode={dialog === 'set' ? 'set' : dialog === 'change' ? 'change' : 'verify'} onClose={() => setDialog(null)}
          onDone={async (pin) => {
            if (dialog === 'off') { removeLock(); toast(t('App lock off')); }
            else { await setPin(pin); toast.success(dialog === 'set' ? t('App lock on') : t('PIN changed'), { description: dialog === 'set' ? t('Tap the lock at the top to lock Sanga right away.') : undefined }); }
            setDialog(null);
          }} />
      )}
    </Section>
  );
}

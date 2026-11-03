import { useState } from 'react';
import { toast } from 'sonner';
import { disablePush, enablePush, pushSupported } from '../../../lib/engine';
import { setSettings, useSettings } from '../../../state/settings';
import { Section } from './Section';
import { ToggleRow } from './ToggleRow';
import { t } from '@sanga/i18n';

export function Notifications() {
  const push = useSettings((s) => s.push);
  const sound = useSettings((s) => s.sound);
  const [busy, setBusy] = useState(false);
  async function togglePush(on: boolean) {
    setBusy(true);
    try {
      if (on) { await enablePush(); toast.success(t('Push notifications on')); }
      else { await disablePush(); toast(t('Push notifications off')); }
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }
  return (
    <>
      <Section>
        <ToggleRow label={t('Push notifications')} sub={t('Get notified even when Sanga is closed. Notifications never include message text.')}
          checked={push} onChange={togglePush} disabled={busy} />
        <ToggleRow label={t('Sounds')} sub={t('Play a sound for new messages while the app is open.')} checked={sound} onChange={(v) => setSettings({ sound: v })} />
      </Section>
      {!pushSupported() && (
        <Section className="px-5 py-4"><p className="text-sm text-muted">
          {t('This browser doesn’t support push notifications here. On iPhone, add Sanga to your Home Screen first (Share → Add to Home Screen), then turn them on.')}
        </p></Section>
      )}
      <Section className="px-5 py-4"><p className="text-sm text-muted">{t('Mute a single chat from its menu (⋮ → Mute notifications).')}</p></Section>
    </>
  );
}

import { useState } from 'react';
import { toast } from 'sonner';
import { disablePush, enablePush, pushSupported } from '../../../lib/engine';
import { setSettings, useSettings } from '../../../state/settings';
import { Section } from './Section';
import { ToggleRow } from './ToggleRow';

export function Notifications() {
  const push = useSettings((s) => s.push);
  const sound = useSettings((s) => s.sound);
  const [busy, setBusy] = useState(false);
  async function togglePush(on: boolean) {
    setBusy(true);
    try {
      if (on) { await enablePush(); toast.success('Push notifications on'); }
      else { await disablePush(); toast('Push notifications off'); }
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }
  return (
    <>
      <Section>
        <ToggleRow label="Push notifications" sub="Get notified even when Sanga is closed. Notifications never include message text."
          checked={push} onChange={togglePush} disabled={busy} />
        <ToggleRow label="Sounds" sub="Play a sound for new messages while the app is open." checked={sound} onChange={(v) => setSettings({ sound: v })} />
      </Section>
      {!pushSupported() && (
        <Section className="px-5 py-4"><p className="text-sm text-muted">
          This browser doesn’t support push notifications here. On iPhone, add Sanga to your Home Screen first (Share → Add to Home Screen), then turn them on.
        </p></Section>
      )}
      <Section className="px-5 py-4"><p className="text-sm text-muted">Mute a single chat from its menu (⋮ → Mute notifications).</p></Section>
    </>
  );
}

import { cn } from '@sanga/ui/utils';
import { setSettings, useSettings } from '../../../state/settings';
import { Section } from './Section';
import { ToggleRow } from './ToggleRow';

const KEEP = [{ n: 0, label: 'None' }, { n: 1, label: 'Last 1' }, { n: 3, label: 'Last 3' }, { n: 5, label: 'Last 5' }];

export function PrivacyScreenSection() {
  const on = useSettings((s) => s.privacyScreen);
  const keep = useSettings((s) => s.privacyKeep);
  const away = useSettings((s) => s.privacyBlurAway);
  return (
    <Section title="Privacy screen">
      <ToggleRow label="Blur my chats" sub="On this device, names, photos, previews and messages are blurred so people nearby can’t read them. Hover or tap one to read it, or tap the eye at the top to show everything for 30 seconds."
        checked={on} onChange={(v) => setSettings({ privacyScreen: v })} />
      {on && (
        <>
          <div className="px-5 pt-1 pb-3" role="radiogroup" aria-label="Keep the newest messages readable">
            <p className="mb-2 text-sm text-muted">Keep the newest messages in a chat readable</p>
            <div className="flex flex-wrap gap-2">
              {KEEP.map((o) => (
                <button key={o.n} role="radio" aria-checked={keep === o.n} onClick={() => setSettings({ privacyKeep: o.n })}
                  className={cn('rounded-full border px-3 py-1.5 text-sm', keep === o.n ? 'border-accent bg-accent/12 font-medium text-accent-ink' : 'border-line hover:bg-hover')}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <ToggleRow label="Blur when I leave Sanga" sub="Blurs the whole screen while you’re in another app or window, and in the app switcher."
            checked={away} onChange={(v) => setSettings({ privacyBlurAway: v })} />
        </>
      )}
    </Section>
  );
}

// Calendar settings: where you are (sunrise, moonrise and so festival days depend on it), how
// months are named, which festivals and fasts to show, and when to be reminded.
import { useState } from 'react';
import { Bell, LocateFixed } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input } from '@sanga/ui/input';
import { Switch } from '@sanga/ui/switch';
import { sdk } from '@sanga/sdk';
import { cn } from '@sanga/ui/utils';
import { t, tk } from '@sanga/i18n';
import { GROUPS } from './panchang';
import { saveSettings, useCal } from './model';

export const CITIES: { name: string; lat: number; lon: number }[] = [
  { name: tk('New Delhi'), lat: 28.6139, lon: 77.209 }, { name: tk('Mumbai'), lat: 19.076, lon: 72.8777 }, { name: tk('Kolkata'), lat: 22.5726, lon: 88.3639 },
  { name: tk('Chennai'), lat: 13.0827, lon: 80.2707 }, { name: tk('Bengaluru'), lat: 12.9716, lon: 77.5946 }, { name: tk('Hyderabad'), lat: 17.385, lon: 78.4867 },
  { name: tk('Ahmedabad'), lat: 23.0225, lon: 72.5714 }, { name: tk('Pune'), lat: 18.5204, lon: 73.8567 }, { name: tk('Jaipur'), lat: 26.9124, lon: 75.7873 },
  { name: tk('Lucknow'), lat: 26.8467, lon: 80.9462 }, { name: tk('Varanasi'), lat: 25.3176, lon: 82.9739 }, { name: tk('Patna'), lat: 25.5941, lon: 85.1376 },
  { name: tk('Bhopal'), lat: 23.2599, lon: 77.4126 }, { name: tk('Ujjain'), lat: 23.1765, lon: 75.7885 }, { name: tk('Chandigarh'), lat: 30.7333, lon: 76.7794 },
  { name: tk('Guwahati'), lat: 26.1445, lon: 91.7362 }, { name: tk('Bhubaneswar'), lat: 20.2961, lon: 85.8245 }, { name: tk('Thiruvananthapuram'), lat: 8.5241, lon: 76.9366 },
  { name: tk('Kathmandu'), lat: 27.7172, lon: 85.324 },
];

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useCal((x) => x.settings);
  const push = sdk().usePush?.();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const here = () => {
    setError('');
    if (!navigator.geolocation) return setError(t('This browser can’t tell where you are.'));
    setLocating(true);
    navigator.geolocation.getCurrentPosition((p) => {
      saveSettings({ place: { name: tk('My location'), lat: Math.round(p.coords.latitude * 1e4) / 1e4, lon: Math.round(p.coords.longitude * 1e4) / 1e4 } });
      setLocating(false);
    }, () => { setError(t('Couldn’t get your location. Pick a city instead.')); setLocating(false); }, { timeout: 10_000, maximumAge: 3600e3 });
  };
  const toggle = (g: (typeof GROUPS)[number]['id']) => saveSettings({ show: s.show.includes(g) ? s.show.filter((x) => x !== g) : [...s.show, g] });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title={t('Calendar settings')} className="md:max-w-lg">
      <div className="space-y-6">
        <section>
          <h3 className="mb-1 text-sm font-semibold">{t('Your place')}</h3>
          <p className="mb-2 text-xs text-muted">{t('Sunrise, moonrise and so the day of each festival and fast are worked out for here.')}</p>
          <div className="flex gap-2">
            <select aria-label={t('City')} value={CITIES.some((c) => c.name === s.place.name) ? s.place.name : ''} onChange={(e) => { const c = CITIES.find((x) => x.name === e.target.value); if (c) saveSettings({ place: c }); }}
              className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-panel px-3 text-sm">
              {!CITIES.some((c) => c.name === s.place.name) && <option value="">{t(s.place.name)} ({s.place.lat.toFixed(2)}, {s.place.lon.toFixed(2)})</option>}
              {CITIES.map((c) => <option key={c.name} value={c.name}>{t(c.name)}</option>)}
            </select>
            <Button variant="outline" onClick={here} loading={locating}><LocateFixed className="size-4" /> {t('Use my location')}</Button>
          </div>
          {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">{t('Month names')}</h3>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('Month names')}>
            {([['purnimanta', t('Purnimanta'), t('North India: months end at the full moon')], ['amanta', t('Amanta'), t('South & west India: months end at the new moon')]] as const).map(([v, label, hint]) => (
              <button key={v} role="radio" aria-checked={s.monthStyle === v} onClick={() => saveSettings({ monthStyle: v })}
                className={cn('rounded-2xl border-2 p-3 text-left', s.monthStyle === v ? 'border-accent bg-accent/8' : 'border-line hover:bg-hover')}>
                <span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted">{hint}</span>
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center justify-between gap-3 text-sm">{t('Weeks start on Monday')}<Switch checked={s.weekStart === 1} onCheckedChange={(v) => saveSettings({ weekStart: v ? 1 : 0 })} label={t('Weeks start on Monday')} /></label>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">{t('Show')}</h3>
          <ul className="divide-y divide-line/70 rounded-2xl border border-line/70">
            {GROUPS.map((g) => (
              <li key={g.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{t(g.label)}</span><span className="block text-xs text-muted">{t(g.hint)}</span></span>
                  <Switch checked={s.show.includes(g.id)} onCheckedChange={() => toggle(g.id)} label={t(g.label)} />
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">{t('Remind me')}</h3>
          <ul className="divide-y divide-line/70 rounded-2xl border border-line/70">
            <li className="flex items-center gap-3 px-3 py-2.5">
              <span className="min-w-0 flex-1 text-sm"><span className="block font-medium">{t('The evening before a fast')}</span><span className="block text-xs text-muted">{t('With moonrise for Sankashti and Karva Chauth')}</span></span>
              <Input aria-label={t('Fast reminder time')} type="time" value={s.fastTime} onChange={(e) => e.target.value && saveSettings({ fastTime: e.target.value })} className="h-9 w-28" disabled={!s.remindFasts} />
              <Switch checked={s.remindFasts} onCheckedChange={(v) => saveSettings({ remindFasts: v })} label={t('Remind me the evening before a fast')} />
            </li>
            <li className="flex items-center gap-3 px-3 py-2.5">
              <span className="min-w-0 flex-1 text-sm font-medium">{t('The morning of a festival')}</span>
              <Input aria-label={t('Festival reminder time')} type="time" value={s.festivalTime} onChange={(e) => e.target.value && saveSettings({ festivalTime: e.target.value })} className="h-9 w-28" disabled={!s.remindFestivals} />
              <Switch checked={s.remindFestivals} onCheckedChange={(v) => saveSettings({ remindFestivals: v })} label={t('Remind me the morning of a festival')} />
            </li>
            <li className="flex items-center gap-3 px-3 py-2.5">
              <span className="min-w-0 flex-1 text-sm"><span className="block font-medium">{t('When to break an Ekadashi fast')}</span><span className="block text-xs text-muted">{t('At the start of parana')}</span></span>
              <Switch checked={s.remindParana} onCheckedChange={(v) => saveSettings({ remindParana: v })} label={t('Remind me when to break an Ekadashi fast')} />
            </li>
          </ul>
          {push && (
            <div className={cn('mt-3 flex items-center gap-3 rounded-2xl p-3 text-sm', push.on ? 'bg-green-500/10' : 'bg-amber-500/10')}>
              <Bell className="size-5 shrink-0" />
              <span className="min-w-0 flex-1">{push.on ? t('Reminders reach you even when Sanga is closed.') : push.supported ? t('Turn on notifications to get reminders when Sanga is closed.') : t('This browser can’t notify you when Sanga is closed. Reminders show while it’s open.')}</span>
              {!push.on && push.supported && <Button size="sm" onClick={() => void push.enable().catch(() => {})}>{t('Turn on')}</Button>}
            </div>
          )}
        </section>
        <p className="text-xs text-muted">{t('Dates follow the common (Smarta) rules for your place, worked out from the sun and moon on this device. A local panchang or your family’s tradition may differ by a day now and then.')}</p>
      </div>
    </Dialog>
  );
}

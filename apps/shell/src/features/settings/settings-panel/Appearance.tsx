import type { ReactNode } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { ACCENTS, setSettings, useSettings, type FontSize, type Theme, type Wallpaper } from '../../../state/settings';
import { Section } from './Section';
import { t, tk } from '@sanga/i18n';

const THEMES: { id: Theme; label: string; icon: ReactNode }[] = [
  { id: 'system', label: tk('System'), icon: <Monitor className="size-5" /> },
  { id: 'light', label: tk('Light'), icon: <Sun className="size-5" /> },
  { id: 'dark', label: tk('Dark'), icon: <Moon className="size-5" /> },
];
const WALLPAPERS: { id: Wallpaper; label: string }[] = [
  { id: 'doodle', label: tk('Doodle') }, { id: 'dots', label: tk('Dots') }, { id: 'grid', label: tk('Grid') },
  { id: 'gradient', label: tk('Gradient') }, { id: 'plain', label: tk('Plain') },
];
const FONTS: { id: FontSize; label: string }[] = [{ id: 'sm', label: tk('Small') }, { id: 'md', label: tk('Medium') }, { id: 'lg', label: tk('Large') }];

export function Appearance() {
  const s = useSettings();
  return (
    <>
      <Section className="px-5 py-5">
        {/* Live preview of the current choices */}
        <div className={`wallpaper wp-${s.wallpaper} overflow-hidden rounded-2xl border border-line p-3`} aria-label={t('Preview')}>
          <div className="mb-2 flex justify-start"><span className="rounded-2xl rounded-bl-md bg-bubble-in px-3 py-1.5 text-[0.95rem] shadow-bubble">{t('Hey! How do I look? 👋')}</span></div>
          <div className="flex justify-end"><span className="rounded-2xl rounded-br-md bg-bubble-out px-3 py-1.5 text-[0.95rem] shadow-bubble">{t('Looking great ✨')}</span></div>
        </div>
      </Section>

      <Section title={t('Theme')} className="px-5 pb-5">
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('Theme')}>
          {THEMES.map((th) => (
            <button key={th.id} role="radio" aria-checked={s.theme === th.id} onClick={() => setSettings({ theme: th.id })}
              className={cn('flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 text-sm font-medium transition',
                s.theme === th.id ? 'border-accent bg-accent/10 text-accent-ink' : 'border-line hover:bg-hover')}>
              {th.icon}{t(th.label)}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t('Accent colour')} className="px-5 pb-5">
        <div className="mt-2 flex flex-wrap gap-3" role="radiogroup" aria-label={t('Accent colour')}>
          {ACCENTS.map((a) => (
            <button key={a.id} role="radio" aria-checked={s.accent === a.id} aria-label={t(a.label)} title={t(a.label)}
              onClick={() => setSettings({ accent: a.id })}
              className={cn('size-10 rounded-full ring-offset-2 ring-offset-panel transition', s.accent === a.id ? 'ring-3' : 'hover:scale-110')}
              style={{ background: a.color, ['--tw-ring-color' as string]: a.color }} />
          ))}
        </div>
      </Section>

      <Section title={t('Chat wallpaper')} className="px-5 pb-5">
        <div className="mt-2 grid grid-cols-5 gap-2" role="radiogroup" aria-label={t('Chat wallpaper')}>
          {WALLPAPERS.map((w) => (
            <button key={w.id} role="radio" aria-checked={s.wallpaper === w.id} onClick={() => setSettings({ wallpaper: w.id })} className="text-center">
              <span className={cn(`wallpaper wp-${w.id} block aspect-[3/4] rounded-xl border-2 transition`, s.wallpaper === w.id ? 'border-accent' : 'border-line')} />
              <span className="mt-1 block text-xs text-muted">{t(w.label)}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title={t('Text size')} className="px-5 pb-5">
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('Text size')}>
          {FONTS.map((f, i) => (
            <button key={f.id} role="radio" aria-checked={s.fontSize === f.id} onClick={() => setSettings({ fontSize: f.id })}
              className={cn('rounded-xl border-2 py-2.5 font-medium transition', s.fontSize === f.id ? 'border-accent bg-accent/10 text-accent-ink' : 'border-line hover:bg-hover')}
              style={{ fontSize: 13 + i * 2 }}>
              {t(f.label)}
            </button>
          ))}
        </div>
      </Section>
    </>
  );
}

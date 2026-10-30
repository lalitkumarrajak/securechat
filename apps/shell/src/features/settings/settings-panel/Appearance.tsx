import type { ReactNode } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { ACCENTS, setSettings, useSettings, type FontSize, type Theme, type Wallpaper } from '../../../state/settings';
import { Section } from './Section';

const THEMES: { id: Theme; label: string; icon: ReactNode }[] = [
  { id: 'system', label: 'System', icon: <Monitor className="size-5" /> },
  { id: 'light', label: 'Light', icon: <Sun className="size-5" /> },
  { id: 'dark', label: 'Dark', icon: <Moon className="size-5" /> },
];
const WALLPAPERS: { id: Wallpaper; label: string }[] = [
  { id: 'doodle', label: 'Doodle' }, { id: 'dots', label: 'Dots' }, { id: 'grid', label: 'Grid' },
  { id: 'gradient', label: 'Gradient' }, { id: 'plain', label: 'Plain' },
];
const FONTS: { id: FontSize; label: string }[] = [{ id: 'sm', label: 'Small' }, { id: 'md', label: 'Medium' }, { id: 'lg', label: 'Large' }];

export function Appearance() {
  const s = useSettings();
  return (
    <>
      <Section className="px-5 py-5">
        {/* Live preview of the current choices */}
        <div className={`wallpaper wp-${s.wallpaper} overflow-hidden rounded-2xl border border-line p-3`} aria-label="Preview">
          <div className="mb-2 flex justify-start"><span className="rounded-2xl rounded-bl-md bg-bubble-in px-3 py-1.5 text-[0.95rem] shadow-bubble">Hey! How do I look? 👋</span></div>
          <div className="flex justify-end"><span className="rounded-2xl rounded-br-md bg-bubble-out px-3 py-1.5 text-[0.95rem] shadow-bubble">Looking great ✨</span></div>
        </div>
      </Section>

      <Section title="Theme" className="px-5 pb-5">
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button key={t.id} role="radio" aria-checked={s.theme === t.id} onClick={() => setSettings({ theme: t.id })}
              className={cn('flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 text-sm font-medium transition',
                s.theme === t.id ? 'border-accent bg-accent/10 text-accent-ink' : 'border-line hover:bg-hover')}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Accent colour" className="px-5 pb-5">
        <div className="mt-2 flex flex-wrap gap-3" role="radiogroup" aria-label="Accent colour">
          {ACCENTS.map((a) => (
            <button key={a.id} role="radio" aria-checked={s.accent === a.id} aria-label={a.label} title={a.label}
              onClick={() => setSettings({ accent: a.id })}
              className={cn('size-10 rounded-full ring-offset-2 ring-offset-panel transition', s.accent === a.id ? 'ring-3' : 'hover:scale-110')}
              style={{ background: a.color, ['--tw-ring-color' as string]: a.color }} />
          ))}
        </div>
      </Section>

      <Section title="Chat wallpaper" className="px-5 pb-5">
        <div className="mt-2 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Chat wallpaper">
          {WALLPAPERS.map((w) => (
            <button key={w.id} role="radio" aria-checked={s.wallpaper === w.id} onClick={() => setSettings({ wallpaper: w.id })} className="text-center">
              <span className={cn(`wallpaper wp-${w.id} block aspect-[3/4] rounded-xl border-2 transition`, s.wallpaper === w.id ? 'border-accent' : 'border-line')} />
              <span className="mt-1 block text-xs text-muted">{w.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Text size" className="px-5 pb-5">
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Text size">
          {FONTS.map((f, i) => (
            <button key={f.id} role="radio" aria-checked={s.fontSize === f.id} onClick={() => setSettings({ fontSize: f.id })}
              className={cn('rounded-xl border-2 py-2.5 font-medium transition', s.fontSize === f.id ? 'border-accent bg-accent/10 text-accent-ink' : 'border-line hover:bg-hover')}
              style={{ fontSize: 13 + i * 2 }}>
              {f.label}
            </button>
          ))}
        </div>
      </Section>
    </>
  );
}

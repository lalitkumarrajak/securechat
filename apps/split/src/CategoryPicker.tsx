import { t } from '@sanga/i18n';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { catName, type Category } from './model';

const FIRST = 12;

/** Pick a category from a wrapped grid; the full list is a tap (or a search) away. */
export function CategoryPicker({ cats, value, onChange }: { cats: Category[]; value: string; onChange: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s) return cats.filter((c) => catName(c).toLowerCase().includes(s) || c.name.toLowerCase().includes(s));
    const list = all ? cats : cats.slice(0, FIRST);
    // The chosen one is always visible, even when it's further down the list.
    return list.some((c) => c.id === value) || all ? list : [...list, ...cats.filter((c) => c.id === value)];
  }, [cats, all, q, value]);
  return (
    <div>
      {(all || cats.length > FIRST) && (
        <label className="relative mb-2 block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search categories')} aria-label={t('Search categories')}
            className="h-9 w-full rounded-xl border border-line bg-panel-2 pr-3 pl-9 text-sm outline-none focus:border-accent" />
        </label>
      )}
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('Category')}>
        {shown.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={c.id === value} onClick={() => onChange(c.id)}
            className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition',
              c.id === value ? 'border-transparent font-semibold text-white' : 'border-line bg-panel hover:bg-hover')}
            style={c.id === value ? { background: c.color } : undefined}>
            <span aria-hidden>{c.emoji}</span>{catName(c)}
          </button>
        ))}
        {!q && cats.length > FIRST && (
          <button type="button" onClick={() => setAll(!all)} className="rounded-full px-3 py-1.5 text-sm font-medium text-accent hover:bg-hover">
            {all ? t('Fewer') : t('More ({n})', { n: cats.length - FIRST })}
          </button>
        )}
        {q && shown.length === 0 && <p className="py-1 text-sm text-muted">{t('No category matches “{q}”.', { q })}</p>}
      </div>
    </div>
  );
}

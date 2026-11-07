import { t } from '@sanga/i18n';
import { cn } from '@sanga/ui/utils';
import { GROUP_KINDS, type GroupKind } from './model';

/** What a group is for: spending (counts in My spending), credit card bills, or lending & borrowing (they don't). */
export function KindPicker({ value, onChange, id }: { value: GroupKind; onChange: (k: GroupKind) => void; id: string }) {
  return (
    <div role="radiogroup" aria-labelledby={id} className="grid gap-2">
      {GROUP_KINDS.map((k) => (
        <button key={k.id} type="button" role="radio" aria-checked={value === k.id} onClick={() => onChange(k.id)}
          className={cn('flex items-start gap-3 rounded-xl border p-3 text-left transition', value === k.id ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'border-line bg-panel-2 hover:bg-hover')}>
          <span className="text-2xl leading-none" aria-hidden>{k.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t(k.name)}</span>
            <span className="block text-xs text-muted">{t(k.about)}</span>
          </span>
          <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2', value === k.id ? 'border-accent' : 'border-line')} aria-hidden>
            {value === k.id && <span className="size-2.5 rounded-full bg-accent" />}
          </span>
        </button>
      ))}
    </div>
  );
}

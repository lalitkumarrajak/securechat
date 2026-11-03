import { t } from '@sanga/i18n';
import { Paperclip } from 'lucide-react';
import { catName, money, type Category, type Expense } from './model';

/** One expense in the list: what, who paid, the total and what it means for you. */
export function ExpenseRow({ e, cat, payer, mine, currency, addedBy, involved, onOpen }: {
  e: Expense; cat: Category; payer: string; mine: number; currency: string; addedBy?: string; involved: boolean; onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-hover">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl text-xl" style={{ background: cat.color + '26' }} aria-hidden>{cat.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate font-medium">{e.desc}{e.bill && <Paperclip className="size-3.5 shrink-0 text-muted" aria-label={t('Has a bill')} />}</span>
        <span className="block truncate text-sm text-muted">{t('{name} paid {amount}', { name: payer, amount: money(e.amount, currency) })} · {catName(cat)}{addedBy && ` · ${t('added by {name}', { name: addedBy })}`}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className={`block text-sm font-semibold tabular-nums ${mine > 0 ? 'text-emerald-600 dark:text-emerald-400' : mine < 0 ? 'text-danger' : 'text-muted'}`}>
          {mine === 0 ? (involved ? t('your own expense') : t('not involved')) : mine > 0 ? t('you lent {amount}', { amount: money(mine, currency) }) : t('you owe {amount}', { amount: money(-mine, currency) })}
        </span>
      </span>
    </button>
  );
}

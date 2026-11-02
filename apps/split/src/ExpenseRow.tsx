import { Paperclip } from 'lucide-react';
import { money, type Category, type Expense } from './model';

/** One expense in the list: what, who paid, the total and what it means for you. */
export function ExpenseRow({ e, cat, payer, mine, currency, onOpen }: {
  e: Expense; cat: Category; payer: string; mine: number; currency: string; onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-hover">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl text-xl" style={{ background: cat.color + '26' }} aria-hidden>{cat.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate font-medium">{e.desc}{e.bill && <Paperclip className="size-3.5 shrink-0 text-muted" aria-label="Has a bill" />}</span>
        <span className="block truncate text-sm text-muted">{payer} paid {money(e.amount, currency)} · {cat.name}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className={`block text-sm font-semibold tabular-nums ${mine > 0 ? 'text-emerald-600 dark:text-emerald-400' : mine < 0 ? 'text-danger' : 'text-muted'}`}>
          {mine === 0 ? 'not involved' : mine > 0 ? `you lent ${money(mine, currency)}` : `you owe ${money(-mine, currency)}`}
        </span>
      </span>
    </button>
  );
}

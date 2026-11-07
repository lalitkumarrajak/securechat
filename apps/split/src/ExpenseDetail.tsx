import { locale, t, tx } from '@sanga/i18n';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { sdk } from '@sanga/sdk';
import { isSpending, kindOf, money, parseDay, type Expense } from './model';
import { useLedger, useNames } from './hooks';
import { deleteBill, removeRecord, type GroupData } from './store';
import { BillView } from './BillView';
import { CategoryChip } from './CategoryChip';
import { PersonDot } from './PersonDot';

/** An expense in full: who owes what, the bill, and edit / delete. */
export function ExpenseDetail({ g, expense, onClose, onEdit }: { g: GroupData; expense: Expense | null; onClose: () => void; onEdit: (e: Expense) => void }) {
  const name = useNames();
  const { meta, person, catOf } = useLedger(g);
  const currency = meta?.currency ?? 'INR';
  const e = expense && g.expenses[expense.id] && !g.expenses[expense.id].deleted ? g.expenses[expense.id] : null;

  const remove = async () => {
    if (!e) return;
    if (!(await sdk().confirm({ title: t('Delete this expense?'), description: t('It disappears for everyone in the group and balances are recalculated.'), confirmText: t('Delete'), destructive: true }))) return;
    if (e.bill) void deleteBill(g.gid, e.bill);
    removeRecord(g.gid, e);
    onClose();
  };

  return (
    <Dialog open={!!e} onOpenChange={(o) => { if (!o) onClose(); }} title={e?.desc ?? t('Expense')} className="md:max-w-lg">
      {e && (
        <div className="space-y-4">
          <div>
            <p className="text-3xl font-bold tabular-nums">{money(e.amount, currency)}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <CategoryChip cat={catOf(e.cat)} />
              {parseDay(e.date).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="mt-1 text-sm text-muted">{tx('Paid by {name}', { name: <b className="text-ink">{name(person(e.paidBy))}</b> })}</p>
            {(!isSpending(e.cat) || kindOf(meta) !== 'spending') && <p className="mt-1 text-xs text-muted">{t('Not counted in My spending')}</p>}
          </div>
          <div>
            <h3 className="mb-1.5 text-sm font-semibold">{e.mode === 'equal' ? t('Split equally') : e.mode === 'exact' ? t('Split by exact amounts') : e.mode === 'percent' ? t('Split by percentage') : t('Split by shares')}</h3>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {Object.entries(e.owed).map(([id, n]) => {
                const p = person(id);
                return (
                  <li key={id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <PersonDot p={p} name={name(p)} size={28} /><span className="flex-1 truncate">{name(p)}</span>
                    <span className="tabular-nums">{money(n, currency)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="text-xs text-muted">
            {tx('Added by {name}', { name: <b>{name(person(e.addedBy ?? e.by))}</b> })}{e.added ? ` · ${new Date(e.added).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}
            {e.by !== (e.addedBy ?? e.by) || (e.added && e.edited - e.added > 60_000) ? <> · {tx('last changed by {name} {when}', { name: <b>{name(person(e.by))}</b>, when: new Date(e.edited).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) })}</> : null}
          </p>
          {e.notes && <p className="rounded-xl bg-panel-2 p-3 text-sm whitespace-pre-wrap">{e.notes}</p>}
          {e.bill && <div><h3 className="mb-1.5 text-sm font-semibold">{t('Bill')}</h3><BillView gid={g.gid} id={e.bill} /></div>}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => { onClose(); onEdit(e); }}><Pencil className="size-4" />{t('Edit')}</Button>
            <Button variant="outline" className="flex-1 text-danger" onClick={() => void remove()}><Trash2 className="size-4" />{t('Delete')}</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

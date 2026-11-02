import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { sdk } from '@sanga/sdk';
import { money, parseDay, type Expense } from './model';
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
    if (!(await sdk().confirm({ title: 'Delete this expense?', description: 'It disappears for everyone in the group and balances are recalculated.', confirmText: 'Delete', destructive: true }))) return;
    if (e.bill) void deleteBill(g.gid, e.bill);
    removeRecord(g.gid, e);
    onClose();
  };

  return (
    <Dialog open={!!e} onOpenChange={(o) => { if (!o) onClose(); }} title={e?.desc ?? 'Expense'} className="md:max-w-lg">
      {e && (
        <div className="space-y-4">
          <div>
            <p className="text-3xl font-bold tabular-nums">{money(e.amount, currency)}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <CategoryChip cat={catOf(e.cat)} />
              {parseDay(e.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="mt-1 text-sm text-muted">Paid by <b className="text-ink">{name(person(e.paidBy))}</b></p>
          </div>
          <div>
            <h3 className="mb-1.5 text-sm font-semibold">Split {e.mode === 'equal' ? 'equally' : e.mode === 'exact' ? 'by exact amounts' : e.mode === 'percent' ? 'by percentage' : 'by shares'}</h3>
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
          {e.notes && <p className="rounded-xl bg-panel-2 p-3 text-sm whitespace-pre-wrap">{e.notes}</p>}
          {e.bill && <div><h3 className="mb-1.5 text-sm font-semibold">Bill</h3><BillView gid={g.gid} id={e.bill} /></div>}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => { onClose(); onEdit(e); }}><Pencil className="size-4" />Edit</Button>
            <Button variant="outline" className="flex-1 text-danger" onClick={() => void remove()}><Trash2 className="size-4" />Delete</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

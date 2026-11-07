import { t } from '@sanga/i18n';
import { useMemo, useState } from 'react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label, Textarea } from '@sanga/ui/input';
import { apportion, catName, isSpending, kindOf, parseAmount, splitAmount, toInput, today, validDay, type Expense, type Mode } from './model';
import { useLedger, useMe, useNames } from './hooks';
import { deleteBill, save, type GroupData } from './store';
import { BillField } from './BillField';
import { CategoryPicker } from './CategoryPicker';
import { SplitEditor, type SplitDraft } from './SplitEditor';

/** Add or change an expense. `expense` null: closed; an object without a saved record is new. */
export function ExpenseEditor({ g, expense, onClose }: { g: GroupData; expense: Expense | null; onClose: () => void }) {
  return (
    <Dialog open={!!expense} onOpenChange={(o) => { if (!o) onClose(); }} title={expense && g.expenses[expense.id] ? t('Edit expense') : t('Add expense')} className="md:max-w-lg">
      {expense && <Form key={expense.id} g={g} expense={expense} onClose={onClose} />}
    </Dialog>
  );
}

function seed(mode: Mode, who: string[], amount: number | null, currency: string): Record<string, string> {
  if (mode === 'shares') return Object.fromEntries(who.map((id) => [id, '1']));
  if (mode === 'percent') { const p = apportion(10000, who.map(() => 1)); return Object.fromEntries(who.map((id, i) => [id, String(p[i] / 100)])); }
  if (mode === 'exact' && amount) { const p = apportion(amount, who.map(() => 1)); return Object.fromEntries(who.map((id, i) => [id, toInput(p[i], currency)])); }
  return {};
}

function Form({ g, expense, onClose }: { g: GroupData; expense: Expense; onClose: () => void }) {
  const me = useMe();
  const name = useNames();
  const { meta, people, cats } = useLedger(g);
  const currency = meta?.currency ?? 'INR';
  const isNew = !g.expenses[expense.id];
  // Someone who left can't be added to new expenses, but stays when an old one already has them.
  const choices = useMemo(() => people.filter((p) => !p.gone || expense.owed[p.id] !== undefined || expense.paidBy === p.id), [people, expense]);

  const [desc, setDesc] = useState(expense.desc);
  const [amountText, setAmountText] = useState(expense.amount ? toInput(expense.amount, currency) : '');
  const [cat, setCat] = useState(expense.cat);
  const [date, setDate] = useState(expense.date);
  const [paidBy, setPaidBy] = useState(expense.paidBy);
  const [notes, setNotes] = useState(expense.notes ?? '');
  const [bill, setBill] = useState(expense.bill);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [draft, setDraft] = useState<SplitDraft>(() => {
    const who = Object.keys(expense.owed).length ? Object.keys(expense.owed) : choices.filter((p) => !p.gone).map((p) => p.id);
    const texts = Object.keys(expense.owed).length
      ? Object.fromEntries(Object.entries(expense.values).map(([id, v]) => [id, expense.mode === 'exact' ? toInput(v, currency) : expense.mode === 'percent' ? String(v / 100) : String(v)]))
      : {};
    return { mode: expense.mode, who, texts };
  });
  const [tried, setTried] = useState(false);

  const amount = parseAmount(amountText, currency);
  const values = useMemo(() => Object.fromEntries(draft.who.map((id) => {
    const tv = (draft.texts[id] ?? '').trim();
    if (draft.mode === 'exact') return [id, parseAmount(tv, currency) ?? 0];
    if (draft.mode === 'percent') return [id, Math.round(Number(tv) * 100) || 0];
    return [id, tv === '' ? 1 : Math.round(Number(tv)) || 0];
  })), [draft, currency]);
  const result = useMemo(() => (amount ? splitAmount(amount, draft.mode, draft.who, values) : null), [amount, draft, values]);
  const splitError = result && 'error' in result ? result.error : '';
  const owed = result && 'owed' in result ? result.owed : null;

  const change = (d: SplitDraft) => setDraft(d.mode !== draft.mode ? { ...d, texts: seed(d.mode, d.who, amount, currency) } : d);

  const problem = !amount ? t('Enter an amount') : !validDay(date) ? t('Pick a date') : splitError;
  const submit = () => {
    setTried(true);
    if (problem || !amount || !owed) return;
    const used = new Set([bill]);
    // A bill that was replaced or removed before saving is deleted again.
    for (const id of uploaded) if (!used.has(id)) void deleteBill(g.gid, id);
    if (expense.bill && expense.bill !== bill) void deleteBill(g.gid, expense.bill);
    save(g.gid, {
      type: 'expense', id: expense.id, desc: desc.trim() || (cats.get(cat) ? catName(cats.get(cat)!) : t('Expense')), amount, cat, date, paidBy, mode: draft.mode,
      values: draft.mode === 'equal' ? {} : values, owed, ...(notes.trim() && { notes: notes.trim() }), ...(bill && { bill }), by: me, edited: 0,
    });
    onClose();
  };
  const cancel = () => { for (const id of uploaded) void deleteBill(g.gid, id); onClose(); };

  const catList = useMemo(() => [...cats.values()], [cats]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
      <div>
        <Label htmlFor="amt">{t('Amount ({currency})', { currency })}</Label>
        <Input id="amt" autoFocus={isNew} inputMode="decimal" placeholder="0.00" value={amountText} onChange={(e) => setAmountText(e.target.value)} className="h-14 text-2xl font-semibold tabular-nums" />
      </div>
      <div>
        <Label htmlFor="desc">{t('What was it for?')}</Label>
        <Input id="desc" maxLength={120} placeholder={t('e.g. Dinner, Metro card, Gym fee')} value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
      <div><Label>{t('Category')}</Label><CategoryPicker cats={catList} value={cat} onChange={setCat} />
        {!isSpending(cat) && kindOf(meta) === 'spending' && <p className="mt-1.5 text-xs text-muted">{t('Not counted in My spending: this only moves money. It still counts in balances.')}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0"><Label htmlFor="date">{t('Date')}</Label><Input id="date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="min-w-0">
          <Label htmlFor="paid">{t('Paid by')}</Label>
          <select id="paid" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className="h-11 w-full min-w-0 rounded-xl border border-line bg-panel-2 px-3 text-[0.95rem] outline-none focus:border-accent">
            {choices.map((p) => <option key={p.id} value={p.id}>{name(p)}</option>)}
          </select>
        </div>
      </div>
      <div><Label>{t('Split')}</Label>
        <SplitEditor people={choices} name={name} draft={draft} onChange={change} owed={owed} currency={currency} error={tried || draft.mode !== 'equal' ? splitError : ''} />
      </div>
      <div><Label htmlFor="notes" hint={t('optional')}>{t('Notes')}</Label><Textarea id="notes" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div><Label hint={t('optional')}>{t('Bill')}</Label><BillField gid={g.gid} value={bill} onChange={setBill} onUploaded={(id) => setUploaded((u) => [...u, id])} /></div>
      {tried && problem && !splitError && <p className="text-sm text-danger" role="alert">{problem}</p>}
      <div className="flex gap-2 pt-1">
        <Button variant="secondary" className="flex-1" onClick={cancel}>{t('Cancel')}</Button>
        <Button type="submit" className="flex-1">{isNew ? t('Add expense') : t('Save')}</Button>
      </div>
    </form>
  );
}

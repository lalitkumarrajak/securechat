// What changed between two versions of a record, as history lines. Pure: the store calls it on every save.
import { kindOf, type Activity, type Expense, type Meta, type Record_, type Settlement } from './model';

type Line = Omit<Activity, 'type' | 'id' | 'by' | 'ts'>;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function expenseLines(prev: Expense | undefined, e: Expense): Line[] {
  const base = { ref: e.id, desc: e.desc, amount: e.amount };
  if (e.deleted) return prev && !prev.deleted ? [{ kind: 'expense_delete', ...base }] : [];
  if (!prev || prev.deleted) return [{ kind: 'expense_add', ...base }];
  const changed = prev.amount !== e.amount || prev.desc !== e.desc || prev.cat !== e.cat || prev.date !== e.date || prev.paidBy !== e.paidBy
    || prev.bill !== e.bill || (prev.notes ?? '') !== (e.notes ?? '') || prev.mode !== e.mode || !same(prev.owed, e.owed);
  if (!changed) return [];
  return [{ kind: 'expense_edit', ...base, ...(prev.amount !== e.amount && { wasAmount: prev.amount }), ...(prev.desc !== e.desc && { wasDesc: prev.desc }) }];
}

function settleLines(prev: Settlement | undefined, s: Settlement): Line[] {
  const base = { from: s.from, to: s.to, amount: s.amount };
  if (s.deleted) return prev && !prev.deleted ? [{ kind: prev.pending ? 'settle_decline' : 'settle_undo', ...base }] : [];
  if (!prev || prev.deleted) return [{ kind: s.pending ? 'settle_request' : 'settle_add', ...base }];
  return prev.pending && !s.pending ? [{ kind: 'settle_confirm', ...base }] : [];
}

function metaLines(prev: Meta | null | undefined, m: Meta, by: string): Line[] {
  if (!prev) return [{ kind: 'group_create', name: m.name }];
  const out: Line[] = [];
  if (prev.name !== m.name) out.push({ kind: 'group_rename', name: m.name, wasDesc: prev.name });
  if (kindOf(prev) !== kindOf(m)) out.push({ kind: 'group_kind', name: kindOf(m) }); // what it's for: spending, card bills, lending
  const was = new Map(prev.people.map((p) => [p.id, p]));
  for (const p of m.people) {
    const before = was.get(p.id);
    if (!before) out.push({ kind: 'person_add', who: p.id });
    else if (before.name !== p.name && !p.u) out.push({ kind: 'person_rename', who: p.id, wasDesc: before.name, name: p.name });
    else if (p.gone && !before.gone) out.push({ kind: p.u === by ? 'person_left' : 'person_remove', who: p.id });
    else if (!p.gone && before.gone) out.push({ kind: 'person_add', who: p.id });
  }
  const now = new Set(m.people.map((p) => p.id));
  for (const p of prev.people) if (!now.has(p.id) && !p.gone) out.push({ kind: 'person_remove', who: p.id });
  const hadCat = new Set(prev.cats.map((c) => c.id));
  for (const c of m.cats) if (!hadCat.has(c.id)) out.push({ kind: 'category_add', name: c.name });
  return out;
}

/** The history lines for saving `next` over `prev` (what was there before, or nothing). Nothing if nothing that matters changed. */
export function activityFor(prev: Record_ | null | undefined, next: Record_, by: string, now: number): Omit<Activity, 'id'>[] {
  const lines = next.type === 'expense' ? expenseLines(prev as Expense | undefined, next)
    : next.type === 'settle' ? settleLines(prev as Settlement | undefined, next)
      : next.type === 'meta' ? metaLines(prev as Meta | null | undefined, next, by) : [];
  return lines.map((l, i) => ({ type: 'activity' as const, by, ts: now + i, ...l }));
}

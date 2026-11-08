// Which of your accounts (Accounts: bank, debit card, credit card, cash, wallet) a payment came out of,
// or went into. It's yours alone: it's kept in your Accounts records, never in the group's, and the
// account's balance follows the expense, including when someone else in the group changes or deletes it.
import { useEffect, useMemo, useState } from 'react';
import { t } from '@sanga/i18n';
import { link, linked, live, liveAccounts, lastUsed, startLedger, unlink, useLedger as useMoney, type Entry } from '@sanga/ledger';
import type { GroupData } from './store';

/** What a Split record is called in Accounts. */
export const refOf = (gid: string, id: string) => `split:${gid}:${id}`;
/** '' (not tracked), an account id, or 'd:<debit card id>'. */
export type Choice = string;

const choiceOf = (e?: Entry): Choice => (e ? (e.via ? `d:${e.via}` : e.account) : '');

/** The choice for a record: as saved before, else the last one used (for a new one), else not tracked. */
export function usePaidFrom(ref: string, currency: string, fresh: boolean, skip = false) {
  const accounts = useMoney((s) => s.accounts), debits = useMoney((s) => s.debits), loaded = useMoney((s) => s.loaded);
  const [choice, setChoice] = useState<Choice | null>(null);
  useEffect(() => { void startLedger(); }, []);
  const options = useMemo(() => {
    const list = liveAccounts({ ...useMoney.getState(), accounts }).filter((a) => a.currency === currency);
    const ds = live(Object.values(debits));
    return list.flatMap((a) => [{ value: a.id, label: a.name + (a.last4 ? ` ••${a.last4}` : a.acc4 ? ` ••${a.acc4}` : ''), kind: a.kind },
      ...ds.filter((d) => d.account === a.id).map((d) => ({ value: `d:${d.id}`, label: t('{card} (debit card, {account})', { card: d.name + (d.last4 ? ` ••${d.last4}` : ''), account: a.name }), kind: 'debit' as const }))]);
  }, [accounts, debits, currency]);
  useEffect(() => {
    if (!loaded || choice !== null) return;
    const old = linked(ref);
    if (old || !fresh || skip) { setChoice(choiceOf(old)); return; }
    void lastUsed().then((last) => setChoice(last && options.some((o) => o.value === last) ? last : ''));
  }, [loaded, ref, fresh, skip, options, choice]);
  return { choice: choice ?? '', setChoice, options, ready: loaded && choice !== null };
}

/** Save the choice with the record: money out of (or into) that account, or nothing. */
export function applyPaidFrom(ref: string, choice: Choice, x: { kind: 'in' | 'out'; amount: number; date: string; desc: string; cat?: string }) {
  if (!choice) return unlink(ref);
  const s = useMoney.getState();
  const via = choice.startsWith('d:') ? choice.slice(2) : undefined;
  const account = via ? s.debits[via]?.account : choice;
  if (!account) return unlink(ref);
  return link(ref, { ...x, account, via });
}

export function PaidFromField({ id, label, value, onChange, options, hint }: { id: string; label: string; value: Choice; onChange: (v: Choice) => void; options: { value: string; label: string }[]; hint?: string }) {
  if (!options.length) return null;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label} <span className="font-normal text-muted">· {t('only you see this')}</span></label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full min-w-0 rounded-xl border border-line bg-panel-2 px-3 text-[0.95rem] outline-none focus:border-accent">
        <option value="">{t('Don’t take it from an account')}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Keep your accounts in step with the groups: an expense or payment deleted, or changed by anyone, or
 *  no longer paid by you, changes or drops what it took from your account. */
export function reconcile(groups: Record<string, GroupData>, me: string) {
  for (const e of live(Object.values(useMoney.getState().entries))) {
    if (!e.ref?.startsWith('split:')) continue;
    const [, gid, id] = e.ref.split(':');
    const g = groups[gid];
    if (!g?.meta) continue;                        // not loaded (yet), or left: leave it be
    const mine = g.meta.people.find((p) => p.u === me || p.id === me)?.id;
    const x = g.expenses[id], st = g.settles[id];
    if (x) {
      if (x.deleted || x.paidBy !== mine) { void unlink(e.ref); continue; }
      if (x.amount !== e.amount || x.date !== e.date || x.desc !== e.desc) void link(e.ref, { account: e.account, via: e.via, kind: 'out', amount: x.amount, date: x.date, desc: x.desc, cat: x.cat });
    } else if (st) {
      const kind = st.from === mine ? 'out' : st.to === mine ? 'in' : null;
      if (st.deleted || !kind) { void unlink(e.ref); continue; }
      if (st.amount !== e.amount || st.date !== e.date || kind !== e.kind) void link(e.ref, { account: e.account, via: e.via, kind, amount: st.amount, date: st.date, desc: e.desc });
    }
  }
}

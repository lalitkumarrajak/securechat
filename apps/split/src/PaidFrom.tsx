// Which of your accounts (Accounts: bank, debit card, credit card, cash, wallet) a payment came out of,
// or went into. It's yours alone: it's kept in your Accounts records, never in the group's, and the
// account's balance follows the expense, including when someone else in the group changes or deletes it.
import { useEffect, useMemo, useState } from 'react';
import { Banknote, Check, CreditCard, Landmark, Link2, Wallet, X } from 'lucide-react';
import { t } from '@sanga/i18n';
import { cn } from '@sanga/ui/utils';
import { link, linked, live, liveAccounts, lastUsed, startLedger, unlink, useLedger as useMoney, type Entry } from '@sanga/ledger';
import type { GroupData } from './store';

/** What a Split record is called in Accounts. */
export const refOf = (gid: string, id: string) => `split:${gid}:${id}`;
/** '' (not tracked), an account id, or 'd:<debit card id>'. */
export type Choice = string;

const choiceOf = (e?: Entry): Choice => (e ? (e.via ? `d:${e.via}` : e.account) : '');

type Kind = 'bank' | 'credit' | 'cash' | 'wallet' | 'debit';
export interface Option { value: string; label: string; kind: Kind; sub?: string }

/** The choice for a record: as linked before, else nothing (linking is up to you). The account used
 *  last is offered first. */
export function usePaidFrom(ref: string, currency: string) {
  const accounts = useMoney((s) => s.accounts), debits = useMoney((s) => s.debits), loaded = useMoney((s) => s.loaded);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [last, setLast] = useState<string | undefined>();
  useEffect(() => { void startLedger(); void lastUsed().then(setLast); }, []);
  const options = useMemo(() => {
    const list = liveAccounts({ ...useMoney.getState(), accounts }).filter((a) => a.currency === currency);
    const ds = live(Object.values(debits));
    const all: Option[] = list.flatMap((a) => [{ value: a.id, label: a.name + (a.last4 ? ` ••${a.last4}` : a.acc4 ? ` ••${a.acc4}` : ''), kind: a.kind as Kind, sub: a.bank },
      ...ds.filter((d) => d.account === a.id).map((d) => ({ value: `d:${d.id}`, label: t('{card} (debit card, {account})', { card: d.name + (d.last4 ? ` ••${d.last4}` : ''), account: a.name }), kind: 'debit' as const }))]);
    const i = all.findIndex((o) => o.value === last);
    return i > 0 ? [all[i], ...all.slice(0, i), ...all.slice(i + 1)] : all;
  }, [accounts, debits, currency, last]);
  useEffect(() => {
    if (!loaded || choice !== null) return;
    setChoice(choiceOf(linked(ref)));
  }, [loaded, ref, choice]);
  return { choice: choice ?? '', setChoice, options, last, ready: loaded && choice !== null };
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

const ICON: Record<Kind, typeof Landmark> = { bank: Landmark, credit: CreditCard, debit: CreditCard, cash: Banknote, wallet: Wallet };

/** Optional: a "Link to an account" button; tapped, your accounts to pick from. Linked, the account
 *  with Change and Remove. */
export function PaidFromField({ id, label, value, onChange, options, last, hint }: { id: string; label: string; value: Choice; onChange: (v: Choice) => void; options: Option[]; last?: string; hint?: string }) {
  const [open, setOpen] = useState(false);
  const picked = options.find((o) => o.value === value);
  const groups: [string, Option[]][] = ([
    [t('Bank accounts'), options.filter((o) => o.kind === 'bank')],
    [t('Debit cards'), options.filter((o) => o.kind === 'debit')],
    [t('Credit cards'), options.filter((o) => o.kind === 'credit')],
    [t('Cash and wallets'), options.filter((o) => o.kind === 'cash' || o.kind === 'wallet')],
  ] as [string, Option[]][]).filter(([, xs]) => xs.length);

  if (picked && !open) {
    const Icon = ICON[picked.kind];
    return (
      <div>
        <p className="mb-1.5 text-sm font-medium">{label} <span className="font-normal text-muted">· {t('only you see this')}</span></p>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-panel-2 p-2 pl-3">
          <Icon className="size-4 shrink-0 text-accent" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm font-medium" id={id}>{picked.label}</span>
          <button type="button" className="rounded-lg px-2 py-1 text-sm text-accent hover:bg-hover" onClick={() => setOpen(true)}>{t('Change')}</button>
          <button type="button" aria-label={t('Remove link')} className="rounded-lg p-1.5 text-muted hover:bg-hover" onClick={() => onChange('')}><X className="size-4" /></button>
        </div>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line p-3 text-left hover:bg-hover">
        <Link2 className="size-5 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{t('Link to an account')}</span>
          <span className="block text-xs text-muted">{t('Optional. Bank, card or cash: it comes off that balance in Accounts. Only you see this.')}</span>
        </span>
      </button>
    );
  }
  return (
    <div role="group" aria-label={label} className="rounded-xl border border-line p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex-1 text-sm font-medium">{label} <span className="font-normal text-muted">· {t('only you see this')}</span></span>
        <button type="button" aria-label={t('Close')} className="rounded-lg p-1.5 text-muted hover:bg-hover" onClick={() => setOpen(false)}><X className="size-4" /></button>
      </div>
      {!options.length ? (
        <p className="text-sm text-muted">{t('No accounts in this currency yet. Add your bank, cards or cash in More → Accounts.')}</p>
      ) : (
        <div className="grid max-h-64 gap-3 overflow-y-auto">
          {groups.map(([title, xs]) => (
            <div key={title}>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
              <div className="grid gap-1">
                {xs.map((o) => {
                  const Icon = ICON[o.kind], on = o.value === value;
                  return (
                    <button key={o.value} type="button" aria-pressed={on} onClick={() => { onChange(o.value); setOpen(false); }}
                      className={cn('flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm', on ? 'border-accent bg-accent/10' : 'border-transparent hover:bg-hover')}>
                      <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{o.label}{o.sub && <span className="text-muted"> · {o.sub}</span>}</span>
                      {o.value === last && !on && <span className="text-xs text-muted">{t('last used')}</span>}
                      {on && <Check className="size-4 text-accent" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {value && <button type="button" className="mt-2 text-sm text-muted underline" onClick={() => { onChange(''); setOpen(false); }}>{t('Don’t link it')}</button>}
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

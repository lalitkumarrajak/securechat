// Every account at a glance: what you have, what you owe on cards, and the two together; then the
// accounts by kind (bank, credit cards, cash, wallets), each with its balance.
import { useMemo, useState } from 'react';
import { ChevronRight, Copy, Plus } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { t } from '@sanga/i18n';
import { sdk } from '@sanga/sdk';
import { balances, CARD_BG, creditLine, duplicateCards, live, mergeCards, money, netWorth, newAccount, useLedger, type Account, type AccountKind } from '@sanga/ledger';
import { KIND_ORDER, KINDS } from './util';

export function Overview({ onOpen, onAdd }: { onOpen: (id: string) => void; onAdd: (a: Account) => void }) {
  const s = useLedger();
  const [hidden, setHidden] = useState(false);
  const bal = useMemo(() => balances(s), [s]);
  const all = useMemo(() => live(Object.values(s.accounts)).sort((a, b) => a.name.localeCompare(b.name)), [s.accounts]);
  const shown = all.filter((a) => hidden || !a.archived);
  const worth = useMemo(() => netWorth(s), [s]);
  const debits = useMemo(() => live(Object.values(s.debits)), [s.debits]);

  if (!all.length) {
    return (
      <div className="rounded-3xl border border-line/70 bg-panel p-6 text-center shadow-sm">
        <span className="text-4xl" aria-hidden>🏦</span>
        <h3 className="mt-2 text-lg font-bold">{t('All your money in one place')}</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{t('Add your bank accounts, credit cards and cash with what’s in them now. Split expenses and transfers keep the balances right.')}</p>
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {KIND_ORDER.map((k) => { const Icon = KINDS[k].icon; return (
            <button key={k} type="button" onClick={() => onAdd(newAccount(k, k === 'cash' ? { name: t('Cash') } : {}))} className="flex items-center gap-3 rounded-2xl border border-line p-3 text-left hover:bg-hover">
              <span className="grid size-10 place-items-center rounded-xl text-white" style={{ background: CARD_BG[newAccount(k).color] }}><Icon className="size-5" /></span>
              <span className="font-medium">{t('Add {kind}', { kind: t(KINDS[k].one).toLowerCase() })}</span>
            </button>); })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section aria-label={t('Totals')} className="grid gap-3 sm:grid-cols-3">
        {worth.map((w) => (
          <div key={w.currency} className="contents">
            <div className="rounded-3xl p-4 text-white shadow-md sm:col-span-1" style={{ background: 'linear-gradient(135deg, #0ea5e9, #1e3a8a)' }}>
              <p className="text-sm text-white/80">{t('You have')}</p><p className="text-2xl font-bold tabular-nums">{money(w.have, w.currency)}</p>
            </div>
            <div className="rounded-3xl border border-line/70 bg-panel p-4 shadow-sm">
              <p className="text-sm text-muted">{t('Card dues')}</p><p className="text-2xl font-bold tabular-nums">{money(w.owe, w.currency)}</p>
            </div>
            <div className="rounded-3xl border border-line/70 bg-panel p-4 shadow-sm">
              <p className="text-sm text-muted">{t('Net')}</p><p className={cn('text-2xl font-bold tabular-nums', w.net < 0 && 'text-danger')}>{money(w.net, w.currency)}</p>
            </div>
          </div>
        ))}
      </section>

      <Duplicates />

      {KIND_ORDER.map((k: AccountKind) => {
        const list = shown.filter((a) => a.kind === k);
        if (!list.length) return null;
        const Icon = KINDS[k].icon;
        return (
          <section key={k} aria-label={t(KINDS[k].many)}>
            <div className="mb-2 flex items-center gap-2 px-1"><Icon className="size-4 text-muted" /><h3 className="flex-1 font-semibold">{t(KINDS[k].many)}</h3>
              <Button size="sm" variant="ghost" onClick={() => onAdd(newAccount(k))}><Plus className="size-4" />{t('Add')}</Button></div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {list.map((a) => {
                const n = bal.get(a.id) ?? 0, credit = a.kind === 'credit';
                const owe = credit ? Math.max(0, -n) : 0;
                const line = credit ? creditLine(a, s, bal) : null, limit = line?.limit;
                const dc = debits.filter((d) => d.account === a.id).length;
                return (
                  <li key={a.id} className="min-w-0">
                    <button type="button" onClick={() => onOpen(a.id)} className={cn('flex w-full items-center gap-3 rounded-2xl border border-line/70 bg-panel p-3 text-left shadow-sm hover:bg-hover', a.archived && 'opacity-60')}>
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: CARD_BG[a.color] }}><Icon className="size-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{a.name}{(a.last4 || a.acc4) && <span className="font-normal text-muted"> ••{a.last4 ?? a.acc4}</span>}</span>
                        <span className="block text-xs text-muted line-clamp-2 break-words">
                          {credit ? (limit ? (line!.shared ? t('{amount} of {limit} shared limit available', { amount: money(line!.available ?? 0, a.currency), limit: money(limit, a.currency) }) : t('{amount} of {limit} limit available', { amount: money(line!.available ?? 0, a.currency), limit: money(limit, a.currency) })) : a.bank ?? t('Credit card'))
                            : [a.bank, dc ? (dc === 1 ? t('1 debit card') : t('{n} debit cards', { n: dc })) : ''].filter(Boolean).join(' · ') || t(KINDS[a.kind].one)}
                        </span>
                        {limit ? <span className="mt-1.5 block h-1 rounded-full bg-panel-2"><span className="block h-1 rounded-full bg-accent" style={{ width: `${Math.min(100, (line!.owe / limit) * 100)}%` }} /></span> : null}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={cn('block font-bold tabular-nums', !credit && n < 0 && 'text-danger')}>{money(credit ? owe : n, a.currency)}</span>
                        {credit && <span className="block text-xs text-muted">{n > 0 ? t('credit') : t('owed')}</span>}
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {all.some((a) => a.archived) && <button type="button" className="px-1 text-sm text-accent-ink" onClick={() => setHidden(!hidden)}>{hidden ? t('Hide hidden accounts') : t('Show hidden accounts')}</button>}
      <div className="flex flex-wrap gap-2 px-1">
        {KIND_ORDER.filter((k) => !shown.some((a) => a.kind === k)).map((k) => (
          <Button key={k} size="sm" variant="outline" onClick={() => onAdd(newAccount(k, k === 'cash' ? { name: t('Cash') } : {}))}><Plus className="size-4" />{t(KINDS[k].one)}</Button>
        ))}
      </div>
    </div>
  );
}

/** The same card added twice (same last four digits): offer to make them one. "Keep both" is remembered on this device. */
const KEPT = 'sanga-accounts-not-same';
const kept = (): string[] => { try { return JSON.parse(localStorage.getItem(KEPT) ?? '[]'); } catch { return []; } };
function Duplicates() {
  const accounts = useLedger((s) => s.accounts);
  const [skip, setSkip] = useState(kept);
  const groups = useMemo(() => duplicateCards().filter((g) => !skip.includes(g.map((a) => a.id).sort().join())), [accounts, skip]);
  if (!groups.length) return null;
  const keepBoth = (g: Account[]) => {
    const next = [...skip, g.map((a) => a.id).sort().join()];
    setSkip(next);
    try { localStorage.setItem(KEPT, JSON.stringify(next)); } catch { /* private window: asked again next time */ }
  };
  const merge = async ([keep, ...others]: Account[]) => {
    if (await sdk().confirm({ title: t('Make them one card?'), description: t('Everything on {others} moves to {name}, then {others} is removed.', { name: keep.name, others: others.map((o) => o.name).join(', ') }), confirmText: t('Merge') })) await mergeCards(keep, others);
  };
  return (
    <section aria-label={t('Cards added twice')} className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-4">
      <p className="flex items-center gap-2 font-semibold"><Copy className="size-4" />{t('Cards added twice')}</p>
      <p className="mt-1 text-sm text-muted">{t('These have the same last four digits. Merge each into one card, keeping its bills, statements and spending.')}</p>
      <ul className="mt-3 grid gap-2">
        {groups.map((g) => (
          <li key={g[0].id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-panel p-3">
            <span className="min-w-0 flex-1 text-sm"><span className="font-semibold">{g.map((a) => a.name || t('Credit card')).join(' · ')}</span> <span className="text-muted">••{g[0].last4}</span></span>
            <Button size="sm" variant="ghost" onClick={() => keepBoth(g)}>{t('Keep both')}</Button>
            <Button size="sm" onClick={() => void merge(g)}>{t('Merge')}</Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// One account: its balance (a card's: what you owe, what's left of the limit), what you can do with it,
// its details (never a full number), its debit cards, its bills and the history of money in and out.
import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowLeft, ArrowLeftRight, ArrowUpRight, CreditCard as CardIcon, FileUp, Pencil, Plus, Receipt } from 'lucide-react';
import { Button, IconButton } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { t } from '@sanga/i18n';
import { asCard, openBill, balances, CARD_BG, effect, entriesOf, live, money, newDebit, newEntry, useLedger, type Account, type CardBill, type CreditCard, type DebitCard, type Entry } from '@sanga/ledger';
import { BillsView } from './BillsView';
import { ACC_TYPES, entryTitle, KINDS, label, NETWORK_NAMES, ordinalDay, shortDay } from './util';

export function AccountView({ id, onBack, onEdit, onEntry, onDebit, onBill, onImport }: {
  id: string; onBack: () => void; onEdit: (a: Account) => void; onEntry: (e: Entry) => void; onDebit: (d: DebitCard) => void;
  onBill: (b: CardBill, c: CreditCard) => void; onImport: () => void;
}) {
  const s = useLedger();
  const a = s.accounts[id];
  const bal = useMemo(() => balances(s).get(id) ?? 0, [s, id]);
  const entries = useMemo(() => entriesOf(id, s), [s, id]);
  const debits = useMemo(() => live(Object.values(s.debits)).filter((d) => d.account === id), [s.debits, id]);
  const [more, setMore] = useState(false);
  if (!a || a.deleted) return null;
  const cur = a.currency, credit = a.kind === 'credit';
  const fmt = (n: number) => money(n, cur);
  const name = (x: string) => s.accounts[x]?.name ?? t('Removed account');
  const owe = credit ? Math.max(0, -bal) : 0;
  const used = credit && a.limit ? Math.min(1, owe / a.limit) : 0;
  const Icon = KINDS[a.kind].icon;
  const details: [string, string][] = [
    [t('Bank'), a.bank ?? ''], [t('Account type'), a.accType ? t(ACC_TYPES[a.accType]) : ''], [t('Account no.'), a.acc4 ? `•••• ${a.acc4}` : ''], ['IFSC', a.ifsc ?? ''], // i18n-ok
    [t('Account holder'), a.holder ?? ''], [t('Network'), a.network ? (a.network === 'other' ? t(NETWORK_NAMES.other) : NETWORK_NAMES[a.network]) : ''],
    [t('Card number'), a.last4 ? `•••• •••• •••• ${a.last4}` : ''], [t('Expiry'), a.expiry ?? ''], [t('Name on card'), a.nameOnCard ?? ''],
    [t('Credit limit'), a.limit ? fmt(a.limit) : ''], [t('Statement'), credit ? t('on the {day} of each month, due {n} days later', { day: ordinalDay(asCard(a).statementDay), n: asCard(a).dueAfter }) : ''],
    [t('Notes'), a.notes ?? ''],
  ].filter(([, v]) => v) as [string, string][];
  const add = (kind: Entry['kind'], o: Partial<Entry> = {}) => onEntry(newEntry(kind, id, o));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1">
        <IconButton label={t('All accounts')} onClick={onBack}><ArrowLeft /></IconButton>
        <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{a.name}</h2>
        <Button variant="ghost" size="sm" onClick={() => onEdit(a)}><Pencil className="size-4" />{t('Edit')}</Button>
      </div>

      <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg" style={{ background: CARD_BG[a.color] }}>
        <span aria-hidden className="absolute -top-10 -right-10 size-40 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-2 text-sm text-white/85"><Icon className="size-4" />{a.bank || t(KINDS[a.kind].one)}
          {a.network && <span className="ml-auto font-semibold tracking-wide">{a.network === 'other' ? '' : NETWORK_NAMES[a.network]}</span>}</div>
        <p className="relative mt-5 text-sm text-white/80">{credit ? (bal > 0 ? t('Credit balance') : t('You owe')) : t('Balance')}</p>
        <p className="relative text-3xl font-bold tabular-nums">{fmt(credit ? Math.abs(bal) : bal)}</p>
        {credit && a.limit ? (
          <div className="relative mt-3">
            <div className="h-1.5 rounded-full bg-white/25"><div className="h-1.5 rounded-full bg-white" style={{ width: `${used * 100}%` }} /></div>
            <p className="mt-1.5 flex text-xs text-white/85"><span className="flex-1">{t('{amount} available', { amount: fmt(Math.max(0, a.limit - owe)) })}</span><span>{t('Limit {amount}', { amount: fmt(a.limit) })}</span></p>
          </div>
        ) : null}
        {(a.last4 || a.acc4) && <p className="relative mt-4 font-mono tracking-widest text-white/90">•••• {a.last4 ?? a.acc4}{a.expiry && <span className="ml-4 text-xs tracking-normal">{a.expiry}</span>}</p>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {credit ? (<>
          <Action icon={<ArrowUpRight />} label={t('Spent')} onClick={() => add('out')} />
          <Action icon={<Receipt />} label={t('Pay bill')} onClick={() => { const ob = openBill(id); if (ob) onBill(ob, asCard(a)); else onEntry(newEntry('transfer', live(Object.values(s.accounts)).find((x) => x.kind === 'bank' && !x.archived)?.id ?? id, { to: id, amount: owe })); }} />
          <Action icon={<FileUp />} label={t('Statement')} onClick={onImport} />
        </>) : (<>
          <Action icon={<ArrowDownLeft />} label={t('Money in')} onClick={() => add('in')} />
          <Action icon={<ArrowUpRight />} label={t('Money out')} onClick={() => add('out')} />
          <Action icon={<ArrowLeftRight />} label={t('Transfer')} onClick={() => add('transfer')} />
        </>)}
      </div>

      {a.kind === 'bank' && (
        <section>
          <div className="mb-2 flex items-center px-1"><h3 className="flex-1 font-semibold">{t('Debit cards')}</h3>
            <Button size="sm" variant="ghost" onClick={() => onDebit({ ...newDebit(id), name: a.bank ? t('{bank} Debit', { bank: a.bank }) : '' })}><Plus className="size-4" />{t('Add')}</Button></div>
          {debits.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {debits.map((d) => (
                <li key={d.id}><button type="button" onClick={() => onDebit(d)} className="flex w-full items-center gap-3 rounded-2xl border border-line/70 bg-panel p-3 text-left hover:bg-hover">
                  <CardIcon className="size-5 text-muted" />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{d.name}{d.last4 && <span className="text-muted"> ••{d.last4}</span>}</span>
                    <span className="block text-xs text-muted">{[d.network && (d.network === 'other' ? '' : NETWORK_NAMES[d.network]), d.expiry && t('expires {date}', { date: d.expiry })].filter(Boolean).join(' · ')}</span></span>
                </button></li>
              ))}
            </ul>
          ) : <p className="px-1 text-sm text-muted">{t('Add the debit card on this account, to say what you paid with.')}</p>}
        </section>
      )}

      {details.length > 0 && (
        <section className="rounded-2xl border border-line/70 bg-panel">
          <button type="button" className="flex w-full items-center p-3 text-left font-semibold" aria-expanded={more} onClick={() => setMore(!more)}>
            <span className="flex-1">{t('Details')}</span><span className="text-sm font-normal text-accent-ink">{more ? t('Hide') : t('Show')}</span></button>
          {more && <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-line p-3 text-sm">
            {details.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>)}
          </dl>}
        </section>
      )}

      {credit && <section><h3 className="mb-2 px-1 font-semibold">{t('Bills')}</h3><BillsView card={id} onBill={onBill} onImport={onImport} onAddCard={() => onEdit(a)} /></section>}

      <section>
        <h3 className="mb-2 px-1 font-semibold">{t('History')}</h3>
        {entries.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line/70 bg-panel">
            {entries.map((e) => {
              const n = effect(e, id);
              return (
                <li key={e.id}><button type="button" onClick={() => onEntry(e)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-hover">
                  <span className={cn('grid size-9 shrink-0 place-items-center rounded-full [&_svg]:size-4', n >= 0 ? 'bg-green-500/12 text-green-700 dark:text-green-300' : 'bg-panel-2 text-muted')}>
                    {e.kind === 'transfer' ? <ArrowLeftRight /> : n >= 0 ? <ArrowDownLeft /> : <ArrowUpRight />}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{entryTitle(e, name, id)}</span>
                    <span className="block truncate text-xs text-muted">{[shortDay(e.date), e.ref?.startsWith('split:') && t('from Split'), e.via && s.debits[e.via] && t('Debit card {name}', { name: s.debits[e.via].name })].filter(Boolean).join(' · ')}</span></span>
                  <span className={cn('shrink-0 text-sm font-semibold tabular-nums', n >= 0 && 'text-green-700 dark:text-green-400')}>{n >= 0 ? '+' : '−'}{fmt(Math.abs(n))}</span>
                </button></li>
              );
            })}
          </ul>
        ) : <p className="px-1 text-sm text-muted">{t('Money in and out of {name} shows here: what you add, transfers, and what you pay for in Split from it.', { name: label(a) })}</p>}
      </section>
    </div>
  );
}

function Action({ icon, label: text, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5 rounded-2xl border border-line/70 bg-panel py-3 text-sm font-medium hover:bg-hover [&_svg]:size-5">
      <span className="grid size-9 place-items-center rounded-full bg-accent/12 text-accent-ink">{icon}</span>{text}
    </button>
  );
}

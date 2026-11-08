// Accounts: your bank accounts (and their debit cards), credit cards, cash and wallets, with what's in
// each now; money in and out, transfers between them, and what Split expenses you paid from each.
// Credit cards have their bills (reminded of by the Calendar) and statements, imported from the
// bank's PDF or SMS, with charts of where the money went. Records live in @sanga/ledger, end-to-end
// encrypted. A separate Sanga app, opened from More; it also runs on its own at /apps/accounts/.
import { t, useI18n } from '@sanga/i18n';
import { UI_DICTS } from '@sanga/ui/locale';
import { LEDGER_DICTS } from '@sanga/ledger/locale';
import { ACCOUNTS_DICTS } from './locale';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, BarChart3, Landmark, Receipt, WifiOff } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { sdk, type AppProps } from '@sanga/sdk';
import { liveAccounts, newAccount, newEntry, startLedger, useLedger, type Account, type CardBill, type CreditCard, type DebitCard, type Entry } from '@sanga/ledger';
import { takeShared } from '@sanga/ledger/share';
import { Overview } from './Overview';
import { AccountView } from './AccountView';
import { AccountSheet } from './AccountSheet';
import { EntrySheet } from './EntrySheet';
import { DebitSheet } from './DebitSheet';
import { BillsView } from './BillsView';
import { BillSheet } from './BillSheet';
import { ImportSheet, type ImportInput } from './ImportSheet';
import { SpendView } from './SpendView';

type Tab = 'accounts' | 'bills' | 'spending';

function AccountsAppInner({ onClose, params, tab: inTab }: AppProps) {
  const [tab, setTab] = useState<Tab>(params.view === 'bills' || params.import ? 'bills' : params.view === 'spending' ? 'spending' : 'accounts');
  const [open, setOpen] = useState<string | null>(params.account ?? null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [debit, setDebit] = useState<DebitCard | null>(null);
  const [bill, setBill] = useState<{ b: CardBill; c: CreditCard } | null>(null);
  const [importing, setImporting] = useState<ImportInput | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const online = sdk().useOnline();
  const loaded = useLedger((s) => s.loaded);

  useEffect(() => {
    void startLedger();
    // Opened by Share → Sanga with a statement or an SMS.
    if (params.import === 'share') void takeShared().then((x) => setImporting(x ?? {}));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const transfer = () => { const a = liveAccounts(); setEntry(newEntry('transfer', a[0]?.id ?? '', { to: a[1]?.id })); };
  const spending = (id?: string) => { setFocus(id ?? null); setOpen(null); setTab('spending'); };
  const TABS: [Tab, string, typeof Landmark][] = [['accounts', t('Accounts'), Landmark], ['bills', t('Bills'), Receipt], ['spending', t('Spending'), BarChart3]];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-bg">
      <header className="flex h-16 shrink-0 items-center gap-1 px-3">
        {!inTab && <IconButton label={t('Back')} onClick={onClose}><ArrowLeft /></IconButton>}
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight">{t('Accounts')}</h1>
        <nav className="mr-1 flex rounded-full bg-panel-2 p-1" role="tablist" aria-label={t('Accounts views')}>
          {TABS.map(([v, name, Icon]) => (
            <button key={v} role="tab" aria-selected={tab === v} aria-label={name} onClick={() => { setTab(v); setOpen(null); }}
              className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition', tab === v ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink')}>
              <Icon className="size-4" /><span className="hidden sm:inline">{name}</span>
            </button>
          ))}
        </nav>
        <IconButton label={t('Transfer money')} onClick={transfer}><ArrowLeftRight /></IconButton>
      </header>
      {!online && <p className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-warn-bg px-3 py-2 text-sm"><WifiOff className="size-4" />{t('Offline. Changes are saved and sent when you’re back.')}</p>}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-3 pt-1 pb-24 md:px-5 md:pb-8">
          {!loaded ? <p className="py-10 text-center text-muted" role="status">{t('Loading…')}</p> /* i18n-ok */
            : open ? <AccountView id={open} onBack={() => setOpen(null)} onEdit={setEditing} onEntry={setEntry} onDebit={setDebit} onBill={(b, c) => setBill({ b, c })} onImport={() => setImporting({})} />
            : tab === 'accounts' ? <Overview onOpen={setOpen} onAdd={setEditing} />
            : tab === 'bills' ? <BillsView onBill={(b, c) => setBill({ b, c })} onImport={() => setImporting({})} onAddCard={() => setEditing(newAccount('credit'))} />
            : <SpendView focus={focus} onImport={() => setImporting({})} />}
        </div>
      </div>

      <AccountSheet account={editing} onClose={() => setEditing(null)} />
      <EntrySheet entry={entry} onClose={() => setEntry(null)} />
      <DebitSheet card={debit} onClose={() => setDebit(null)} />
      <BillSheet bill={bill?.b ?? null} card={bill?.c ?? null} onClose={() => setBill(null)} onSpending={spending} />
      <ImportSheet input={importing} onClose={() => setImporting(null)} onDone={(id) => { setImporting(null); if (id) spending(id); }} />
    </div>
  );
}

/** Its words (and the UI kit's and the ledger's) for the language now on come first. */
export default function AccountsApp(props: AppProps) {
  useI18n({ ...ACCOUNTS_DICTS, ...LEDGER_DICTS, ...UI_DICTS });
  return <AccountsAppInner {...props} />;
}

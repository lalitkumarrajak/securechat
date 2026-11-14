// Import a statement: a PDF (chosen here, or shared to Sanga from the mail or files app) or the bank's
// SMS (pasted, or shared). Everything is read on this device. A locked PDF is tried with the passwords
// already saved on your cards first, so it asks only the first time. Then you check what was read (the
// card, statement and due dates, total and minimum due, each purchase and what it was for) and save:
// the card's statement day and due gap follow the statement, its bill is filled in (or marked "no bill"
// when nothing is due), and the purchases are kept for the spending charts. A payment SMS marks the bill paid.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, FileText, KeyRound, Loader2, MessageSquareText } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label, Textarea } from '@sanga/ui/input';
import { cn } from '@sanga/ui/utils';
import { t, tn } from '@sanga/i18n';
import {
  creditCards, liveAccounts, money, newAccount, openBill, payBill, save, saveStatement, statementId, todayKey, useLedger, newEntry,
  asCard, type CreditCard,
} from '@sanga/ledger';
import { CATS, CREDIT_CATS, SPEND_CATS, parseStatement, textLines, totals, type Cat, type Line, type Parsed, type Txn } from '@sanga/ledger/statement';
import { NeedPassword, readPdf, readWithSaved } from '@sanga/ledger/pdf';
import { label, monthTitle, parseAmount, SELECT, shortDay, toInput } from './util';

export interface ImportInput { file?: File; text?: string }
type Step = { s: 'pick' } | { s: 'reading' } | { s: 'password'; wrong: boolean } | { s: 'review'; p: Parsed } | { s: 'payment'; p: Parsed } | { s: 'empty' } | { s: 'error'; msg: string };

export function ImportSheet({ input, onClose, onDone }: { input: ImportInput | null; onClose: () => void; onDone: (statement?: string) => void }) {
  if (!input) return null;
  return <Flow input={input} onClose={onClose} onDone={onDone} />;
}

function Flow({ input, onClose, onDone }: { input: ImportInput; onClose: () => void; onDone: (statement?: string) => void }) {
  const [step, setStep] = useState<Step>({ s: 'pick' });
  const [text, setText] = useState(input.text ?? '');
  const [pw, setPw] = useState('');
  const [usedPw, setUsedPw] = useState<string | undefined>();
  const data = useRef<ArrayBuffer | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const done = (lines: Line[]) => {
    const p = parseStatement(lines);
    setStep(p.kind === 'payment' ? { s: 'payment', p } : p.kind === 'statement' ? { s: 'review', p } : { s: 'empty' });
  };
  const readFile = async (f: File) => {
    setStep({ s: 'reading' });
    try {
      if (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)) {
        data.current = await f.arrayBuffer();
        const saved = creditCards().map((c) => c.pdfPass ?? '');
        const r = await readWithSaved(data.current, saved);
        setUsedPw(r.password);
        done(r.lines);
      } else done(textLines(await f.text()));
    } catch (e) {
      if (e instanceof NeedPassword) setStep({ s: 'password', wrong: false });
      else setStep({ s: 'error', msg: t('Couldn’t read this file. Is it the statement PDF?') });
    }
  };
  const unlock = async () => {
    if (!data.current || !pw) return;
    setStep({ s: 'reading' });
    try { const lines = await readPdf(data.current, pw); setUsedPw(pw); done(lines); }
    catch (e) { setStep(e instanceof NeedPassword ? { s: 'password', wrong: true } : { s: 'error', msg: t('Couldn’t read this file. Is it the statement PDF?') }); }
  };
  // Shared to Sanga: start straight away.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (input.file) void readFile(input.file);
    else if (input.text) done(textLines(input.text));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const title = step.s === 'review' ? t('Check the statement') : step.s === 'payment' ? t('A payment to your card') : t('Import a statement');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={title} className="md:max-w-2xl"
      description={step.s === 'pick' ? t('Read on this phone: the statement never leaves it unencrypted.') : undefined}>
      {step.s === 'pick' && (
        <div className="grid gap-4">
          <input ref={fileRef} type="file" accept="application/pdf,.pdf,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); }} />
          <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-3 rounded-2xl border border-line p-4 text-left hover:bg-hover">
            <span className="grid size-11 place-items-center rounded-xl bg-accent/12 text-accent-ink"><FileText className="size-5" /></span>
            <span><span className="block font-semibold">{t('Choose the statement PDF')}</span><span className="block text-sm text-muted">{t('From your email or downloads. Locked ones are fine.')}</span></span>
          </button>
          <div>
            <Label htmlFor="i-sms"><MessageSquareText className="mr-1 inline size-4" />{t('Or paste the bank’s SMS')}</Label>
            <Textarea id="i-sms" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('e.g. Your card XX1234 statement: Total Amt Due Rs.12,345.00, Min Due Rs.620.00, due by 05-Apr-25')} />
            <Button className="mt-2 w-full" disabled={!text.trim()} onClick={() => done(textLines(text))}>{t('Read it')}</Button>
          </div>
          <p className="text-xs text-muted">{t('Tip: on Android, open the statement or the SMS and tap Share → Sanga.')}</p>
        </div>
      )}
      {step.s === 'reading' && <p className="flex items-center justify-center gap-2 py-10 text-muted" role="status"><Loader2 className="size-5 animate-spin" />{t('Reading the statement…')}</p>}
      {step.s === 'password' && (
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void unlock(); }}>
          <p className="flex gap-3 rounded-2xl bg-panel-2 p-3 text-sm"><KeyRound className="mt-0.5 size-5 shrink-0 text-accent-ink" />
            <span>{t('This PDF is locked. Banks usually use part of your name and your date of birth, or the card’s last digits; it’s in the email.')} <b>{t('I’ll remember it for this card, so you won’t be asked again.')}</b></span></p>
          <div><Label htmlFor="i-pw">{t('PDF password')}</Label><Input id="i-pw" autoFocus type="password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          {step.wrong && <p className="-mt-2 text-sm text-danger" role="alert">{t('That password didn’t open it. Try again.')}</p>}
          <Button type="submit" disabled={!pw}>{t('Open')}</Button>
        </form>
      )}
      {step.s === 'empty' && (
        <div className="grid gap-3 py-2 text-center">
          <AlertTriangle className="mx-auto size-8 text-amber-500" aria-hidden />
          <p className="font-semibold">{t('I couldn’t find a bill in this')}</p>
          <p className="text-sm text-muted">{t('Is it the card statement (not a reward points summary)? You can also enter the bill yourself.')}</p>
          <Button variant="outline" onClick={() => setStep({ s: 'pick' })}>{t('Try something else')}</Button>
        </div>
      )}
      {step.s === 'error' && (
        <div className="grid gap-3 py-2 text-center">
          <p className="text-danger">{step.msg}</p>
          <Button variant="outline" onClick={() => setStep({ s: 'pick' })}>{t('Try again')}</Button>
        </div>
      )}
      {step.s === 'review' && <Review p={step.p} password={usedPw} onSaved={(id) => onDone(id)} />}
      {step.s === 'payment' && <Payment p={step.p} onSaved={() => onDone()} />}
    </Dialog>
  );
}

/** The card a statement is for: the one with those last four digits, or your only card. */
function matchCard(cards: CreditCard[], p: Parsed) {
  return (p.last4 && cards.find((c) => c.last4 === p.last4)) || (!p.last4 && cards.length === 1 ? cards[0] : undefined);
}

function CardPick({ cards, value, onChange }: { cards: CreditCard[]; value: string; onChange: (v: string) => void }) {
  return (
    <select id="i-card" className={SELECT} value={value} onChange={(e) => onChange(e.target.value)}>
      {cards.map((c) => <option key={c.id} value={c.id}>{label(c)}</option>)}
      <option value="new">{t('A new card')}</option>
    </select>
  );
}

function Review({ p, password, onSaved }: { p: Parsed; password?: string; onSaved: (statement: string) => void }) {
  const accounts = useLedger((s) => s.accounts);
  const cards = useMemo(() => creditCards(), [accounts]);
  const matched = matchCard(cards, p);
  const [cardId, setCardId] = useState(matched?.id ?? (cards.length && !p.last4 ? cards[0].id : 'new'));
  const [newName, setNewName] = useState(p.bank ?? '');
  const card = cardId === 'new' ? undefined : cards.find((c) => c.id === cardId);
  const cur = card?.currency ?? 'INR';
  const [date, setDate] = useState(p.statementDate ?? '');
  const [due, setDue] = useState(p.dueDate ?? '');
  const [totalText, setTotalText] = useState(p.total !== undefined ? toInput(p.total, cur) : '');
  const [minText, setMinText] = useState(p.minDue !== undefined ? toInput(p.minDue, cur) : '');
  const [txns, setTxns] = useState<Txn[]>(p.txns);
  const [showAll, setShowAll] = useState(false);
  const [update, setUpdate] = useState(true);
  const [setOwed, setSetOwed] = useState(cardId === 'new');
  const total = parseAmount(totalText.replace(/^[-−]/, ''), cur), minDue = minText.trim() ? parseAmount(minText, cur) : undefined;
  const credit = /^[-−]|cr/i.test(totalText.trim());
  const ok = !!date && total !== null && minDue !== null && (cardId !== 'new' || newName.trim().length > 0);
  const sum = totals(txns);
  const day = date ? Number(date.slice(8)) : 0;
  const gap = date && due ? Math.round((new Date(`${due}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime()) / 864e5) : null;
  const changes = card ? [
    card.statementDay !== day && day ? t('statement day {a} → {b}', { a: card.statementDay, b: day }) : '',
    gap !== null && gap >= 0 && gap <= 60 && card.dueAfter !== gap ? t('due {a} → {b} days after it', { a: card.dueAfter, b: gap }) : '',
    p.limit && card.limit !== p.limit ? t('limit → {amount}', { amount: money(p.limit, cur) }) : '',
    p.last4 && !card.last4 ? t('last 4 → {d}', { d: p.last4 }) : '',
  ].filter(Boolean) : [];
  const seenBefore = card && useLedger.getState().statements[statementId(card.id, date.slice(0, 7))];

  const submit = async () => {
    if (!ok || total === null) return;
    const base: CreditCard = card ?? asCard(newAccount('credit', { name: newName.trim(), bank: p.bank, last4: p.last4 }));
    const next: CreditCard = { ...base };
    if (update || !card) {
      if (day) next.statementDay = day;
      if (gap !== null && gap >= 0 && gap <= 60) next.dueAfter = gap;
      if (p.limit && !next.limitWith) next.limit = p.limit;
      if (p.last4 && !next.last4) next.last4 = p.last4;
    }
    if (password) next.pdfPass = password;
    const holder = (update || !card) && p.limit && next.limitWith ? useLedger.getState().accounts[next.limitWith] : undefined;
    if (holder && !holder.deleted && holder.limit !== p.limit) await save({ ...holder, limit: p.limit }); // a shared limit is kept on the card holding it
    const r = await saveStatement({ card: next, date, due: due || undefined, from: p.from, total: credit ? -total : total, minDue: minDue ?? undefined, limit: p.limit, txns, setOutstanding: setOwed });
    onSaved(r.statement);
  };
  const setCat = (i: number, c: Cat) => setTxns((xs) => xs.map((x, j) => (j === i ? { ...x, cat: c } : x)));
  const list = showAll ? txns : txns.slice(0, 8);

  return (
    <form className="grid min-w-0 grid-cols-1 gap-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div className="grid grid-cols-2 gap-3">
        <div className={cn(cardId !== 'new' && 'col-span-2')}><Label htmlFor="i-card">{t('Card')}</Label><CardPick cards={cards} value={cardId} onChange={(v) => { setCardId(v); setSetOwed(v === 'new'); }} /></div>
        {cardId === 'new' && <div><Label htmlFor="i-new">{t('Card name')}</Label><Input id="i-new" maxLength={60} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('e.g. HDFC Millennia')} /></div>}
      </div>
      {p.last4 && !matched && cardId !== 'new' && <p className="-mt-2 text-xs text-amber-700 dark:text-amber-300">{t('The statement is for a card ending {d}.', { d: p.last4 })}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="i-date">{t('Statement date')}</Label><Input id="i-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><Label htmlFor="i-due">{t('Due date')}</Label><Input id="i-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        <div><Label htmlFor="i-total">{t('Total amount due')}</Label><Input id="i-total" inputMode="decimal" value={totalText} onChange={(e) => setTotalText(e.target.value)} className="tabular-nums" /></div>
        <div><Label htmlFor="i-min" hint={t('optional')}>{t('Minimum due')}</Label><Input id="i-min" inputMode="decimal" value={minText} onChange={(e) => setMinText(e.target.value)} className="tabular-nums" /></div>
      </div>
      {!date && <p className="-mt-2 text-sm text-danger">{t('Add the statement date: it says which month’s bill this is.')}</p>}
      {total !== null && (total === 0 || credit) && <p className="-mt-2 rounded-xl bg-green-500/10 p-3 text-sm">{t('Nothing to pay: this month is saved as “No bill”, with no reminders.')}</p>}
      {seenBefore && <p className="-mt-2 text-xs text-muted">{t('You imported this month’s statement before; saving replaces it.')}</p>}

      {card && changes.length > 0 && (
        <label className="flex items-start gap-2 rounded-xl bg-panel-2 p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={update} onChange={(e) => setUpdate(e.target.checked)} />
          <span>{t('Update {card} from this statement: {changes}', { card: card.name, changes: changes.join(', ') })}</span>
        </label>
      )}
      {total !== null && (
        <label className="flex items-start gap-2 rounded-xl bg-panel-2 p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={setOwed} onChange={(e) => setSetOwed(e.target.checked)} />
          <span>{t('Set what I owe on this card to {amount}', { amount: money(credit ? 0 : total, cur) })}
            <span className="block text-xs text-muted">{t('Leave it off if you’ve already recorded spending on this card since the statement.')}</span></span>
        </label>
      )}

      {txns.length > 0 && (
        <section aria-label={t('Transactions')} className="min-w-0 rounded-2xl border border-line">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-t-2xl border-b border-line bg-line text-center sm:grid-cols-4">
            <div className="bg-panel p-2.5"><p className="text-xs text-muted">{tn(txns.filter((x) => !x.credit).length, '{n} purchase', '{n} purchases')}</p><p className="font-semibold tabular-nums">{money(sum.spent, cur)}</p></div>
            <div className="bg-panel p-2.5"><p className="text-xs text-muted">{t('Refunds')}</p><p className="font-semibold tabular-nums">{money(sum.refunds, cur)}</p></div>
            <div className="bg-panel p-2.5"><p className="text-xs text-muted">{t('Cashback')}</p><p className="font-semibold tabular-nums text-green-700 dark:text-green-400">{money(sum.cashback, cur)}</p></div>
            <div className="bg-panel p-2.5"><p className="text-xs text-muted">{t('Paid to card')}</p><p className="font-semibold tabular-nums">{money(sum.paid, cur)}</p></div>
          </div>
          {/* On a phone a row may need more room than the sheet has: the list then scrolls sideways instead of cutting it off. */}
          <div className="overflow-x-auto overscroll-x-contain" tabIndex={0}>
          <ul className="w-max min-w-full divide-y divide-line">
            {list.map((x, i) => (
              <li key={i} className="flex items-center gap-2 px-3 py-2">
                <span className="w-12 shrink-0 whitespace-nowrap text-xs text-muted">{shortDay(x.date)}</span>
                <span className="flex-1 whitespace-nowrap text-sm">{x.desc}</span>
                <select aria-label={t('Category')} value={x.cat} onChange={(e) => setCat(i, e.target.value as Cat)} className="h-8 shrink-0 rounded-lg border border-line bg-panel-2 px-1 text-xs">
                  {(x.credit ? CREDIT_CATS : SPEND_CATS).map((c) => <option key={c} value={c}>{CATS[c].emoji} {t(CATS[c].label)}</option>)}
                </select>
                <span className={cn('min-w-20 shrink-0 whitespace-nowrap text-right text-sm tabular-nums', x.credit && 'text-green-600 dark:text-green-400')}>{x.credit ? '+' : ''}{money(x.amount, cur)}</span>
              </li>
            ))}
          </ul>
          </div>
          {txns.length > 8 && <button type="button" className="w-full border-t border-line p-2 text-sm text-accent-ink" onClick={() => setShowAll(!showAll)}>{showAll ? t('Show fewer') : t('Show all {n}', { n: txns.length })}</button>}
        </section>
      )}
      {!txns.length && <p className="text-sm text-muted">{t('No purchases found in it; the bill is saved all the same.')}</p>}
      <Button type="submit" disabled={!ok}>{t('Save statement')}</Button>
    </form>
  );
}

function Payment({ p, onSaved }: { p: Parsed; onSaved: () => void }) {
  const accountsMap = useLedger((s) => s.accounts);
  const cards = useMemo(() => creditCards(), [accountsMap]);
  const [cardId, setCardId] = useState(matchCard(cards, p)?.id ?? cards[0]?.id ?? '');
  const card = cards.find((c) => c.id === cardId);
  const cur = card?.currency ?? 'INR';
  const from = useMemo(() => liveAccounts().filter((a) => a.kind !== 'credit' && a.currency === cur), [accountsMap, cur]);
  const [fromId, setFromId] = useState(from[0]?.id ?? '');
  const [amountText, setAmountText] = useState(p.paidAmount ? toInput(p.paidAmount, cur) : '');
  const [date, setDate] = useState(p.paidOn ?? todayKey());
  const amount = parseAmount(amountText, cur);
  const bill = card ? openBill(card.id) : undefined;
  if (!cards.length) return <p className="py-6 text-center text-muted">{t('Add a credit card first.')}</p>;
  return (
    <form className="grid gap-4" onSubmit={async (e) => {
      e.preventDefault();
      if (!card || !amount) return;
      if (bill) await payBill(bill, date, amount, fromId || undefined);
      else await save(fromId ? newEntry('transfer', fromId, { to: card.id, amount, date }) : newEntry('in', card.id, { amount, date }));
      onSaved();
    }}>
      <div><Label htmlFor="i-card">{t('Card')}</Label><select id="i-card" className={SELECT} value={cardId} onChange={(e) => setCardId(e.target.value)}>{cards.map((c) => <option key={c.id} value={c.id}>{label(c)}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="i-amt">{t('Amount paid')}</Label><Input id="i-amt" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} /></div>
        <div><Label htmlFor="i-on">{t('Paid on')}</Label><Input id="i-on" type="date" max={todayKey()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></div>
      </div>
      <div><Label htmlFor="i-from">{t('Paid from')}</Label>
        <select id="i-from" className={SELECT} value={fromId} onChange={(e) => setFromId(e.target.value)}>
          {from.map((a) => <option key={a.id} value={a.id}>{label(a)}</option>)}<option value="">{t('An account not in Sanga')}</option></select></div>
      <p className="rounded-xl bg-panel-2 p-3 text-sm">{bill ? t('Marks the {month} bill of {amount} (due {date}) as paid.', { month: monthTitle(bill.month), amount: money(bill.amount, cur), date: shortDay(bill.due) }) : t('There’s no unpaid bill on this card, so this is saved as a payment to it.')}</p>
      <Button type="submit" disabled={!amount || !card}>{bill ? t('Mark as paid') : t('Save payment')}</Button>
    </form>
  );
}

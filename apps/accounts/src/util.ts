// Small helpers Accounts' screens share.
import { Banknote, CreditCard, Landmark, Wallet, type LucideIcon } from 'lucide-react';
import { locale, t, tk } from '@sanga/i18n';
import { money, parseAmount, toInput, type Account, type AccountKind, type Entry, type Network } from '@sanga/ledger';

export const KINDS: Record<AccountKind, { many: string; one: string; icon: LucideIcon }> = {
  bank: { many: tk('Bank accounts'), one: tk('Bank account'), icon: Landmark },
  credit: { many: tk('Credit cards'), one: tk('Credit card'), icon: CreditCard },
  cash: { many: tk('Cash'), one: tk('Cash'), icon: Banknote },
  wallet: { many: tk('Wallets'), one: tk('Wallet'), icon: Wallet },
};
export const KIND_ORDER: AccountKind[] = ['bank', 'credit', 'cash', 'wallet'];
export const NETWORK_NAMES: Record<Network, string> = { visa: 'Visa', mastercard: 'Mastercard', rupay: 'RuPay', amex: 'American Express', diners: 'Diners Club', discover: 'Discover', other: tk('Other') }; // i18n-ok: brand names
export const ACC_TYPES = { savings: tk('Savings'), current: tk('Current'), salary: tk('Salary'), nre: 'NRE', nro: 'NRO', other: tk('Other') } as const; // i18n-ok: NRE/NRO

export const shortDay = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
export const longDay = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export const monthTitle = (ym: string) => new Date(`${ym}-01T12:00:00`).toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
export const ordinalDay = (n: number) => new Date(2026, 0, n).toLocaleDateString(locale(), { day: 'numeric' });

/** "HDFC Millennia ••1234" */
export const label = (a: Account) => a.name + (a.last4 ? ` ••${a.last4}` : a.acc4 ? ` ••${a.acc4}` : '');

/** What an entry was, in words, when it has no description of its own. */
export function entryTitle(e: Entry, name: (id: string) => string, account?: string) {
  if (e.desc) return e.desc;
  if (e.ref?.startsWith('bill:')) return t('Card bill paid');
  if (e.cat === 'cashback') return t('Cashback');
  if (e.kind === 'adjust') return t('Balance corrected');
  if (e.kind === 'transfer') return account === e.to ? t('From {name}', { name: name(e.account) }) : t('To {name}', { name: name(e.to!) });
  return e.kind === 'in' ? t('Money in') : t('Money out');
}

export const fmt = money;
export { parseAmount, toInput };
/** "-1,234.50" → -123450; also accepts a leading minus. Null if it isn't an amount. */
export function parseSigned(text: string, cur: string): number | null {
  const s = text.trim(), neg = /^[-−]/.test(s);
  const n = parseAmount(s.replace(/^[-−+]/, ''), cur);
  return n === null ? null : neg ? -n : n;
}
export const SELECT = 'h-11 w-full min-w-0 rounded-xl border border-line bg-panel-2 px-3 text-[0.95rem] outline-none focus:border-accent';

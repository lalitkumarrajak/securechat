// Your money, kept private to your own devices: accounts (bank, credit card, cash, wallet), the debit
// cards on a bank account, and every movement of money between them. Each record is sealed on the
// device with a key only your own devices can derive and synced through the server as ciphertext.

export type AccountKind = 'bank' | 'credit' | 'cash' | 'wallet';
export type Network = 'visa' | 'mastercard' | 'rupay' | 'amex' | 'diners' | 'discover' | 'other';
export const NETWORKS: Network[] = ['visa', 'mastercard', 'rupay', 'amex', 'diners', 'discover', 'other'];

interface Synced { created: number; edited: number; srv?: number; dirty?: boolean; deleted?: boolean }

export interface Account extends Synced {
  id: string; type: 'account';
  kind: AccountKind;
  name: string;                // "HDFC Savings", "Millennia", "Cash"
  bank?: string;               // the bank or issuer
  currency: string;
  color: string;
  opening: number;             // the balance when it was added, in paise; a credit card's is negative when you owe
  notes?: string;
  archived?: boolean;
  // A bank account: never the full number.
  acc4?: string;               // last 4 digits of the account number
  ifsc?: string;
  holder?: string;
  accType?: 'savings' | 'current' | 'salary' | 'nre' | 'nro' | 'other';
  // A credit card: never the full number or the CVV.
  limit?: number;              // credit limit, in paise
  limitWith?: string;          // shares its limit with this card (cards of one bank often have one limit for all)
  last4?: string;
  network?: Network;
  expiry?: string;             // MM/YY
  nameOnCard?: string;
  statementDay?: number;       // 1–31
  dueAfter?: number;           // days from statement to due date
  remind?: number[];           // days before the due date
  time?: string;               // HH:mm, when reminders come
  pdfPass?: string;            // the statement PDF's password, once typed: so no device asks again
}

/** A debit card: it spends straight from the bank account it belongs to. */
export interface DebitCard extends Synced {
  id: string; type: 'debit';
  account: string;
  name: string;
  network?: Network;
  last4?: string;
  expiry?: string;
  nameOnCard?: string;
  notes?: string;
}

export type EntryKind = 'in' | 'out' | 'transfer' | 'adjust';
/** Money moving: into or out of an account, from one account to another, or a correction to the balance. */
export interface Entry extends Synced {
  id: string; type: 'entry';
  kind: EntryKind;
  account: string;             // in/out/adjust: the account; transfer: where it came from
  to?: string;                 // transfer: where it went
  amount: number;              // paise; positive, except an adjustment, which is the change (+/-)
  date: string;                // YYYY-MM-DD
  desc: string;
  cat?: string;                // 'cashback' for cashback
  card?: string;               // cashback paid into another account: the credit card that earned it
  via?: string;                // the debit card it was paid with
  ref?: string;                // what it records: "split:<group>:<expense>", "bill:<bill id>"
}

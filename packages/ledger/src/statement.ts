// Reading a credit card statement (a PDF's text, or an SMS from the bank) on this device: the card's
// last four digits, the statement and due dates, the total and minimum due, the credit limit, and each
// purchase, with a guess at what it was for. Nothing here touches the network; it's plain text work,
// tested on its own (statement.test.ts). Banks lay statements out differently, so every field is
// looked for in a few ways, and the person checks it all before anything is saved.
import { tk } from '@sanga/i18n';

/** A run of text on a line of the PDF, where it starts (x) and how wide it is. */
export interface Seg { x: number; w: number; s: string }
export type Line = Seg[];

export type Cat = 'food' | 'groceries' | 'shopping' | 'fuel' | 'travel' | 'bills' | 'entertainment' | 'health' | 'education' | 'emi' | 'fees' | 'cash' | 'payment' | 'refund' | 'other';
export interface Txn { date: string; desc: string; amount: number; credit: boolean; cat: Cat }
export interface Parsed {
  kind: 'statement' | 'payment' | 'unknown';
  bank?: string; last4?: string;
  statementDate?: string; dueDate?: string; from?: string; to?: string;
  total?: number; minDue?: number; limit?: number;
  paidAmount?: number; paidOn?: string;
  txns: Txn[];
}

export const CATS: Record<Cat, { label: string; emoji: string }> = {
  food: { label: tk('Food & dining'), emoji: '🍽️' },
  groceries: { label: tk('Groceries'), emoji: '🛒' },
  shopping: { label: tk('Shopping'), emoji: '🛍️' },
  fuel: { label: tk('Fuel'), emoji: '⛽' },
  travel: { label: tk('Travel & cabs'), emoji: '🚕' },
  bills: { label: tk('Bills & recharges'), emoji: '💡' },
  entertainment: { label: tk('Entertainment'), emoji: '🎬' },
  health: { label: tk('Health'), emoji: '💊' },
  education: { label: tk('Education'), emoji: '🎓' },
  emi: { label: tk('EMI & loans'), emoji: '🏦' },
  fees: { label: tk('Fees, tax & interest'), emoji: '💸' },
  cash: { label: tk('Cash withdrawal'), emoji: '🏧' },
  payment: { label: tk('Payment to card'), emoji: '✅' },
  refund: { label: tk('Refunds & cashback'), emoji: '↩️' },
  other: { label: tk('Other'), emoji: '🧾' },
};
/** Categories a purchase can be put in (payments and refunds come from what the statement says). */
export const SPEND_CATS = (Object.keys(CATS) as Cat[]).filter((c) => c !== 'payment' && c !== 'refund');

const RULES: [Cat, RegExp][] = [
  ['fees', /\b(late\s*(payment)?\s*fee|annual\s*fee|joining\s*fee|finance\s*charge|interest|[icsu]?gst|service\s*tax|surcharge|overlimit|over\s*limit|fee\b|charges?\b|markup)/i],
  ['emi', /\b(emi|loan|instal+ment|smartemi|flexipay)\b/i],
  ['cash', /\b(atm|cash\s*(withdrawal|adv))/i],
  ['food', /swiggy(?!\s*instamart)|zomato|restaura|\bcafe|caf[eé]\b|coffee|starbucks|domino|pizza|mcdonald|\bkfc\b|burger|subway|haldiram|chaayos|barbeque|dine|food|bakery|eatclub|eat\s*sure|faasos|box8|biryani|kitchen|dhaba/i],
  ['groceries', /bigbasket|big\s*basket|blinkit|grofers|zepto|instamart|dmart|d-mart|avenue\s*super|jiomart|reliance\s*(fresh|smart|retail)|more\s*(retail|super)|spencer|nature'?s\s*basket|star\s*bazaar|grocer|kirana|supermarket|hypermarket|milkbasket|country\s*delight|licious/i],
  ['fuel', /petrol|diesel|\bfuel|\bhpcl|\bbpcl|\biocl|indian\s*oil|bharat\s*petro|hindustan\s*petro|\bshell\b|nayara|filling\s*st|service\s*st|\bhp\s*pay/i],
  ['travel', /\buber|\bola\b|olacabs|rapido|irctc|makemytrip|make\s*my\s*trip|goibibo|cleartrip|yatra|ixigo|easemytrip|redbus|indigo|interglobe|air\s*india|vistara|akasa|spicejet|airline|airport|\bmetro\b|fastag|toll|railway|\boyo\b|airbnb|hotel|booking\.com|agoda|parking|blablacar|namma\s*yatri|bluesmart/i],
  ['bills', /airtel|\bjio\b|reliance\s*jio|vodafone|\bvi\b|idea\s*cellular|bsnl|mtnl|electric|bescom|msedcl|mahadiscom|tata\s*power|adani\s*(electric|power)|bses|torrent\s*power|cesc|tneb|kseb|water\s*(bill|board)|\bgas\b|indane|bharat\s*gas|hp\s*gas|mahanagar|broadband|fibernet|act\s*fibre|hathway|recharge|bill\s*pay|bbps|dth|tata\s*(sky|play)|insurance|lic\b|premium|rent\b|cred\b|nobroker|society|maintenance/i],
  ['entertainment', /netflix|spotify|hotstar|disney|prime\s*video|amazon\s*prime|youtube|sony\s*liv|sonyliv|zee5|jiocinema|bookmyshow|book\s*my\s*show|\bpvr\b|inox|cinepolis|apple\.com|itunes|google\s*play|playstation|xbox|steam|gaana|wynk|audible|kindle|dream11|district/i],
  ['health', /pharma|chemist|medical|medplus|apollo|\b1mg\b|tata\s*1mg|netmeds|pharmeasy|hospital|clinic|diagnost|\blab(s)?\b|healthcare|practo|dental|cult\.?fit|cultfit|gym|fitness|wellness/i],
  ['education', /school|college|universit|udemy|coursera|byju|unacademy|vedantu|upgrad|tuition|academy|education|books?\b|exam/i],
  ['shopping', /amazon|amzn|flipkart|myntra|ajio|meesho|nykaa|tata\s*cliq|croma|reliance\s*digital|vijay\s*sales|decathlon|ikea|pepperfry|urban\s*ladder|lifestyle|shoppers\s*stop|westside|pantaloons|\bzara\b|h\s*&\s*m|uniqlo|max\s*fashion|trends|lenskart|firstcry|boat|apple\s*store|mall|store|mart\b|retail|fashion|jewel|footwear|bata|puma|nike|adidas|electronics/i],
];

/** A guess at what a purchase was for, from its description. */
export function categorize(desc: string, credit = false): Cat {
  if (credit) return /payment|thank\s*you|received|neft|imps|upi|autopay|auto\s*debit|bbps|cred\b/i.test(desc) && !/refund|reversal|cashback|cash\s*back/i.test(desc) ? 'payment' : 'refund';
  for (const [cat, re] of RULES) if (re.test(desc)) return cat;
  return 'other';
}

// ---------- dates ----------
const MON: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');
const M = 'jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec';
// 15/03/2025, 15-03-25, 15.03.2025 · 15 Mar 2025, 15-Mar-25, 15Mar2025, 15 March, 2025 · Mar 15, 2025 · 2025-03-15
const DATE_RE = new RegExp(String.raw`(?<![\d])(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})(?!\d)|(\d{1,2})(?:st|nd|rd|th)?[\s\-/.]?(${M})[a-z]*\.?(?:[\s\-/.,']*(\d{4}|\d{2})(?!\d))?|(${M})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4}))`, 'gi');

function makeDate(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const dt = new Date(y, m - 1, d);
  return dt.getMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null;
}

/** Dates in the text, in order. Without a year, the latest one not after `ref` (a statement's dates). */
export function findDates(s: string, ref?: string): { date: string; index: number; end: number }[] {
  const out: { date: string; index: number; end: number }[] = [];
  for (const m of s.matchAll(DATE_RE)) {
    let date: string | null = null;
    if (m[1]) date = makeDate(+m[1], +m[2], +m[3]);
    else if (m[4]) date = makeDate(+m[6], +m[5], +m[4]);
    else if (m[7]) {
      const mon = MON[m[8].toLowerCase()];
      if (m[9]) date = makeDate(+m[9], mon, +m[7]);
      else {
        const r = ref ?? new Date().toISOString().slice(0, 10);
        let y = +r.slice(0, 4);
        if (mon > +r.slice(5, 7) + 1) y--; // "28 Dec" on a January statement is last year's
        date = makeDate(y, mon, +m[7]);
      }
    } else if (m[10]) date = makeDate(+m[12], MON[m[10].toLowerCase()], +m[11]);
    if (date) out.push({ date, index: m.index!, end: m.index! + m[0].length });
  }
  return out;
}

// ---------- amounts (in paise, whole numbers) ----------
// ₹1,23,456.78 · Rs. 1,234.00 · INR 1234 · 1,234.00 Cr · -1,234.00 · (1,234.00) · +1,234.00
const AMT_RE = /(\(|[-+−]\s?)?(?:(rs\.?|inr|₹)\s*)?(\(|[-+−]\s?)?(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+\.\d{1,2}|\d+)(\))?(?:\s*(cr|dr|c|d)\b)?/gi;

export interface Amount { minor: number; credit: boolean; index: number; end: number; decimals: boolean; currency: boolean }
export function findAmounts(s: string): Amount[] {
  const out: Amount[] = [];
  for (const m of s.matchAll(AMT_RE)) {
    const num = m[4];
    // Not part of a longer number, a date or a card number.
    const before = s[m.index! - 1] ?? ' ', after = s[m.index! + m[0].length] ?? ' ';
    if (/[\d/]/.test(before) || (before === ':' && /\d/.test(s[m.index! - 2] ?? '')) || /[\d/:]/.test(after) || (/[a-z]/i.test(before) && !m[2])) continue;
    if (/^[-.]/.test(after) && /\d/.test(s[m.index! + m[0].length + 1] ?? '')) continue;
    const [whole, frac = ''] = num.replace(/,/g, '').split('.');
    const minor = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
    if (!Number.isSafeInteger(minor)) continue;
    const sign = (m[1] ?? '') + (m[3] ?? '');
    const credit = /cr|^c$/i.test(m[6] ?? '') || /[-−(+]/.test(sign);
    out.push({ minor, credit, index: m.index!, end: m.index! + m[0].length, decimals: num.includes('.'), currency: !!m[2] });
  }
  return out;
}
/** An amount that reads like money, not a count or a reference: it has paise, a currency or a comma. */
const moneyLike = (a: Amount, raw: string) => a.decimals || a.currency || raw.includes(',');

// ---------- the fields, by their labels ----------
type Kind = 'date' | 'amount';
interface Field { kind: Kind; labels: RegExp[]; not?: RegExp }
const FIELDS = {
  total: { kind: 'amount', labels: [/total\s*(amount\s*|amt\.?\s*)?(payment\s*)?(dues?|payable)\b/i, /total\s*outstanding/i, /current\s*outstanding/i, /closing\s*balance/i, /new\s*balance/i, /(?:^|[^a-z])(amount|amt\.?)\s*(due|payable)\b/i, /total\s*balance/i], not: /min|past|over|last/i },
  minDue: { kind: 'amount', labels: [/min(imum|\.)?\s*(amount\s*|amt\.?\s*|payment\s*)?(due|payable)/i, /\bMAD\b/] },
  dueDate: { kind: 'date', labels: [/(payment\s*)?due\s*date/i, /pay(ment)?\s*by(\s*date)?/i, /due\s*(by|on)/i, /last\s*date\s*(of|for)\s*payment/i] },
  statementDate: { kind: 'date', labels: [/statement\s*(generation\s*)?date/i, /date\s*of\s*statement/i, /bill(ing)?\s*date/i, /statement\s*(generated\s*)?(on|dated)/i] },
  limit: { kind: 'amount', labels: [/(total\s*)?credit\s*limit/i, /card\s*limit/i], not: /avail|cash|unused/i },
} satisfies Record<string, Field>;
type Key = keyof typeof FIELDS;

const valueIn = (s: string, kind: Kind, ref?: string): string | number | undefined => {
  if (kind === 'date') return findDates(s, ref)[0]?.date;
  const a = findAmounts(s).find((x) => moneyLike(x, s.slice(x.index, x.end)));
  return a?.minor;
};

const text = (l: Line) => l.map((g) => g.s).join('  ');

function findField(lines: Line[], key: Key, ref?: string): string | number | undefined {
  const f: Field = FIELDS[key];
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    for (let si = 0; si < line.length; si++) {
      const seg = line[si];
      for (const re of f.labels) {
        const m = re.exec(seg.s);
        if (!m) continue;
        const lead = seg.s.slice(Math.max(0, m.index - 12), m.index + m[0].length);
        if (f.not?.test(lead)) continue;
        // 1. on the same run of text, after the label ("Total Amount Due: ₹12,345.00")
        const rest = seg.s.slice(m.index + m[0].length);
        const stop = rest.search(/[a-z]{4,}\s*(date|due|limit|amount)/i); // the next label on the run
        const own = valueIn(stop > 0 ? rest.slice(0, stop) : rest, f.kind, ref);
        if (own !== undefined) return own;
        // 2. the next runs on the line ("Total Dues      12,345.00")
        for (const next of line.slice(si + 1, si + 3)) {
          const v = valueIn(next.s, f.kind, ref);
          if (v !== undefined) return v;
          if (/[a-z]{4,}/i.test(next.s)) break; // another label first
        }
        // 3. below it, in the same column (a row of labels over a row of values)
        const mid = seg.x + seg.w / 2;
        for (const below of lines.slice(li + 1, li + 4)) {
          const near = below.map((g) => ({ g, d: g.x <= mid && mid <= g.x + g.w ? 0 : Math.min(Math.abs(g.x - mid), Math.abs(g.x + g.w - mid)) }))
            .filter((x) => x.d < Math.max(60, seg.w)).sort((a, b) => a.d - b.d)[0];
          if (!near) continue;
          const v = valueIn(near.g.s, f.kind, ref);
          if (v !== undefined) return v;
        }
      }
    }
  }
  return undefined;
}

const LAST4 = [
  /(?:[x*•#]{2,}[\s-]*)+(\d{4})(?!\d)/i,
  /\b\d{4}[\s-]?\d{2}[x*•#]{2}[\s-]?[x*•#]{4}[\s-]?(\d{4})\b/i,
  /\b\d{6}[x*•#]{6}(\d{4})\b/i,
  /ending\s*(?:with|in)?\s*[:\-]?\s*(\d{4})\b/i,
  /card\s*(?:no\.?|number)\s*[:\-]?\s*(\d{4})\b(?![\s-]*\d)/i,
];
const BANKS: [RegExp, string][] = [
  [/hdfc/i, 'HDFC Bank'], [/icici/i, 'ICICI Bank'], [/sbi\s*card|state\s*bank/i, 'SBI Card'], [/axis/i, 'Axis Bank'], [/kotak/i, 'Kotak'], // i18n-ok: bank names
  [/american\s*express|amex/i, 'Amex'], [/idfc/i, 'IDFC FIRST'], [/indusind/i, 'IndusInd'], [/yes\s*bank/i, 'YES Bank'], [/rbl/i, 'RBL Bank'], // i18n-ok: bank names
  [/\bau\s*(small|bank)/i, 'AU Bank'], [/hsbc/i, 'HSBC'], [/standard\s*chartered/i, 'Standard Chartered'], [/citi/i, 'Citi'], [/onecard|one\s*card/i, 'OneCard'], // i18n-ok: bank names
  [/bank\s*of\s*baroda|bobcard/i, 'BOBCARD'], [/federal/i, 'Federal Bank'], [/scapia/i, 'Scapia'], [/tata\s*neu/i, 'Tata Neu'], // i18n-ok: bank names
];

const SKIP = /opening\s*balance|previous\s*(balance|statement)|closing\s*balance|total\s*(amount|dues?|outstanding|payment|purchase|spend)|minimum|credit\s*limit|available|reward\s*points?\s*(summary|balance|earned)|statement\s*(date|period)|due\s*date|page\s*\d|^\s*(date|transaction)/i;

/** The purchases, refunds and payments: a line that starts with a date and ends with an amount. */
function findTxns(lines: Line[], ref?: string): Txn[] {
  const out: Txn[] = [];
  for (const line of lines) {
    const s = text(line).trim();
    const d = findDates(s, ref)[0];
    if (!d || d.index > 2) continue;
    let rest = s.slice(d.end);
    const second = findDates(rest, ref)[0]; // a posting date next to the transaction date
    if (second && second.index < 3) rest = rest.slice(second.end);
    const amounts = findAmounts(rest).filter((a) => a.decimals);
    if (!amounts.length) continue;
    const a = amounts[amounts.length - 1];
    // Some statements list the amount, then "Cr" in a column of its own.
    const tail = rest.slice(a.end).trim();
    let desc = rest.slice(0, amounts[0].index).replace(/\s{2,}/g, ' ').replace(/\b\d{8,}\b/g, '').replace(/[|]+/g, ' ').trim();
    desc = desc.replace(/^[-–:]+|[-–:]+$/g, '').trim();
    if (!desc || !/[a-z]{2,}/i.test(desc) || SKIP.test(desc) || a.minor === 0) continue;
    const credit = a.credit || /^cr\b/i.test(tail) || /payment\s*(received|thank)|thank\s*you|refund|reversal|cashback|cash\s*back/i.test(desc);
    out.push({ date: d.date, desc: desc.slice(0, 60), amount: a.minor, credit, cat: categorize(desc, credit) });
  }
  return out;
}

const PAYMENT = /(payment|pymt|paid).{0,60}(received|credited|successful|processed|posted)|received.{0,40}payment|thank\s*you\s*for\s*(the\s*|your\s*)?payment/i;

/** Everything that can be read from a statement's lines (or an SMS, one line each). */
export function parseStatement(lines: Line[]): Parsed {
  const all = lines.map(text).join('\n');
  const head = lines.slice(0, 120).map(text).join('\n');
  const out: Parsed = { kind: 'unknown', txns: [] };
  out.bank = BANKS.find(([re]) => re.test(head))?.[1];
  for (const re of LAST4) { const m = re.exec(all); if (m) { out.last4 = m[1]; break; } }

  // The statement's period first: dates without a year are read against it.
  const period = /(statement|billing)\s*period|(from)\s+\d/i;
  for (const l of lines) {
    const s = text(l);
    if (!period.test(s)) continue;
    const ds = findDates(s);
    if (ds.length >= 2) { out.from = ds[0].date; out.to = ds[1].date; break; }
  }
  const sd = findField(lines, 'statementDate', out.to);
  out.statementDate = (typeof sd === 'string' ? sd : undefined) ?? out.to;
  const ref = out.statementDate;
  const dd = findField(lines, 'dueDate', ref);
  if (typeof dd === 'string') {
    // A due date without a year comes after the statement, possibly in the new year.
    out.dueDate = ref && dd < ref && dd.slice(5) < ref.slice(5) ? `${+dd.slice(0, 4) + 1}${dd.slice(4)}` : dd;
  }
  const num = (k: Key) => { const v = findField(lines, k, ref); return typeof v === 'number' ? v : undefined; };
  out.total = num('total'); out.minDue = num('minDue'); out.limit = num('limit');
  if (out.minDue !== undefined && out.total !== undefined && out.minDue > out.total) out.minDue = undefined;

  if (PAYMENT.test(all) && lines.length < 12) {
    out.kind = 'payment';
    const a = findAmounts(all).find((x) => moneyLike(x, all.slice(x.index, x.end)));
    out.paidAmount = a?.minor;
    out.paidOn = findDates(all)[0]?.date;
    out.total = out.minDue = undefined;
    return out;
  }
  out.txns = findTxns(lines, ref);
  if (out.total !== undefined || out.dueDate || out.txns.length) out.kind = 'statement';
  return out;
}

/** Pasted text (an SMS, an email): each line is one run. */
export const textLines = (s: string): Line[] => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).map((x) => [{ x: 0, w: x.length * 6, s: x }]);

/** What was spent (purchases less refunds) and what was paid to the card, from a statement's lines. */
export function totals(txns: { amount: number; credit: boolean; cat: Cat }[]) {
  let spent = 0, refunds = 0, paid = 0;
  for (const x of txns) {
    if (!x.credit) spent += x.amount;
    else if (x.cat === 'payment') paid += x.amount;
    else refunds += x.amount;
  }
  return { spent, refunds, paid, net: spent - refunds };
}

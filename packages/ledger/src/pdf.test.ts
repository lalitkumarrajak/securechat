// A real statement PDF (made by e2e/fixtures/make-statements.mjs, locked like a bank's) through pdf.js and the reader.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { toLines } from './pdf';
import { parseStatement } from './statement';

async function lines(file: string, password?: string) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(path.join(import.meta.dirname, '../../../e2e/fixtures', file)));
  const task = pdfjs.getDocument({ data, password });
  const doc = await task.promise;
  const page = await doc.getPage(1);
  const c = await page.getTextContent();
  const items = c.items.flatMap((it) => ('str' in it && it.str.trim() ? [{ x: it.transform[4], y: it.transform[5], w: it.width, h: Math.abs(it.transform[3]) || 8, s: it.str }] : []));
  await task.destroy();
  return toLines(items);
}

describe('a locked statement PDF', () => {
  it('won’t open without its password', async () => {
    await expect(lines('statement-1.pdf')).rejects.toMatchObject({ name: 'PasswordException' });
  });
  it('reads the bill and every purchase', async () => {
    const p = parseStatement(await lines('statement-1.pdf', 'LAKS0101'));
    expect(p).toMatchObject({ kind: 'statement', bank: 'HDFC Bank', last4: '4321', statementDate: '2026-09-14', dueDate: '2026-10-04', from: '2026-08-15', total: 891500, minDue: 45000, limit: 20000000 });
    expect(p.txns.map((x) => [x.desc, x.cat, x.amount, x.credit])).toEqual([
      ['SWIGGY BANGALORE', 'food', 45600, false], ['AMAZON PAY INDIA PRIVATE', 'shopping', 249900, false], ['PAYMENT RECEIVED NETBANKING THANK YOU', 'payment', 500000, true],
      ['HPCL FUEL STATION PUNE', 'fuel', 150000, false], ['ZOMATO ONLINE ORDER', 'food', 61000, false], ['NETFLIX.COM', 'entertainment', 64900, false], ['BIGBASKET', 'groceries', 320100, false],
    ]);
  });
});

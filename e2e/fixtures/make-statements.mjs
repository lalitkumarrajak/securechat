// Makes the statement PDFs e2e/accounts.spec.ts imports: two months of a made-up "HDFC Bank" card
// ending 4321, locked with the same password (as banks do), so the second import shouldn't ask for it.
// Run: node e2e/fixtures/make-statements.mjs (needs Chrome and Ghostscript). The PDFs are committed.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dir = import.meta.dirname;
const PASSWORD = 'LAKS0101';
const months = [
  { name: 'statement-1', date: '14/09/2026', due: '04/10/2026', from: '15/08/2026', to: '14/09/2026', total: '8,915.00', min: '450.00',
    rows: [['16/08/2026', 'SWIGGY BANGALORE', '456.00'], ['18/08/2026', 'AMAZON PAY INDIA PRIVATE', '2,499.00'], ['20/08/2026', 'PAYMENT RECEIVED NETBANKING THANK YOU', '5,000.00 Cr'],
      ['22/08/2026', 'HPCL FUEL STATION PUNE', '1,500.00'], ['22/08/2026', 'ZOMATO ONLINE ORDER', '610.00'], ['01/09/2026', 'NETFLIX.COM', '649.00'], ['05/09/2026', 'BIGBASKET', '3,201.00']] },
  { name: 'statement-2', date: '14/10/2026', due: '03/11/2026', from: '15/09/2026', to: '14/10/2026', total: '4,120.50', min: '210.00',
    rows: [['17/09/2026', 'UBER INDIA', '320.50'], ['25/09/2026', 'APOLLO PHARMACY', '800.00'], ['02/10/2026', 'MYNTRA DESIGNS', '3,000.00']] },
];
const html = (m) => `<html><body style="font-family: Arial; font-size: 12px; padding: 24px">
  <h2>HDFC Bank Credit Card Statement</h2>
  <p>Lakshya Sharma · Card No: 4321 56XX XXXX 4321</p>
  <p>Statement Period : ${m.from} to ${m.to}</p>
  <table cellpadding="8" style="margin: 12px 0; border-collapse: collapse">
    <tr><td>Statement Date</td><td>Payment Due Date</td><td>Total Dues</td><td>Minimum Amount Due</td><td>Credit Limit</td></tr>
    <tr><td>${m.date}</td><td>${m.due}</td><td>${m.total}</td><td>${m.min}</td><td>2,00,000.00</td></tr>
  </table>
  <table cellpadding="6" style="width: 100%">
    <tr><td>Date</td><td>Transaction Description</td><td style="text-align:right">Amount (in Rs.)</td></tr>
    ${m.rows.map(([d, t, a]) => `<tr><td>${d}</td><td>${t}</td><td style="text-align:right">${a}</td></tr>`).join('')}
  </table></body></html>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
for (const m of months) {
  await page.setContent(html(m));
  const plain = path.join(dir, `${m.name}-plain.pdf`);
  await page.pdf({ path: plain, format: 'A4' });
  execFileSync('gs', ['-q', '-sDEVICE=pdfwrite', `-sOwnerPassword=${PASSWORD}x`, `-sUserPassword=${PASSWORD}`, '-dEncryptionR=3', '-dKeyLength=128', '-o', path.join(dir, `${m.name}.pdf`), plain]);
  fs.rmSync(plain);
}
await browser.close();

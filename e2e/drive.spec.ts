// Drive: folders, uploads, previews, the Trash, and the same files opening on another device.
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openApp, phone, signIn, signUp, testPng, uname } from './helpers';

const shots = process.env.DRIVE_SHOTS; // a folder to save screenshots in, to look at the pages

/** A small one-page PDF with a line of text. */
function makePdf(text: string) {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    '', // the page's text, below
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = `BT /F1 36 Tf 72 720 Td (${text}) Tj ET`;
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = '%PDF-1.4\n';
  const at: number[] = [];
  objs.forEach((o, i) => { at.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${at.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

test('Drive: make a folder, upload, preview, trash and restore, then open on another device', async ({ browser }) => {
  const a = await phone(browser, uname('drv'));
  await signUp(a);
  await openApp(a, 'Drive');
  const page = a.page;
  await expect(page.getByRole('heading', { name: 'Your files, in one place' })).toBeVisible();

  // A folder, and into it.
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New folder' }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Trip');
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: /^Trip/ }).click();
  await expect(page.getByRole('heading', { name: 'This folder is empty' })).toBeVisible();

  // Three files at once: a photo, a PDF and a CSV.
  const locked = fs.readFileSync(path.join(import.meta.dirname, 'fixtures', 'statement-1.pdf'));
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([
    { name: 'beach.png', mimeType: 'image/png', buffer: testPng(800, 600) },
    { name: 'tickets.pdf', mimeType: 'application/pdf', buffer: makePdf('Train tickets: Pune to Goa') },
    { name: 'statement.pdf', mimeType: 'application/pdf', buffer: locked },
    { name: 'budget.csv', mimeType: 'text/csv', buffer: Buffer.from('Item,Cost\n"Hotel, 2 nights",4500\nTrain,1200\n') },
  ]);
  await expect(page.getByText('4 uploads complete')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Uploads' })).toBeHidden({ timeout: 15_000 }); // folds away by itself
  for (const n of ['beach.png', 'tickets.pdf', 'statement.pdf', 'budget.csv']) await expect(page.getByRole('button', { name: n, exact: true })).toBeVisible();
  // Pictures made on the device for the photo and the PDF.
  await expect(page.getByRole('button', { name: 'beach.png', exact: true }).locator('img')).toBeVisible();
  await expect(page.getByRole('button', { name: 'tickets.pdf', exact: true }).locator('img')).toBeVisible();
  if (shots) await page.screenshot({ path: path.join(shots, 'grid.png') });

  // The photo opens full screen; the next file is the PDF, drawn page by page; then the CSV as a table.
  await page.getByRole('button', { name: 'beach.png', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'beach.png' });
  await expect(viewer.getByRole('img', { name: 'beach.png' })).toBeVisible();
  if (shots) await page.screenshot({ path: path.join(shots, 'photo.png') });
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'budget.csv' })).toBeVisible(); // sorted by name: beach, budget, statement, tickets
  await expect(page.getByRole('cell', { name: 'Hotel, 2 nights' })).toBeVisible();
  if (shots) await page.screenshot({ path: path.join(shots, 'csv.png') });
  // A locked PDF asks for its password.
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('This PDF is locked')).toBeVisible();
  await page.getByLabel('PDF password').fill('wrong');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByText('That password didn’t open it.')).toBeVisible();
  await page.getByLabel('PDF password').fill('LAKS0101');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'tickets.pdf' })).toBeVisible();
  await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
  await page.waitForTimeout(800);
  if (shots) await page.screenshot({ path: path.join(shots, 'pdf.png') });
  await page.keyboard.press('Escape');

  // Star one, find it under Starred.
  await page.getByRole('button', { name: 'More for budget.csv' }).click();
  await page.getByRole('menuitem', { name: 'Add to Starred' }).click();
  await page.getByRole('button', { name: 'Starred', exact: true }).click();
  await expect(page.getByRole('button', { name: 'budget.csv', exact: true })).toBeVisible();

  // To the Trash, undone; to the Trash again, and back with Restore.
  await page.getByRole('button', { name: 'My Drive', exact: true }).first().click();
  await page.getByRole('button', { name: /^Trip/ }).click();
  await page.getByRole('button', { name: 'More for tickets.pdf' }).click();
  await page.getByRole('menuitem', { name: 'Move to Trash' }).click();
  await expect(page.getByRole('button', { name: 'tickets.pdf', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'tickets.pdf', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'More for beach.png' }).click();
  await page.getByRole('menuitem', { name: 'Move to Trash' }).click();
  await page.getByRole('button', { name: 'Trash', exact: true }).click();
  await page.getByRole('button', { name: 'More for beach.png' }).click();
  await page.getByRole('menuitem', { name: 'Restore' }).click();
  await expect(page.getByRole('heading', { name: 'The Trash is empty' })).toBeVisible();
  if (shots) {
    await page.getByRole('button', { name: 'My Drive', exact: true }).first().click();
    await page.getByRole('button', { name: /^Trip/ }).click();
    await page.getByRole('button', { name: 'List view' }).click();
    await page.screenshot({ path: path.join(shots, 'list.png') });
  }

  if (shots) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole('button', { name: 'Grid view' }).click();
    await page.screenshot({ path: path.join(shots, 'desktop.png') });
  }

  // Another device: the same folder and files, and the photo opens there too.
  const b = await phone(browser, a.u);
  await signIn(b);
  await openApp(b, 'Drive');
  await b.page.getByRole('button', { name: /^Trip/ }).click();
  await b.page.getByRole('button', { name: 'beach.png', exact: true }).click();
  await expect(b.page.getByRole('dialog', { name: 'beach.png' }).getByRole('img', { name: 'beach.png' })).toBeVisible({ timeout: 20_000 });

  expect(a.errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  expect(b.errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  await a.ctx.close(); await b.ctx.close();
});

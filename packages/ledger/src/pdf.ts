// A statement PDF's text, read on this device with pdf.js (downloaded only when a statement is opened),
// as lines of positioned runs: enough for statement.ts to tell a row of labels from a row of values.
import type { Line, Seg } from './statement';

/** The PDF is locked. `wrong`: a password was tried and didn't open it. */
export class NeedPassword extends Error { constructor(readonly wrong: boolean) { super('password'); } }

interface Item { x: number; y: number; w: number; h: number; s: string }

export async function readPdf(data: ArrayBuffer, password?: string): Promise<Line[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  // pdf.js takes the bytes over, so each try gets its own copy (the next password needs them).
  const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)), password });
  let doc;
  try { doc = await task.promise; }
  catch (e) { void task.destroy(); if ((e as { name?: string })?.name === 'PasswordException') throw new NeedPassword(!!password); throw e; }
  const lines: Line[] = [];
  try {
    for (let p = 1; p <= Math.min(doc.numPages, 40); p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items: Item[] = [];
      for (const it of content.items) {
        if (!('str' in it) || !it.str.trim()) continue;
        items.push({ x: it.transform[4], y: it.transform[5], w: it.width, h: Math.abs(it.transform[3]) || it.height || 8, s: it.str });
      }
      lines.push(...toLines(items));
      page.cleanup();
    }
  } finally { void task.destroy(); }
  return lines;
}

/** Text items as lines, top to bottom; on a line, items close together become one run. */
export function toLines(items: Item[]): Line[] {
  const rows: { y: number; h: number; items: Item[] }[] = [];
  for (const it of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((r) => Math.abs(r.y - it.y) <= Math.max(2, Math.min(r.h, it.h) * 0.45));
    if (row) row.items.push(it); else rows.push({ y: it.y, h: it.h, items: [it] });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => {
    const segs: Seg[] = [];
    for (const it of r.items.sort((a, b) => a.x - b.x)) {
      const last = segs[segs.length - 1];
      const gap = last ? it.x - (last.x + last.w) : Infinity;
      if (last && gap < it.h * 0.6) { last.s += (gap > it.h * 0.1 && !last.s.endsWith(' ') ? ' ' : '') + it.s; last.w = it.x + it.w - last.x; }
      else segs.push({ x: it.x, w: it.w, s: it.s });
    }
    return segs.map((g) => ({ ...g, s: g.s.replace(/\s+/g, ' ').trim() })).filter((g) => g.s);
  });
}

/** Open a PDF with the first of these passwords that works (none, then each saved one). */
export async function readWithSaved(data: ArrayBuffer, saved: string[]): Promise<{ lines: Line[]; password?: string }> {
  try { return { lines: await readPdf(data) }; } catch (e) { if (!(e instanceof NeedPassword)) throw e; }
  for (const pw of [...new Set(saved)].filter(Boolean)) {
    try { return { lines: await readPdf(data, pw), password: pw }; } catch (e) { if (!(e instanceof NeedPassword)) throw e; }
  }
  throw new NeedPassword(false);
}

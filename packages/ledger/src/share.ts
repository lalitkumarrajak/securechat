// What was shared to Sanga from another app (Share → Sanga on a statement PDF or a bank SMS). The
// service worker keeps it in a cache of its own for the moment it takes Sanga to open; it's read
// once and deleted straight away, so a statement never lingers there.
const CACHE = 'sanga-share';

export async function takeShared(): Promise<{ file?: File; text?: string } | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const c = await caches.open(CACHE);
    const meta = await c.match('/share/meta');
    if (!meta) return null;
    const m = (await meta.json()) as { name?: string; type?: string; text?: string };
    const f = await c.match('/share/file');
    const file = f ? new File([await f.blob()], m.name || 'statement.pdf', { type: m.type || 'application/pdf' }) : undefined;
    return { file, text: m.text || undefined };
  } catch { return null; } finally { void caches.delete(CACHE).catch(() => {}); }
}

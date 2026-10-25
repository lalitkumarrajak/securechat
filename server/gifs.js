// GIF and sticker search via KLIPY (https://docs.klipy.com). Searches go through this server so the
// API key stays private; the images themselves load straight from KLIPY's CDN, as their terms require
// (partners may not cache KLIPY media). Disabled unless KLIPY_API_KEY is set.
import { sendJson, rateLimited, sha256 } from './http.js';
import { config } from './config.js';

const KINDS = { gifs: 'gifs', stickers: 'stickers' };
export const KLIPY_MEDIA = 'https://static.klipy.com/';

// One result in the small shape the app needs: a thumbnail for the picker and a size to send.
function item(r) {
  const f = r.file || {};
  const pick = (size) => f[size]?.webp || f[size]?.gif;
  const thumb = pick('sm') || pick('xs') || pick('md');
  const full = pick('md') || pick('sm') || pick('hd');
  if (!thumb?.url || !full?.url || !full.url.startsWith(KLIPY_MEDIA) || !thumb.url.startsWith(KLIPY_MEDIA)) return null;
  return { id: String(r.id ?? r.slug ?? full.url), thumb: thumb.url, src: full.url, w: full.width | 0, h: full.height | 0, title: String(r.title || '').slice(0, 80) };
}

export const routes = {
  // ?kind=gifs|stickers&q=search (empty: trending)&page=1
  'GET /api/gifs': async (req, res, me, token, url) => {
    if (!config.klipyKey) return sendJson(res, 404, { error: 'GIFs aren’t set up on this server' });
    if (rateLimited('gif:' + me, 60, 60e3)) return sendJson(res, 429, { error: 'Slow down' });
    const kind = KINDS[url.searchParams.get('kind')] || 'gifs';
    const q = String(url.searchParams.get('q') || '').trim().slice(0, 50);
    const page = Math.min(50, Math.max(1, Number(url.searchParams.get('page')) || 1));
    const params = new URLSearchParams({
      page: String(page), per_page: '24',
      customer_id: sha256('chattrix:' + me).slice(0, 24), // stable per user, not their username
      content_filter: 'medium',
      ...(q && { q }),
    });
    const endpoint = `${config.klipyBase}/api/v1/${encodeURIComponent(config.klipyKey)}/${kind}/${q ? 'search' : 'trending'}?${params}`;
    try {
      const r = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('KLIPY ' + r.status);
      const body = await r.json();
      const list = (body?.data?.data || []).map(item).filter(Boolean);
      sendJson(res, 200, { items: list, next: body?.data?.has_next ? page + 1 : null });
    } catch (err) {
      console.error('gif search failed', err.message);
      sendJson(res, 502, { error: 'GIF search is unavailable right now' });
    }
  },
};

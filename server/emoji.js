// Google's Noto animated emoji (Lottie JSON, ~4 KB compressed each), fetched once and cached here
// so clients only ever talk to this server: no third-party requests, and the CSP stays 'self'.
import { clientIp, compress, rateLimited, sendBody, sendJson, sha256, SECURITY_HEADERS } from './http.js';

export const EMOJI_RE = /^\/emoji\/([0-9a-f]{2,6}(?:_[0-9a-f]{2,6}){0,9})\.json$/;
const cache = new Map(); // codepoints -> Promise<{ body, gz, br, etag } | null>

function load(cp) {
  let p = cache.get(cp);
  if (!p) {
    p = fetch(`https://fonts.gstatic.com/s/e/notoemoji/latest/${cp}/lottie.json`, { signal: AbortSignal.timeout(8000) })
      .then(async (r) => {
        if (r.status === 404) return null; // no animated version of this emoji
        if (!r.ok) throw new Error('upstream ' + r.status);
        const body = Buffer.from(await r.arrayBuffer());
        JSON.parse(body); // only cache real animations
        return { body, ...compress(body), etag: '"' + sha256(body).slice(0, 16) + '"' };
      });
    p.catch(() => cache.delete(cp)); // retry transient failures next time
    cache.set(cp, p);
    if (cache.size > 1000) cache.delete(cache.keys().next().value);
  }
  return p;
}

export async function serveEmoji(req, res, cp) {
  if (rateLimited('emoji:' + clientIp(req), 300, 60e3)) return sendJson(res, 429, { error: 'Slow down' });
  let anim;
  try { anim = await load(cp); } catch { return sendJson(res, 502, { error: 'emoji unavailable' }); }
  if (!anim) {
    res.writeHead(404, { ...SECURITY_HEADERS, 'Cache-Control': 'public, max-age=86400' });
    return res.end();
  }
  sendBody(req, res, { ...anim, type: 'application/json', cache: 'public, max-age=31536000, immutable' });
}

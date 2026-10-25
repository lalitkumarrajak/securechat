// Link previews: title, description and image of a page, fetched when you're about to send a link.
// The sender's app embeds the preview inside the encrypted message, so the recipient's phone never
// contacts the site. Guarded against being used to reach private networks (SSRF).
import dns from 'node:dns/promises';
import net from 'node:net';
import { rateLimited, sendJson } from './http.js';

const MAX_HTML = 512 * 1024;
const MAX_IMAGE = 400 * 1024;
const TIMEOUT = 5000;

// Loopback, private, link-local, carrier-grade NAT, multicast and other non-public ranges.
function isPrivate(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivate(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') ||
    v.startsWith('fea') || v.startsWith('feb') || v.startsWith('ff');
}

const ALLOW_PRIVATE = process.env.PREVIEW_ALLOW_PRIVATE === '1'; // tests only: lets them use a local page

async function assertPublic(url) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('blocked');
  if (ALLOW_PRIVATE) return;
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('blocked');
  if (url.username || url.password) throw new Error('blocked');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivate(a.address))) throw new Error('blocked');
}

// Fetch with every redirect checked, a time limit and a size limit.
async function safeFetch(start, accept, maxBytes) {
  let url = new URL(start);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { Accept: accept, 'User-Agent': 'Mozilla/5.0 (compatible; ChattrixLinkPreview/1.0)', 'Accept-Language': 'en' },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location'), url);
      continue;
    }
    if (!res.ok) throw new Error('status ' + res.status);
    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > maxBytes) break;
      chunks.push(chunk);
    }
    return { url, type: res.headers.get('content-type') || '', body: Buffer.concat(chunks), complete: size <= maxBytes };
  }
  throw new Error('too many redirects');
}

const decode = (s) => s.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|#39);/gi, (m, e) => {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }[e.toLowerCase()];
  if (named) return named;
  const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
  return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
});

// Reads <meta property="og:…">, <meta name="twitter:…">, <title>, <link rel="icon">.
export function parseMeta(html) {
  const head = html.slice(0, 200_000);
  const meta = {};
  for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const content = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(tag);
    if (key && content && !(key in meta)) meta[key] = decode((content[1] ?? content[2]).trim());
  }
  const title = meta['og:title'] || meta['twitter:title'] || decode(/<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1]?.trim() || '');
  return {
    title: title.replace(/\s+/g, ' ').slice(0, 200),
    desc: (meta['og:description'] || meta['twitter:description'] || meta.description || '').replace(/\s+/g, ' ').slice(0, 300),
    site: (meta['og:site_name'] || '').slice(0, 80),
    image: meta['og:image:secure_url'] || meta['og:image'] || meta['twitter:image'] || meta['twitter:image:src'] || '',
  };
}

const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif)\b/;

export const routes = {
  'GET /api/preview': async (req, res, me, token, url) => {
    if (rateLimited('preview:' + me, 30, 60e3)) return sendJson(res, 429, { error: 'Slow down' });
    let target;
    try { target = new URL(String(url.searchParams.get('url') || '')); } catch { return sendJson(res, 400, { error: 'Invalid link' }); }
    try {
      const page = await safeFetch(target, 'text/html,application/xhtml+xml', MAX_HTML);
      if (!/html/i.test(page.type)) return sendJson(res, 404, { error: 'No preview' });
      const m = parseMeta(page.body.toString('utf8'));
      if (!m.title && !m.desc) return sendJson(res, 404, { error: 'No preview' });
      let image = '';
      if (m.image) {
        try {
          const img = await safeFetch(new URL(m.image, page.url), 'image/*', MAX_IMAGE);
          if (img.complete && IMAGE_TYPES.test(img.type)) image = `data:${img.type.split(';')[0]};base64,${img.body.toString('base64')}`;
        } catch { /* preview without image */ }
      }
      sendJson(res, 200, { url: page.url.href, title: m.title, desc: m.desc, site: m.site || page.url.hostname.replace(/^www\./, ''), image });
    } catch (err) {
      sendJson(res, 404, { error: err.message === 'blocked' ? 'That link can’t be previewed' : 'No preview' });
    }
  },
};

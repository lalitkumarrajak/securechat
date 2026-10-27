// Link previews: title, description and image of a page, fetched when you're about to send a link.
// The sender's app embeds the preview inside the encrypted message, so the recipient's phone never
// contacts the site. Guarded against being used to reach private networks (SSRF).
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import zlib from 'node:zlib';
import { rateLimited, sendJson } from './http.js';

const MAX_HTML = 512 * 1024;
const MAX_IMAGE = 400 * 1024;
const TIMEOUT = 5000;

// Everything that isn't the public internet. IPv6 is allowed only inside global unicast (2000::/3),
// which also rules out every form that embeds an IPv4 address outside it: IPv4-mapped ::ffff:0:0/96,
// IPv4-compatible ::/96, NAT64 64:ff9b::/96 and 64:ff9b:1::/48, plus ULA, link-local, multicast, ::1 and ::.
// Inside 2000::/3, 6to4 and Teredo also carry an IPv4 address (one we can't vet), so they're out too.
// Separate lists: BlockList also matches IPv4 addresses against IPv6 rules (as ::ffff:a.b.c.d).
const BLOCKED_V4 = new net.BlockList();
const BLOCKED_V6 = new net.BlockList();
for (const [a, p] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3], // multicast, reserved and broadcast
]) BLOCKED_V4.addSubnet(a, p, 'ipv4');
for (const [a, p] of [
  ['::', 3], ['4000::', 2], ['8000::', 1], // all but 2000::/3
  ['2001::', 23], // IETF protocol assignments: Teredo 2001::/32, benchmarking, ORCHID
  ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20], // documentation, 6to4, documentation
]) BLOCKED_V6.addSubnet(a, p, 'ipv6');

export function isPrivate(ip) {
  const type = net.isIP(ip);
  // A zone id (fe80::1%eth0) makes BlockList answer false, so refuse it outright.
  if (!type || ip.includes('%')) return true;
  return type === 4 ? BLOCKED_V4.check(ip, 'ipv4') : BLOCKED_V6.check(ip, 'ipv6');
}

const ALLOW_PRIVATE = process.env.PREVIEW_ALLOW_PRIVATE === '1'; // tests only: lets them use a local page

// DNS lookup for the connection itself, so the address we vet is the address we connect to:
// resolving once to check and again to connect would let a rebinding DNS server swap in 127.0.0.1.
export function publicLookup(host, opts, cb) {
  if (typeof opts === 'function') [cb, opts] = [opts, {}];
  dns.lookup(host, { all: true, family: opts.family || 0 }, (err, addrs) => {
    if (err) return cb(err);
    if (!addrs.length || addrs.some((a) => isPrivate(a.address))) return cb(new Error('blocked'));
    if (opts.all) cb(null, addrs); else cb(null, addrs[0].address, addrs[0].family);
  });
}

function assertPublic(url) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('blocked');
  if (ALLOW_PRIVATE) return;
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('blocked');
  if (url.username || url.password) throw new Error('blocked');
  // Names are vetted by publicLookup as they're connected to; literal addresses never reach it.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isPrivate(host)) throw new Error('blocked');
}

function get(url, accept, signal) {
  return new Promise((resolve, reject) => {
    const req = (url.protocol === 'https:' ? https : http).request(url, {
      lookup: ALLOW_PRIVATE ? undefined : publicLookup,
      agent: false, // no pooled sockets: each connection goes through publicLookup
      signal,
      headers: { Accept: accept, 'Accept-Encoding': 'gzip, deflate, br', 'User-Agent': 'Mozilla/5.0 (compatible; SangaLinkPreview/1.0)', 'Accept-Language': 'en' },
    }, resolve);
    req.on('error', reject);
    req.end();
  });
}

const DECODERS = { gzip: zlib.createGunzip, 'x-gzip': zlib.createGunzip, deflate: zlib.createInflate, br: zlib.createBrotliDecompress };

// Fetch with every redirect checked, a time limit and a size limit.
async function safeFetch(start, accept, maxBytes) {
  let url = new URL(start);
  for (let hop = 0; hop < 4; hop++) {
    assertPublic(url);
    const res = await get(url, accept, AbortSignal.timeout(TIMEOUT));
    try {
      const status = res.statusCode;
      if (status >= 300 && status < 400 && res.headers.location) {
        url = new URL(res.headers.location, url);
        continue;
      }
      if (status < 200 || status >= 300) throw new Error('status ' + status);
      const decoder = DECODERS[String(res.headers['content-encoding'] || '').trim().toLowerCase()];
      const body = decoder ? res.pipe(decoder()) : res;
      const chunks = [];
      let size = 0;
      try {
        for await (const chunk of body) {
          size += chunk.length;
          if (size > maxBytes) break;
          chunks.push(chunk);
        }
      } finally { body.destroy(); }
      return { url, type: res.headers['content-type'] || '', body: Buffer.concat(chunks), complete: size <= maxBytes };
    } finally { res.destroy(); }
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

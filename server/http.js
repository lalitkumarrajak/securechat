// HTTP plumbing: security headers, JSON/body helpers, rate limiting, static files.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { config } from './config.js';

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export const SECURITY_HEADERS = {
  // Scripts are strictly same-origin. Styles allow inline because the UI libraries (Radix, Sonner)
  // inject small <style> tags; worker-src blob: is for the animated-emoji player.
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; " +
    "manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  ...(config.tlsCert || config.trustProxy ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
};

export function clientIp(req) {
  if (config.trustProxy) {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return String(fwd).split(',')[0].trim();
  }
  return req.socket.remoteAddress || '';
}

// Fixed-window rate limiter.
const buckets = new Map();
export function rateLimited(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) buckets.set(key, (b = { n: 0, reset: now + windowMs }));
  return ++b.n > max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
}, 60e3).unref();

export function sendJson(res, code, obj) {
  res.writeHead(code, { ...SECURITY_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

export function sendBody(req, res, { body, gz, br, type, etag, cache }) {
  const headers = { ...SECURITY_HEADERS, 'Content-Type': type, 'Cache-Control': cache, Vary: 'Accept-Encoding' };
  if (etag) {
    headers.ETag = etag;
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
  }
  const ae = String(req.headers['accept-encoding'] || '');
  if (br && /\bbr\b/.test(ae)) { body = br; headers['Content-Encoding'] = 'br'; }
  else if (gz && /\bgzip\b/.test(ae)) { body = gz; headers['Content-Encoding'] = 'gzip'; }
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

export function readJson(req, limit = 8192) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}

export function compress(raw) {
  return {
    gz: zlib.gzipSync(raw, { level: 9 }),
    br: zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }),
  };
}

// ---------- static files (the built web app, pre-compressed in memory) ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};
const staticFiles = new Map();

export function loadStatic(dir = config.webDir) {
  staticFiles.clear();
  if (!fs.existsSync(dir)) {
    console.warn(`web app not built (${dir} missing): run "npm run build"`);
    return;
  }
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) { walk(full); continue; }
      const raw = fs.readFileSync(full);
      const rel = '/' + path.relative(dir, full).split(path.sep).join('/');
      const type = MIME[path.extname(ent.name)] || 'application/octet-stream';
      const compressible = /text|json|svg|javascript|manifest/.test(type);
      staticFiles.set(rel, {
        body: raw, ...(compressible ? compress(raw) : {}), type,
        etag: '"' + sha256(raw).slice(0, 16) + '"',
        // Vite puts content-hashed files in /assets, so they never change.
        cache: rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      });
    }
  };
  walk(dir);
}

export function serveStatic(req, res, pathname) {
  const file = staticFiles.get(pathname === '/' ? '/index.html' : pathname);
  if (!file) return sendJson(res, 404, { error: 'not found' });
  sendBody(req, res, file);
}

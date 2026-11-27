// Cloudflare R2 (or any S3-compatible store), for Drive's sealed file pieces: put, get and delete one
// object, signed with AWS Signature Version 4. No SDK: these three calls are all Drive needs.
//
//   R2_ACCOUNT_ID         the Cloudflare account id (the endpoint is https://<id>.r2.cloudflarestorage.com)
//   R2_ACCESS_KEY_ID      an R2 API token's access key id
//   R2_SECRET_ACCESS_KEY  and its secret
//   R2_BUCKET             the bucket's name
//   R2_ENDPOINT           instead of R2_ACCOUNT_ID: another S3-compatible endpoint (tests use a fake one)
import crypto from 'node:crypto';

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const hmac = (k, s) => crypto.createHmac('sha256', k).update(s).digest();
// RFC 3986, each path segment on its own (S3 doesn't encode twice).
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/** The headers that sign one request (SigV4): x-amz-date, x-amz-content-sha256 and Authorization. */
export function sign({ method, url, headers = {}, body, accessKey, secret, region = 'auto', service = 's3', now = new Date() }) {
  const u = new URL(url);
  const date = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); // 20130524T000000Z
  const day = date.slice(0, 8);
  const payload = sha256(body ?? '');
  const all = { ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()])),
    host: u.host, 'x-amz-content-sha256': payload, 'x-amz-date': date };
  const names = Object.keys(all).sort();
  const query = [...u.searchParams].map(([k, v]) => `${enc(k)}=${enc(v)}`).sort().join('&');
  const path = u.pathname.split('/').map((p) => enc(decodeURIComponent(p))).join('/');
  const canonical = [method, path, query, names.map((n) => `${n}:${all[n]}\n`).join(''), names.join(';'), payload].join('\n');
  const scope = `${day}/${region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', date, scope, sha256(canonical)].join('\n');
  const key = hmac(hmac(hmac(hmac('AWS4' + secret, day), region), service), 'aws4_request');
  const signature = crypto.createHmac('sha256', key).update(toSign).digest('hex');
  return {
    'x-amz-date': date, 'x-amz-content-sha256': payload,
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`,
  };
}

/** The store set up in the environment, or null (Drive then keeps its pieces in the database). */
export function r2FromEnv(env = process.env) {
  const accessKey = env.R2_ACCESS_KEY_ID?.trim(), secret = env.R2_SECRET_ACCESS_KEY?.trim(), bucket = env.R2_BUCKET?.trim();
  const endpoint = env.R2_ENDPOINT?.trim() || (env.R2_ACCOUNT_ID?.trim() && `https://${env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`);
  if (!accessKey || !secret || !bucket || !endpoint) return null;
  const base = endpoint.replace(/\/+$/, '') + '/' + enc(bucket) + '/';

  async function call(method, key, body) {
    const url = base + key.split('/').map(enc).join('/');
    const headers = sign({ method, url, body, accessKey, secret });
    const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(60_000) });
    if (method === 'GET' && res.status === 404) return null;
    if (method === 'DELETE' && res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`R2 ${method} ${res.status}: ${text.slice(0, 200)}`);
    }
    return method === 'GET' ? Buffer.from(await res.arrayBuffer()) : null;
  }
  return {
    endpoint, bucket,
    put: (key, buf) => call('PUT', key, buf),
    get: (key) => call('GET', key),
    del: (key) => call('DELETE', key),
  };
}

// Settings from the environment. Timeouts are configurable so tests can shorten them.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const num = (v, d) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);

export const config = {
  root: ROOT,
  port: num(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',
  dataDir: process.env.DATA_DIR || path.join(ROOT, 'data'),
  webDir: process.env.WEB_DIR || path.join(ROOT, 'web', 'dist'),
  mongoUri: process.env.MONGODB_URI,
  databaseUrl: process.env.DATABASE_URL,
  retentionDays: num(process.env.RETENTION_DAYS, 30),
  sessionMs: 30 * 864e5,
  tlsCert: process.env.TLS_CERT,
  tlsKey: process.env.TLS_KEY,
  trustProxy: process.env.TRUST_PROXY === '1',
  // Open sign-up: friend requests decide who can talk to whom. ALLOW_SIGNUP=0 closes it.
  allowSignup: process.env.ALLOW_SIGNUP !== '0',
  signupsPerHour: num(process.env.SIGNUPS_PER_HOUR, 10), // per IP
  deleteWindowMs: num(process.env.DELETE_WINDOW_MS, 5 * 60e3), // "delete for everyone" limit
  presenceTimeoutMs: num(process.env.PRESENCE_TIMEOUT_MS, 45e3), // no heartbeat for this long = offline
  presenceSweepMs: num(process.env.PRESENCE_SWEEP_MS, 10e3),
  publicUrl: process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '',
  klipyKey: process.env.KLIPY_API_KEY || '',
  klipyBase: process.env.KLIPY_BASE_URL || 'https://api.klipy.com', // overridable for tests
  vapid: { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY },
};

export const USER_RE = /^[a-z0-9_.]{3,24}$/;
export const CID_RE = /^[A-Za-z0-9_-]{8,40}$/;
export const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
// Max ciphertext length (chars) per message: a 5 MB file, base64'd inside the JSON and again after encryption.
export const MAX_BODY = 10_000_000;

// Email: 6-digit codes that prove someone owns an address, at sign-up and when adding an email in
// Settings. Sent through Brevo's web API (Render's free plan blocks the SMTP ports). The codes are kept
// in memory only, as a hash, for 10 minutes and 5 tries; a restart just means asking for a new one.
// Without BREVO_API_KEY (development) the code is printed in the server log instead.
import crypto from 'node:crypto';
import { config } from './config.js';
import { sha256 } from './http.js';

const CODE_MS = 10 * 60e3;
const MAX_TRIES = 5;
const codes = new Map(); // `${purpose}|${email}` -> { hash, expires, tries, u }

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;
/** Lowercased and trimmed; '' if it isn't a string. */
export const normEmail = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');
export const validEmail = (e) => e.length <= 254 && EMAIL_RE.test(e);

if (config.brevoKey.startsWith('xsmtpsib-')) {
  console.warn('BREVO_API_KEY is an SMTP key (xsmtpsib-…). Emails need an API key (xkeysib-…): Brevo → SMTP & API → API Keys.');
}
if (config.brevoKey && !config.mailFrom) console.warn('MAIL_FROM is not set: Brevo needs the sender address you confirmed there.');

/** On start: does Brevo take the key, and is MAIL_FROM one of its confirmed senders? One line in the log either way. */
export async function checkMailSetup() {
  if (!config.brevoKey) return;
  const get = (p) => fetch(config.brevoBase + p, { headers: { 'api-key': config.brevoKey, Accept: 'application/json' }, signal: AbortSignal.timeout(15e3) });
  try {
    const acc = await get('/v3/account');
    if (!acc.ok) {
      return console.error(`EMAIL NOT WORKING: Brevo refused BREVO_API_KEY (${acc.status}: ${(await acc.text()).slice(0, 200)}). ` +
        'Use an API key (xkeysib-…) from Brevo → SMTP & API → API Keys, with no quotes or spaces.');
    }
    const senders = (await (await get('/v3/senders')).json().catch(() => ({}))).senders || [];
    const me = senders.find((s) => s.email?.toLowerCase() === config.mailFrom.toLowerCase());
    if (!me) {
      return console.error(`EMAIL NOT WORKING: MAIL_FROM "${config.mailFrom}" isn't a sender in Brevo (senders there: ${senders.map((s) => s.email).join(', ') || 'none'}). ` +
        'Add it in Brevo → Senders, Domains & Dedicated IPs → Senders, or set MAIL_FROM to one of those.');
    }
    if (me.active === false) return console.error(`EMAIL NOT WORKING: the sender ${config.mailFrom} isn't confirmed yet in Brevo: open the link Brevo emailed to it.`);
    console.info(`Email: Brevo works, sending from ${config.mailFrom}`);
  } catch (err) { console.error('Email: couldn’t reach Brevo to check the setup:', err.message); }
}

// Each email's words in English, Hindi and Marathi.
const TEXT = {
  register: {
    en: ['Your Sanga sign-up code', 'Use this code to finish creating your Sanga account:'],
    hi: ['आपका Sanga साइन-अप कोड', 'अपना Sanga अकाउंट बनाने के लिए यह कोड डालें:'],
    mr: ['तुमचा Sanga साइन-अप कोड', 'तुमचे Sanga अकाउंट तयार करण्यासाठी हा कोड टाका:'],
  },
  add: {
    en: ['Confirm your email for Sanga', 'Use this code to add this email to your Sanga account:'],
    hi: ['Sanga के लिए अपना ईमेल पक्का करें', 'यह ईमेल अपने Sanga अकाउंट में जोड़ने के लिए यह कोड डालें:'],
    mr: ['Sanga साठी तुमचा ईमेल निश्चित करा', 'हा ईमेल तुमच्या Sanga अकाउंटला जोडण्यासाठी हा कोड टाका:'],
  },
};
const FOOT = {
  en: 'It works for 10 minutes. If you didn’t ask for it, ignore this email.',
  hi: 'यह 10 मिनट तक काम करेगा। अगर आपने यह नहीं माँगा, तो इस ईमेल को अनदेखा करें।',
  mr: 'हा 10 मिनिटे चालेल. तुम्ही हा मागितला नसेल, तर या ईमेलकडे दुर्लक्ष करा.',
};

async function sendMail(to, subject, text, html) {
  if (!config.brevoKey) { console.info(`[mail] to ${to}: ${subject}\n${text}`); return; }
  const res = await fetch(config.brevoBase + '/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': config.brevoKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: { name: 'Sanga', email: config.mailFrom }, to: [{ email: to }], subject, textContent: text, htmlContent: html }),
    signal: AbortSignal.timeout(15e3),
  });
  if (!res.ok) throw new Error(`brevo ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
}

/** Make a code for this email and send it. `u`: the account it's for (the new username, or the signed-in user). */
export async function sendCode(purpose, email, u, lang) {
  const l = ['hi', 'mr'].includes(lang) ? lang : 'en';
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
  const key = purpose + '|' + email;
  codes.set(key, { hash: sha256(code), expires: Date.now() + CODE_MS, tries: 0, u });
  const [subject, intro] = TEXT[purpose][l];
  const text = `${intro}\n\n${code}\n\n${FOOT[l]}`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:24px;color:#222">
<h2 style="margin:0 0 12px">Sanga</h2><p>${intro}</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:20px 0">${code}</p>
<p style="color:#666;font-size:13px">${FOOT[l]}</p></div>`;
  try { await sendMail(email, subject, text, html); }
  catch (err) { codes.delete(key); throw err; }
}

/** 'ok' (and the code is used up), 'wrong' or 'expired' (none, too old, too many tries, or for another account). */
export function checkCode(purpose, email, u, code) {
  const key = purpose + '|' + email;
  const c = codes.get(key);
  if (!c || c.expires < Date.now() || c.u !== u) return 'expired';
  const given = typeof code === 'string' ? code.replace(/\s/g, '') : '';
  const ok = /^\d{6}$/.test(given) && crypto.timingSafeEqual(Buffer.from(sha256(given)), Buffer.from(c.hash));
  if (ok) { codes.delete(key); return 'ok'; }
  if (++c.tries >= MAX_TRIES) codes.delete(key);
  return 'wrong';
}

setInterval(() => {
  const now = Date.now();
  for (const [k, c] of codes) if (c.expires < now) codes.delete(k);
}, 60e3).unref();

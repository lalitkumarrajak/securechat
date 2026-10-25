// End-to-end encryption, all in the browser via WebCrypto.
//
//  password ──PBKDF2(600k)──▶ master ──HKDF──▶ authKey  (sent to server, which scrypt-hashes it)
//                                     └─HKDF──▶ wrapKey  (never leaves the device; encrypts the private key backup)
//
//  Each user has a P-256 identity key pair. A conversation key is
//  HKDF(ECDH(myPriv, theirPub)) and every message is AES-256-GCM with a random IV,
//  authenticated together with sender, recipient and message id.
const te = new TextEncoder();
const td = new TextDecoder();
const subtle = crypto.subtle;
const PBKDF2_ITERATIONS = 600_000;
const EC = { name: 'ECDH', namedCurve: 'P-256' };

export function b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function randomId(bytes = 16) {
  return b64(crypto.getRandomValues(new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function deriveFromPassword(username, password) {
  const base = await subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveBits']);
  const master = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: te.encode('securechat/v1/' + username), iterations: PBKDF2_ITERATIONS },
    base, 256);
  const hk = await subtle.importKey('raw', master, 'HKDF', false, ['deriveBits', 'deriveKey']);
  const salt = new Uint8Array(32);
  const auth = await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: te.encode('auth') }, hk, 256);
  const wrapKey = await subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: te.encode('wrap') }, hk,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return { auth: b64(auth), wrapKey };
}

async function seal(key, bytes, aad) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(aad) }, key, bytes));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return b64(out);
}

async function open(key, b64data, aad) {
  const data = unb64(b64data);
  return subtle.decrypt({ name: 'AES-GCM', iv: data.subarray(0, 12), additionalData: te.encode(aad) }, key, data.subarray(12));
}

// New identity. The private key is exported once to make the encrypted backup, then
// re-imported as non-extractable so page scripts can use it but never read it out.
export async function generateIdentity(wrapKey) {
  const kp = await subtle.generateKey(EC, true, ['deriveBits']);
  const pub = b64(await subtle.exportKey('raw', kp.publicKey));
  const jwk = await subtle.exportKey('jwk', kp.privateKey);
  const encPriv = await seal(wrapKey, te.encode(JSON.stringify(jwk)), 'identity');
  const priv = await subtle.importKey('jwk', jwk, EC, false, ['deriveBits']);
  return { pub, encPriv, priv };
}

// Password change: decrypt the key backup with the old password's key and re-encrypt it
// with the new one. The identity key itself doesn't change, so all chats stay readable.
export async function rewrapIdentity(encPriv, oldWrapKey, newWrapKey) {
  return seal(newWrapKey, new Uint8Array(await open(oldWrapKey, encPriv, 'identity')), 'identity');
}

export async function unwrapIdentity(encPriv, wrapKey) {
  const jwk = JSON.parse(td.decode(await open(wrapKey, encPriv, 'identity')));
  return subtle.importKey('jwk', jwk, EC, false, ['deriveBits']);
}

export async function conversationKey(myPriv, theirPubB64, me, them) {
  const theirPub = await subtle.importKey('raw', unb64(theirPubB64), EC, false, []);
  const shared = await subtle.deriveBits({ name: 'ECDH', public: theirPub }, myPriv, 256);
  const hk = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: te.encode('securechat/msg/' + [me, them].sort().join('|')) },
    hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

const msgAad = (from, to, cid) => `${from}>${to}|${cid}`;

export const encryptMessage = (key, obj, from, to, cid) =>
  seal(key, te.encode(JSON.stringify(obj)), msgAad(from, to, cid));

export async function decryptMessage(key, body, from, to, cid) {
  return JSON.parse(td.decode(await open(key, body, msgAad(from, to, cid))));
}

// 60-digit security code, identical on both sides, like WhatsApp's "Verify security code".
export async function safetyNumber(userA, pubA, userB, pubB) {
  const parts = [[userA, pubA], [userB, pubB]].sort((x, y) => (x[0] < y[0] ? -1 : 1));
  const digest = new Uint8Array(await subtle.digest('SHA-512', te.encode(parts.flat().join('|'))));
  const groups = [];
  for (let i = 0; i < 12; i++) {
    let n = 0;
    for (let j = 0; j < 5; j++) n = (n * 256 + digest[i * 5 + j]) % 100000;
    groups.push(String(n).padStart(5, '0'));
  }
  return groups;
}

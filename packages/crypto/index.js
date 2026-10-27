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

// Notes and diary: a key only this account's own devices can derive (ECDH of the identity key
// with itself), so the server keeps them but can't read them. Each note is sealed together with
// its owner and id, so the server can't pass one off as another.
async function selfKey(myPriv, myPubB64, purpose) {
  const pub = await subtle.importKey('raw', unb64(myPubB64), EC, false, []);
  const shared = await subtle.deriveBits({ name: 'ECDH', public: pub }, myPriv, 256);
  const hk = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: te.encode('securechat/' + purpose) },
    hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export const notesKey = (myPriv, myPubB64) => selfKey(myPriv, myPubB64, 'notes');
export const encryptNote = (key, obj, u, id) => seal(key, te.encode(JSON.stringify(obj)), `note|${u}|${id}`);
export async function decryptNote(key, body, u, id) {
  return JSON.parse(td.decode(await open(key, body, `note|${u}|${id}`)));
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

// Groups: every member encrypts with their own random group key (a "sender key"), handed to the
// other members pairwise. A group message body is the key's id (16 base64 characters) followed
// by the AES-GCM ciphertext, authenticated with sender, group, message id and key id.
export const groupKeyId = () => b64(crypto.getRandomValues(new Uint8Array(12)));
export const importGroupKey = (rawB64) => subtle.importKey('raw', unb64(rawB64), 'AES-GCM', false, ['encrypt', 'decrypt']);
export function newGroupKey() {
  return { kid: groupKeyId(), raw: b64(crypto.getRandomValues(new Uint8Array(32))) };
}
const groupAad = (from, to, cid, kid) => `${from}>${to}|${cid}|${kid}`;
export async function encryptGroup(key, kid, obj, from, to, cid) {
  return kid + await seal(key, te.encode(JSON.stringify(obj)), groupAad(from, to, cid, kid));
}
export const bodyKeyId = (body) => body.slice(0, 16);
export async function decryptGroup(key, body, from, to, cid) {
  const kid = body.slice(0, 16);
  return JSON.parse(td.decode(await open(key, body.slice(16), groupAad(from, to, cid, kid))));
}

// Stories: each is sealed with its own random key, which is then wrapped for every friend allowed to
// see it (with that pair's conversation key) and for the owner's own devices (with a key only they
// can derive). Comments are sealed with the story's key. Everything is bound to the story's owner and id.
export const storySelfKey = (myPriv, myPubB64) => selfKey(myPriv, myPubB64, 'stories');
export function newStoryKey() {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return { raw, key: subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']) };
}
export const wrapStoryKey = (wrapKey, raw, owner, id, viewer) => seal(wrapKey, raw, `skey|${owner}|${id}|${viewer}`);
export async function unwrapStoryKey(wrapKey, wrapped, owner, id, viewer) {
  const raw = await open(wrapKey, wrapped, `skey|${owner}|${id}|${viewer}`);
  return subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export const encryptStory = (key, obj, owner, id) => seal(key, te.encode(JSON.stringify(obj)), `story|${owner}|${id}`);
export async function decryptStory(key, body, owner, id) {
  return JSON.parse(td.decode(await open(key, body, `story|${owner}|${id}`)));
}
export const encryptComment = (key, obj, id, author, cid) => seal(key, te.encode(JSON.stringify(obj)), `scmt|${id}|${author}|${cid}`);
export async function decryptComment(key, body, id, author, cid) {
  return JSON.parse(td.decode(await open(key, body, `scmt|${id}|${author}|${cid}`)));
}

// Story comments, v2: sealed with the commenter and owner's conversation key (the owner's own
// comments with their story self key), not the story key every viewer holds, so the server can't
// hand one viewer's comment to another who could open it. Bound to the owner, story, author and id.
const commentAad = (owner, id, author, cid) => `scmt|${owner}|${id}|${author}|${cid}`;
export const encryptStoryComment = (pairKey, obj, owner, id, author, cid) =>
  seal(pairKey, te.encode(JSON.stringify(obj)), commentAad(owner, id, author, cid));
export async function decryptStoryComment(pairKey, body, owner, id, author, cid) {
  return JSON.parse(td.decode(await open(pairKey, body, commentAad(owner, id, author, cid))));
}

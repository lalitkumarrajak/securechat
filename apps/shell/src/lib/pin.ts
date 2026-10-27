// App lock PINs are never stored, only a slow salted hash (PBKDF2), so the saved value can't
// simply be read back. A PIN has few combinations, so the real protection is the attempt limit.
export interface PinHash { salt: string; hash: string; iter: number; len: number }

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const PIN_RE = /^\d{4,6}$/;

async function derive(pin: string, salt: Uint8Array, iter: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as Uint8Array<ArrayBuffer>, iterations: iter }, key, 256);
}

export async function hashPin(pin: string, iter = 200_000): Promise<PinHash> {
  if (!PIN_RE.test(pin)) throw new Error('PIN must be 4 to 6 digits');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64(salt), hash: b64(await derive(pin, salt, iter)), iter, len: pin.length };
}

export async function checkPin(pin: string, h: PinHash) {
  if (!PIN_RE.test(pin)) return false;
  const got = new Uint8Array(await derive(pin, unb64(h.salt), h.iter));
  const want = unb64(h.hash);
  let diff = got.length ^ want.length;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

// IndexedDB on the device: decrypted messages, chats, contacts' pinned keys, photos, outbox.
// Chats open instantly and work offline; the server only keeps ciphertext.
import type { Chat, Msg } from './types';

const DB_NAME = 'chattrix';
const DB_VERSION = 1;
let dbPromise: Promise<IDBDatabase> | undefined;

function openDb() {
  return (dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore('kv');
      const msgs = d.createObjectStore('msgs', { keyPath: 'k' });
      msgs.createIndex('peer_ts', ['peer', 'ts']);
      msgs.createIndex('id', 'id');
      d.createObjectStore('outbox', { keyPath: 'cid' });
      d.createObjectStore('chats', { keyPath: 'peer' });
      d.createObjectStore('peers', { keyPath: 'u' });   // { u, pub, newPub?, changed? }: pinned keys
      d.createObjectStore('avatars', { keyPath: 'u' }); // { u, ver, blob }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

const wrap = <T>(req: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function store(name: string, mode: IDBTransactionMode = 'readonly') {
  return (await openDb()).transaction(name, mode).objectStore(name);
}

export const get = async <T = any>(name: string, key: IDBValidKey) => wrap<T | undefined>((await store(name)).get(key));
export const put = async (name: string, value: unknown, key?: IDBValidKey) => wrap((await store(name, 'readwrite')).put(value, key));
export const del = async (name: string, key: IDBValidKey) => wrap((await store(name, 'readwrite')).delete(key));
export const all = async <T = any>(name: string) => wrap<T[]>((await store(name)).getAll());
export const msgById = async (id: number) => wrap<Msg | undefined>((await store('msgs')).index('id').get(id));

export const getMsg = (k: string) => get<Msg>('msgs', k);
export const putMsg = (m: Msg) => put('msgs', m);
export const getChat = (peer: string) => get<Chat>('chats', peer);
export const putChat = (c: Chat) => put('chats', c);

/** Newest `limit` messages of a chat, oldest first. */
export async function recentMessages(peer: string, limit = 500): Promise<Msg[]> {
  const idx = (await store('msgs')).index('peer_ts');
  const range = IDBKeyRange.bound([peer, -Infinity], [peer, Infinity]);
  return new Promise((resolve, reject) => {
    const out: Msg[] = [];
    const req = idx.openCursor(range, 'prev');
    req.onsuccess = () => {
      const cur = req.result;
      if (cur && out.length < limit) { out.push(cur.value); cur.continue(); }
      else resolve(out.reverse());
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearAll() {
  const d = await openDb();
  const names = [...d.objectStoreNames];
  const tx = d.transaction(names, 'readwrite');
  for (const n of names) tx.objectStore(n).clear();
  return new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
}

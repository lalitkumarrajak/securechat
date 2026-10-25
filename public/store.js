// Tiny IndexedDB wrapper. Messages live on the device so chats open instantly and work offline.
const DB_NAME = 'securechat';
const DB_VERSION = 2;
let dbPromise;

function openDb() {
  return (dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = req.result;
      if (e.oldVersion < 1) {
        d.createObjectStore('kv');
        const msgs = d.createObjectStore('msgs', { keyPath: 'k' });
        msgs.createIndex('peer_ts', ['peer', 'ts']);
        msgs.createIndex('id', 'id');
        d.createObjectStore('outbox', { keyPath: 'cid' });
        d.createObjectStore('chats', { keyPath: 'peer' });
        d.createObjectStore('peers', { keyPath: 'u' });
      }
      if (e.oldVersion < 2) d.createObjectStore('avatars', { keyPath: 'u' }); // profile photos: { u, ver, blob }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

const wrap = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function store(name, mode = 'readonly') {
  return (await openDb()).transaction(name, mode).objectStore(name);
}

export const get = async (name, key) => wrap((await store(name)).get(key));
export const put = async (name, value, key) => wrap((await store(name, 'readwrite')).put(value, key));
export const del = async (name, key) => wrap((await store(name, 'readwrite')).delete(key));
export const all = async (name) => wrap((await store(name)).getAll());
export const getByIndex = async (name, index, key) => wrap((await store(name)).index(index).get(key));

// Newest `limit` messages of a chat, returned oldest-first.
export async function recentMessages(peer, limit = 300) {
  const idx = (await store('msgs')).index('peer_ts');
  const range = IDBKeyRange.bound([peer, -Infinity], [peer, Infinity]);
  return new Promise((resolve, reject) => {
    const out = [];
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
  return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
}

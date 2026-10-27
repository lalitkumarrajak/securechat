// What a separate app (micro-frontend) may touch through the SDK: only its own storage keys and
// live messages, never the shell's sign-in token, group keys or message handlers.
import { describe, expect, it } from 'vitest';
import { APP_FRAMES, assertAppFrame, scopedStore, storeKeyAllowed } from '@sanga/sdk';

describe('the SDK boundary', () => {
  it('lets apps use only their own storage keys', () => {
    for (const k of ['note/abc', 'notesSince', 'app/split/expenses', 'app/x/y/z']) expect(storeKeyAllowed(k)).toBe(true);
    for (const k of ['session', 'me', 'friends', 'gk/AAAA', 'gsend/x', 'story/x', 'lastSeq', 'notes', 'app/', 'app/x', 'note']) expect(storeKeyAllowed(k)).toBe(false);
  });

  it('refuses the shell’s keys and wide prefixes through the scoped store', async () => {
    const data = new Map<string, unknown>([['session', { token: 'secret' }], ['note/1', { id: '1' }]]);
    const store = scopedStore({
      get: async (k) => data.get(k) as any,
      put: async (k, v) => { data.set(k, v); },
      del: async (k) => { data.delete(k); },
      prefix: async (p) => [...data].filter(([k]) => k.startsWith(p)).map(([, v]) => v) as any,
    });
    await expect(store.get('session')).rejects.toThrow();
    await expect(store.put('session', 'x')).rejects.toThrow();
    await expect(store.del('gk/AAAA')).rejects.toThrow();
    await expect(store.prefix('')).rejects.toThrow();
    await expect(store.prefix('n')).rejects.toThrow(); // would reach past note/ into other keys
    expect(await store.get('note/1')).toEqual({ id: '1' });
    expect(await store.prefix('note/')).toEqual([{ id: '1' }]);
    expect(data.get('session')).toEqual({ token: 'secret' });
  });

  it('lets apps listen only to their own live messages', () => {
    expect(() => assertAppFrame('notes')).not.toThrow();
    for (const t of ['m', 'call', 'cans', 'story', 'g', 'ok', 'fr']) expect(() => assertAppFrame(t)).toThrow();
    expect(APP_FRAMES).toEqual(['notes']);
  });
});

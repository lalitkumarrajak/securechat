// Stories: a photo or a few words for your friends, gone after 24 hours. Friends can like them,
// comment (only you see the comments) and you can tag friends in them.
// Each story is sealed with its own key (crypto.encryptStory), wrapped for every friend it's shared
// with, so only they can open it; the server just stores and hands out the ciphertext.
// Opened stories are kept on this device until they expire, so they show instantly the second time.
import { create } from 'zustand';
import { toast } from 'sonner';
import * as C from '@sanga/crypto';
import * as db from './db';
import { api, frameHooks, ownIdentity, peerKey, peerKeyChanged, readyHooks } from './engine';
import { getApp } from '../state/app';
import { displayName } from './types';

export interface StoryMeta {
  id: string; u: string; ts: number; exp: number; key: string; seen: boolean; liked: boolean;
  views?: number; likes?: number; // my own stories
}
export type StoryContent = ({ type: 'img'; src: string; w: number; h: number; text: string } | { type: 'text'; text: string; bg: number })
  & { tags?: string[]; via?: string };
export interface StoryComment { id: string; u: string; text: string; ts: number }
export interface StoryActivity { views?: { u: string; ts: number; liked: boolean }[]; comments: StoryComment[] }

export const MAX_TEXT = 500;
export const MAX_CAPTION = 300;
/** Backgrounds for text stories. */
export const BACKGROUNDS = [
  'linear-gradient(135deg,#0f766e,#14b8a6)', 'linear-gradient(135deg,#7c3aed,#db2777)', 'linear-gradient(135deg,#f97316,#facc15)',
  'linear-gradient(135deg,#1d4ed8,#06b6d4)', 'linear-gradient(135deg,#be123c,#f43f5e)', 'linear-gradient(135deg,#334155,#0f172a)',
  'linear-gradient(135deg,#15803d,#84cc16)', 'linear-gradient(135deg,#a16207,#78350f)',
];

interface Viewer { owners: string[]; oi: number; si: number }
interface StoriesState {
  list: StoryMeta[];          // oldest first
  loaded: boolean;
  content: Record<string, StoryContent | 'err'>;
  viewer: Viewer | null;      // the full-screen viewer
  composer: { prefill?: StoryContent } | null;
  activity: number;           // bumped when likes or comments change, so open lists refetch
}
export const useStories = create<StoriesState>(() => ({ list: [], loaded: false, content: {}, viewer: null, composer: null, activity: 0 }));

// ---------- grouping, for the strip and the viewer ----------
export interface Ring { u: string; stories: StoryMeta[]; unseen: number; last: number }
/** Mine first, then friends with something new (newest first), then the ones already seen. */
export function rings(list: StoryMeta[], me: string): Ring[] {
  const by = new Map<string, StoryMeta[]>();
  for (const s of list) by.set(s.u, [...(by.get(s.u) || []), s]);
  const out = [...by].map(([u, stories]) => ({ u, stories, unseen: stories.filter((s) => !s.seen).length, last: stories[stories.length - 1].ts }));
  return out.sort((a, b) => Number(b.u === me) - Number(a.u === me) || Number(b.unseen > 0) - Number(a.unseen > 0) || b.last - a.last);
}

/** Open the viewer at someone's stories (their first unseen one); swiping on goes to the next person. */
export function openStories(u: string) {
  const me = ownIdentity().me;
  const list = useStories.getState().list;
  // My own stories play on their own; a friend's go on to the next friend's.
  const owners = u === me ? [me] : rings(list, me).map((r) => r.u).filter((o) => o !== me);
  const oi = owners.indexOf(u);
  if (oi < 0) return;
  const theirs = list.filter((s) => s.u === u);
  useStories.setState({ viewer: { owners, oi, si: Math.max(0, theirs.findIndex((s) => !s.seen)) } });
}
export const closeStories = () => useStories.setState({ viewer: null });
export const openComposer = (prefill?: StoryContent) => useStories.setState({ composer: { prefill } });

// ---------- loading ----------
let refreshing: Promise<void> | null = null;
let again = false;
export function refreshStories(): Promise<void> {
  if (refreshing) { again = true; return refreshing; }
  refreshing = (async () => {
    const { stories } = await api<{ stories: StoryMeta[] }>('/api/stories');
    useStories.setState((s) => ({ list: stories, loaded: true, content: Object.fromEntries(Object.entries(s.content).filter(([id]) => stories.some((x) => x.id === id))) }));
    // Forget stories that are gone (expired or deleted) from this device too.
    const keep = new Set(stories.map((s) => s.id));
    for (const k of await db.kvKeys('story/')) if (!keep.has(k.slice(6))) await db.del('kv', k);
  })().catch(() => { /* offline: keep what we have */ }).finally(() => {
    refreshing = null;
    if (again) { again = false; void refreshStories(); }
  });
  return refreshing;
}

const keys = new Map<string, Promise<CryptoKey>>();
function storyKey(s: StoryMeta) {
  if (!keys.has(s.id)) {
    const { me, priv, pub } = ownIdentity();
    const p = (s.u === me ? C.storySelfKey(priv!, pub) : peerKey(s.u)).then((wrap) => C.unwrapStoryKey(wrap, s.key, s.u, s.id, me));
    p.catch(() => keys.delete(s.id));
    keys.set(s.id, p);
  }
  return keys.get(s.id)!;
}

const loading = new Map<string, Promise<void>>();
/** Fetch and open a story (once; later from this device). */
export function loadStory(s: StoryMeta): Promise<void> {
  if (useStories.getState().content[s.id]) return Promise.resolve();
  if (!loading.has(s.id)) {
    loading.set(s.id, (async () => {
      let c: StoryContent | null = (await db.get('kv', 'story/' + s.id)) || null;
      if (!c) {
        try {
          const { body } = await api<{ body: string }>('/api/stories/body?id=' + encodeURIComponent(s.id));
          c = valid(await C.decryptStory(await storyKey(s), body, s.u, s.id));
        } catch (e) {
          if ((e as Error).message.startsWith('No connection')) throw e;
          c = null;
        }
        if (c) await db.put('kv', c, 'story/' + s.id);
      }
      useStories.setState((st) => ({ content: { ...st.content, [s.id]: c || 'err' } }));
    })().finally(() => loading.delete(s.id)));
  }
  return loading.get(s.id)!;
}

const PHOTO_SRC = /^data:image\/(webp|jpeg|png);base64,/;
const USER = /^[a-z0-9_.]{3,24}$/;
// What a friend's app sent: check it so a bad story can't break the viewer.
function valid(o: any): StoryContent | null {
  if (!o || typeof o !== 'object') return null;
  const tags = Array.isArray(o.tags) ? o.tags.filter((t: unknown) => typeof t === 'string' && USER.test(t)).slice(0, 20) : [];
  const extra = { ...(tags.length && { tags }), ...(typeof o.via === 'string' && USER.test(o.via) && { via: o.via }) };
  if (o.type === 'img' && typeof o.src === 'string' && o.src.length < 3_000_000 && PHOTO_SRC.test(o.src)) {
    return { type: 'img', src: o.src, w: o.w | 0, h: o.h | 0, text: typeof o.text === 'string' ? o.text.slice(0, MAX_CAPTION) : '', ...extra };
  }
  if (o.type === 'text' && typeof o.text === 'string' && o.text.trim()) {
    return { type: 'text', text: o.text.slice(0, MAX_TEXT), bg: Number.isInteger(o.bg) && o.bg >= 0 && o.bg < BACKGROUNDS.length ? o.bg : 0, ...extra };
  }
  return null;
}

// ---------- posting ----------
/** Share a story with these friends (all of them by default). Tagged friends must be among them. */
export async function postStory(content: StoryContent, audience: string[]) {
  const { me, priv, pub } = ownIdentity();
  const id = C.randomId(18);
  const k = C.newStoryKey();
  const body = await C.encryptStory(await k.key, content, me, id);
  const wrapped = [{ u: me, key: await C.wrapStoryKey(await C.storySelfKey(priv!, pub), k.raw, me, id, me) }];
  for (const u of audience) {
    if (await peerKeyChanged(u)) continue; // their security code changed: not until it's verified
    try { wrapped.push({ u, key: await C.wrapStoryKey(await peerKey(u), k.raw, me, id, u) }); } catch { /* no key for them */ }
  }
  await api('/api/stories', { id, body, keys: wrapped, tags: (content.tags || []).filter((t) => audience.includes(t)) });
  await db.put('kv', content, 'story/' + id);
  useStories.setState((s) => ({ content: { ...s.content, [id]: content } }));
  await refreshStories();
}

export async function deleteStory(id: string) {
  await api('/api/stories/delete', { id });
  useStories.setState((s) => ({ list: s.list.filter((x) => x.id !== id) }));
  await db.del('kv', 'story/' + id);
  void refreshStories();
}

// ---------- reacting ----------
const viewed = new Set<string>();
export function markSeen(s: StoryMeta) {
  if (s.seen || viewed.has(s.id) || s.u === ownIdentity().me) return;
  viewed.add(s.id);
  api('/api/stories/view', { id: s.id }).then(() => setMeta(s.id, { seen: true })).catch(() => viewed.delete(s.id));
}

export async function likeStory(s: StoryMeta, on: boolean) {
  setMeta(s.id, { liked: on });
  try { await api('/api/stories/like', { id: s.id, on }); }
  catch (e) { setMeta(s.id, { liked: !on }); throw e; }
}

export async function commentOn(s: StoryMeta, text: string) {
  const { me } = ownIdentity();
  const cid = C.randomId(18);
  const body = await C.encryptComment(await storyKey(s), { text: text.slice(0, 1000) }, s.id, me, cid);
  await api('/api/stories/comment', { id: s.id, cid, body });
}

export const deleteComment = (s: StoryMeta, cid: string) => api('/api/stories/comment/delete', { id: s.id, cid });

/** Who viewed and liked (my stories) and the comments I may see, opened. */
export async function storyActivity(s: StoryMeta): Promise<StoryActivity> {
  const r = await api<{ views?: StoryActivity['views']; comments: { id: string; u: string; b: string; ts: number }[] }>('/api/stories/activity?id=' + encodeURIComponent(s.id));
  const key = await storyKey(s);
  const comments: StoryComment[] = [];
  for (const c of r.comments) {
    try {
      const o = await C.decryptComment(key, c.b, s.id, c.u, c.id);
      if (typeof o?.text === 'string') comments.push({ id: c.id, u: c.u, text: o.text.slice(0, 1000), ts: c.ts });
    } catch { /* not readable: skip it */ }
  }
  return { ...(r.views && { views: r.views }), comments };
}

function setMeta(id: string, patch: Partial<StoryMeta>) {
  useStories.setState((s) => ({ list: s.list.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
}

// ---------- live updates ----------
const who = (u: string) => displayName(getApp().friends[u], u);
let timer = 0;
frameHooks.story = (m: { u: string; tag?: string; gone?: string; act?: string; like?: string; cmt?: string }) => {
  if (m.act) useStories.setState((s) => ({ activity: s.activity + 1 }));
  clearTimeout(timer);
  timer = window.setTimeout(() => void refreshStories(), 250);
  if (m.tag) toast(`${who(m.u)} tagged you in their story`, { action: { label: 'View', onClick: () => refreshStories().then(() => openStories(m.u)) } });
  if (m.cmt) toast(`${who(m.cmt)} commented on your story`, { action: { label: 'View', onClick: () => openStories(m.u) } });
  if (m.like) toast(`❤️ ${who(m.like)} liked your story`);
};
readyHooks.push(() => void refreshStories());

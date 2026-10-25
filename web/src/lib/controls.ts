// Rules for reactions, edits, pins and deletes. Pure functions, so they're unit-tested.
import type { Msg, Pin } from './types';

export const EDIT_WINDOW_MS = 15 * 60e3;
export const DELETE_WINDOW_MS = 5 * 60e3; // must match the server's limit
export const MAX_PINS = 3;
// The UI stops offering "delete for everyone" a little early, so a click just before the limit
// doesn't fail on the server because of clock skew or a slow network.
const DELETE_MARGIN_MS = 10e3;

export const senderOf = (m: Pick<Msg, 'k'>) => m.k.slice(0, m.k.indexOf('/'));

const isContent = (m: Msg) => m.type === 'text' || m.type === 'img' || m.type === 'voice';

/** Apply an edit if it comes from the original sender, in time, and is newer than the last edit. */
export function applyEdit(target: Msg, from: string, ts: number, text: string): Msg | null {
  if (target.type !== 'text' || senderOf(target) !== from) return null;
  if (ts - target.ts > EDIT_WINDOW_MS || ts < target.ts) return null;
  if (target.edited && target.edited >= ts) return null;
  if (typeof text !== 'string' || !text.trim()) return null;
  return { ...target, text: text.slice(0, 8000), edited: ts };
}

/** One reaction per person; an empty emoji removes it. */
export function applyReact(target: Msg, from: string, emoji: string): Msg | null {
  if (!isContent(target)) return null;
  const reacts = { ...(target.reacts || {}) };
  if (emoji) reacts[from] = emoji.slice(0, 16); else delete reacts[from];
  return { ...target, reacts };
}

/** Pins are shared by both people; newest first, at most MAX_PINS (the oldest drops off). */
export function applyPin(pins: Pin[], k: string, on: boolean, ts: number): Pin[] {
  const existing = pins.find((p) => p.k === k);
  if (existing && existing.ts > ts) return pins; // a newer pin/unpin already applied
  const rest = pins.filter((p) => p.k !== k);
  return (on ? [{ k, ts }, ...rest] : rest).sort((a, b) => b.ts - a.ts).slice(0, MAX_PINS);
}

export function canEdit(m: Msg, now = Date.now()) {
  return m.out && m.type === 'text' && m.id != null && now - m.ts < EDIT_WINDOW_MS - DELETE_MARGIN_MS;
}

/** "Delete for everyone" only if every selected message is mine, sent, and recent enough. */
export function canDeleteForEveryone(msgs: Msg[], now = Date.now()) {
  return msgs.length > 0 && msgs.every((m) =>
    m.out && m.id != null && m.type !== 'deleted' && now - m.ts < DELETE_WINDOW_MS - DELETE_MARGIN_MS);
}

/** Summary of reactions for chips under a bubble: [[emoji, count, mine]]. */
export function reactionSummary(reacts: Record<string, string> | undefined, me: string) {
  const counts = new Map<string, { n: number; mine: boolean }>();
  for (const [u, e] of Object.entries(reacts || {})) {
    const c = counts.get(e) || { n: 0, mine: false };
    c.n++;
    if (u === me) c.mine = true;
    counts.set(e, c);
  }
  return [...counts].map(([e, c]) => ({ e, n: c.n, mine: c.mine }));
}

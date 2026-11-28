// Game coins: play money for games. Everyone starts with START coins. Joining a game with an entry
// fee pays it into the pot; the pot goes to the winners when the game ends (games.js), and emoji
// sent in a game cost a little. Coins can't be bought or turned into anything else.
//
// Server → client: coins {n, d?, why?} — the balance now, and what just changed it.
import { ctx } from './context.js';
import { sendTo } from './hub.js';

export const START = 50_000;
export const EMOJI_COST = 10;
export const BETS = [0, 100, 500, 1000, 5000, 10_000]; // entry fees a game can have

const cache = new Map(); // username -> balance
const locks = new Map(); // username -> the last change still being made, so changes don't interleave

async function load(u) {
  if (!cache.has(u)) {
    const row = await ctx.db.get('getCoins', u);
    if (!cache.has(u)) cache.set(u, row ? Number(row.balance) : START);
  }
  return cache.get(u);
}

/** Run fn(balance) → new balance (or null: no change) with nothing else changing this person's coins meanwhile. */
function change(u, fn) {
  const run = (locks.get(u) || Promise.resolve()).then(async () => {
    const before = await load(u);
    const after = fn(before);
    if (after === null || after === before) return null;
    cache.set(u, after);
    await ctx.db.run('setCoins', u, after, Date.now());
    return after;
  });
  const tail = run.catch(() => {});
  locks.set(u, tail);
  tail.then(() => { if (locks.get(u) === tail) locks.delete(u); });
  return run;
}

export const balance = (u) => load(u);

/** Takes n coins if they have them. Returns whether it did. */
export async function spend(u, n, why) {
  if (n <= 0) return true;
  const after = await change(u, (b) => (b >= n ? b - n : null));
  if (after === null) return false;
  sendTo(u, { t: 'coins', n: after, d: -n, why });
  return true;
}

export async function give(u, n, why) {
  if (n <= 0) return;
  const after = await change(u, (b) => b + n);
  sendTo(u, { t: 'coins', n: after, d: n, why });
}

export async function tell(u) {
  sendTo(u, { t: 'coins', n: await load(u) });
}

/** What each place wins from a pot: two players, the winner takes it all; more, 1st 70% and 2nd 30%. */
export function prizes(pot, seats) {
  if (pot <= 0) return [];
  if (seats <= 2) return [pot];
  const first = Math.round(pot * 0.7);
  return [first, pot - first];
}

/** Only emoji (one or more, nothing else): what costs EMOJI_COST in game chat. */
export const isEmojiOnly = (x) => /^[\p{Extended_Pictographic}\p{Emoji_Modifier}️‍\s]+$/u.test(x) && /\p{Extended_Pictographic}/u.test(x);

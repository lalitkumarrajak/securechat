// Games between friends (Ludo, and more later: see shared/games/). The server runs every game:
// it rolls the dice, checks each move and keeps time, so nobody can cheat. Unlike messages, game
// moves and game chat are not end-to-end encrypted; they're kept only while the game lasts.
//
// Anyone with a game's link can join it while it's in the lobby, friends or not ("open" games).
//
// Client → server: gnew {type, to, ref} · gjoin · gdecline · gstart · gleave · gact {a} · gsay {x} · glist
//                  glink (share by link) · gjoinlink (join from a link) · gbot {add | drop} (computer players)
//
// Computer players sit in seats like people (u "bot:<id>"); the server plays their turns.
// Server → client: g {g, ref} after every change · gc {id, f, x, ts} chat line · gl {games} on glist
import crypto from 'node:crypto';
import { config, USER_RE } from './config.js';
import { ctx } from './context.js';
import { rateLimited } from './http.js';
import { isActive, send, sendTo } from './hub.js';
import { canChat } from './friends.js';
import { shareGroup } from './groups.js';
import { getProfile, profileHooks } from './profiles.js';
import { notify } from './push.js';
import * as core from '../shared/games/core.js';
import { GAMES } from '../shared/games/index.js';

const games = new Map();  // id -> game
const timers = new Map(); // id -> timeout
const MAX_OPEN = 5;       // unfinished games per person
const CHAT_KEEP = 50;
const KEEP_OVER_MS = 10 * 60e3;
const rand = (n) => (n === 6 && config.gameTestDice.length ? config.gameTestDice.shift() - 1 : crypto.randomInt(n));
const ID_RE = /^[A-Za-z0-9_-]{12}$/;

const def = (g) => GAMES[g.type];
const seat = (g, u) => g.players.findIndex((pl) => pl.u === u);
const members = (g) => g.players.filter((pl) => pl.state !== 'declined' && !core.isBot(pl)).map((pl) => pl.u);
const mine = (u) => [...games.values()].filter((g) => members(g).includes(u));
const isOpen = (g) => g.status !== 'over';

// People in the same game see each other's photo, even if they aren't friends.
export const inGameTogether = (a, b) => mine(a).some((g) => isOpen(g) && members(g).includes(b));
profileHooks.inGameTogether = inGameTogether;

// What one person sees: games with secrets (cards in hand) show each player only their own.
function pub(g, u) {
  const { chat, deadline, created, updated, ...rest } = g;
  const view = g.status !== 'lobby' && def(g).view?.(g, seat(g, u));
  return { ...rest, ...(view && { s: view.s, ev: view.ev }), left: deadline ? Math.max(0, deadline - Date.now()) : 0 };
}

async function commit(g, ref) {
  g.v = (g.v || 0) + 1;
  g.updated = Date.now();
  ctx.db.run('saveGame', g.id, g.type, g.status, JSON.stringify(g), g.updated)
    .catch((err) => console.error('saving game failed', err.message));
  for (const u of members(g)) sendTo(u, { t: 'g', g: pub(g, u), ...(u === g.host && ref && { ref }) });
  schedule(g);
}

function schedule(g) {
  clearTimeout(timers.get(g.id));
  let at, fn;
  if (g.status === 'lobby') { at = g.created + config.gameLobbyMs; fn = () => cancel(g, 'expired'); }
  else if (g.status === 'play') { at = g.deadline; fn = () => timeout(g); }
  else { at = g.updated + KEEP_OVER_MS; fn = () => { games.delete(g.id); timers.delete(g.id); }; }
  const t = setTimeout(() => {
    try { fn(); } catch (err) { console.error('game timer failed', err); }
  }, Math.max(0, at - Date.now()));
  t.unref?.();
  timers.set(g.id, t);
}

// A person gets the turn time plus time for animations; a computer player "thinks" until the
// animations are over, then a little more.
const botDelay = (g) => config.gameBotMs || (def(g).animMs?.(g.ev) ?? 1500) + 900;
const turnDeadline = (g) => {
  g.deadline = Date.now() + (core.isBot(g.players[g.turn]) ? botDelay(g) : (config.gameTurnMs || def(g).turnMs) + config.gameAnimMs);
};

function start(g) {
  core.begin(g, def(g), rand);
  turnDeadline(g);
  return commit(g);
}

function cancel(g, why) {
  g.status = 'over';
  g.ev = [{ k: why }];
  g.deadline = 0;
  return commit(g);
}

// The player whose turn it is ran out of time: the server plays for them, and removes them
// after MISSES_OUT turns in a row. A turn counts once, however many bonus rolls it has; once
// someone has timed out, the rest of that turn is played for them after a short pause.
function timeout(g) {
  if (g.status !== 'play') return;
  const i = g.turn;
  const pl = g.players[i];
  if (core.isBot(pl)) { // a computer player's turn: it plays, it never "misses"
    g.ev = [];
    (def(g).bot || def(g).auto)(g, rand);
    turnDeadline(g);
    return commit(g);
  }
  g.ev = [{ k: 'timeout', s: i }];
  const turnNo = g.turnNo || 0; // turns so far (unset before the first change of turn)
  if (g.missTurn !== turnNo) { pl.missed++; g.missTurn = turnNo; }
  if (pl.missed >= core.MISSES_OUT) core.remove(g, def(g), i, 'out');
  else def(g).auto(g, rand);
  if (g.status === 'play' && g.turn === i) g.deadline = Date.now() + config.gameAnimMs + 500; // their bonus roll
  else turnDeadline(g);
  return commit(g);
}

// Start once every seat is taken. Invite-only games also start (or are called off) once nobody
// is still deciding; games shared by link wait for the host, since more people may be coming.
function settleLobby(g) {
  const joined = g.players.filter((pl) => pl.state === 'joined').length;
  if (joined >= def(g).max) return start(g);
  if (g.open || g.players.some((pl) => pl.state === 'invited')) return commit(g);
  return joined >= def(g).min ? start(g) : cancel(g, 'cancelled');
}

const blockedBetween = async (a, b) => !!(await ctx.db.get('getBlock', a, b, b, a));

const find = (ws, m) => {
  const g = typeof m.id === 'string' && ID_RE.test(m.id) ? games.get(m.id) : null;
  if (!g || seat(g, ws.user) < 0) { send(ws, { t: 'gerr', id: m.id, e: 'This game has ended' }); return null; }
  return g;
};

export const handlers = {
  async gnew(ws, m) {
    const d = GAMES[m.type];
    const to = Array.isArray(m.to) ? [...new Set(m.to)] : [];
    const ref = typeof m.ref === 'string' ? m.ref.slice(0, 40) : undefined;
    const fail = (e) => send(ws, { t: 'gerr', ref, e });
    if (!d) return fail('Unknown game');
    const open = to.length === 0 || m.open === true; // no one picked: share a link instead
    if ((!open && to.length < d.min - 1) || to.length > d.max - 1) return fail(`Pick ${d.min - 1} to ${d.max - 1} friends`);
    for (const u of to) {
      if (typeof u !== 'string' || !USER_RE.test(u) || !(await canChat(ws.user, u) || await shareGroup(ws.user, u))) return fail('You can only invite friends');
    }
    if (mine(ws.user).filter(isOpen).length >= MAX_OPEN) return fail('Finish or leave one of your games first');
    if (rateLimited('gnew:' + ws.user, 10, 60e3)) return fail('Slow down');
    const now = Date.now();
    const name = async (u) => (await getProfile(u)).name || '';
    const g = {
      id: crypto.randomBytes(9).toString('base64url'), type: d.type, host: ws.user, status: 'lobby', created: now,
      players: [{ u: ws.user, n: await name(ws.user), state: 'joined' },
        ...(await Promise.all(to.map(async (u) => ({ u, n: await name(u), state: 'invited' }))))],
      ev: [{ k: 'lobby' }], chat: [], deadline: now + config.gameLobbyMs, open,
    };
    games.set(g.id, g);
    await commit(g, ref);
    const host = g.players[0].n || ws.user;
    for (const u of to) {
      if (!isActive(u)) notify(u, { t: 'game', from: ws.user, name: host, game: d.name }, `${u}|g|${ws.user}`).catch(() => {});
    }
  },

  async gjoin(ws, m) {
    const g = find(ws, m);
    if (!g) return;
    const pl = g.players[seat(g, ws.user)];
    if (g.status !== 'lobby' || pl.state !== 'invited') return send(ws, { t: 'g', g: pub(g) });
    pl.state = 'joined';
    g.ev = [{ k: 'joined', s: seat(g, ws.user) }];
    await settleLobby(g);
  },

  async gdecline(ws, m) {
    const g = find(ws, m);
    if (!g || g.status !== 'lobby') return;
    const i = seat(g, ws.user);
    if (g.players[i].state !== 'invited') return;
    g.players[i].state = 'declined';
    g.ev = [{ k: 'declined', s: i }];
    send(ws, { t: 'g', g: pub(g) }); // they won't get further updates
    await settleLobby(g);
  },

  async gstart(ws, m) {
    const g = find(ws, m);
    if (!g || g.status !== 'lobby' || g.host !== ws.user) return;
    if (g.players.filter((pl) => pl.state === 'joined').length < def(g).min) return send(ws, { t: 'gerr', id: g.id, e: 'Wait for someone to join' });
    for (const pl of g.players) if (pl.state === 'invited') pl.state = 'declined';
    await start(g);
  },

  // Someone in the lobby shares the game's link: from now on it waits for the host to start.
  async glink(ws, m) {
    const g = find(ws, m);
    if (!g || g.status !== 'lobby' || g.open) return;
    g.open = true;
    g.ev = [{ k: 'open' }];
    await commit(g);
  },

  async gjoinlink(ws, m) {
    const g = typeof m.id === 'string' && ID_RE.test(m.id) ? games.get(m.id) : null;
    const fail = (e) => send(ws, { t: 'gerr', id: m.id, link: true, e });
    if (!g || g.status === 'over') return fail('This game has ended');
    let i = seat(g, ws.user);
    if (i >= 0 && g.players[i].state !== 'invited' && g.players[i].state !== 'declined') return send(ws, { t: 'g', g: pub(g) }); // already in it
    if (g.status !== 'lobby') return fail('This game has already started');
    if (!g.open && i < 0) return fail('This game is invite-only');
    if (rateLimited('gjoinlink:' + ws.user, 20, 60e3)) return fail('Slow down');
    for (const u of members(g)) if (u !== ws.user && await blockedBetween(u, ws.user)) return fail('You can’t join this game');
    const taken = g.players.filter((pl) => pl.state !== 'declined').length;
    if ((i < 0 || g.players[i].state === 'declined') && taken >= def(g).max) return fail('This game is full');
    if (i < 0) {
      g.players.push({ u: ws.user, n: (await getProfile(ws.user)).name || '', state: 'joined' });
      i = g.players.length - 1;
    } else g.players[i].state = 'joined';
    g.ev = [{ k: 'joined', s: i }];
    await settleLobby(g);
  },

  async gleave(ws, m) {
    const g = find(ws, m);
    if (!g || g.status === 'over') return;
    const i = seat(g, ws.user);
    if (g.status === 'lobby') {
      if (ws.user === g.host) return cancel(g, 'cancelled');
      g.players[i].state = 'declined';
      g.ev = [{ k: 'declined', s: i }];
      send(ws, { t: 'g', g: pub(g) });
      return settleLobby(g);
    }
    g.ev = [];
    const turnWas = g.turn;
    core.remove(g, def(g), i, 'left');
    if (g.turn !== turnWas) turnDeadline(g);
    await commit(g);
  },

  async gact(ws, m) {
    const g = find(ws, m);
    if (!g) return;
    const i = seat(g, ws.user);
    g.ev = [];
    const turn = g.turn, turnNo = g.turnNo;
    try { def(g).act(g, i, m.a, rand); }
    catch (err) { g.ev = []; return send(ws, { t: 'gerr', id: g.id, e: err.message }); }
    // Some actions don't need your turn (UNO's "UNO!" and catching): they don't reset the clock.
    if (i === turn) g.players[i].missed = 0;
    if (i === turn || g.turn !== turn || g.turnNo !== turnNo) turnDeadline(g);
    await commit(g);
  },

  async gsay(ws, m) {
    const g = find(ws, m);
    if (!g) return;
    const x = typeof m.x === 'string' ? m.x.trim().slice(0, 200) : '';
    if (!x || g.players[seat(g, ws.user)].state === 'declined') return;
    if (rateLimited('gsay:' + ws.user, 10, 10e3)) return send(ws, { t: 'gerr', id: g.id, e: 'Slow down' });
    const line = { f: ws.user, x, ts: Date.now() };
    g.chat.push(line);
    if (g.chat.length > CHAT_KEEP) g.chat.splice(0, g.chat.length - CHAT_KEEP);
    for (const u of members(g)) sendTo(u, { t: 'gc', id: g.id, ...line });
    // @mentions reach people who aren't looking at the app
    const tagged = new Set([...x.matchAll(/@([a-z0-9_.]{3,24})/gi)].map((m) => m[1].toLowerCase().replace(/\.+$/, '')));
    const name = g.players[seat(g, ws.user)].n || ws.user;
    for (const u of members(g)) {
      if (u !== ws.user && tagged.has(u) && !isActive(u)) {
        notify(u, { t: 'gmention', from: ws.user, name, game: def(g).name }, `${u}|gm|${g.id}`).catch(() => {});
      }
    }
  },

  async glist(ws) {
    send(ws, { t: 'gl', games: mine(ws.user).map((g) => ({ ...pub(g, ws.user), chat: g.chat })) });
  },

  // The host adds or removes a computer player while waiting for people.
  async gbot(ws, m) {
    const g = find(ws, m);
    if (!g || g.status !== 'lobby' || g.host !== ws.user) return;
    if (m.drop) {
      const i = g.players.findIndex((pl) => core.isBot(pl) && pl.u === m.drop);
      if (i < 0) return;
      g.players.splice(i, 1);
      g.ev = [{ k: 'botleft' }];
      return commit(g);
    }
    if (g.players.filter((pl) => pl.state !== 'declined').length >= def(g).max) return send(ws, { t: 'gerr', id: g.id, e: 'No seats left' });
    const used = new Set(g.players.map((pl) => pl.n));
    const name = core.BOT_NAMES.find((n) => !used.has(n)) || 'Bot';
    g.players.push({ u: 'bot:' + crypto.randomBytes(4).toString('base64url'), n: name, state: 'joined', bot: true });
    g.ev = [{ k: 'bot' }];
    await settleLobby(g);
  },
};

/** Load unfinished games after a restart. Anyone whose turn it was gets a fresh moment to reconnect. */
export async function loadGames() {
  const rows = await ctx.db.all('openGames', Date.now() - 864e5);
  for (const r of rows) {
    try {
      const g = JSON.parse(r.state);
      if (!GAMES[g.type]) continue;
      if (g.status === 'play') g.deadline = Math.max(g.deadline, Date.now() + 15e3);
      games.set(g.id, g);
      schedule(g);
    } catch (err) { console.error('bad saved game', err.message); }
  }
  return rows.length;
}

export const purgeGames = () => ctx.db.run('purgeGames', Date.now() - 7 * 864e5);

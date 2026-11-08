// Games in the app: the latest state of each game from the server, its chat, and the actions
// you can take. The server runs the games (server/games.js); this only shows and asks.
import { toast } from 'sonner';
import { create } from 'zustand';
import { frameHooks, myName, sendFrame } from '../../lib/engine';
import { randomId } from '@sanga/crypto';
import { mentioned } from '../../lib/mentions';
import { playSound } from './sounds';
import { t, tk } from '@sanga/i18n';

export type PlayerState = 'invited' | 'joined' | 'declined' | 'playing' | 'done' | 'left' | 'out';
export interface GamePlayer { u: string; n: string; state: PlayerState; missed?: number; rank?: number; bot?: boolean }
export interface GameEvent { k: string; s?: number; [key: string]: any }
export interface Game<S = any> {
  id: string; type: string; host: string; status: 'lobby' | 'play' | 'over';
  players: GamePlayer[]; turn: number; s: S; ev: GameEvent[]; v: number;
  open?: boolean;   // anyone with the link may join while in the lobby
  again?: string;   // finished: the rematch someone started
  deadline: number; // local clock: when the current turn (or the invite) runs out
}
export interface ChatLine { f: string; x: string; ts: number }

/** The "new game" dialog: who's ticked, and who can be picked (default: my friends; from a group: its members). */
export interface Picker { pre: string[]; pool?: { u: string; name?: string }[]; type?: string }

interface GamesState {
  games: Record<string, Game>;
  chat: Record<string, ChatLine[]>;
  unread: Record<string, number>;
  bubble: Record<string, { x: string; ts: number }>; // `${gameId}/${user}` -> what they just said
  open: string | null;       // game shown full screen
  chatOpen: boolean;
  picker: Picker | null;     // "new game" dialog
  dismissed: string[];       // finished games whose results were closed
}

/** Finished games you closed, kept on this device so they don't come back when the list reloads. */
const CLOSED = 'sanga-games-closed';
function closedBefore(): string[] { try { return JSON.parse(localStorage.getItem(CLOSED) ?? '[]'); } catch { return []; } }

export const useGames = create<GamesState>(() => ({
  games: {}, chat: {}, unread: {}, bubble: {}, open: null, chatOpen: false, picker: null, dismissed: closedBefore(),
}));
const set = useGames.setState;
const get = useGames.getState;

const nameOf = (g: Game, u: string) => g.players.find((p) => p.u === u)?.n || u;
const meIn = (g: Game) => g.players.find((p) => p.u === myName());
const pending = new Map<string, true>(); // refs of games I just created, to open them when they arrive

// A game link (/?play=<id>) waits here through sign-in or sign-up, until we're connected.
const LINK_KEY = 'chattrix-join-game';
const linkPending = () => { try { return sessionStorage.getItem(LINK_KEY); } catch { return null; } };
const setLinkPending = (id: string | null) => {
  try { if (id) sessionStorage.setItem(LINK_KEY, id); else sessionStorage.removeItem(LINK_KEY); } catch { /* storage blocked */ }
};
/** Called at start-up with the id from a shared game link. */
export function joinFromLink(id: string) {
  if (!/^[A-Za-z0-9_-]{12}$/.test(id)) return;
  setLinkPending(id);
  sendFrame({ t: 'gjoinlink', id }); // if not connected yet, sent after the game list arrives
}
export const hasPendingLink = () => !!linkPending();
export const shareLink = (id: string) => `${location.origin}/?play=${id}`;

function ingest(raw: any): Game | null {
  if (raw.status === 'over' && get().dismissed.includes(raw.id)) return null; // closed: stays closed
  const prev = get().games[raw.id];
  if (prev && prev.v >= raw.v) return null;
  const { left, ...rest } = raw;
  const g: Game = { ...rest, deadline: Date.now() + (left || 0) };
  if (meIn(g)?.state === 'declined') {
    set((s) => { const games = { ...s.games }; delete games[g.id]; return { games, open: s.open === g.id ? null : s.open }; });
    return null;
  }
  set((s) => ({ games: { ...s.games, [g.id]: g } }));
  return g;
}

frameHooks.g = (m) => {
  const before = get().games[m.g.id];
  const g = ingest(m.g);
  if (linkPending() === m.g.id && get().games[m.g.id]) { setLinkPending(null); set({ open: m.g.id }); } // opened from a link
  if (!g) return;
  if (m.ref && pending.delete(m.ref)) {
    set({ open: g.id, picker: null });
    const old = replaces.get(m.ref);
    if (old) { replaces.delete(m.ref); wantAgain.delete(old); dismiss(old); }
  }
  if (g.again && wantAgain.delete(g.id)) { set({ open: g.again }); dismiss(g.id); } // someone had already started one: into that
  const me = meIn(g);
  if (!before && g.status === 'lobby' && me?.state === 'invited') {
    playSound('invite');
    toast(t('{name} invited you to play {game}', { name: nameOf(g, g.host), game: gameName(g.type) }), {
      duration: 15_000,
      action: { label: t('Join'), onClick: () => { join(g.id); set({ open: g.id }); } },
    });
  }
};

frameHooks.gl = (m) => {
  const games: Record<string, Game> = {};
  const chat: Record<string, ChatLine[]> = {};
  for (const raw of m.games) {
    const { left, chat: lines, ...rest } = raw;
    const g: Game = { ...rest, deadline: Date.now() + (left || 0) };
    if (meIn(g)?.state === 'declined' || (g.status === 'over' && get().dismissed.includes(g.id))) continue;
    games[g.id] = g;
    chat[g.id] = lines || [];
  }
  set((s) => ({ games, chat, open: s.open && games[s.open] ? s.open : null }));
  const link = linkPending();
  if (link) sendFrame({ t: 'gjoinlink', id: link });
};

frameHooks.gc = (m) => {
  const line: ChatLine = { f: m.f, x: m.x, ts: m.ts };
  set((s) => {
    const seen = s.open === m.id && s.chatOpen;
    return {
      chat: { ...s.chat, [m.id]: [...(s.chat[m.id] || []), line].slice(-50) },
      bubble: { ...s.bubble, [`${m.id}/${m.f}`]: { x: m.x, ts: Date.now() } },
      unread: seen || m.f === myName() ? s.unread : { ...s.unread, [m.id]: (s.unread[m.id] || 0) + 1 },
    };
  });
  if (m.f !== myName()) playSound('chat');
  const g = get().games[m.id];
  if (g && m.f !== myName() && mentioned(m.x, [myName()]).length && !(get().open === m.id && get().chatOpen)) {
    navigator.vibrate?.([30, 50, 30]);
    toast(t('{name} mentioned you', { name: nameOf(g, m.f) }), {
      description: m.x, duration: 8000,
      action: { label: t('Reply'), onClick: () => set({ open: m.id, chatOpen: true }) },
    });
  }
};

// Teases thrown in a game: handed to whoever is drawing the board (game-screen/TeaseLayer), never stored.
type TeaseMsg = { id: string; f: string; to: string; k: string };
const teaseListeners = new Set<(m: TeaseMsg) => void>();
export const onTease = (fn: (m: TeaseMsg) => void) => { teaseListeners.add(fn); return () => { teaseListeners.delete(fn); }; };
frameHooks.gt = (m) => teaseListeners.forEach((f) => f({ id: m.id, f: m.f, to: m.to, k: m.k }));
export const tease = (id: string, to: string, k: string) => sendOrWarn({ t: 'gtease', id, to, k });

frameHooks.gerr = (m) => {
  if (m.ref) pending.delete(m.ref);
  if (m.link) setLinkPending(null);
  toast.error(m.e ? t(m.e) : t('Something went wrong'));
};

/** Sends a frame; false (and a warning) if the connection is down. */
function sendOrWarn(frame: object) {
  const sent = sendFrame(frame);
  if (!sent) toast.error(t('You’re offline'), { description: t('Reconnect to play.'), id: 'game-offline' });
  return sent;
}

// The registry needs the store, so names are looked up lazily to avoid a cycle.
let names: Record<string, string> = {};
export const registerGameNames = (n: Record<string, string>) => { names = n; };
export const gameName = (type: string) => (names[type] ? t(names[type]) : t('a game'));

/** The errors the server sends back (server/games.js and the rules in packages/game-rules), shown with t(m.e). */
export const GAME_ERRORS = [
  tk('This game has ended'), tk('Wait for someone to join'), tk('Slow down'), tk('No seats left'),
  tk('Call UNO when you’re about to have one card'), tk('Not allowed now'), tk('Nothing to keep'), tk('Not your turn'),
  tk('Pick a colour'), tk('Pick a column'), tk('Pick a square'), tk('Play the card you drew, or keep it'),
  tk('That card doesn’t match'), tk('That card isn’t in your hand'), tk('That column is full'), tk('That square is taken'),
  tk('That token can’t move'), tk('Too late'), tk('You’re not playing'), tk('You’ve already drawn'),
];

export function createGame(type: string, to: string[]) {
  const ref = randomId();
  pending.set(ref, true);
  sendOrWarn({ t: 'gnew', type, to, ref });
}
/** Play a finished game again with the same people (computer players sit down again by themselves). */
const wantAgain = new Set<string>();
const replaces = new Map<string, string>(); // rematch ref → the finished game it replaces (closed once the new one opens)
export function rematch(g: Game) {
  const ref = randomId();
  pending.set(ref, true);
  sendOrWarn({ t: 'grematch', id: g.id, ref });
  if (g.again) { set({ open: g.again }); dismiss(g.id); return; } // someone already asked: into theirs
  wantAgain.add(g.id);
  replaces.set(ref, g.id);
}
export const join = (id: string) => sendOrWarn({ t: 'gjoin', id });
export const decline = (id: string) => sendOrWarn({ t: 'gdecline', id });
export const startNow = (id: string) => sendOrWarn({ t: 'gstart', id });
export const leave = (id: string) => sendOrWarn({ t: 'gleave', id });
export const act = (id: string, a: object) => sendOrWarn({ t: 'gact', id, a });
export const say = (id: string, x: string) => sendOrWarn({ t: 'gsay', id, x });
export const addBot = (id: string) => sendOrWarn({ t: 'gbot', id });
export const dropBot = (id: string, u: string) => sendOrWarn({ t: 'gbot', id, drop: u });

/** The game's link was copied or shared: from now on anyone with it can join until the game starts. */
export const linkShared = (g: Game) => { if (!g.open) sendOrWarn({ t: 'glink', id: g.id }); };

export const openGame = (id: string | null) => set({ open: id, chatOpen: false });
export const openPicker = (pre: string[] = [], pool?: Picker['pool'], type?: string) => set({ picker: { pre, ...(pool && { pool }), ...(type && { type }) } });
export const closePicker = () => set({ picker: null });
export const setChatOpen = (chatOpen: boolean) =>
  set((s) => ({ chatOpen, unread: chatOpen && s.open ? { ...s.unread, [s.open]: 0 } : s.unread }));

/** Close a finished game for good. */
export function dismiss(id: string) {
  set((s) => {
    const games = { ...s.games };
    delete games[id];
    const dismissed = [...s.dismissed, id].slice(-50);
    try { localStorage.setItem(CLOSED, JSON.stringify(dismissed)); } catch { /* this visit only */ }
    return { games, dismissed, open: s.open === id ? null : s.open };
  });
}

/** Games to list: invites, lobbies and games in progress, and finished ones not yet closed. */
export function listed(games: Record<string, Game>) {
  return Object.values(games).sort((a, b) => order(a) - order(b));
}
const order = (g: Game) => (g.status === 'lobby' && meIn(g)?.state === 'invited' ? 0 : g.status === 'play' ? 1 : g.status === 'lobby' ? 2 : 3);

export { meIn, nameOf };

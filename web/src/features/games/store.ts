// Games in the app: the latest state of each game from the server, its chat, and the actions
// you can take. The server runs the games (server/games.js); this only shows and asks.
import { toast } from 'sonner';
import { create } from 'zustand';
import { frameHooks, myName, sendFrame } from '../../lib/engine';
import { randomId } from '../../lib/crypto.js';
import { mentioned } from '../../lib/mentions';
import { playSound } from './sounds';

export type PlayerState = 'invited' | 'joined' | 'declined' | 'playing' | 'done' | 'left' | 'out';
export interface GamePlayer { u: string; n: string; state: PlayerState; missed?: number; rank?: number }
export interface GameEvent { k: string; s?: number; [key: string]: any }
export interface Game<S = any> {
  id: string; type: string; host: string; status: 'lobby' | 'play' | 'over';
  players: GamePlayer[]; turn: number; s: S; ev: GameEvent[]; v: number;
  open?: boolean;   // anyone with the link may join while in the lobby
  deadline: number; // local clock: when the current turn (or the invite) runs out
}
export interface ChatLine { f: string; x: string; ts: number }

interface GamesState {
  games: Record<string, Game>;
  chat: Record<string, ChatLine[]>;
  unread: Record<string, number>;
  bubble: Record<string, { x: string; ts: number }>; // `${gameId}/${user}` -> what they just said
  open: string | null;       // game shown full screen
  chatOpen: boolean;
  picker: string[] | null;   // "new game" dialog, with these friends ticked
  dismissed: string[];       // finished games whose results were closed
}

export const useGames = create<GamesState>(() => ({
  games: {}, chat: {}, unread: {}, bubble: {}, open: null, chatOpen: false, picker: null, dismissed: [],
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
  if (m.ref && pending.delete(m.ref)) set({ open: g.id, picker: null });
  const me = meIn(g);
  if (!before && g.status === 'lobby' && me?.state === 'invited') {
    playSound('invite');
    toast(`${nameOf(g, g.host)} invited you to play ${gameName(g.type)}`, {
      duration: 15_000,
      action: { label: 'Join', onClick: () => { join(g.id); set({ open: g.id }); } },
    });
  }
};

frameHooks.gl = (m) => {
  const games: Record<string, Game> = {};
  const chat: Record<string, ChatLine[]> = {};
  for (const raw of m.games) {
    const { left, chat: lines, ...rest } = raw;
    const g: Game = { ...rest, deadline: Date.now() + (left || 0) };
    if (meIn(g)?.state === 'declined') continue;
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
    toast(`${nameOf(g, m.f)} mentioned you`, {
      description: m.x, duration: 8000,
      action: { label: 'Reply', onClick: () => set({ open: m.id, chatOpen: true }) },
    });
  }
};

frameHooks.gerr = (m) => {
  if (m.ref) pending.delete(m.ref);
  if (m.link) setLinkPending(null);
  toast.error(m.e || 'Something went wrong');
};

function sendOrWarn(frame: object) {
  if (!sendFrame(frame)) toast.error('You’re offline', { description: 'Reconnect to play.' });
}

// The registry needs the store, so names are looked up lazily to avoid a cycle.
let names: Record<string, string> = {};
export const registerGameNames = (n: Record<string, string>) => { names = n; };
export const gameName = (type: string) => names[type] || 'a game';

export function createGame(type: string, to: string[]) {
  const ref = randomId();
  pending.set(ref, true);
  sendOrWarn({ t: 'gnew', type, to, ref });
}
export const join = (id: string) => sendOrWarn({ t: 'gjoin', id });
export const decline = (id: string) => sendOrWarn({ t: 'gdecline', id });
export const startNow = (id: string) => sendOrWarn({ t: 'gstart', id });
export const leave = (id: string) => sendOrWarn({ t: 'gleave', id });
export const act = (id: string, a: object) => sendOrWarn({ t: 'gact', id, a });
export const say = (id: string, x: string) => sendOrWarn({ t: 'gsay', id, x });

/** The game's link was copied or shared: from now on anyone with it can join until the game starts. */
export const linkShared = (g: Game) => { if (!g.open) sendOrWarn({ t: 'glink', id: g.id }); };

export const openGame = (id: string | null) => set({ open: id, chatOpen: false });
export const openPicker = (friends: string[] = []) => set({ picker: friends });
export const closePicker = () => set({ picker: null });
export const setChatOpen = (chatOpen: boolean) =>
  set((s) => ({ chatOpen, unread: chatOpen && s.open ? { ...s.unread, [s.open]: 0 } : s.unread }));

/** Close a finished game for good. */
export function dismiss(id: string) {
  set((s) => {
    const games = { ...s.games };
    delete games[id];
    return { games, dismissed: [...s.dismissed, id], open: s.open === id ? null : s.open };
  });
}

/** Games to list: invites, lobbies and games in progress, and finished ones not yet closed. */
export function listed(games: Record<string, Game>) {
  return Object.values(games).sort((a, b) => order(a) - order(b));
}
const order = (g: Game) => (g.status === 'lobby' && meIn(g)?.state === 'invited' ? 0 : g.status === 'play' ? 1 : g.status === 'lobby' ? 2 : 3);

export { meIn, nameOf };

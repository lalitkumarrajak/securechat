// Runtime state for the UI. The engine (lib/engine.ts) writes to it; components read it.
import { create } from 'zustand';
import type { Chat, Friend, Me, Msg, Presence, Request } from '../lib/types';

export type Status = 'loading' | 'auth' | 'app';
export type Conn = 'online' | 'connecting' | 'offline';
export type Panel = null | 'settings' | 'friends' | 'contact' | 'archived';

export interface AppState {
  status: Status;
  signupOpen: boolean;
  gifsEnabled: boolean;                  // server has a KLIPY key
  syncing: boolean;                      // first download of messages since opening the app
  friendsLoaded: boolean;                // friend list known (saved on this device, or fetched)
  settingsPage: string | null;           // open Settings at this page (e.g. 'sessions' from a sign-in alert)
  conn: Conn;
  me: Me | null;
  friends: Record<string, Friend>;
  incoming: Request[];
  outgoing: Request[];
  blocked: string[];
  chats: Chat[];                         // newest first
  active: string | null;                 // open chat
  messages: Msg[];                       // messages of the open chat, oldest first
  presence: Record<string, Presence>;
  typing: Record<string, 'typing' | 'recording'>;
  avatars: Record<string, string | null>; // username -> object URL of their photo (null = none)
  keyChanged: Record<string, boolean>;
  replyTo: Msg | null;
  editing: Msg | null;
  selection: string[] | null;            // selected message keys; null when not selecting
  panel: Panel;
  friendsTab: 'friends' | 'requests' | 'add';
  searchOpen: boolean;
  searchQuery: string;
  highlight: string | null;              // message key to flash after a jump
}

export const useApp = create<AppState>(() => ({
  status: 'loading',
  signupOpen: true,
  gifsEnabled: false,
  syncing: true,
  friendsLoaded: false,
  settingsPage: null,
  conn: 'connecting',
  me: null,
  friends: {},
  incoming: [],
  outgoing: [],
  blocked: [],
  chats: [],
  active: null,
  messages: [],
  presence: {},
  typing: {},
  avatars: {},
  keyChanged: {},
  replyTo: null,
  editing: null,
  selection: null,
  panel: null,
  friendsTab: 'friends',
  searchOpen: false,
  searchQuery: '',
  highlight: null,
}));

export const setApp = useApp.setState;
export const getApp = useApp.getState;

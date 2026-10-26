// Runtime state for the UI. The engine (lib/engine.ts) writes to it; components read it.
import { create } from 'zustand';
import type { Chat, Friend, Group, Me, Msg, Presence, Request } from '../lib/types';

export type Status = 'loading' | 'auth' | 'app';
export type Conn = 'online' | 'connecting' | 'offline';
export type Panel = null | 'settings' | 'friends' | 'contact' | 'archived' | 'group' | 'newgroup';

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
  olderLeft: boolean;                    // the open chat has older messages on this device, not loaded yet
  presence: Record<string, Presence>;
  typing: Record<string, 'typing' | 'recording'>;
  typingWho: Record<string, string>;     // group peer -> who is typing there
  groups: Record<string, Group>;         // my groups by id
  groupsLoaded: boolean;
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
  olderLeft: false,
  presence: {},
  typing: {},
  typingWho: {},
  groups: {},
  groupsLoaded: false,
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

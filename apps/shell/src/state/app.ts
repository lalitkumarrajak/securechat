// Runtime state for the UI. The engine (lib/engine.ts) writes to it; components read it.
import { create } from 'zustand';
import type { Chat, Friend, Group, Me, Msg, Presence, Request } from '../lib/types';

export type Status = 'loading' | 'auth' | 'app';
export type Section = 'chat' | 'stories' | 'games' | 'diary' | 'calendar' | 'split' | 'more';
export type Conn = 'online' | 'connecting' | 'offline';
export type Panel = null | 'settings' | 'friends' | 'contact' | 'archived' | 'group' | 'newgroup';

export interface AppState {
  status: Status;
  section: Section;                      // home screen, Chat or Games (lib/nav.ts)
  signupOpen: boolean;
  gifsEnabled: boolean;                  // server has a KLIPY key
  emailRequired: boolean;                // new accounts need a verified email (the server can send it)
  syncing: boolean;                      // first download of messages since opening the app
  filling: boolean;                      // older messages still downloading behind the newest
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
  topic: string;                         // the open chat's tab ('' = the main chat)
  messages: Msg[];                       // messages of the open chat's tab, oldest first
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
  appParams: Record<string, Record<string, string> | undefined>; // starting values for an app that is about to open (sdk.open)
  notesChat: string | null;              // the diary opens at this chat's notes ('' = personal, null = all)
  friendsTab: 'friends' | 'requests' | 'add';
  searchOpen: boolean;
  searchQuery: string;
  highlight: string | null;              // message key to flash after a jump
}

export const useApp = create<AppState>(() => ({
  status: 'loading',
  section: location.hash === '#stories' ? 'stories' : location.hash === '#games' ? 'games' : location.hash === '#diary' ? 'diary' : location.hash === '#calendar' ? 'calendar' : location.hash === '#split' ? 'split' : location.hash === '#more' ? 'more' : 'chat',
  signupOpen: true,
  gifsEnabled: false,
  emailRequired: false,
  syncing: true,
  filling: false,
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
  topic: '',
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
  appParams: {},
  notesChat: null,
  friendsTab: 'friends',
  searchOpen: false,
  searchQuery: '',
  highlight: null,
}));

export const setApp = useApp.setState;
export const getApp = useApp.getState;

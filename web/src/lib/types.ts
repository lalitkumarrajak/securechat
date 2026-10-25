export type Reply = { f: string; c: string; p: string }; // quoted message: sender, cid, preview

export type MsgType = 'text' | 'img' | 'voice' | 'deleted' | 'err';

/** A message as stored on this device (decrypted). `k` is "sender/cid", unique per message. */
export interface Msg {
  k: string;
  cid: string;
  id?: number;            // server id, once acknowledged
  peer: string;
  out: boolean;
  ts: number;
  s: number;              // -2 failed, -1 sending, 0 sent, 1 delivered, 2 read
  type: MsgType;
  text?: string;
  src?: string;           // data: URL of a photo or voice note
  w?: number;
  h?: number;
  dur?: number;           // voice duration, seconds
  peaks?: number[];       // voice waveform, 0–1
  re?: Reply;
  fwd?: boolean;
  edited?: number;        // time of the last accepted edit
  reacts?: Record<string, string>; // username -> emoji
}

export interface Pin { k: string; ts: number }

export interface Chat {
  peer: string;
  ts: number;
  last: string;
  lastOut: boolean;
  lastK?: string;
  lastS?: number;         // status of the last message, for ticks in the chat list
  unread: number;
  pins: Pin[];
  archived?: boolean;
  draft?: string;
}

export interface Person { u: string; name: string; about: string; av: number }
export interface Friend extends Person { pub: string; since: number }
export interface Request extends Person { ts: number }
export type Relation = 'none' | 'out' | 'in' | 'friends' | 'blocked';
export interface SearchHit extends Person { rel: Relation }

export interface Presence { on: boolean; ls: number; hid?: boolean }

export interface Privacy { lastSeen: boolean; receipts: boolean }
export interface Me { u: string; name: string; about: string; privacy: Privacy; mutes: Record<string, number>; av: number; encPriv?: string }

/** Encrypted message content. Control types change other messages and aren't shown as bubbles. */
export type Content =
  | { type: 'text'; text: string; re?: Reply; fwd?: boolean }
  | { type: 'img'; src: string; w: number; h: number; text?: string; re?: Reply; fwd?: boolean }
  | { type: 'voice'; src: string; dur: number; peaks: number[]; re?: Reply; fwd?: boolean }
  | { type: 'react'; k: string; e: string }
  | { type: 'edit'; k: string; text: string }
  | { type: 'pin'; k: string; on: boolean };

export const displayName = (p: { u: string; name?: string } | undefined, u: string) => p?.name || u;

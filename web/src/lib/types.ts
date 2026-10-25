export type Reply = { f: string; c: string; p: string }; // quoted message: sender, cid, preview
export interface LinkPreview { url: string; title: string; desc: string; site: string; img?: string }

export type MsgType = 'text' | 'img' | 'voice' | 'gif' | 'sticker' | 'file' | 'location' | 'deleted' | 'err';

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
  src?: string;           // data: URL of a photo or voice note; KLIPY URL of a GIF; sticker id
  w?: number;
  h?: number;
  dur?: number;           // voice duration, seconds
  peaks?: number[];       // voice waveform, 0–1
  re?: Reply;
  fwd?: boolean;
  lp?: LinkPreview;       // link preview made by the sender
  file?: { name: string; size: number; mime: string; thumb?: string; text?: string; pages?: number };
  loc?: { lat: number; lng: number; acc: number };
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
  | { type: 'text'; text: string; re?: Reply; fwd?: boolean; lp?: LinkPreview }
  | { type: 'file'; src: string; name: string; size: number; mime: string; thumb?: string; text?: string; pages?: number; re?: Reply; fwd?: boolean }
  | { type: 'location'; lat: number; lng: number; acc: number; re?: Reply; fwd?: boolean }
  | { type: 'img'; src: string; w: number; h: number; text?: string; re?: Reply; fwd?: boolean }
  | { type: 'voice'; src: string; dur: number; peaks: number[]; re?: Reply; fwd?: boolean }
  | { type: 'gif'; src: string; w: number; h: number; re?: Reply; fwd?: boolean }
  | { type: 'sticker'; src: string; w?: number; h?: number; re?: Reply; fwd?: boolean }
  | { type: 'react'; k: string; e: string }
  | { type: 'edit'; k: string; text: string }
  | { type: 'pin'; k: string; on: boolean };

/** A device signed in to your account (Settings → Account → Active sessions). */
export interface Session { id: string; current: boolean; online: boolean; created: number; lastSeen: number; ua: string; ip: string }

/** A GIF or sticker search result from KLIPY. */
export interface GifItem { id: string; thumb: string; src: string; w: number; h: number; title: string }

export const displayName = (p: { u: string; name?: string } | undefined, u: string) => p?.name || u;

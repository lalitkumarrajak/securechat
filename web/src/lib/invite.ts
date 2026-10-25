// "Join me on Chattrix" links: /?add=<username>. The invite waits through sign-up or sign-in,
// then offers to send that person a friend request.
import { toast } from 'sonner';
import { confirm } from '../components/ui/confirm';
import { getApp } from '../state/app';
import { openChat, sendRequest } from './engine';

const KEY = 'chattrix-add';
const USER_RE = /^[a-z0-9_.]{3,24}$/;
const read = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
const write = (u: string | null) => { try { if (u) sessionStorage.setItem(KEY, u); else sessionStorage.removeItem(KEY); } catch { /* storage blocked */ } };

export const inviteLink = (u: string) => `${location.origin}/?add=${encodeURIComponent(u)}`;
export const pendingInviter = () => read();

/** Called at start-up with the username from an invite link. */
export function rememberInvite(u: string) {
  const v = u.trim().toLowerCase();
  if (USER_RE.test(v)) write(v);
}

/** Once signed in: offer the friend request (or open the chat if already friends). */
export async function handleInvite() {
  const u = read();
  if (!u) return;
  write(null);
  const { me, friends, outgoing } = getApp();
  if (!me || u === me.u) return;
  if (friends[u]) return openChat(u);
  if (outgoing.some((r) => r.u === u)) return toast('Friend request already sent', { description: `@${u} will see it.` });
  const ok = await confirm({ title: `Add @${u} as a friend?`, description: `@${u} invited you to Chattrix. Once they accept, you can chat.`, confirmText: 'Send friend request' });
  if (!ok) return;
  try {
    const r = await sendRequest(u);
    toast.success(r?.rel === 'friends' ? 'You’re now friends' : 'Friend request sent');
  } catch (e) { toast.error((e as Error).message); }
}

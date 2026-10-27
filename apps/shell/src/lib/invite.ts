// "Join me on Chattrix" links: /?add=<username>. The invite waits through sign-up or sign-in,
// then offers to send that person a friend request.
import { toast } from 'sonner';
import { confirm } from '../components/ui/confirm';
import { getApp } from '../state/app';
import { openChat, sendRequest } from './engine';
import { joinGroup, previewGroup } from './groups';

const KEY = 'chattrix-add';
const GROUP_KEY = 'chattrix-join-group';
const USER_RE = /^[a-z0-9_.]{3,24}$/;
const read = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
const write = (u: string | null) => { try { if (u) sessionStorage.setItem(KEY, u); else sessionStorage.removeItem(KEY); } catch { /* storage blocked */ } };

export const inviteLink = (u: string) => `${location.origin}/?add=${encodeURIComponent(u)}`;
export const pendingInviter = () => read();

/** Group invite links: /?group=<code>, joined after confirming, once signed in. */
export function rememberGroupInvite(code: string) {
  if (/^[A-Za-z0-9_-]{16}$/.test(code)) try { sessionStorage.setItem(GROUP_KEY, code); } catch { /* storage blocked */ }
}
export const pendingGroupInvite = () => { try { return sessionStorage.getItem(GROUP_KEY); } catch { return null; } };

async function handleGroupInvite() {
  const code = pendingGroupInvite();
  if (!code) return;
  try { sessionStorage.removeItem(GROUP_KEY); } catch { /* storage blocked */ }
  try {
    const g = await previewGroup(code);
    if (g.member) return openChat('g:' + g.id);
    const ok = await confirm({ title: `Join “${g.name}”?`, description: `${g.count} member${g.count === 1 ? '' : 's'}${g.about ? ' · ' + g.about : ''}`, confirmText: 'Join group' });
    if (ok) { await joinGroup(code); toast.success(`You joined “${g.name}”`); }
  } catch (e) { toast.error((e as Error).message); }
}

/** Called at start-up with the username from an invite link. */
export function rememberInvite(u: string) {
  const v = u.trim().toLowerCase();
  if (USER_RE.test(v)) write(v);
}

/** Once signed in: offer the friend request (or open the chat if already friends). */
export async function handleInvite() {
  await handleGroupInvite();
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

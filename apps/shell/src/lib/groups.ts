// Group management: create, edit, members and admins, invite links. Messages themselves go
// through the engine like any chat, to the peer "g:<id>".
import { squarePhoto, type Crop } from './image';
import { api, openChat, refreshGroups } from './engine';
import type { Group } from './types';

const after = async <T>(p: Promise<T>) => { const r = await p; await refreshGroups(); return r; };

export async function createGroup(name: string, members: string[], about = '') {
  const { group } = await after(api<{ group: Group }>('/api/groups', { name, about, members }));
  await openChat('g:' + group.id);
  return group;
}
export const updateGroup = (id: string, p: { name?: string; about?: string; adminsOnly?: boolean }) => after(api('/api/groups/update', { id, ...p }));
export const addMembers = (id: string, users: string[]) => after(api('/api/groups/add', { id, users }));
export const removeMember = (id: string, u: string) => after(api('/api/groups/remove', { id, u }));
export const setAdmin = (id: string, u: string, on: boolean) => after(api('/api/groups/admin', { id, u, on }));
export const leaveGroup = (id: string) => after(api('/api/groups/leave', { id }));

/** The invite link (made on first use); "reset" replaces it, "off" turns links off. */
export async function groupLink(id: string, action?: 'reset' | 'off') {
  const { link } = await api<{ link: string }>('/api/groups/link', { id, ...(action && { action }) });
  await refreshGroups();
  return link ? `${location.origin}/?group=${link}` : '';
}

export const previewGroup = (code: string) =>
  api<{ id: string; name: string; about: string; count: number; member: boolean }>('/api/groups/preview?code=' + encodeURIComponent(code));

export async function joinGroup(code: string) {
  const { group } = await after(api<{ group: Group }>('/api/groups/join', { code }));
  await openChat('g:' + group.id);
  return group;
}

export async function setGroupPhoto(id: string, file: File | null, crop?: Crop) {
  await after(api('/api/groups/photo', { id, img: file ? await squarePhoto(file, crop) : null }));
}

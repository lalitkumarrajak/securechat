import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Bell, BellOff, Camera, Link2, Lock, LogOut, Pencil, Search, UserPlus } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { LinkBox } from '../../../components/LinkBox';
import { PhotoCropper } from '../../../components/PhotoCropper';
import { pickPhoto } from '../../../lib/image';
import { setChatUi } from '../../conversation/chatUi';
import { Button, IconButton } from '@sanga/ui/button';
import { confirm } from '@sanga/ui/confirm';
import { Input, Textarea } from '@sanga/ui/input';
import { Switch } from '@sanga/ui/switch';
import { isMuted, mute } from '../../../lib/engine';
import { groupLink, leaveGroup, setGroupPhoto, updateGroup } from '../../../lib/groups';
import { type Group, type GroupMember } from '../../../lib/types';
import { setApp, useApp } from '../../../state/app';
import { Quick } from '../../conversation/Quick';
import { Row } from '../../conversation/Row';
import { MAX_GROUP } from '../groupLimits';
import { AddMembers } from './AddMembers';
import { MemberRow } from './MemberRow';
import { fail } from './fail';

export function Info({ g }: { g: Group }) {
  const me = useApp((s) => s.me!.u);
  const friends = useApp((s) => s.friends);
  useApp((s) => s.me?.mutes);
  const peer = 'g:' + g.id;
  const muted = isMuted(peer);
  const [view, setView] = useState<'info' | 'add'>('info');
  const [editing, setEditing] = useState<null | 'name' | 'about'>(null);
  const [draft, setDraft] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null); // photo being cropped
  const photo = useApp((s) => s.avatars[peer]);
  const close = () => setApp({ panel: null });
  const nameOf = (m: GroupMember) => (m.u === me ? 'You' : friends[m.u]?.name || m.n || m.u);
  const members = [...g.members].sort((a, b) => Number(b.u === me) - Number(a.u === me) || Number(b.admin) - Number(a.admin) || nameOf(a).localeCompare(nameOf(b)));

  if (view === 'add') return <AddMembers g={g} onDone={() => setView('info')} />;

  const save = async () => {
    try {
      await updateGroup(g.id, editing === 'name' ? { name: draft } : { about: draft });
      setEditing(null);
    } catch (e) { fail(e); }
  };
  const showLink = async (action?: 'reset' | 'off') => {
    if (action && !(await confirm(action === 'reset'
      ? { title: 'Reset the invite link?', description: 'The current link stops working. Anyone who has it won’t be able to join.', confirmText: 'Reset link', destructive: true }
      : { title: 'Turn off the invite link?', description: 'Nobody will be able to join with a link until you make a new one.', confirmText: 'Turn off', destructive: true }))) return;
    groupLink(g.id, action).then((l) => setLink(l || null)).catch(fail);
  };

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 bg-panel px-3">
        <IconButton label="Close" onClick={close}><ArrowLeft /></IconButton>
        <h2 className="text-lg font-semibold">Group info</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="bg-panel px-6 pt-4 pb-6 text-center">
          <div className="relative mx-auto w-fit">
            <button onClick={() => photo && setChatUi({ viewer: photo })} aria-label="View group photo" className="block rounded-full">
              <Avatar u={peer} name={g.name} size={128} />
            </button>
            {g.admin && (
              <button onClick={() => file.current?.click()} aria-label="Change group photo"
                className="absolute right-1 bottom-1 grid size-10 place-items-center rounded-full bg-accent text-white shadow-lg hover:brightness-110">
                <Camera className="size-5" />
              </button>
            )}
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => {
              const f = e.target.files?.[0]; e.target.value = '';
              if (f) pickPhoto(f).then(setPicked);
            }} />
            <PhotoCropper file={picked} title="Group photo" onCancel={() => setPicked(null)} onDone={(crop) => {
              const f = picked; setPicked(null);
              if (f) setGroupPhoto(g.id, f, crop).then(() => toast.success('Group photo updated')).catch(fail);
            }} />
          </div>
          {g.admin && g.photo > 0 && (
            <button className="mt-2 text-sm text-danger hover:underline" onClick={() => setGroupPhoto(g.id, null).catch(fail)}>Remove photo</button>
          )}
          {editing === 'name' ? (
            <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
              <Input value={draft} maxLength={60} autoFocus onChange={(e) => setDraft(e.target.value)} aria-label="Group name" />
              <Button type="submit" disabled={!draft.trim()}>Save</Button>
            </form>
          ) : (
            <h3 className="mt-4 flex items-center justify-center gap-2 text-2xl font-semibold">
              {g.name}
              {g.admin && <IconButton label="Edit group name" size="sm" onClick={() => { setDraft(g.name); setEditing('name'); }}><Pencil className="size-4" /></IconButton>}
            </h3>
          )}
          <p className="text-muted">Group · {g.members.length} members</p>
          <div className="mt-5 flex justify-center gap-3">
            <Quick icon={<Search />} label="Search" onClick={() => { close(); setApp({ searchOpen: true }); }} />
            <Quick icon={muted ? <Bell /> : <BellOff />} label={muted ? 'Unmute' : 'Mute'}
              onClick={() => mute(peer, muted ? 0 : -1).then(() => toast(muted ? 'Notifications on' : 'Muted')).catch(fail)} />
            {g.admin && <Quick icon={<UserPlus />} label="Add" onClick={() => setView('add')} />}
          </div>
        </section>

        <section className="mt-2 bg-panel px-6 py-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">Description</h4>
            {g.admin && editing !== 'about' && <button className="text-sm font-medium text-accent-ink" onClick={() => { setDraft(g.about); setEditing('about'); }}>Edit</button>}
          </div>
          {editing === 'about' ? (
            <form className="mt-2 grid gap-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
              <Textarea value={draft} maxLength={300} rows={3} autoFocus onChange={(e) => setDraft(e.target.value)} aria-label="Group description" />
              <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit">Save</Button></div>
            </form>
          ) : <p className="mt-1 whitespace-pre-wrap text-sm">{g.about || <span className="text-muted">{g.admin ? 'Add a group description' : 'No description'}</span>}</p>}
        </section>

        {g.admin && (
          <section className="mt-2 bg-panel py-2">
            <label className="flex cursor-pointer items-center gap-4 px-6 py-3">
              <Lock className="size-5 text-muted" />
              <span className="min-w-0 flex-1"><span className="block">Only admins can send messages</span>
                <span className="block text-sm text-muted">Everyone else can still read and react.</span></span>
              <Switch checked={g.adminsOnly} label="Only admins can send messages" onCheckedChange={(v) => updateGroup(g.id, { adminsOnly: v }).catch(fail)} />
            </label>
            {link ? (
              <div className="px-6 py-3">
                <p className="mb-2 text-sm font-medium">Invite link</p>
                <LinkBox url={link} title={g.name} text={`Join my group “${g.name}” on Sanga`} />
                <div className="mt-2 flex gap-4 text-sm">
                  <button className="font-medium text-accent-ink hover:underline" onClick={() => showLink('reset')}>Reset link</button>
                  <button className="font-medium text-danger hover:underline" onClick={() => showLink('off')}>Turn off link</button>
                </div>
                <p className="mt-2 text-xs text-muted">Anyone with this link can join the group, even people who aren’t your friends.</p>
              </div>
            ) : (
              <Row icon={<Link2 />} label="Invite via link" sub="Share a link anyone can use to join" onClick={() => showLink()} />
            )}
          </section>
        )}

        <section className="mt-2 bg-panel py-2">
          <h4 className="px-6 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{g.members.length} members</h4>
          {g.admin && g.members.length < MAX_GROUP && <Row icon={<UserPlus />} label="Add members" onClick={() => setView('add')} />}
          <ul>
            {members.map((m) => (
              <li key={m.u}>
                <MemberRow g={g} m={m} name={nameOf(m)} isMe={m.u === me} friend={!!friends[m.u]} />
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-2 bg-panel py-2">
          <Row icon={<Lock />} label="Encryption" sub="Messages are end-to-end encrypted. Only members can read them." />
        </section>

        <section className="mt-2 mb-6 bg-panel py-2">
          <Row icon={<LogOut />} danger label="Leave group" onClick={async () => {
            if (await confirm({ title: `Leave “${g.name}”?`, description: 'You’ll stop getting its messages. Your chat history stays on this device.', confirmText: 'Leave group', destructive: true })) {
              leaveGroup(g.id).then(() => { close(); toast(`You left “${g.name}”`); }).catch(fail);
            }
          }} />
        </section>
      </div>
    </>
  );
}

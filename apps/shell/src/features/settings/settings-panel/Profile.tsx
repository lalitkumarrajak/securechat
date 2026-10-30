import { useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Camera, Trash2 } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { PhotoCropper } from '../../../components/PhotoCropper';
import { pickPhoto } from '../../../lib/image';
import { setChatUi } from '../../conversation/chatUi';
import type { Crop } from '../../../lib/image';
import { Button, Spinner } from '@sanga/ui/button';
import { confirm } from '@sanga/ui/confirm';
import { Input, Label, Textarea } from '@sanga/ui/input';
import { removeAvatar, setAvatar, updateProfile } from '../../../lib/engine';
import { useApp } from '../../../state/app';
import { setSettings, useSettings } from '../../../state/settings';
import { Section } from './Section';

export function Profile() {
  const me = useApp((s) => s.me)!;
  const photo = useApp((s) => s.avatars[me.u]);
  const hasPhoto = !!photo;
  const [name, setName] = useState(me.name);
  const [about, setAbout] = useState(me.about);
  const savedTitle = useSettings((s) => s.headerTitle);
  const [title, setTitle] = useState(savedTitle);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [picked, setPicked] = useState<File | null>(null); // photo being cropped
  const file = useRef<HTMLInputElement>(null);
  const profileDirty = name.trim() !== me.name || about.trim() !== me.about;
  const dirty = profileDirty || title.trim() !== savedTitle;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      setSettings({ headerTitle: title.trim() });
      if (profileDirty) await updateProfile({ name: name.trim(), about: about.trim() });
      toast.success('Profile saved');
    }
    catch (err) { toast.error((err as Error).message); }
    setBusy(false);
  }
  async function upload(f: File, crop: Crop) {
    setPicked(null);
    setUploading(true);
    try { await setAvatar(f, crop); toast.success('Profile photo updated'); } catch (err) { toast.error((err as Error).message || 'Couldn’t update your photo'); }
    setUploading(false);
  }

  return (
    <>
      <Section className="px-5 py-6 text-center">
        <div className="relative mx-auto w-fit">
          <button onClick={() => (photo ? setChatUi({ viewer: photo }) : file.current?.click())} aria-label={photo ? 'View profile photo' : 'Add profile photo'} className="block rounded-full">
            <Avatar u={me.u} name={me.name} size={140} className={uploading ? 'opacity-60' : ''} />
          </button>
          {uploading && <span className="absolute inset-0 grid place-items-center text-white"><Spinner className="size-8" /></span>}
          <button onClick={() => file.current?.click()} aria-label="Change profile photo" disabled={uploading}
            className="absolute right-1 bottom-1 grid size-11 place-items-center rounded-full bg-accent text-white shadow-lg hover:brightness-110">
            <Camera className="size-5" />
          </button>
        </div>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pickPhoto(f).then(setPicked); }} />
        <PhotoCropper file={picked} title="Profile photo" onCancel={() => setPicked(null)} onDone={(crop) => picked && upload(picked, crop)} />
        <p className="mt-3 text-lg font-semibold">{me.name || me.u}</p>
        <p className="text-sm text-muted">@{me.u}{me.about ? ` · ${me.about}` : ''}</p>
        {hasPhoto && (
          <Button variant="ghost" size="sm" className="mt-3 text-danger" onClick={async () => {
            if (await confirm({ title: 'Remove profile photo?', confirmText: 'Remove', destructive: true })) {
              removeAvatar().then(() => toast('Photo removed')).catch((e) => toast.error(e.message));
            }
          }}><Trash2 className="size-4" /> Remove photo</Button>
        )}
        <p className="mt-2 text-xs text-muted">Your photo, name and about are visible to your friends.</p>
      </Section>
      <Section className="px-5 py-5">
        <form onSubmit={save} className="grid gap-4">
          <div>
            <Label htmlFor="p-name" hint={`${name.length}/40`}>Name</Label>
            <Input id="p-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={me.u} />
          </div>
          <div>
            <Label htmlFor="p-about" hint={`${about.length}/140`}>About</Label>
            <Textarea id="p-about" value={about} maxLength={140} rows={2} onChange={(e) => setAbout(e.target.value)} placeholder="Hey there! I’m using Sanga." />
          </div>
          <div>
            <Label htmlFor="p-title" hint={`${title.length}/30`}>Title at the top</Label>
            <Input id="p-title" value={title} maxLength={30} onChange={(e) => setTitle(e.target.value)} placeholder={me.u} />
            <p className="mt-1 text-xs text-muted">Shown above your chats, only to you. Leave it empty to show your username.</p>
          </div>
          <div className="flex items-center justify-between text-sm text-muted">
            <span>Username: <b className="text-ink">@{me.u}</b></span>
            <Button type="submit" disabled={!dirty} loading={busy}>Save</Button>
          </div>
        </form>
      </Section>
    </>
  );
}

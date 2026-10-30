import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { Button, IconButton } from '@sanga/ui/button';
import { Input, Label, Textarea } from '@sanga/ui/input';
import { createGroup, setGroupPhoto } from '../../lib/groups';
import { setApp } from '../../state/app';
import { FriendPicker } from './FriendPicker';
import { MAX_GROUP } from './groupLimits';

export function NewGroup() {
  const [step, setStep] = useState<'members' | 'details'>('members');
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const g = await createGroup(name.trim(), picked, about.trim());
      if (photo) await setGroupPhoto(g.id, photo).catch((e) => toast.error(e.message));
      toast.success(`Group “${g.name}” created`);
    } catch (e) { toast.error((e as Error).message); setBusy(false); }
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 bg-panel px-3">
        <IconButton label="Back" onClick={() => (step === 'details' ? setStep('members') : setApp({ panel: null }))}><ArrowLeft /></IconButton>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{step === 'members' ? 'Add group members' : 'New group'}</h2>
          {step === 'members' && <p className="text-xs text-muted">{picked.length ? `${picked.length} of ${MAX_GROUP - 1} selected` : 'Pick friends to add'}</p>}
        </div>
      </header>
      {step === 'members' ? (
        <>
          <FriendPicker picked={picked} onChange={setPicked} max={MAX_GROUP - 1} />
          <div className="shrink-0 border-t border-line p-4">
            <Button className="w-full gap-2" disabled={!picked.length} onClick={() => setStep('details')}>Next <ArrowRight className="size-4" /></Button>
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <button type="button" onClick={() => file.current?.click()} aria-label="Group photo"
            className="mx-auto grid size-28 place-items-center overflow-hidden rounded-full bg-panel-2 text-muted hover:brightness-95">
            {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <Camera className="size-8" />}
          </button>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => {
            const f = e.target.files?.[0]; e.target.value = '';
            if (f) { setPhoto(f); setPreview(URL.createObjectURL(f)); }
          }} />
          <form className="mt-5 grid gap-4" onSubmit={(e) => { e.preventDefault(); create(); }}>
            <div>
              <Label htmlFor="g-name" hint={`${name.length}/60`}>Group name</Label>
              <Input id="g-name" value={name} maxLength={60} autoFocus onChange={(e) => setName(e.target.value)} placeholder="e.g. Family" />
            </div>
            <div>
              <Label htmlFor="g-about" hint={`${about.length}/300`}>Description (optional)</Label>
              <Textarea id="g-about" value={about} maxLength={300} rows={2} onChange={(e) => setAbout(e.target.value)} />
            </div>
            <p className="text-sm text-muted">{picked.length + 1} members, including you. Messages are end-to-end encrypted.</p>
            <Button type="submit" loading={busy} disabled={!name.trim()}>Create group</Button>
          </form>
        </div>
      )}
    </>
  );
}

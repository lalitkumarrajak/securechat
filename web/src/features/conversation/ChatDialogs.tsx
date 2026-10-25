import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import * as D from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Check, Search, ShieldAlert, SmilePlus, X } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { Ticks } from '../../components/Ticks';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { EMOJI_PICKER, QUICK_REACTIONS } from '../../lib/emoji';
import { acceptNewKey, forward, preview, verifyCodes } from '../../lib/engine';
import { displayName } from '../../lib/types';
import { cn } from '../../lib/utils';
import { setApp, useApp } from '../../state/app';
import { ICONS } from './MessageBubble';
import { actionsFor, canReact, myReaction, reactTo, setChatUi, useChatUi } from './chatUi';

export function ChatDialogs({ peer, name }: { peer: string; name: string }) {
  return (
    <>
      <ActionSheet />
      <ReactionPicker />
      <ForwardDialog />
      <InfoDialog />
      <VerifyDialog peer={peer} name={name} />
      <PhotoViewer />
    </>
  );
}

/** Long-press on a phone: reactions on top, then the actions. */
function ActionSheet() {
  const m = useChatUi((s) => s.sheet);
  const close = () => setChatUi({ sheet: null });
  return (
    <Dialog open={!!m} onOpenChange={(o) => !o && close()} title="Message options" hideTitle keepFocus className="md:max-w-sm">
      {m && (
        <>
          <p className="mb-3 line-clamp-2 rounded-xl bg-panel-2 px-3 py-2 text-sm text-muted">{preview(m)}</p>
          {canReact(m) && (
            <div className="mb-3 flex items-center justify-between rounded-2xl bg-panel-2 px-2 py-1.5">
              {QUICK_REACTIONS.map((e) => (
                <button key={e} onClick={() => { reactTo(m, e); close(); }} aria-label={'React ' + e}
                  className={cn('grid size-11 place-items-center rounded-full text-2xl transition active:scale-125', myReaction(m) === e && 'bg-accent/20')}>
                  {e}
                </button>
              ))}
              <button onClick={() => setChatUi({ sheet: null, picker: m })} aria-label="More reactions" className="grid size-11 place-items-center rounded-full text-muted">
                <SmilePlus className="size-6" />
              </button>
            </div>
          )}
          <ul className="-mx-2">
            {actionsFor(m).map((a) => (
              <li key={a.key}>
                {/* Close the sheet right now (it traps focus while open), then run the action in the
                    same tap, so "Reply" can focus the message box and open the keyboard. */}
                <button onClick={() => { flushSync(close); a.run(); }} disabled={a.disabled}
                  className={cn('flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left hover:bg-hover disabled:opacity-45 disabled:hover:bg-transparent [&_svg]:size-5',
                    a.danger ? 'text-danger' : '[&_svg]:text-muted')}>
                  {ICONS[a.key]}
                  <span>{a.label}{a.hint && <span className="block text-xs text-muted">{a.hint}</span>}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}

function ReactionPicker() {
  const m = useChatUi((s) => s.picker);
  return (
    <Dialog open={!!m} onOpenChange={(o) => !o && setChatUi({ picker: null })} title="React with an emoji">
      <div className="grid max-h-80 grid-cols-8 gap-1 overflow-y-auto">
        {EMOJI_PICKER.map((e) => (
          <button key={e} onClick={() => { if (m) reactTo(m, e); setChatUi({ picker: null }); }}
            className={cn('grid aspect-square place-items-center rounded-lg text-2xl hover:bg-hover', m && myReaction(m) === e && 'bg-accent/20')}>
            {e}
          </button>
        ))}
      </div>
    </Dialog>
  );
}

function ForwardDialog() {
  const msgs = useChatUi((s) => s.forward);
  const friends = useApp((s) => s.friends);
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (msgs) { setPicked([]); setQ(''); } }, [msgs]);
  const list = useMemo(() => Object.values(friends)
    .filter((f) => !q || f.u.includes(q.toLowerCase()) || f.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => displayName(a, a.u).localeCompare(displayName(b, b.u))), [friends, q]);

  const toggle = (u: string) => setPicked((p) => (p.includes(u) ? p.filter((x) => x !== u) : p.length >= 5 ? p : [...p, u]));
  const send = async () => {
    if (!msgs) return;
    setBusy(true);
    try {
      await forward(msgs, picked);
      toast.success(`Forwarded to ${picked.length} chat${picked.length > 1 ? 's' : ''}`);
      setChatUi({ forward: null });
      setApp({ selection: null });
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  return (
    <Dialog open={!!msgs} onOpenChange={(o) => !o && setChatUi({ forward: null })} title="Forward to…" description="Choose up to 5 friends.">
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search friends"
          className="h-10 w-full rounded-xl bg-panel-2 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-accent/30" />
      </div>
      <ul className="-mx-2 max-h-72 overflow-y-auto">
        {list.map((f) => {
          const on = picked.includes(f.u);
          return (
            <li key={f.u}>
              <button onClick={() => toggle(f.u)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-hover" aria-pressed={on}>
                <Avatar u={f.u} name={f.name} size={40} />
                <span className="min-w-0 flex-1 truncate font-medium">{displayName(f, f.u)}</span>
                <span className={cn('grid size-6 place-items-center rounded-full border-2', on ? 'border-accent bg-accent text-white' : 'border-line')}>
                  {on && <Check className="size-4" strokeWidth={3} />}
                </span>
              </button>
            </li>
          );
        })}
        {!list.length && <li className="py-6 text-center text-sm text-muted">No friends to forward to.</li>}
      </ul>
      <Button className="mt-4 w-full" disabled={!picked.length} loading={busy} onClick={send}>
        Send{picked.length ? ` to ${picked.length}` : ''}
      </Button>
    </Dialog>
  );
}

function InfoDialog() {
  const m = useChatUi((s) => s.info);
  const live = useApp((s) => (m ? s.messages.find((x) => x.k === m.k) : null));
  const cur = live || m;
  const status = cur ? ['Not sent', 'Sending', 'Sent', 'Delivered', 'Read'][cur.s + 2] : '';
  return (
    <Dialog open={!!m} onOpenChange={(o) => !o && setChatUi({ info: null })} title="Message info">
      {cur && (
        <dl className="grid gap-3 text-sm">
          <div className="rounded-xl bg-panel-2 px-3 py-2 text-muted">{preview(cur)}</div>
          <div className="flex justify-between"><dt className="text-muted">Sent</dt><dd>{new Date(cur.ts).toLocaleString()}</dd></div>
          <div className="flex items-center justify-between"><dt className="text-muted">Status</dt><dd className="flex items-center gap-1.5">{status} <Ticks s={cur.s} /></dd></div>
          {cur.edited && <div className="flex justify-between"><dt className="text-muted">Edited</dt><dd>{new Date(cur.edited).toLocaleString()}</dd></div>}
          <p className="text-xs text-muted">If either of you turned off read receipts, “Read” shows as “Delivered”.</p>
        </dl>
      )}
    </Dialog>
  );
}

function VerifyDialog({ peer, name }: { peer: string; name: string }) {
  const open = useChatUi((s) => s.verify);
  const [codes, setCodes] = useState<{ current: string[]; next: string[] | null } | null>(null);
  useEffect(() => { if (open) verifyCodes(peer).then(setCodes).catch(() => setCodes(null)); }, [open, peer]);
  const Code = ({ groups }: { groups: string[] }) => (
    <div className="grid grid-cols-4 gap-x-3 gap-y-2 rounded-xl bg-panel-2 p-4 text-center font-mono text-lg font-semibold tracking-wider">
      {groups.map((g, i) => <span key={i}>{g}</span>)}
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && setChatUi({ verify: false })} title="Verify security code"
      description={`Compare these numbers with ${name}, in person or on a call. If they match, nobody is intercepting your messages.`}>
      {codes && <Code groups={codes.current} />}
      {codes?.next && (
        <div className="mt-5">
          <p className="mb-3 flex gap-2 text-sm text-danger"><ShieldAlert className="size-5 shrink-0" />
            {name}’s key changed. This happens when they sign in after resetting their account, or if someone is trying to intercept your chat. Only accept it after checking the new code with them.</p>
          <Code groups={codes.next} />
          <Button variant="danger" className="mt-4 w-full" onClick={async () => {
            await acceptNewKey(peer);
            setChatUi({ verify: false });
            toast.success('New security code accepted');
          }}>Accept new code</Button>
        </div>
      )}
    </Dialog>
  );
}

function PhotoViewer() {
  const src = useChatUi((s) => s.viewer);
  return (
    <D.Root open={!!src} onOpenChange={(o) => !o && setChatUi({ viewer: null })}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/90 animate-fade-in" />
        <D.Content className="fixed inset-0 z-50 grid place-items-center p-4 outline-none" onClick={() => setChatUi({ viewer: null })}>
          <D.Title className="sr-only">Photo</D.Title>
          <D.Description className="sr-only">Full-size photo</D.Description>
          {src && <img src={src} alt="" className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />}
          <D.Close className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Close">
            <X className="size-5" />
          </D.Close>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

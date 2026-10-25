import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft, Bell, Camera, ChevronRight, Info, KeyRound, Laptop, Lock, LogOut, MessageSquare, Monitor, MonitorSmartphone, Moon, Palette, Shield,
  Smartphone, Sun, Tablet, Trash2, UserRound, MapPin } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { Button, IconButton, Spinner } from '../../components/ui/button';
import { confirm } from '../../components/ui/confirm';
import { Panel } from '../../components/ui/dialog';
import { Input, Label, Textarea } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import {
  changePassword, disablePush, enablePush, listSessions, logout, pushSupported, removeAvatar, revokeSession, setAvatar, unblockUser, updateProfile,
} from '../../lib/engine';
import { deviceName, osVersion, parseDevice, placeName } from '../../lib/device';
import { fmtListTime } from '../../lib/format';
import type { Session } from '../../lib/types';
import { cn } from '../../lib/utils';
import { getApp, setApp, useApp } from '../../state/app';
import { PinDialog } from './PinDialog';
import { LOCK_AFTER, removeLock, setPin } from '../../lib/applock';
import { ACCENTS, setSettings, useSettings, type FontSize, type Theme, type Wallpaper } from '../../state/settings';

type Page = 'main' | 'profile' | 'appearance' | 'privacy' | 'notifications' | 'chats' | 'account' | 'sessions' | 'about';
const TITLES: Record<Page, string> = {
  main: 'Settings', profile: 'Profile', appearance: 'Appearance', privacy: 'Privacy', notifications: 'Notifications',
  chats: 'Chats', account: 'Account', sessions: 'Active sessions', about: 'About Chattrix',
};

export function SettingsPanel() {
  const open = useApp((s) => s.panel === 'settings');
  const [page, setPage] = useState<Page>('main');
  useEffect(() => {
    if (!open) return;
    setPage((getApp().settingsPage as Page) || 'main');
    setApp({ settingsPage: null });
  }, [open]);
  const close = () => setApp({ panel: null });

  return (
    <Panel open={open} onOpenChange={(o) => !o && close()} title="Settings">
      <header className="flex h-16 shrink-0 items-center gap-2 bg-panel px-3">
        <IconButton label="Back" onClick={() => (page === 'main' ? close() : setPage(page === 'sessions' ? 'account' : 'main'))}><ArrowLeft /></IconButton>
        <h2 className="text-lg font-semibold">{TITLES[page]}</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        {page === 'main' && <Main go={setPage} />}
        {page === 'profile' && <Profile />}
        {page === 'appearance' && <Appearance />}
        {page === 'privacy' && <Privacy />}
        {page === 'notifications' && <Notifications />}
        {page === 'chats' && <Chats />}
        {page === 'account' && <Account go={setPage} />}
        {page === 'sessions' && <Sessions />}
        {page === 'about' && <About />}
      </div>
    </Panel>
  );
}

function Section({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('mt-3 bg-panel', className)}>
      {title && <h3 className="px-5 pt-4 pb-1 text-xs font-semibold tracking-wide text-accent-ink uppercase">{title}</h3>}
      {children}
    </section>
  );
}

function NavRow({ icon, label, sub, onClick }: { icon: ReactNode; label: string; sub?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-hover [&>svg:first-child]:size-5 [&>svg:first-child]:text-muted">
      {icon}
      <span className="min-w-0 flex-1"><span className="block">{label}</span>{sub && <span className="block truncate text-sm text-muted">{sub}</span>}</span>
      <ChevronRight className="size-4 text-muted" />
    </button>
  );
}

function ToggleRow({ label, sub, checked, onChange, disabled }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-4 px-5 py-3.5 hover:bg-hover">
      <span className="min-w-0 flex-1"><span className="block">{label}</span>{sub && <span className="block text-sm text-muted">{sub}</span>}</span>
      <Switch checked={checked} onCheckedChange={onChange} label={label} disabled={disabled} />
    </label>
  );
}

function Main({ go }: { go: (p: Page) => void }) {
  const me = useApp((s) => s.me)!;
  return (
    <>
      <button onClick={() => go('profile')} className="flex w-full items-center gap-4 bg-panel px-5 py-5 text-left hover:bg-hover">
        <Avatar u={me.u} name={me.name} size={64} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-semibold">{me.name || me.u}</span>
          <span className="block truncate text-sm text-muted">{me.about || '@' + me.u}</span>
        </span>
        <ChevronRight className="size-4 text-muted" />
      </button>
      <Section>
        <NavRow icon={<Palette />} label="Appearance" sub="Theme, colour, wallpaper, text size" onClick={() => go('appearance')} />
        <NavRow icon={<Shield />} label="Privacy" sub="Last seen, read receipts, sign out on close, blocked" onClick={() => go('privacy')} />
        <NavRow icon={<Bell />} label="Notifications" sub="Push notifications, sounds" onClick={() => go('notifications')} />
        <NavRow icon={<MessageSquare />} label="Chats" sub="Enter to send, archived chats" onClick={() => go('chats')} />
        <NavRow icon={<MonitorSmartphone />} label="Active sessions" sub="Devices signed in to your account" onClick={() => go('sessions')} />
        <NavRow icon={<KeyRound />} label="Account" sub="Password, sign out" onClick={() => go('account')} />
        <NavRow icon={<Info />} label="About" onClick={() => go('about')} />
      </Section>
    </>
  );
}

// ---------- profile ----------
function Profile() {
  const me = useApp((s) => s.me)!;
  const hasPhoto = useApp((s) => !!s.avatars[me.u]);
  const [name, setName] = useState(me.name);
  const [about, setAbout] = useState(me.about);
  const savedTitle = useSettings((s) => s.headerTitle);
  const [title, setTitle] = useState(savedTitle);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
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
  async function upload(f?: File) {
    if (!f) return;
    setUploading(true);
    try { await setAvatar(f); toast.success('Profile photo updated'); } catch (err) { toast.error((err as Error).message); }
    setUploading(false);
  }

  return (
    <>
      <Section className="px-5 py-6 text-center">
        <div className="relative mx-auto w-fit">
          <Avatar u={me.u} name={me.name} size={140} className={uploading ? 'opacity-60' : ''} />
          <button onClick={() => file.current?.click()} aria-label="Change profile photo"
            className="absolute right-1 bottom-1 grid size-11 place-items-center rounded-full bg-accent text-white shadow-lg hover:brightness-110">
            <Camera className="size-5" />
          </button>
        </div>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
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
            <Textarea id="p-about" value={about} maxLength={140} rows={2} onChange={(e) => setAbout(e.target.value)} placeholder="Hey there! I’m using Chattrix." />
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

// ---------- appearance ----------
const THEMES: { id: Theme; label: string; icon: ReactNode }[] = [
  { id: 'system', label: 'System', icon: <Monitor className="size-5" /> },
  { id: 'light', label: 'Light', icon: <Sun className="size-5" /> },
  { id: 'dark', label: 'Dark', icon: <Moon className="size-5" /> },
];
const WALLPAPERS: { id: Wallpaper; label: string }[] = [
  { id: 'doodle', label: 'Doodle' }, { id: 'dots', label: 'Dots' }, { id: 'grid', label: 'Grid' },
  { id: 'gradient', label: 'Gradient' }, { id: 'plain', label: 'Plain' },
];
const FONTS: { id: FontSize; label: string }[] = [{ id: 'sm', label: 'Small' }, { id: 'md', label: 'Medium' }, { id: 'lg', label: 'Large' }];

function Appearance() {
  const s = useSettings();
  return (
    <>
      <Section className="px-5 py-5">
        {/* Live preview of the current choices */}
        <div className={`wallpaper wp-${s.wallpaper} overflow-hidden rounded-2xl border border-line p-3`} aria-label="Preview">
          <div className="mb-2 flex justify-start"><span className="rounded-2xl rounded-bl-md bg-bubble-in px-3 py-1.5 text-[0.95rem] shadow-bubble">Hey! How do I look? 👋</span></div>
          <div className="flex justify-end"><span className="rounded-2xl rounded-br-md bg-bubble-out px-3 py-1.5 text-[0.95rem] shadow-bubble">Looking great ✨</span></div>
        </div>
      </Section>

      <Section title="Theme" className="px-5 pb-5">
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button key={t.id} role="radio" aria-checked={s.theme === t.id} onClick={() => setSettings({ theme: t.id })}
              className={cn('flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 text-sm font-medium transition',
                s.theme === t.id ? 'border-accent bg-accent/10 text-accent-ink' : 'border-line hover:bg-hover')}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Accent colour" className="px-5 pb-5">
        <div className="mt-2 flex flex-wrap gap-3" role="radiogroup" aria-label="Accent colour">
          {ACCENTS.map((a) => (
            <button key={a.id} role="radio" aria-checked={s.accent === a.id} aria-label={a.label} title={a.label}
              onClick={() => setSettings({ accent: a.id })}
              className={cn('size-10 rounded-full ring-offset-2 ring-offset-panel transition', s.accent === a.id ? 'ring-3' : 'hover:scale-110')}
              style={{ background: a.color, ['--tw-ring-color' as string]: a.color }} />
          ))}
        </div>
      </Section>

      <Section title="Chat wallpaper" className="px-5 pb-5">
        <div className="mt-2 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Chat wallpaper">
          {WALLPAPERS.map((w) => (
            <button key={w.id} role="radio" aria-checked={s.wallpaper === w.id} onClick={() => setSettings({ wallpaper: w.id })} className="text-center">
              <span className={cn(`wallpaper wp-${w.id} block aspect-[3/4] rounded-xl border-2 transition`, s.wallpaper === w.id ? 'border-accent' : 'border-line')} />
              <span className="mt-1 block text-xs text-muted">{w.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Text size" className="px-5 pb-5">
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Text size">
          {FONTS.map((f, i) => (
            <button key={f.id} role="radio" aria-checked={s.fontSize === f.id} onClick={() => setSettings({ fontSize: f.id })}
              className={cn('rounded-xl border-2 py-2.5 font-medium transition', s.fontSize === f.id ? 'border-accent bg-accent/10 text-accent-ink' : 'border-line hover:bg-hover')}
              style={{ fontSize: 13 + i * 2 }}>
              {f.label}
            </button>
          ))}
        </div>
      </Section>
    </>
  );
}

// ---------- privacy ----------
function Privacy() {
  const me = useApp((s) => s.me)!;
  const blocked = useApp((s) => s.blocked);
  const signOutOnClose = useSettings((s) => s.signOutOnClose);
  const set = (privacy: Partial<typeof me.privacy>) => updateProfile({ privacy }).catch((e) => toast.error(e.message));
  return (
    <>
      <Section title="Who can see">
        <ToggleRow label="Last seen & online" sub="If you turn this off, you won’t see other people’s either."
          checked={me.privacy.lastSeen} onChange={(v) => set({ lastSeen: v })} />
        <ToggleRow label="Read receipts" sub="If you turn this off, you won’t send or see blue ticks."
          checked={me.privacy.receipts} onChange={(v) => set({ receipts: v })} />
      </Section>
      <AppLockSection />
      <Section title="On this device">
        <ToggleRow label="Sign out when I close the tab"
          sub="For shared computers or a quick exit: closing Chattrix signs you out and erases chats saved on this device. Reloading keeps you signed in. Your chats come back when you sign in again."
          checked={signOutOnClose} onChange={(v) => {
            setSettings({ signOutOnClose: v });
            toast(v ? 'You’ll be signed out when you close this tab' : 'You’ll stay signed in on this device');
          }} />
      </Section>
      <Section title={`Blocked (${blocked.length})`}>
        {!blocked.length && <p className="px-5 py-4 text-sm text-muted">You haven’t blocked anyone.</p>}
        <ul>
          {blocked.map((u) => (
            <li key={u} className="flex items-center gap-3 px-5 py-2.5">
              <Avatar u={u} size={40} />
              <span className="flex-1 truncate">@{u}</span>
              <Button size="sm" variant="outline" onClick={() => unblockUser(u).then(() => toast(`@${u} unblocked`)).catch((e) => toast.error(e.message))}>Unblock</Button>
            </li>
          ))}
        </ul>
      </Section>
      <Section className="px-5 py-4">
        <p className="flex gap-3 text-sm text-muted"><Lock className="size-5 shrink-0 text-accent-ink" />
          Messages, photos, voice notes, reactions and edits are end-to-end encrypted. Your profile photo, name and friend list are not.</p>
      </Section>
    </>
  );
}

function AppLockSection() {
  const enabled = useSettings((s) => !!s.appLock);
  const after = useSettings((s) => s.lockAfterMs);
  const [dialog, setDialog] = useState<null | 'set' | 'change' | 'off'>(null);
  return (
    <Section title="App lock">
      <ToggleRow label="Lock with a PIN" sub="Ask for a PIN whenever Chattrix is opened on this device."
        checked={enabled} onChange={(v) => setDialog(v ? 'set' : 'off')} />
      {enabled && (
        <>
          <div className="px-5 pt-1 pb-3" role="radiogroup" aria-label="Lock automatically">
            <p className="mb-2 text-sm text-muted">Lock automatically when I leave Chattrix</p>
            <div className="flex flex-wrap gap-2">
              {LOCK_AFTER.map((o) => (
                <button key={o.ms} role="radio" aria-checked={after === o.ms} onClick={() => setSettings({ lockAfterMs: o.ms })}
                  className={cn('rounded-full border px-3 py-1.5 text-sm', after === o.ms ? 'border-accent bg-accent/12 font-medium text-accent-ink' : 'border-line hover:bg-hover')}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setDialog('change')} className="w-full px-5 py-3.5 text-left hover:bg-hover">Change PIN</button>
        </>
      )}
      {dialog && (
        <PinDialog mode={dialog === 'set' ? 'set' : dialog === 'change' ? 'change' : 'verify'} onClose={() => setDialog(null)}
          onDone={async (pin) => {
            if (dialog === 'off') { removeLock(); toast('App lock off'); }
            else { await setPin(pin); toast.success(dialog === 'set' ? 'App lock on' : 'PIN changed', { description: dialog === 'set' ? 'Tap the lock at the top to lock Chattrix right away.' : undefined }); }
            setDialog(null);
          }} />
      )}
    </Section>
  );
}

// ---------- notifications ----------
function Notifications() {
  const push = useSettings((s) => s.push);
  const sound = useSettings((s) => s.sound);
  const [busy, setBusy] = useState(false);
  async function togglePush(on: boolean) {
    setBusy(true);
    try {
      if (on) { await enablePush(); toast.success('Push notifications on'); }
      else { await disablePush(); toast('Push notifications off'); }
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }
  return (
    <>
      <Section>
        <ToggleRow label="Push notifications" sub="Get notified even when Chattrix is closed. Notifications never include message text."
          checked={push} onChange={togglePush} disabled={busy} />
        <ToggleRow label="Sounds" sub="Play a sound for new messages while the app is open." checked={sound} onChange={(v) => setSettings({ sound: v })} />
      </Section>
      {!pushSupported() && (
        <Section className="px-5 py-4"><p className="text-sm text-muted">
          This browser doesn’t support push notifications here. On iPhone, add Chattrix to your Home Screen first (Share → Add to Home Screen), then turn them on.
        </p></Section>
      )}
      <Section className="px-5 py-4"><p className="text-sm text-muted">Mute a single chat from its menu (⋮ → Mute notifications).</p></Section>
    </>
  );
}

// ---------- chats ----------
function Chats() {
  const enter = useSettings((s) => s.enterToSend);
  const archived = useApp((s) => s.chats.filter((c) => c.archived && c.ts).length);
  return (
    <Section>
      <ToggleRow label="Enter to send" sub="Enter sends the message; Shift+Enter adds a new line." checked={enter} onChange={(v) => setSettings({ enterToSend: v })} />
      <NavRow icon={<MessageSquare />} label="Archived chats" sub={`${archived} archived`} onClick={() => setApp({ panel: 'archived' })} />
    </Section>
  );
}

// ---------- account ----------
function Account({ go }: { go: (p: Page) => void }) {
  const me = useApp((s) => s.me)!;
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (next.length < 8) return setError('Use at least 8 characters.');
    if (next !== next2) return setError('The new passwords don’t match.');
    setBusy(true);
    try {
      await changePassword(cur, next);
      setCur(''); setNext(''); setNext2('');
      toast.success('Password changed', { description: 'Your other devices were signed out.' });
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  return (
    <>
      <Section title="Change password" className="px-5 pb-5">
        <form onSubmit={submit} className="mt-3 grid gap-3">
          <input type="text" autoComplete="username" value={me.u} readOnly hidden />
          <div><Label htmlFor="pw-cur">Current password</Label><Input id="pw-cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></div>
          <div><Label htmlFor="pw-new">New password</Label><Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /></div>
          <div><Label htmlFor="pw-new2">Confirm new password</Label><Input id="pw-new2" type="password" autoComplete="new-password" value={next2} onChange={(e) => setNext2(e.target.value)} required /></div>
          {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <p className="text-xs text-muted">Your messages stay readable: your encryption key is re-locked with the new password on this device.</p>
          <Button type="submit" loading={busy} disabled={!cur || !next}>Change password</Button>
        </form>
      </Section>
      <Section>
        <NavRow icon={<MonitorSmartphone />} label="Active sessions" sub="See where you’re signed in and sign out devices" onClick={() => go('sessions')} />
      </Section>
      <Section>
        <button onClick={async () => {
          if (await confirm({ title: 'Sign out?', description: 'Messages stored on this device will be removed.', confirmText: 'Sign out', destructive: true })) logout();
        }} className="flex w-full items-center gap-4 px-5 py-3.5 text-left text-danger hover:bg-hover"><LogOut className="size-5" /> Sign out</button>
        <button onClick={async () => {
          if (await confirm({ title: 'Sign out of all devices?', description: 'Every phone and browser signed in to your account will be signed out, including this one.', confirmText: 'Sign out everywhere', destructive: true })) logout(true);
        }} className="flex w-full items-center gap-4 px-5 py-3.5 text-left text-danger hover:bg-hover"><UserRound className="size-5" /> Sign out of all devices</button>
      </Section>
    </>
  );
}

// ---------- active sessions ----------
function Sessions() {
  const [list, setList] = useState<Session[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => listSessions().then(setList).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);

  async function signOut(s: Session) {
    if (!(await confirm({ title: `Sign out ${deviceName(s.ua, s.device)}?`, description: 'That device will be signed out right away. Messages stored on it stay there until someone signs in again.', confirmText: 'Sign out', destructive: true }))) return;
    setBusy(s.id);
    try { await revokeSession(s.id); toast.success('Device signed out'); await load(); } catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  }
  async function signOutOthers() {
    const others = (list || []).filter((s) => !s.current);
    if (!(await confirm({ title: `Sign out ${others.length} other device${others.length > 1 ? 's' : ''}?`, description: 'You’ll stay signed in on this device.', confirmText: 'Sign out others', destructive: true }))) return;
    setBusy('others');
    try { for (const s of others) await revokeSession(s.id); toast.success('Other devices signed out'); await load(); } catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  }

  if (!list) return <div className="grid place-items-center py-16 text-accent"><Spinner className="size-6" /></div>;
  const others = list.filter((s) => !s.current);
  return (
    <>
      <Section className="px-5 py-4">
        <p className="text-sm text-muted">These devices are signed in to your account. If you don’t recognise one, sign it out and change your password.</p>
        <p className="mt-2 text-xs text-muted">Locations are approximate, worked out from each device’s internet address (IP).</p>
      </Section>
      <Section title="This device"><ul>{list.filter((s) => s.current).map((s) => <SessionRow key={s.id} s={s} />)}</ul></Section>
      <Section title={`Other devices (${others.length})`}>
        {!others.length && <p className="px-5 py-4 text-sm text-muted">You’re not signed in anywhere else.</p>}
        <ul>
          {others.map((s) => (
            <SessionRow key={s.id} s={s}>
              <Button size="sm" variant="outline" className="text-danger" loading={busy === s.id} onClick={() => signOut(s)}>Sign out</Button>
            </SessionRow>
          ))}
        </ul>
        {others.length > 1 && (
          <div className="px-5 pt-1 pb-4">
            <Button variant="danger" className="w-full" loading={busy === 'others'} onClick={signOutOthers}><LogOut className="size-4" /> Sign out all other devices</Button>
          </div>
        )}
      </Section>
    </>
  );
}

function SessionRow({ s, children }: { s: Session; children?: ReactNode }) {
  const d = parseDevice(s.ua);
  const Icon = d?.kind === 'phone' ? Smartphone : d?.kind === 'tablet' ? Tablet : d ? Laptop : MonitorSmartphone;
  const active = s.current || s.online;
  const place = placeName(s.loc);
  const detail = s.device?.model ? osVersion(s.ua, s.device) : ''; // model in the title: OS version here
  return (
    <li className="flex items-center gap-4 px-5 py-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent/12 text-accent-ink"><Icon className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{deviceName(s.ua, s.device)}</span>
        <span className={cn('block truncate text-sm', active ? 'text-accent-ink' : 'text-muted')}>
          {s.current ? 'This device · active now' : s.online ? 'Active now' : s.lastSeen ? `Last active ${fmtListTime(s.lastSeen).toLowerCase()}` : 'Last active: unknown'}
        </span>
        {(place || detail) && (
          <span className="mt-0.5 flex items-center gap-1 truncate text-sm">
            {place && <MapPin className="size-3.5 shrink-0 text-muted" />}
            <span className="truncate">{[place, detail].filter(Boolean).join(' · ')}</span>
          </span>
        )}
        <span className="block truncate text-xs text-muted">
          {s.created ? `Signed in ${new Date(s.created).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : 'Signed in before session details were recorded'}
          {s.ip && ` · IP ${s.ip}`}{s.loc?.isp && ` · ${s.loc.isp}`}
        </span>
      </span>
      {children}
    </li>
  );
}

function About() {
  return (
    <Section className="px-5 py-6 text-center">
      <img src="/logo-mark.png" alt="" className="mx-auto size-16 rounded-2xl" />
      <h3 className="mt-3 text-xl font-semibold">Chattrix</h3>
      <p className="text-sm text-muted">Version 2.0</p>
      <p className="mx-auto mt-4 max-w-xs text-sm text-muted">
        Private messaging with friends. Messages are encrypted on your device with keys only you and your friend have.
      </p>
    </Section>
  );
}

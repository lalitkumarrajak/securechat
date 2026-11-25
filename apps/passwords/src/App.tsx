// Passwords: your logins, each with its site link, username and password. Copy the username or the
// password, or open the site, in one tap from the list; tap a login to see or change it. Sealed
// end-to-end (see store.ts). A separate Sanga app, opened from More; it also runs on its own at
// /apps/passwords/.
import { t, useI18n } from '@sanga/i18n';
import { UI_DICTS } from '@sanga/ui/locale';
import { PASSWORDS_DICTS } from './locale';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, KeyRound, Plus, Search, WifiOff } from 'lucide-react';
import { Button, IconButton } from '@sanga/ui/button';
import { Input } from '@sanga/ui/input';
import { sdk, type AppProps } from '@sanga/sdk';
import { host, liveLogins, matches, newLogin, startPasswords, usePasswords, type Login } from './store';
import { CopyButton, OpenButton } from './actions';
import { LoginSheet } from './LoginSheet';

const COLORS = ['#0ea5e9', '#6366f1', '#f59e0b', '#10b981', '#ec4899', '#ef4444', '#8b5cf6', '#14b8a6'];
const colorOf = (s: string) => COLORS[[...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length];

function PasswordsAppInner({ onClose, tab }: AppProps) {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Login | null>(null);
  const online = sdk().useOnline();
  const loaded = usePasswords((s) => s.loaded);
  const failed = usePasswords((s) => s.failed);
  const map = usePasswords((s) => s.logins);
  const all = useMemo(() => liveLogins({ logins: map, loaded, failed }), [map, loaded, failed]);
  const shown = useMemo(() => all.filter((x) => matches(x, q)), [all, q]);

  useEffect(() => { void startPasswords().catch(() => {}); }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-bg">
      <header className="flex h-16 shrink-0 items-center gap-1 px-3">
        {!tab && <IconButton label={t('Back')} onClick={onClose}><ArrowLeft /></IconButton>}
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight">{t('Passwords')}</h1>
        <IconButton label={t('Add a password')} onClick={() => setEditing(newLogin())}><Plus /></IconButton>
      </header>
      {!online && <p className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-warn-bg px-3 py-2 text-sm"><WifiOff className="size-4" />{t('Offline. Changes are saved and sent when you’re back.')}</p>}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-3 pt-1 pb-24 md:px-5 md:pb-8">
          {!loaded ? <p className="py-10 text-center text-muted" role="status">{t('Loading…')}</p> /* i18n-ok */
            : failed && !all.length ? <p className="py-10 text-center text-muted" role="alert">{t('Couldn’t open your passwords on this device.')}</p>
            : !all.length ? (
              <div className="rounded-3xl border border-line/70 bg-panel p-6 text-center shadow-sm">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent/15 text-accent"><KeyRound className="size-7" /></span>
                <h3 className="mt-3 text-lg font-bold">{t('Your passwords, in one place')}</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{t('Save a site’s link, username and password. Copy them or open the site in one tap. Only your devices can read them.')}</p>
                <Button className="mt-5" onClick={() => setEditing(newLogin())}><Plus className="size-4" />{t('Add a password')}</Button>
              </div>
            ) : (
              <>
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
                  <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search')} aria-label={t('Search passwords')} className="pl-9" />
                </div>
                {!shown.length ? <p className="py-8 text-center text-sm text-muted">{t('Nothing matches “{q}”.', { q: q.trim() })}</p> : (
                  <ul className="divide-y divide-line/70 overflow-hidden rounded-3xl border border-line/70 bg-panel shadow-sm">
                    {shown.map((x) => <Row key={x.id} x={x} onOpen={() => setEditing(x)} />)}
                  </ul>
                )}
              </>
            )}
        </div>
      </div>

      <LoginSheet login={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function Row({ x, onOpen }: { x: Login; onOpen: () => void }) {
  const name = x.title || host(x.url) || x.username || t('Untitled');
  const sub = [host(x.url), x.username].filter(Boolean).join(' · ');
  return (
    <li className="flex items-center gap-1 pr-2">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-hover">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl text-lg font-bold text-white uppercase" style={{ background: colorOf(name) }} aria-hidden>{[...name][0]}</span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{name}</span>
          {sub && <span className="block truncate text-sm text-muted">{sub}</span>}
        </span>
      </button>
      {x.username && <CopyButton kind="username" value={x.username} />}
      {x.password && <CopyButton kind="password" value={x.password} />}
      <OpenButton url={x.url} />
    </li>
  );
}

/** Its words (and the UI kit's) for the language now on come first. */
export default function PasswordsApp(props: AppProps) {
  useI18n({ ...PASSWORDS_DICTS, ...UI_DICTS });
  return <PasswordsAppInner {...props} />;
}

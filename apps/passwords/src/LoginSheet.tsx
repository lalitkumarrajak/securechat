// One login: its name, site link, username, password (hidden until you show it) and notes. Copy
// either, open the site, make up a strong password, or remove it.
import { useState } from 'react';
import { Eye, EyeOff, Wand2 } from 'lucide-react';
import { Button, IconButton } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label, Textarea } from '@sanga/ui/input';
import { t } from '@sanga/i18n';
import { sdk } from '@sanga/sdk';
import { generate, href, LIMITS, removeLogin, saveLogin, usePasswords, type Login } from './store';
import { CopyButton, OpenButton } from './actions';

export function LoginSheet({ login, onClose }: { login: Login | null; onClose: () => void }) {
  if (!login) return null;
  return <Form key={login.id} l0={login} onClose={onClose} />;
}

function Form({ l0, onClose }: { l0: Login; onClose: () => void }) {
  const [l, setL] = useState(l0);
  const [show, setShow] = useState(false);
  const set = (p: Partial<Login>) => setL({ ...l, ...p });
  const cur = usePasswords.getState().logins[l.id];
  const exists = !!cur && !cur.deleted;
  const urlOk = !l.url?.trim() || !!href(l.url);
  const ok = (!!l.title.trim() || !!l.url?.trim()) && urlOk && (!!l.username?.trim() || !!l.password);
  const changed = JSON.stringify(l) !== JSON.stringify(l0);

  const submit = () => {
    if (!ok) return;
    void saveLogin({ ...l, title: l.title.trim(), url: l.url?.trim() || undefined, username: l.username?.trim() || undefined, notes: l.notes?.trim() || undefined });
    onClose();
  };
  const remove = async () => {
    if (!(await sdk().confirm({ title: t('Remove this password?'), description: t('It goes from all your devices.'), confirmText: t('Remove'), destructive: true }))) return;
    await removeLogin(l0);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={exists ? (l0.title || t('Password')) : t('Add a password')}>
      <form className="grid gap-4" autoComplete="off" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div><Label htmlFor="p-title">{t('Name')}</Label>
          <Input id="p-title" autoFocus={!exists} maxLength={LIMITS.title} value={l.title} onChange={(e) => set({ title: e.target.value })} placeholder={t('e.g. Gmail')} /></div>

        <div><Label htmlFor="p-url" hint={t('optional')}>{t('Link')}</Label>
          <div className="flex gap-1">
            <Input id="p-url" type="url" inputMode="url" autoCapitalize="none" spellCheck={false} maxLength={LIMITS.url} value={l.url ?? ''} onChange={(e) => set({ url: e.target.value || undefined })} placeholder="https://example.com" />
            {urlOk && <OpenButton url={l.url} className="shrink-0" />}
          </div>
          {!urlOk && <p className="mt-1 text-sm text-danger" role="alert">{t('That isn’t a web link.')}</p>}
        </div>

        <div><Label htmlFor="p-user">{t('Username or email')}</Label>
          <div className="flex gap-1">
            <Input id="p-user" autoCapitalize="none" spellCheck={false} autoComplete="off" maxLength={LIMITS.username} value={l.username ?? ''} onChange={(e) => set({ username: e.target.value || undefined })} />
            {l.username && <CopyButton kind="username" value={l.username} className="shrink-0" />}
          </div>
        </div>

        <div><Label htmlFor="p-pass">{t('Password')}</Label>
          <div className="flex gap-1">
            <Input id="p-pass" type={show ? 'text' : 'password'} autoCapitalize="none" spellCheck={false} autoComplete="new-password" maxLength={LIMITS.password}
              className="font-mono" value={l.password ?? ''} onChange={(e) => set({ password: e.target.value || undefined })} />
            <IconButton label={show ? t('Hide password') : t('Show password')} className="shrink-0" onClick={() => setShow(!show)}>{show ? <EyeOff /> : <Eye />}</IconButton>
            {l.password && <CopyButton kind="password" value={l.password} className="shrink-0" />}
          </div>
          <Button variant="ghost" size="sm" className="mt-1 -ml-2 text-accent" onClick={() => { set({ password: generate() }); setShow(true); }}><Wand2 className="size-4" />{t('Make a strong password')}</Button>
        </div>

        <div><Label htmlFor="p-notes" hint={t('optional')}>{t('Notes')}</Label>
          <Textarea id="p-notes" rows={2} maxLength={LIMITS.notes} value={l.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} /></div>

        <div className="flex items-center gap-2">
          {exists && <Button variant="ghost" className="text-danger" onClick={() => void remove()}>{t('Remove')}</Button>}
          <Button type="submit" className="ml-auto" disabled={!ok || (exists && !changed)}>{exists ? t('Save') : t('Add')}</Button>
        </div>
      </form>
    </Dialog>
  );
}

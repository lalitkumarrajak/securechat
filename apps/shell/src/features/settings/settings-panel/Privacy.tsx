import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { Button } from '@sanga/ui/button';
import { unblockUser, updateProfile } from '../../../lib/engine';
import { useApp } from '../../../state/app';
import { setSettings, useSettings } from '../../../state/settings';
import { AppLockSection } from './AppLockSection';
import { PrivacyScreenSection } from './PrivacyScreenSection';
import { Section } from './Section';
import { ToggleRow } from './ToggleRow';

export function Privacy() {
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
      <PrivacyScreenSection />
      <Section title="On this device">
        <ToggleRow label="Sign out when I close the tab"
          sub="For shared computers or a quick exit: closing Sanga signs you out and erases chats saved on this device. Reloading keeps you signed in. Your chats come back when you sign in again."
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

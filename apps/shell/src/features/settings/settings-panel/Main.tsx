import { ChevronRight, Bell, Info, KeyRound, MessageSquare, MonitorSmartphone, Palette, Shield } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { useApp } from '../../../state/app';
import { NavRow } from './NavRow';
import { Section } from './Section';
import type { Page } from './types';

export function Main({ go }: { go: (p: Page) => void }) {
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
        <NavRow icon={<Shield />} label="Privacy" sub="Last seen, read receipts, app lock, privacy screen, blocked" onClick={() => go('privacy')} />
        <NavRow icon={<Bell />} label="Notifications" sub="Push notifications, sounds" onClick={() => go('notifications')} />
        <NavRow icon={<MessageSquare />} label="Chats" sub="Enter to send, archived chats" onClick={() => go('chats')} />
        <NavRow icon={<MonitorSmartphone />} label="Active sessions" sub="Devices signed in to your account" onClick={() => go('sessions')} />
        <NavRow icon={<KeyRound />} label="Account" sub="Password, sign out" onClick={() => go('account')} />
        <NavRow icon={<Info />} label="About" onClick={() => go('about')} />
      </Section>
    </>
  );
}

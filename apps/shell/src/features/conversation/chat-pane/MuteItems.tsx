import { toast } from 'sonner';
import { Bell, BellOff } from 'lucide-react';
import { MenuItem, MenuSub, MenuSubContent, MenuSubTrigger } from '@sanga/ui/menu';
import { isMuted, mute } from '../../../lib/engine';
import { useApp } from '../../../state/app';

export const MuteItems = ({ peer }: { peer: string }) => {
  useApp((s) => s.me?.mutes);
  const doMute = (until: number, label: string) => mute(peer, until).then(() => toast(label)).catch((e) => toast.error(e.message));
  return isMuted(peer) ? (
    <MenuItem icon={<Bell />} onSelect={() => doMute(0, 'Notifications on')}>Unmute</MenuItem>
  ) : (
    <MenuSub>
      <MenuSubTrigger icon={<BellOff />}>Mute notifications</MenuSubTrigger>
      <MenuSubContent>
        <MenuItem onSelect={() => doMute(Date.now() + 8 * 3600e3, 'Muted for 8 hours')}>8 hours</MenuItem>
        <MenuItem onSelect={() => doMute(Date.now() + 7 * 864e5, 'Muted for 1 week')}>1 week</MenuItem>
        <MenuItem onSelect={() => doMute(-1, 'Muted')}>Always</MenuItem>
      </MenuSubContent>
    </MenuSub>
  );
};

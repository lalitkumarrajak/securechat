import { useEffect, useState } from 'react';
import { isGroupCall, type Call, type Member } from '../../../lib/calls';
import { fmtDuration } from '@sanga/ui/format';
import { displayName } from '../../../lib/types';
import { useApp } from '../../../state/app';

export function useNames() {
  const friends = useApp((s) => s.friends);
  return (u: string) => displayName(friends[u], u);
}

export function joinNames(names: string[]) {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function status(c: Call, now: number) {
  if (c.phase === 'ended') return c.ended || 'Call ended';
  if (c.phase === 'incoming') return `Incoming ${c.members.length > 1 ? 'group ' : ''}${c.video ? 'video' : 'voice'} call`;
  if (c.phase === 'outgoing') return c.ringing ? 'Ringing…' : 'Calling…';
  if (!isGroupCall(c) && c.members[0]?.state === 'reconnecting') return 'Reconnecting…';
  if (c.phase === 'connecting' || !c.started) return 'Connecting…';
  return fmtDuration((now - c.started) / 1000);
}

export function useNow(on: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [on]);
  return now;
}

/** Whether to show someone's picture: their camera in a video call, or their shared screen. */
export const showsVideo = (c: Call, m: Member, s?: MediaStream) => !!s?.getVideoTracks().length && m.state === 'connected' && (!!m.sharing || (c.video && !m.camOff));

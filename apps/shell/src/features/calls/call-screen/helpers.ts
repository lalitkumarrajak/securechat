import { useEffect, useState } from 'react';
import { isGroupCall, type Call, type Member } from '../../../lib/calls';
import { fmtDuration } from '@sanga/ui/format';
import { displayName } from '../../../lib/types';
import { useApp } from '../../../state/app';
import { t } from '@sanga/i18n';

export function useNames() {
  const friends = useApp((s) => s.friends);
  return (u: string) => displayName(friends[u], u);
}

export function joinNames(names: string[]) {
  return names.length <= 1 ? names.join('') : t('{names} and {last}', { names: names.slice(0, -1).join(', '), last: names[names.length - 1] });
}

export function status(c: Call, now: number) {
  if (c.phase === 'ended') return c.ended ? t(c.ended) : t('Call ended'); // c.ended: English from lib/calls (finish labels)
  if (c.phase === 'incoming') return c.members.length > 1 ? (c.video ? t('Incoming group video call') : t('Incoming group voice call')) : c.video ? t('Incoming video call') : t('Incoming voice call');
  if (c.phase === 'outgoing') return c.ringing ? t('Ringing…') : t('Calling…');
  if (!isGroupCall(c) && c.members[0]?.state === 'reconnecting') return t('Reconnecting…');
  if (c.phase === 'connecting' || !c.started) return t('Connecting…');
  return fmtDuration((now - c.started) / 1000);
}

export function useNow(on: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!on) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [on]);
  return now;
}

/** Whether to show someone's picture: their camera in a video call, or their shared screen. */
export const showsVideo = (c: Call, m: Member, s?: MediaStream) => !!s?.getVideoTracks().length && m.state === 'connected' && (!!m.sharing || (c.video && !m.camOff));

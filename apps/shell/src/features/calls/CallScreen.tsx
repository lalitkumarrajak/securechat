// The call screen: an incoming call to answer or decline, then the call itself. With one other person:
// their video full screen and yours in a corner, or their photo for a voice call. With more: a grid
// of everyone. Mute, camera, screen sharing, adding people and hang-up along the bottom.
// It can shrink to a bar at the top, so you can keep chatting during a call. pointer-events-auto: an
// open panel or dialog underneath makes the rest of the page untappable, but never the call.
import { useCall } from '../../lib/calls';
import { RemoteAudio } from './call-screen/RemoteAudio';
import { Full } from './call-screen/Full';
import { CallBar } from './call-screen/CallBar';

export function CallScreen() {
  const call = useCall((s) => s.call);
  const remotes = useCall((s) => s.remotes);
  const minimized = useCall((s) => s.minimized);
  if (!call) return null;
  return (
    <>
      {/* their voices, always playing, whether the screen is big or small */}
      {Object.entries(remotes).map(([u, s]) => <RemoteAudio key={u} stream={s} />)}
      {minimized && call.phase !== 'incoming' ? <CallBar call={call} /> : <Full call={call} />}
    </>
  );
}

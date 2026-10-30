import { Mic, MicOff, MonitorUp, Phone, PhoneOff, Video } from 'lucide-react';
import { hangUp, isGroupCall, setMinimized, toggleMute, type Call } from '../../../lib/calls';
import { useNames, status, useNow } from './helpers';

/** The minimised call: a bar over the top of the app. */
export function CallBar({ call }: { call: Call }) {
  const nameOf = useNames();
  const now = useNow(call.phase === 'active');
  const name = isGroupCall(call) ? `Group call · ${call.members.length + 1} people` : nameOf(call.peer);
  return (
    <div className="pointer-events-auto fixed inset-x-0 top-0 z-[60] flex items-center gap-3 bg-green-600 px-4 pt-[max(0.4rem,env(safe-area-inset-top))] pb-1.5 text-sm text-white shadow-lg">
      <button onClick={() => setMinimized(false)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-label="Return to call">
        {call.video ? <Video className="size-4 shrink-0" /> : <Phone className="size-4 shrink-0" />}
        <span className="truncate font-medium">{name}</span>
        <span className="text-white/85">· {status(call, now)}</span>
        {call.sharing && <MonitorUp className="size-4 shrink-0" aria-label="Sharing your screen" />}
      </button>
      <button onClick={toggleMute} aria-label={call.muted ? 'Unmute' : 'Mute'} aria-pressed={call.muted} className="rounded-full p-1.5 hover:bg-white/15">
        {call.muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
      </button>
      <button onClick={hangUp} aria-label="End call" className="rounded-full bg-red-500 p-1.5"><PhoneOff className="size-4" /></button>
    </div>
  );
}

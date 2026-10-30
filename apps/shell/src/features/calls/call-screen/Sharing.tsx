import { MonitorUp } from 'lucide-react';
import { stopSharing, type Call } from '../../../lib/calls';

/** Who's sharing a screen, and a way to stop mine. */
export function Sharing({ call, nameOf }: { call: Call; nameOf: (u: string) => string }) {
  if (call.phase !== 'active') return null;
  return (
    <>
      {call.members.filter((m) => m.sharing).map((m) => (
        <p key={m.u} className="mx-auto mt-2 w-fit rounded-full bg-black/40 px-3 py-1 text-xs">{nameOf(m.u)} is sharing their screen</p>
      ))}
      {call.sharing && (
        <p className="mx-auto mt-2 flex w-fit items-center gap-2 rounded-full bg-sky-500/90 py-1 pr-1 pl-3 text-xs font-medium">
          <MonitorUp className="size-3.5" /> You’re sharing your screen
          <button onClick={() => void stopSharing()} className="rounded-full bg-white/25 px-2.5 py-0.5 hover:bg-white/35">Stop</button>
        </p>
      )}
    </>
  );
}

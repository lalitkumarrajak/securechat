import { useCall, type Call, type Member } from '../../../lib/calls';
import { useApp } from '../../../state/app';
import { showsVideo } from './helpers';
import { Tile } from './Tile';

const stateLabel = (m: Member) =>
  m.state === 'ringing' ? 'Ringing…' : m.state === 'connecting' ? 'Connecting…' : m.state === 'reconnecting' ? 'Reconnecting…' : m.sharing ? 'Sharing screen' : '';

/** A group call: a tile for everyone, me last. */
export function Grid({ call, nameOf }: { call: Call; nameOf: (u: string) => string }) {
  const remotes = useCall((s) => s.remotes);
  const local = useCall((s) => s.local);
  const screen = useCall((s) => s.screen);
  const me = useApp((s) => s.me!);
  return (
    <div className="relative z-10 mx-auto grid min-h-0 w-full max-w-5xl flex-1 grid-cols-2 grid-rows-2 gap-2 p-3" role="list" aria-label="People on the call">
      {call.members.map((m) => (
        <Tile key={m.u} u={m.u} name={nameOf(m.u)} muted={m.muted} label={stateLabel(m)}
          stream={showsVideo(call, m, remotes[m.u]) ? remotes[m.u] : null} fit={m.sharing} />
      ))}
      <Tile u={me.u} name="You" muted={call.muted}
        stream={call.sharing ? screen : call.video && !call.camOff ? local : null} mirror={!call.sharing && call.facing === 'user'} fit={call.sharing} />
    </div>
  );
}

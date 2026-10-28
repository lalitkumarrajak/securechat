// The call screen: an incoming call to answer or decline, then the call itself. With one other person:
// their video full screen and yours in a corner, or their photo for a voice call. With more: a grid
// of everyone. Mute, camera, screen sharing, adding people and hang-up along the bottom.
// It can shrink to a bar at the top, so you can keep chatting during a call. pointer-events-auto: an
// open panel or dialog underneath makes the rest of the page untappable, but never the call.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Mic, MicOff, MonitorUp, MonitorX, Phone, PhoneOff, Search, SwitchCamera, UserPlus, Video, VideoOff, X } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import {
  accept, addToCall, canShareScreen, decline, hangUp, isGroupCall, MAX_PEOPLE, setMinimized, shareScreen, stopSharing, switchCamera, toggleCamera, toggleMute,
  useCall, type Call, type Member,
} from '../../lib/calls';
import { fmtDuration } from '@sanga/ui/format';
import { displayName } from '../../lib/types';
import { cn } from '@sanga/ui/utils';
import { useApp } from '../../state/app';

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

function RemoteAudio({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
    if (stream) ref.current.play().catch(() => {});
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline />;
}

function Media({ stream, mirror, fit, className }: { stream: MediaStream | null; mirror?: boolean; fit?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
    if (stream) ref.current.play().catch(() => {});
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className={cn(fit ? 'bg-black object-contain' : 'object-cover', mirror && '-scale-x-100', className)} />;
}

function useNames() {
  const friends = useApp((s) => s.friends);
  return (u: string) => displayName(friends[u], u);
}

function joinNames(names: string[]) {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function status(c: Call, now: number) {
  if (c.phase === 'ended') return c.ended || 'Call ended';
  if (c.phase === 'incoming') return `Incoming ${c.members.length > 1 ? 'group ' : ''}${c.video ? 'video' : 'voice'} call`;
  if (c.phase === 'outgoing') return c.ringing ? 'Ringing…' : 'Calling…';
  if (!isGroupCall(c) && c.members[0]?.state === 'reconnecting') return 'Reconnecting…';
  if (c.phase === 'connecting' || !c.started) return 'Connecting…';
  return fmtDuration((now - c.started) / 1000);
}

function useNow(on: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [on]);
  return now;
}

/** Whether to show someone's picture: their camera in a video call, or their shared screen. */
const showsVideo = (c: Call, m: Member, s?: MediaStream) => !!s?.getVideoTracks().length && m.state === 'connected' && (!!m.sharing || (c.video && !m.camOff));

function Full({ call }: { call: Call }) {
  const local = useCall((s) => s.local);
  const screen = useCall((s) => s.screen);
  const remotes = useCall((s) => s.remotes);
  const nameOf = useNames();
  const now = useNow(call.phase === 'active');
  const [adding, setAdding] = useState(false);
  const group = isGroupCall(call);
  const them = call.members[0];
  const name = group ? joinNames(call.members.map((m) => nameOf(m.u))) : nameOf(call.peer);
  const remoteVideo = !group && !!them && call.phase === 'active' && showsVideo(call, them, remotes[them.u]);
  const showLocal = call.video && !!local && !call.camOff && call.phase !== 'ended';
  const canAdd = call.phase === 'active' && call.members.length + 1 < MAX_PEOPLE;

  return (
    <div role="dialog" aria-modal="true" aria-label={`Call with ${name}`}
      className="pointer-events-auto fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-[#0f2b2a] to-[#05100f] text-white animate-fade-in">
      {remoteVideo && <Media stream={remotes[them.u]} fit={them.sharing} className="absolute inset-0 size-full" />}
      {/* before they pick up, a video call shows your own camera full screen */}
      {!group && !remoteVideo && showLocal && call.phase !== 'active' && <Media stream={local} mirror={call.facing === 'user'} className="absolute inset-0 size-full opacity-60" />}

      <header className="relative z-10 flex items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {call.phase !== 'incoming' && call.phase !== 'ended' && (
          <button onClick={() => setMinimized(true)} aria-label="Minimise call" className="grid size-10 place-items-center rounded-full bg-black/25 hover:bg-black/40">
            <ChevronDown className="size-6" />
          </button>
        )}
        <span className="flex-1 text-center text-xs text-white/70">🔒 End-to-end encrypted</span>
        <span className="size-10" />
      </header>

      {group && call.phase !== 'incoming' ? (
        <>
          <div className="relative z-10 px-6 pt-2 text-center">
            <h2 className="text-lg font-semibold">Group call · {call.members.length + 1} people</h2>
            <p className="mt-0.5 text-sm text-white/80" aria-live="polite">{status(call, now)}</p>
            <Sharing call={call} nameOf={nameOf} />
          </div>
          <Grid call={call} nameOf={nameOf} />
        </>
      ) : (
        <div className={cn('relative z-10 flex flex-col items-center px-6', remoteVideo ? 'pt-2' : 'flex-1 justify-center pb-16')}>
          {!remoteVideo && (
            group ? (
              <div className="flex -space-x-6">
                {call.members.slice(0, 3).map((m) => <span key={m.u} className="rounded-full ring-4 ring-[#0f2b2a]"><Avatar u={m.u} name={nameOf(m.u)} size={96} /></span>)}
              </div>
            ) : (
              <span className={cn('rounded-full', (call.phase === 'incoming' || call.phase === 'outgoing') && 'animate-pulse')}>
                <Avatar u={call.peer} name={name} size={128} />
              </span>
            )
          )}
          <h2 className={cn('text-center font-semibold drop-shadow', remoteVideo ? 'text-lg' : 'mt-5 text-2xl')}>{name}</h2>
          <p className="mt-1 text-sm text-white/80 drop-shadow" aria-live="polite">{status(call, now)}</p>
          {them && call.phase === 'active' && them.muted && <p className="mt-2 flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-xs"><MicOff className="size-3.5" />{name} is muted</p>}
          {them && call.phase === 'active' && call.video && them.camOff && !them.sharing && <p className="mt-2 text-xs text-white/70">{name}’s camera is off</p>}
          <Sharing call={call} nameOf={nameOf} />
        </div>
      )}

      {!group && (call.sharing && screen ? (
        <Media stream={screen} fit
          className="absolute top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] right-3 z-20 h-28 w-44 rounded-2xl border border-white/30 shadow-xl md:h-36 md:w-60" />
      ) : showLocal && (call.phase === 'active' || remoteVideo) && (
        <Media stream={local} mirror={call.facing === 'user'}
          className="absolute top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] right-3 z-20 h-40 w-28 rounded-2xl border border-white/30 shadow-xl md:h-52 md:w-36" />
      ))}

      <footer className="relative z-10 mt-auto px-6 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {call.phase === 'incoming' ? (
          <div className="flex items-center justify-around">
            <Round label="Decline" onClick={decline} className="bg-red-500"><PhoneOff /></Round>
            <Round label={call.video ? 'Accept video call' : 'Accept'} onClick={() => void accept()} className="bg-green-500" ping>
              {call.video ? <Video /> : <Phone />}
            </Round>
          </div>
        ) : call.phase === 'ended' ? (
          <div className="h-16" />
        ) : (
          <div className="mx-auto flex max-w-md items-center justify-around gap-1 rounded-full bg-black/35 px-3 py-3 backdrop-blur">
            <Round label={call.muted ? 'Unmute' : 'Mute'} pressed={call.muted} onClick={toggleMute} small className={call.muted ? 'bg-white text-black' : 'bg-white/15'}>
              {call.muted ? <MicOff /> : <Mic />}
            </Round>
            {call.video && (
              <Round label={call.camOff ? 'Turn camera on' : 'Turn camera off'} pressed={call.camOff} onClick={toggleCamera} small className={call.camOff ? 'bg-white text-black' : 'bg-white/15'}>
                {call.camOff ? <VideoOff /> : <Video />}
              </Round>
            )}
            {call.video && <Round label="Switch camera" onClick={() => void switchCamera()} small className="bg-white/15"><SwitchCamera /></Round>}
            {canShareScreen() && call.phase === 'active' && (
              <Round label={call.sharing ? 'Stop sharing screen' : 'Share screen'} pressed={!!call.sharing} small
                onClick={() => void (call.sharing ? stopSharing() : shareScreen())} className={call.sharing ? 'bg-sky-500' : 'bg-white/15'}>
                {call.sharing ? <MonitorX /> : <MonitorUp />}
              </Round>
            )}
            {canAdd && <Round label="Add people" onClick={() => setAdding(true)} small className="bg-white/15"><UserPlus /></Round>}
            <Round label={group ? 'Leave call' : 'End call'} onClick={hangUp} small className="bg-red-500"><PhoneOff /></Round>
          </div>
        )}
      </footer>

      {adding && <AddPeople call={call} onClose={() => setAdding(false)} />}
    </div>
  );
}

/** Who's sharing a screen, and a way to stop mine. */
function Sharing({ call, nameOf }: { call: Call; nameOf: (u: string) => string }) {
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

const stateLabel = (m: Member) =>
  m.state === 'ringing' ? 'Ringing…' : m.state === 'connecting' ? 'Connecting…' : m.state === 'reconnecting' ? 'Reconnecting…' : m.sharing ? 'Sharing screen' : '';

/** A group call: a tile for everyone, me last. */
function Grid({ call, nameOf }: { call: Call; nameOf: (u: string) => string }) {
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

function Tile({ u, name, stream, muted, label, mirror, fit }: { u: string; name: string; stream: MediaStream | null; muted?: boolean; label?: string; mirror?: boolean; fit?: boolean }) {
  return (
    <div role="listitem" aria-label={name} className="relative grid min-h-0 place-items-center overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
      {stream ? <Media stream={stream} mirror={mirror} fit={fit} className="absolute inset-0 size-full" />
        : <span className={cn('rounded-full', label === 'Ringing…' && 'animate-pulse')}><Avatar u={u} name={name} size={72} /></span>}
      <span className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium">
        {muted && <MicOff className="size-3.5 shrink-0" aria-label="Muted" />}
        <span className="truncate">{name}</span>
        {label && <span className="shrink-0 text-white/70">· {label}</span>}
      </span>
    </div>
  );
}

/** Ring more friends into the call. Everyone on a call must be friends with everyone else on it:
 *  the server says so if one isn't. */
function AddPeople({ call, onClose }: { call: Call; onClose: () => void }) {
  const friends = useApp((s) => s.friends);
  const [q, setQ] = useState('');
  const on = new Set(call.members.map((m) => m.u));
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return Object.values(friends)
      .filter((f) => !t || f.u.includes(t) || (f.name || '').toLowerCase().includes(t))
      .sort((a, b) => displayName(a, a.u).localeCompare(displayName(b, b.u)));
  }, [friends, q]);
  const left = MAX_PEOPLE - call.members.length - 1;
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 md:items-center" onClick={onClose}>
      <div role="dialog" aria-label="Add people" onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80%] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-panel text-ink shadow-2xl md:rounded-3xl">
        <header className="flex items-center gap-2 px-4 pt-4 pb-2">
          <h3 className="flex-1 text-lg font-semibold">Add people</h3>
          <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full hover:bg-hover"><X className="size-5" /></button>
        </header>
        <p className="px-4 text-sm text-muted">Up to {MAX_PEOPLE} people on a call. {left > 0 ? `${left} more can join.` : 'The call is full.'}</p>
        <div className="relative mx-4 mt-3 mb-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search friends" aria-label="Search friends"
            className="h-10 w-full rounded-xl bg-panel-2 pr-3 pl-9 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-accent/30" />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto pb-4">
          {shown.map((f) => {
            const already = on.has(f.u);
            return (
              <li key={f.u}>
                <button disabled={already || left <= 0} onClick={() => { void addToCall(f.u); onClose(); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-hover disabled:opacity-50 disabled:hover:bg-transparent">
                  <Avatar u={f.u} name={f.name} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{displayName(f, f.u)}</span>
                    <span className="block truncate text-sm text-muted">{already ? 'On the call' : '@' + f.u}</span>
                  </span>
                  {!already && <Phone className="size-5 text-accent-ink" />}
                </button>
              </li>
            );
          })}
          {!shown.length && <li className="px-4 py-6 text-center text-sm text-muted">No friends found.</li>}
        </ul>
      </div>
    </div>
  );
}

/** The minimised call: a bar over the top of the app. */
function CallBar({ call }: { call: Call }) {
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

function Round({ label, onClick, children, className, small, pressed, ping }: {
  label: string; onClick: () => void; children: React.ReactNode; className?: string; small?: boolean; pressed?: boolean; ping?: boolean;
}) {
  return (
    <span className="relative flex flex-col items-center gap-1.5">
      {ping && <span className="pointer-events-none absolute top-0 size-[72px] animate-ping rounded-full bg-green-500/40" aria-hidden />}
      <button onClick={onClick} aria-label={label} aria-pressed={pressed}
        className={cn('relative grid place-items-center rounded-full text-white shadow-lg transition active:scale-95', small ? 'size-12 [&_svg]:size-5 sm:size-14 sm:[&_svg]:size-6' : 'size-[72px] [&_svg]:size-8', className)}>
        {children}
      </button>
      {!small && <span className="text-xs text-white/80">{label}</span>}
    </span>
  );
}

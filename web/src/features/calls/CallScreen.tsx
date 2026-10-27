// The call screen: an incoming call to answer or decline, then the call itself (their video full
// screen and yours in a corner, or their photo for a voice call), with mute, camera and hang-up.
// It can shrink to a bar at the top, so you can keep chatting during a call. pointer-events-auto: an
// open panel or dialog underneath makes the rest of the page untappable, but never the call.
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Mic, MicOff, Phone, PhoneOff, SwitchCamera, Video, VideoOff } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { accept, decline, hangUp, setMinimized, switchCamera, toggleCamera, toggleMute, useCall, type Call } from '../../lib/calls';
import { fmtDuration } from '../../lib/format';
import { displayName } from '../../lib/types';
import { cn } from '../../lib/utils';
import { useApp } from '../../state/app';

export function CallScreen() {
  const call = useCall((s) => s.call);
  const remote = useCall((s) => s.remote);
  const minimized = useCall((s) => s.minimized);
  if (!call) return null;
  return (
    <>
      {/* their voice, always playing, whether the screen is big or small */}
      <RemoteAudio stream={remote} />
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

function Media({ stream, mirror, className }: { stream: MediaStream | null; mirror?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
    if (stream) ref.current.play().catch(() => {});
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className={cn('object-cover', mirror && '-scale-x-100', className)} />;
}

function useName(peer: string) {
  const friend = useApp((s) => s.friends[peer]);
  return displayName(friend, peer);
}

function status(c: Call, now: number) {
  if (c.phase === 'ended') return c.ended || 'Call ended';
  if (c.phase === 'incoming') return `Incoming ${c.video ? 'video' : 'voice'} call`;
  if (c.phase === 'outgoing') return c.ringing ? 'Ringing…' : 'Calling…';
  if (c.reconnecting) return 'Reconnecting…';
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

function Full({ call }: { call: Call }) {
  const local = useCall((s) => s.local);
  const remote = useCall((s) => s.remote);
  const name = useName(call.peer);
  const now = useNow(call.phase === 'active');
  const remoteVideo = call.video && call.phase === 'active' && !call.remoteCamOff && !!remote?.getVideoTracks().length;
  const showLocal = call.video && !!local && !call.camOff && call.phase !== 'ended';

  return (
    <div role="dialog" aria-modal="true" aria-label={`Call with ${name}`}
      className="pointer-events-auto fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-[#0f2b2a] to-[#05100f] text-white animate-fade-in">
      {remoteVideo && <Media stream={remote} className="absolute inset-0 size-full" />}
      {/* before they pick up, a video call shows your own camera full screen */}
      {!remoteVideo && showLocal && call.phase !== 'active' && <Media stream={local} mirror={call.facing === 'user'} className="absolute inset-0 size-full opacity-60" />}

      <header className="relative z-10 flex items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {call.phase !== 'incoming' && call.phase !== 'ended' && (
          <button onClick={() => setMinimized(true)} aria-label="Minimise call" className="grid size-10 place-items-center rounded-full bg-black/25 hover:bg-black/40">
            <ChevronDown className="size-6" />
          </button>
        )}
        <span className="flex-1 text-center text-xs text-white/70">🔒 End-to-end encrypted</span>
        <span className="size-10" />
      </header>

      <div className={cn('relative z-10 flex flex-col items-center px-6', remoteVideo ? 'pt-2' : 'flex-1 justify-center pb-16')}>
        {!remoteVideo && (
          <span className={cn('rounded-full', (call.phase === 'incoming' || call.phase === 'outgoing') && 'animate-pulse')}>
            <Avatar u={call.peer} name={name} size={128} />
          </span>
        )}
        <h2 className={cn('font-semibold drop-shadow', remoteVideo ? 'text-lg' : 'mt-5 text-2xl')}>{name}</h2>
        <p className="mt-1 text-sm text-white/80 drop-shadow" aria-live="polite">{status(call, now)}</p>
        {call.phase === 'active' && call.remoteMuted && <p className="mt-2 flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-xs"><MicOff className="size-3.5" />{name} is muted</p>}
        {call.phase === 'active' && call.video && call.remoteCamOff && <p className="mt-2 text-xs text-white/70">{name}’s camera is off</p>}
      </div>

      {showLocal && (call.phase === 'active' || remoteVideo) && (
        <Media stream={local} mirror={call.facing === 'user'}
          className="absolute top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] right-3 z-20 h-40 w-28 rounded-2xl border border-white/30 shadow-xl md:h-52 md:w-36" />
      )}

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
          <div className="mx-auto flex max-w-sm items-center justify-around rounded-full bg-black/35 px-3 py-3 backdrop-blur">
            <Round label={call.muted ? 'Unmute' : 'Mute'} pressed={call.muted} onClick={toggleMute} small className={call.muted ? 'bg-white text-black' : 'bg-white/15'}>
              {call.muted ? <MicOff /> : <Mic />}
            </Round>
            {call.video && (
              <Round label={call.camOff ? 'Turn camera on' : 'Turn camera off'} pressed={call.camOff} onClick={toggleCamera} small className={call.camOff ? 'bg-white text-black' : 'bg-white/15'}>
                {call.camOff ? <VideoOff /> : <Video />}
              </Round>
            )}
            {call.video && <Round label="Switch camera" onClick={() => void switchCamera()} small className="bg-white/15"><SwitchCamera /></Round>}
            <Round label="End call" onClick={hangUp} small className="bg-red-500"><PhoneOff /></Round>
          </div>
        )}
      </footer>
    </div>
  );
}

/** The minimised call: a bar over the top of the app. */
function CallBar({ call }: { call: Call }) {
  const name = useName(call.peer);
  const now = useNow(call.phase === 'active');
  return (
    <div className="pointer-events-auto fixed inset-x-0 top-0 z-[60] flex items-center gap-3 bg-green-600 px-4 pt-[max(0.4rem,env(safe-area-inset-top))] pb-1.5 text-sm text-white shadow-lg">
      <button onClick={() => setMinimized(false)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-label="Return to call">
        {call.video ? <Video className="size-4 shrink-0" /> : <Phone className="size-4 shrink-0" />}
        <span className="truncate font-medium">{name}</span>
        <span className="text-white/85">· {status(call, now)}</span>
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
        className={cn('relative grid place-items-center rounded-full text-white shadow-lg transition active:scale-95', small ? 'size-14 [&_svg]:size-6' : 'size-[72px] [&_svg]:size-8', className)}>
        {children}
      </button>
      {!small && <span className="text-xs text-white/80">{label}</span>}
    </span>
  );
}

import { useState } from 'react';
import { ChevronDown, Mic, MicOff, MonitorUp, MonitorX, Phone, PhoneOff, SwitchCamera, UserPlus, Video, VideoOff } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { accept, canShareScreen, decline, hangUp, isGroupCall, MAX_PEOPLE, setMinimized, shareScreen, stopSharing, switchCamera, toggleCamera, toggleMute, useCall, type Call } from '../../../lib/calls';
import { cn } from '@sanga/ui/utils';
import { Media } from './Media';
import { useNames, joinNames, status, useNow, showsVideo } from './helpers';
import { Sharing } from './Sharing';
import { Grid } from './Grid';
import { AddPeople } from './AddPeople';
import { Round } from './Round';

export function Full({ call }: { call: Call }) {
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

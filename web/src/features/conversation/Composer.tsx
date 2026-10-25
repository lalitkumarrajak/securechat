import { useEffect, useRef, useState } from 'react';
import * as M from '@radix-ui/react-dropdown-menu';
import { toast } from 'sonner';
import { Camera, Check, Image as ImageIcon, Mic, Paperclip, Pencil, Reply, SendHorizontal, Smile, Trash2, X } from 'lucide-react';
import { IconButton } from '../../components/ui/button';
import { senderOf } from '../../lib/controls';
import { EMOJI_PICKER } from '../../lib/emoji';
import { editMessage, me, preview, saveDraft, sendPhoto, sendText, sendTyping, sendVoice } from '../../lib/engine';
import { fmtDuration } from '../../lib/format';
import type { Msg } from '../../lib/types';
import { cn, isTouch } from '../../lib/utils';
import { VoiceRecorder } from '../../lib/voice';
import { getApp, setApp, useApp } from '../../state/app';
import { useSettings } from '../../state/settings';

export function Composer({ peer, peerName }: { peer: string; peerName: string }) {
  const replyTo = useApp((s) => s.replyTo);
  const editing = useApp((s) => s.editing);
  const enterToSend = useSettings((s) => s.enterToSend);
  const input = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(() => getApp().chats.find((c) => c.peer === peer)?.draft || '');
  const [recording, setRecording] = useState(false);

  // Editing fills the box with the message; leaving edit mode restores the draft.
  useEffect(() => {
    if (editing) { setText(editing.text || ''); input.current?.focus(); }
  }, [editing]);
  useEffect(() => { if (replyTo) input.current?.focus(); }, [replyTo]);

  useEffect(() => { autosize(); }, [text]);
  function autosize() {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }

  function change(v: string) {
    setText(v);
    if (!editing) saveDraft(peer, v);
    if (v) sendTyping(peer);
  }

  function submit() {
    const t = text.trim();
    if (!t) return;
    // Focus again inside the same tap, so phone keyboards stay open after every message.
    input.current?.focus();
    if (editing) {
      editMessage(editing, t).catch((e) => toast.error(e.message));
      setApp({ editing: null });
      setText(getApp().chats.find((c) => c.peer === peer)?.draft || '');
      return;
    }
    setText('');
    saveDraft(peer, '');
    setApp({ replyTo: null });
    sendText(peer, t, replyTo).catch((e) => toast.error(e.message));
  }

  async function photo(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Only photos can be sent for now.');
    const re = getApp().replyTo;
    setApp({ replyTo: null });
    try { await sendPhoto(peer, file, re); } catch (e) { toast.error((e as Error).message || 'Couldn’t send that photo'); }
  }

  function insertEmoji(e: string) {
    const el = input.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + e + text.slice(end);
    change(next);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + e.length, start + e.length); });
  }

  if (recording) return <RecordingBar peer={peer} onDone={() => setRecording(false)} />;

  const empty = !text.trim();
  return (
    <div className="shrink-0 border-t border-line bg-panel pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {(replyTo || editing) && <ContextBar m={(editing || replyTo)!} editing={!!editing} peerName={peerName}
        onClose={() => { if (editing) { setApp({ editing: null }); setText(getApp().chats.find((c) => c.peer === peer)?.draft || ''); } else setApp({ replyTo: null }); }} />}
      <div className="flex items-end gap-1 px-2 pt-2">
        {!editing && <EmojiButton onPick={insertEmoji} />}
        {!editing && <AttachButton onFile={photo} />}
        <textarea
          id="composer-input"
          ref={input}
          value={text}
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && enterToSend) { e.preventDefault(); submit(); }
            if (e.key === 'Escape') setApp({ replyTo: null, editing: null });
          }}
          onPaste={(e) => {
            const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
            if (file) { e.preventDefault(); photo(file); }
          }}
          rows={1}
          maxLength={8000}
          placeholder={editing ? 'Edit message' : 'Message'}
          aria-label="Message"
          className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl bg-panel-2 px-4 py-2.5 text-[0.95rem] leading-snug outline-none placeholder:text-muted focus:ring-2 focus:ring-accent/25"
        />
        {empty && !editing ? (
          <MicButton peer={peer} onStart={() => setRecording(true)} />
        ) : (
          <button
            type="button"
            aria-label={editing ? 'Save edit' : 'Send'}
            // Don't take focus from the text box (that closes the keyboard on phones).
            onMouseDown={(e) => e.preventDefault()}
            onClick={submit}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-white shadow-sm transition active:scale-95"
          >
            {editing ? <Check className="size-5" /> : <SendHorizontal className="size-5" />}
          </button>
        )}
      </div>
    </div>
  );
}

function ContextBar({ m, editing, peerName, onClose }: { m: Msg; editing: boolean; peerName: string; onClose: () => void }) {
  const who = senderOf(m) === me() ? 'You' : peerName;
  return (
    <div className="flex items-center gap-2 px-3 pt-2">
      <div className="min-w-0 flex-1 rounded-xl border-l-4 border-accent bg-panel-2 px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-accent-ink">
          {editing ? <><Pencil className="size-3" /> Editing message</> : <><Reply className="size-3" /> Replying to {who}</>}
        </span>
        <span className="block truncate text-sm text-muted">{preview(m)}</span>
      </div>
      <IconButton label={editing ? 'Cancel edit' : 'Cancel reply'} size="icon-sm" onClick={onClose}><X /></IconButton>
    </div>
  );
}

function EmojiButton({ onPick }: { onPick: (e: string) => void }) {
  return (
    <M.Root modal={false}>
      <M.Trigger asChild>
        <IconButton label="Emoji" onMouseDown={(e) => isTouch() || e.preventDefault()}><Smile /></IconButton>
      </M.Trigger>
      <M.Portal>
        <M.Content side="top" align="start" sideOffset={8} collisionPadding={8}
          className="z-50 grid max-h-72 w-[min(22rem,calc(100vw-1rem))] grid-cols-8 gap-0.5 overflow-y-auto rounded-2xl border border-line bg-panel p-2 shadow-xl animate-fade-in">
          {EMOJI_PICKER.map((e) => (
            <M.Item key={e} onSelect={(ev) => { ev.preventDefault(); onPick(e); }}
              className="grid aspect-square cursor-pointer place-items-center rounded-lg text-2xl outline-none data-[highlighted]:bg-hover">
              {e}
            </M.Item>
          ))}
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}

function AttachButton({ onFile }: { onFile: (f?: File | null) => void }) {
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const pick = (el: HTMLInputElement | null) => el?.click();
  return (
    <>
      <M.Root modal={false}>
        <M.Trigger asChild><IconButton label="Attach"><Paperclip /></IconButton></M.Trigger>
        <M.Portal>
          <M.Content side="top" align="start" sideOffset={8} className="z-50 w-48 rounded-xl border border-line bg-panel p-1 shadow-xl animate-fade-in">
            <M.Item onSelect={() => pick(gallery.current)} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-hover">
              <span className="grid size-8 place-items-center rounded-full bg-violet-500 text-white"><ImageIcon className="size-4" /></span> Photo
            </M.Item>
            <M.Item onSelect={() => pick(camera.current)} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-hover">
              <span className="grid size-8 place-items-center rounded-full bg-pink-500 text-white"><Camera className="size-4" /></span> Camera
            </M.Item>
          </M.Content>
        </M.Portal>
      </M.Root>
      <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
    </>
  );
}

// ---------- voice messages ----------
// Hold the mic to record and release to send; slide left to cancel. A quick tap instead
// "locks" recording on, with Delete and Send buttons (easier on desktop).
let recorder: VoiceRecorder | null = null;
let pressStart = 0;
let pressX = 0;
const hold = { active: false, cancelled: false, released: false };

function MicButton({ peer, onStart }: { peer: string; onStart: () => void }) {
  async function down(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pressStart = performance.now();
    pressX = e.clientX;
    hold.active = true;
    hold.cancelled = false;
    hold.released = false;
    // Released while the browser was still asking for the microphone: switch to "locked" mode.
    window.addEventListener('pointerup', () => { hold.released = true; }, { once: true });
    recorder = new VoiceRecorder();
    try {
      await recorder.start();
    } catch {
      recorder = null;
      hold.active = false;
      toast.error('Microphone not available', { description: 'Allow microphone access for this site in your browser settings.' });
      return;
    }
    sendTyping(peer, true);
    onStart();
  }
  return (
    <button type="button" aria-label="Hold to record a voice message" onPointerDown={down}
      onContextMenu={(e) => e.preventDefault()}
      className="grid size-11 shrink-0 touch-none place-items-center rounded-full bg-accent text-white shadow-sm transition select-none active:scale-110">
      <Mic className="size-5" />
    </button>
  );
}

function RecordingBar({ peer, onDone }: { peer: string; onDone: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const r = recorder;
    if (!r) { onDone(); return; }
    if (hold.released) { hold.active = false; setLocked(true); }
    r.onLevel = (level, t) => {
      setElapsed(t);
      setLevels((l) => [...l.slice(-39), level]);
      sendTyping(peer, true);
    };
    r.onLimit = () => finish(true);
    const move = (e: PointerEvent) => {
      if (!hold.active) return;
      const dx = pressX - e.clientX;
      setSlide(Math.max(0, dx));
      if (dx > 110) { hold.cancelled = true; hold.active = false; finish(false); }
    };
    const up = () => {
      if (!hold.active) return;
      hold.active = false;
      if (performance.now() - pressStart < 400) setLocked(true); // quick tap: keep recording
      else finish(true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []); // set up once when recording starts

  async function finish(send: boolean) {
    const r = recorder;
    recorder = null;
    onDone();
    if (!r) return;
    if (!send) { r.cancel(); toast('Recording cancelled'); return; }
    const rec = await r.stop();
    if (!rec) { toast('Hold the mic button to record'); return; }
    const re = getApp().replyTo;
    setApp({ replyTo: null });
    sendVoice(peer, rec, re).catch((e) => toast.error(e.message));
  }

  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-line bg-panel px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {locked ? (
        <IconButton label="Delete recording" onClick={() => finish(false)} className="text-danger hover:text-danger"><Trash2 /></IconButton>
      ) : (
        <span className="size-3 animate-pulse rounded-full bg-danger" aria-hidden />
      )}
      <span className="w-12 font-mono text-sm tabular-nums">{fmtDuration(elapsed)}</span>
      <div className="flex h-9 flex-1 items-center gap-[2px] overflow-hidden" aria-hidden>
        {locked || !slide ? levels.map((l, i) => (
          <span key={i} className="w-[3px] flex-1 rounded-full bg-accent/70" style={{ height: `${Math.max(10, Math.min(100, l * 400))}%` }} />
        )) : null}
        {!locked && (
          <span className={cn('ml-auto text-sm text-muted transition', slide > 0 && 'mr-auto ml-0')} style={{ transform: `translateX(-${slide}px)` }}>
            ‹ Slide to cancel
          </span>
        )}
      </div>
      {locked ? (
        <button onClick={() => finish(true)} aria-label="Send voice message"
          className="grid size-11 place-items-center rounded-full bg-accent text-white shadow-sm"><SendHorizontal className="size-5" /></button>
      ) : (
        <span className="grid size-14 -m-1.5 place-items-center rounded-full bg-accent text-white shadow-lg"><Mic className="size-6" /></span>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import * as M from '@radix-ui/react-dropdown-menu';
import { toast } from 'sonner';
import { Camera, Check, FileText, Image as ImageIcon, Keyboard, Link2, MapPin, Mic, Paperclip, Pencil, Reply, SendHorizontal, Smile, Trash2, X } from 'lucide-react';
import { confirm } from '../../components/ui/confirm';
import { currentLocation } from '../../lib/location';
import { IconButton } from '../../components/ui/button';
import { senderOf } from '../../lib/controls';
import { editMessage, fetchLinkPreview, me, preview, saveDraft, sendFile, sendGif, sendLocation, sendPhoto, sendSticker, sendText, sendTyping, sendVoice } from '../../lib/engine';
import { fmtDuration } from '../../lib/format';
import type { GifItem, LinkPreview, Msg } from '../../lib/types';
import { ExpressionPanel, type PanelTab } from './ExpressionPanel';
import { cn, isTouch } from '../../lib/utils';
import { VoiceRecorder } from '../../lib/voice';
import { getApp, setApp, useApp } from '../../state/app';
import { insertMention, mentionQuery, mentioned } from '../../lib/mentions';
import { groupIdOf, isGroup } from '../../lib/types';
import { Avatar } from '../../components/Avatar';
import { useMemberName } from './MessageBubble';
import { useSettings } from '../../state/settings';

export function Composer({ peer, peerName }: { peer: string; peerName: string }) {
  const replyTo = useApp((s) => s.replyTo);
  const editing = useApp((s) => s.editing);
  const enterToSend = useSettings((s) => s.enterToSend);
  const input = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(() => getApp().chats.find((c) => c.peer === peer)?.draft || '');
  const [recording, setRecording] = useState(false);
  const [panel, setPanel] = useState<PanelTab | null>(null); // emoji / GIF / sticker panel
  // @mentions in groups: the "@na…" being typed, and which suggestion is highlighted
  const group = useApp((s) => (isGroup(peer) ? s.groups[groupIdOf(peer)] : undefined));
  const memberName = useMemberName();
  const [tag, setTag] = useState<{ start: number; q: string } | null>(null);
  const [pick, setPick] = useState(0);
  const others = (group?.members || []).filter((m) => m.u !== me());
  const suggestions = tag ? others.filter((m) => m.u.includes(tag.q) || memberName(m.u, group).toLowerCase().includes(tag.q)).slice(0, 6) : [];
  function chooseMention(u: string) {
    if (!tag) return;
    const r = insertMention(text, input.current?.selectionStart ?? text.length, tag.start, u);
    change(r.text);
    setTag(null);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(r.cursor, r.cursor); });
  }
  useEffect(() => { // Esc closes the panel before anything else
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); setPanel(null); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [panel]);
  const camera = useRef<HTMLInputElement>(null);
  const link = useLinkPreview(editing ? '' : text);

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
    if (group) { setTag(mentionQuery(v, input.current?.selectionStart ?? v.length)); setPick(0); }
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
    const lp = link.preview; // only set while the text still contains that link
    link.clear();
    const mn = group ? mentioned(t, others.map((m) => m.u)) : undefined;
    setTag(null);
    sendText(peer, t, replyTo, lp, mn).catch((e) => toast.error(e.message));
  }

  async function photo(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Only photos can be sent for now.');
    const re = getApp().replyTo;
    setApp({ replyTo: null });
    try { await sendPhoto(peer, file, re); } catch (e) { toast.error((e as Error).message || 'Couldn’t send that photo'); }
  }

  async function document_(file?: File | null) {
    if (!file) return;
    if (file.type.startsWith('image/') && file.size < 15 * 1024 * 1024) return photo(file); // photos get compressed
    const re = getApp().replyTo;
    setApp({ replyTo: null });
    const t = toast.loading(`Sending ${file.name}…`);
    try { await sendFile(peer, file, re); toast.dismiss(t); } catch (e) { toast.error((e as Error).message || 'Couldn’t send that file', { id: t }); }
  }

  async function location() {
    let loc;
    const t = toast.loading('Finding your location…');
    try { loc = await currentLocation(); toast.dismiss(t); } catch (e) { toast.error((e as Error).message, { id: t }); return; }
    if (!(await confirm({ title: 'Send your current location?', description: `Accurate to about ${loc.acc} m. ${peerName} will see it on a map.`, confirmText: 'Send location' }))) return;
    const re = getApp().replyTo;
    setApp({ replyTo: null });
    sendLocation(peer, loc, re).catch((e) => toast.error(e.message));
  }

  // Emoji go in at the cursor. On phones the box isn't focused while the panel is open
  // (so the keyboard stays hidden); emoji are then added at the end.
  const caret = useRef<number | null>(null);
  function insertEmoji(e: string) {
    const el = input.current;
    const at = document.activeElement === el ? el!.selectionStart : caret.current ?? text.length;
    const end = document.activeElement === el ? el!.selectionEnd : at;
    change(text.slice(0, at) + e + text.slice(end));
    caret.current = at + e.length;
    if (!isTouch()) requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + e.length, at + e.length); });
  }
  function backspace() {
    const chars = [...new Intl.Segmenter().segment(text)].map((s) => s.segment);
    chars.pop();
    change(chars.join(''));
    caret.current = null;
  }

  function sendExpression(fn: () => Promise<void>) {
    setApp({ replyTo: null });
    fn().catch((e) => toast.error(e.message || 'Couldn’t send that'));
  }
  const pickGif = (g: GifItem) => { const re = getApp().replyTo; sendExpression(() => sendGif(peer, g, re)); };
  const pickSticker = (s: string | GifItem) => { const re = getApp().replyTo; sendExpression(() => sendSticker(peer, s, re)); };

  // The smiley button toggles the panel; the keyboard button goes back to typing.
  function togglePanel() {
    if (panel) { setPanel(null); input.current?.focus(); return; }
    caret.current = input.current?.selectionStart ?? null;
    if (isTouch()) input.current?.blur(); // hide the phone keyboard so the panel takes its place
    setPanel('emoji');
  }

  if (recording) return <RecordingBar peer={peer} onDone={() => setRecording(false)} />;

  const empty = !text.trim();
  return (
    <div className={cn('relative shrink-0 border-t border-line bg-panel', !panel && 'pb-[max(0.5rem,env(safe-area-inset-bottom))]')}>
      {suggestions.length > 0 && (
        <ul className="absolute bottom-full left-2 z-20 mb-1 w-[min(22rem,calc(100%-1rem))] overflow-hidden rounded-2xl border border-line bg-panel shadow-xl" role="listbox" aria-label="Mention someone">
          {suggestions.map((m, i) => (
            <li key={m.u} role="option" aria-selected={i === pick}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chooseMention(m.u)}
                className={cn('flex w-full items-center gap-3 px-3 py-2 text-left', i === pick ? 'bg-hover' : 'hover:bg-hover')}>
                <Avatar u={m.u} name={m.n} size={32} />
                <span className="min-w-0 flex-1 truncate font-medium">{memberName(m.u, group)}</span>
                <span className="text-sm text-muted">@{m.u}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {link.preview && !editing && <LinkCard lp={link.preview} onClose={link.dismiss} />}
      {(replyTo || editing) && <ContextBar m={(editing || replyTo)!} editing={!!editing} peerName={peerName}
        onClose={() => { if (editing) { setApp({ editing: null }); setText(getApp().chats.find((c) => c.peer === peer)?.draft || ''); } else setApp({ replyTo: null }); }} />}
      <div className="flex items-end gap-2 px-2 pt-2 pb-2">
        {/* Emoji, attach and camera sit inside the message box, like WhatsApp */}
        <div className="flex min-h-11 min-w-0 flex-1 items-end rounded-3xl bg-panel-2 focus-within:ring-2 focus-within:ring-accent/25">
          {!editing && (
            <IconButton label={panel ? 'Keyboard' : 'Emoji, GIFs and stickers'} className="ml-0.5 shrink-0" onMouseDown={(e) => e.preventDefault()} onClick={togglePanel}>
              {panel ? <Keyboard /> : <Smile />}
            </IconButton>
          )}
        <textarea
          id="composer-input"
          ref={input}
          value={text}
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => {
            if (suggestions.length) { // picking someone to @mention
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setPick((i) => (i + (e.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length); return; }
              if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); chooseMention(suggestions[pick].u); return; }
              if (e.key === 'Escape') { e.preventDefault(); setTag(null); return; }
            }
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && enterToSend) { e.preventDefault(); submit(); }
            if (e.key === 'Escape' && (replyTo || editing)) { e.preventDefault(); setApp({ replyTo: null, editing: null }); }
          }}
          onPaste={(e) => {
            const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
            if (file) { e.preventDefault(); photo(file); }
          }}
          onFocus={() => { if (isTouch()) setPanel(null); }} // typing again: keyboard replaces the panel
          rows={1}
          maxLength={8000}
          placeholder={editing ? 'Edit message' : group ? 'Message · @ to mention' : 'Message'}
          aria-label="Message"
          className={cn('max-h-40 min-h-11 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-[0.95rem] leading-snug outline-none placeholder:text-muted', editing && 'pl-4')}
        />
          {!editing && <AttachButton onPhoto={photo} onDocument={document_} onLocation={location} />}
          {!editing && empty && (
            <IconButton label="Camera" className="mr-0.5 shrink-0" onClick={() => camera.current?.click()}><Camera /></IconButton>
          )}
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { photo(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
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
      {panel && !editing && (
        <ExpressionPanel tab={panel} setTab={setPanel} onEmoji={insertEmoji} onBackspace={backspace} onGif={pickGif} onSticker={pickSticker} />
      )}
    </div>
  );
}

function ContextBar({ m, editing, peerName, onClose }: { m: Msg; editing: boolean; peerName: string; onClose: () => void }) {
  const group = useApp((s) => (isGroup(m.peer) ? s.groups[groupIdOf(m.peer)] : undefined));
  const memberName = useMemberName();
  const who = senderOf(m) === me() ? 'You' : group ? memberName(senderOf(m), group) : peerName;
  return (
    <div className="flex items-center gap-2 px-3 pt-2">
      <div className="priv-scope min-w-0 flex-1 rounded-xl border-l-4 border-accent bg-panel-2 px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-accent-ink">
          {editing ? <><Pencil className="size-3" /> Editing message</> : <><Reply className="size-3" /> Replying to {who}</>}
        </span>
        <span className="priv block truncate text-sm text-muted">{preview(m)}</span>
      </div>
      <IconButton label={editing ? 'Cancel edit' : 'Cancel reply'} size="icon-sm" onClick={onClose}><X /></IconButton>
    </div>
  );
}

const ITEM = 'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-hover';

function AttachButton({ onPhoto, onDocument, onLocation }: {
  onPhoto: (f?: File | null) => void; onDocument: (f?: File | null) => void; onLocation: () => void;
}) {
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const doc = useRef<HTMLInputElement>(null);
  const pick = (el: HTMLInputElement | null) => el?.click();
  const icon = (bg: string, node: React.ReactNode) => <span className={`grid size-9 place-items-center rounded-full text-white ${bg}`}>{node}</span>;
  return (
    <>
      <M.Root modal={false}>
        <M.Trigger asChild><IconButton label="Attach" className="shrink-0"><Paperclip /></IconButton></M.Trigger>
        <M.Portal>
          <M.Content side="top" align="end" sideOffset={8} className="z-50 w-52 rounded-xl border border-line bg-panel p-1 shadow-xl animate-fade-in">
            <M.Item onSelect={() => pick(doc.current)} className={ITEM}>{icon('bg-indigo-500', <FileText className="size-4" />)} Document</M.Item>
            <M.Item onSelect={() => pick(gallery.current)} className={ITEM}>{icon('bg-violet-500', <ImageIcon className="size-4" />)} Photos</M.Item>
            <M.Item onSelect={() => pick(camera.current)} className={ITEM}>{icon('bg-pink-500', <Camera className="size-4" />)} Camera</M.Item>
            <M.Item onSelect={onLocation} className={ITEM}>{icon('bg-emerald-500', <MapPin className="size-4" />)} Location</M.Item>
          </M.Content>
        </M.Portal>
      </M.Root>
      <input ref={gallery} type="file" data-kind="gallery" accept="image/*" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={doc} type="file" data-kind="document" hidden onChange={(e) => { onDocument(e.target.files?.[0]); e.target.value = ''; }} />
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

// ---------- link previews while typing ----------
const URL_RE = /https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]]/;

/** Fetches a preview for the first link in the text (debounced). You can dismiss it. */
function useLinkPreview(text: string) {
  const url = URL_RE.exec(text)?.[0] || '';
  const [state, setState] = useState<{ url: string; preview: LinkPreview | null }>({ url: '', preview: null });
  const [dismissed, setDismissed] = useState('');
  useEffect(() => {
    if (!url || url === state.url || url === dismissed) return;
    const t = setTimeout(() => { fetchLinkPreview(url).then((preview) => setState({ url, preview })); }, 600);
    return () => clearTimeout(t);
  }, [url]); // fetch when the link changes
  return {
    preview: url && url === state.url && url !== dismissed ? state.preview : null,
    dismiss: () => setDismissed(url),
    clear: () => { setState({ url: '', preview: null }); setDismissed(''); },
  };
}

function LinkCard({ lp, onClose }: { lp: LinkPreview; onClose: () => void }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-2">
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-xl bg-panel-2">
        {lp.img ? <img src={lp.img} alt="" className="size-16 shrink-0 object-cover" /> : <span className="grid size-16 shrink-0 place-items-center text-muted"><Link2 className="size-6" /></span>}
        <span className="min-w-0 py-1.5 pr-2">
          <span className="block truncate text-sm font-semibold">{lp.title}</span>
          {lp.desc && <span className="line-clamp-1 text-xs text-muted">{lp.desc}</span>}
          <span className="block truncate text-xs text-accent-ink">{lp.site}</span>
        </span>
      </div>
      <IconButton label="Remove link preview" size="icon-sm" onClick={onClose}><X /></IconButton>
    </div>
  );
}

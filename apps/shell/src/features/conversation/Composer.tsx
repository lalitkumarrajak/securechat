import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { toast } from 'sonner';
import { Camera, Check, Keyboard, SendHorizontal, Smile } from 'lucide-react';
import { confirm } from '@sanga/ui/confirm';
import { currentLocation } from '../../lib/location';
import { isPhoto } from '../../lib/image';
import { IconButton } from '@sanga/ui/button';
import { editMessage, fetchLinkPreview, me, saveDraft, sendFile, sendGif, sendLocation, sendPhoto, sendSticker, sendText, sendTyping } from '../../lib/engine';
import type { GifItem, LinkPreview } from '../../lib/types';
import { ExpressionPanel, type PanelTab } from './ExpressionPanel';
import { ContextBar } from './ContextBar';
import { AttachButton } from './AttachButton';
import { MicButton } from './MicButton';
import { RecordingBar } from './RecordingBar';
import { LinkCard } from './LinkCard';
import { MAX_PHOTOS, SendPhotos, toItems, type PhotoItem } from './SendPhotos';
import { cn, isTouch } from '@sanga/ui/utils';
import { getApp, setApp, useApp } from '../../state/app';
import { insertMention, mentionQuery, mentioned } from '../../lib/mentions';
import { groupIdOf, isGroup } from '../../lib/types';
import { Avatar } from '../../components/Avatar';
import { useMemberName } from './useMemberName';
import { useSettings } from '../../state/settings';
import { t } from '@sanga/i18n';

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
    // Put the new text in and the cursor after the name right now, so letters typed straight
    // afterwards don't land in the wrong place.
    flushSync(() => { change(r.text); setTag(null); });
    input.current?.focus();
    input.current?.setSelectionRange(r.cursor, r.cursor);
  }
  useEffect(() => { // Esc closes the panel before anything else
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); setPanel(null); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [panel]);
  const camera = useRef<HTMLInputElement>(null);
  const [review, setReview] = useState<PhotoItem[] | null>(null); // photos waiting to be sent
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
    const body = text.trim();
    if (!body) return;
    // Focus again inside the same tap, so phone keyboards stay open after every message.
    input.current?.focus();
    if (editing) {
      editMessage(editing, body).catch((e) => toast.error(e.message));
      setApp({ editing: null });
      setText(getApp().chats.find((c) => c.peer === peer)?.draft || '');
      return;
    }
    setText('');
    saveDraft(peer, '');
    setApp({ replyTo: null });
    const lp = link.preview; // only set while the text still contains that link
    link.clear();
    const mn = group ? mentioned(body, others.map((m) => m.u)) : undefined;
    setTag(null);
    sendText(peer, body, replyTo, lp, mn).catch((e) => toast.error(e.message));
  }

  // Picked or pasted photos open the review screen first (several at once, captions, add more).
  async function photos(files: File[]) {
    const ok: File[] = [];
    for (const f of files) if (await isPhoto(f)) ok.push(f);
    if (ok.length < files.length) toast.error(ok.length ? t('Some of those aren’t photos, so they were left out.') : t('Only photos can be sent here.'));
    if (!ok.length) return;
    if (ok.length + (review?.length || 0) > MAX_PHOTOS) toast(t('You can send up to {max} photos at a time.', { max: MAX_PHOTOS }));
    setReview((r) => [...(r || []), ...toItems(ok)].slice(0, MAX_PHOTOS));
  }

  // One after another, so they arrive in the order you picked them. A reply goes with the first.
  async function sendPhotos(items: PhotoItem[]) {
    setReview(null);
    let re = getApp().replyTo;
    setApp({ replyTo: null });
    const tid = items.length > 1 ? toast.loading(t('Sending {n} photos…', { n: items.length })) : undefined;
    let failed = 0;
    const album = items.length > 1 ? crypto.randomUUID().replace(/-/g, '').slice(0, 16) : undefined; // shown together as one grid
    for (const [n, x] of items.entries()) {
      if (tid) toast.loading(t('Sending photo {n} of {total}…', { n: n + 1, total: items.length }), { id: tid });
      try { await sendPhoto(peer, x.file, re, x.caption, album); re = null; }
      catch (e) { failed++; if (!tid) toast.error((e as Error).message || t('Couldn’t send that photo')); }
    }
    if (tid) {
      if (failed) toast.error(t('{failed} of {total} photos couldn’t be sent', { failed, total: items.length }), { id: tid });
      else toast.dismiss(tid);
    }
  }

  // Photos among the documents go through the review screen (they get compressed); other files send in order.
  async function documents(files: File[]) {
    const pics: File[] = [], rest: File[] = [];
    for (const f of files) ((f.size < 25 * 1024 * 1024 && (await isPhoto(f))) ? pics : rest).push(f);
    if (pics.length) photos(pics);
    let re = pics.length ? null : getApp().replyTo;
    if (rest.length && !pics.length) setApp({ replyTo: null });
    for (const [n, file] of rest.entries()) {
      const tid = toast.loading(rest.length > 1 ? t('Sending {file} ({n} of {total})…', { file: file.name, n: n + 1, total: rest.length }) : t('Sending {file}…', { file: file.name }));
      try { await sendFile(peer, file, re); re = null; toast.dismiss(tid); } catch (e) { toast.error((e as Error).message || t('Couldn’t send {file}', { file: file.name }), { id: tid }); }
    }
  }

  async function location() {
    let loc;
    const tid = toast.loading(t('Finding your location…'));
    try { loc = await currentLocation(); toast.dismiss(tid); } catch (e) { toast.error((e as Error).message, { id: tid }); return; }
    if (!(await confirm({ title: t('Send your current location?'), description: t('Accurate to about {acc} m. {name} will see it on a map.', { acc: loc.acc, name: peerName }), confirmText: t('Send location') }))) return;
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

  function sendExpression(fn: () => Promise<void>) { // i18n-ok
    setApp({ replyTo: null });
    fn().catch((e) => toast.error(e.message || t('Couldn’t send that')));
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
        <ul className="absolute bottom-full left-2 z-20 mb-1 w-[min(22rem,calc(100%-1rem))] overflow-hidden rounded-2xl border border-line bg-panel shadow-xl" role="listbox" aria-label={t('Mention someone')}>
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
            <IconButton label={panel ? t('Keyboard') : t('Emoji, GIFs and stickers')} className="ml-0.5 shrink-0" onMouseDown={(e) => e.preventDefault()} onClick={togglePanel}>
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
            const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
            if (files.length) { e.preventDefault(); photos(files); }
          }}
          onFocus={() => { if (isTouch()) setPanel(null); }} // typing again: keyboard replaces the panel
          rows={1}
          maxLength={8000}
          placeholder={editing ? t('Edit message') : group ? t('Message · @ to mention') : t('Message')}
          aria-label={t('Message')}
          className={cn('max-h-40 min-h-11 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-[0.95rem] leading-snug outline-none placeholder:text-muted', editing && 'pl-4')}
        />
          {!editing && <AttachButton onPhotos={photos} onDocuments={documents} onLocation={location} />}
          {!editing && empty && (
            <IconButton label={t('Camera')} className="mr-0.5 shrink-0" onClick={() => camera.current?.click()}><Camera /></IconButton>
          )}
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { photos([...(e.target.files || [])]); e.target.value = ''; }} />
        </div>
        {empty && !editing ? (
          <MicButton peer={peer} onStart={() => setRecording(true)} />
        ) : (
          <button
            type="button"
            aria-label={editing ? t('Save edit') : t('Send')}
            // Don't take focus from the text box (that closes the keyboard on phones).
            onMouseDown={(e) => e.preventDefault()}
            onClick={submit}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-white shadow-sm transition active:scale-95"
          >
            {editing ? <Check className="size-5" /> : <SendHorizontal className="size-5" />}
          </button>
        )}
      </div>
      {review && <SendPhotos items={review} to={peerName} onChange={setReview} onSend={sendPhotos} onClose={() => setReview(null)} />}
      {panel && !editing && (
        <ExpressionPanel tab={panel} setTab={setPanel} onEmoji={insertEmoji} onBackspace={backspace} onGif={pickGif} onSticker={pickSticker} />
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
    const timer = setTimeout(() => { fetchLinkPreview(url).then((preview) => setState({ url, preview })); }, 600);
    return () => clearTimeout(timer);
  }, [url]); // fetch when the link changes
  return {
    preview: url && url === state.url && url !== dismissed ? state.preview : null,
    dismiss: () => setDismissed(url),
    clear: () => { setState({ url: '', preview: null }); setDismissed(''); },
  };
}

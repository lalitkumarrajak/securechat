import { t } from '@sanga/i18n';
import { useRef, useState } from 'react';
import { Camera, FileText, Paperclip, X } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { Spinner } from '@sanga/ui/button';
import { ACCEPT } from './bills';
import { uploadBill } from './store';

/** Attach a bill: a photo (taken now or from the gallery) or a PDF. It uploads, sealed, as soon as it's picked. */
export function BillField({ gid, value, onChange, onUploaded }: { gid: string; value: string | undefined; onChange: (id: string | undefined) => void; onUploaded: (id: string) => void }) {
  const pick = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const take = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError('');
    try { const id = await uploadBill(gid, file); onUploaded(id); onChange(id); }
    catch (e) { setError(e instanceof Error ? e.message : t('Couldn’t attach that')); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <input ref={pick} type="file" accept={ACCEPT} hidden onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ''; }} />
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-panel-2 px-3 py-2.5 text-sm">
          <FileText className="size-5 text-accent" aria-hidden /><span className="flex-1">{t('Bill attached')}</span>
          <Button variant="ghost" size="sm" onClick={() => pick.current?.click()}>{t('Replace')}</Button>
          <button type="button" aria-label={t('Remove bill')} onClick={() => onChange(undefined)} className="rounded-full p-1.5 text-muted hover:bg-hover"><X className="size-4" /></button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => cam.current?.click()}>{busy ? <Spinner className="size-4" /> : <Camera className="size-4" />}{t('Take photo')}</Button>
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => pick.current?.click()}><Paperclip className="size-4" />{t('Photo or PDF')}</Button>
        </div>
      )}
      {error && <p className="mt-1.5 text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}

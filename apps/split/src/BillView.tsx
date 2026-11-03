import { t } from '@sanga/i18n';
import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { Spinner } from '@sanga/ui/button';
import { billUrl } from './bills';
import { loadBill } from './store';

/** A bill, opened from its sealed copy when it's looked at (photos inline, PDFs as a link). */
export function BillView({ gid, id }: { gid: string; id: string }) {
  const [state, setState] = useState<{ url: string; pdf: boolean } | 'loading' | 'error'>('loading');
  useEffect(() => {
    let url = '';
    let live = true;
    loadBill(gid, id).then((b) => { url = billUrl(b); if (live) setState({ url, pdf: b.mime === 'application/pdf' }); }).catch(() => live && setState('error'));
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [gid, id]);

  if (state === 'loading') return <div className="grid h-32 place-items-center"><Spinner className="size-5 text-accent" /></div>;
  if (state === 'error') return <p className="rounded-xl bg-panel-2 p-4 text-sm text-muted">{t('The bill can’t be opened right now. Check your connection and try again.')}</p>;
  return state.pdf
    ? <a href={state.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-line p-3 text-sm font-medium text-accent"><FileText className="size-5" />{t('Open the PDF bill')}</a>
    : <a href={state.url} target="_blank" rel="noreferrer"><img src={state.url} alt={t('Bill')} className="max-h-80 w-full rounded-xl border border-line object-contain" /></a>;
}

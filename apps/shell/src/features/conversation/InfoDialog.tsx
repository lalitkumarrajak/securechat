import { Ticks } from '../../components/Ticks';
import { Dialog } from '@sanga/ui/dialog';
import { preview } from '../../lib/engine';
import { useApp } from '../../state/app';
import { setChatUi, useChatUi } from './chatUi';
import { locale, t, tk } from '@sanga/i18n';

const STATUS = [tk('Not sent'), tk('Sending'), tk('Sent'), tk('Delivered'), tk('Read')];

export function InfoDialog() {
  const m = useChatUi((s) => s.info);
  const live = useApp((s) => (m ? s.messages.find((x) => x.k === m.k) : null));
  const cur = live || m;
  const status = cur ? t(STATUS[cur.s + 2]) : '';
  return (
    <Dialog open={!!m} onOpenChange={(o) => !o && setChatUi({ info: null })} title={t('Message info')}>
      {cur && (
        <dl className="grid gap-3 text-sm">
          <div className="rounded-xl bg-panel-2 px-3 py-2 text-muted">{preview(cur)}</div>
          <div className="flex justify-between"><dt className="text-muted">{t('Sent')}</dt><dd>{new Date(cur.ts).toLocaleString(locale())}</dd></div>
          <div className="flex items-center justify-between"><dt className="text-muted">{t('Status')}</dt><dd className="flex items-center gap-1.5">{status} <Ticks s={cur.s} /></dd></div>
          {cur.edited && <div className="flex justify-between"><dt className="text-muted">{t('Edited')}</dt><dd>{new Date(cur.edited).toLocaleString(locale())}</dd></div>}
          <p className="text-xs text-muted">{t('If either of you turned off read receipts, “Read” shows as “Delivered”.')}</p>
        </dl>
      )}
    </Dialog>
  );
}

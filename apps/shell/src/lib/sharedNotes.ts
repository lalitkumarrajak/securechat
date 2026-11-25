// "Ravi shared a note with you", while Sanga is open: the server says who (never what the note says),
// and Open takes you to the Diary's "Shared with me". When Sanga is closed the push brings it instead (sw.js).
import { toast } from 'sonner';
import { frameHooks } from './engine';
import { openSharedNotes } from './nav';
import { t } from '@sanga/i18n';

frameHooks.nshare = (m: { from?: unknown; name?: unknown }) => {
  if (typeof m.from !== 'string') return;
  const name = String(typeof m.name === 'string' && m.name ? m.name : m.from).slice(0, 80);
  toast(t('{name} shared a note with you', { name }), { id: 'nshare-' + m.from, duration: 10_000, action: { label: t('Open'), onClick: openSharedNotes } });
};

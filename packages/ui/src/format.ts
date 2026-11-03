import { locale, t } from '@sanga/i18n';

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function fmtClock(ts: number) {
  return new Date(ts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
}

/** Chat list: time today, "Yesterday", weekday this week, otherwise a date. */
export function fmtListTime(ts: number, now = new Date()) {
  const d = new Date(ts);
  if (sameDay(d, now)) return fmtClock(ts);
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return t('Yesterday');
  if (now.getTime() - ts < 6 * 864e5) return d.toLocaleDateString(locale(), { weekday: 'long' });
  return d.toLocaleDateString(locale());
}

/** Day separators in a conversation. */
export function fmtDay(ts: number, now = new Date()) {
  const d = new Date(ts);
  if (sameDay(d, now)) return t('Today');
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return t('Yesterday');
  return d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== now.getFullYear() && { year: 'numeric' }) });
}

export function fmtLastSeen(ts: number, now = new Date()) {
  const d = new Date(ts);
  if (sameDay(d, now)) return t('last seen today at {time}', { time: fmtClock(ts) });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return t('last seen yesterday at {time}', { time: fmtClock(ts) });
  return t('last seen {date}', { date: d.toLocaleDateString(locale()) });
}

export function fmtDuration(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "just now", "5m", "3h": how long ago, for stories. */
export function fmtAgo(ts: number, now = Date.now()) {
  const m = Math.floor((now - ts) / 60e3);
  if (m < 1) return t('just now');
  if (m < 60) return t('{n}m', { n: m });
  return t('{n}h', { n: Math.floor(m / 60) });
}

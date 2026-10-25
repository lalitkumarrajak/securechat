const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function fmtClock(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Chat list: time today, "Yesterday", weekday this week, otherwise a date. */
export function fmtListTime(ts: number, now = new Date()) {
  const d = new Date(ts);
  if (sameDay(d, now)) return fmtClock(ts);
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return 'Yesterday';
  if (now.getTime() - ts < 6 * 864e5) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString();
}

/** Day separators in a conversation. */
export function fmtDay(ts: number, now = new Date()) {
  const d = new Date(ts);
  if (sameDay(d, now)) return 'Today';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== now.getFullYear() && { year: 'numeric' }) });
}

export function fmtLastSeen(ts: number, now = new Date()) {
  const d = new Date(ts);
  if (sameDay(d, now)) return `last seen today at ${fmtClock(ts)}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return `last seen yesterday at ${fmtClock(ts)}`;
  return `last seen ${d.toLocaleDateString()}`;
}

export function fmtDuration(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

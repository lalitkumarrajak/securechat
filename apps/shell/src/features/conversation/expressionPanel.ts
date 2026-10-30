// Recently used emoji and stickers, kept on this device.
export function recent(key: string): string[] {
  try { return JSON.parse(localStorage.getItem('chattrix-recent-' + key) || '[]'); } catch { return []; }
}
export function remember(key: string, v: string) {
  try { localStorage.setItem('chattrix-recent-' + key, JSON.stringify([v, ...recent(key).filter((x) => x !== v)].slice(0, 24))); } catch { /* storage unavailable */ }
}

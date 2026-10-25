// @mentions in game chat: "@username" picks out a player.
const WORD = /@([a-z0-9_.]{3,24})/gi;

// A username may contain dots, but a sentence may also end right after one ("hi @rakhi.").
function resolve(raw: string, users: Set<string>) {
  let u = raw.toLowerCase();
  while (u && !users.has(u) && u.endsWith('.')) u = u.slice(0, -1);
  return users.has(u) ? u : null;
}

/** Usernames from `users` mentioned in the text. */
export function mentioned(text: string, users: string[]) {
  const set = new Set(users);
  const out = new Set<string>();
  for (const m of text.matchAll(WORD)) { const u = resolve(m[1], set); if (u) out.add(u); }
  return [...out];
}

/** The text cut into plain parts and mentions, for highlighting. */
export function splitMentions(text: string, users: string[]): { t: string; u?: string }[] {
  const set = new Set(users);
  const parts: { t: string; u?: string }[] = [];
  let at = 0;
  for (const m of text.matchAll(WORD)) {
    const u = resolve(m[1], set);
    if (!u) continue;
    const end = m.index! + 1 + u.length;
    if (m.index! > at) parts.push({ t: text.slice(at, m.index) });
    parts.push({ t: text.slice(m.index, end), u });
    at = end;
  }
  if (at < text.length) parts.push({ t: text.slice(at) });
  return parts;
}

/** The "@name" being typed just before the cursor, if any: where it starts and what's typed so far. */
export function mentionQuery(text: string, cursor: number) {
  const m = /(^|\s)@([a-z0-9_.]{0,24})$/i.exec(text.slice(0, cursor));
  return m ? { start: cursor - m[2].length - 1, q: m[2].toLowerCase() } : null;
}

/** Replace the "@na" being typed with the full "@name ". Returns the new text and cursor. */
export function insertMention(text: string, cursor: number, start: number, u: string) {
  const before = text.slice(0, start) + '@' + u + ' ';
  return { text: before + text.slice(cursor).replace(/^\s+/, ''), cursor: before.length };
}

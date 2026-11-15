// Big frames in pieces, so small ones never wait behind them on a slow link.
//
// A photo, a voice note or a page of history can be megabytes; on a weak phone signal one such frame
// held up every text, receipt and "typing…" behind it for minutes. A frame bigger than PART goes as
// pieces ({t:'~', id, i, n, d}) and the other side says when each one has arrived ({t:'~a'}). Only
// WINDOW bytes of pieces are on their way at a time, so whatever proxies sit in between, a small frame
// sent meanwhile goes straight out and waits behind at most WINDOW bytes. Both sides do this: the
// client says it reads pieces in its 'auth' frame (ch: 1) and the server in its 'ok' frame, so either
// side talking to an older one simply sends whole frames.

export const PART = 8192;
export const WINDOW = 32768;
let nextId = 0;

/** Sending side, on a socket: whole small frames now, big ones in pieces as room frees up. */
export function sendText(ws, s) {
  if (ws.readyState !== 1) return;
  if (!ws.parts || s.length <= PART) { ws.send(s); return; }
  const id = (++nextId).toString(36);
  const n = Math.ceil(s.length / PART);
  for (let i = 0; i < n; i++) ws.parts.queue.push(JSON.stringify({ t: '~', id, i, n, d: s.slice(i * PART, (i + 1) * PART) }));
  pump(ws);
}

function pump(ws) {
  const p = ws.parts;
  while (p.queue.length && p.inflight < WINDOW && ws.readyState === 1) {
    const part = p.queue.shift();
    p.sizes.push(part.length);
    p.inflight += part.length;
    ws.send(part);
  }
}

/** A piece arrived at the other side: room for the next. */
function acked(ws) {
  const p = ws.parts;
  if (!p?.sizes.length) return;
  p.inflight -= p.sizes.shift();
  pump(ws);
}

/** Start sending in pieces (the client said it reads them). */
export function enableParts(ws) {
  ws.parts = { queue: [], sizes: [], inflight: 0, incoming: new Map(), held: 0 };
}

/**
 * Receiving side: a frame from the client that is a piece or a piece's receipt. Returns the whole
 * frame's text once its last piece is in, null while it isn't, or undefined if `m` isn't a piece at all.
 * `max` caps what one socket may hold in unfinished frames; past it the socket is closed.
 */
export function receivePart(ws, m, max) {
  if (m.t === '~a') { acked(ws); return null; }
  if (m.t !== '~') return undefined;
  const p = ws.parts;
  const { id, i, n, d } = m;
  const ok = p && typeof id === 'string' && id.length <= 16 && Number.isSafeInteger(n) && n > 1 && n * PART <= max + PART
    && Number.isSafeInteger(i) && i >= 0 && i < n && typeof d === 'string' && d.length <= PART;
  if (!ok) { ws.close(1009, 'bad part'); return null; }
  let f = p.incoming.get(id);
  if (!f) {
    if (p.incoming.size >= 8) { ws.close(1009, 'too many parts'); return null; }
    f = { n, got: [] };
    p.incoming.set(id, f);
  }
  // Pieces come in order on one socket; anything else is a broken or hostile client.
  if (f.n !== n || i !== f.got.length) { ws.close(1009, 'bad part'); return null; }
  f.got.push(d);
  p.held += d.length;
  if (p.held > max) { ws.close(1009, 'too big'); return null; }
  ws.send('{"t":"~a"}');
  if (f.got.length < n) return null;
  p.incoming.delete(id);
  const whole = f.got.join('');
  p.held -= whole.length;
  return whole;
}

// Big frames in pieces (server/parts.js): small frames go past a big one, only a window of pieces is
// out at a time, and a client can't make the server hold more than a frame's worth.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { enableParts, PART, receivePart, sendText, WINDOW } from '../server/parts.js';

function socket() {
  const ws = { readyState: 1, sent: [], closed: null, send(s) { this.sent.push(s); }, close(code, why) { this.closed = [code, why]; this.readyState = 3; } };
  return ws;
}

describe('big frames in pieces', () => {
  it('a client that doesn’t read pieces gets whole frames', () => {
    const ws = socket();
    const big = 'x'.repeat(PART * 3);
    sendText(ws, big);
    assert.deepEqual(ws.sent, [big]);
  });

  it('a big frame goes in pieces, a window at a time; a small one goes straight past', () => {
    const ws = socket();
    enableParts(ws);
    const big = JSON.stringify({ t: 'm', b: 'y'.repeat(PART * 10) });
    sendText(ws, big);
    const first = ws.sent.length;
    assert.ok(first >= 1 && first * PART <= WINDOW + PART, `only a window goes at first (${first} pieces)`);
    sendText(ws, '{"t":"m","b":"hi"}');
    assert.equal(ws.sent.at(-1), '{"t":"m","b":"hi"}', 'the text is not held behind the photo');
    // The client says each piece arrived: the rest follow, and put together they are the frame.
    for (let i = 0; i < 20; i++) receivePart(ws, { t: '~a' }, 1e6);
    const pieces = ws.sent.filter((s) => s.startsWith('{"t":"~"')).map((s) => JSON.parse(s));
    assert.equal(pieces.length, Math.ceil(big.length / PART));
    assert.equal(pieces.map((p) => p.d).join(''), big);
  });

  it('pieces from the client are put back together, each one answered', () => {
    const ws = socket();
    enableParts(ws);
    const whole = JSON.stringify({ t: 'msg', b: 'z'.repeat(PART * 2 + 5) });
    const n = Math.ceil(whole.length / PART);
    let out;
    for (let i = 0; i < n; i++) out = receivePart(ws, { t: '~', id: 'c1', i, n, d: whole.slice(i * PART, (i + 1) * PART) }, 1e6);
    assert.equal(out, whole);
    assert.equal(ws.sent.filter((s) => s === '{"t":"~a"}').length, n);
    assert.equal(receivePart(ws, { t: 'msg' }, 1e6), undefined, 'an ordinary frame is not a piece');
  });

  it('pieces out of order, too many or too big close the socket', () => {
    const skip = socket(); enableParts(skip);
    receivePart(skip, { t: '~', id: 'a', i: 1, n: 3, d: 'x' }, 1e6);
    assert.equal(skip.closed?.[0], 1009);

    const big = socket(); enableParts(big);
    for (let i = 0; i < 3 && !big.closed; i++) receivePart(big, { t: '~', id: 'b', i, n: 3, d: 'x'.repeat(PART) }, PART * 2);
    assert.equal(big.closed?.[0], 1009, 'more than a frame’s worth held');

    const many = socket(); enableParts(many);
    for (let i = 0; i < 9 && !many.closed; i++) receivePart(many, { t: '~', id: 'f' + i, i: 0, n: 2, d: 'x' }, 1e6);
    assert.equal(many.closed?.[0], 1009, 'too many frames half sent');
  });
});

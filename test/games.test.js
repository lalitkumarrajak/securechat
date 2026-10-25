// Games over the WebSocket: invites, lobby, turns enforced by the server, timeouts, chat, restarts.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { befriend, connect, name, register, sleep, startServer } from './helpers.js';

const frame = (ws, pred, ms) => ws.next('g', (m) => pred(m.g), ms).then((m) => m.g);

describe('games', () => {
  let srv, a, b, c, stranger, A, B, C;
  before(async () => {
    srv = await startServer({ GAME_TURN_MS: '700', GAME_ANIM_MS: '0' });
    [a, b, c, stranger] = await Promise.all(['ga', 'gb', 'gc', 'gs'].map((x) => register(srv, name(x))));
    await befriend(srv, a, b);
    await befriend(srv, a, c);
    [A, B, C] = await Promise.all([a, b, c].map((x) => connect(srv, x.token)));
  });
  after(async () => { for (const w of [A, B, C]) w?.close(); await srv?.stop(); });

  it('only friends can be invited, and only to known games', async () => {
    A.sendJson({ t: 'gnew', type: 'ludo', to: [stranger.u], ref: 'r1' });
    assert.match((await A.next('gerr', (m) => m.ref === 'r1')).e, /only invite friends/);
    A.sendJson({ t: 'gnew', type: 'chess?', to: [b.u], ref: 'r2' });
    assert.match((await A.next('gerr', (m) => m.ref === 'r2')).e, /Unknown game/);
  });

  let id;
  it('invites, joins and starts when everyone has answered', async () => {
    A.sendJson({ t: 'gnew', type: 'ludo', to: [b.u, c.u], ref: 'new1' });
    const g = (await A.next('g', (m) => m.ref === 'new1')).g;
    id = g.id;
    assert.equal(g.status, 'lobby');
    const inv = await frame(B, (x) => x.id === id);
    assert.equal(inv.players[0].u, a.u);
    assert.ok(inv.players.every((p) => 'n' in p));
    C.sendJson({ t: 'gdecline', id });
    await frame(A, (x) => x.id === id && x.players[2].state === 'declined');
    B.sendJson({ t: 'gjoin', id });
    const started = await frame(A, (x) => x.id === id && x.status === 'play');
    assert.equal(started.players.length, 2);
    assert.deepEqual(started.s.arm, [0, 2]);
    assert.equal(started.turn, 0);
  });

  it('the server enforces turns and rolls the dice', async () => {
    B.sendJson({ t: 'gact', id, a: { a: 'roll' } });
    assert.match((await B.next('gerr')).e, /Not your turn/);
    A.sendJson({ t: 'gact', id, a: { a: 'roll' } });
    const g = await frame(B, (x) => x.id === id && x.ev.some((e) => e.k === 'roll'));
    const d = g.ev.find((e) => e.k === 'roll').d;
    assert.ok(d >= 1 && d <= 6);
  });

  it('game chat reaches everyone in the game', async () => {
    B.sendJson({ t: 'gsay', id, x: '  Nice move!  ' });
    const line = await A.next('gc', (m) => m.id === id);
    assert.deepEqual([line.f, line.x], [b.u, 'Nice move!']);
    assert.equal(await C.gets('gc', (m) => m.id === id), false); // C declined
  });

  it('plays for a player who runs out of time, and removes them after 5 missed turns', async () => {
    // Nobody acts: turns time out (700 ms each) until someone has missed 5 in a row.
    const over = await frame(A, (x) => x.id === id && x.status === 'over', 30_000);
    const out = over.players.find((p) => p.state === 'out');
    assert.equal(out.missed, 5);
    assert.ok(over.players.some((p) => p.state === 'out'));
    assert.ok(over.players.some((p) => p.rank === 1));
  });

  it('a missed turn with bonus rolls counts once, and the bonus rolls are played quickly', async () => {
    const s2 = await startServer({ GAME_TURN_MS: '600', GAME_ANIM_MS: '0', GAME_TEST_DICE: '6,6,1' });
    try {
      const [x, y] = await Promise.all(['bx', 'by'].map((v) => register(s2, name(v))));
      await befriend(s2, x, y);
      const [X, Y] = await Promise.all([connect(s2, x.token), connect(s2, y.token)]);
      X.sendJson({ t: 'gnew', type: 'ludo', to: [y.u], ref: 'b' });
      const gid = (await X.next('g', (m) => m.ref === 'b')).g.id;
      Y.sendJson({ t: 'gjoin', id: gid });
      // X never plays: 6 (comes out), 6 (a second token comes out), 1 (moves): one turn, then Y's
      const g = await frame(Y, (v) => v.id === gid && v.status === 'play' && v.turn === 1, 5000);
      assert.equal(g.players[0].missed, 1);
      assert.deepEqual(g.s.tokens[0], [1, 0, -1, -1]);
      X.close(); Y.close();
    } finally { await s2.stop(); }
  });

  it('lists my games after reconnecting, with the chat', async () => {
    A.sendJson({ t: 'glist' });
    const { games } = await A.next('gl');
    const g = games.find((x) => x.id === id);
    assert.equal(g.chat.at(-1).x, 'Nice move!');
  });

  it('game mates can see each other’s photo, even if they aren’t friends', async () => {
    const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    assert.equal((await srv.api('/api/avatar', { img: tinyPng }, b.token)).status, 200);
    assert.equal((await srv.api('/api/avatar?u=' + b.u, undefined, c.token)).status, 404); // b and c aren't friends
    A.sendJson({ t: 'gnew', type: 'ludo', to: [b.u, c.u], ref: 'new2' });
    await A.next('g', (m) => m.ref === 'new2');
    assert.equal((await fetch(srv.base + '/api/avatar?u=' + b.u, { headers: { Authorization: 'Bearer ' + c.token } })).status, 200);
  });

  it('anyone with the link can join, friends or not; blocked people can’t', async () => {
    const S = await connect(srv, stranger.token);
    // Invite-only games can't be joined from a guessed link
    A.sendJson({ t: 'gnew', type: 'ludo', to: [b.u], ref: 'inv' });
    const closed = (await A.next('g', (m) => m.ref === 'inv')).g;
    S.sendJson({ t: 'gjoinlink', id: closed.id });
    assert.match((await S.next('gerr', (m) => m.id === closed.id)).e, /invite-only/);
    A.sendJson({ t: 'gleave', id: closed.id });

    // A game created with nobody picked is shared by link and waits for the host
    A.sendJson({ t: 'gnew', type: 'ludo', to: [], ref: 'open' });
    const g = (await A.next('g', (m) => m.ref === 'open')).g;
    assert.equal(g.open, true);
    S.sendJson({ t: 'gjoinlink', id: g.id });
    const withS = await frame(A, (x) => x.id === g.id && x.players.some((p) => p.u === stranger.u));
    assert.equal(withS.status, 'lobby'); // not started by itself
    await frame(S, (x) => x.id === g.id);

    // Someone who blocked a player in the game can't join
    const blocker = await register(srv, name('gblk'));
    await srv.api('/api/friends/block', { u: a.u }, blocker.token);
    const BL = await connect(srv, blocker.token);
    BL.sendJson({ t: 'gjoinlink', id: g.id });
    assert.match((await BL.next('gerr', (m) => m.id === g.id)).e, /can’t join/);

    // The host starts; latecomers are told it has started
    A.sendJson({ t: 'gstart', id: g.id });
    await frame(S, (x) => x.id === g.id && x.status === 'play');
    C.sendJson({ t: 'gjoinlink', id: g.id });
    assert.match((await C.next('gerr', (m) => m.id === g.id)).e, /already started/);
    A.sendJson({ t: 'gleave', id: g.id });
    S.close(); BL.close();
  });

  it('a running game survives a server restart', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chattrix-games-'));
    const env = { DATA_DIR: dir, GAME_TURN_MS: '60000', GAME_ANIM_MS: '0' };
    const s1 = await startServer(env);
    const [x, y] = await Promise.all(['rx', 'ry'].map((v) => register(s1, name(v))));
    await befriend(s1, x, y);
    const [X, Y] = await Promise.all([connect(s1, x.token), connect(s1, y.token)]);
    X.sendJson({ t: 'gnew', type: 'ludo', to: [y.u], ref: 'n' });
    const gid = (await X.next('g', (m) => m.ref === 'n')).g.id;
    Y.sendJson({ t: 'gjoin', id: gid });
    await frame(X, (g) => g.id === gid && g.status === 'play');
    X.close(); Y.close();
    await s1.stop();
    const s2 = await startServer(env);
    try {
      const X2 = await connect(s2, x.token);
      X2.sendJson({ t: 'glist' });
      const g = (await X2.next('gl')).games.find((v) => v.id === gid);
      assert.equal(g.status, 'play');
      assert.ok(g.left > 10_000); // whoever's turn it is gets time to reconnect
      X2.close();
    } finally {
      await s2.stop();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

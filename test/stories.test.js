// Stories (seen only by the friends they were shared with, sealed so the server can't read them),
// likes, comments and tags; and the relaying of call setup between two friends.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { C, befriend, connect, name, register, sleep, startServer } from './helpers.js';

let srv;
before(async () => { srv = await startServer({ CALL_RING_MS: '1500', CALL_GRACE_MS: '300' }); });
after(() => srv.stop());

// Posts a story the way the app does: sealed with a fresh key, wrapped for each friend and for me.
async function post(owner, friends, content, tags = []) {
  const id = C.randomId(18);
  const k = C.newStoryKey();
  const key = await k.key;
  const body = await C.encryptStory(key, content, owner.u, id);
  const keys = [{ u: owner.u, key: await C.wrapStoryKey(await C.storySelfKey(owner.priv, owner.pub), k.raw, owner.u, id, owner.u) }];
  for (const f of friends) {
    keys.push({ u: f.u, key: await C.wrapStoryKey(await C.conversationKey(owner.priv, f.pub, owner.u, f.u), k.raw, owner.u, id, f.u) });
  }
  const r = await srv.api('/api/stories', { id, body, keys, tags }, owner.token);
  return { id, key, r };
}

async function open(viewer, owner, id) {
  const list = (await srv.api('/api/stories', undefined, viewer.token)).data.stories;
  const s = list.find((x) => x.id === id);
  if (!s) return null;
  const wrap = viewer.u === owner.u ? await C.storySelfKey(viewer.priv, viewer.pub) : await C.conversationKey(viewer.priv, owner.pub, viewer.u, owner.u);
  const key = await C.unwrapStoryKey(wrap, s.key, owner.u, id, viewer.u);
  const { body } = (await srv.api('/api/stories/body?id=' + id, undefined, viewer.token)).data;
  return { meta: s, key, content: await C.decryptStory(key, body, owner.u, id) };
}

describe('stories', () => {
  it('reach only the friends they were shared with, who can read them; the server can’t', async () => {
    const [a, b, c, d] = await Promise.all(['sara', 'sam', 'sid', 'sue'].map((n) => register(srv, name(n))));
    await befriend(srv, a, b);
    await befriend(srv, a, c);
    const bws = await connect(srv, b.token);
    const content = { type: 'text', text: 'Beach day 🌊', bg: 2 };
    const { id, r } = await post(a, [b], content, [b.u, c.u]); // c wasn't shared with: their tag is dropped
    assert.equal(r.status, 200);
    assert.ok(r.data.exp - r.data.ts === 24 * 3600e3);
    const frame = await bws.next('story');
    assert.equal(frame.u, a.u);
    assert.equal(frame.tag, id); // b was tagged

    assert.deepEqual((await open(b, a, id)).content, content);
    assert.deepEqual((await open(a, a, id)).content, content); // the owner's other devices
    assert.equal(await open(c, a, id), null); // a friend it wasn't shared with
    assert.equal(await open(d, a, id), null); // a stranger
    assert.equal((await srv.api('/api/stories/body?id=' + id, undefined, c.token)).status, 404);
    const raw = (await srv.api('/api/stories/body?id=' + id, undefined, b.token)).data.body;
    assert.doesNotMatch(Buffer.from(raw, 'base64').toString('latin1'), /Beach/);

    // Only friends can be given a story.
    const sneaky = await post(a, [d], { type: 'text', text: 'hi' });
    assert.equal(sneaky.r.status, 200);
    assert.equal(await open(d, a, sneaky.id), null);

    // Unfriending hides the story from them.
    await srv.api('/api/friends/remove', { u: a.u }, b.token);
    assert.equal(await open(b, a, id), null);
    bws.close();
  });

  it('views, likes and comments: the owner sees them all, others only their own comments', async () => {
    const [a, b, c] = await Promise.all(['tara', 'tom', 'ted'].map((n) => register(srv, name(n))));
    await befriend(srv, a, b);
    await befriend(srv, a, c);
    const aws = await connect(srv, a.token);
    const { id, key } = await post(a, [b, c], { type: 'text', text: 'Guess where I am', bg: 0 });

    assert.equal((await srv.api('/api/stories/view', { id }, b.token)).status, 200);
    assert.equal((await aws.next('story', (m) => m.act === id)).u, a.u);
    await srv.api('/api/stories/like', { id, on: true }, b.token);
    assert.equal((await aws.next('story', (m) => m.like)).like, b.u);
    await srv.api('/api/stories/view', { id }, c.token);

    const comment = async (who, text) => {
      const cid = C.randomId(18);
      const body = await C.encryptComment(key, { text }, id, who.u, cid);
      return { cid, r: await srv.api('/api/stories/comment', { id, cid, body }, who.token) };
    };
    const bc = await comment(b, 'Goa? 🏖️');
    assert.equal(bc.r.status, 200);
    assert.equal((await aws.next('story', (m) => m.cmt)).cmt, b.u);
    await comment(c, 'Lucky you');

    const mine = (await srv.api('/api/stories', undefined, a.token)).data.stories.find((s) => s.id === id);
    assert.deepEqual([mine.views, mine.likes], [2, 1]);
    const theirs = (await srv.api('/api/stories', undefined, b.token)).data.stories.find((s) => s.id === id);
    assert.deepEqual([theirs.seen, theirs.liked, theirs.views], [true, true, undefined]);

    const act = (await srv.api('/api/stories/activity?id=' + id, undefined, a.token)).data;
    assert.deepEqual(act.views.map((v) => [v.u, v.liked]), [[b.u, true], [c.u, false]]);
    assert.equal(act.comments.length, 2);
    const first = act.comments.find((x) => x.u === b.u);
    assert.deepEqual(await C.decryptComment(key, first.b, id, b.u, first.id), { text: 'Goa? 🏖️' });
    // A comment can't be passed off as someone else's.
    await assert.rejects(C.decryptComment(key, first.b, id, c.u, first.id));

    const bAct = (await srv.api('/api/stories/activity?id=' + id, undefined, b.token)).data;
    assert.deepEqual(bAct.comments.map((x) => x.u), [b.u]);
    assert.equal(bAct.views, undefined);

    // Delete a comment: its author can, someone else can't; the owner can delete any.
    assert.equal((await srv.api('/api/stories/comment/delete', { id, cid: bc.cid }, c.token)).status, 404);
    assert.equal((await srv.api('/api/stories/comment/delete', { id, cid: bc.cid }, b.token)).status, 200);
    assert.equal((await srv.api('/api/stories/activity?id=' + id, undefined, a.token)).data.comments.length, 1);

    // Only the owner deletes the story; everyone who could see it hears about it.
    const bws = await connect(srv, b.token);
    assert.equal((await srv.api('/api/stories/delete', { id }, b.token)).status, 404);
    assert.equal((await srv.api('/api/stories/delete', { id }, a.token)).status, 200);
    assert.equal((await bws.next('story', (m) => m.gone)).gone, id);
    assert.equal((await srv.api('/api/stories/body?id=' + id, undefined, b.token)).status, 404);
    aws.close();
    bws.close();
  });

  it('rejects bad stories', async () => {
    const a = await register(srv, name('uma'));
    const k = { u: a.u, key: 'AAAA' };
    assert.equal((await srv.api('/api/stories', { id: 'short', body: 'AAAA', keys: [k] }, a.token)).status, 400);
    assert.equal((await srv.api('/api/stories', { id: C.randomId(18), body: '<b>', keys: [k] }, a.token)).status, 400);
    assert.equal((await srv.api('/api/stories', { id: C.randomId(18), body: 'AAAA', keys: [] }, a.token)).status, 400);
    assert.equal((await srv.api('/api/stories', { id: C.randomId(18), body: 'AAAA', keys: [{ u: 'someone', key: 'AAAA' }] }, a.token)).status, 400); // not mine
    assert.equal((await srv.api('/api/stories', { id: C.randomId(18), body: 'A'.repeat(2_300_000), keys: [k] }, a.token)).status, 400);
    assert.equal((await srv.api('/api/stories', undefined)).status, 401);
  });
});

describe('calls', () => {
  it('rings every device, the first to answer takes it, and setup messages are relayed', async () => {
    const [a, b] = await Promise.all(['vic', 'val'].map((n) => register(srv, name(n))));
    await befriend(srv, a, b);
    const [aws, b1, b2] = await Promise.all([connect(srv, a.token), connect(srv, b.token), connect(srv, b.token)]);
    const id = C.randomId(18);
    aws.sendJson({ t: 'call', id, to: b.u, v: 1, b: 'b2ZmZXI=' });
    assert.equal((await aws.next('cring')).on, true);
    const [r1, r2] = await Promise.all([b1.next('call'), b2.next('call')]);
    assert.deepEqual([r1.f, r1.v, r1.b, r2.id], [a.u, 1, 'b2ZmZXI=', id]);

    // A device that opens while it rings rings too.
    const b3 = await connect(srv, b.token);
    assert.equal((await b3.next('call')).id, id);

    b2.sendJson({ t: 'cans', id, b: 'YW5zd2Vy' });
    assert.equal((await aws.next('cans')).b, 'YW5zd2Vy');
    assert.equal((await b1.next('cend')).r, 'elsewhere');
    b1.sendJson({ t: 'cans', id, b: 'YW5zd2Vy' }); // too late
    assert.equal((await b1.next('cend')).r, 'elsewhere');

    aws.sendJson({ t: 'csig', id, k: 'ice', b: 'Y2FuZA==' });
    assert.equal((await b2.next('csig')).b, 'Y2FuZA==');
    assert.equal(await b1.gets('csig'), false); // only the device on the call
    b2.sendJson({ t: 'csig', id, k: 'ice', b: 'Y2FuZDI=' });
    assert.equal((await aws.next('csig')).b, 'Y2FuZDI=');

    b2.sendJson({ t: 'cend', id, r: 'ended' });
    assert.equal((await aws.next('cend')).r, 'ended');
    for (const ws of [aws, b1, b2, b3]) ws.close();
  });

  it('declined, cancelled and unanswered calls; strangers can’t call', async () => {
    const [a, b, s] = await Promise.all(['wes', 'wil', 'wyn'].map((n) => register(srv, name(n))));
    await befriend(srv, a, b);
    const [aws, bws, b2, sws] = await Promise.all([connect(srv, a.token), connect(srv, b.token), connect(srv, b.token), connect(srv, s.token)]);

    let id = C.randomId(18);
    aws.sendJson({ t: 'call', id, to: b.u, v: 0, b: 'eA==' });
    await bws.next('call');
    bws.sendJson({ t: 'cend', id, r: 'declined' });
    assert.equal((await aws.next('cend')).r, 'declined');
    assert.equal((await b2.next('cend', (m) => m.id === id)).r, 'declined'); // stops ringing on their other phone

    id = C.randomId(18);
    aws.sendJson({ t: 'call', id, to: b.u, v: 0, b: 'eA==' });
    await bws.next('call', (m) => m.id === id);
    aws.sendJson({ t: 'cend', id, r: 'ended' });
    assert.equal((await bws.next('cend', (m) => m.id === id)).r, 'cancelled');

    id = C.randomId(18);
    aws.sendJson({ t: 'call', id, to: b.u, v: 0, b: 'eA==' });
    assert.equal((await bws.next('cend', (m) => m.id === id, 4000)).r, 'missed'); // CALL_RING_MS
    assert.equal((await aws.next('cend', (m) => m.id === id)).r, 'missed');

    id = C.randomId(18);
    sws.sendJson({ t: 'call', id, to: a.u, v: 0, b: 'eA==' });
    assert.equal((await sws.next('cend', (m) => m.id === id)).r, 'failed');
    assert.equal(await aws.gets('call', (m) => m.id === id), false);
    for (const ws of [aws, bws, b2, sws]) ws.close();
  });

  it('a caller who disappears cancels the call', async () => {
    const [a, b] = await Promise.all(['xia', 'xan'].map((n) => register(srv, name(n))));
    await befriend(srv, a, b);
    const [aws, bws] = await Promise.all([connect(srv, a.token), connect(srv, b.token)]);
    const id = C.randomId(18);
    aws.sendJson({ t: 'call', id, to: b.u, v: 0, b: 'eA==' });
    await bws.next('call');
    aws.terminate();
    assert.equal((await bws.next('cend', (m) => m.id === id, 8000)).r, 'cancelled');
    bws.close();
    await sleep(10);
  });

  it('gives the app STUN servers (and TURN when configured)', async () => {
    const a = await register(srv, name('yan'));
    const r = await srv.api('/api/ice', undefined, a.token);
    assert.equal(r.status, 200);
    assert.ok(r.data.iceServers[0].urls.some((u) => u.startsWith('stun:')));
    assert.equal(r.data.relay, false);
    const t = await startServer({ TURN_URLS: 'turn:turn.example.com:3478', TURN_SECRET: 's3cret' });
    try {
      const u = await register(t, name('zed'));
      const ice = (await t.api('/api/ice', undefined, u.token)).data;
      const turn = ice.iceServers.find((x) => x.urls.includes('turn:turn.example.com:3478'));
      assert.match(turn.username, new RegExp(`^\\d+:${u.u}$`));
      assert.ok(turn.credential.length > 20);
      assert.equal(ice.relay, true);
    } finally { await t.stop(); }
  });
});

// Sign-in locations and device details in the sessions list, and the new sign-in alert.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { C, connect, name, register, startServer } from './helpers.js';

describe('sign-in locations and alerts', () => {
  let srv, geo, asked = 0;
  before(async () => {
    geo = http.createServer((req, res) => {
      asked++;
      res.writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ success: true, city: 'Pune', region: 'Maharashtra', country: 'India', country_code: 'IN', connection: { isp: 'Airtel' } }));
    }).listen(0);
    srv = await startServer({ GEOIP_URL: `http://localhost:${geo.address().port}/{ip}`, GEOIP_ALLOW_PRIVATE: '1' });
  });
  after(async () => { await srv?.stop(); geo?.close(); });

  it('shows where and on what each device signed in, and alerts the other devices', async () => {
    const a = await register(srv, name('geo'));
    const A = await connect(srv, a.token);
    const { auth } = await C.deriveFromPassword(a.u, a.pw);
    const r = await srv.api('/api/login', { u: a.u, auth, dev: { model: 'Pixel 9<script>', pv: '15.0.0', platform: 'Android' } });
    assert.equal(r.status, 200);

    const alert = await A.next('signin');
    assert.equal(alert.loc.city, 'Pune');
    assert.equal(alert.device.model, 'Pixel 9script'); // stripped of markup

    const { sessions } = (await srv.api('/api/sessions', undefined, a.token)).data;
    const phone = sessions.find((s) => !s.current);
    assert.deepEqual(phone.loc, { city: 'Pune', region: 'Maharashtra', country: 'India', cc: 'IN', isp: 'Airtel' });
    assert.equal(phone.device.pv, '15.0.0');
    const before = asked;
    await srv.api('/api/sessions', undefined, a.token);
    assert.equal(asked, before); // cached
    A.close();
  });

  it('lists sessions without a location when the lookup service is down', async () => {
    const s2 = await startServer({ GEOIP_URL: 'http://localhost:1/{ip}', GEOIP_ALLOW_PRIVATE: '1' });
    try {
      const a = await register(s2, name('nogeo'));
      const r = await s2.api('/api/sessions', undefined, a.token);
      assert.equal(r.status, 200);
      assert.equal(r.data.sessions[0].loc, null);
    } finally { await s2.stop(); }
  });
});

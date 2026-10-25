// Approximate location of an IP address, for the active-sessions list and new sign-in alerts.
// Uses a free lookup service: ipwho.is by default; GEOIP_URL (with {ip}) picks another, such as
// http://ip-api.com/json/{ip}, and GEOIP_URL= (empty) turns lookups off. Results are cached for a
// day. Local network addresses aren't looked up.
import { config } from './config.js';

const cache = new Map(); // ip -> { v, exp }
const LOCAL = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|f[cd]|fe80:|localhost$)/i;
const str = (v) => (typeof v === 'string' ? v.slice(0, 60) : '');

// ipwho.is and ip-api.com answer in different shapes.
function parse(d) {
  if (d?.success === true) {
    return { city: str(d.city), region: str(d.region), country: str(d.country), cc: str(d.country_code), isp: str(d.connection?.isp || d.connection?.org) };
  }
  if (d?.status === 'success') {
    return { city: str(d.city), region: str(d.regionName), country: str(d.country), cc: str(d.countryCode), isp: str(d.isp) };
  }
  return null;
}

/** { city, region, country, cc, isp }, { local: true } for local addresses, or null if unknown. */
export async function locate(ip) {
  const bare = String(ip || '').replace(/^::ffff:/, '');
  if (!bare || !config.geoipUrl) return null;
  if (LOCAL.test(bare) && !config.geoipAllowPrivate) return { local: true };
  const hit = cache.get(bare);
  if (hit && hit.exp > Date.now()) return hit.v;
  let v = null;
  try {
    const res = await fetch(config.geoipUrl.replace('{ip}', encodeURIComponent(bare)), {
      headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3000),
    });
    if (res.ok) v = parse(await res.json());
  } catch { /* service down or slow: show no location */ }
  if (cache.size > 5000) cache.clear();
  cache.set(bare, { v, exp: Date.now() + (v ? 864e5 : 10 * 60e3) });
  return v;
}

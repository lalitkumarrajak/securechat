// Turns a browser's user-agent string into a readable device name for the sessions list.
import type { DeviceHints, Place } from './types';
import { t, tk } from '@sanga/i18n';
export interface Device { browser: string; os: string; kind: 'phone' | 'tablet' | 'desktop' }

export function parseDevice(ua: string): Device | null {
  if (!ua) return null;
  const os =
    /iPhone/.test(ua) ? 'iPhone' :
    /iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile\//.test(ua)) ? 'iPad' :
    /Android/.test(ua) ? 'Android' : // i18n-ok
    /Windows/.test(ua) ? 'Windows' : // i18n-ok
    /CrOS/.test(ua) ? 'ChromeOS' :
    /Mac OS X|Macintosh/.test(ua) ? 'Mac' : // i18n-ok
    /Linux/.test(ua) ? 'Linux' : tk('Unknown system'); // i18n-ok
  const browser =
    /EdgA?\//.test(ua) ? 'Edge' : // i18n-ok
    /OPR\/|Opera/.test(ua) ? 'Opera' : // i18n-ok
    /SamsungBrowser\//.test(ua) ? 'Samsung Internet' : // i18n-ok
    /Firefox\/|FxiOS\//.test(ua) ? 'Firefox' : // i18n-ok
    /CriOS\/|Chrome\//.test(ua) ? 'Chrome' : // i18n-ok
    /Safari\//.test(ua) ? 'Safari' : // i18n-ok
    /node|undici/i.test(ua) ? tk('App') : tk('Browser');
  const kind = os === 'iPad' || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'tablet'
    : os === 'iPhone' || os === 'Android' ? 'phone' : 'desktop';
  return { browser, os, kind };
}

/** The OS with its version, when the browser shared it (client hints): "Android 14", "Windows 11". */
export function osVersion(ua: string, hints?: DeviceHints | null) {
  const os = parseDevice(ua)?.os;
  const major = parseInt(hints?.pv || '', 10);
  if (!os || !major) return os ? t(os) : ''; // brand names have no entry: t() leaves them as they are
  if (os === 'Windows') return major >= 13 ? 'Windows 11' : 'Windows 10';
  if (os === 'Mac') return `macOS ${major}`;
  if (os === 'Android' || os === 'ChromeOS') return `${os} ${major}`;
  return os;
}

/** "Chrome on SM-S918B" when the phone model is known, otherwise "Chrome on Android". */
export const deviceName = (ua: string, hints?: DeviceHints | null) => {
  const d = parseDevice(ua);
  if (!d) return t('Unknown device');
  return t('{browser} on {device}', { browser: t(d.browser), device: hints?.model || osVersion(ua, hints) || t(d.os) });
};

/** "Delhi, Delhi, India", or "Local network". */
export function placeName(p: Place | null | undefined) {
  if (!p) return '';
  if (p.local) return t('Local network');
  return [p.city, p.region !== p.city ? p.region : '', p.country].filter(Boolean).join(', ');
}

/** What the browser will tell about the device (Chrome, Edge, Samsung Internet; not Safari or Firefox). */
export async function deviceHints(): Promise<DeviceHints | undefined> {
  const uad = (navigator as Navigator & { userAgentData?: any }).userAgentData;
  if (!uad?.getHighEntropyValues) return undefined;
  try {
    const h = await uad.getHighEntropyValues(['model', 'platformVersion']);
    return { model: h.model || '', pv: h.platformVersion || '', platform: uad.platform || '' };
  } catch { return undefined; }
}

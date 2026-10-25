// Turns a browser's user-agent string into a readable device name for the sessions list.
export interface Device { browser: string; os: string; kind: 'phone' | 'tablet' | 'desktop' }

export function parseDevice(ua: string): Device | null {
  if (!ua) return null;
  const os =
    /iPhone/.test(ua) ? 'iPhone' :
    /iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile\//.test(ua)) ? 'iPad' :
    /Android/.test(ua) ? 'Android' :
    /Windows/.test(ua) ? 'Windows' :
    /CrOS/.test(ua) ? 'ChromeOS' :
    /Mac OS X|Macintosh/.test(ua) ? 'Mac' :
    /Linux/.test(ua) ? 'Linux' : 'Unknown system';
  const browser =
    /EdgA?\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /SamsungBrowser\//.test(ua) ? 'Samsung Internet' :
    /Firefox\/|FxiOS\//.test(ua) ? 'Firefox' :
    /CriOS\/|Chrome\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' :
    /node|undici/i.test(ua) ? 'App' : 'Browser';
  const kind = os === 'iPad' || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'tablet'
    : os === 'iPhone' || os === 'Android' ? 'phone' : 'desktop';
  return { browser, os, kind };
}

export const deviceName = (ua: string) => {
  const d = parseDevice(ua);
  return d ? `${d.browser} on ${d.os}` : 'Unknown device';
};

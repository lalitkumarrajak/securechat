// Location messages: coordinates only, shown on an OpenStreetMap tile with a pin.
export interface LocationContent { lat: number; lng: number; acc: number }

const read = (opts: PositionOptions) => new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, opts));

/** Where you are. A quick, network-based fix first (fast on laptops, which often have no GPS and time out
 *  when asked for a precise one); only if that fails, the precise one. Errors say what to do about them. */
export async function currentLocation(): Promise<LocationContent> {
  if (!('geolocation' in navigator)) throw new Error('Location isn’t available in this browser.');
  if (!window.isSecureContext) throw new Error('Location only works on a secure (https) page.');
  let p: GeolocationPosition;
  try {
    p = await read({ enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 });
  } catch (first) {
    if ((first as GeolocationPositionError).code === 1) throw denied();
    try { p = await read({ enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }); }
    catch (e) { throw (e as GeolocationPositionError).code === 1 ? denied() : failed((e as GeolocationPositionError).code); }
  }
  return { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy) };
}

const denied = () => new Error('Location is blocked for Sanga. Tap the lock icon next to the address, allow Location, then try again.');
const failed = (code: number) => new Error(code === 3
  ? 'Finding your location took too long. Check that Location is on for your device and browser, then try again.'
  : 'Your device couldn’t work out where you are. Turn on Location (and Wi-Fi) in your device settings, then try again.');

/** Web Mercator tile maths: which tile a point is in at `zoom`, and where inside it (0–1). */
export function tileOf(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return { x: Math.floor(x), y: Math.floor(y), fx: x - Math.floor(x), fy: y - Math.floor(y) };
}

export const mapsLink = (l: LocationContent) => `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`;

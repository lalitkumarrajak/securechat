// Location messages: coordinates only, shown on an OpenStreetMap tile with a pin.
export interface LocationContent { lat: number; lng: number; acc: number }

export function currentLocation(): Promise<LocationContent> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Location isn’t available in this browser.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy) }),
      (e) => reject(new Error(e.code === 1 ? 'Location permission was denied. Allow it in your browser settings.' : 'Couldn’t get your location. Try again outdoors or with Wi-Fi on.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}

/** Web Mercator tile maths: which tile a point is in at `zoom`, and where inside it (0–1). */
export function tileOf(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return { x: Math.floor(x), y: Math.floor(y), fx: x - Math.floor(x), fy: y - Math.floor(y) };
}

export const mapsLink = (l: LocationContent) => `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`;

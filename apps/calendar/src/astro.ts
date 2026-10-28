// Positions of the sun and moon, and when they rise and set, from Jean Meeus' "Astronomical
// Algorithms" (the sun from chapter 25, the moon from chapter 47's series, rising and setting by
// searching the altitude). The moon's longitude is good to a few arc-seconds, which puts a tithi's
// start within a minute or two of a printed panchang. Times are JavaScript timestamps (ms, UTC).

const RAD = Math.PI / 180;
const sin = (d: number) => Math.sin(d * RAD);
const cos = (d: number) => Math.cos(d * RAD);
export const norm = (d: number) => ((d % 360) + 360) % 360;

const jd = (ms: number) => ms / 86400000 + 2440587.5;
const centuries = (ms: number) => (jd(ms) - 2451545) / 36525;

/** The sun's apparent (tropical) ecliptic longitude, degrees. */
export function sunLongitude(ms: number) {
  const T = centuries(ms);
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M) + (0.019993 - 0.000101 * T) * sin(2 * M) + 0.000289 * sin(3 * M);
  const omega = 125.04 - 1934.136 * T;
  return norm(L0 + C - 0.00569 - 0.00478 * sin(omega));
}

// Periodic terms for the moon's longitude and latitude: multiples of D, M, M', F and the
// coefficient in millionths of a degree.
const LON: number[][] = [
  [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618], [0, 1, 0, 0, -185116],
  [0, 0, 0, 2, -114332], [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066], [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758],
  [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720], [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528],
  [0, 0, 1, -2, 10980], [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034], [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888],
  [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036], [2, 0, 2, 0, 3994],
  [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665], [0, 1, -2, 0, -2689], [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390],
  [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236], [0, 1, 2, 0, -2120], [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048],
  [2, 0, 1, -2, -1773], [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110], [3, 0, -1, 0, -892],
  [2, 1, 1, 0, -810], [4, -1, -2, 0, 759], [0, 2, -1, 0, -713], [2, 2, -1, 0, -700], [2, 1, -2, 0, 691],
  [2, -1, 0, -2, 596], [4, 0, 1, 0, 549], [0, 0, 4, 0, 537], [4, -1, 0, 0, 520], [1, 0, -2, 0, -487],
  [2, 1, 0, -2, -399], [0, 0, 2, -2, -381], [1, 1, 1, 0, 351], [3, 0, -2, 0, -340], [4, 0, -3, 0, 330],
  [2, -1, 2, 0, 327], [0, 2, 1, 0, -323], [1, 1, -1, 0, 299], [2, 0, 3, 0, 294],
];
const LAT: number[][] = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237], [2, 0, -1, 1, 55413],
  [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198], [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822],
  [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324], [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463],
  [2, -1, 0, 1, 2211], [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870], [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749], [0, 1, -1, 1, -1565], [1, 0, 0, 1, -1491], [0, 1, 1, 1, -1475], [0, 1, 1, -1, -1410],
  [0, 1, 0, -1, -1344], [1, 0, 0, -1, -1335], [0, 0, 3, 1, 1107], [4, 0, 0, -1, 1021], [4, 0, -1, 1, 833],
];

/** The moon's apparent (tropical) ecliptic longitude and latitude, degrees. */
export function moonPosition(ms: number) {
  const T = centuries(ms);
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000;
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.29 * T, A3 = 313.45 + 481266.484 * T;
  const sum = (terms: number[][], fn: (x: number) => number) => terms.reduce((s, [d, m, mp, f, c]) => {
    const e = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
    return s + c * e * fn(d * D + m * M + mp * Mp + f * F);
  }, 0);
  const l = sum(LON, sin) + 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
  const b = sum(LAT, sin) - 2235 * sin(Lp) + 382 * sin(A3) + 175 * sin(A1 - F) + 175 * sin(A1 + F) + 127 * sin(Lp - Mp) - 115 * sin(Lp + Mp);
  const omega = 125.04452 - 1934.136261 * T;
  return { lon: norm(Lp + l / 1e6 - 0.00478 * sin(omega)), lat: b / 1e6 };
}

/** Lahiri (Chitrapaksha) ayanamsa, degrees: tropical minus sidereal longitude. */
export function ayanamsa(ms: number) {
  const T = centuries(ms);
  return 23.853 + 1.39666 * T + 0.000308 * T * T;
}
export const sidereal = (tropical: number, ms: number) => norm(tropical - ayanamsa(ms));

// ---------- rising and setting ----------
function altitude(ms: number, lon: number, lat: number, eclLon: number, eclLat: number) {
  const T = centuries(ms);
  const eps = 23.439291 - 0.0130042 * T;
  const ra = Math.atan2(sin(eclLon) * cos(eps) - Math.tan(eclLat * RAD) * sin(eps), cos(eclLon)) / RAD;
  const dec = Math.asin(sin(eclLat) * cos(eps) + cos(eclLat) * sin(eps) * sin(eclLon)) / RAD;
  const gmst = 280.46061837 + 360.98564736629 * (jd(ms) - 2451545) + 0.000387933 * T * T;
  const H = gmst + lon - ra;
  return Math.asin(sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(H)) / RAD;
}
const sunAlt = (ms: number, p: Place) => altitude(ms, p.lon, p.lat, sunLongitude(ms), 0) + 0.8333; // upper limb, refraction
const moonAlt = (ms: number, p: Place) => { const m = moonPosition(ms); return altitude(ms, p.lon, p.lat, m.lon, m.lat) - 0.125; };

export interface Place { lat: number; lon: number }

/** When `alt` crosses zero going up (rise) or down (set) between `from` and `to`, or null. */
function crossing(alt: (ms: number) => number, from: number, to: number, rising: boolean) {
  const step = 15 * 60e3;
  let t0 = from, a0 = alt(t0);
  for (let t1 = from + step; t1 <= to + step; t1 += step) {
    const a1 = alt(Math.min(t1, to));
    if (rising ? a0 < 0 && a1 >= 0 : a0 > 0 && a1 <= 0) {
      let lo = t0, hi = Math.min(t1, to);
      while (hi - lo > 20e3) { const mid = (lo + hi) / 2; if ((alt(mid) < 0) === rising) lo = mid; else hi = mid; }
      return Math.round((lo + hi) / 2);
    }
    t0 = t1; a0 = a1;
    if (t1 >= to) break;
  }
  return null;
}

/** Sunrise and sunset on the local day that starts at `dayStart` (local midnight, ms). */
export function sunTimes(dayStart: number, p: Place) {
  const end = dayStart + 86400e3;
  const alt = (ms: number) => sunAlt(ms, p);
  // Fallbacks for the polar summer/winter, where the sun may not rise or set.
  return { rise: crossing(alt, dayStart, end, true) ?? dayStart + 6 * 3600e3, set: crossing(alt, dayStart, end, false) ?? dayStart + 18 * 3600e3 };
}

/** Moonrise on the local day that starts at `dayStart`, or null (some days the moon doesn't rise). */
export const moonrise = (dayStart: number, p: Place) => crossing((ms) => moonAlt(ms, p), dayStart, dayStart + 86400e3, true);
export const moonset = (dayStart: number, p: Place) => crossing((ms) => moonAlt(ms, p), dayStart, dayStart + 86400e3, false);

// ---------- solving for when something happens ----------
/** The time near `guess` when `f` (an angle, degrees) reaches `target`, for an f that grows by about
 *  `rate` degrees a day. Newton's method; good to a few seconds. */
export function when(f: (ms: number) => number, target: number, guess: number, rate: number) {
  let t = guess;
  for (let i = 0; i < 30; i++) {
    let diff = norm(target - f(t));
    if (diff > 180) diff -= 360;
    if (Math.abs(diff) < 1e-5) break;
    t += (diff / rate) * 86400e3;
  }
  return Math.round(t);
}

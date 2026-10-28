// The Hindu calendar (panchang), worked out on the device from the sun and moon (astro.ts): for any
// day, the tithi, paksha, nakshatra, yoga, lunar month (with adhik maas) and samvat; and for a year,
// the festivals and fasts, each on the day the common (Smarta) rule puts it, at the chosen place.
//
// A tithi is each 12° the moon gains on the sun. A festival falls on the day its tithi prevails at
// the time of day it belongs to: sunrise for most, midday for Ganesh Chaturthi, the evening (pradosh)
// for Diwali and Pradosh vrat, midnight (nishita) for Shivratri, moonrise for Karva Chauth and
// Sankashti. A tithi that touches no such moment goes to the day it holds at sunrise, or (kshaya,
// at no sunrise either) the day it begins. Holika Dahan waits for Bhadra (the first half of Purnima)
// to end, and Raksha Bandhan needs Purnima to last a while after sunrise.
// Months are amanta (new moon to new moon) inside; the screen can show them purnimanta.
import { ayanamsa, moonPosition, moonrise, norm, type Place, sidereal, sunLongitude, sunTimes, when } from './astro';

export const MONTHS = ['Chaitra', 'Vaishakha', 'Jyeshtha', 'Ashadha', 'Shravana', 'Bhadrapada', 'Ashwin', 'Kartika', 'Margashirsha', 'Pausha', 'Magha', 'Phalguna'];
export const TITHIS = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami',
  'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi'];
export const NAKSHATRAS = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha',
  'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha',
  'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
export const YOGAS = ['Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma', 'Dhriti', 'Shula', 'Ganda', 'Vriddhi',
  'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyana', 'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla',
  'Brahma', 'Indra', 'Vaidhriti'];
export const RASHIS = ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'];

/** Tithi n (1–30) as a name: 1–15 bright half (Shukla, ending in Purnima), 16–30 dark half (Krishna, ending in Amavasya). */
export const tithiName = (n: number) => (n === 15 ? 'Purnima' : n === 30 ? 'Amavasya' : TITHIS[(n - 1) % 15]);
export const pakshaOf = (n: number) => (n <= 15 ? 'Shukla' : 'Krishna');

// ---------- the moon and sun at a moment ----------
const DAY = 86400e3;
const elongation = (ms: number) => norm(moonPosition(ms).lon - sunLongitude(ms));
const moonSid = (ms: number) => sidereal(moonPosition(ms).lon, ms);
const sunSid = (ms: number) => sidereal(sunLongitude(ms), ms);
const TITHI_RATE = 12.19; // degrees a day, on average

export const tithiAt = (ms: number) => Math.floor(elongation(ms) / 12) + 1;
/** When the tithi in force at `ms` began and ends. */
export function tithiSpan(ms: number) {
  const n = tithiAt(ms), e = elongation(ms);
  const start = when(elongation, (n - 1) * 12, ms - ((e - (n - 1) * 12) / TITHI_RATE) * DAY, TITHI_RATE);
  const end = when(elongation, (n * 12) % 360, ms + ((n * 12 - e) / TITHI_RATE) * DAY, TITHI_RATE);
  return { n, start, end };
}
export function nakshatraAt(ms: number) {
  const s = moonSid(ms), i = Math.floor(s / (40 / 3));
  return { i, name: NAKSHATRAS[i], end: when(moonSid, ((i + 1) * 40 / 3) % 360, ms + (((i + 1) * 40 / 3 - s) / 13.18) * DAY, 13.18) };
}
export function yogaAt(ms: number) {
  const s = norm(sidereal(sunLongitude(ms), ms) + moonSid(ms));
  return YOGAS[Math.floor(s / (40 / 3))];
}
/** The moon's phase as an emoji, at `ms`. */
export function moonEmoji(ms: number) {
  return ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'][Math.round(elongation(ms) / 45) % 8];
}

export function newMoonBefore(ms: number) {
  const e = elongation(ms);
  return when(elongation, 0, ms - (e / TITHI_RATE) * DAY, TITHI_RATE);
}
const newMoonAfter = (ms: number) => when(elongation, 0, ms + ((360 - elongation(ms)) / TITHI_RATE) * DAY, TITHI_RATE);

export interface LunarMonth { index: number; adhik: boolean; start: number; end: number }
const monthCache = new Map<number, LunarMonth>();
/** The (amanta) lunar month in force at `ms`: named for the sign the sun enters during it; a month in
 *  which the sun enters none is adhik (extra), and takes the name of the month after it. */
export function lunarMonth(ms: number): LunarMonth {
  const start = newMoonBefore(ms);
  const key = Math.round(start / 60e3);
  let m = monthCache.get(key);
  if (!m) {
    const end = newMoonAfter(start + 2 * DAY);
    const r0 = Math.floor(sunSid(start) / 30), r1 = Math.floor(sunSid(end) / 30);
    m = { index: (r0 + 1) % 12, adhik: r0 === r1, start, end };
    if (monthCache.size > 500) monthCache.clear();
    monthCache.set(key, m);
  }
  return m;
}

// ---------- days ----------
const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dayStart = (key: string) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
export const addDays = (key: string, n: number) => { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y, m - 1, d + n)); };

interface Sun { start: number; rise: number; set: number; nextRise: number }
const sunCache = new Map<string, Sun>();
function sun(key: string, p: Place): Sun {
  const k = `${key}|${p.lat}|${p.lon}`;
  let s = sunCache.get(k);
  if (!s) {
    const start = dayStart(key), t = sunTimes(start, p);
    s = { start, rise: t.rise, set: t.set, nextRise: sunTimes(dayStart(addDays(key, 1)), p).rise };
    if (sunCache.size > 3000) sunCache.clear();
    sunCache.set(k, s);
  }
  return s;
}

/** The moments of a day festivals are judged at. */
export type Kala = 'sunrise' | 'madhyahna' | 'aparahna' | 'pradosh' | 'nishita' | 'moonrise';
function kalaTime(key: string, k: Kala, p: Place) {
  const s = sun(key, p), daylight = s.set - s.rise;
  switch (k) {
    case 'sunrise': return s.rise;
    case 'madhyahna': return s.rise + daylight * 0.5;
    case 'aparahna': return s.rise + daylight * 0.7;
    case 'pradosh': return s.set + 45 * 60e3;
    case 'nishita': return (s.set + s.nextRise) / 2;
    case 'moonrise': return moonrise(s.start, p) ?? s.set + 3 * 3600e3;
  }
}

/** Everything about one day, at sunrise (as a panchang gives it). */
export function panchang(key: string, p: Place) {
  const s = sun(key, p);
  const t = tithiSpan(s.rise);
  const m = lunarMonth(s.rise);
  const [y, mo] = key.split('-').map(Number);
  // Vikram Samvat changes at Chaitra Shukla Pratipada; until then (Jan–Mar) it's the year before's.
  const vikram = y + (mo <= 4 && m.index >= 9 ? 56 : 57);
  return {
    key, sunrise: s.rise, sunset: s.set, moonrise: moonrise(s.start, p),
    tithi: t.n, tithiName: tithiName(t.n), tithiEnds: t.end, paksha: pakshaOf(t.n),
    nakshatra: nakshatraAt(s.rise), yoga: yogaAt(s.rise),
    month: m, vikram, shaka: vikram - 135, moon: moonEmoji(s.start + DAY / 2),
    sunSign: RASHIS[Math.floor(sunSid(s.rise) / 30)],
  };
}
export type Panchang = ReturnType<typeof panchang>;

/** The month's name as shown: amanta (new moon to new moon, south and west India) or purnimanta
 *  (full moon to full moon, north India: the dark half takes the next month's name). */
export function monthName(m: LunarMonth, tithi: number, style: 'amanta' | 'purnimanta') {
  const index = style === 'purnimanta' && tithi > 15 && !m.adhik ? (m.index + 1) % 12 : m.index;
  return (m.adhik ? 'Adhik ' : '') + MONTHS[index];
}

// ---------- festivals and fasts ----------
export type Group = 'festivals' | 'ekadashi' | 'pradosh' | 'sankashti' | 'vinayaka' | 'purnima' | 'amavasya' | 'shivratri' | 'durgashtami' | 'sankranti' | 'national';
export interface Observance {
  id: string;        // stable: what it is and its date, e.g. "diwali-2026"
  day: string;       // YYYY-MM-DD
  name: string;
  group: Group;
  emoji: string;
  fast?: boolean;    // a day people fast
  about?: string;
  times?: { label: string; at: number; to?: number }[]; // moonrise, parana…
}

interface Rule { id: string; name: string; month: number; tithi: number; kala: Kala; emoji: string; fast?: boolean; about?: string; after?: number; minHours?: number }
// Months are amanta: 0 Chaitra … 11 Phalguna. Tithi 1–15 Shukla, 16–30 Krishna.
const FESTIVALS: Rule[] = [
  { id: 'ugadi', name: 'Gudi Padwa · Ugadi · Chaitra Navratri begins', month: 0, tithi: 1, kala: 'sunrise', emoji: '🌸', about: 'Hindu New Year (Vikram Samvat) in much of India; the nine nights of Chaitra Navratri begin.' },
  { id: 'ram-navami', name: 'Ram Navami', month: 0, tithi: 9, kala: 'madhyahna', emoji: '🏹', fast: true, about: 'Birth of Lord Rama, at midday. Many fast until noon or all day.' },
  { id: 'hanuman-jayanti', name: 'Hanuman Jayanti', month: 0, tithi: 15, kala: 'sunrise', emoji: '🙏', about: 'Birth of Lord Hanuman (north India).' },
  { id: 'akshaya-tritiya', name: 'Akshaya Tritiya', month: 1, tithi: 3, kala: 'sunrise', emoji: '🪙', about: 'An auspicious day for new beginnings, buying gold and giving.' },
  { id: 'buddha-purnima', name: 'Buddha Purnima', month: 1, tithi: 15, kala: 'sunrise', emoji: '☸️', about: 'Birth, enlightenment and passing of the Buddha.' },
  { id: 'vat-savitri', name: 'Vat Savitri Vrat', month: 1, tithi: 30, kala: 'sunrise', emoji: '🌳', fast: true, about: 'Married women fast and pray around the banyan tree for their husbands (north India).' },
  { id: 'ganga-dussehra', name: 'Ganga Dussehra', month: 2, tithi: 10, kala: 'sunrise', emoji: '🌊', about: 'Descent of the Ganga to earth.' },
  { id: 'rath-yatra', name: 'Jagannath Rath Yatra', month: 3, tithi: 2, kala: 'sunrise', emoji: '🛕', about: 'Lord Jagannath’s chariot festival, Puri.' },
  { id: 'guru-purnima', name: 'Guru Purnima', month: 3, tithi: 15, kala: 'sunrise', emoji: '📿', about: 'A day to honour one’s teachers.' },
  { id: 'hariyali-teej', name: 'Hariyali Teej', month: 4, tithi: 3, kala: 'sunrise', emoji: '🌿', fast: true, about: 'Women fast for marital happiness; swings, green clothes and songs.' },
  { id: 'nag-panchami', name: 'Nag Panchami', month: 4, tithi: 5, kala: 'sunrise', emoji: '🐍', about: 'Worship of the serpent deities.' },
  { id: 'raksha-bandhan', name: 'Raksha Bandhan', month: 4, tithi: 15, kala: 'sunrise', minHours: 2.4, emoji: '🪢', about: 'Sisters tie a rakhi on their brothers’ wrists.' },
  { id: 'kajari-teej', name: 'Kajari Teej', month: 4, tithi: 18, kala: 'sunrise', emoji: '🌙', fast: true, about: 'Women fast and pray to the neem tree and the moon.' },
  { id: 'janmashtami', name: 'Krishna Janmashtami', month: 4, tithi: 23, kala: 'sunrise', emoji: '🦚', fast: true, about: 'Birth of Lord Krishna at midnight. Fast until the midnight puja.' },
  { id: 'hartalika-teej', name: 'Hartalika Teej', month: 5, tithi: 3, kala: 'sunrise', emoji: '🌺', fast: true, about: 'A strict (often nirjala) fast by women for Shiva and Parvati.' },
  { id: 'ganesh-chaturthi', name: 'Ganesh Chaturthi', month: 5, tithi: 4, kala: 'madhyahna', emoji: '🐘', about: 'Ganesha comes home; ten days end at Anant Chaturdashi. Don’t look at the moon tonight.' },
  { id: 'rishi-panchami', name: 'Rishi Panchami', month: 5, tithi: 5, kala: 'madhyahna', emoji: '🧘', fast: true },
  { id: 'anant-chaturdashi', name: 'Anant Chaturdashi · Ganesh Visarjan', month: 5, tithi: 14, kala: 'sunrise', emoji: '🌊' },
  { id: 'pitru-amavasya', name: 'Sarva Pitru Amavasya · Mahalaya', month: 5, tithi: 30, kala: 'aparahna', emoji: '🪔', about: 'The last day of Pitru Paksha: shraddha for all ancestors.' },
  { id: 'navratri', name: 'Sharad Navratri begins · Ghatasthapana', month: 6, tithi: 1, kala: 'sunrise', emoji: '🔱', fast: true, about: 'Nine nights of the Goddess. Many fast all nine days, or the first and last.' },
  { id: 'durga-ashtami', name: 'Durga Ashtami', month: 6, tithi: 8, kala: 'sunrise', emoji: '🌺', fast: true, about: 'Kanya puja in many homes.' },
  { id: 'maha-navami', name: 'Maha Navami', month: 6, tithi: 9, kala: 'sunrise', emoji: '🔱' },
  { id: 'dussehra', name: 'Dussehra · Vijayadashami', month: 6, tithi: 10, kala: 'aparahna', emoji: '🏹', about: 'Victory of good over evil: Rama over Ravana, Durga over Mahishasura.' },
  { id: 'sharad-purnima', name: 'Sharad Purnima', month: 6, tithi: 15, kala: 'pradosh', emoji: '🌕', about: 'Kheer is left out under the full moon overnight.' },
  { id: 'karva-chauth', name: 'Karva Chauth', month: 6, tithi: 19, kala: 'moonrise', emoji: '🌙', fast: true, about: 'Married women fast from sunrise without food or water until they see the moon.' },
  { id: 'ahoi-ashtami', name: 'Ahoi Ashtami', month: 6, tithi: 23, kala: 'pradosh', emoji: '⭐', fast: true, about: 'Mothers fast for their children until the stars come out.' },
  { id: 'dhanteras', name: 'Dhanteras', month: 6, tithi: 28, kala: 'pradosh', emoji: '🪙', about: 'Diwali begins: buy something new, light a lamp for Yama.' },
  { id: 'choti-diwali', name: 'Narak Chaturdashi · Choti Diwali', month: 6, tithi: 29, kala: 'sunrise', emoji: '🪔' },
  { id: 'diwali', name: 'Diwali · Lakshmi Puja', month: 6, tithi: 30, kala: 'pradosh', emoji: '🪔', about: 'The festival of lights. Lakshmi puja in the evening.' },
  { id: 'govardhan', name: 'Govardhan Puja', month: 7, tithi: 1, kala: 'sunrise', emoji: '⛰️' },
  { id: 'bhai-dooj', name: 'Bhai Dooj', month: 7, tithi: 2, kala: 'aparahna', emoji: '🤝', about: 'Sisters pray for their brothers’ long life.' },
  { id: 'chhath', name: 'Chhath Puja', month: 7, tithi: 6, kala: 'sunrise', emoji: '🌅', fast: true, about: 'Prayers to the setting and rising sun, with a 36-hour fast.' },
  { id: 'kartik-purnima', name: 'Kartik Purnima · Dev Deepawali · Guru Nanak Jayanti', month: 7, tithi: 15, kala: 'sunrise', emoji: '🪔' },
  { id: 'vivah-panchami', name: 'Vivah Panchami', month: 8, tithi: 5, kala: 'sunrise', emoji: '💐', about: 'Wedding anniversary of Rama and Sita.' },
  { id: 'gita-jayanti', name: 'Gita Jayanti', month: 8, tithi: 11, kala: 'sunrise', emoji: '📖' },
  { id: 'vasant-panchami', name: 'Vasant Panchami · Saraswati Puja', month: 10, tithi: 5, kala: 'madhyahna', emoji: '💛', about: 'Spring arrives; Saraswati is worshipped. Wear yellow.' },
  { id: 'ratha-saptami', name: 'Ratha Saptami', month: 10, tithi: 7, kala: 'sunrise', emoji: '☀️' },
  { id: 'maha-shivratri', name: 'Maha Shivratri', month: 10, tithi: 29, kala: 'nishita', emoji: '🔱', fast: true, about: 'The great night of Shiva: fast, and keep vigil through the night.' },
  { id: 'holika-dahan', name: 'Holika Dahan', month: 11, tithi: 15, kala: 'pradosh', emoji: '🔥', about: 'The bonfire on the eve of Holi.' },
  { id: 'holi', name: 'Holi', month: 11, tithi: 15, kala: 'pradosh', emoji: '🎨', after: 1, about: 'The festival of colours.' },
];

/** Ekadashi names: [amanta month][0 Shukla, 1 Krishna]. In an adhik month: Padmini and Parama. */
const EKADASHI: [string, string][] = [
  ['Kamada', 'Varuthini'], ['Mohini', 'Apara'], ['Nirjala', 'Yogini'], ['Devshayani', 'Kamika'], ['Shravana Putrada', 'Aja'],
  ['Parsva', 'Indira'], ['Papankusha', 'Rama'], ['Devutthana', 'Utpanna'], ['Mokshada', 'Saphala'], ['Pausha Putrada', 'Shattila'],
  ['Jaya', 'Vijaya'], ['Amalaki', 'Papmochani'],
];

const DOW = ['Ravi', 'Som', 'Bhaum', 'Budh', 'Guru', 'Shukra', 'Shani'];
const fmtId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The day a tithi (in one lunar month) is observed, judged at `kala` (and, at sunrise, lasting at
 *  least `minHours` after it). */
function observe(m: LunarMonth, tithi: number, kala: Kala, p: Place, minHours = 0) {
  const start = when(elongation, (tithi - 1) * 12, m.start + ((tithi - 1) * 12 / TITHI_RATE) * DAY, TITHI_RATE);
  const end = when(elongation, (tithi * 12) % 360, start + DAY, TITHI_RATE);
  const first = dayKey(new Date(start));
  const holds = (key: string, k: Kala, min = 0) => { const t = kalaTime(key, k, p); return t >= start && t + min * 3600e3 < end; };
  for (let i = -1; i <= 2; i++) if (holds(addDays(first, i), kala, minHours)) return { key: addDays(first, i), start, end };
  for (let i = -1; i <= 2; i++) if (holds(addDays(first, i), 'sunrise')) return { key: addDays(first, i), start, end };
  return { key: first, start, end }; // at no sunrise either (kshaya): the day it begins
}

/** Holika Dahan: Purnima in the evening, after Bhadra (the first half of Purnima). If Bhadra lasts
 *  past midnight, the bonfire waits for the next evening. */
function holikaDay(m: LunarMonth, p: Place) {
  const o = observe(m, 15, 'pradosh', p);
  const bhadraEnds = o.start + (o.end - o.start) / 2;
  const midnight = dayStart(addDays(o.key, 1));
  const key = bhadraEnds <= midnight ? o.key : addDays(o.key, 1);
  return { key, at: Math.max(sun(key, p).set, key === o.key ? bhadraEnds : 0) };
}

const yearCache = new Map<string, Observance[]>();
/** Every festival and fast in a (Gregorian) year, at a place. `style` names the months of Purnima
 *  and Amavasya (in purnimanta, the dark half and its Amavasya take the next month's name). */
export function observances(year: number, p: Place, style: 'amanta' | 'purnimanta' = 'purnimanta'): Observance[] {
  const ck = `${year}|${p.lat}|${p.lon}|${style}`;
  const hit = yearCache.get(ck);
  if (hit) return hit;
  const out: Observance[] = [];
  const inYear = (key: string) => key.startsWith(year + '-');
  const add = (o: Observance) => { if (inYear(o.day)) out.push(o); };

  // The lunar months overlapping the year.
  const months: LunarMonth[] = [];
  for (let t = new Date(year - 1, 10, 15).getTime(); t < new Date(year + 1, 1, 15).getTime();) {
    const m = lunarMonth(t);
    months.push(m);
    t = m.end + 2 * DAY;
  }

  for (const m of months) {
    const at = (tithi: number, kala: Kala) => observe(m, tithi, kala, p);
    if (!m.adhik) {
      for (const f of FESTIVALS) {
        if (f.month !== m.index) continue;
        const holika = f.id === 'holika-dahan' || f.id === 'holi' ? holikaDay(m, p) : null;
        const o = holika ? { key: holika.key } : observe(m, f.tithi, f.kala, p, f.minHours);
        const day = f.after ? addDays(o.key, f.after) : o.key;
        const times = f.kala === 'moonrise' ? [{ label: 'Moonrise', at: kalaTime(o.key, 'moonrise', p) }]
          : f.id === 'holika-dahan' && holika ? [{ label: 'Bonfire from', at: holika.at }]
          : f.kala === 'pradosh' ? [{ label: 'Pradosh kaal (puja)', at: sun(o.key, p).set, to: sun(o.key, p).set + 2.4 * 3600e3 }]
          : f.kala === 'madhyahna' ? [{ label: 'Madhyahna (puja)', at: sun(o.key, p).rise + (sun(o.key, p).set - sun(o.key, p).rise) * 0.4, to: sun(o.key, p).rise + (sun(o.key, p).set - sun(o.key, p).rise) * 0.6 }]
          : undefined;
        add({ id: `${f.id}-${day}`, day, name: f.name, group: 'festivals', emoji: f.emoji, fast: f.fast, about: f.about, ...(times && { times }) });
      }
    }
    // Ekadashi, with the time to break the fast (parana) the next morning: after sunrise and after
    // the first quarter of Dwadashi (Hari Vasara), within the first fifth of the day.
    for (const [half, tithi] of [[0, 11], [1, 26]] as const) {
      const o = at(tithi, 'sunrise');
      const name = (m.adhik ? ['Padmini', 'Parama'][half] : EKADASHI[m.index][half]) + ' Ekadashi';
      const next = sun(addDays(o.key, 1), p);
      const dwadashiEnd = when(elongation, (tithi + 1) * 12 % 360, o.end + DAY, TITHI_RATE);
      const from = Math.round(Math.max(next.rise, o.end + (dwadashiEnd - o.end) / 4));
      const to = Math.max(from + 30 * 60e3, Math.min(dwadashiEnd, next.rise + (next.set - next.rise) / 5));
      add({ id: `ekadashi-${o.key}`, day: o.key, name, group: 'ekadashi', emoji: '🙏', fast: true,
        about: 'Fast from sunrise; many keep it with fruit and milk, some without water. Break it the next morning, at parana.',
        times: [{ label: 'Ekadashi', at: o.start, to: o.end }, { label: 'Parana (break the fast)', at: from, to }] });
    }
    for (const tithi of [13, 28]) {
      const o = at(tithi, 'pradosh');
      const d = new Date(dayStart(o.key)).getDay();
      const name = ([1, 2, 6].includes(d) ? DOW[d] + ' ' : '') + 'Pradosh Vrat';
      add({ id: `pradosh-${o.key}`, day: o.key, name, group: 'pradosh', emoji: '🔱', fast: true, about: 'A fast for Shiva, with puja at dusk (pradosh kaal).',
        times: [{ label: 'Pradosh kaal', at: sun(o.key, p).set, to: sun(o.key, p).set + 2.4 * 3600e3 }] });
    }
    {
      const o = at(19, 'moonrise');
      const tue = new Date(dayStart(o.key)).getDay() === 2;
      if (!(m.index === 6 && !m.adhik)) { // in Ashwin it's Karva Chauth, listed with the festivals
        add({ id: `sankashti-${o.key}`, day: o.key, name: tue ? 'Angarki Sankashti Chaturthi' : 'Sankashti Chaturthi', group: 'sankashti', emoji: '🐘', fast: true,
          about: 'A fast for Ganesha, broken after seeing the moon.', times: [{ label: 'Moonrise', at: kalaTime(o.key, 'moonrise', p) }] });
      }
    }
    {
      const o = at(4, 'madhyahna');
      if (!(m.index === 5 && !m.adhik)) add({ id: `vinayaka-${o.key}`, day: o.key, name: 'Vinayaka Chaturthi', group: 'vinayaka', emoji: '🐘', fast: true });
    }
    {
      const o = at(15, 'pradosh');
      add({ id: `purnima-${o.key}`, day: o.key, name: (m.adhik ? 'Adhik ' : '') + MONTHS[m.index] + ' Purnima', group: 'purnima', emoji: '🌕', fast: true,
        about: 'Full moon: Purnima vrat and Satyanarayan puja.', times: [{ label: 'Purnima', at: o.start, to: o.end }] });
    }
    {
      const o = at(30, 'sunrise');
      add({ id: `amavasya-${o.key}`, day: o.key, name: monthName(m, 30, style) + ' Amavasya', group: 'amavasya', emoji: '🌑',
        times: [{ label: 'Amavasya', at: o.start, to: o.end }] });
    }
    if (!(m.index === 10 && !m.adhik)) {
      const o = at(29, 'nishita');
      add({ id: `shivratri-${o.key}`, day: o.key, name: 'Masik Shivratri', group: 'shivratri', emoji: '🔱', fast: true });
    }
    if (!(m.index === 6 && !m.adhik)) {
      const o = at(8, 'sunrise');
      add({ id: `durgashtami-${o.key}`, day: o.key, name: 'Masik Durgashtami', group: 'durgashtami', emoji: '🌺', fast: true });
    }
  }

  // Sankranti: the sun entering each sign (sidereal). After sunset, it's kept the next day.
  for (let r = 0; r < 12; r++) {
    const guess = new Date(year, (r + 3) % 12, 14).getTime();
    const t = when(sunSid, r * 30, guess, 0.9856);
    let key = dayKey(new Date(t));
    if (t > sun(key, p).set) key = addDays(key, 1);
    const name = r === 9 ? 'Makar Sankranti · Pongal · Uttarayan' : r === 0 ? 'Mesha Sankranti · Baisakhi · Vishu · Puthandu' : `${RASHIS[r]} Sankranti`;
    add({ id: `sankranti-${r}-${key}`, day: key, name, group: r === 9 || r === 0 ? 'festivals' : 'sankranti', emoji: '☀️',
      about: r === 9 ? 'The sun turns north. Til-gud, kites and khichdi.' : r === 0 ? 'The solar new year in Punjab, Kerala, Tamil Nadu, Bengal and Odisha.' : undefined,
      times: [{ label: 'Sun enters ' + RASHIS[r], at: t }] });
    if (r === 9) add({ id: `lohri-${addDays(key, -1)}`, day: addDays(key, -1), name: 'Lohri', group: 'festivals', emoji: '🔥', about: 'The bonfire festival of Punjab.' });
    if (r === 4) { // Onam: Thiruvonam (Shravana nakshatra) at sunrise in the solar month of Simha (Chingam)
      for (let i = 0; i < 31; i++) {
        const k = addDays(key, i);
        if (nakshatraAt(sun(k, p).rise).i === 21) { add({ id: `onam-${k}`, day: k, name: 'Onam (Thiruvonam)', group: 'festivals', emoji: '🌼', about: 'Kerala’s harvest festival: pookalam and sadya.' }); break; }
      }
    }
  }

  // National holidays (India), on fixed dates.
  for (const [md, name, emoji] of [['01-26', 'Republic Day', '🇮🇳'], ['08-15', 'Independence Day', '🇮🇳'], ['10-02', 'Gandhi Jayanti', '🕊️']] as const) {
    add({ id: `${fmtId(name)}-${year}`, day: `${year}-${md}`, name, group: 'national', emoji });
  }

  out.sort((a, b) => a.day.localeCompare(b.day) || groupOrder(a.group) - groupOrder(b.group));
  if (yearCache.size > 20) yearCache.clear();
  yearCache.set(ck, out);
  return out;
}

const ORDER: Group[] = ['festivals', 'national', 'ekadashi', 'sankashti', 'pradosh', 'purnima', 'amavasya', 'shivratri', 'vinayaka', 'durgashtami', 'sankranti'];
const groupOrder = (g: Group) => ORDER.indexOf(g);

export const GROUPS: { id: Group; label: string; hint: string }[] = [
  { id: 'festivals', label: 'Festivals', hint: 'Diwali, Holi, Navratri, Janmashtami, Karva Chauth…' },
  { id: 'ekadashi', label: 'Ekadashi', hint: 'Twice a month, with parana time' },
  { id: 'pradosh', label: 'Pradosh Vrat', hint: 'Trayodashi, for Shiva' },
  { id: 'sankashti', label: 'Sankashti Chaturthi', hint: 'With moonrise time' },
  { id: 'vinayaka', label: 'Vinayaka Chaturthi', hint: 'Shukla Chaturthi' },
  { id: 'purnima', label: 'Purnima', hint: 'Full moon' },
  { id: 'amavasya', label: 'Amavasya', hint: 'New moon' },
  { id: 'shivratri', label: 'Masik Shivratri', hint: 'Every month' },
  { id: 'durgashtami', label: 'Masik Durgashtami', hint: 'Shukla Ashtami' },
  { id: 'sankranti', label: 'Sankranti', hint: 'The sun entering each sign' },
  { id: 'national', label: 'National holidays', hint: 'Republic Day, Independence Day, Gandhi Jayanti' },
];

export { ayanamsa };

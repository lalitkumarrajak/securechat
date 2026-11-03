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
import { t, tk } from '@sanga/i18n';
import { ayanamsa, moonPosition, moonrise, norm, type Place, sidereal, sunLongitude, sunTimes, when } from './astro';

export const MONTHS = [tk('Chaitra'), tk('Vaishakha'), tk('Jyeshtha'), tk('Ashadha'), tk('Shravana'), tk('Bhadrapada'), tk('Ashwin'), tk('Kartika'), tk('Margashirsha'), tk('Pausha'), tk('Magha'), tk('Phalguna')];
export const TITHIS = [tk('Pratipada'), tk('Dwitiya'), tk('Tritiya'), tk('Chaturthi'), tk('Panchami'), tk('Shashthi'), tk('Saptami'), tk('Ashtami'), tk('Navami'), tk('Dashami'),
  tk('Ekadashi'), tk('Dwadashi'), tk('Trayodashi'), tk('Chaturdashi')];
export const NAKSHATRAS = [tk('Ashwini'), tk('Bharani'), tk('Krittika'), tk('Rohini'), tk('Mrigashira'), tk('Ardra'), tk('Punarvasu'), tk('Pushya'), tk('Ashlesha'), tk('Magha'),
  tk('Purva Phalguni'), tk('Uttara Phalguni'), tk('Hasta'), tk('Chitra'), tk('Swati'), tk('Vishakha'), tk('Anuradha'), tk('Jyeshtha'), tk('Mula'), tk('Purva Ashadha'),
  tk('Uttara Ashadha'), tk('Shravana'), tk('Dhanishta'), tk('Shatabhisha'), tk('Purva Bhadrapada'), tk('Uttara Bhadrapada'), tk('Revati')];
export const YOGAS = [tk('Vishkambha'), tk('Priti'), tk('Ayushman'), tk('Saubhagya'), tk('Shobhana'), tk('Atiganda'), tk('Sukarma'), tk('Dhriti'), tk('Shula'), tk('Ganda'), tk('Vriddhi'),
  tk('Dhruva'), tk('Vyaghata'), tk('Harshana'), tk('Vajra'), tk('Siddhi'), tk('Vyatipata'), tk('Variyana'), tk('Parigha'), tk('Shiva'), tk('Siddha'), tk('Sadhya'), tk('Shubha'), tk('Shukla'),
  tk('Brahma'), tk('Indra'), tk('Vaidhriti')];
export const RASHIS = [tk('Mesha'), tk('Vrishabha'), tk('Mithuna'), tk('Karka'), tk('Simha'), tk('Kanya'), tk('Tula'), tk('Vrischika'), tk('Dhanu'), tk('Makara'), tk('Kumbha'), tk('Meena')];

/** Tithi n (1–30) as a name: 1–15 bright half (Shukla, ending in Purnima), 16–30 dark half (Krishna, ending in Amavasya). */
export const tithiName = (n: number) => (n === 15 ? tk('Purnima') : n === 30 ? tk('Amavasya') : TITHIS[(n - 1) % 15]);
export const pakshaOf = (n: number) => (n <= 15 ? tk('Shukla') : tk('Krishna'));

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
    const start = dayStart(key), st = sunTimes(start, p);
    s = { start, rise: st.rise, set: st.set, nextRise: sunTimes(dayStart(addDays(key, 1)), p).rise };
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
  const ts = tithiSpan(s.rise);
  const m = lunarMonth(s.rise);
  const [y, mo] = key.split('-').map(Number);
  // Vikram Samvat changes at Chaitra Shukla Pratipada; until then (Jan–Mar) it's the year before's.
  const vikram = y + (mo <= 4 && m.index >= 9 ? 56 : 57);
  return {
    key, sunrise: s.rise, sunset: s.set, moonrise: moonrise(s.start, p),
    tithi: ts.n, tithiName: tithiName(ts.n), tithiEnds: ts.end, paksha: pakshaOf(ts.n),
    nakshatra: nakshatraAt(s.rise), yoga: yogaAt(s.rise),
    month: m, vikram, shaka: vikram - 135, moon: moonEmoji(s.start + DAY / 2),
    sunSign: RASHIS[Math.floor(sunSid(s.rise) / 30)],
  };
}
export type Panchang = ReturnType<typeof panchang>;

/** The month's name as shown: amanta (new moon to new moon, south and west India) or purnimanta
 *  (full moon to full moon, north India: the dark half takes the next month's name). */
const monthIndex = (m: LunarMonth, tithi: number, style: 'amanta' | 'purnimanta') => (style === 'purnimanta' && tithi > 15 && !m.adhik ? (m.index + 1) % 12 : m.index);
export function monthName(m: LunarMonth, tithi: number, style: 'amanta' | 'purnimanta') {
  return (m.adhik ? 'Adhik ' : '') + MONTHS[monthIndex(m, tithi, style)]; // i18n-ok: English data; monthLabel() shows it
}
/** monthName, in the language now on. */
export function monthLabel(m: LunarMonth, tithi: number, style: 'amanta' | 'purnimanta') {
  const month = t(MONTHS[monthIndex(m, tithi, style)]);
  return m.adhik ? t('Adhik {month}', { month }) : month;
}

// ---------- names as shown ----------
// The data stays in English (ids, tests, matching); what's shown goes through t(). A name made of
// parts keeps its English template and parts (`tpl`, `vars`), each part translated on its own.
const tv = (vars?: Record<string, string>) => vars && Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, t(v)]));
type Named = { name?: string; label?: string; tpl?: string; vars?: Record<string, string> };
const shown = (x: Named, en: string) => (x.tpl ? t(x.tpl, tv(x.vars)) : t(en));
/** A festival or fast's name, in the language now on. */
export const obsName = (o: Observance) => shown(o, o.name);
/** A timing's label (moonrise, parana…), in the language now on. */
export const timeLabel = (x: NonNullable<Observance['times']>[number]) => shown(x, x.label);
// Three nakshatras share a name with a month (Hindi tells them apart), so they have keys of their own.
const NAK_KEY: Record<string, string> = { Jyeshtha: tk('Jyeshtha (nakshatra)'), Magha: tk('Magha (nakshatra)'), Shravana: tk('Shravana (nakshatra)') };
/** A nakshatra's name, in the language now on. */
export const nakshatraLabel = (name: string) => {
  const k = NAK_KEY[name];
  if (!k) return t(name);
  const s = t(k);
  return s === k ? name : s;
};

// ---------- festivals and fasts ----------
export type Group = 'festivals' | 'ekadashi' | 'pradosh' | 'sankashti' | 'vinayaka' | 'purnima' | 'amavasya' | 'shivratri' | 'durgashtami' | 'sankranti' | 'national';
export interface Observance {
  id: string;        // stable: what it is and its date, e.g. "diwali-2026"
  day: string;       // YYYY-MM-DD
  name: string;      // English (kept with a fast you plan); obsName() shows it
  tpl?: string;      // a name made of parts: its English template, e.g. "{name} Ekadashi", and the parts
  vars?: Record<string, string>;
  group: Group;
  emoji: string;
  fast?: boolean;    // a day people fast
  about?: string;
  times?: { label: string; at: number; to?: number; tpl?: string; vars?: Record<string, string> }[]; // moonrise, parana… (timeLabel() shows it)
}

interface Rule { id: string; name: string; month: number; tithi: number; kala: Kala; emoji: string; fast?: boolean; about?: string; after?: number; minHours?: number }
// Months are amanta: 0 Chaitra … 11 Phalguna. Tithi 1–15 Shukla, 16–30 Krishna.
const FESTIVALS: Rule[] = [
  { id: 'ugadi', name: tk('Gudi Padwa · Ugadi · Chaitra Navratri begins'), month: 0, tithi: 1, kala: 'sunrise', emoji: '🌸', about: tk('Hindu New Year (Vikram Samvat) in much of India; the nine nights of Chaitra Navratri begin.') },
  { id: 'ram-navami', name: tk('Ram Navami'), month: 0, tithi: 9, kala: 'madhyahna', emoji: '🏹', fast: true, about: tk('Birth of Lord Rama, at midday. Many fast until noon or all day.') },
  { id: 'hanuman-jayanti', name: tk('Hanuman Jayanti'), month: 0, tithi: 15, kala: 'sunrise', emoji: '🙏', about: tk('Birth of Lord Hanuman (north India).') },
  { id: 'akshaya-tritiya', name: tk('Akshaya Tritiya'), month: 1, tithi: 3, kala: 'sunrise', emoji: '🪙', about: tk('An auspicious day for new beginnings, buying gold and giving.') },
  { id: 'buddha-purnima', name: tk('Buddha Purnima'), month: 1, tithi: 15, kala: 'sunrise', emoji: '☸️', about: tk('Birth, enlightenment and passing of the Buddha.') },
  { id: 'vat-savitri', name: tk('Vat Savitri Vrat'), month: 1, tithi: 30, kala: 'sunrise', emoji: '🌳', fast: true, about: tk('Married women fast and pray around the banyan tree for their husbands (north India).') },
  { id: 'ganga-dussehra', name: tk('Ganga Dussehra'), month: 2, tithi: 10, kala: 'sunrise', emoji: '🌊', about: tk('Descent of the Ganga to earth.') },
  { id: 'rath-yatra', name: tk('Jagannath Rath Yatra'), month: 3, tithi: 2, kala: 'sunrise', emoji: '🛕', about: tk('Lord Jagannath’s chariot festival, Puri.') },
  { id: 'guru-purnima', name: tk('Guru Purnima'), month: 3, tithi: 15, kala: 'sunrise', emoji: '📿', about: tk('A day to honour one’s teachers.') },
  { id: 'hariyali-teej', name: tk('Hariyali Teej'), month: 4, tithi: 3, kala: 'sunrise', emoji: '🌿', fast: true, about: tk('Women fast for marital happiness; swings, green clothes and songs.') },
  { id: 'nag-panchami', name: tk('Nag Panchami'), month: 4, tithi: 5, kala: 'sunrise', emoji: '🐍', about: tk('Worship of the serpent deities.') },
  { id: 'raksha-bandhan', name: tk('Raksha Bandhan'), month: 4, tithi: 15, kala: 'sunrise', minHours: 2.4, emoji: '🪢', about: tk('Sisters tie a rakhi on their brothers’ wrists.') },
  { id: 'kajari-teej', name: tk('Kajari Teej'), month: 4, tithi: 18, kala: 'sunrise', emoji: '🌙', fast: true, about: tk('Women fast and pray to the neem tree and the moon.') },
  { id: 'janmashtami', name: tk('Krishna Janmashtami'), month: 4, tithi: 23, kala: 'sunrise', emoji: '🦚', fast: true, about: tk('Birth of Lord Krishna at midnight. Fast until the midnight puja.') },
  { id: 'hartalika-teej', name: tk('Hartalika Teej'), month: 5, tithi: 3, kala: 'sunrise', emoji: '🌺', fast: true, about: tk('A strict (often nirjala) fast by women for Shiva and Parvati.') },
  { id: 'ganesh-chaturthi', name: tk('Ganesh Chaturthi'), month: 5, tithi: 4, kala: 'madhyahna', emoji: '🐘', about: tk('Ganesha comes home; ten days end at Anant Chaturdashi. Don’t look at the moon tonight.') },
  { id: 'rishi-panchami', name: tk('Rishi Panchami'), month: 5, tithi: 5, kala: 'madhyahna', emoji: '🧘', fast: true },
  { id: 'anant-chaturdashi', name: tk('Anant Chaturdashi · Ganesh Visarjan'), month: 5, tithi: 14, kala: 'sunrise', emoji: '🌊' },
  { id: 'pitru-amavasya', name: tk('Sarva Pitru Amavasya · Mahalaya'), month: 5, tithi: 30, kala: 'aparahna', emoji: '🪔', about: tk('The last day of Pitru Paksha: shraddha for all ancestors.') },
  { id: 'navratri', name: tk('Sharad Navratri begins · Ghatasthapana'), month: 6, tithi: 1, kala: 'sunrise', emoji: '🔱', fast: true, about: tk('Nine nights of the Goddess. Many fast all nine days, or the first and last.') },
  { id: 'durga-ashtami', name: tk('Durga Ashtami'), month: 6, tithi: 8, kala: 'sunrise', emoji: '🌺', fast: true, about: tk('Kanya puja in many homes.') },
  { id: 'maha-navami', name: tk('Maha Navami'), month: 6, tithi: 9, kala: 'sunrise', emoji: '🔱' },
  { id: 'dussehra', name: tk('Dussehra · Vijayadashami'), month: 6, tithi: 10, kala: 'aparahna', emoji: '🏹', about: tk('Victory of good over evil: Rama over Ravana, Durga over Mahishasura.') },
  { id: 'sharad-purnima', name: tk('Sharad Purnima'), month: 6, tithi: 15, kala: 'pradosh', emoji: '🌕', about: tk('Kheer is left out under the full moon overnight.') },
  { id: 'karva-chauth', name: tk('Karva Chauth'), month: 6, tithi: 19, kala: 'moonrise', emoji: '🌙', fast: true, about: tk('Married women fast from sunrise without food or water until they see the moon.') },
  { id: 'ahoi-ashtami', name: tk('Ahoi Ashtami'), month: 6, tithi: 23, kala: 'pradosh', emoji: '⭐', fast: true, about: tk('Mothers fast for their children until the stars come out.') },
  { id: 'dhanteras', name: tk('Dhanteras'), month: 6, tithi: 28, kala: 'pradosh', emoji: '🪙', about: tk('Diwali begins: buy something new, light a lamp for Yama.') },
  { id: 'choti-diwali', name: tk('Narak Chaturdashi · Choti Diwali'), month: 6, tithi: 29, kala: 'sunrise', emoji: '🪔' },
  { id: 'diwali', name: tk('Diwali · Lakshmi Puja'), month: 6, tithi: 30, kala: 'pradosh', emoji: '🪔', about: tk('The festival of lights. Lakshmi puja in the evening.') },
  { id: 'govardhan', name: tk('Govardhan Puja'), month: 7, tithi: 1, kala: 'sunrise', emoji: '⛰️' },
  { id: 'bhai-dooj', name: tk('Bhai Dooj'), month: 7, tithi: 2, kala: 'aparahna', emoji: '🤝', about: tk('Sisters pray for their brothers’ long life.') },
  { id: 'chhath', name: tk('Chhath Puja'), month: 7, tithi: 6, kala: 'sunrise', emoji: '🌅', fast: true, about: tk('Prayers to the setting and rising sun, with a 36-hour fast.') },
  { id: 'kartik-purnima', name: tk('Kartik Purnima · Dev Deepawali · Guru Nanak Jayanti'), month: 7, tithi: 15, kala: 'sunrise', emoji: '🪔' },
  { id: 'vivah-panchami', name: tk('Vivah Panchami'), month: 8, tithi: 5, kala: 'sunrise', emoji: '💐', about: tk('Wedding anniversary of Rama and Sita.') },
  { id: 'gita-jayanti', name: tk('Gita Jayanti'), month: 8, tithi: 11, kala: 'sunrise', emoji: '📖' },
  { id: 'vasant-panchami', name: tk('Vasant Panchami · Saraswati Puja'), month: 10, tithi: 5, kala: 'madhyahna', emoji: '💛', about: tk('Spring arrives; Saraswati is worshipped. Wear yellow.') },
  { id: 'ratha-saptami', name: tk('Ratha Saptami'), month: 10, tithi: 7, kala: 'sunrise', emoji: '☀️' },
  { id: 'maha-shivratri', name: tk('Maha Shivratri'), month: 10, tithi: 29, kala: 'nishita', emoji: '🔱', fast: true, about: tk('The great night of Shiva: fast, and keep vigil through the night.') },
  { id: 'holika-dahan', name: tk('Holika Dahan'), month: 11, tithi: 15, kala: 'pradosh', emoji: '🔥', about: tk('The bonfire on the eve of Holi.') },
  { id: 'holi', name: tk('Holi'), month: 11, tithi: 15, kala: 'pradosh', emoji: '🎨', after: 1, about: tk('The festival of colours.') },
];

/** Ekadashi names: [amanta month][0 Shukla, 1 Krishna]. In an adhik month: Padmini and Parama. */
const EKADASHI: [string, string][] = [
  [tk('Kamada'), tk('Varuthini')], [tk('Mohini'), tk('Apara')], [tk('Nirjala'), tk('Yogini')], [tk('Devshayani'), tk('Kamika')], [tk('Shravana Putrada'), tk('Aja')],
  [tk('Parsva'), tk('Indira')], [tk('Papankusha'), tk('Rama')], [tk('Devutthana'), tk('Utpanna')], [tk('Mokshada'), tk('Saphala')], [tk('Pausha Putrada'), tk('Shattila')],
  [tk('Jaya'), tk('Vijaya')], [tk('Amalaki'), tk('Papmochani')],
];

const DOW = [tk('Ravi'), tk('Som'), tk('Bhaum'), tk('Budh'), tk('Guru'), tk('Shukra'), tk('Shani')];
const fmtId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The day a tithi (in one lunar month) is observed, judged at `kala` (and, at sunrise, lasting at
 *  least `minHours` after it). */
function observe(m: LunarMonth, tithi: number, kala: Kala, p: Place, minHours = 0) {
  const start = when(elongation, (tithi - 1) * 12, m.start + ((tithi - 1) * 12 / TITHI_RATE) * DAY, TITHI_RATE);
  const end = when(elongation, (tithi * 12) % 360, start + DAY, TITHI_RATE);
  const first = dayKey(new Date(start));
  const holds = (key: string, k: Kala, min = 0) => { const at = kalaTime(key, k, p); return at >= start && at + min * 3600e3 < end; };
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
  for (let tm = new Date(year - 1, 10, 15).getTime(); tm < new Date(year + 1, 1, 15).getTime();) {
    const m = lunarMonth(tm);
    months.push(m);
    tm = m.end + 2 * DAY;
  }

  for (const m of months) {
    const at = (tithi: number, kala: Kala) => observe(m, tithi, kala, p);
    if (!m.adhik) {
      for (const f of FESTIVALS) {
        if (f.month !== m.index) continue;
        const holika = f.id === 'holika-dahan' || f.id === 'holi' ? holikaDay(m, p) : null;
        const o = holika ? { key: holika.key } : observe(m, f.tithi, f.kala, p, f.minHours);
        const day = f.after ? addDays(o.key, f.after) : o.key;
        const times = f.kala === 'moonrise' ? [{ label: tk('Moonrise'), at: kalaTime(o.key, 'moonrise', p) }]
          : f.id === 'holika-dahan' && holika ? [{ label: tk('Bonfire from'), at: holika.at }]
          : f.kala === 'pradosh' ? [{ label: tk('Pradosh kaal (puja)'), at: sun(o.key, p).set, to: sun(o.key, p).set + 2.4 * 3600e3 }]
          : f.kala === 'madhyahna' ? [{ label: tk('Madhyahna (puja)'), at: sun(o.key, p).rise + (sun(o.key, p).set - sun(o.key, p).rise) * 0.4, to: sun(o.key, p).rise + (sun(o.key, p).set - sun(o.key, p).rise) * 0.6 }]
          : undefined;
        add({ id: `${f.id}-${day}`, day, name: f.name, group: 'festivals', emoji: f.emoji, fast: f.fast, about: f.about, ...(times && { times }) });
      }
    }
    // Ekadashi, with the time to break the fast (parana) the next morning: after sunrise and after
    // the first quarter of Dwadashi (Hari Vasara), within the first fifth of the day.
    for (const [half, tithi] of [[0, 11], [1, 26]] as const) {
      const o = at(tithi, 'sunrise');
      const which = m.adhik ? [tk('Padmini'), tk('Parama')][half] : EKADASHI[m.index][half];
      const name = which + ' Ekadashi'; // i18n-ok: English data, shown through tpl
      const next = sun(addDays(o.key, 1), p);
      const dwadashiEnd = when(elongation, (tithi + 1) * 12 % 360, o.end + DAY, TITHI_RATE);
      const from = Math.round(Math.max(next.rise, o.end + (dwadashiEnd - o.end) / 4));
      const to = Math.max(from + 30 * 60e3, Math.min(dwadashiEnd, next.rise + (next.set - next.rise) / 5));
      add({ id: `ekadashi-${o.key}`, day: o.key, name, tpl: tk('{name} Ekadashi'), vars: { name: which }, group: 'ekadashi', emoji: '🙏', fast: true,
        about: tk('Fast from sunrise; many keep it with fruit and milk, some without water. Break it the next morning, at parana.'),
        times: [{ label: tk('Ekadashi'), at: o.start, to: o.end }, { label: tk('Parana (break the fast)'), at: from, to }] });
    }
    for (const tithi of [13, 28]) {
      const o = at(tithi, 'pradosh');
      const d = new Date(dayStart(o.key)).getDay();
      const named = [1, 2, 6].includes(d);
      const name = (named ? DOW[d] + ' ' : '') + 'Pradosh Vrat'; // i18n-ok: English data, shown through tpl
      add({ id: `pradosh-${o.key}`, day: o.key, name, ...(named && { tpl: tk('{day} Pradosh Vrat'), vars: { day: DOW[d] } }),
        group: 'pradosh', emoji: '🔱', fast: true, about: tk('A fast for Shiva, with puja at dusk (pradosh kaal).'),
        times: [{ label: tk('Pradosh kaal'), at: sun(o.key, p).set, to: sun(o.key, p).set + 2.4 * 3600e3 }] });
    }
    {
      const o = at(19, 'moonrise');
      const tue = new Date(dayStart(o.key)).getDay() === 2;
      if (!(m.index === 6 && !m.adhik)) { // in Ashwin it's Karva Chauth, listed with the festivals
        add({ id: `sankashti-${o.key}`, day: o.key, name: tue ? tk('Angarki Sankashti Chaturthi') : tk('Sankashti Chaturthi'), group: 'sankashti', emoji: '🐘', fast: true,
          about: tk('A fast for Ganesha, broken after seeing the moon.'), times: [{ label: tk('Moonrise'), at: kalaTime(o.key, 'moonrise', p) }] });
      }
    }
    {
      const o = at(4, 'madhyahna');
      if (!(m.index === 5 && !m.adhik)) add({ id: `vinayaka-${o.key}`, day: o.key, name: tk('Vinayaka Chaturthi'), group: 'vinayaka', emoji: '🐘', fast: true });
    }
    {
      const o = at(15, 'pradosh');
      add({ id: `purnima-${o.key}`, day: o.key, name: (m.adhik ? 'Adhik ' : '') + MONTHS[m.index] + ' Purnima', // i18n-ok: English data, shown through tpl
        tpl: m.adhik ? tk('Adhik {month} Purnima') : tk('{month} Purnima'), vars: { month: MONTHS[m.index] }, group: 'purnima', emoji: '🌕', fast: true,
        about: tk('Full moon: Purnima vrat and Satyanarayan puja.'), times: [{ label: tk('Purnima'), at: o.start, to: o.end }] });
    }
    {
      const o = at(30, 'sunrise');
      add({ id: `amavasya-${o.key}`, day: o.key, name: monthName(m, 30, style) + ' Amavasya', // i18n-ok: English data, shown through tpl
        tpl: m.adhik ? tk('Adhik {month} Amavasya') : tk('{month} Amavasya'), vars: { month: MONTHS[monthIndex(m, 30, style)] }, group: 'amavasya', emoji: '🌑',
        times: [{ label: tk('Amavasya'), at: o.start, to: o.end }] });
    }
    if (!(m.index === 10 && !m.adhik)) {
      const o = at(29, 'nishita');
      add({ id: `shivratri-${o.key}`, day: o.key, name: tk('Masik Shivratri'), group: 'shivratri', emoji: '🔱', fast: true });
    }
    if (!(m.index === 6 && !m.adhik)) {
      const o = at(8, 'sunrise');
      add({ id: `durgashtami-${o.key}`, day: o.key, name: tk('Masik Durgashtami'), group: 'durgashtami', emoji: '🌺', fast: true });
    }
  }

  // Sankranti: the sun entering each sign (sidereal). After sunset, it's kept the next day.
  for (let r = 0; r < 12; r++) {
    const guess = new Date(year, (r + 3) % 12, 14).getTime();
    const tm = when(sunSid, r * 30, guess, 0.9856);
    let key = dayKey(new Date(tm));
    if (tm > sun(key, p).set) key = addDays(key, 1);
    const name = r === 9 ? tk('Makar Sankranti · Pongal · Uttarayan') : r === 0 ? tk('Mesha Sankranti · Baisakhi · Vishu · Puthandu') : `${RASHIS[r]} Sankranti`;
    add({ id: `sankranti-${r}-${key}`, day: key, name, ...(r !== 9 && r !== 0 && { tpl: tk('{sign} Sankranti'), vars: { sign: RASHIS[r] } }),
      group: r === 9 || r === 0 ? 'festivals' : 'sankranti', emoji: '☀️',
      about: r === 9 ? tk('The sun turns north. Til-gud, kites and khichdi.') : r === 0 ? tk('The solar new year in Punjab, Kerala, Tamil Nadu, Bengal and Odisha.') : undefined,
      times: [{ label: 'Sun enters ' + RASHIS[r], tpl: tk('Sun enters {sign}'), vars: { sign: RASHIS[r] }, at: tm }] }); // i18n-ok: English data, shown through tpl
    if (r === 9) add({ id: `lohri-${addDays(key, -1)}`, day: addDays(key, -1), name: tk('Lohri'), group: 'festivals', emoji: '🔥', about: tk('The bonfire festival of Punjab.') });
    if (r === 4) { // Onam: Thiruvonam (Shravana nakshatra) at sunrise in the solar month of Simha (Chingam)
      for (let i = 0; i < 31; i++) {
        const k = addDays(key, i);
        if (nakshatraAt(sun(k, p).rise).i === 21) { add({ id: `onam-${k}`, day: k, name: tk('Onam (Thiruvonam)'), group: 'festivals', emoji: '🌼', about: tk('Kerala’s harvest festival: pookalam and sadya.') }); break; }
      }
    }
  }

  // National holidays (India), on fixed dates.
  for (const [md, name, emoji] of [['01-26', tk('Republic Day'), '🇮🇳'], ['08-15', tk('Independence Day'), '🇮🇳'], ['10-02', tk('Gandhi Jayanti'), '🕊️']] as const) {
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
  { id: 'festivals', label: tk('Festivals'), hint: tk('Diwali, Holi, Navratri, Janmashtami, Karva Chauth…') },
  { id: 'ekadashi', label: tk('Ekadashi'), hint: tk('Twice a month, with parana time') },
  { id: 'pradosh', label: tk('Pradosh Vrat'), hint: tk('Trayodashi, for Shiva') },
  { id: 'sankashti', label: tk('Sankashti Chaturthi'), hint: tk('With moonrise time') },
  { id: 'vinayaka', label: tk('Vinayaka Chaturthi'), hint: tk('Shukla Chaturthi') },
  { id: 'purnima', label: tk('Purnima'), hint: tk('Full moon') },
  { id: 'amavasya', label: tk('Amavasya'), hint: tk('New moon') },
  { id: 'shivratri', label: tk('Masik Shivratri'), hint: tk('Every month') },
  { id: 'durgashtami', label: tk('Masik Durgashtami'), hint: tk('Shukla Ashtami') },
  { id: 'sankranti', label: tk('Sankranti'), hint: tk('The sun entering each sign') },
  { id: 'national', label: tk('National holidays'), hint: tk('Republic Day, Independence Day, Gandhi Jayanti') },
];

export { ayanamsa };

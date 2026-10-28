// The panchang against published dates (Drik Panchang, New Delhi). Run with TZ=Asia/Kolkata.
import { describe, expect, it } from 'vitest';
import { lunarMonth, observances, panchang, MONTHS } from './panchang';

const DELHI = { lat: 28.6139, lon: 77.209 };
const dayOf = (year: number, id: string) => observances(year, DELHI).find((o) => o.id.startsWith(id + '-'))?.day;

describe('festivals', () => {
  const cases: [number, string, string][] = [
    [2025, 'maha-shivratri', '2025-02-26'], [2025, 'holika-dahan', '2025-03-13'], [2025, 'holi', '2025-03-14'],
    [2025, 'ugadi', '2025-03-30'], [2025, 'ram-navami', '2025-04-06'], [2025, 'akshaya-tritiya', '2025-04-30'],
    [2025, 'guru-purnima', '2025-07-10'], [2025, 'raksha-bandhan', '2025-08-09'], [2025, 'janmashtami', '2025-08-16'],
    [2025, 'ganesh-chaturthi', '2025-08-27'], [2025, 'navratri', '2025-09-22'], [2025, 'dussehra', '2025-10-02'],
    [2025, 'karva-chauth', '2025-10-10'], [2025, 'dhanteras', '2025-10-18'], [2025, 'diwali', '2025-10-20'],
    [2025, 'bhai-dooj', '2025-10-23'], [2025, 'lohri', '2025-01-13'],
    [2026, 'maha-shivratri', '2026-02-15'], [2026, 'holi', '2026-03-04'], [2026, 'raksha-bandhan', '2026-08-28'],
    [2026, 'janmashtami', '2026-09-04'], [2026, 'ganesh-chaturthi', '2026-09-14'], [2026, 'navratri', '2026-10-11'],
    [2026, 'dussehra', '2026-10-20'], [2026, 'karva-chauth', '2026-10-29'], [2026, 'diwali', '2026-11-08'],
  ];
  for (const [y, id, day] of cases) it(`${id} ${y}`, () => expect(dayOf(y, id)).toBe(day));

  it('Makar Sankranti', () => {
    expect(observances(2025, DELHI).find((o) => o.id.startsWith('sankranti-9-'))?.day).toBe('2025-01-14');
    expect(observances(2026, DELHI).find((o) => o.id.startsWith('sankranti-9-'))?.day).toBe('2026-01-14');
  });
});

describe('Ekadashi', () => {
  it('names and days', () => {
    const e = observances(2025, DELHI).filter((o) => o.group === 'ekadashi').map((o) => `${o.day} ${o.name}`);
    expect(e).toContain('2025-06-06 Nirjala Ekadashi');
    expect(e).toContain('2025-07-06 Devshayani Ekadashi');
    expect(e).toContain('2025-12-30 Pausha Putrada Ekadashi'); // 2025 has two
    expect(e.length).toBe(25);
  });
});

describe('days', () => {
  it('a known day: Diwali 2025 is Kartika Amavasya (purnimanta) / Ashwin Amavasya (amanta)', () => {
    const p = panchang('2025-10-21', DELHI);
    expect(p.tithiName).toBe('Amavasya');
    expect(MONTHS[p.month.index]).toBe('Ashwin');
    expect(p.vikram).toBe(2082);
  });
  it('2026 has an adhik Jyeshtha', () => {
    const m = lunarMonth(new Date(2026, 4, 25).getTime());
    expect([MONTHS[m.index], m.adhik]).toEqual(['Jyeshtha', true]);
  });
});

import { describe, expect, it } from 'vitest';
import { generate, host, href, matches, valid } from './store';

describe('links', () => {
  it('opens only web links, adding https when left out', () => {
    expect(href('example.com/login')).toBe('https://example.com/login');
    expect(href(' http://intranet.local ')).toBe('http://intranet.local/');
    expect(href('javascript:alert(1)')).toBeNull();
    expect(href('data:text/html,hi')).toBeNull();
    expect(href('')).toBeNull();
    expect(host('https://www.github.com/login')).toBe('github.com');
  });
});

describe('search', () => {
  const x = { id: 'aaaaaaaa', title: 'Gmail', url: 'https://mail.google.com', username: 'me@x.in', password: 'secret', created: 0, edited: 0 };
  it('finds by name, link or username, never by password', () => {
    expect(matches(x, 'gm')).toBe(true);
    expect(matches(x, 'google')).toBe(true);
    expect(matches(x, 'me@')).toBe(true);
    expect(matches(x, 'secret')).toBe(false);
  });
});

describe('generate', () => {
  it('has every kind of character and the length asked for', () => {
    for (let i = 0; i < 50; i++) {
      const p = generate(18);
      expect(p).toHaveLength(18);
      expect(p).toMatch(/[a-z]/); expect(p).toMatch(/[A-Z]/); expect(p).toMatch(/\d/); expect(p).toMatch(/[^A-Za-z0-9]/);
    }
  });
});

describe('valid', () => {
  it('keeps the known fields, trimmed to size, and drops the rest', () => {
    expect(valid({ title: 'A', password: 'p', evil: 1, url: 7, created: 5 }, 'id123456')).toEqual({ id: 'id123456', title: 'A', password: 'p', created: 5, edited: 0 });
    expect(valid({}, 'id123456')?.title).toBe('');
    expect(valid(null, 'x')).toBeNull();
  });
});

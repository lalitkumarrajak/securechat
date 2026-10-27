import { describe, expect, it } from 'vitest';
import { checkPin, hashPin } from './pin';

describe('app lock PIN', () => {
  it('accepts the right PIN only', async () => {
    const h = await hashPin('482915', 1000);
    expect(h.len).toBe(6);
    expect(JSON.stringify(h)).not.toContain('482915');
    expect(await checkPin('482915', h)).toBe(true);
    expect(await checkPin('482916', h)).toBe(false);
    expect(await checkPin('', h)).toBe(false);
  });
  it('salts every PIN', async () => {
    const [a, b] = await Promise.all([hashPin('1234', 1000), hashPin('1234', 1000)]);
    expect(a.hash).not.toBe(b.hash);
  });
  it('rejects PINs that are too short or not digits', async () => {
    await expect(hashPin('123')).rejects.toThrow();
    await expect(hashPin('12a4')).rejects.toThrow();
  });
});

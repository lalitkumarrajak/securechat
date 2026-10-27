import { describe, expect, it } from 'vitest';
import { codepoints, emojiOnly } from './emoji';

describe('emojiOnly', () => {
  it('detects 1–3 emoji, including sequences', () => {
    expect(emojiOnly('😂')).toEqual(['😂']);
    expect(emojiOnly(' ❤️👍🔥 ')).toEqual(['❤️', '👍', '🔥']);
    expect(emojiOnly('👍🏽')).toEqual(['👍🏽']);
    expect(emojiOnly('👨‍👩‍👧')).toEqual(['👨‍👩‍👧']);
    expect(emojiOnly('🇮🇳')).toEqual(['🇮🇳']);
  });
  it('rejects text, digits and more than three', () => {
    expect(emojiOnly('hi 😂')).toBeNull();
    expect(emojiOnly('123')).toBeNull();
    expect(emojiOnly('1😂')).toBeNull();
    expect(emojiOnly('😂😂😂😂')).toBeNull();
    expect(emojiOnly('')).toBeNull();
  });
  it('builds Noto file names', () => {
    expect(codepoints('❤️')).toBe('2764');
    expect(codepoints('👍🏻')).toBe('1f44d_1f3fb');
  });
});

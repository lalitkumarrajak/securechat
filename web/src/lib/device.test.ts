import { describe, expect, it } from 'vitest';
import { deviceName, parseDevice } from './device';

describe('device names', () => {
  it('recognises common phones and computers', () => {
    expect(deviceName('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36')).toBe('Chrome on Android');
    expect(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe('Safari on iPhone');
    expect(deviceName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0')).toBe('Edge on Windows');
    expect(deviceName('Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0')).toBe('Firefox on Linux');
    expect(deviceName('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36')).toBe('Samsung Internet on Android');
    expect(parseDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')?.kind).toBe('phone');
    expect(parseDevice('Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0')?.kind).toBe('desktop');
  });
  it('handles sessions without details', () => {
    expect(deviceName('')).toBe('Unknown device');
  });
});

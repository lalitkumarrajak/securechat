import { describe, expect, it } from 'vitest';
import { deviceName, osVersion, parseDevice, placeName } from './device';

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

describe('device names with client hints', () => {
  const android = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
  const windows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
  it('uses the phone model when the browser shares it', () => {
    expect(deviceName(android, { model: 'SM-S918B', pv: '14.0.0' })).toBe('Chrome on SM-S918B');
    expect(osVersion(android, { model: 'SM-S918B', pv: '14.0.0' })).toBe('Android 14');
    expect(deviceName(android, null)).toBe('Chrome on Android');
  });
  it('tells Windows 11 from Windows 10', () => {
    expect(deviceName(windows, { model: '', pv: '15.0.0' })).toBe('Chrome on Windows 11');
    expect(deviceName(windows, { model: '', pv: '10.0.0' })).toBe('Chrome on Windows 10');
  });
  it('names places', () => {
    expect(placeName({ city: 'Mumbai', region: 'Maharashtra', country: 'India' })).toBe('Mumbai, Maharashtra, India');
    expect(placeName({ city: 'Delhi', region: 'Delhi', country: 'India' })).toBe('Delhi, India');
    expect(placeName({ local: true })).toBe('Local network');
    expect(placeName(null)).toBe('');
  });
});

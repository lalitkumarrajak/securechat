import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const PORT = 4321;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chattrix-e2e-'));

// Runs the built app (npm run build first) against a throwaway SQLite database, in the system Chrome.
export default defineConfig({
  testDir: '.',
  outputDir: './.artifacts',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    headless: true,
    permissions: ['notifications', 'microphone', 'camera', 'clipboard-read', 'clipboard-write', 'geolocation'],
    geolocation: { latitude: 28.6129, longitude: 77.2295, accuracy: 12 },
    // Fake microphone for voice messages; keep every "phone" window visible (not backgrounded),
    // since presence correctly treats hidden tabs as away.
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required',
        '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [{
    command: 'node e2e/fake-services.mjs',
    cwd: path.join(import.meta.dirname, '..'),
    url: 'http://localhost:4322/article',
    reuseExistingServer: false,
  }, {
    command: 'node server/index.js',
    cwd: path.join(import.meta.dirname, '..'),
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT), DATA_DIR: dataDir, SIGNUPS_PER_HOUR: '1000', PRESENCE_SWEEP_MS: '500', // real 45 s presence timeout
      KLIPY_API_KEY: 'test', KLIPY_BASE_URL: 'http://localhost:4322', PREVIEW_ALLOW_PRIVATE: '1',
      GEOIP_URL: 'http://localhost:4322/geo/{ip}', GEOIP_ALLOW_PRIVATE: '1',
      GAME_TEST_DICE: '6,3,2,6,4,6,5', // e2e/games.spec.ts plays these in order
    },
  }],
});

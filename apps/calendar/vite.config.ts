import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';
import { DEV_PROXY, precompress, SHARED } from '../../vite.shared';

// The calendar, a separate app: served from /apps/calendar/. The shell loads remoteEntry.js and
// './App' when the Calendar tab is opened, and './background' when Sanga starts (to keep reminders
// for repeating events coming); index.html runs it on its own.
export default defineConfig({
  root: import.meta.dirname,
  base: '/apps/calendar/',
  plugins: [
    react(), tailwindcss(),
    federation({ name: 'calendar', filename: 'remoteEntry.js', exposes: { './App': './src/App.tsx', './background': './src/background.ts' }, shared: SHARED, dts: false }),
    precompress(),
  ],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  server: { port: 5175, proxy: DEV_PROXY },
  test: { include: ['src/**/*.test.ts'] },
});

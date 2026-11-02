import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';
import { DEV_PROXY, precompress, SHARED } from '../../vite.shared';

// Split, a separate app: served from /apps/split/. The shell loads remoteEntry.js and './App' when
// the Split tab is opened; index.html runs it on its own. Nothing of it is downloaded before that.
export default defineConfig({
  root: import.meta.dirname,
  base: '/apps/split/',
  plugins: [
    react(), tailwindcss(),
    federation({ name: 'split', filename: 'remoteEntry.js', exposes: { './App': './src/App.tsx' }, shared: SHARED, dts: false }),
    precompress(),
  ],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  server: { port: 5176, proxy: DEV_PROXY },
  test: { include: ['src/**/*.test.ts'] },
});

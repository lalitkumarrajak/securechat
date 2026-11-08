import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';
import { DEV_PROXY, precompress, SHARED } from '../../vite.shared';

// Accounts, a separate app: served from /apps/accounts/. The shell loads remoteEntry.js and './App'
// when Accounts is opened from More; index.html runs it on its own. Its records live in @sanga/ledger,
// which Split and the Calendar use too.
export default defineConfig({
  root: import.meta.dirname,
  base: '/apps/accounts/',
  plugins: [
    react(), tailwindcss(),
    federation({ name: 'accounts', filename: 'remoteEntry.js', exposes: { './App': './src/App.tsx' }, shared: SHARED, dts: false }),
    precompress(),
  ],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  server: { port: 5177, proxy: DEV_PROXY },
  test: { include: ['src/**/*.test.ts'] },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';
import { DEV_PROXY, FEDERATION, precompress, sharedCheck } from '../../vite.shared';

// Passwords, a separate app: served from /apps/passwords/. The shell loads remoteEntry.js and './App'
// when Passwords is opened from More; index.html runs it on its own.
export default defineConfig({
  root: import.meta.dirname,
  base: '/apps/passwords/',
  plugins: [
    react(), tailwindcss(),
    federation({ name: 'passwords', filename: 'remoteEntry.js', exposes: { './App': './src/App.tsx' }, ...FEDERATION }),
    precompress(), sharedCheck(),
  ],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  server: { port: 5178, proxy: DEV_PROXY },
  test: { include: ['src/**/*.test.ts'] },
});

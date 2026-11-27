import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';
import { DEV_PROXY, FEDERATION, precompress, sharedCheck } from '../../vite.shared';

// Drive, a separate app: served from /apps/drive/. The shell loads remoteEntry.js and './App'
// when Drive is opened from More; index.html runs it on its own.
export default defineConfig({
  root: import.meta.dirname,
  base: '/apps/drive/',
  plugins: [
    react(), tailwindcss(),
    federation({ name: 'drive', filename: 'remoteEntry.js', exposes: { './App': './src/App.tsx' }, ...FEDERATION }),
    precompress(), sharedCheck(),
  ],
  build: {
    outDir: 'dist', emptyOutDir: true, target: 'es2022',
    // Two pages: Drive on its own, and what a share link opens (for anyone, no sign-in).
    rollupOptions: { input: { index: `${import.meta.dirname}/index.html`, share: `${import.meta.dirname}/share.html` } },
  },
  server: { port: 5179, proxy: DEV_PROXY },
  test: { include: ['src/**/*.test.ts'] },
});

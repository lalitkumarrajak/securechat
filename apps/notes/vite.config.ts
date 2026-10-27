import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';
import { DEV_PROXY, precompress, SHARED } from '../../vite.shared';

// The diary, a separate app: served from /apps/notes/. The shell loads remoteEntry.js and './App'
// when the diary is first opened; index.html runs it on its own. `npm run dev` here works on it alone.
export default defineConfig({
  root: import.meta.dirname,
  base: '/apps/notes/',
  plugins: [
    react(), tailwindcss(),
    federation({ name: 'notes', filename: 'remoteEntry.js', exposes: { './App': './src/App.tsx' }, shared: SHARED, dts: false }),
    precompress(),
  ],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  server: { port: 5174, proxy: DEV_PROXY },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';
import { DEV_PROXY, precompress, SHARED } from '../../vite.shared';

// The main app. The Node server (server/index.js) serves apps/shell/dist in production. In development,
// run `npm run dev`: Vite serves the UI and forwards API, WebSocket and emoji requests to Node.
// The other apps (apps/notes, …) aren't listed here: the shell finds them in /apps.json when one is
// first opened, so none of their code is downloaded before that.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), tailwindcss(), federation({ name: 'shell', remotes: {}, shared: SHARED, dts: false }), precompress()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 600, // React DOM alone is ~200 KB minified
  },
  server: { proxy: { ...DEV_PROXY, '/apps/': 'http://localhost:3000' } },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});

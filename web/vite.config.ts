import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The Node server (server/index.js) serves web/dist in production. In development, run
// `npm run dev`: Vite serves the UI and forwards API, WebSocket and emoji requests to Node.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 600, // React DOM alone is ~200 KB minified
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/emoji': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});

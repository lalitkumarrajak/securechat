import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import util from 'node:util';
import zlib from 'node:zlib';
import type { Plugin } from 'vite';

// Writes .br and .gz copies of the built files, which the server sends as they are: compressing
// them when the server starts made every cold start wait several seconds (the HEIC converter alone is 3 MB).
function precompress(): Plugin {
  const gzip = util.promisify(zlib.gzip), brotli = util.promisify(zlib.brotliCompress);
  let outDir = '';
  return {
    name: 'precompress',
    apply: 'build',
    configResolved(c) { outDir = path.resolve(c.root, c.build.outDir); },
    async closeBundle() {
      const files = (await fs.readdir(outDir, { recursive: true })).filter((f) => /\.(html|m?js|css|svg|json|webmanifest|txt)$/.test(f));
      await Promise.all(files.map(async (f) => {
        const raw = await fs.readFile(path.join(outDir, f));
        const [gz, br] = await Promise.all([gzip(raw, { level: 9 }), brotli(raw)]);
        await Promise.all([fs.writeFile(path.join(outDir, f + '.gz'), gz), fs.writeFile(path.join(outDir, f + '.br'), br)]);
      }));
    },
  };
}

// The Node server (server/index.js) serves apps/shell/dist in production. In development, run
// `npm run dev`: Vite serves the UI and forwards API, WebSocket and emoji requests to Node.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), tailwindcss(), precompress()],
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

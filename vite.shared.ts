// Build settings every Sanga app uses (apps/*/vite.config.ts).
import fs from 'node:fs/promises';
import path from 'node:path';
import util from 'node:util';
import zlib from 'node:zlib';
import type { Plugin } from 'vite';

/** Loaded once and shared by the shell and every app (Module Federation): React (one copy, so hooks
 *  work across apps) and the SDK (one session and connection). Everything else an app needs it
 *  bundles itself (the UI kit is small); sharing a library that runs code as it loads (Radix,
 *  zustand) breaks an app opened on its own page, which loads before shared libraries are ready. */
export const SHARED = {
  react: { singleton: true },
  'react-dom': { singleton: true },
  '@sanga/sdk': { singleton: true },
};

/** In development the API, live connection and the other apps' built files come from the Node server. */
export const DEV_PROXY = {
  '/api': 'http://localhost:3000',
  '/emoji': 'http://localhost:3000',
  '/apps.json': 'http://localhost:3000',
  '/ws': { target: 'ws://localhost:3000', ws: true },
};

// Writes .br and .gz copies of the built files, which the server sends as they are: compressing
// them when the server starts made every cold start wait several seconds (the HEIC converter alone is 3 MB).
export function precompress(): Plugin {
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

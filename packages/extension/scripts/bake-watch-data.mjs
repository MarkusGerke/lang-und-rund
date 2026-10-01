/**
 * Backt Watch-Daten über Vite SSR (kann TS + JSON aus dem Extension-Src laden).
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = join(__dirname, '..');
const CACHE = join(EXT_DIR, '.cache');

mkdirSync(CACHE, { recursive: true });

const server = await createServer({
  root: EXT_DIR,
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom',
  resolve: {
    alias: {
      '@langs/core': join(EXT_DIR, '../core/src/index.ts'),
    },
  },
});

try {
  await server.ssrLoadModule('/scripts/bake-watch-entry.ts');
} finally {
  await server.close();
}

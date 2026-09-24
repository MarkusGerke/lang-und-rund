import { build } from 'vite';
import { rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

async function main() {
  rmSync(dist, { recursive: true, force: true });

  // 1) Reader + Options (MPA)
  await build({
    configFile: false,
    root,
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        input: {
          reader: resolve(root, 'reader.html'),
          options: resolve(root, 'options.html'),
          impressum: resolve(root, 'impressum.html'),
        },
      },
    },
    plugins: [
      viteStaticCopy({
        targets: [
          { src: 'public/icons/*', dest: 'icons' },
          { src: 'public/fonts/*', dest: 'fonts' },
          { src: 'public/READABILITY-LICENSE.md', dest: '.' },
        ],
      }),
    ],
  });

  // 2) Background (ES module, single file)
  await build({
    configFile: false,
    root,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      sourcemap: true,
      lib: {
        entry: resolve(root, 'src/background/background.ts'),
        formats: ['es'],
        fileName: () => 'background.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });

  // 3) Content script (IIFE, single file — required for scripting.executeScript)
  await build({
    configFile: false,
    root,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      sourcemap: true,
      lib: {
        entry: resolve(root, 'src/content/content.ts'),
        formats: ['iife'],
        name: 'LangsContent',
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          extend: true,
        },
      },
    },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

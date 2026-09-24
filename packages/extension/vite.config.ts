import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/background.ts'),
        content: resolve(__dirname, 'src/content/content.ts'),
        reader: resolve(__dirname, 'reader.html'),
        options: resolve(__dirname, 'options.html'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'background.js';
          if (chunk.name === 'content') return 'content.js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'manifest.chrome.json', dest: '.', rename: 'manifest.json' },
        { src: 'public/icons/*', dest: 'icons' },
        {
          src: 'node_modules/@fontsource/unifrakturmaguntia/files/*.woff2',
          dest: 'fonts',
        },
      ],
    }),
  ],
});

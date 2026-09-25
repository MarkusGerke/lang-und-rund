/**
 * Safari-Host-App: Reader als IIFE + CSS (kein ES-module / file://-Problem in WKWebView).
 * Schreibt nach dist-app/ → Shared (App)/Resources
 */
import { build } from 'vite';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  cpSync,
  existsSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'dist-app');

function b64Font(relPath) {
  const abs = resolve(root, relPath);
  if (!existsSync(abs)) return null;
  return readFileSync(abs).toString('base64');
}

async function main() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  await build({
    configFile: false,
    root,
    base: './',
    build: {
      outDir: 'dist-app',
      emptyOutDir: false,
      cssCodeSplit: false,
      sourcemap: false,
      lib: {
        entry: resolve(root, 'src/reader/reader.ts'),
        formats: ['iife'],
        name: 'LangsReaderApp',
        fileName: () => 'Script.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          assetFileNames: 'Style.css',
        },
      },
    },
  });

  const stylePath = resolve(outDir, 'Style.css');
  let css = readFileSync(stylePath, 'utf8');
  const mag = b64Font('public/fonts/unifrakturmaguntia.ttf');
  const kur = b64Font('public/fonts/kurrent.ttf');
  if (mag) {
    css = css.replace(
      /url\((['"]?)(?:\.\.\/)?(?:\/)?fonts\/unifrakturmaguntia\.ttf\1\)/g,
      `url(data:font/truetype;charset=utf-8;base64,${mag})`,
    );
  }
  if (kur) {
    css = css.replace(
      /url\((['"]?)(?:\.\.\/)?(?:\/)?fonts\/kurrent\.ttf\1\)/g,
      `url(data:font/truetype;charset=utf-8;base64,${kur})`,
    );
  }
  writeFileSync(stylePath, css);

  // Body aus reader.html, Head mit klassischen Tags (Pfade relativ zu Base.lproj/Main.html)
  const srcHtml = readFileSync(resolve(root, 'reader.html'), 'utf8');
  const bodyMatch = srcHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyInner = bodyMatch
    ? bodyMatch[1].replace(
        /\s*<script type="module"[^>]*>\s*<\/script>\s*/i,
        '\n',
      )
    : '';

  const mainHtml = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, viewport-fit=cover"
    />
    <title>lang &amp; rund</title>
    <link rel="stylesheet" href="../Style.css" />
    <script src="../Script.js" defer></script>
  </head>
  <body>
${bodyInner}
  </body>
</html>
`;

  const baseLproj = resolve(outDir, 'Base.lproj');
  mkdirSync(baseLproj, { recursive: true });
  writeFileSync(resolve(baseLproj, 'Main.html'), mainHtml);

  if (existsSync(resolve(root, 'impressum.html'))) {
    cpSync(resolve(root, 'impressum.html'), resolve(outDir, 'impressum.html'));
  }

  console.log('Host-App UI →', outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

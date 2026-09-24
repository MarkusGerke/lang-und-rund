import {
  cpSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

function pack(target) {
  const out = resolve(root, `dist-${target}`);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(dist, out, { recursive: true });

  const manifestSrc =
    target === 'firefox'
      ? resolve(root, 'manifest.firefox.json')
      : resolve(root, 'manifest.chrome.json');
  writeFileSync(resolve(out, 'manifest.json'), readFileSync(manifestSrc));

  const fontsOut = resolve(out, 'fonts');
  mkdirSync(fontsOut, { recursive: true });

  const maguntia = resolve(root, 'public/fonts/unifrakturmaguntia.ttf');
  if (existsSync(maguntia)) {
    cpSync(maguntia, resolve(fontsOut, 'unifrakturmaguntia.ttf'));
  }

  const kurrentTtf = resolve(root, 'public/fonts/kurrent.ttf');
  if (existsSync(kurrentTtf)) {
    cpSync(kurrentTtf, resolve(fontsOut, 'kurrent.ttf'));
  }

  const notice = resolve(root, 'public/READABILITY-LICENSE.md');
  if (existsSync(notice)) {
    cpSync(notice, resolve(out, 'READABILITY-LICENSE.md'));
  }

  console.log(`Packed ${target} → ${out}`);
}

pack('chrome');
pack('firefox');

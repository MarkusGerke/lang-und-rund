/**
 * Entry fürs Watch-Daten-Backen (wird von bake-watch-data.mjs per esbuild gebündelt).
 */
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { convertLongS } from '@langs/core';
import { matchPitfalls, pitfallCopy } from '../src/learning/matchPitfalls';
import startWordsData from '../src/learning/startWords.json';
import { encodeForDisplay } from '../src/reader/kurrentEncode';
import type { DisplayMode } from '../src/shared/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = join(__dirname, '..');
const OUT_DIR = join(EXT_DIR, 'safari/watch/Resources');
const OUT_JSON = join(OUT_DIR, 'watchWords.json');
const FONT_SRC = join(EXT_DIR, 'public/fonts');

interface StartWord {
  modern: string;
  pitfallIds: string[];
  preferredMode: DisplayMode;
}

type ScriptMode = 'fraktur' | 'kurrent' | 'suetterlin';

interface WatchTip {
  id: string;
  title: string;
  confusion: string;
  glyphs: string[];
}

interface WatchWordMode {
  word: string;
  tips: WatchTip[];
}

interface WatchWord {
  modern: string;
  fraktur: WatchWordMode;
  kurrent: WatchWordMode;
  suetterlin: WatchWordMode;
}

function tipsFor(
  modern: string,
  converted: string,
  mode: ScriptMode,
): WatchTip[] {
  const hits = matchPitfalls(converted, mode);
  const preferred = new Set(
    (startWordsData.words as StartWord[]).find((w) => w.modern === modern)
      ?.pitfallIds ?? [],
  );
  const ordered = [
    ...hits.filter((h) => preferred.has(h.pitfall.id)),
    ...hits.filter((h) => !preferred.has(h.pitfall.id)),
  ];
  return ordered
    .filter((h) => h.pitfall.modes.includes(mode))
    .map((h) => ({
      id: h.pitfall.id,
      title: h.pitfall.title,
      confusion: pitfallCopy(h.pitfall, mode).confusion,
      glyphs: h.pitfall.glyphs.map((g) => encodeForDisplay(g, mode)),
    }));
}

function bakeWord(row: StartWord): WatchWord {
  const converted = convertLongS(row.modern).output;
  return {
    modern: row.modern,
    fraktur: {
      word: converted,
      tips: tipsFor(row.modern, converted, 'fraktur'),
    },
    kurrent: {
      word: encodeForDisplay(converted, 'kurrent'),
      tips: tipsFor(row.modern, converted, 'kurrent'),
    },
    suetterlin: {
      word: encodeForDisplay(converted, 'suetterlin'),
      tips: tipsFor(row.modern, converted, 'suetterlin'),
    },
  };
}

mkdirSync(OUT_DIR, { recursive: true });

const words = (startWordsData.words as StartWord[]).map(bakeWord);
const payload = {
  version: 1,
  generatedAt: new Date().toISOString(),
  words,
};

writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2) + '\n', 'utf8');

for (const font of ['unifrakturmaguntia.ttf', 'kurrent.ttf', 'suetterlin.ttf']) {
  const src = join(FONT_SRC, font);
  if (existsSync(src)) copyFileSync(src, join(OUT_DIR, font));
}

for (const lic of [
  'FRAKTUR-LICENSE.txt',
  'KURRENT-LICENSE.txt',
  'SUETTERLIN-LICENSE.txt',
]) {
  const src = join(FONT_SRC, lic);
  if (existsSync(src)) copyFileSync(src, join(OUT_DIR, lic));
}

console.log(
  `→ Watch-Daten: ${words.length} Wörter → safari/watch/Resources/watchWords.json`,
);

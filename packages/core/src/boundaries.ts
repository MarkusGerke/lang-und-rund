/** Erzwingt an Position `index` ein rundes oder langes s. */
export interface SBoundary {
  index: number;
  variant: 'round' | 'long';
}

/**
 * Fugen-s: produktive Suffixe + Bindungs-s vor dem rechten Kompositumteil.
 * z. B. Bildung|s|politik, Migration|s|hintergrund
 * Quelle: Wikipedia „Fraktursatz“ / „Langes s“ — rundes s am Ende der Wortfuge.
 */
const LINKING_S_PATTERN =
  /(ung|tion|ion|heit|keit|schaft|ierung|ment|ling|nis|tum|werk)s(?=[a-zäöüß])/gi;

/** -ismus direkt vor weiterem Stamm: Antisemitismus|forschung */
const ISMUS_LINKING_PATTERN = /ismus(?=[bcdfghjklmnpqrtvwxyzßaeiouäöü])/gi;

/**
 * Orts-/Flurnamen: Fugen-s vor produktivem zweitem Teil.
 * z. B. Grimmels|hausen, Springins|feld, Gais|bach
 */
const PLACE_FUGEN_PATTERN =
  /s(?=hausen|heim|berg|burg|dorf|stadt|bach|feld|wald|kirchen)/gi;

/**
 * Häufige Fugen ohne Suffix-Liste (Leben|s|…, Krieg|s|…).
 * Vor Vokal und Konsonant rund — klassische Teilwortgrenze.
 */
const COMMON_FUGEN_PATTERN = /(leben|krieg|geistes|landes|volkes)s(?=[a-zäöüß])/gi;

/**
 * Genitiv-Fugen-s: linker Kompositumteil endet auf typisches Genitiv-s.
 * z. B. Bundes|republik, Geschichts|wissenschaft, volks|pädagogisch
 * Nicht vor Digraph ſch / Stamm-ſt / Stamm-ſp (siehe findGenitiveLinkingS).
 */
const GENITIVE_LEFT_ENDINGS =
  /(?:chts|nds|lgs|lfs|tags|nks|lks|oks|nis|ismus|urs|hs|es|ions|ons|gs|ens|iegs|ugs)$/i;

/**
 * Flexions-s: Stamm endet auf s, Suffix folgt (-en, -er, -em, -es, -eln).
 * z. B. Sachs|en → Sachsen
 */
const INFLECTION_S_PATTERN = /^(.{3,}s)(en|er|em|es|eln)$/i;

/** Nach s: Flexions-/Superlativreste, die zu Stamm-ſt gehören (nicht Fuge). */
const STEM_ST_REMAINDERS =
  /^(t|te|ten|ter|tes|tem|te[nmr]?|ste|sten|ster|stes|stem)$/i;

/** Morphem-Fuge bei ss mit validiertem linken Teil. */
function findMorphemeSSBoundaries(word: string): SBoundary[] {
  const lower = word.toLowerCase();

  for (let i = 1; i < word.length - 1; i++) {
    if (lower[i] !== 's' || lower[i + 1] !== 's') continue;

    const left = lower.slice(0, i + 1);
    if (left.length < 4) continue;

    const isPrefix = ROUND_S_PREFIXES.some((p) => left === p);
    const isGenitive = GENITIVE_LEFT_ENDINGS.test(left);

    if (isPrefix || isGenitive) {
      return [
        { index: i, variant: 'round' },
        { index: i + 1, variant: 'long' },
      ];
    }
  }

  return [];
}

/**
 * Kurze Präfixe mit rundem s am Ende (Morphem-Grenze).
 * Nur anwenden, wenn das s wirklich Präfixende ist — nicht Teil von ſch/ſt/ſp.
 * Vgl. Typografie.info: Ausdauer, Disput; aber Anſicht, biſchöflich.
 */
export const ROUND_S_PREFIXES = [
  'aus',
  'des',
  'dis',
  'mis',
  'wes',
  'bis',
  'das',
  'ans',
  'ins',
  'ums',
  'urs',
  'abs',
  'als',
  'res',
  'mes',
  'nes',
  'ers',
  'heraus',
  'hinauf',
  'hinunter',
  'hinein',
  'herüber',
  'hindurch',
  'voran',
  'zurück',
];

function addBoundary(map: Map<number, 'round' | 'long'>, b: SBoundary): void {
  map.set(b.index, b.variant);
}

/** True, wenn s den Digraphen/Trigraphen ſch / ſt / ſp im selben Stamm beginnt. */
export function isSchStSpOnset(word: string, sIndex: number): boolean {
  const lower = word.toLowerCase();
  const next = lower[sIndex + 1];
  if (!next) return false;
  if (next === 'c' && lower[sIndex + 2] === 'h') return true;
  if (next === 't' || next === 'p') {
    const rest = lower.slice(sIndex + 1);
    // Kurzer Rest oder Flexion → Stamm-ſt/ſp, keine Fuge
    if (STEM_ST_REMAINDERS.test(rest)) return true;
    if (rest.length <= 2) return true;
    return false;
  }
  return false;
}

/**
 * Genitiv-Fugen-s an Grenzen (heuristisch).
 * Nie vor ſch; vor t/p nur wenn rechter Teil wie ein Kompositumglied aussieht
 * (Hilfs|truppen), nicht bei Angſt / wichtigſte / erſt.
 */
function findGenitiveLinkingS(word: string): SBoundary[] {
  const results: SBoundary[] = [];
  const lower = word.toLowerCase();

  for (let i = 3; i < word.length - 1; i++) {
    if (lower[i] !== 's') continue;

    const next = lower[i + 1];
    if (!next) continue;
    if (next === 's') continue;

    // Digraph ſch: immer lang (Menſchen, brandſchatzten, Gefolgſchaft)
    if (next === 'c' && lower[i + 2] === 'h') continue;

    const left = lower.slice(0, i + 1);
    if (left.length < 4) continue;
    if (!GENITIVE_LEFT_ENDINGS.test(left)) continue;
    if (/gs$/i.test(left) && left.length < 5) continue;

    const rest = lower.slice(i + 1);

    // Vor t/p: nur klare Kompositumfugen (Hilfs|truppen), kein Stamm-ſt und
    // kein „Land|st…“-Muster (nds vor t → oft ſt-Anlaut des Zweitglieds)
    if (next === 't' || next === 'p') {
      if (STEM_ST_REMAINDERS.test(rest)) continue;
      if (rest.length < 4) continue;
      if (/nds$/i.test(left)) continue;
    }

    // Vor Vokal nur bei klaren Genitiv-Endungen (Kriegs|ende). Lebens|… über COMMON_FUGEN.
    if (/[aeiouäöü]/.test(next)) {
      if (!/(?:iegs|ugs|gs|chts|nds|lfs|tags|ions|ons|ismus)$/i.test(left)) {
        continue;
      }
    } else if (!/[bcdfghjklmnpqrtvwxyzß]/.test(next)) {
      continue;
    }

    results.push({ index: i, variant: 'round' });
  }

  return results;
}

function applySingleSPatternRounds(
  word: string,
  pattern: RegExp,
  boundaries: Map<number, 'round' | 'long'>,
): void {
  for (const match of word.matchAll(pattern)) {
    const idx = match.index!;
    if (word[idx]?.toLowerCase() === 's') {
      addBoundary(boundaries, { index: idx, variant: 'round' });
    }
  }
}

/** Präfix nur wenn s nicht Teil von ſch/ſt/ſp ist und nicht „dass“-artig. */
function applyPrefixBoundaries(
  word: string,
  boundaries: Map<number, 'round' | 'long'>,
): void {
  const lower = word.toLowerCase();
  for (const prefix of ROUND_S_PREFIXES) {
    if (!lower.startsWith(prefix) || lower.length <= prefix.length) continue;
    const sIndex = prefix.length - 1;
    if (word[sIndex]?.toLowerCase() !== 's') continue;

    // „dass“: Präfix „das“ + restliches s → ſs, kein Präfix-Schluss-s
    if (lower.length === prefix.length + 1 && lower[prefix.length] === 's') {
      continue;
    }

    // ſch / kurzes ſt / ſp gehören zum Stamm (biſchöflich, Anſcheinend, erſt)
    if (isSchStSpOnset(word, sIndex)) continue;

    addBoundary(boundaries, { index: sIndex, variant: 'round' });
  }
}

/** Sammelt alle Grenzpositionen für ein Wort (rein heuristisch). */
export function collectBoundaries(word: string): Map<number, 'round' | 'long'> {
  const boundaries = new Map<number, 'round' | 'long'>();

  // 1a. Fugen-s (-ung/-tion/…)
  for (const match of word.matchAll(LINKING_S_PATTERN)) {
    const sIndex = match.index! + match[0].length - 1;
    addBoundary(boundaries, { index: sIndex, variant: 'round' });
  }

  // 1b. -ismus vor weiterem Stamm
  for (const match of word.matchAll(ISMUS_LINKING_PATTERN)) {
    const sIndex = match.index! + match[0].length - 1;
    addBoundary(boundaries, { index: sIndex, variant: 'round' });
  }

  // 1c. Ortsnamen-Fuge
  applySingleSPatternRounds(word, PLACE_FUGEN_PATTERN, boundaries);

  // 1d. Häufige Fugen Leben|s|…, Krieg|s|…
  for (const match of word.matchAll(COMMON_FUGEN_PATTERN)) {
    const sIndex = match.index! + match[0].length - 1;
    addBoundary(boundaries, { index: sIndex, variant: 'round' });
  }

  // 1e. Diminutiv -chen nach Stamm auf s (Häs|chen), nicht Adjektiv -ischen
  for (const match of word.matchAll(/[aeiouäöüy]s(?=chen$)/gi)) {
    if (/ischen$/i.test(word)) continue;
    const sIndex = match.index! + 1;
    addBoundary(boundaries, { index: sIndex, variant: 'round' });
  }

  // 1e. Genitiv-Fugen-s
  for (const b of findGenitiveLinkingS(word)) {
    addBoundary(boundaries, b);
  }

  // 2. Morphem-Fuge bei ss
  for (const b of findMorphemeSSBoundaries(word)) {
    addBoundary(boundaries, b);
  }

  // 3. Flexions-s vor Endung
  const inflMatch = word.match(INFLECTION_S_PATTERN);
  if (inflMatch) {
    const sIndex = inflMatch[1].length - 1;
    if (!boundaries.has(sIndex)) {
      addBoundary(boundaries, { index: sIndex, variant: 'round' });
    }
  }

  // 4. Präfix-Morpheme
  applyPrefixBoundaries(word, boundaries);

  return boundaries;
}

/**
 * Linke Seite wie bei Wachs|tube: Fugen-Ende, das auch als Stamm ohne s
 * lesbar ist (Wach|stube). Nur diese Klasse braucht manuelle Wahl.
 */
const FUGEN_LIKE_LEFT = /(?:chs|nds)$/i;

/**
 * Positionen, an denen rund vs. lang die Lesart ändert und der Schreiber
 * entscheiden muss (unklare Wortfuge vor ſt/ſp).
 * Klassiker laut Wikipedia Fraktursatz: Wachs|tube vs. Wach|stube.
 */
export function findChoicePoints(word: string): number[] {
  const lower = word.toLowerCase();
  const boundaries = collectBoundaries(word);
  const points: number[] = [];

  for (let i = 1; i < word.length - 1; i++) {
    if (lower[i] !== 's') continue;
    if (boundaries.has(i)) continue;

    const next = lower[i + 1];
    if (next !== 't' && next !== 'p') continue;

    const rest = lower.slice(i + 1);
    if (STEM_ST_REMAINDERS.test(rest)) continue;
    if (rest.length < 4) continue;

    const left = lower.slice(0, i + 1);
    const leftStem = lower.slice(0, i);
    // Lange Lesart braucht Stamm ≥ 4 (Wach|…); „Mün|ster…“ ausscheiden
    if (leftStem.length < 4) continue;
    if (!FUGEN_LIKE_LEFT.test(left)) continue;

    points.push(i);
  }

  return points;
}

/** Bindestrich: letztes s im linken Segment bleibt rund. */
export function hyphenLeftBoundaries(part: string): SBoundary[] {
  const chars = [...part];
  for (let i = chars.length - 1; i >= 0; i--) {
    if (chars[i].toLowerCase() === 's') {
      return [{ index: i, variant: 'round' }];
    }
  }
  return [];
}

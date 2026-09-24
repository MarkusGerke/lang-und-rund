import {
  collectBoundaries,
  findChoicePoints,
  hyphenLeftBoundaries,
  ROUND_S_PREFIXES,
} from './boundaries';
import type {
  AmbiguityCandidate,
  AmbiguitySpan,
  ConvertedSegment,
  Result,
  UserOverride,
} from './types';

/** Deutsche Buchstaben inkl. Umlaute und ß. */
const WORD_PATTERN = /[a-zA-ZäöüÄÖÜß]+|[^a-zA-ZäöüÄÖÜß]+/g;

interface AmbiguityDefinition {
  splitAt: number;
  /** 0 = Fuge (rund) zuerst, 1 = Silbenanfang (lang) zuerst als Default */
  defaultIndex?: number;
  candidates: Array<{ description: string }>;
}

/**
 * Dokumentierte Mehrdeutigkeiten (Wikipedia Fraktursatz):
 * rundes s = Ende der ersten sinntragenden Einheit (Fuge);
 * langes ſ = Anfang der zweiten (ſt/ſp/ſch).
 */
const AMBIGUOUS_COMPOUNDS: Record<string, AmbiguityDefinition> = {
  wachstube: {
    splitAt: 4,
    candidates: [
      { description: 'Wachs + tube (Tube aus Wachs) → rundes s' },
      { description: 'Wach + stube (Wachstube) → langes ſ' },
    ],
  },
  sauerstoff: {
    splitAt: 5,
    candidates: [
      { description: 'Sauers + toff (Fuge, unüblich) → rundes s' },
      { description: 'Sauer + stoff → langes ſ' },
    ],
  },
  tausend: {
    splitAt: 3,
    candidates: [
      { description: 'Taus + end → rundes s' },
      { description: 'Tau + send → langes ſ' },
    ],
  },
  landstörtzerin: {
    splitAt: 4,
    defaultIndex: 1,
    candidates: [
      { description: 'Lands + törtzerin (Fuge) → rundes s' },
      { description: 'Land + störtzerin → langes ſ' },
    ],
  },
};

let ambiguityCounter = 0;

function nextAmbiguityId(): string {
  return `amb-${++ambiguityCounter}`;
}

function resetAmbiguityCounter(): void {
  ambiguityCounter = 0;
}

function toLongS(_isUpper: boolean): string {
  return 'ſ';
}

function toRoundS(isUpper: boolean): string {
  return isUpper ? 'S' : 's';
}

/** Großes S in Akronumen (NSDAP, AfD): zwischen Großbuchstaben rund lassen. */
function isAcronymUpperS(word: string, index: number): boolean {
  if (word[index] !== 'S') return false;
  const prev = word[index - 1];
  const next = word[index + 1];
  const isUpper = (ch: string | undefined) =>
    ch !== undefined && ch >= 'A' && ch <= 'Z';
  return isUpper(prev) || isUpper(next);
}

/**
 * Kernkonvertierung: wendet Grenzregeln vor Default-Regeln an.
 */
function convertWordCore(
  word: string,
  extraBoundaries?: Map<number, 'round' | 'long'>,
): string {
  const boundaries = collectBoundaries(word);
  if (extraBoundaries) {
    for (const [idx, variant] of extraBoundaries) {
      boundaries.set(idx, variant);
    }
  }

  const chars = [...word];
  let result = '';

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === 'ß' || c === 'ẞ') {
      result += c;
      continue;
    }

    const lower = c.toLowerCase();
    if (lower !== 's') {
      result += c;
      continue;
    }

    const isUpper = c === 'S';
    const next = chars[i + 1];
    const isLast = i === chars.length - 1;
    const forced = boundaries.get(i);

    if (forced) {
      result += forced === 'round' ? toRoundS(isUpper) : toLongS(isUpper);
      continue;
    }

    // ss → ſs nur wenn keine Morphem-Fuge an dieser Stelle
    if (next?.toLowerCase() === 's' && !boundaries.has(i + 1)) {
      result += toLongS(isUpper);
      i++;
      const nextUpper = chars[i] === 'S';
      result += toRoundS(nextUpper);
      continue;
    }

    // Wortanfängliches großes S bleibt rund
    if (i === 0 && isUpper) {
      result += 'S';
      continue;
    }

    // Akronyme: großes S zwischen Großbuchstaben bleibt rund
    if (isUpper && isAcronymUpperS(word, i)) {
      result += 'S';
      continue;
    }

    if (isLast) {
      result += toRoundS(isUpper);
    } else {
      result += toLongS(isUpper);
    }
  }

  return result;
}

function convertHyphenated(word: string): string {
  const parts = word.split('-');
  return parts
    .map((part, index) => {
      const extra = new Map<number, 'round' | 'long'>();
      if (index < parts.length - 1) {
        for (const b of hyphenLeftBoundaries(part)) {
          extra.set(b.index, b.variant);
        }
      }
      return convertWordCore(part, extra);
    })
    .join('-');
}

function buildCandidateText(
  word: string,
  splitAt: number,
  useRoundAtSplit: boolean,
): string {
  const extra = new Map<number, 'round' | 'long'>();
  extra.set(splitAt, useRoundAtSplit ? 'round' : 'long');
  return convertWordCore(word, extra);
}

function describeSplit(word: string, splitAt: number, round: boolean): string {
  const left = word.slice(0, splitAt + 1);
  const right = word.slice(splitAt + 1);
  if (round) {
    return `${left} + ${right} (Fuge, rundes s)`;
  }
  return `${word.slice(0, splitAt)} + ${word.slice(splitAt)} (Silbenanfang, langes ſ)`;
}

function resolveAmbiguityDefinition(word: string): AmbiguityDefinition | null {
  const lower = word.toLowerCase();
  if (AMBIGUOUS_COMPOUNDS[lower]) {
    return AMBIGUOUS_COMPOUNDS[lower];
  }

  const points = findChoicePoints(word);
  if (points.length === 0) return null;

  // Erste relevante Fuge — typisch die bedeutungsunterscheidende
  const splitAt = points[0];
  return {
    splitAt,
    candidates: [
      { description: describeSplit(word, splitAt, true) },
      { description: describeSplit(word, splitAt, false) },
    ],
  };
}

function createAmbiguitySpan(
  word: string,
  sourceStart: number,
  definition: AmbiguityDefinition,
  selectedIndex: number,
): AmbiguitySpan {
  const candidates: AmbiguityCandidate[] = definition.candidates.map(
    (c, idx) => ({
      text: buildCandidateText(word, definition.splitAt, idx === 0),
      description: c.description,
    }),
  );

  return {
    id: nextAmbiguityId(),
    sourceStart,
    sourceEnd: sourceStart + word.length,
    sourceWord: word,
    candidates,
    selectedIndex,
  };
}

function getOverrideIndex(
  spanId: string,
  overrides: Map<string, number> | undefined,
  defaultIndex: number,
): number {
  if (overrides?.has(spanId)) {
    return overrides.get(spanId)!;
  }
  return defaultIndex;
}

function convertToken(
  token: string,
  overrideMap: Map<string, number>,
  tokenStart: number,
  stableId?: string,
): { segment: ConvertedSegment; ambiguity?: AmbiguitySpan } {
  const ambiguityDef = resolveAmbiguityDefinition(token);

  if (ambiguityDef) {
    const defaultIdx = ambiguityDef.defaultIndex ?? 0;
    const span = createAmbiguitySpan(token, tokenStart, ambiguityDef, defaultIdx);
    if (stableId) span.id = stableId;
    const selectedIdx = getOverrideIndex(span.id, overrideMap, defaultIdx);
    span.selectedIndex = selectedIdx;
    return {
      segment: {
        type: 'ambiguity',
        text: span.candidates[selectedIdx].text,
        ambiguity: span,
      },
      ambiguity: span,
    };
  }

  if (token.includes('-')) {
    return { segment: { type: 'text', text: convertHyphenated(token) } };
  }

  return { segment: { type: 'text', text: convertWordCore(token) } };
}

function wordNeedsStableId(token: string): boolean {
  return resolveAmbiguityDefinition(token) !== null;
}

/**
 * Konvertiert modernen deutschen Text in historische ſ/s-Schreibung.
 * Basiert auf heuristischen Grenzregeln, nicht auf Wörterbuch-Ersetzung.
 */
export function convertLongS(
  input: string,
  overrides?: Map<string, number> | UserOverride[],
): Result {
  resetAmbiguityCounter();

  const overrideMap = new Map<string, number>();
  if (overrides) {
    if (Array.isArray(overrides)) {
      for (const o of overrides) {
        overrideMap.set(o.ambiguityId, o.selectedIndex);
      }
    } else {
      for (const [k, v] of overrides) {
        overrideMap.set(k, v);
      }
    }
  }

  const segments: ConvertedSegment[] = [];
  const ambiguities: AmbiguitySpan[] = [];
  let sourcePos = 0;

  const tokens = input.match(WORD_PATTERN) ?? [];

  for (const token of tokens) {
    const tokenStart = sourcePos;
    sourcePos += token.length;

    if (!/^[a-zA-ZäöüÄÖÜß]+$/.test(token)) {
      segments.push({ type: 'text', text: token });
      continue;
    }

    const { segment, ambiguity } = convertToken(token, overrideMap, tokenStart);
    segments.push(segment);
    if (ambiguity) ambiguities.push(ambiguity);
  }

  return {
    input,
    segments,
    ambiguities,
    output: segments.map((s) => s.text).join(''),
  };
}

export function ambiguityIdForWord(word: string, occurrenceIndex: number): string {
  return `word-${word.toLowerCase()}-${occurrenceIndex}`;
}

export function convertLongSWithStableIds(
  input: string,
  overrides?: Map<string, number>,
): Result {
  resetAmbiguityCounter();

  const overrideMap = overrides ?? new Map<string, number>();
  const wordOccurrences = new Map<string, number>();

  const segments: ConvertedSegment[] = [];
  const ambiguities: AmbiguitySpan[] = [];
  let sourcePos = 0;

  const tokens = input.match(WORD_PATTERN) ?? [];

  for (const token of tokens) {
    const tokenStart = sourcePos;
    sourcePos += token.length;

    if (!/^[a-zA-ZäöüÄÖÜß]+$/.test(token)) {
      segments.push({ type: 'text', text: token });
      continue;
    }

    const lower = token.toLowerCase();
    const occ = wordOccurrences.get(lower) ?? 0;
    wordOccurrences.set(lower, occ + 1);
    const stableId = wordNeedsStableId(token)
      ? ambiguityIdForWord(token, occ)
      : undefined;

    const { segment, ambiguity } = convertToken(
      token,
      overrideMap,
      tokenStart,
      stableId,
    );
    segments.push(segment);
    if (ambiguity) ambiguities.push(ambiguity);
  }

  return {
    input,
    segments,
    ambiguities,
    output: segments.map((s) => s.text).join(''),
  };
}

// Re-export für Tests und Dokumentation
export { ROUND_S_PREFIXES };

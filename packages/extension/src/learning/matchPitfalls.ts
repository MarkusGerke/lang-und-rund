import pitfallsData from './pitfalls.json';
import type { DisplayMode } from '../shared/types';

export interface PitfallModeText {
  confusion?: string;
  writing?: string;
}

export interface Pitfall {
  id: string;
  modes: DisplayMode[];
  title: string;
  glyphs: string[];
  /** Niedriger = höher priorisiert innerhalb des Modus */
  rank?: number;
  /**
   * Didaktische Welle je Modus (1 = zuerst).
   * Sortierung der Hinweise; alle Wellen werden angezeigt.
   */
  wave: Partial<Record<DisplayMode, number>>;
  /**
   * Texte, die nur in einem Schriftmodus gelten.
   * Grundtext bleibt für die übrigen Modi.
   */
  byMode?: Partial<Record<DisplayMode, PitfallModeText>>;
  match:
    | { type: 'letters'; any: string[] }
    | { type: 'pattern'; regex: string }
    | { type: 'sForms' }
    | { type: 'hasCapital' };
  /** Block 1: Womit leicht zu verwechseln? */
  confusion: string;
  /** Block 2: Woran erkenne ich die Schreibart? */
  writing: string;
  /** Optionaler Kontext-Tipp */
  context?: string;
}

export interface PitfallHit {
  pitfall: Pitfall;
  /** Indizes im Anzeige-/Analysewort (Normalform mit ſ), die relevant sind */
  highlightIndexes: number[];
}

const ALL_MODES: DisplayMode[] = ['antiqua', 'fraktur', 'kurrent', 'suetterlin'];

export function pitfallCopy(
  pitfall: Pitfall,
  mode?: DisplayMode,
): { confusion: string; writing: string } {
  const over = mode ? pitfall.byMode?.[mode] : undefined;
  return {
    confusion: over?.confusion ?? pitfall.confusion,
    writing: over?.writing ?? pitfall.writing,
  };
}
const pitfalls = pitfallsData.pitfalls as Pitfall[];

export function pitfallWaveForMode(
  pitfall: Pitfall,
  mode: DisplayMode,
): number {
  return (
    pitfall.wave[mode] ??
    pitfall.wave.fraktur ??
    pitfall.wave.kurrent ??
    pitfall.wave.antiqua ??
    5
  );
}

/** Analyseform: modern + ſ beibehalten, Kleinbuchstaben außer ſ. */
export function normalizeForMatch(word: string): string {
  return [...word]
    .map((ch) => {
      if (ch === 'ſ' || ch === 'ẞ') return ch === 'ẞ' ? 'ß' : 'ſ';
      return ch.toLowerCase();
    })
    .join('');
}

function indexesOfAny(word: string, chars: string[]): number[] {
  const capitalsOnly = chars.every(
    (c) => c !== 'ſ' && c !== 'ß' && c === c.toUpperCase() && c !== c.toLowerCase(),
  );
  const set = new Set(capitalsOnly ? chars : chars.map((c) => c.toLowerCase()));
  const out: number[] = [];
  const charsArr = [...word];
  for (let i = 0; i < charsArr.length; i++) {
    const ch = charsArr[i];
    const key = capitalsOnly ? ch : ch === 'ſ' ? 'ſ' : ch.toLowerCase();
    if (set.has(key)) out.push(i);
  }
  return out;
}

function indexesOfRegex(word: string, source: string): number[] {
  const re = new RegExp(source, 'gi');
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(word)) !== null) {
    for (let i = m.index; i < m.index + m[0].length; i++) out.push(i);
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}

function collectHits(
  displayWord: string,
  modes: DisplayMode[],
): PitfallHit[] {
  const norm = normalizeForMatch(displayWord);
  const applicable = pitfalls.filter((p) =>
    p.modes.some((m) => modes.includes(m)),
  );
  const hits: PitfallHit[] = [];
  const seen = new Set<string>();

  for (const pitfall of applicable) {
    if (seen.has(pitfall.id)) continue;
    let highlightIndexes: number[] = [];

    switch (pitfall.match.type) {
      case 'letters': {
        const any = pitfall.match.any;
        const capitalsOnly = any.every(
          (c) =>
            c !== 'ſ' &&
            c !== 'ß' &&
            c === c.toUpperCase() &&
            c !== c.toLowerCase(),
        );
        highlightIndexes = indexesOfAny(
          capitalsOnly ? displayWord : norm,
          any,
        );
        break;
      }
      case 'pattern':
        highlightIndexes = indexesOfRegex(norm, pitfall.match.regex);
        break;
      case 'sForms': {
        const hasLong = norm.includes('ſ');
        const hasRound = /s/.test(norm.replace(/ſ/g, ''));
        if (!hasLong && !hasRound) break;
        highlightIndexes = indexesOfAny(norm, ['ſ', 's']);
        break;
      }
      case 'hasCapital':
        if (![...displayWord].some((c) => c >= 'A' && c <= 'Z')) break;
        highlightIndexes = [...displayWord]
          .map((c, i) => (c >= 'A' && c <= 'Z' ? i : -1))
          .filter((i) => i >= 0);
        break;
      default:
        break;
    }

    if (highlightIndexes.length === 0) continue;
    seen.add(pitfall.id);
    hits.push({
      pitfall,
      highlightIndexes: [...new Set(highlightIndexes)].sort((a, b) => a - b),
    });
  }

  return hits;
}

/**
 * Treffer im aktiven Schriftmodus.
 * Sortierung: Welle, dann Rank.
 */
export function matchPitfalls(
  displayWord: string,
  mode: DisplayMode,
): PitfallHit[] {
  let hits = collectHits(displayWord, [mode]);
  if (hits.length === 0) hits = collectHits(displayWord, ALL_MODES);

  hits.sort(
    (a, b) =>
      pitfallWaveForMode(a.pitfall, mode) -
        pitfallWaveForMode(b.pitfall, mode) ||
      (a.pitfall.rank ?? 100) - (b.pitfall.rank ?? 100) ||
      a.pitfall.id.localeCompare(b.pitfall.id),
  );

  return hits;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatPitfallPlain(p: Pitfall, mode?: DisplayMode): string {
  const copy = pitfallCopy(p, mode);
  const parts = [
    `Verwechslungsgefahr: ${copy.confusion}`,
    `Schreibart: ${copy.writing}`,
  ];
  if (p.context) parts.push(`Kontext: ${p.context}`);
  return parts.join(' ');
}

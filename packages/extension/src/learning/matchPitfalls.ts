import pitfallsData from './pitfalls.json';
import type { DisplayMode } from '../shared/types';

export interface Pitfall {
  id: string;
  modes: DisplayMode[];
  title: string;
  glyphs: string[];
  /** Niedriger = häufiger / wahrscheinlicher zu verkennen */
  rank?: number;
  match:
    | { type: 'letters'; any: string[] }
    | { type: 'pattern'; regex: string }
    | { type: 'sForms' }
    | { type: 'hasCapital' };
  hint: string;
}

export interface PitfallHit {
  pitfall: Pitfall;
  /** Indizes im Anzeige-/Analysewort (Normalform mit ſ), die relevant sind */
  highlightIndexes: number[];
}

const ALL_MODES: DisplayMode[] = ['antiqua', 'fraktur', 'kurrent'];
const pitfalls = pitfallsData.pitfalls as Pitfall[];

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
  const set = new Set(chars.map((c) => c.toLowerCase()));
  const out: number[] = [];
  const charsArr = [...word];
  for (let i = 0; i < charsArr.length; i++) {
    const ch = charsArr[i];
    const key = ch === 'ſ' ? 'ſ' : ch.toLowerCase();
    if (set.has(key) || set.has(ch)) out.push(i);
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
      case 'letters':
        highlightIndexes = indexesOfAny(norm, pitfall.match.any);
        break;
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

  hits.sort(
    (a, b) =>
      (a.pitfall.rank ?? 100) - (b.pitfall.rank ?? 100) ||
      a.pitfall.id.localeCompare(b.pitfall.id),
  );

  return hits;
}

/**
 * Zuerst Treffer im aktiven Schriftmodus; wenn keiner, Fallstricke zu
 * vorhandenen Buchstaben aus allen Modi (Verwechslungen/Besonderheiten).
 */
export function matchPitfalls(
  displayWord: string,
  mode: DisplayMode,
): PitfallHit[] {
  const modeHits = collectHits(displayWord, [mode]);
  if (modeHits.length > 0) return modeHits;
  return collectHits(displayWord, ALL_MODES);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

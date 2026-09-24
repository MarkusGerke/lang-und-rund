export interface GermanDetection {
  isGerman: boolean;
  reason: 'lang' | 'heuristic' | 'override' | 'none';
  score: number;
}

const GERMAN_STOPWORDS = [
  'der',
  'die',
  'das',
  'und',
  'ist',
  'von',
  'zu',
  'mit',
  'auf',
  'für',
  'nicht',
  'ein',
  'eine',
  'als',
  'auch',
  'sich',
  'dem',
  'den',
  'des',
  'werden',
  'wurde',
  'nach',
  'bei',
  'oder',
  'aber',
  'können',
  'über',
  'wenn',
  'nur',
  'noch',
  'wie',
  'man',
  'aus',
  'hat',
  'haben',
  'wird',
  'sind',
  'war',
  'im',
  'am',
];

/** True für de, de-DE, de_AT, … */
export function isGermanLangTag(lang: string | null | undefined): boolean {
  if (!lang) return false;
  const primary = lang.trim().toLowerCase().split(/[-_]/)[0];
  return primary === 'de';
}

/**
 * Heuristik auf Text: Stoppwörter, ß, Umlaute.
 * Score 0–1; üblich ab ~0.25 als Deutsch werten.
 */
export function scoreGermanText(text: string): number {
  const sample = text.slice(0, 8000).toLowerCase();
  if (sample.trim().length < 40) return 0;

  const words = sample.match(/[a-zäöüß]+/g) ?? [];
  if (words.length < 12) return 0;

  let stopHits = 0;
  for (const w of words) {
    if (GERMAN_STOPWORDS.includes(w)) stopHits++;
  }
  const stopRatio = stopHits / words.length;

  const umlautHits = (sample.match(/[äöüÄÖÜß]/g) ?? []).length;
  const umlautBonus = Math.min(0.35, umlautHits / 40);

  return Math.min(1, stopRatio * 2.2 + umlautBonus);
}

/**
 * Erkennt Deutsch über lang-Attribut und/oder Textheuristik.
 * `force` erzwingt das Ergebnis (Override).
 */
export function detectGerman(options: {
  lang?: string | null;
  text: string;
  force?: boolean | null;
}): GermanDetection {
  if (options.force === true) {
    return { isGerman: true, reason: 'override', score: 1 };
  }
  if (options.force === false) {
    return { isGerman: false, reason: 'override', score: 0 };
  }

  if (isGermanLangTag(options.lang)) {
    return { isGerman: true, reason: 'lang', score: 1 };
  }

  const score = scoreGermanText(options.text);
  if (score >= 0.22) {
    return { isGerman: true, reason: 'heuristic', score };
  }

  return { isGerman: false, reason: 'none', score };
}

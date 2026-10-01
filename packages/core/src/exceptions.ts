/**
 * Ausnahme-Wörterbuch: bestätigt korrekte ſ/s-Schreibung überschreibt die Heuristik.
 * Keys immer kleingeschrieben (moderne Orthographie ohne ſ).
 * Values: Zielschreibung mit ſ/# wie angezeigt (kleingeschrieben); Großschreibung
 * wird aus dem Quellwort übernommen.
 *
 * Quelle der Labels: Typografie.info-Hauptregel + dokumentierte Ausnahmen.
 * Einträge mit `note` weichen ab oder präzisieren Grenzfälle.
 */

export interface ExceptionEntry {
  /** Zielwort (klein), mit ſ wo nötig */
  output: string;
  /** Kurznotiz bei Abweichung / Review */
  note?: string;
  /** confirmed = menschlich geprüft; suggested = KI-Vorschlag */
  status: 'confirmed' | 'suggested';
}

/** Bestätigte Korrekturen (CI muss diese exakt treffen). */
export const EXCEPTION_LEXICON: Record<string, ExceptionEntry> = {
  frühstück: {
    output: 'frühſtück',
    note: 'Stück-Anlaut → ſ (kein Genitiv-hs)',
    status: 'confirmed',
  },
  rohstoff: {
    output: 'rohſtoff',
    note: 'Stoff-Anlaut → ſ',
    status: 'confirmed',
  },
  kuhstall: {
    output: 'kuhſtall',
    note: 'Stall-Anlaut → ſ',
    status: 'confirmed',
  },
};

/**
 * Schreibt die Ausnahme-Schreibung mit Groß/Klein des Quellworts.
 * ſ bleibt ſ (kein Majuskel-ſ in unserer Anzeige).
 */
export function applyExceptionCasing(source: string, targetLower: string): string {
  const src = [...source];
  const tgt = [...targetLower];
  if (src.length !== tgt.length) {
    // Länge kann bei ß↔ſs etc. abweichen — dann Ziel unverändert (klein) zurück
    // Für 1:1-Ersetzung s↔ſ sind Längen gleich.
    return targetLower;
  }
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const s = src[i]!;
    const t = tgt[i]!;
    if (t === 'ſ') {
      out += 'ſ';
      continue;
    }
    if (s === s.toUpperCase() && s !== s.toLowerCase()) {
      out += t.toUpperCase();
    } else {
      out += t;
    }
  }
  return out;
}

export function lookupException(word: string): ExceptionEntry | null {
  return EXCEPTION_LEXICON[word.toLowerCase()] ?? null;
}

/** Alle bestätigten Einträge für Regressionstests. */
export function confirmedExceptions(): Array<{ input: string; output: string }> {
  return Object.entries(EXCEPTION_LEXICON)
    .filter(([, e]) => e.status === 'confirmed')
    .map(([input, e]) => ({
      input,
      output: applyExceptionCasing(input, e.output),
    }));
}

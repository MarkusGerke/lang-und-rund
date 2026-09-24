/** Variante eines s: lang (ſ) oder rund (s). */
export type SVariant = 'long' | 'round';

/** Eine Lesart bei Mehrdeutigkeit. */
export interface AmbiguityCandidate {
  /** Konvertiertes Wort mit dieser Lesart. */
  text: string;
  /** Kurze Beschreibung der Zerlegung, z. B. „Wachs + tube“. */
  description: string;
}

/** Markierter mehrdeutiger Bereich im Text. */
export interface AmbiguitySpan {
  id: string;
  /** Startposition im Eingabetext (Zeichenindex). */
  sourceStart: number;
  /** Endposition im Eingabetext (exklusiv). */
  sourceEnd: number;
  /** Ursprüngliches Wort (modern). */
  sourceWord: string;
  /** Mögliche Lesarten. */
  candidates: AmbiguityCandidate[];
  /** Index der gewählten Lesart (0-basiert). */
  selectedIndex: number;
}

/** Ein Segment im konvertierten Ergebnis. */
export interface ConvertedSegment {
  type: 'text' | 'ambiguity';
  /** Anzeigetext (bei Ambiguität: gewählte Lesart). */
  text: string;
  ambiguity?: AmbiguitySpan;
}

/** Ergebnis der ſ/s-Konvertierung. */
export interface Result {
  input: string;
  segments: ConvertedSegment[];
  ambiguities: AmbiguitySpan[];
  /** Vollständiger Ausgabetext mit angewandten Overrides. */
  output: string;
}

/** Benutzer-Override für eine Mehrdeutigkeit. */
export interface UserOverride {
  ambiguityId: string;
  selectedIndex: number;
}

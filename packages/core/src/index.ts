export type {
  AmbiguityCandidate,
  AmbiguitySpan,
  ConvertedSegment,
  Result,
  SVariant,
  UserOverride,
} from './types';

export {
  convertLongS,
  convertLongSWithStableIds,
  ambiguityIdForWord,
  ROUND_S_PREFIXES,
} from './convertLongS';

export {
  collectBoundaries,
  findChoicePoints,
  hyphenLeftBoundaries,
  isSchStSpOnset,
} from './boundaries';
export type { SBoundary } from './boundaries';

export {
  detectGerman,
  isGermanLangTag,
  scoreGermanText,
} from './detectGerman';
export type { GermanDetection } from './detectGerman';

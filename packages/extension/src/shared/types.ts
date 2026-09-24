export type DisplayMode = 'antiqua' | 'fraktur' | 'kurrent';
export type ThemeMode = 'light' | 'sepia' | 'graphite' | 'dark';
export type MeasureMode = 'narrow' | 'medium' | 'wide';

export interface LangsSettings {
  displayMode: DisplayMode;
  theme: ThemeMode;
  measure: MeasureMode;
  /** Schriftgröße pro Darstellungsmodus (px). */
  fontSizes: Record<DisplayMode, number>;
  /** Hover-Tooltip mit moderner s-Schreibung. */
  wordTooltip: boolean;
  /** Bilder und Medien im Lesemodus ausblenden. */
  textOnly: boolean;
  forceGerman: boolean | null;
}

export interface ArticlePayload {
  id: string;
  title: string;
  byline: string;
  siteName: string;
  sourceUrl: string;
  lang: string | null;
  contentHtml: string;
  textContent: string;
  excerpt: string;
  createdAt: number;
}

/** Antiqua-Basis 20; Fraktur +2×A+ (=+4); Kurrent 2× der vorherigen 32 (=64). */
export const MODE_DEFAULT_FONT_SIZE: Record<DisplayMode, number> = {
  antiqua: 20,
  fraktur: 24,
  kurrent: 64,
};

export const DEFAULT_SETTINGS: LangsSettings = {
  displayMode: 'antiqua',
  theme: 'sepia',
  measure: 'medium',
  fontSizes: { ...MODE_DEFAULT_FONT_SIZE },
  wordTooltip: true,
  textOnly: true,
  forceGerman: null,
};

export const SETTINGS_KEY = 'langs-settings';
export const ARTICLE_KEY_PREFIX = 'langs-article:';

export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 80;
export const FONT_SIZE_STEP = 2;

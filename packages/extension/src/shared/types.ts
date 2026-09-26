export type DisplayMode = 'antiqua' | 'fraktur' | 'kurrent' | 'suetterlin';
export type ThemeMode = 'light' | 'sepia' | 'graphite' | 'dark';
export type MeasureMode = 'narrow' | 'medium' | 'wide';

/** Zeilenhöhe als Multiplikator (CSS line-height). */
export type LeadingValue = number;

export interface LangsSettings {
  displayMode: DisplayMode;
  theme: ThemeMode;
  measure: MeasureMode;
  /** CSS line-height Multiplikator. */
  leading: LeadingValue;
  /** Schriftgröße pro Darstellungsmodus (px). */
  fontSizes: Record<DisplayMode, number>;
  /** Bilder, Videos und Embeds (Tweets usw.) im Lesemodus ausblenden. */
  textOnly: boolean;
  /**
   * Host-App: Drawer folgt dem Textcursor (Caret).
   * Aus = Wort nur per Mausklick im Drawer öffnen.
   */
  drawerLiveCursor: boolean;
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

/** Antiqua 20; Fraktur 24; Kurrent Desktop 68; Sütterlin Desktop 36; Kurrent mobil oft 52. */
export const MODE_DEFAULT_FONT_SIZE: Record<DisplayMode, number> = {
  antiqua: 20,
  fraktur: 24,
  /** Desktop-Default; mobil (≤640) Override auf KURRENT_FONT_SIZE_MOBILE wenn noch Default. */
  kurrent: 68,
  /** 16× STEP unter dem Kurrent-Desktop-Default. */
  suetterlin: 36,
};

export function isDisplayMode(value: unknown): value is DisplayMode {
  return (
    value === 'antiqua' ||
    value === 'fraktur' ||
    value === 'kurrent' ||
    value === 'suetterlin'
  );
}

/** Kurrent und Sütterlin: gleiche ſ/#-Belegung, große Schrift. */
export function isHandScript(mode: DisplayMode): boolean {
  return mode === 'kurrent' || mode === 'suetterlin';
}

/** Soft-Cap gegen Extremwerte; Plus/Minus clampen hier. */
export const LEADING_MIN = 0.7;
export const LEADING_MAX = 4;
export const LEADING_STEP = 0.05;
export const LEADING_DEFAULT = 1.4;

const LEGACY_LEADING: Record<string, number> = {
  compact: 1.4,
  normal: 1.75,
  loose: 2.2,
};

export function clampLeading(value: number): LeadingValue {
  const n = Math.round(value / LEADING_STEP) * LEADING_STEP;
  return Math.min(LEADING_MAX, Math.max(LEADING_MIN, Number(n.toFixed(2))));
}

/** Alte Enum-Werte und Zahlen → Multiplikator. */
export function parseLeading(raw: unknown): LeadingValue {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return clampLeading(raw);
  }
  if (typeof raw === 'string') {
    if (raw in LEGACY_LEADING) return LEGACY_LEADING[raw]!;
    const n = Number(raw);
    if (Number.isFinite(n)) return clampLeading(n);
  }
  return LEADING_DEFAULT;
}

export const DEFAULT_SETTINGS: LangsSettings = {
  displayMode: 'fraktur',
  theme: 'sepia',
  measure: 'medium',
  leading: LEADING_DEFAULT,
  fontSizes: { ...MODE_DEFAULT_FONT_SIZE },
  textOnly: true,
  drawerLiveCursor: false,
  forceGerman: null,
};

/** Kurrent mobil (≤640px): 6× STEP unter dem früheren 64er-Default. */
export const KURRENT_FONT_SIZE_MOBILE = 52;

export const SETTINGS_KEY = 'langs-settings';
export const ARTICLE_KEY_PREFIX = 'langs-article:';

export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 80;
export const FONT_SIZE_STEP = 2;

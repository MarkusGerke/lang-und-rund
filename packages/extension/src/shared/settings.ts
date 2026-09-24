import {
  DEFAULT_SETTINGS,
  MODE_DEFAULT_FONT_SIZE,
  SETTINGS_KEY,
  type DisplayMode,
  type LangsSettings,
  type MeasureMode,
} from './types';

function migrate(raw: Record<string, unknown> | undefined): LangsSettings {
  if (!raw) {
    return {
      ...DEFAULT_SETTINGS,
      fontSizes: { ...MODE_DEFAULT_FONT_SIZE },
    };
  }

  const fontSizes = { ...MODE_DEFAULT_FONT_SIZE };
  if (raw.fontSizes && typeof raw.fontSizes === 'object') {
    const fs = raw.fontSizes as Record<string, number>;
    for (const mode of Object.keys(MODE_DEFAULT_FONT_SIZE) as DisplayMode[]) {
      if (typeof fs[mode] === 'number') fontSizes[mode] = fs[mode];
    }
    // Alte Kurrent-Default 32 → neues Default 64 (2×)
    if (fs.kurrent === 32) fontSizes.kurrent = MODE_DEFAULT_FONT_SIZE.kurrent;
  } else if (typeof raw.fontSize === 'number') {
    const mode =
      raw.displayMode === 'fraktur' || raw.displayMode === 'kurrent'
        ? (raw.displayMode as DisplayMode)
        : 'antiqua';
    fontSizes[mode] = raw.fontSize;
  }

  return {
    displayMode:
      raw.displayMode === 'fraktur' || raw.displayMode === 'kurrent'
        ? raw.displayMode
        : 'antiqua',
    theme:
      raw.theme === 'dark' ||
      raw.theme === 'light' ||
      raw.theme === 'sepia' ||
      raw.theme === 'graphite'
        ? raw.theme
        : 'sepia',
    measure:
      raw.measure === 'narrow' || raw.measure === 'wide'
        ? (raw.measure as MeasureMode)
        : 'medium',
    fontSizes,
    wordTooltip: raw.wordTooltip !== false,
    textOnly: raw.textOnly !== false,
    forceGerman:
      raw.forceGerman === true || raw.forceGerman === false
        ? raw.forceGerman
        : null,
  };
}

export async function loadSettings(): Promise<LangsSettings> {
  const data = await chrome.storage.sync.get(SETTINGS_KEY);
  return migrate(data[SETTINGS_KEY] as Record<string, unknown> | undefined);
}

export async function saveSettings(
  patch: Partial<LangsSettings> & {
    fontSize?: number;
    fontSizeMode?: DisplayMode;
  },
): Promise<LangsSettings> {
  const current = await loadSettings();
  const next: LangsSettings = {
    ...current,
    ...patch,
    fontSizes: { ...current.fontSizes, ...(patch.fontSizes ?? {}) },
  };

  if (typeof patch.fontSize === 'number') {
    const mode = patch.fontSizeMode ?? next.displayMode;
    next.fontSizes[mode] = patch.fontSize;
  }

  delete (next as { fontSize?: number }).fontSize;
  delete (next as { fontSizeMode?: DisplayMode }).fontSizeMode;

  await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
  return next;
}

import {
  DEFAULT_SETTINGS,
  isDisplayMode,
  MODE_DEFAULT_FONT_SIZE,
  parseLeading,
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
    if (fs.kurrent === 32 || fs.kurrent === 64) {
      fontSizes.kurrent = MODE_DEFAULT_FONT_SIZE.kurrent;
    }
    // Sütterlin: frühere Desktop-Defaults → aktuelles Default
    if (fs.suetterlin === 68 || fs.suetterlin === 44) {
      fontSizes.suetterlin = MODE_DEFAULT_FONT_SIZE.suetterlin;
    }
  } else if (typeof raw.fontSize === 'number') {
    const mode = isDisplayMode(raw.displayMode) ? raw.displayMode : 'fraktur';
    fontSizes[mode] = raw.fontSize;
  }

  const displayMode: DisplayMode = isDisplayMode(raw.displayMode)
    ? raw.displayMode
    : 'fraktur';

  return {
    displayMode,
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
    leading: parseLeading(raw.leading),
    fontSizes,
    textOnly: raw.textOnly !== false,
    drawerLiveCursor: raw.drawerLiveCursor === true,
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

  if (typeof patch.leading === 'number') {
    next.leading = parseLeading(patch.leading);
  }

  if (typeof patch.fontSize === 'number') {
    const mode = patch.fontSizeMode ?? next.displayMode;
    next.fontSizes[mode] = patch.fontSize;
  }

  delete (next as { fontSize?: number }).fontSize;
  delete (next as { fontSizeMode?: DisplayMode }).fontSizeMode;

  await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
  return next;
}

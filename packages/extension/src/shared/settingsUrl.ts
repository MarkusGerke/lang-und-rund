import {
  isDisplayMode,
  isThemeMode,
  MODE_DEFAULT_FONT_SIZE,
  parseLeading,
  type DisplayMode,
  type LangsSettings,
  type MeasureMode,
} from './types';

const RESERVED = new Set(['host', 'id']);

/** Liest Host-Einstellungen aus der Seiten-URL (kein Cookie / kein Webstorage). */
export function readSettingsFromUrl(): Record<string, unknown> | null {
  const params = new URLSearchParams(location.search);
  if (params.toString() === '') return null;

  const raw: Record<string, unknown> = {};
  let any = false;

  const dm = params.get('dm');
  if (dm && isDisplayMode(dm)) {
    raw.displayMode = dm;
    any = true;
  }

  const th = params.get('th');
  if (th && isThemeMode(th)) {
    raw.theme = th;
    any = true;
  }

  const me = params.get('me');
  if (me === 'narrow' || me === 'medium' || me === 'wide') {
    raw.measure = me as MeasureMode;
    any = true;
  }

  const ld = params.get('ld');
  if (ld != null && ld !== '') {
    raw.leading = parseLeading(ld);
    any = true;
  }

  const to = params.get('to');
  if (to === '0' || to === '1') {
    raw.textOnly = to === '1';
    any = true;
  }

  const lc = params.get('lc');
  if (lc === '0' || lc === '1') {
    raw.drawerLiveCursor = lc === '1';
    any = true;
  }

  const wc = params.get('wc');
  if (wc === '0' || wc === '1') {
    raw.drawerWordClick = wc === '1';
    any = true;
  }

  const fs = params.get('fs');
  if (fs) {
    const parts = fs.split(',').map((p) => Number(p.trim()));
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      const modes: DisplayMode[] = ['fraktur', 'kurrent', 'suetterlin', 'antiqua'];
      const fontSizes: Record<string, number> = {};
      modes.forEach((mode, i) => {
        fontSizes[mode] = parts[i]!;
      });
      raw.fontSizes = fontSizes;
      any = true;
    }
  }

  const fg = params.get('fg');
  if (fg === 'auto' || fg === 'yes' || fg === 'no') {
    raw.forceGerman =
      fg === 'yes' ? true : fg === 'no' ? false : null;
    any = true;
  }

  return any ? raw : null;
}

/** Schreibt Einstellungen in die URL (history.replaceState), behält host/id. */
export function writeSettingsToUrl(settings: LangsSettings): void {
  const params = new URLSearchParams(location.search);
  const drop: string[] = [];
  params.forEach((_, key) => {
    if (!RESERVED.has(key)) drop.push(key);
  });
  for (const key of drop) params.delete(key);

  params.set('dm', settings.displayMode);
  params.set('th', settings.theme);
  params.set('me', settings.measure);
  params.set('ld', String(settings.leading));
  params.set('to', settings.textOnly ? '1' : '0');
  params.set('lc', settings.drawerLiveCursor ? '1' : '0');
  params.set('wc', settings.drawerWordClick ? '1' : '0');

  const fs = (
    ['fraktur', 'kurrent', 'suetterlin', 'antiqua'] as DisplayMode[]
  )
    .map((m) => settings.fontSizes[m] ?? MODE_DEFAULT_FONT_SIZE[m])
    .join(',');
  params.set('fs', fs);

  if (settings.forceGerman === true) params.set('fg', 'yes');
  else if (settings.forceGerman === false) params.set('fg', 'no');
  else params.set('fg', 'auto');

  const next = `${location.pathname}?${params.toString()}${location.hash}`;
  history.replaceState(null, '', next);
}

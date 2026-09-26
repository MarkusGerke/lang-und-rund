import { isHandScript, type DisplayMode } from '../shared/types';

/**
 * Zinken „Deutsche Kurrent“ und „Suetterlin HJZ 1911“:
 * - `s` = langes s
 * - `#` = Schluss-s (rundes s)
 * Unicode ſ fehlt in beiden Fonts. Daher: ſ→s, rundes s→#.
 */
export function encodeForDisplay(text: string, mode: DisplayMode): string {
  if (!isHandScript(mode)) return text;
  return text
    .replace(/ſ/g, '\uE000')
    .replace(/s/g, '#')
    .replace(/\uE000/g, 's');
}

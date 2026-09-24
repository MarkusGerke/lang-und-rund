import type { DisplayMode } from '../shared/types';

/**
 * Zinken „Deutsche Kurrent“ nutzt Tastatur-Sonderbelegung:
 * - `s` = langes s (Kurrent-Form)
 * - `#` = Schluss-s (rundes s)
 * Unicode ſ fehlt in der Font. Daher: ſ→s, rundes s→#.
 */
export function encodeForDisplay(text: string, mode: DisplayMode): string {
  if (mode !== 'kurrent') return text;
  return text
    .replace(/ſ/g, '\uE000')
    .replace(/s/g, '#')
    .replace(/\uE000/g, 's');
}

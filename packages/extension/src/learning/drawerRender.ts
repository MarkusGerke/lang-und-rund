import type { AmbiguitySpan } from '@langs/core';
import type { DisplayMode } from '../shared/types';
import { encodeForDisplay } from '../reader/kurrentEncode';
import { toModernS } from '../reader/textOnly';
import {
  renderDrawerFeedbackTile,
  type ReportContext,
} from './feedback';
import {
  escapeHtml,
  matchPitfalls,
  pitfallCopy,
  type Pitfall,
  type PitfallHit,
} from './matchPitfalls';

export interface DrawerWordContext {
  converted: string;
  modern: string;
  ambiguity?: AmbiguitySpan;
}

interface LetterGroup {
  letterKey: string;
  displayLetter: string;
  indexes: number[];
  pitfalls: Pitfall[];
  minRank: number;
}

function wordHasSForm(word: string): boolean {
  return /[ſsSßẞ]/.test(word);
}

/** Schlüssel für Gruppierung / Hover-Verknüpfung (ſ bleibt ſ). */
export function letterKeyOf(ch: string): string {
  if (ch === 'ſ') return 'ſ';
  if (ch === 'ẞ' || ch === 'ß') return 'ß';
  return ch.toLowerCase();
}

function renderHighlightedWord(
  word: string,
  hitIndexes: Set<number>,
): string {
  const parts = [...word]
    .map((ch, i) => {
      const esc = escapeHtml(ch);
      if (hitIndexes.has(i)) {
        return (
          `<button type="button" class="drawer-letter" ` +
          `data-index="${i}" data-letter-key="${escapeHtml(letterKeyOf(ch))}">` +
          `${esc}</button>`
        );
      }
      return `<span class="drawer-letter-plain">${esc}</span>`;
    })
    .join('');
  return `<span class="drawer-letter-row">${parts}</span>`;
}

function allHighlightIndexes(hits: PitfallHit[]): Set<number> {
  const set = new Set<number>();
  for (const h of hits) for (const i of h.highlightIndexes) set.add(i);
  return set;
}

function glyphDisplayMode(
  pitfallModes: DisplayMode[],
  active: DisplayMode,
): DisplayMode {
  if (pitfallModes.includes(active)) return active;
  if (pitfallModes.includes('fraktur')) return 'fraktur';
  if (pitfallModes.includes('kurrent')) return 'kurrent';
  if (pitfallModes.includes('suetterlin')) return 'suetterlin';
  return pitfallModes[0] ?? active;
}

function fontClassForMode(mode: DisplayMode): string {
  if (mode === 'fraktur') return 'fraktur-font';
  if (mode === 'kurrent') return 'kurrent-font';
  if (mode === 'suetterlin') return 'suetterlin-font';
  return 'antiqua-font';
}

function scriptLabel(mode: DisplayMode): string | null {
  if (mode === 'kurrent') return 'Kurrent';
  if (mode === 'suetterlin') return 'Sütterlin';
  if (mode === 'fraktur') return 'Fraktur';
  return null;
}

function renderGlyphPair(glyphs: string[], mode: DisplayMode): string {
  return glyphs
    .map((g) => {
      const visual = encodeForDisplay(g, mode);
      const fontClass = fontClassForMode(mode);
      return (
        `<span class="glyph-chip">` +
        `<span class="glyph-script ${fontClass}">${escapeHtml(visual)}</span>` +
        `<span class="glyph-label">${escapeHtml(toModernS(g))}</span>` +
        `</span>`
      );
    })
    .join('<span class="glyph-vs" aria-hidden="true">·</span>');
}

function groupHitsByLetter(
  hits: PitfallHit[],
  word: string,
): LetterGroup[] {
  const chars = [...word];
  const map = new Map<string, LetterGroup>();

  for (const hit of hits) {
    for (const idx of hit.highlightIndexes) {
      const ch = chars[idx];
      if (ch == null) continue;
      const key = letterKeyOf(ch);
      let group = map.get(key);
      if (!group) {
        group = {
          letterKey: key,
          displayLetter: toModernS(ch) === ch ? ch : toModernS(ch),
          indexes: [],
          pitfalls: [],
          minRank: hit.pitfall.rank ?? 100,
        };
        map.set(key, group);
      }
      if (!group.indexes.includes(idx)) group.indexes.push(idx);
      if (!group.pitfalls.some((p) => p.id === hit.pitfall.id)) {
        group.pitfalls.push(hit.pitfall);
      }
      group.minRank = Math.min(group.minRank, hit.pitfall.rank ?? 100);
    }
  }

  for (const g of map.values()) {
    g.indexes.sort((a, b) => a - b);
    g.pitfalls.sort(
      (a, b) =>
        (a.rank ?? 100) - (b.rank ?? 100) || a.id.localeCompare(b.id),
    );
  }

  return [...map.values()].sort(
    (a, b) => a.minRank - b.minRank || a.letterKey.localeCompare(b.letterKey),
  );
}

/**
 * Nur die Buchstaben des Vergleichs (Feld `glyphs`).
 * Kein Absuchen des Fließtexts: „spitzer/offener“ ist kein Paar r/o.
 */
function glyphsForPitfall(pitfall: Pitfall, focusKey: string): string[] {
  const prefer = (g: string) => letterKeyOf(g) === focusKey;
  const ordered = [
    ...pitfall.glyphs.filter(prefer),
    ...pitfall.glyphs.filter((g) => !prefer(g)),
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const g of ordered) {
    const k = letterKeyOf(g) + ':' + g;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(g);
  }
  return out;
}

function renderPitfallBlocks(p: Pitfall, mode?: DisplayMode): string {
  const script = mode ? scriptLabel(mode) : null;
  const copy = pitfallCopy(p, mode);
  const confuseLabel = script
    ? `Verwechslungsgefahr (${script})`
    : 'Verwechslungsgefahr';
  const writingLabel = script ? `Schreibart in der ${script}` : 'Schreibart';
  let html =
    `<div class="pitfall-block">` +
    `<p class="pitfall-block-label">${escapeHtml(confuseLabel)}</p>` +
    `<p class="pitfall-hint">${escapeHtml(copy.confusion)}</p>` +
    `</div>` +
    `<div class="pitfall-block">` +
    `<p class="pitfall-block-label">${escapeHtml(writingLabel)}</p>` +
    `<p class="pitfall-hint">${escapeHtml(copy.writing)}</p>` +
    `</div>`;
  if (p.context) {
    html +=
      `<div class="pitfall-block">` +
      `<p class="pitfall-block-label">Kontext</p>` +
      `<p class="pitfall-hint">${escapeHtml(p.context)}</p>` +
      `</div>`;
  }
  return html;
}

/** Eine Lernhinweis-Karte (für Drawer-Gruppen und Startseiten-Carousel). */
export function renderPitfallHintCard(
  pitfall: Pitfall,
  mode: DisplayMode,
  options?: { focusKey?: string },
): string {
  const focusKey = options?.focusKey ?? letterKeyOf(pitfall.glyphs[0] ?? '');
  const glyphMode = glyphDisplayMode(pitfall.modes, mode);
  const glyphs = glyphsForPitfall(pitfall, focusKey);
  return (
    `<article class="pitfall-card start-hint-card" data-pitfall-id="${escapeHtml(pitfall.id)}">` +
    `<h3 class="pitfall-item-title">${escapeHtml(pitfall.title)}</h3>` +
    (glyphs.length
      ? `<div class="glyph-row">${renderGlyphPair(glyphs, glyphMode)}</div>`
      : '') +
    renderPitfallBlocks(pitfall, mode) +
    `</article>`
  );
}

function renderGroupedPitfallCards(
  groups: LetterGroup[],
  mode: DisplayMode,
): string {
  if (groups.length === 0) return '';

  return groups
    .map((group) => {
      const label =
        group.letterKey === 'ſ'
          ? 'ſ'
          : group.displayLetter.length === 1
            ? group.displayLetter
            : group.letterKey;

      const items = group.pitfalls
        .map((p) => {
          const glyphMode = glyphDisplayMode(p.modes, mode);
          const glyphs = glyphsForPitfall(p, group.letterKey);
          return (
            `<div class="pitfall-item">` +
            `<h4 class="pitfall-item-title">${escapeHtml(p.title)}</h4>` +
            (glyphs.length
              ? `<div class="glyph-row">${renderGlyphPair(glyphs, glyphMode)}</div>`
              : '') +
            renderPitfallBlocks(p, mode) +
            `</div>`
          );
        })
        .join('');

      return (
        `<article class="pitfall-card" id="pitfall-letter-${escapeHtml(group.letterKey)}" ` +
        `data-letter-key="${escapeHtml(group.letterKey)}" ` +
        `data-indexes="${group.indexes.join(',')}">` +
        `<header class="pitfall-header">` +
        `<h3 class="pitfall-title">Zu „${escapeHtml(label)}“</h3>` +
        `</header>` +
        items +
        `</article>`
      );
    })
    .join('');
}

export function renderAmbiguityOptionsHtml(amb: AmbiguitySpan): string {
  return amb.candidates
    .map((c, idx) => {
      const selected = idx === amb.selectedIndex;
      return (
        `<button type="button" class="drawer-amb-option tip-amb-option${selected ? ' selected' : ''}" ` +
        `data-amb-id="${escapeHtml(amb.id)}" data-amb-index="${idx}">` +
        `<span class="drawer-amb-text">${escapeHtml(c.text)}</span>` +
        `<span class="drawer-amb-desc">${escapeHtml(c.description)}</span>` +
        `</button>`
      );
    })
    .join('');
}

function renderAmbiguitySection(amb: AmbiguitySpan): string {
  return (
    `<section class="drawer-section">` +
    `<h2 class="drawer-section-title">Wortfuge unklar</h2>` +
    `<div class="drawer-amb-list" role="listbox">${renderAmbiguityOptionsHtml(amb)}</div>` +
    `</section>`
  );
}

export function renderDrawerBodyPrecise(
  ctx: DrawerWordContext,
  mode: DisplayMode,
  options?: { drawerLiveCursor?: boolean; showLiveCursorToggle?: boolean },
): { html: string; hits: PitfallHit[]; report: ReportContext } {
  const hits = matchPitfalls(ctx.converted, mode);
  const convertedHighlights = allHighlightIndexes(hits);
  const modernAligned = toModernS(ctx.converted);
  const modernHighlights = new Set<number>();
  const convChars = [...ctx.converted];
  for (let ci = 0; ci < convChars.length; ci++) {
    if (convertedHighlights.has(ci)) modernHighlights.add(ci);
  }

  const groups = groupHitsByLetter(hits, ctx.converted);
  const showConverted = wordHasSForm(ctx.converted);
  const frakturPreview = ctx.converted;
  const kurrentPreview = encodeForDisplay(ctx.converted, 'kurrent');
  const suetterlinPreview = encodeForDisplay(ctx.converted, 'suetterlin');

  const liveOn = options?.drawerLiveCursor === true;
  const liveToggle =
    options?.showLiveCursorToggle === true
      ? `<label class="drawer-follow-ctrl">` +
        `<span class="drawer-follow-label">Livevorschau mittels Cursor</span>` +
        `<button type="button" class="switch drawer-live-toggle" role="switch" ` +
        `aria-checked="${liveOn ? 'true' : 'false'}" ` +
        `title="${liveOn ? 'Drawer folgt dem Textcursor. Ausschalten: nur per Mausklick aufs Wort.' : 'Nur per Mausklick aufs Wort. Einschalten: Drawer folgt dem Textcursor.'}">` +
        `<span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>` +
        `</button></label>`
      : '';
  const html =
    `<div class="drawer-word-block">` +
    liveToggle +
    `<p class="drawer-kicker">In Antiqua</p>` +
    `<p class="drawer-modern">${renderHighlightedWord(modernAligned, modernHighlights)}</p>` +
    (showConverted
      ? `<p class="drawer-kicker">Konvertiert (ſ/s)</p>` +
        `<p class="drawer-converted antiqua-font">${renderHighlightedWord(ctx.converted, convertedHighlights)}</p>`
      : '') +
    `<p class="drawer-kicker">In Fraktur</p>` +
    `<p class="drawer-preview fraktur-font">${escapeHtml(frakturPreview)}</p>` +
    `<p class="drawer-kicker">In Kurrent</p>` +
    `<p class="drawer-preview kurrent-font">${escapeHtml(kurrentPreview)}</p>` +
    `<p class="drawer-kicker">In Sütterlin</p>` +
    `<p class="drawer-preview suetterlin-font">${escapeHtml(suetterlinPreview)}</p>` +
    `</div>` +
    (ctx.ambiguity ? renderAmbiguitySection(ctx.ambiguity) : '') +
    `<section class="drawer-section pitfall-box">` +
    `<h2 class="drawer-section-title">Lernhinweise</h2>` +
    (groups.length > 0
      ? renderGroupedPitfallCards(groups, mode)
      : `<p class="drawer-empty">Keine Lernhinweise für dieses Wort.</p>`) +
    `</section>` +
    renderDrawerFeedbackTile();

  return {
    html,
    hits,
    report: {
      converted: ctx.converted,
      modern: ctx.modern,
      mode,
      hits,
    },
  };
}

import {
  convertLongSWithStableIds,
  type AmbiguitySpan,
  type Result,
} from '@langs/core';
import type { DisplayMode } from '../shared/types';
import { encodeForDisplay } from './kurrentEncode';
import { toModernS } from './textOnly';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const WORD_RE = /^[a-zA-ZäöüÄÖÜßſ]+$/;

function wrapWord(
  converted: string,
  mode: DisplayMode,
  extras: { id?: string; ambiguity?: boolean } = {},
): string {
  const classes = ['word'];
  if (extras.ambiguity) classes.push('ambiguity');
  const visual = encodeForDisplay(converted, mode);
  const modern = toModernS(converted);
  const idAttr = extras.id
    ? ` data-id="${escapeHtml(extras.id)}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="Lernhinweise: ${escapeHtml(modern)}"`
    : ' tabindex="0" role="button"';
  return (
    `<span class="${classes.join(' ')}" ` +
    `data-converted="${escapeHtml(converted)}" ` +
    `data-modern="${escapeHtml(modern)}" ` +
    `data-antiqua="${escapeHtml(modern)}"${idAttr}>` +
    `<span class="word-inner${extras.ambiguity ? ' ambiguity-word' : ''}">${escapeHtml(visual)}</span>` +
    `</span>`
  );
}

export function resultToHtml(result: Result, mode: DisplayMode): string {
  return result.segments
    .map((seg) => {
      if (seg.type === 'ambiguity' && seg.ambiguity) {
        return wrapWord(seg.text, mode, {
          id: seg.ambiguity.id,
          ambiguity: true,
        });
      }
      if (WORD_RE.test(seg.text)) {
        return wrapWord(seg.text, mode);
      }
      return escapeHtml(encodeForDisplay(seg.text, mode));
    })
    .join('');
}

export function convertHtmlFragment(
  html: string,
  overrides: Map<string, number>,
  mode: DisplayMode,
): { html: string; ambiguities: AmbiguitySpan[] } {
  const template = document.createElement('template');
  template.innerHTML = html;
  const root = template.content;
  const ambiguities: AmbiguitySpan[] = [];

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  for (const node of textNodes) {
    const parent = node.parentElement;
    if (
      parent &&
      ['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE'].includes(parent.tagName)
    ) {
      continue;
    }
    const raw = node.textContent ?? '';
    if (!raw.trim()) continue;

    const result = convertLongSWithStableIds(raw, overrides);
    ambiguities.push(...result.ambiguities);

    const wrap = document.createElement('span');
    wrap.innerHTML = resultToHtml(result, mode);
    node.replaceWith(...Array.from(wrap.childNodes));
  }

  const container = document.createElement('div');
  container.appendChild(root.cloneNode(true));
  return { html: container.innerHTML, ambiguities };
}

export function convertPlainTitle(
  title: string,
  overrides: Map<string, number>,
): Result {
  return convertLongSWithStableIds(title, overrides);
}

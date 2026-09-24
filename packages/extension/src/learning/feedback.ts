import {
  APP_VERSION,
  BRAND_NAME,
  REPO_ISSUES_URL,
  REPO_URL,
  X_HANDLE,
  X_URL,
} from '../shared/links';
import type { DisplayMode } from '../shared/types';
import type { PitfallHit } from './matchPitfalls';
import { escapeHtml } from './matchPitfalls';

export interface ReportContext {
  converted: string;
  modern: string;
  mode: DisplayMode;
  sourceUrl?: string;
  hits: PitfallHit[];
}

/** Kleines X-Logo (Buchstabe) vor dem Handle. */
export const X_LOGO_HTML =
  `<span class="x-logo" aria-hidden="true">` +
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">` +
  `<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.259 5.698L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>` +
  `</svg></span>`;

export function xHandleLinkHtml(className = ''): string {
  const cls = className ? ` class="${escapeHtml(className)}"` : '';
  return (
    `<a${cls} href="${escapeHtml(X_URL)}" target="_blank" rel="noopener">` +
    `${X_LOGO_HTML}<span class="x-handle">${escapeHtml(X_HANDLE)}</span>` +
    `</a>`
  );
}

export function formatReportBody(ctx: ReportContext): string {
  const hintLines =
    ctx.hits.length === 0
      ? '(keine Lernhinweise für dieses Wort)'
      : ctx.hits
          .map((h) => `- ${h.pitfall.title}: ${h.pitfall.hint}`)
          .join('\n');

  return [
    `Fehlerbericht — ${BRAND_NAME}`,
    '',
    `Wort (modern): ${ctx.modern}`,
    `Wort (ſ/s): ${ctx.converted}`,
    `Schriftmodus: ${ctx.mode}`,
    ctx.sourceUrl ? `Quelle: ${ctx.sourceUrl}` : null,
    '',
    'Lernhinweise zum Wort:',
    hintLines,
    '',
    'Beschreibung des Fehlers:',
    '(Bitte hier ergänzen)',
    '',
    `— gemeldet via ${BRAND_NAME} v${APP_VERSION}`,
  ]
    .filter((line): line is string => line != null)
    .join('\n');
}

/** GitHub-Issue, falls Repo existiert. */
export function buildReportIssueUrl(ctx: ReportContext): string | null {
  if (!REPO_ISSUES_URL) return null;
  const title = `[${BRAND_NAME}] ${ctx.modern || ctx.converted || 'Fehler'}`;
  const body = formatReportBody(ctx);
  const url = new URL(REPO_ISSUES_URL);
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  return url.toString();
}

/** Kurzer X-Intent (URL-Länge begrenzt). */
export function buildReportXUrl(ctx: ReportContext): string {
  const snippet = [
    `@${X_HANDLE} Fehler in ${BRAND_NAME}:`,
    `„${ctx.modern || ctx.converted}“ (${ctx.mode})`,
    ctx.hits[0] ? `Hinweis: ${ctx.hits[0].pitfall.title}` : '',
    '(Details in Zwischenablage)',
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 240);
  const url = new URL('https://x.com/intent/tweet');
  url.searchParams.set('text', snippet);
  return url.toString();
}

export function renderDrawerFeedbackTile(): string {
  return (
    `<aside class="drawer-feedback" aria-label="Hinweis zu Fehlern">` +
    `<p class="drawer-feedback-text">` +
    `Lernhinweise und Konvertierung können Fehler enthalten. ` +
    `Fallen dir Ungereimtheiten auf, melde sie gern — ` +
    `die Hinweise zu diesem Wort werden dabei mitgeschickt.` +
    `</p>` +
    `<div class="drawer-feedback-actions">` +
    `<button type="button" class="btn drawer-report-btn" data-report="issue">` +
    `Fehler melden` +
    `</button>` +
    xHandleLinkHtml('drawer-feedback-x') +
    `</div>` +
    `</aside>`
  );
}

/** Footer: Impressum + X (+ Repo nur wenn gesetzt) + Version. */
export function renderAppFooterLinks(impressumHref: string): string {
  const parts: string[] = [];
  if (REPO_URL) {
    parts.push(
      `<a href="${escapeHtml(REPO_URL)}" target="_blank" rel="noopener">Repo</a>`,
    );
  }
  parts.push(`<a href="${escapeHtml(impressumHref)}">Impressum</a>`);
  parts.push(xHandleLinkHtml());
  parts.push(
    `<span class="app-version" title="${escapeHtml(BRAND_NAME)}">v${escapeHtml(APP_VERSION)}</span>`,
  );
  return (
    `<footer class="app-footer">` +
    parts.join(`<span class="app-footer-sep" aria-hidden="true">·</span>`) +
    `</footer>`
  );
}

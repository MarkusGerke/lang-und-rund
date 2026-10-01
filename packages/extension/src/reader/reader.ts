import './reader.css';

import type { AmbiguitySpan } from '@langs/core';
import {
  ARTICLE_KEY_PREFIX,
  clampLeading,
  FONT_SIZE_STEP,
  isDisplayMode,
  KURRENT_FONT_SIZE_MOBILE,
  KURRENT_MAC_LEADING_CLICKS,
  LEADING_STEP,
  MODE_DEFAULT_FONT_SIZE,
  snapFontSize,
  type ArticlePayload,
  type DisplayMode,
  type LeadingValue,
  type MeasureMode,
  type ThemeMode,
} from '../shared/types';
import { loadSettings, saveSettings } from '../shared/settings';
import { writeSettingsToUrl } from '../shared/settingsUrl';
import {
  installChromePolyfill,
  isHostAppMode,
} from '../shared/chromePolyfill';
import {
  convertHtmlFragment,
  convertPlainTitle,
  resultToHtml,
} from './convertDom';
import { stripToTextOnly, toModernS } from './textOnly';
import {
  clipboardHtmlFromPaste,
  htmlToPlainText,
  plainToSimpleHtml,
  sanitizeRichHtml,
} from './richHtml';
import { renderDrawerBodyPrecise } from '../learning/drawerRender';
import {
  buildReportMailtoUrl,
  formatReportBody,
  renderAppFooterLinks,
  type ReportContext,
} from '../learning/feedback';
import { BRAND_NAME, IMPRESSUM_PATH, WINDOW_TITLE_CLAIM } from '../shared/links';

interface ReaderState {
  article: ArticlePayload;
  overrides: Record<string, number>;
  displayMode: DisplayMode;
  theme: ThemeMode;
  measure: MeasureMode;
  leading: LeadingValue;
  fontSizes: Record<DisplayMode, number>;
  textOnly: boolean;
  drawerLiveCursor: boolean;
  drawerWordClick: boolean;
}

/** Titel: explizit, sonst erstes H1, sonst erste Zeile. */
function resolveArticleTitle(
  explicit: string,
  contentHtml: string,
  plain: string,
): string {
  const t = explicit.trim();
  if (t) return t;
  if (contentHtml.includes('<')) {
    const d = document.createElement('div');
    d.innerHTML = contentHtml;
    const h1 = d.querySelector('h1')?.textContent?.trim();
    if (h1) return h1.slice(0, 80);
  }
  return plain.split(/\n/)[0]?.trim().slice(0, 80) || 'Eingefügter Text';
}

function plainTextToArticle(text: string, title: string): ArticlePayload {
  // Trailing Spaces nicht trimmen — sonst springt der Host-Caret nach Leertaste.
  const contentHtml = plainToSimpleHtml(text);
  const id = `paste-${Date.now().toString(36)}`;
  const resolvedTitle = resolveArticleTitle(title, contentHtml, text.trim());
  return {
    id,
    title: resolvedTitle,
    byline: '',
    siteName: 'Eingefügt',
    sourceUrl: 'about:blank',
    lang: 'de',
    contentHtml,
    textContent: text,
    excerpt: text.trim().slice(0, 160),
    createdAt: Date.now(),
  };
}

function richHtmlToArticle(html: string, title: string): ArticlePayload {
  const contentHtml = sanitizeRichHtml(html);
  const text = htmlToPlainText(contentHtml);
  const id = `paste-${Date.now().toString(36)}`;
  const resolvedTitle = resolveArticleTitle(title, contentHtml, text);
  return {
    id,
    title: resolvedTitle,
    byline: '',
    siteName: 'Eingefügt',
    sourceUrl: 'about:blank',
    lang: 'de',
    contentHtml,
    textContent: text,
    excerpt: text.slice(0, 160),
    createdAt: Date.now(),
  };
}

async function persistArticle(article: ArticlePayload): Promise<void> {
  const key = `${ARTICLE_KEY_PREFIX}${article.id}`;
  await chrome.storage.session.set({
    [key]: article,
    'langs-latest': article.id,
  });
}

function showToast(message: string): void {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2200);
}

function setSwitch(el: HTMLButtonElement, on: boolean): void {
  el.setAttribute('aria-checked', on ? 'true' : 'false');
}

async function loadArticle(id: string): Promise<ArticlePayload | null> {
  const key = `${ARTICLE_KEY_PREFIX}${id}`;
  const data = await chrome.storage.session.get(key);
  return (data[key] as ArticlePayload | undefined) ?? null;
}

async function init(): Promise<void> {
  installChromePolyfill();
  const hostMode =
    isHostAppMode() ||
    new URLSearchParams(location.search).get('host') === '1';
  /** iPhone/iPad (inkl. iPadOS-Desktop-UA). Nicht Mac-Trackpad (maxTouchPoints > 1). */
  const iosHost =
    hostMode &&
    (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' &&
        navigator.maxTouchPoints > 1 &&
        window.matchMedia('(hover: none)').matches));
  /** Host: immer Bearbeiten beim Öffnen (iOS + macOS); Lesen nur nach „Fertig“. */
  let editMode = true;

  const params = new URLSearchParams(location.search);
  let id = params.get('id');
  if (!id && !hostMode) {
    const latest = await chrome.storage.session.get('langs-latest');
    id = (latest['langs-latest'] as string | undefined) ?? null;
  }

  const app = document.getElementById('app');
  const toolbar = document.getElementById('toolbar');
  if (!app || !toolbar) return;

  if (hostMode) {
    app.classList.add('host-app');
    if (iosHost) app.classList.add('ios-host');
  }

  if (!id && !hostMode) {
    document.body.innerHTML =
      '<p style="padding:2rem;font-family:system-ui">Kein Artikel geladen. Öffne lang &amp; rund über das Erweiterungssymbol.</p>';
    return;
  }

  let article: ArticlePayload | null = id ? await loadArticle(id) : null;
  if (id && !article && !hostMode) {
    document.body.innerHTML =
      '<p style="padding:2rem;font-family:system-ui">Artikel nicht mehr verfügbar (Session abgelaufen).</p>';
    return;
  }

  const settings = await loadSettings();
  const SESSION_MODE_KEY = 'langs-session-display-mode';
  const sessionModeRaw = sessionStorage.getItem(SESSION_MODE_KEY);
  const sessionMode: DisplayMode | null =
    isDisplayMode(sessionModeRaw) && sessionModeRaw !== 'antiqua'
      ? sessionModeRaw
      : null;
  /** Jedes Öffnen startet in Fraktur; Umschaltung gilt nur in dieser Session. */
  const openMode: DisplayMode = sessionMode ?? 'fraktur';
  const isMobileViewport = () =>
    window.matchMedia('(max-width: 640px)').matches;
  const fontSizes = { ...settings.fontSizes };
  if (
    isMobileViewport() &&
    (fontSizes.kurrent === MODE_DEFAULT_FONT_SIZE.kurrent ||
      fontSizes.kurrent === 64)
  ) {
    fontSizes.kurrent = KURRENT_FONT_SIZE_MOBILE;
  }
  const state: ReaderState = {
    article: article ?? plainTextToArticle('', ''),
    overrides: {},
    displayMode: openMode,
    theme: settings.theme,
    measure: settings.measure,
    leading: settings.leading,
    fontSizes,
    textOnly: settings.textOnly,
    drawerLiveCursor: settings.drawerLiveCursor,
    drawerWordClick: settings.drawerWordClick,
  };

  if (hostMode) {
    writeSettingsToUrl({
      ...settings,
      displayMode: state.displayMode,
      fontSizes: state.fontSizes,
      leading: state.leading,
      drawerLiveCursor: state.drawerLiveCursor,
      drawerWordClick: state.drawerWordClick,
      textOnly: state.textOnly,
      theme: state.theme,
      measure: state.measure,
    });
  }

  let lastAmbiguities: AmbiguitySpan[] = [];
  let lastReport: ReportContext | null = null;
  let drawerOpen = false;
  /** Nach Drawer-Öffnen: Live-Cursor pausiert, bis wieder getippt wird. */
  let liveCursorPaused = false;

  const titleEl = document.getElementById('title')!;
  const contentEl = document.getElementById('content')!;
  const contentHost = document.getElementById(
    'content-host',
  ) as HTMLElement | null;
  const metaEl = document.getElementById('meta')!;
  const hintEl = document.getElementById('ambiguity-hint')!;
  const drawerEl = document.getElementById('learn-drawer')!;
  const drawerBody = document.getElementById('drawer-body')!;
  const hostIntro = document.getElementById('host-intro');
  const editorBody = document.getElementById('editor-body') as HTMLElement;
  const hostCaret = document.createElement('div');
  hostCaret.className = 'host-caret';
  hostCaret.hidden = true;
  hostCaret.setAttribute('aria-hidden', 'true');
  editorBody.parentElement?.appendChild(hostCaret);
  const displayGroup = document.getElementById('display-mode')!;
  const measureSelect = document.getElementById('measure') as HTMLSelectElement;
  const leadingMinus = document.getElementById(
    'leading-minus',
  ) as HTMLButtonElement;
  const leadingPlus = document.getElementById(
    'leading-plus',
  ) as HTMLButtonElement;
  const leadingValueInput = document.getElementById(
    'leading-value',
  ) as HTMLInputElement | null;
  const fontSizeValueInput = document.getElementById(
    'font-size-value',
  ) as HTMLInputElement | null;
  const themeGroup = document.getElementById('theme')!;
  const textOnlyToggle = document.getElementById(
    'text-only-toggle',
  ) as HTMLButtonElement;
  const drawerLiveCursorToggle = document.getElementById(
    'drawer-live-cursor-toggle',
  ) as HTMLButtonElement | null;
  const drawerWordClickToggle = document.getElementById(
    'drawer-word-click-toggle',
  ) as HTMLButtonElement | null;
  const editModeBtn = document.getElementById(
    'btn-edit-mode',
  ) as HTMLButtonElement | null;

  const footerEl = document.getElementById('app-footer');
  if (footerEl) {
    const impressumHref = hostMode
      ? new URL(
          location.protocol === 'file:' ? '../impressum.html' : 'impressum.html',
          document.baseURI,
        ).href
      : chrome.runtime.getURL(IMPRESSUM_PATH);
    footerEl.outerHTML = renderAppFooterLinks(impressumHref, {
      includeStartPage: !hostMode,
    });
    if (hostMode) {
      document.querySelector('.app-footer')?.addEventListener('click', (e) => {
        const a = (e.target as HTMLElement).closest('a');
        if (!a) return;
        const href = a.getAttribute('href');
        if (!href) return;
        let url: URL;
        try {
          url = new URL(href, document.baseURI);
        } catch {
          return;
        }
        const openExternal = (
          window as unknown as {
            webkit?: {
              messageHandlers?: {
                openExternal?: { postMessage: (v: string) => void };
              };
            };
          }
        ).webkit?.messageHandlers?.openExternal;
        // Website / Browser ohne Bridge: normale Link-Navigation.
        if (!openExternal) return;
        const scheme = url.protocol.replace(/:$/, '');
        // Impressum/Datenschutz im App-Bundle (file:) normal laden.
        if (scheme === 'file') return;
        if (scheme === 'http' || scheme === 'https' || scheme === 'mailto') {
          e.preventDefault();
          openExternal.postMessage(url.href);
        }
      });
    }
  }

  function syncChoiceGroup(group: HTMLElement, value: string): void {
    for (const btn of Array.from(
      group.querySelectorAll<HTMLButtonElement>('[data-value]'),
    )) {
      const on = btn.dataset.value === value;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function wireChoiceGroup(
    group: HTMLElement,
    onPick: (value: string) => void,
  ): void {
    group.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
        '[data-value]',
      );
      if (!btn?.dataset.value) return;
      onPick(btn.dataset.value);
    });
  }

  function stepLeading(delta: number): void {
    const next = clampLeading(state.leading + delta * LEADING_STEP);
    if (next === state.leading) return;
    state.leading = next;
    void saveSettings({ leading: state.leading });
    applyChrome();
    if (hostMode) fitHostLayers();
  }

  function setLeadingFromInput(raw: string): void {
    const normalized = raw.replace(',', '.').trim();
    const n = Number.parseFloat(normalized);
    if (!Number.isFinite(n)) {
      syncSizeInputs();
      return;
    }
    // Eingabe zeigt displayedLeading; auf Mac-Kurrent zurück auf Speicherwert mappen.
    const stored =
      state.displayMode === 'kurrent' && hostMode && !iosHost
        ? n + KURRENT_MAC_LEADING_CLICKS * LEADING_STEP
        : n;
    const next = clampLeading(stored);
    if (next === state.leading) {
      syncSizeInputs();
      return;
    }
    state.leading = next;
    void saveSettings({ leading: state.leading });
    applyChrome();
    if (hostMode) fitHostLayers();
  }

  function setFontSizeFromInput(raw: string): void {
    const n = Number.parseInt(raw.trim(), 10);
    if (!Number.isFinite(n)) {
      syncSizeInputs();
      return;
    }
    const next = snapFontSize(n);
    if (next === currentFontSize()) {
      syncSizeInputs();
      return;
    }
    state.fontSizes[state.displayMode] = next;
    void saveSettings({ fontSizes: { ...state.fontSizes } });
    applyChrome();
    if (hostMode) fitHostLayers();
  }

  function syncSizeInputs(): void {
    if (leadingValueInput) {
      leadingValueInput.value = displayedLeading().toFixed(1);
    }
    if (fontSizeValueInput) {
      fontSizeValueInput.value = String(currentFontSize());
    }
  }

  syncChoiceGroup(displayGroup, state.displayMode);
  syncChoiceGroup(themeGroup, state.theme);
  measureSelect.value = state.measure;
  setSwitch(textOnlyToggle, state.textOnly);
  if (drawerLiveCursorToggle) {
    setSwitch(drawerLiveCursorToggle, state.drawerLiveCursor);
  }
  if (drawerWordClickToggle) {
    setSwitch(drawerWordClickToggle, state.drawerWordClick);
  }

  function currentFontSize(): number {
    return state.fontSizes[state.displayMode];
  }

  function syncToolbarHeight(): void {
    const h = Math.ceil(toolbar!.getBoundingClientRect().height);
    if (h > 0) {
      app!.style.setProperty('--toolbar-measured-height', `${h}px`);
    }
  }

  function setWindowTitle(articleTitle?: string): void {
    const t = articleTitle?.trim();
    if (t && t !== 'Eingefügter Text') {
      document.title = `${t} · ${BRAND_NAME}`;
      return;
    }
    if (hostMode) {
      document.title = WINDOW_TITLE_CLAIM;
      return;
    }
    document.title = BRAND_NAME;
  }

  function applyEditModeChrome(): void {
    if (!hostMode) return;
    app!.classList.toggle('host-edit', editMode);
    app!.classList.toggle('host-read', !editMode);
    if (editModeBtn && iosHost) {
      editModeBtn.hidden = false;
      editModeBtn.textContent = editMode ? 'Fertig' : 'Bearbeiten';
      editModeBtn.setAttribute('aria-pressed', editMode ? 'true' : 'false');
    } else if (editModeBtn) {
      editModeBtn.hidden = true;
    }
    editorBody.contentEditable = iosHost && !editMode ? 'false' : 'true';
    if (iosHost && !editMode) {
      dismissKeyboard();
    }
  }

  function editorPlainText(): string {
    return (editorBody.innerText || editorBody.textContent || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\n$/, '');
  }

  function editorHtml(): string {
    const raw = editorBody.innerHTML;
    if (!raw.trim() || raw.trim() === '<br>') return '';
    // Kein .trim() am HTML — trailing Space/nbsp muss für Caret-Mapping bleiben.
    return sanitizeRichHtml(raw);
  }

  function setEditorHtml(html: string): void {
    editorBody.innerHTML = html || '';
  }

  function selectionPlainAndOffset(): {
    text: string;
    cursor: number;
  } {
    const text = editorPlainText();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorBody.contains(sel.anchorNode)) {
      return { text, cursor: text.length };
    }
    const range = sel.getRangeAt(0).cloneRange();
    range.selectNodeContents(editorBody);
    range.setEnd(sel.anchorNode!, sel.anchorOffset);
    const cursor = range.toString().replace(/\u00a0/g, ' ').length;
    return { text, cursor };
  }

  const BLOCK_TAGS = new Set([
    'DIV',
    'P',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'LI',
    'BLOCKQUOTE',
  ]);

  /** `<br>` als einziger Inhalt eines Blocks: der Block selbst ist der Umbruch. */
  function isPlaceholderBr(el: HTMLElement): boolean {
    const parent = el.parentElement;
    if (!parent || !BLOCK_TAGS.has(parent.tagName)) return false;
    if ((parent.textContent ?? '').replace(/\u00a0/g, ' ').trim()) return false;
    return parent.querySelectorAll('br').length === 1;
  }

  type CaretSpot =
    | { kind: 'text'; node: Text; offset: number }
    | { kind: 'after'; node: Node };

  /**
   * Plain-Offset plus Zeilenumbrüche. WebKit trennt Zeilen mit `<div>`,
   * die Sichtschicht mit `<br>`. Beides zählt als ein Umbruch, sonst bleibt
   * der Cursor nach Enter in der vorigen Zeile.
   */
  function markAt(
    root: HTMLElement,
    node: Node,
    offset: number,
  ): { plain: number; breaks: number } {
    let plain = 0;
    let breaks = 0;
    let seenBlock = false;
    let found = false;

    const walk = (n: Node): void => {
      if (found) return;
      if (n.nodeType === Node.TEXT_NODE) {
        const data = (n as Text).data.replace(/\u00a0/g, ' ');
        if (n === node) {
          plain += data.slice(0, offset).length;
          found = true;
          return;
        }
        plain += data.length;
        return;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const el = n as HTMLElement;
      if (el.tagName === 'BR') {
        if (!isPlaceholderBr(el)) breaks += 1;
        if (n === node) found = true;
        return;
      }
      if (BLOCK_TAGS.has(el.tagName)) {
        if (seenBlock) breaks += 1;
        seenBlock = true;
      }
      if (n === node) {
        const kids = el.childNodes;
        for (let i = 0; i < offset && i < kids.length; i++) walk(kids[i]!);
        found = true;
        return;
      }
      for (const child of Array.from(el.childNodes)) walk(child);
    };

    if (node === root) {
      const kids = root.childNodes;
      for (let i = 0; i < offset && i < kids.length; i++) walk(kids[i]!);
      return { plain, breaks };
    }
    for (const child of Array.from(root.childNodes)) walk(child);
    return { plain, breaks };
  }

  function pointForMark(
    root: HTMLElement,
    want: { plain: number; breaks: number },
  ): CaretSpot | null {
    let plain = 0;
    let breaks = 0;
    let seenBlock = false;
    let result: CaretSpot | null = null;
    let lastSpot: CaretSpot | null = null;

    const hit = (spot: CaretSpot): boolean => {
      lastSpot = spot;
      if (plain === want.plain && breaks === want.breaks) {
        result = spot;
        return true;
      }
      return false;
    };

    const walk = (n: Node): boolean => {
      if (n.nodeType === Node.TEXT_NODE) {
        const text = n as Text;
        const data = text.data.replace(/\u00a0/g, ' ');
        for (let i = 0; i <= data.length; i++) {
          if (hit({ kind: 'text', node: text, offset: i })) return true;
          if (i < data.length) plain += 1;
        }
        return false;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) return false;
      const el = n as HTMLElement;
      if (el.tagName === 'BR') {
        if (!isPlaceholderBr(el)) {
          breaks += 1;
          if (hit({ kind: 'after', node: el })) return true;
        } else if (hit({ kind: 'after', node: el })) {
          return true;
        }
        return false;
      }
      if (BLOCK_TAGS.has(el.tagName)) {
        if (seenBlock) breaks += 1;
        seenBlock = true;
        const onlyBr =
          el.childNodes.length === 1 && el.firstChild?.nodeName === 'BR';
        if (el.childNodes.length === 0) {
          return hit({ kind: 'after', node: el });
        }
        if (onlyBr && hit({ kind: 'after', node: el.firstChild! })) return true;
      }
      for (const child of Array.from(el.childNodes)) {
        if (walk(child)) return true;
      }
      return false;
    };

    for (const child of Array.from(root.childNodes)) {
      if (walk(child)) break;
    }
    // Nur klemmen, wenn Break-Anzahl passt — sonst landet Enter-Caret
    // fälschlich am Ende der vorigen Zeile (gleiches plain, breaks=0).
    if (!result && lastSpot && want.plain >= plain && want.breaks === breaks) {
      return lastSpot;
    }
    return result;
  }

  /** Wie pointForMark, aber nur nach Plain-Offset (Breaks ignorieren). */
  function pointForMarkByPlain(
    root: HTMLElement,
    wantPlain: number,
  ): CaretSpot | null {
    let plain = 0;
    let lastSpot: CaretSpot | null = null;
    let result: CaretSpot | null = null;

    const hit = (spot: CaretSpot): boolean => {
      lastSpot = spot;
      if (plain === wantPlain) {
        result = spot;
        return true;
      }
      return false;
    };

    const walk = (n: Node): boolean => {
      if (n.nodeType === Node.TEXT_NODE) {
        const text = n as Text;
        const data = text.data.replace(/\u00a0/g, ' ');
        for (let i = 0; i <= data.length; i++) {
          if (hit({ kind: 'text', node: text, offset: i })) return true;
          if (i < data.length) plain += 1;
        }
        return false;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) return false;
      const el = n as HTMLElement;
      if (el.tagName === 'BR') {
        return hit({ kind: 'after', node: el });
      }
      for (const child of Array.from(el.childNodes)) {
        if (walk(child)) return true;
      }
      return false;
    };

    for (const child of Array.from(root.childNodes)) {
      if (walk(child)) break;
    }
    if (!result && lastSpot && wantPlain >= plain) return lastSpot;
    return result;
  }

  function rectForPoint(point: CaretSpot): DOMRect | null {
    const range = document.createRange();
    if (point.kind === 'text') {
      const text = point.node;
      if (point.offset < text.data.length) {
        range.setStart(text, point.offset);
        range.setEnd(text, point.offset + 1);
        const box = range.getBoundingClientRect();
        if (box.height > 0) return new DOMRect(box.left, box.top, 0, box.height);
      }
      if (point.offset > 0) {
        range.setStart(text, point.offset - 1);
        range.setEnd(text, point.offset);
        const box = range.getBoundingClientRect();
        if (box.height > 0) return new DOMRect(box.right, box.top, 0, box.height);
      }
      range.setStart(text, point.offset);
      range.collapse(true);
    } else if (point.node.nodeName === 'BR') {
      // WebKit: ein zusammengeklappter Bereich hinter <br> bleibt auf der
      // vorigen Zeile. Die neue Zeile beginnt unter dem <br>-Kasten.
      const br = (point.node as HTMLElement).getBoundingClientRect();
      const parent = (point.node as HTMLElement).parentElement;
      const cs = parent ? getComputedStyle(parent) : null;
      const lh =
        Number.parseFloat(cs?.lineHeight ?? '') ||
        (br.height > 0 ? br.height : 24);
      const pad = Number.parseFloat(cs?.paddingLeft ?? '') || 0;
      const left = parent
        ? parent.getBoundingClientRect().left + pad
        : br.left;
      const prev = (point.node as HTMLElement).previousElementSibling;
      const prevTop = prev?.getBoundingClientRect().top;
      const sharesLine =
        prevTop != null && Number.isFinite(prevTop) && Math.abs(br.top - prevTop) < 4;
      const top = sharesLine || br.height <= 0 ? br.top + lh : br.top;
      return new DOMRect(left, top, 0, lh);
    } else {
      range.setStartAfter(point.node);
      range.collapse(true);
    }
    const rects = range.getClientRects();
    const box = rects.length > 0 ? rects[0]! : range.getBoundingClientRect();
    if (box.height > 0) return new DOMRect(box.left, box.top, 0, box.height);
    if (point.kind === 'after' && point.node instanceof Element) {
      const br = point.node.getBoundingClientRect();
      const lh = br.height > 0 ? br.height : 24;
      return new DOMRect(br.left, br.bottom > 0 ? br.bottom : br.top + lh, 0, lh);
    }
    return box.height > 0 ? box : null;
  }

  function lineHeightOf(el: Element): number {
    const cs = getComputedStyle(el);
    const lh = Number.parseFloat(cs.lineHeight);
    if (Number.isFinite(lh) && lh > 0) return lh;
    const fs = Number.parseFloat(cs.fontSize);
    return Number.isFinite(fs) && fs > 0 ? fs * 1.4 : 24;
  }

  /** Caret in leerem Block nach Enter (WebKit: Rect oft noch auf der Vorzeile). */
  function rectForEmptyBlockCaret(sel: Selection): DOMRect | null {
    const node = sel.anchorNode;
    if (!node || !editorBody.contains(node)) return null;

    let block: HTMLElement | null = null;
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (BLOCK_TAGS.has(el.tagName)) block = el;
    }
    if (
      !block &&
      node.nodeType === Node.ELEMENT_NODE &&
      (node as HTMLElement).tagName === 'BR'
    ) {
      block = (node as HTMLElement).parentElement;
    }
    if (!block && node.parentElement) {
      const p = node.parentElement;
      if (BLOCK_TAGS.has(p.tagName)) block = p;
    }
    if (!block || block === editorBody) return null;

    const onlyBr =
      block.childNodes.length === 1 && block.firstChild?.nodeName === 'BR';
    const empty =
      onlyBr ||
      (!(block.textContent ?? '').replace(/\u00a0/g, ' ').trim() &&
        block.querySelector('br'));
    // Auch: Caret am Anfang eines leeren Blocks (offset 0, nur Placeholder-BR)
    const atBlockStart =
      (node === block && sel.anchorOffset === 0) ||
      (node.parentElement === block &&
        node.nodeName === 'BR' &&
        sel.anchorOffset === 0) ||
      (node === block && onlyBr);
    if (!empty && !atBlockStart) {
      // Neuer leerer Block ohne Text: textContent leer
      if ((block.textContent ?? '').replace(/\u00a0/g, ' ').trim()) return null;
    }
    if ((block.textContent ?? '').replace(/\u00a0/g, ' ').trim() && !onlyBr) {
      return null;
    }

    const lh = lineHeightOf(block);
    const pad = Number.parseFloat(getComputedStyle(block).paddingLeft) || 0;
    const box = block.getBoundingClientRect();
    let top = box.top;
    const prev = block.previousElementSibling as HTMLElement | null;
    if (prev) {
      const pb = prev.getBoundingClientRect();
      // Kollabierter leerer Block teilt oft die Y-Position mit der Vorzeile
      if (box.height < lh * 0.55 || Math.abs(box.top - pb.top) < 4) {
        top = pb.bottom;
      }
    } else if (box.height < lh * 0.55) {
      top = box.top + lh;
    }
    return new DOMRect(box.left + pad, top, 0, lh);
  }

  /** Wenn Host weniger Zeilen hat als der Editor: Caret unter dem Host-Inhalt. */
  function rectBelowHostContent(extraBreaks: number): DOMRect | null {
    if (!contentHost || extraBreaks < 1) return null;
    const lh = lineHeightOf(contentHost);
    const pad = Number.parseFloat(getComputedStyle(contentHost).paddingLeft) || 0;
    const box = contentHost.getBoundingClientRect();
    // Letztes gerendertes Kind als Basis
    let baseBottom = box.top;
    const last = contentHost.lastElementChild ?? contentHost;
    const lastBox = last.getBoundingClientRect();
    if (lastBox.height > 0) baseBottom = lastBox.bottom;
    else baseBottom = box.bottom > box.top ? box.bottom : box.top + lh;
    return new DOMRect(
      box.left + pad,
      baseBottom + lh * (extraBreaks - 1),
      0,
      lh,
    );
  }

  function countBreaksIn(root: HTMLElement): number {
    let breaks = 0;
    let seenBlock = false;
    const walk = (n: Node): void => {
      if (n.nodeType === Node.ELEMENT_NODE) {
        const el = n as HTMLElement;
        if (el.tagName === 'BR') {
          if (!isPlaceholderBr(el)) breaks += 1;
          return;
        }
        if (BLOCK_TAGS.has(el.tagName)) {
          if (seenBlock) breaks += 1;
          seenBlock = true;
        }
        for (const child of Array.from(el.childNodes)) walk(child);
      }
    };
    for (const child of Array.from(root.childNodes)) walk(child);
    return breaks;
  }

  function visualRectForEditorCaret(): DOMRect | null {
    const sel = window.getSelection();
    if (!sel?.anchorNode || !editorBody.contains(sel.anchorNode)) return null;

    // Leere Zeile nach Enter: WebKit-Rects sind unzuverlässig
    const emptyRect = rectForEmptyBlockCaret(sel);
    if (emptyRect) return emptyRect;

    const mark = markAt(editorBody, sel.anchorNode, sel.anchorOffset);

    // 1) Host-Schicht — break-bewusst; Plain-Fallback nur ohne Breaks
    if (contentHost) {
      const point =
        pointForMark(contentHost, mark) ??
        (mark.breaks === 0
          ? pointForMarkByPlain(contentHost, mark.plain)
          : null);
      const mapped = point ? rectForPoint(point) : null;
      if (mapped && mapped.height > 0) return mapped;

      const hostBreaks = countBreaksIn(contentHost);
      if (mark.breaks > hostBreaks) {
        const below = rectBelowHostContent(mark.breaks - hostBreaks);
        if (below) return below;
      }
    }

    // 2) Direkte Editor-Geometrie (transparente Schicht)
    if (sel.anchorNode.nodeType === Node.TEXT_NODE) {
      const direct = rectForPoint({
        kind: 'text',
        node: sel.anchorNode as Text,
        offset: sel.anchorOffset,
      });
      if (direct && direct.height > 0) return direct;
    } else if (sel.anchorNode.nodeType === Node.ELEMENT_NODE) {
      const el = sel.anchorNode as HTMLElement;
      if (el.tagName === 'BR') {
        const brRect = rectForPoint({ kind: 'after', node: el });
        if (brRect && brRect.height > 0) return brRect;
      }
      if (sel.anchorOffset > 0 && el.childNodes[sel.anchorOffset - 1]) {
        const prev = el.childNodes[sel.anchorOffset - 1]!;
        const after = rectForPoint({ kind: 'after', node: prev });
        if (after && after.height > 0) return after;
      }
    }

    // 3) Collapsed Range — nicht für leere Zeilen (oben abgefangen)
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0).cloneRange();
      range.collapse(true);
      const box = range.getBoundingClientRect();
      if (box.height > 0) {
        return new DOMRect(box.left, box.top, 0, box.height);
      }
    }
    return null;
  }

  let lastHostCaretVisual: DOMRect | null = null;

  function caretRangeFromViewportPoint(x: number, y: number): Range | null {
    const doc = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (
        x: number,
        y: number,
      ) => { offsetNode: Node; offset: number } | null;
    };
    const range = doc.caretRangeFromPoint?.(x, y) ?? null;
    if (range) return range;
    const pos = doc.caretPositionFromPoint?.(x, y);
    if (!pos) return null;
    const created = document.createRange();
    created.setStart(pos.offsetNode, pos.offset);
    created.collapse(true);
    return created;
  }

  function withVisualHitTest<T>(fn: () => T): T {
    if (!contentHost) return fn();
    const prevEditor = editorBody.style.pointerEvents;
    const prevHost = contentHost.style.pointerEvents;
    editorBody.style.pointerEvents = 'none';
    contentHost.style.pointerEvents = 'auto';
    try {
      return fn();
    } finally {
      editorBody.style.pointerEvents = prevEditor;
      contentHost.style.pointerEvents = prevHost;
    }
  }

  function setEditorCaretToMark(mark: { plain: number; breaks: number }): void {
    const point =
      pointForMark(editorBody, mark) ??
      pointForMarkByPlain(editorBody, mark.plain);
    const range = document.createRange();
    if (point?.kind === 'text') range.setStart(point.node, point.offset);
    else if (point?.kind === 'after') range.setStartAfter(point.node);
    else {
      range.selectNodeContents(editorBody);
      range.collapse(mark.plain <= 0);
    }
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  function placeHostCaret(): void {
    if (!hostMode || !editMode || !contentHost) {
      hostCaret.hidden = true;
      return;
    }
    const focused = document.activeElement === editorBody;
    // iOS: programmatischer Fokus greift oft erst nach Tap — Caret trotzdem zeigen.
    if (!focused && !(iosHost && editMode)) {
      hostCaret.hidden = true;
      return;
    }
    const sel = window.getSelection();
    const hasSel =
      !!sel?.isCollapsed &&
      !!sel.anchorNode &&
      editorBody.contains(sel.anchorNode);
    if (!hasSel && !(iosHost && editMode)) {
      hostCaret.hidden = true;
      return;
    }
    const stack = editorBody.parentElement;
    if (!stack) return;
    const measured = hasSel ? visualRectForEditorCaret() : null;
    const visual =
      measured ??
      lastHostCaretVisual ??
      (() => {
        const box = contentHost.getBoundingClientRect();
        const styles = getComputedStyle(contentHost);
        const fontSize = Number.parseFloat(styles.fontSize) || 20;
        const leading = Number.parseFloat(styles.lineHeight) || fontSize * 1.4;
        return new DOMRect(box.left, box.top, 0, leading);
      })();
    if (measured) lastHostCaretVisual = measured;
    const origin = stack.getBoundingClientRect();
    hostCaret.hidden = false;
    hostCaret.style.left = `${visual.left - origin.left}px`;
    hostCaret.style.top = `${visual.top - origin.top}px`;
    hostCaret.style.height = `${Math.max(visual.height, 1)}px`;
  }

  /** Nach Enter/Render: Layout erst setzen lassen, dann Caret neu messen. */
  function schedulePlaceHostCaret(): void {
    placeHostCaret();
    requestAnimationFrame(() => {
      placeHostCaret();
      requestAnimationFrame(() => placeHostCaret());
    });
  }

  function focusHostEditor(): void {
    if (!editorPlainText() && editorBody.childNodes.length === 0) {
      editorBody.appendChild(document.createElement('br'));
    }
    const run = (): void => {
      editorBody.focus({ preventScroll: true });
      if (!editorPlainText()) {
        const range = document.createRange();
        range.setStart(editorBody, 0);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      placeHostCaret();
    };
    run();
    // iOS WKWebView: Fokus oft erst im nächsten Frame / nach Fonts.
    requestAnimationFrame(() => {
      run();
      void document.fonts?.ready.then(() => {
        run();
        placeHostCaret();
      });
    });
  }

  function moveCaretByVisualLine(direction: 1 | -1): boolean {
    if (!contentHost || !editorPlainText()) return false;
    const sel = window.getSelection();
    if (!sel?.anchorNode || !editorBody.contains(sel.anchorNode)) return false;
    const current = markAt(editorBody, sel.anchorNode, sel.anchorOffset);
    const rect = visualRectForEditorCaret();
    if (!rect) return false;
    const x = Math.max(rect.left + 1, contentHost.getBoundingClientRect().left + 1);
    const step = Math.max(4, rect.height * 0.65);
    const y = direction > 0 ? rect.bottom + step : rect.top - step;
    const hit = withVisualHitTest(() => caretRangeFromViewportPoint(x, y));
    if (!hit || !contentHost.contains(hit.startContainer)) return false;
    const next = markAt(contentHost, hit.startContainer, hit.startOffset);
    if (next.plain === current.plain && next.breaks === current.breaks) return false;
    setEditorCaretToMark(next);
    return true;
  }

  /** Kurrent auf dem Mac startet 16 Klicks enger; iOS bleibt beim gespeicherten Wert. */
  function displayedLeading(): LeadingValue {
    if (state.displayMode === 'kurrent' && hostMode && !iosHost) {
      return clampLeading(
        state.leading - KURRENT_MAC_LEADING_CLICKS * LEADING_STEP,
      );
    }
    return state.leading;
  }

  function fitHostLayers(): void {
    if (!hostMode || !contentHost) return;
    editorBody.style.height = 'auto';
    contentHost.style.minHeight = '0px';
    const h = Math.max(editorBody.scrollHeight, contentHost.scrollHeight, 200);
    editorBody.style.height = `${h}px`;
    contentHost.style.minHeight = `${h}px`;
    schedulePlaceHostCaret();
  }

  function applyChrome(): void {
    const openClass = drawerOpen ? ' drawer-open' : '';
    const hostClass = hostMode ? ' host-app' : '';
    const iosClass = iosHost ? ' ios-host' : '';
    const modeClass = hostMode
      ? editMode
        ? ' host-edit'
        : ' host-read'
      : '';
    app!.className = `app theme-${state.theme} mode-${state.displayMode} measure-${state.measure}${openClass}${hostClass}${iosClass}${modeClass}`;
    toolbar!.className = 'toolbar';
    document.documentElement.dataset.theme = state.theme;
    app!.style.setProperty('--reader-font-size', `${currentFontSize()}px`);
    const leading = displayedLeading();
    app!.style.setProperty('--reader-line-height', String(leading));
    app!.style.setProperty('--host-line-height', String(leading));
    syncSizeInputs();
    const bg = getComputedStyle(app!).getPropertyValue('--reader-bg').trim();
    if (bg) {
      document.documentElement.style.backgroundColor = bg;
      document.body.style.backgroundColor = bg;
      if (hostMode) {
        try {
          (
            window as unknown as {
              webkit?: {
                messageHandlers?: {
                  themeBg?: { postMessage: (v: string) => void };
                };
              };
            }
          ).webkit?.messageHandlers?.themeBg?.postMessage(bg);
        } catch {
          /* native Bridge optional */
        }
      }
    }
    applyEditModeChrome();
    syncToolbarHeight();
  }

  function updateMeta(): void {
    const art = state.article;
    const bits: string[] = [];
    if (art.byline) bits.push(art.byline);
    if (art.sourceUrl && art.sourceUrl !== 'about:blank') {
      const site = art.siteName || 'Quelle';
      bits.push(
        `<a class="source-link" href="${art.sourceUrl.replace(/"/g, '&quot;')}" target="_blank" rel="noopener">${site.replace(/</g, '&lt;')}</a>`,
      );
    } else if (hostMode) {
      // Host ohne externe Quelle: Meta leer lassen
    } else if (art.siteName) {
      bits.push(art.siteName.replace(/</g, '&lt;'));
    }
    metaEl.innerHTML = bits.join(' · ');
  }

  function canOpenDrawerFromWord(): boolean {
    if (!state.drawerWordClick) return false;
    if (!hostMode) return true;
    if (iosHost) return !editMode;
    return true;
  }

  function handleWordActivate(word: HTMLElement, e?: Event): void {
    if (!word.dataset.converted) return;
    if (!canOpenDrawerFromWord()) return;
    e?.preventDefault();
    openDrawerForWord(word, {
      preserveKeyboard: shouldPreserveKeyboard(),
    });
  }

  function closeDrawer(): void {
    drawerOpen = false;
    drawerEl.classList.remove('is-open');
    drawerEl.setAttribute('aria-hidden', 'true');
    applyChrome();
  }

  /** Desktop: Lernpanel standardmäßig sichtbar (auch ohne aktives Wort). */
  function isDesktopLearnPanel(): boolean {
    return (
      window.matchMedia('(min-width: 641px)').matches &&
      window.matchMedia('(hover: hover)').matches
    );
  }

  function showDrawerIdle(): void {
    drawerBody.innerHTML =
      `<p class="drawer-idle">` +
      `Tippe oder setze den Cursor auf ein Wort mit ſ oder s — hier erscheinen dann ` +
      `Lernhinweise zu Formen und Verwechslungsgefahren.` +
      `</p>`;
    lastReport = null;
    drawerOpen = true;
    drawerEl.classList.add('is-open');
    drawerEl.setAttribute('aria-hidden', 'false');
    applyChrome();
  }

  /** Schließen bzw. auf Desktop in den Ruhezustand zurück. */
  function parkOrCloseDrawer(): void {
    if (isDesktopLearnPanel()) showDrawerIdle();
    else closeDrawer();
  }

  function dismissKeyboard(): void {
    if (!hostMode) return;
    const active = document.activeElement as HTMLElement | null;
    if (active === editorBody) {
      active.blur();
    }
  }

  function shouldPreserveKeyboard(): boolean {
    return hostMode && editMode;
  }

  function dismissFloatingUi(): void {
    if (drawerOpen) closeDrawer();
    dismissKeyboard();
  }

  function openDrawerForWord(
    wordEl: HTMLElement,
    opts?: { preserveKeyboard?: boolean },
  ): void {
    const converted = wordEl.dataset.converted;
    if (!converted) return;
    const modern = wordEl.dataset.modern ?? toModernS(converted);
    const ambId = wordEl.dataset.id;
    const ambiguity = ambId
      ? lastAmbiguities.find((a) => a.id === ambId)
      : undefined;

    if (!opts?.preserveKeyboard) {
      dismissKeyboard();
      liveCursorPaused = true;
    }

    const { html, report } = renderDrawerBodyPrecise(
      { converted, modern, ambiguity },
      state.displayMode,
    );
    lastReport = {
      ...report,
      sourceUrl: state.article.sourceUrl,
    };
    drawerBody.innerHTML = html;
    const wasOpen = drawerOpen;
    drawerOpen = true;
    if (!wasOpen) {
      drawerEl.classList.remove('is-open');
      void drawerEl.offsetWidth;
    }
    drawerEl.classList.add('is-open');
    drawerEl.setAttribute('aria-hidden', 'false');
    applyChrome();
    drawerBody.scrollTop = 0;
  }

  /** Wort am Cursor (oder direkt davor, wenn Cursor auf Trenner steht). */
  function wordAtCursor(
    text: string,
    cursor: number,
  ): { modern: string; occurrence: number } | null {
    const isWord = (ch: string | undefined) =>
      !!ch && /[a-zA-ZäöüÄÖÜßſ]/u.test(ch);
    if (!text) return null;

    let pos = Math.max(0, Math.min(cursor, text.length));
    // Auf Trenner: Wort links vom Cursor bevorzugen
    if (pos > 0 && !isWord(text[pos]) && isWord(text[pos - 1])) {
      pos -= 1;
    }
    if (!isWord(text[pos])) {
      let i = pos;
      while (i > 0 && !isWord(text[i - 1])) i -= 1;
      if (i > 0 && isWord(text[i - 1])) pos = i - 1;
      else return null;
    }

    let start = pos;
    while (start > 0 && isWord(text[start - 1])) start -= 1;
    let end = pos;
    while (end < text.length && isWord(text[end])) end += 1;
    const modern = text.slice(start, end);
    if (!modern) return null;

    const needle = modern.toLocaleLowerCase('de');
    const before = text.slice(0, start);
    const occurrence = [
      ...before.matchAll(/[a-zA-ZäöüÄÖÜßſ]+/gu),
    ].filter((m) => m[0].toLocaleLowerCase('de') === needle).length;

    return { modern, occurrence };
  }

  function openDrawerForModernWord(
    modern: string,
    occurrence = 0,
  ): void {
    const root = analysisRoot();
    const needle = modern.toLocaleLowerCase('de');
    const words = (
      Array.from(root.querySelectorAll('.word[data-modern]')) as HTMLElement[]
    ).filter(
      (w) => (w.dataset.modern ?? '').toLocaleLowerCase('de') === needle,
    );
    const match =
      words[Math.min(occurrence, Math.max(0, words.length - 1))] ??
      words[words.length - 1];
    if (match) openDrawerForWord(match, { preserveKeyboard: true });
  }

  function articleHtml(): string {
    return state.textOnly
      ? stripToTextOnly(state.article.contentHtml)
      : state.article.contentHtml;
  }

  /** In der Host-App in #content-host rendern, sonst #content. */
  function analysisRoot(): HTMLElement {
    return hostMode && contentHost ? contentHost : contentEl;
  }

  function render(reopen?: {
    ambId?: string;
    converted?: string;
    modern?: string;
  }): void {
    applyChrome();
    const art = state.article;
    setWindowTitle(art.title);
    updateMeta();

    const root = analysisRoot();
    const overrideMap = new Map(Object.entries(state.overrides));
    const titleResult = convertPlainTitle(art.title, overrideMap);
    /**
     * Host Bearbeiten + Lesen: ſ-Regeln sichtbar (matchSourceVisual aus).
     * Caret-Risiko in Fraktur/Kurrent bewusst akzeptiert — siehe Rule host-edit-s-rules.
     */
    const hostVisual = {};
    titleEl.innerHTML = resultToHtml(
      titleResult,
      state.displayMode,
      hostVisual,
    );

    const { html, ambiguities } = convertHtmlFragment(
      articleHtml(),
      overrideMap,
      state.displayMode,
      hostVisual,
    );
    root.innerHTML = html;
    if (hostMode && contentHost) contentEl.innerHTML = '';
    lastAmbiguities = [...titleResult.ambiguities, ...ambiguities];

    if (lastAmbiguities.length > 0) hintEl.classList.remove('hidden');
    else hintEl.classList.add('hidden');

    if (reopen) {
      let el: Element | null = null;
      if (reopen.ambId) {
        el =
          root.querySelector(
            `.word[data-id="${CSS.escape(reopen.ambId)}"]`,
          ) ??
          titleEl.querySelector(`.word[data-id="${CSS.escape(reopen.ambId)}"]`);
      }
      if (!el && reopen.converted) {
        const target = reopen.converted;
        const candidates = [
          ...Array.from(root.querySelectorAll('.word[data-converted]')),
          ...Array.from(titleEl.querySelectorAll('.word[data-converted]')),
        ];
        el =
          candidates.find(
            (n) => (n as HTMLElement).dataset.converted === target,
          ) ?? null;
      }
      if (!el && reopen.modern) {
        const needle = reopen.modern.toLocaleLowerCase('de');
        const candidates = Array.from(
          root.querySelectorAll('.word[data-modern]'),
        ) as HTMLElement[];
        el =
          [...candidates]
            .reverse()
            .find(
              (n) =>
                (n.dataset.modern ?? '').toLocaleLowerCase('de') === needle,
            ) ?? null;
      }
      if (el instanceof HTMLElement) {
        openDrawerForWord(el, {
          preserveKeyboard: shouldPreserveKeyboard(),
        });
        return;
      }
    }
    // Host-Live: Drawer nicht bei jedem Tastenanschlag schließen
    if (drawerOpen && !hostMode) parkOrCloseDrawer();
  }

  function renderHostLive(cursorWord?: {
    modern: string;
    occurrence: number;
  } | null): void {
    const html = editorHtml();
    const text = editorPlainText();
    if (contentHost) {
      contentHost.dataset.placeholder = 'Text einfügen oder schreiben…';
    }
    if (!text.trim() && !html) {
      state.article = plainTextToArticle('', '');
      state.overrides = {};
      if (contentHost) contentHost.innerHTML = '';
      contentEl.innerHTML = '';
      lastAmbiguities = [];
      hintEl.classList.add('hidden');
      if (hostIntro) hostIntro.hidden = true;
      updateMeta();
      applyChrome();
      setWindowTitle();
      parkOrCloseDrawer();
      schedulePlaceHostCaret();
      return;
    }
    if (hostIntro) hostIntro.hidden = true;
    state.article = html
      ? richHtmlToArticle(html, '')
      : plainTextToArticle(text, '');
    if (state.article.id.startsWith('paste-') && article?.id) {
      state.article.id = article.id;
    }
    state.overrides = {};
    void persistArticle(state.article);
    const focus =
      cursorWord ??
      (state.drawerLiveCursor
        ? (() => {
            const { text: t, cursor } = selectionPlainAndOffset();
            return wordAtCursor(t, cursor);
          })()
        : null);
    render(focus ? { modern: focus.modern } : undefined);
    if (focus && state.drawerLiveCursor) {
      openDrawerForModernWord(focus.modern, focus.occurrence);
    }
    schedulePlaceHostCaret();
  }

  function goBackOrClose(): void {
    if (hostMode) return;
    window.close();
  }

  document.getElementById('btn-close')!.addEventListener('click', () => {
    goBackOrClose();
  });

  document.getElementById('drawer-close')!.addEventListener('click', () => {
    closeDrawer();
  });

  wireChoiceGroup(displayGroup, (value) => {
    state.displayMode = value as DisplayMode;
    syncChoiceGroup(displayGroup, state.displayMode);
    try {
      sessionStorage.setItem(SESSION_MODE_KEY, state.displayMode);
    } catch {
      /* private mode */
    }
    void saveSettings({ displayMode: state.displayMode });
    if (hostMode) renderHostLive();
    else render();
    applyChrome();
    if (hostMode) fitHostLayers();
  });

  measureSelect.addEventListener('change', () => {
    state.measure = measureSelect.value as MeasureMode;
    void saveSettings({ measure: state.measure });
    applyChrome();
  });

  leadingMinus.addEventListener('click', () => stepLeading(-1));
  leadingPlus.addEventListener('click', () => stepLeading(1));
  leadingValueInput?.addEventListener('change', () => {
    setLeadingFromInput(leadingValueInput.value);
  });
  leadingValueInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setLeadingFromInput(leadingValueInput.value);
      leadingValueInput.blur();
    }
  });

  wireChoiceGroup(themeGroup, (value) => {
    state.theme = value as ThemeMode;
    syncChoiceGroup(themeGroup, state.theme);
    void saveSettings({ theme: state.theme });
    applyChrome();
  });

  textOnlyToggle.addEventListener('click', () => {
    state.textOnly = !state.textOnly;
    setSwitch(textOnlyToggle, state.textOnly);
    void saveSettings({ textOnly: state.textOnly });
    if (hostMode) renderHostLive();
    else render();
  });

  drawerLiveCursorToggle?.addEventListener('click', () => {
    state.drawerLiveCursor = !state.drawerLiveCursor;
    setSwitch(drawerLiveCursorToggle, state.drawerLiveCursor);
    drawerLiveCursorToggle.title = state.drawerLiveCursor
      ? 'Drawer folgt dem Textcursor. Ausschalten: nur per Mausklick aufs Wort.'
      : 'Nur per Mausklick aufs Wort. Einschalten: Drawer folgt dem Textcursor.';
    void saveSettings({ drawerLiveCursor: state.drawerLiveCursor });
    if (hostMode && state.drawerLiveCursor) {
      const { text, cursor } = selectionPlainAndOffset();
      const focus = wordAtCursor(text, cursor);
      if (focus) openDrawerForModernWord(focus.modern, focus.occurrence);
    }
  });

  drawerWordClickToggle?.addEventListener('click', () => {
    state.drawerWordClick = !state.drawerWordClick;
    setSwitch(drawerWordClickToggle, state.drawerWordClick);
    void saveSettings({ drawerWordClick: state.drawerWordClick });
    if (!state.drawerWordClick && drawerOpen) parkOrCloseDrawer();
  });

  document.getElementById('font-minus')!.addEventListener('click', () => {
    const next = snapFontSize(currentFontSize() - FONT_SIZE_STEP);
    state.fontSizes[state.displayMode] = next;
    void saveSettings({ fontSizes: { ...state.fontSizes } });
    applyChrome();
    if (hostMode) fitHostLayers();
  });

  document.getElementById('font-plus')!.addEventListener('click', () => {
    const next = snapFontSize(currentFontSize() + FONT_SIZE_STEP);
    state.fontSizes[state.displayMode] = next;
    void saveSettings({ fontSizes: { ...state.fontSizes } });
    applyChrome();
    if (hostMode) fitHostLayers();
  });

  fontSizeValueInput?.addEventListener('change', () => {
    setFontSizeFromInput(fontSizeValueInput.value);
  });
  fontSizeValueInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setFontSizeFromInput(fontSizeValueInput.value);
      fontSizeValueInput.blur();
    }
  });

  if (hostMode) {
    if (article) {
      let html = '';
      if (article.contentHtml?.includes('<')) {
        html = sanitizeRichHtml(article.contentHtml);
      } else {
        html = plainToSimpleHtml(article.textContent || '');
      }
      const legacyTitle =
        article.title && article.title !== 'Eingefügter Text'
          ? article.title.trim()
          : '';
      if (legacyTitle && !/<h1[\s>]/i.test(html)) {
        const esc = legacyTitle
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        html = `<h1>${esc}</h1>${html}`;
      }
      setEditorHtml(html);
    }

    let lastDrawerKey = '';

    const fitHostHeight = () => {
      if (!contentHost) return;
      const h = Math.max(
        contentHost.scrollHeight,
        editorBody.scrollHeight,
        200,
      );
      editorBody.style.height = `${h}px`;
      contentHost.style.minHeight = `${h}px`;
    };

    const syncDrawerToCursor = () => {
      if (iosHost) return;
      if (!state.drawerLiveCursor || liveCursorPaused) return;
      const { text, cursor } = selectionPlainAndOffset();
      const focus = wordAtCursor(text, cursor);
      const key = focus ? `${focus.modern}#${focus.occurrence}` : '';
      if (key === lastDrawerKey) return;
      lastDrawerKey = key;
      if (focus) openDrawerForModernWord(focus.modern, focus.occurrence);
      else if (drawerOpen) parkOrCloseDrawer();
    };

    const reanalyzeAndTeach = () => {
      const { text, cursor } = selectionPlainAndOffset();
      const focus = state.drawerLiveCursor
        ? wordAtCursor(text, cursor)
        : null;
      lastDrawerKey = focus ? `${focus.modern}#${focus.occurrence}` : '';
      renderHostLive(focus);
      fitHostHeight();
      schedulePlaceHostCaret();
    };

    /** Nächster Block-Container um den Cursor (p/div/h*). */
    const closestEditorBlock = (node: Node): HTMLElement | null => {
      let n: Node | null = node;
      while (n && n !== editorBody) {
        if (n.nodeType === Node.ELEMENT_NODE) {
          const el = n as HTMLElement;
          if (/^(P|DIV|H[1-6]|LI|BLOCKQUOTE)$/i.test(el.tagName)) {
            return el;
          }
        }
        n = n.parentNode;
      }
      return null;
    };

    /**
     * Markdown-Kurzbefehl: Zeilenanfang `# `/`## `/`### ` → h1–h3
     * bei Space (nur Marker) oder Enter (Marker + Rest).
     */
    const tryMarkdownHeadingShortcut = (e: KeyboardEvent): boolean => {
      if (e.key !== ' ' && e.key !== 'Enter') return false;
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
        return false;
      }
      const sel = window.getSelection();
      if (!sel?.isCollapsed || sel.rangeCount === 0) return false;
      if (!editorBody.contains(sel.anchorNode)) return false;

      const block = closestEditorBlock(sel.anchorNode!);
      if (!block || block === editorBody) return false;
      if (/^H[1-3]$/i.test(block.tagName)) return false;

      const preRange = document.createRange();
      preRange.selectNodeContents(block);
      preRange.setEnd(sel.anchorNode!, sel.anchorOffset);
      const before = preRange.toString().replace(/\u00a0/g, ' ');

      let level = 0;
      let headingText = '';
      if (e.key === ' ') {
        const m = before.match(/^(#{1,3})$/);
        if (!m) return false;
        level = m[1].length;
        const postRange = document.createRange();
        postRange.selectNodeContents(block);
        postRange.setStart(sel.anchorNode!, sel.anchorOffset);
        headingText = postRange.toString();
      } else {
        const m = before.match(/^(#{1,3}) (.*)$/);
        if (!m) return false;
        level = m[1].length;
        const postRange = document.createRange();
        postRange.selectNodeContents(block);
        postRange.setStart(sel.anchorNode!, sel.anchorOffset);
        headingText = m[2] + postRange.toString();
      }

      e.preventDefault();
      const heading = document.createElement(`h${level}`);
      heading.textContent = headingText;
      block.replaceWith(heading);

      if (e.key === 'Enter') {
        const p = document.createElement('p');
        p.appendChild(document.createElement('br'));
        heading.after(p);
        const r = document.createRange();
        r.setStart(p, 0);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      } else {
        const r = document.createRange();
        r.selectNodeContents(heading);
        r.collapse(headingText.length === 0);
        sel.removeAllRanges();
        sel.addRange(r);
      }

      liveCursorPaused = false;
      reanalyzeAndTeach();
      return true;
    };

    /** Fallback für Select-All; Cut/Copy/Paste über natives Edit-Menü. */
    editorBody.addEventListener('keydown', (e) => {
      if (
        (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
        !e.shiftKey &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.isComposing &&
        window.getSelection()?.isCollapsed
      ) {
        if (moveCaretByVisualLine(e.key === 'ArrowDown' ? 1 : -1)) {
          e.preventDefault();
          return;
        }
      }
      if (tryMarkdownHeadingShortcut(e)) return;
      if ((e.metaKey || e.ctrlKey) && !e.altKey) {
        const zoomIn = e.key === '+' || e.key === '=' || e.code === 'NumpadAdd';
        const zoomOut = e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract';
        if (zoomIn || zoomOut) {
          const sel = window.getSelection();
          if (
            sel &&
            !sel.isCollapsed &&
            editorBody.contains(sel.anchorNode)
          ) {
            e.preventDefault();
            const next = snapFontSize(
              currentFontSize() + (zoomIn ? FONT_SIZE_STEP : -FONT_SIZE_STEP),
            );
            state.fontSizes[state.displayMode] = next;
            void saveSettings({ fontSizes: { ...state.fontSizes } });
            applyChrome();
            if (hostMode) fitHostLayers();
          }
        }
      }
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (e.key.toLowerCase() !== 'a') return;
      e.preventDefault();
      editorBody.focus();
      const range = document.createRange();
      range.selectNodeContents(editorBody);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
    editorBody.addEventListener('input', () => {
      liveCursorPaused = false;
      reanalyzeAndTeach();
    });
    editorBody.addEventListener('paste', (e) => {
      const html = clipboardHtmlFromPaste(e);
      if (!html) return;
      e.preventDefault();
      const clean = sanitizeRichHtml(html);
      if (!clean) return;
      // Einfügen an Cursor
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorBody.contains(sel.anchorNode)) {
        sel.deleteFromDocument();
        const temp = document.createElement('div');
        temp.innerHTML = clean;
        const frag = document.createDocumentFragment();
        while (temp.firstChild) frag.appendChild(temp.firstChild);
        sel.getRangeAt(0).insertNode(frag);
        sel.collapseToEnd();
      } else {
        setEditorHtml(
          editorHtml() ? `${editorHtml()}${clean}` : clean,
        );
      }
      liveCursorPaused = false;
      reanalyzeAndTeach();
    });
    editorBody.addEventListener('copy', (e) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !editorBody.contains(sel.anchorNode)) {
        return;
      }
      e.preventDefault();
      const range = sel.getRangeAt(0);
      const container = document.createElement('div');
      container.appendChild(range.cloneContents());
      const rawHtml = sanitizeRichHtml(container.innerHTML);
      const { html: converted } = convertHtmlFragment(
        rawHtml || plainToSimpleHtml(sel.toString()),
        new Map(Object.entries(state.overrides)),
        state.displayMode,
      );
      e.clipboardData?.setData('text/html', converted);
      e.clipboardData?.setData('text/plain', toModernS(sel.toString()));
    });
    editorBody.addEventListener('keyup', () => {
      liveCursorPaused = false;
      syncDrawerToCursor();
    });
    editorBody.addEventListener('pointerup', (e) => {
      if (!hostMode || !editMode || !contentHost || e.button !== 0) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const hit = withVisualHitTest(() =>
        caretRangeFromViewportPoint(e.clientX, e.clientY),
      );
      if (!hit || !contentHost.contains(hit.startContainer)) return;
      setEditorCaretToMark(
        markAt(contentHost, hit.startContainer, hit.startOffset),
      );
    });
    editorBody.addEventListener('click', () => {
      if (iosHost && editMode) return;
      if (!canOpenDrawerFromWord()) return;
      liveCursorPaused = false;
      const { text, cursor } = selectionPlainAndOffset();
      const focus = wordAtCursor(text, cursor);
      if (!focus) {
        if (drawerOpen) parkOrCloseDrawer();
        lastDrawerKey = '';
        return;
      }
      const root = analysisRoot();
      const needle = focus.modern.toLocaleLowerCase('de');
      const words = (
        Array.from(root.querySelectorAll('.word[data-modern]')) as HTMLElement[]
      ).filter(
        (w) => (w.dataset.modern ?? '').toLocaleLowerCase('de') === needle,
      );
      const match =
        words[Math.min(focus.occurrence, Math.max(0, words.length - 1))] ??
        words[words.length - 1];
      if (match) {
        handleWordActivate(match);
        lastDrawerKey = `${focus.modern}#${focus.occurrence}`;
        return;
      }
      if (drawerOpen) parkOrCloseDrawer();
      lastDrawerKey = '';
    });
    document.addEventListener('selectionchange', () => {
      placeHostCaret();
      if (iosHost && editMode) return;
      if (document.activeElement === editorBody) syncDrawerToCursor();
    });
    editorBody.addEventListener('focus', () => placeHostCaret());
    editorBody.addEventListener('blur', () => {
      // iOS: Fokus geht leicht verloren — Caret im Bearbeiten-Modus weiter blinken lassen.
      if (iosHost && editMode) {
        placeHostCaret();
        return;
      }
      hostCaret.hidden = true;
    });
    document.addEventListener('scroll', () => placeHostCaret(), true);
    window.addEventListener('resize', () => placeHostCaret());

    if (editModeBtn && iosHost) {
      editModeBtn.addEventListener('click', () => {
        editMode = !editMode;
        if (editMode) {
          if (drawerOpen) closeDrawer();
          applyChrome();
          focusHostEditor();
        } else {
          dismissKeyboard();
          applyChrome();
          // Lesemodus: Overlay mit Konvertierung aktualisieren
          renderHostLive();
        }
      });
    }
  }

  {
    const settingsPanel = toolbar!.querySelector(
      '.toolbar-settings',
    ) as HTMLDetailsElement | null;
    if (settingsPanel) {
      settingsPanel.open = false;
      const summary = settingsPanel.querySelector('summary');
      const controls = settingsPanel.querySelector('.toolbar-controls');
      let settingsClosing = false;
      let settingsCloseTimer = 0;

      const openSettingsPanel = (): void => {
        window.clearTimeout(settingsCloseTimer);
        settingsClosing = false;
        settingsPanel.open = true;
        settingsPanel.classList.remove('is-shown');
        void settingsPanel.offsetWidth;
        settingsPanel.classList.add('is-shown');
      };

      const closeSettingsPanel = (): void => {
        if (settingsClosing) return;
        if (!settingsPanel.classList.contains('is-shown')) {
          settingsPanel.open = false;
          return;
        }
        settingsClosing = true;
        settingsPanel.classList.remove('is-shown');
        const finish = (): void => {
          if (!settingsClosing) return;
          settingsClosing = false;
          window.clearTimeout(settingsCloseTimer);
          if (settingsPanel.classList.contains('is-shown')) return;
          settingsPanel.open = false;
        };
        const onEnd = (ev: Event): void => {
          const te = ev as TransitionEvent;
          if (te.target !== controls || te.propertyName !== 'opacity') return;
          controls?.removeEventListener('transitionend', onEnd);
          finish();
        };
        controls?.addEventListener('transitionend', onEnd);
        settingsCloseTimer = window.setTimeout(() => {
          controls?.removeEventListener('transitionend', onEnd);
          finish();
        }, 400);
      };

      summary?.addEventListener('click', (e) => {
        e.preventDefault();
        if (settingsPanel.classList.contains('is-shown')) closeSettingsPanel();
        else openSettingsPanel();
      });
      document.addEventListener('click', (e) => {
        if (!settingsPanel.open && !settingsPanel.classList.contains('is-shown')) {
          return;
        }
        const t = e.target as Node;
        if (settingsPanel.contains(t)) return;
        closeSettingsPanel();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && settingsPanel.classList.contains('is-shown')) {
          closeSettingsPanel();
        }
      });
    }
  }

  for (const root of [contentEl, contentHost, titleEl].filter(
    Boolean,
  ) as HTMLElement[]) {
    root.addEventListener('click', (e) => {
      if (iosHost && editMode) return;
      const word = (e.target as HTMLElement).closest(
        '.word',
      ) as HTMLElement | null;
      if (!word?.dataset.converted) return;
      handleWordActivate(word, e);
    });

    root.addEventListener('keydown', (e) => {
      if (iosHost && editMode) return;
      const word = (e.target as HTMLElement).closest(
        '.word',
      ) as HTMLElement | null;
      if (!word?.dataset.converted) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleWordActivate(word, e);
      }
    });
  }

  drawerBody.addEventListener('click', (e) => {
    const reportBtn = (e.target as HTMLElement).closest(
      '[data-report="mail"]',
    ) as HTMLElement | null;
    if (reportBtn) {
      e.preventDefault();
      if (!lastReport) return;
      const full = formatReportBody(lastReport);
      void navigator.clipboard.writeText(full).then(
        () => showToast('Bericht in die Zwischenablage — Mail öffnen…'),
        () => showToast('Mail öffnen…'),
      );
      window.location.href = buildReportMailtoUrl(lastReport);
      return;
    }

    const ambOpt = (e.target as HTMLElement).closest(
      '.drawer-amb-option',
    ) as HTMLElement | null;
    if (ambOpt?.dataset.ambId != null && ambOpt.dataset.ambIndex != null) {
      e.preventDefault();
      const ambId = ambOpt.dataset.ambId;
      const index = Number(ambOpt.dataset.ambIndex);
      state.overrides[ambId] = index;
      const chosen =
        lastAmbiguities.find((a) => a.id === ambId)?.candidates[index]?.text ??
        '';
      render({ ambId, converted: chosen || undefined });
      if (chosen) showToast(`Ersetzt durch: ${chosen}`);
      return;
    }

    const letter = (e.target as HTMLElement).closest(
      '.drawer-letter',
    ) as HTMLElement | null;
    if (letter?.dataset.letterKey == null) return;
    const key = letter.dataset.letterKey;
    const card = drawerBody.querySelector(
      `#pitfall-letter-${CSS.escape(key)}`,
    );
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    card?.classList.add('pitfall-flash');
    setTimeout(() => card?.classList.remove('pitfall-flash'), 900);
  });

  function clearDrawerLinks(): void {
    for (const el of Array.from(drawerBody.querySelectorAll('.is-linked'))) {
      el.classList.remove('is-linked');
    }
  }

  function linkLetterElement(letterEl: HTMLElement): void {
    clearDrawerLinks();
    letterEl.classList.add('is-linked');
    const key = letterEl.dataset.letterKey;
    if (!key) return;
    drawerBody
      .querySelector(`#pitfall-letter-${CSS.escape(key)}`)
      ?.classList.add('is-linked');
  }

  function linkCardElement(cardEl: HTMLElement): void {
    clearDrawerLinks();
    cardEl.classList.add('is-linked');
    const key = cardEl.dataset.letterKey;
    if (!key) return;
    for (const letter of Array.from(
      drawerBody.querySelectorAll(
        `.drawer-letter[data-letter-key="${CSS.escape(key)}"]`,
      ),
    )) {
      letter.classList.add('is-linked');
    }
  }

  drawerBody.addEventListener('mouseover', (e) => {
    const letter = (e.target as HTMLElement).closest(
      '.drawer-letter',
    ) as HTMLElement | null;
    if (letter) {
      linkLetterElement(letter);
      return;
    }

    const card = (e.target as HTMLElement).closest(
      '.pitfall-card',
    ) as HTMLElement | null;
    if (card) linkCardElement(card);
  });

  drawerBody.addEventListener('mouseout', (e) => {
    const related = e.relatedTarget as Node | null;
    if (related && drawerBody.contains(related)) {
      const stillLetter = (related as HTMLElement).closest?.('.drawer-letter');
      const stillCard = (related as HTMLElement).closest?.('.pitfall-card');
      if (stillLetter || stillCard) return;
    }
    clearDrawerLinks();
  });

  const toolbarResize = new ResizeObserver(() => syncToolbarHeight());
  toolbarResize.observe(toolbar!);
  window.addEventListener('resize', () => {
    syncToolbarHeight();
  });

  const settingsDetails = toolbar!.querySelector('.toolbar-settings');
  settingsDetails?.addEventListener('toggle', () => syncToolbarHeight());

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (drawerOpen) {
      e.preventDefault();
      parkOrCloseDrawer();
      return;
    }
    if (!hostMode) {
      e.preventDefault();
      window.close();
    }
  });

  // Scroll/Wischen: Desktop schließt Drawer nicht; Mobile ≥ ~40px Drawer + Tastatur zu
  {
    const isDesktopPointer = () =>
      window.matchMedia('(min-width: 641px)').matches &&
      window.matchMedia('(hover: hover)').matches;

    const dismissIfNeeded = () => {
      if (isDesktopPointer()) return;
      if (drawerOpen || document.activeElement === editorBody) {
        dismissFloatingUi();
      }
    };

    let scrollAccum = 0;
    let lastY = window.scrollY;
    let lastScrollDir = 0;
    window.addEventListener(
      'scroll',
      () => {
        const y = window.scrollY;
        const dy = y - lastY;
        lastY = y;
        scrollAccum += Math.abs(dy);
        if (scrollAccum >= 40) {
          scrollAccum = 0;
          dismissIfNeeded();
        }
        // Mobil: Toolbar bei Hochscrollen ein, bei Runterscrollen aus
        if (!window.matchMedia('(max-width: 640px)').matches) return;
        if (Math.abs(dy) < 10) return;
        const dir = dy > 0 ? 1 : -1;
        if (dir === lastScrollDir) {
          app!.classList.toggle('toolbar-collapsed', dir > 0 && y > 24);
        }
        lastScrollDir = dir;
      },
      { passive: true },
    );

    let touchAccum = 0;
    let lastTouchY = 0;
    const readerEl = document.querySelector('.reader') as HTMLElement | null;
    const onTouchStart = (e: Event) => {
      const te = e as TouchEvent;
      if ((te.target as HTMLElement).closest?.('.learn-drawer')) return;
      lastTouchY = te.touches[0]?.clientY ?? 0;
      touchAccum = 0;
    };
    const onTouchMove = (e: Event) => {
      const te = e as TouchEvent;
      if ((te.target as HTMLElement).closest?.('.learn-drawer')) return;
      const y = te.touches[0]?.clientY ?? lastTouchY;
      const dy = lastTouchY - y;
      touchAccum += Math.abs(y - lastTouchY);
      lastTouchY = y;
      if (touchAccum < 40) return;
      touchAccum = 0;
      dismissIfNeeded();
      if (window.matchMedia('(max-width: 640px)').matches && Math.abs(dy) >= 10) {
        app!.classList.toggle('toolbar-collapsed', dy > 0);
      }
    };
    readerEl?.addEventListener('touchstart', onTouchStart, { passive: true });
    readerEl?.addEventListener('touchmove', onTouchMove, { passive: true });
  }

  // Mobile bottom-sheet: Höhe ziehen & je Gerätetyp merken
  {
    const handle = document.getElementById('drawer-resize-handle');
    const DEFAULT_VH = 55;
    const MIN_VH = 30;
    const MAX_VH = 90;
    const deviceKey = () =>
      window.matchMedia('(min-width: 600px) and (pointer: coarse)').matches ||
      (window.matchMedia('(min-width: 768px)').matches &&
        window.matchMedia('(max-width: 1024px)').matches)
        ? 'tablet'
        : 'phone';
    const storageKey = () => `langs-drawer-vh:${deviceKey()}`;

    const applySheetVh = (vh: number) => {
      const clamped = Math.max(MIN_VH, Math.min(MAX_VH, vh));
      app!.style.setProperty('--drawer-sheet-vh', `${clamped}vh`);
      return clamped;
    };

    void chrome.storage.local.get(storageKey()).then((data) => {
      const raw = data[storageKey()];
      applySheetVh(typeof raw === 'number' ? raw : DEFAULT_VH);
    });

    if (handle) {
      let dragging = false;
      let activePointer: number | null = null;
      const onMove = (clientY: number) => {
        const vh = ((window.innerHeight - clientY) / window.innerHeight) * 100;
        applySheetVh(vh);
      };
      const endDrag = (pointerId?: number) => {
        if (!dragging) return;
        dragging = false;
        drawerEl.classList.remove('is-resizing');
        if (pointerId != null) {
          try {
            handle.releasePointerCapture(pointerId);
          } catch {
            /* ignore */
          }
        }
        activePointer = null;
        const current = parseFloat(
          getComputedStyle(app!).getPropertyValue('--drawer-sheet-vh'),
        );
        const vh = Number.isFinite(current) ? current : DEFAULT_VH;
        void chrome.storage.local.set({ [storageKey()]: vh });
      };

      handle.addEventListener('pointerdown', (e) => {
        if (!window.matchMedia('(max-width: 900px)').matches) return;
        dragging = true;
        activePointer = e.pointerId;
        drawerEl.classList.add('is-resizing');
        try {
          handle.setPointerCapture(e.pointerId);
        } catch {
          /* iOS: capture manchmal nicht nötig */
        }
        e.preventDefault();
        e.stopPropagation();
      });
      handle.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        if (activePointer != null && e.pointerId !== activePointer) return;
        onMove(e.clientY);
      });
      handle.addEventListener('pointerup', (e) => endDrag(e.pointerId));
      handle.addEventListener('pointercancel', (e) => endDrag(e.pointerId));
      window.addEventListener(
        'pointermove',
        (e) => {
          if (!dragging) return;
          if (activePointer != null && e.pointerId !== activePointer) return;
          onMove(e.clientY);
        },
        { passive: true },
      );
      window.addEventListener('pointerup', (e) => endDrag(e.pointerId));
      handle.addEventListener('dblclick', () => {
        const vh = applySheetVh(DEFAULT_VH);
        void chrome.storage.local.set({ [storageKey()]: vh });
      });
    }
  }

  if (hostMode) {
    applyChrome();
    renderHostLive();
    if (editMode) {
      focusHostEditor();
    }
  } else {
    render();
  }

  if (isDesktopLearnPanel() && !drawerOpen) {
    showDrawerIdle();
  }

  // Extension + Host: Auswahl als HTML (konvertiert) + Plaintext in die Zwischenablage
  document.addEventListener('copy', (e) => {
    if (hostMode && editMode && editorBody.contains(window.getSelection()?.anchorNode ?? null)) {
      return; // Host-Editor hat eigenen Handler
    }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const anchor = sel.anchorNode;
    const root = analysisRoot();
    if (!anchor || (!root.contains(anchor) && !titleEl.contains(anchor) && !contentEl.contains(anchor))) {
      return;
    }
    e.preventDefault();
    const range = sel.getRangeAt(0);
    const container = document.createElement('div');
    container.appendChild(range.cloneContents());
    // Visuell bereits konvertiert → HTML der Auswahl + modernes Plain
    let html = container.innerHTML;
    if (!html.trim()) {
      html = plainToSimpleHtml(sel.toString());
    }
    e.clipboardData?.setData('text/html', html);
    e.clipboardData?.setData(
      'text/plain',
      toModernS(sel.toString()),
    );
  });
}

void init();

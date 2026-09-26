import './reader.css';

import type { AmbiguitySpan } from '@langs/core';
import {
  ARTICLE_KEY_PREFIX,
  clampLeading,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_SIZE_STEP,
  isDisplayMode,
  KURRENT_FONT_SIZE_MOBILE,
  LEADING_STEP,
  MODE_DEFAULT_FONT_SIZE,
  type ArticlePayload,
  type DisplayMode,
  type LeadingValue,
  type MeasureMode,
  type ThemeMode,
} from '../shared/types';
import { loadSettings, saveSettings } from '../shared/settings';
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
}

function plainTextToArticle(text: string, title: string): ArticlePayload {
  const trimmed = text.trim();
  const contentHtml = plainToSimpleHtml(trimmed);
  const id = `paste-${Date.now().toString(36)}`;
  const resolvedTitle =
    title.trim() ||
    trimmed.split(/\n/)[0]?.slice(0, 80) ||
    'Eingefügter Text';
  return {
    id,
    title: resolvedTitle,
    byline: '',
    siteName: 'Eingefügt',
    sourceUrl: 'about:blank',
    lang: 'de',
    contentHtml,
    textContent: trimmed,
    excerpt: trimmed.slice(0, 160),
    createdAt: Date.now(),
  };
}

function richHtmlToArticle(html: string, title: string): ArticlePayload {
  const contentHtml = sanitizeRichHtml(html);
  const text = htmlToPlainText(contentHtml);
  const id = `paste-${Date.now().toString(36)}`;
  const resolvedTitle =
    title.trim() ||
    text.split(/\n/)[0]?.slice(0, 80) ||
    'Eingefügter Text';
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

function autosizeEditor(el: HTMLElement): void {
  el.style.height = 'auto';
  el.style.height = `${Math.max(el.scrollHeight, 200)}px`;
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
  const sessionMode: DisplayMode | null = isDisplayMode(sessionModeRaw)
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
  };

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
  const editorTitle = document.getElementById(
    'editor-title',
  ) as HTMLInputElement;
  const editorBody = document.getElementById('editor-body') as HTMLElement;
  const displayGroup = document.getElementById('display-mode')!;
  const measureSelect = document.getElementById('measure') as HTMLSelectElement;
  const leadingMinus = document.getElementById(
    'leading-minus',
  ) as HTMLButtonElement;
  const leadingPlus = document.getElementById(
    'leading-plus',
  ) as HTMLButtonElement;
  const themeGroup = document.getElementById('theme')!;
  const textOnlyToggle = document.getElementById(
    'text-only-toggle',
  ) as HTMLButtonElement;
  const editModeBtn = document.getElementById(
    'btn-edit-mode',
  ) as HTMLButtonElement | null;

  const footerEl = document.getElementById('app-footer');
  if (footerEl) {
    const impressumHref = hostMode
      ? new URL('../impressum.html', document.baseURI).href
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
        const scheme = url.protocol.replace(/:$/, '');
        if (scheme === 'http' || scheme === 'https' || scheme === 'mailto') {
          e.preventDefault();
          try {
            (
              window as unknown as {
                webkit?: {
                  messageHandlers?: {
                    openExternal?: { postMessage: (v: string) => void };
                  };
                };
              }
            ).webkit?.messageHandlers?.openExternal?.postMessage(url.href);
          } catch {
            window.location.href = url.href;
          }
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
  }

  syncChoiceGroup(displayGroup, state.displayMode);
  syncChoiceGroup(themeGroup, state.theme);
  measureSelect.value = state.measure;
  setSwitch(textOnlyToggle, state.textOnly);

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
    editorTitle.readOnly = iosHost && !editMode;
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
    const raw = editorBody.innerHTML.trim();
    if (!raw || raw === '<br>') return '';
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
    app!.style.setProperty('--reader-line-height', String(state.leading));
    app!.style.setProperty('--host-line-height', String(state.leading));
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
    if (!hostMode) return true;
    if (iosHost) return !editMode;
    return true;
  }

  function handleWordActivate(word: HTMLElement, e?: Event): void {
    if (!word.dataset.converted) return;
    if (!canOpenDrawerFromWord()) return;
    e?.preventDefault();
    openDrawerForWord(word);
  }

  function closeDrawer(): void {
    drawerOpen = false;
    drawerEl.classList.remove('is-open');
    drawerEl.setAttribute('aria-hidden', 'true');
    applyChrome();
  }

  function dismissKeyboard(): void {
    if (!hostMode) return;
    const active = document.activeElement as HTMLElement | null;
    if (active === editorBody || active === editorTitle) {
      active.blur();
    }
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
      {
        drawerLiveCursor: state.drawerLiveCursor,
        showLiveCursorToggle: hostMode && !iosHost,
      },
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
        openDrawerForWord(el);
        return;
      }
    }
    // Host-Live: Drawer nicht bei jedem Tastenanschlag schließen
    if (drawerOpen && !hostMode) closeDrawer();
  }

  function renderHostLive(cursorWord?: {
    modern: string;
    occurrence: number;
  } | null): void {
    const html = editorHtml();
    const text = editorPlainText();
    const title = editorTitle.value;
    if (contentHost) {
      contentHost.dataset.placeholder = 'Text einfügen oder schreiben…';
    }
    if (!text.trim() && !html) {
      state.article = plainTextToArticle('', title);
      state.overrides = {};
      if (contentHost) contentHost.innerHTML = '';
      contentEl.innerHTML = '';
      lastAmbiguities = [];
      hintEl.classList.add('hidden');
      updateMeta();
      applyChrome();
      setWindowTitle();
      if (drawerOpen) closeDrawer();
      return;
    }
    state.article = html
      ? richHtmlToArticle(html, title)
      : plainTextToArticle(text, title);
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
  });

  measureSelect.addEventListener('change', () => {
    state.measure = measureSelect.value as MeasureMode;
    void saveSettings({ measure: state.measure });
    applyChrome();
  });

  leadingMinus.addEventListener('click', () => stepLeading(-1));
  leadingPlus.addEventListener('click', () => stepLeading(1));

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

  document.getElementById('font-minus')!.addEventListener('click', () => {
    const next = Math.max(FONT_SIZE_MIN, currentFontSize() - FONT_SIZE_STEP);
    state.fontSizes[state.displayMode] = next;
    void saveSettings({ fontSizes: { ...state.fontSizes } });
    applyChrome();
    if (hostMode) autosizeEditor(editorBody);
  });

  document.getElementById('font-plus')!.addEventListener('click', () => {
    const next = Math.min(FONT_SIZE_MAX, currentFontSize() + FONT_SIZE_STEP);
    state.fontSizes[state.displayMode] = next;
    void saveSettings({ fontSizes: { ...state.fontSizes } });
    applyChrome();
    if (hostMode) autosizeEditor(editorBody);
  });

  if (hostMode) {
    if (article) {
      if (article.contentHtml?.includes('<')) {
        setEditorHtml(sanitizeRichHtml(article.contentHtml));
      } else {
        setEditorHtml(plainToSimpleHtml(article.textContent || ''));
      }
      editorTitle.value =
        article.title === 'Eingefügter Text' ? '' : article.title;
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
      else if (drawerOpen) closeDrawer();
    };

    const reanalyzeAndTeach = () => {
      const { text, cursor } = selectionPlainAndOffset();
      const focus = state.drawerLiveCursor
        ? wordAtCursor(text, cursor)
        : null;
      lastDrawerKey = focus ? `${focus.modern}#${focus.occurrence}` : '';
      renderHostLive(focus);
      fitHostHeight();
    };

    /** Fallback für Select-All; Cut/Copy/Paste über natives Edit-Menü. */
    editorBody.addEventListener('keydown', (e) => {
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
    editorTitle.addEventListener('keydown', (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (e.key.toLowerCase() !== 'a') return;
      e.preventDefault();
      editorTitle.select();
    });
    editorTitle.addEventListener('input', () => reanalyzeAndTeach());
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
    editorBody.addEventListener('click', () => {
      if (iosHost && editMode) return;
      if (!canOpenDrawerFromWord()) return;
      liveCursorPaused = false;
      const { text, cursor } = selectionPlainAndOffset();
      const focus = wordAtCursor(text, cursor);
      if (!focus) {
        if (drawerOpen) closeDrawer();
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
      if (drawerOpen) closeDrawer();
      lastDrawerKey = '';
    });
    document.addEventListener('selectionchange', () => {
      if (iosHost && editMode) return;
      if (document.activeElement === editorBody) syncDrawerToCursor();
    });

    if (editModeBtn && iosHost) {
      editModeBtn.addEventListener('click', () => {
        editMode = !editMode;
        if (editMode) {
          if (drawerOpen) closeDrawer();
          applyChrome();
          editorBody.focus();
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
      // Mobile: native <details> + display:flex bricht oft den Summary-Toggle
      summary?.addEventListener('click', (e) => {
        if (!window.matchMedia('(max-width: 640px)').matches) return;
        e.preventDefault();
        settingsPanel.open = !settingsPanel.open;
      });
      document.addEventListener('click', (e) => {
        if (!settingsPanel.open) return;
        const t = e.target as Node;
        if (settingsPanel.contains(t)) return;
        settingsPanel.open = false;
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && settingsPanel.open) {
          settingsPanel.open = false;
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
    const liveToggle = (
      (e.target as HTMLElement).closest('.drawer-live-toggle') ??
      (e.target as HTMLElement)
        .closest('.drawer-follow-ctrl')
        ?.querySelector('.drawer-live-toggle')
    ) as HTMLButtonElement | null;
    if (liveToggle) {
      e.preventDefault();
      state.drawerLiveCursor = !state.drawerLiveCursor;
      setSwitch(liveToggle, state.drawerLiveCursor);
      liveToggle.title = state.drawerLiveCursor
        ? 'Drawer folgt dem Textcursor. Ausschalten: nur per Mausklick aufs Wort.'
        : 'Nur per Mausklick aufs Wort. Einschalten: Drawer folgt dem Textcursor.';
      void saveSettings({ drawerLiveCursor: state.drawerLiveCursor });
      if (hostMode && state.drawerLiveCursor) {
        const { text, cursor } = selectionPlainAndOffset();
        const focus = wordAtCursor(text, cursor);
        if (focus) openDrawerForModernWord(focus.modern, focus.occurrence);
      }
      return;
    }

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
      closeDrawer();
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
      editorBody.focus();
    }
  } else {
    render();
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

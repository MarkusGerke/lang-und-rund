import './reader.css';

import type { AmbiguitySpan } from '@langs/core';
import {
  ARTICLE_KEY_PREFIX,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_SIZE_STEP,
  type ArticlePayload,
  type DisplayMode,
  type MeasureMode,
  type ThemeMode,
} from '../shared/types';
import { loadSettings, saveSettings } from '../shared/settings';
import {
  convertHtmlFragment,
  convertPlainTitle,
  resultToHtml,
} from './convertDom';
import { stripToTextOnly, toModernS } from './textOnly';
import { renderDrawerBodyPrecise } from '../learning/drawerRender';
import {
  buildReportIssueUrl,
  buildReportXUrl,
  formatReportBody,
  renderAppFooterLinks,
  type ReportContext,
} from '../learning/feedback';
import { BRAND_NAME, IMPRESSUM_PATH } from '../shared/links';

interface ReaderState {
  article: ArticlePayload;
  overrides: Record<string, number>;
  displayMode: DisplayMode;
  theme: ThemeMode;
  measure: MeasureMode;
  fontSizes: Record<DisplayMode, number>;
  wordTooltip: boolean;
  textOnly: boolean;
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
  const params = new URLSearchParams(location.search);
  let id = params.get('id');
  if (!id) {
    const latest = await chrome.storage.session.get('langs-latest');
    id = (latest['langs-latest'] as string | undefined) ?? null;
  }

  const app = document.getElementById('app');
  const toolbar = document.getElementById('toolbar');
  if (!app || !toolbar || !id) {
    document.body.innerHTML =
      '<p style="padding:2rem;font-family:system-ui">Kein Artikel geladen. Öffne lang &amp; rund über das Erweiterungssymbol.</p>';
    return;
  }

  const article = await loadArticle(id);
  if (!article) {
    document.body.innerHTML =
      '<p style="padding:2rem;font-family:system-ui">Artikel nicht mehr verfügbar (Session abgelaufen).</p>';
    return;
  }

  const settings = await loadSettings();
  const state: ReaderState = {
    article,
    overrides: {},
    displayMode: settings.displayMode,
    theme: settings.theme,
    measure: settings.measure,
    fontSizes: { ...settings.fontSizes },
    wordTooltip: settings.wordTooltip,
    textOnly: settings.textOnly,
  };

  let lastAmbiguities: AmbiguitySpan[] = [];
  let lastReport: ReportContext | null = null;
  let drawerOpen = false;

  const titleEl = document.getElementById('title')!;
  const contentEl = document.getElementById('content')!;
  const metaEl = document.getElementById('meta')!;
  const hintEl = document.getElementById('ambiguity-hint')!;
  const tipEl = document.getElementById('word-tooltip')!;
  const drawerEl = document.getElementById('learn-drawer')!;
  const drawerBody = document.getElementById('drawer-body')!;
  const displaySelect = document.getElementById(
    'display-mode',
  ) as HTMLSelectElement;
  const measureSelect = document.getElementById('measure') as HTMLSelectElement;
  const themeSelect = document.getElementById('theme') as HTMLSelectElement;
  const tooltipToggle = document.getElementById(
    'word-tooltip-toggle',
  ) as HTMLButtonElement;
  const textOnlyToggle = document.getElementById(
    'text-only-toggle',
  ) as HTMLButtonElement;

  const footerEl = document.getElementById('app-footer');
  if (footerEl) {
    footerEl.outerHTML = renderAppFooterLinks(
      chrome.runtime.getURL(IMPRESSUM_PATH),
    );
  }

  {
    const bits: string[] = [];
    if (article.byline) bits.push(article.byline);
    const site = article.siteName || 'Quelle';
    bits.push(
      `<a class="source-link" href="${article.sourceUrl.replace(/"/g, '&quot;')}" target="_blank" rel="noopener">${site.replace(/</g, '&lt;')}</a>`,
    );
    metaEl.innerHTML = bits.join(' · ');
  }

  displaySelect.value = state.displayMode;
  themeSelect.value = state.theme;
  measureSelect.value = state.measure;
  setSwitch(tooltipToggle, state.wordTooltip);
  setSwitch(textOnlyToggle, state.textOnly);

  function currentFontSize(): number {
    return state.fontSizes[state.displayMode];
  }

  function applyChrome(): void {
    const openClass = drawerOpen ? ' drawer-open' : '';
    app!.className = `app theme-${state.theme} mode-${state.displayMode} measure-${state.measure}${openClass}`;
    toolbar!.className = 'toolbar';
    app!.style.setProperty('--reader-font-size', `${currentFontSize()}px`);
    syncToolbarHeight();
  }

  function syncToolbarHeight(): void {
    const h = Math.ceil(toolbar!.getBoundingClientRect().height);
    if (h > 0) {
      app!.style.setProperty('--toolbar-measured-height', `${h}px`);
    }
  }

  function hideWordTip(): void {
    tipEl.hidden = true;
    tipEl.textContent = '';
  }

  function showWordTip(anchor: HTMLElement): void {
    if (!state.wordTooltip) return;
    const text = anchor.dataset.modern ?? anchor.dataset.antiqua;
    if (!text) return;
    tipEl.textContent = toModernS(text);
    tipEl.hidden = false;

    const rect = anchor.getBoundingClientRect();
    const tipRect = tipEl.getBoundingClientRect();
    const gap = 8;
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    let top = rect.top - tipRect.height - gap;
    if (top < 8) top = rect.bottom + gap;
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
    tipEl.style.left = `${Math.round(left)}px`;
    tipEl.style.top = `${Math.round(top)}px`;
  }

  function closeDrawer(): void {
    drawerOpen = false;
    drawerEl.classList.remove('is-open');
    drawerEl.setAttribute('aria-hidden', 'true');
    applyChrome();
  }

  function openDrawerForWord(wordEl: HTMLElement): void {
    const converted = wordEl.dataset.converted;
    if (!converted) return;
    const modern = wordEl.dataset.modern ?? toModernS(converted);
    const ambId = wordEl.dataset.id;
    const ambiguity = ambId
      ? lastAmbiguities.find((a) => a.id === ambId)
      : undefined;

    hideWordTip();
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

  function articleHtml(): string {
    return state.textOnly
      ? stripToTextOnly(state.article.contentHtml)
      : state.article.contentHtml;
  }

  function render(reopen?: { ambId?: string; converted?: string }): void {
    applyChrome();
    const art = state.article;
    document.title = `${art.title} · ${BRAND_NAME}`;
    hideWordTip();

    const overrideMap = new Map(Object.entries(state.overrides));
    const titleResult = convertPlainTitle(art.title, overrideMap);
    titleEl.innerHTML = resultToHtml(titleResult, state.displayMode);

    const { html, ambiguities } = convertHtmlFragment(
      articleHtml(),
      overrideMap,
      state.displayMode,
    );
    contentEl.innerHTML = html;
    lastAmbiguities = [...titleResult.ambiguities, ...ambiguities];

    if (lastAmbiguities.length > 0) hintEl.classList.remove('hidden');
    else hintEl.classList.add('hidden');

    if (reopen) {
      let el: Element | null = null;
      if (reopen.ambId) {
        el =
          contentEl.querySelector(
            `.word[data-id="${CSS.escape(reopen.ambId)}"]`,
          ) ??
          titleEl.querySelector(`.word[data-id="${CSS.escape(reopen.ambId)}"]`);
      }
      if (!el && reopen.converted) {
        const target = reopen.converted;
        const candidates = [
          ...Array.from(contentEl.querySelectorAll('.word[data-converted]')),
          ...Array.from(titleEl.querySelectorAll('.word[data-converted]')),
        ];
        el =
          candidates.find(
            (n) => (n as HTMLElement).dataset.converted === target,
          ) ?? null;
      }
      if (el instanceof HTMLElement) {
        openDrawerForWord(el);
        return;
      }
    }
    if (drawerOpen) closeDrawer();
  }

  document.getElementById('btn-close')!.addEventListener('click', () => {
    window.close();
  });

  document.getElementById('drawer-close')!.addEventListener('click', () => {
    closeDrawer();
  });

  displaySelect.addEventListener('change', () => {
    state.displayMode = displaySelect.value as DisplayMode;
    void saveSettings({ displayMode: state.displayMode });
    render();
  });

  measureSelect.addEventListener('change', () => {
    state.measure = measureSelect.value as MeasureMode;
    void saveSettings({ measure: state.measure });
    applyChrome();
  });

  themeSelect.addEventListener('change', () => {
    state.theme = themeSelect.value as ThemeMode;
    void saveSettings({ theme: state.theme });
    applyChrome();
  });

  tooltipToggle.addEventListener('click', () => {
    state.wordTooltip = !state.wordTooltip;
    setSwitch(tooltipToggle, state.wordTooltip);
    void saveSettings({ wordTooltip: state.wordTooltip });
    if (!state.wordTooltip) hideWordTip();
  });

  textOnlyToggle.addEventListener('click', () => {
    state.textOnly = !state.textOnly;
    setSwitch(textOnlyToggle, state.textOnly);
    void saveSettings({ textOnly: state.textOnly });
    render();
  });

  document.getElementById('font-minus')!.addEventListener('click', () => {
    const next = Math.max(FONT_SIZE_MIN, currentFontSize() - FONT_SIZE_STEP);
    state.fontSizes[state.displayMode] = next;
    void saveSettings({ fontSizes: { ...state.fontSizes } });
    applyChrome();
  });

  document.getElementById('font-plus')!.addEventListener('click', () => {
    const next = Math.min(FONT_SIZE_MAX, currentFontSize() + FONT_SIZE_STEP);
    state.fontSizes[state.displayMode] = next;
    void saveSettings({ fontSizes: { ...state.fontSizes } });
    applyChrome();
  });

  for (const root of [contentEl, titleEl]) {
    root.addEventListener('click', (e) => {
      const word = (e.target as HTMLElement).closest('.word') as HTMLElement | null;
      if (!word?.dataset.converted) return;
      e.preventDefault();
      openDrawerForWord(word);
    });

    root.addEventListener('mouseover', (e) => {
      if (!state.wordTooltip) return;
      const word = (e.target as HTMLElement).closest(
        '.word',
      ) as HTMLElement | null;
      if (!word?.dataset.modern && !word?.dataset.antiqua) return;
      showWordTip(word!);
    });

    root.addEventListener('mouseout', (e) => {
      const related = e.relatedTarget as Node | null;
      const fromWord = (e.target as HTMLElement).closest('.word');
      if (!fromWord) return;
      if (related && fromWord.contains(related)) return;
      hideWordTip();
    });

    root.addEventListener('keydown', (e) => {
      const word = (e.target as HTMLElement).closest('.word') as HTMLElement | null;
      if (!word?.dataset.converted) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDrawerForWord(word);
      }
    });
  }

  drawerBody.addEventListener('click', (e) => {
    const reportBtn = (e.target as HTMLElement).closest(
      '[data-report="issue"]',
    ) as HTMLElement | null;
    if (reportBtn) {
      e.preventDefault();
      if (!lastReport) return;
      const full = formatReportBody(lastReport);
      void navigator.clipboard.writeText(full).then(
        () => showToast('Bericht in die Zwischenablage kopiert'),
        () => showToast('Zwischenablage nicht verfügbar'),
      );
      const issueUrl = buildReportIssueUrl(lastReport);
      window.open(issueUrl ?? buildReportXUrl(lastReport), '_blank', 'noopener');
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

  /** Nur genau dieses Buchstaben-Kästchen + zugehörige Sammel-Box. */
  function linkLetterElement(letterEl: HTMLElement): void {
    clearDrawerLinks();
    letterEl.classList.add('is-linked');
    const key = letterEl.dataset.letterKey;
    if (!key) return;
    drawerBody
      .querySelector(`#pitfall-letter-${CSS.escape(key)}`)
      ?.classList.add('is-linked');
  }

  /** Box → nur die Buchstaben-Kästchen mit gleichem letter-key (keine Nachbarn). */
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
  window.addEventListener('resize', () => syncToolbarHeight());

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (drawerOpen) {
      e.preventDefault();
      closeDrawer();
      return;
    }
    e.preventDefault();
    window.close();
  });

  render();
}

void init();

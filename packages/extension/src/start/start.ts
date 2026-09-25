import './start.css';

import { convertLongS } from '@langs/core';
import { renderPitfallHintCard } from '../learning/drawerRender';
import { matchPitfalls } from '../learning/matchPitfalls';
import startWordsData from '../learning/startWords.json';
import { encodeForDisplay } from '../reader/kurrentEncode';
import { renderAppFooterLinks } from '../learning/feedback';
import { IMPRESSUM_PATH, START_PAGE_PATH } from '../shared/links';
import { loadSettings, saveSettings } from '../shared/settings';
import type { DisplayMode } from '../shared/types';

interface StartWord {
  modern: string;
  pitfallIds: string[];
  preferredMode: DisplayMode;
}

type StartScriptMode = 'fraktur' | 'kurrent';

const WORDS = startWordsData.words as StartWord[];

function impressumHref(): string {
  try {
    return chrome.runtime.getURL(IMPRESSUM_PATH);
  } catch {
    return IMPRESSUM_PATH;
  }
}

function pageUrl(): string {
  const href = window.location?.href ?? '';
  if (href && href !== 'about:blank') return href;
  try {
    return chrome.runtime.getURL(START_PAGE_PATH);
  } catch {
    return '';
  }
}

/** Menüpfad zum Ändern der Browser-Startseite. */
function homepageSettingsHint(): string {
  const ua = navigator.userAgent;
  if (/Firefox\//.test(ua)) return 'Einstellungen › Startseite';
  if (/Edg\//.test(ua)) return 'Einstellungen › Start, Startseite und neue Tabs';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) {
    return 'Einstellungen › Beim Start';
  }
  return 'Einstellungen › Allgemein';
}

function toScriptMode(mode: DisplayMode): StartScriptMode {
  return mode === 'kurrent' ? 'kurrent' : 'fraktur';
}

function pickWord(exclude?: string): StartWord {
  if (WORDS.length === 0) {
    return { modern: 'Haus', pitfallIds: [], preferredMode: 'fraktur' };
  }
  if (WORDS.length === 1) return WORDS[0];
  let next = WORDS[Math.floor(Math.random() * WORDS.length)];
  let guard = 0;
  while (exclude && next.modern === exclude && guard++ < 12) {
    next = WORDS[Math.floor(Math.random() * WORDS.length)];
  }
  return next;
}

async function init(): Promise<void> {
  const app = document.getElementById('app')!;
  const segment = document.getElementById('display-mode')!;
  const segmentBtns = Array.from(
    segment.querySelectorAll<HTMLButtonElement>('[data-mode]'),
  );
  const btnNext = document.getElementById('btn-next') as HTMLButtonElement;
  const modernEl = document.getElementById('word-modern')!;
  const scriptEl = document.getElementById('word-script')!;
  const trackEl = document.getElementById('hint-track')!;
  const pageUrlEl = document.getElementById('page-url')!;
  const homepageHintEl = document.getElementById('homepage-hint')!;
  const copyBtn = document.getElementById(
    'copy-page-url',
  ) as HTMLButtonElement;
  const footer = document.getElementById('start-footer');

  homepageHintEl.textContent = homepageSettingsHint();

  const url = pageUrl();
  pageUrlEl.textContent = url;
  pageUrlEl.setAttribute('title', url);

  copyBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(url).then(
      () => {
        copyBtn.textContent = 'Kopiert';
        setTimeout(() => {
          copyBtn.textContent = 'URL kopieren';
        }, 1600);
      },
      () => {
        copyBtn.textContent = 'Markieren & kopieren';
      },
    );
  });

  if (footer) {
    footer.outerHTML = renderAppFooterLinks(impressumHref()).replace(
      'class="app-footer"',
      'class="app-footer start-footer"',
    );
  }

  const settings = await loadSettings();
  let mode: StartScriptMode = toScriptMode(settings.displayMode);
  let current: StartWord | null = null;

  function syncSegment(): void {
    for (const btn of segmentBtns) {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function applyChrome(): void {
    app.className = `start-app theme-${settings.theme} mode-${mode}`;
  }

  function renderWord(word: StartWord): void {
    current = word;
    const converted = convertLongS(word.modern).output;
    modernEl.textContent = word.modern;

    const visual =
      mode === 'kurrent' ? encodeForDisplay(converted, 'kurrent') : converted;
    scriptEl.textContent = visual;
    scriptEl.className =
      'start-script ' + (mode === 'kurrent' ? 'kurrent-font' : 'fraktur-font');

    const hits = matchPitfalls(converted, mode);
    const preferred = new Set(word.pitfallIds);
    const ordered = [
      ...hits.filter((h) => preferred.has(h.pitfall.id)),
      ...hits.filter((h) => !preferred.has(h.pitfall.id)),
    ];

    if (ordered.length === 0) {
      trackEl.innerHTML =
        `<p class="start-empty">Keine Lernhinweise für dieses Wort in diesem Schriftmodus — Modus wechseln oder nächstes Wort.</p>`;
    } else {
      trackEl.innerHTML = ordered
        .map((h) => renderPitfallHintCard(h.pitfall, mode))
        .join('');
    }
    trackEl.scrollLeft = 0;
  }

  function showRandom(exclude?: string): void {
    applyChrome();
    syncSegment();
    renderWord(pickWord(exclude));
  }

  segment.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>(
      '[data-mode]',
    );
    if (!btn?.dataset.mode) return;
    const next = btn.dataset.mode as StartScriptMode;
    if (next === mode) return;
    mode = next;
    void saveSettings({ displayMode: mode });
    applyChrome();
    syncSegment();
    if (current) renderWord(current);
  });

  btnNext.addEventListener('click', () => {
    showRandom(current?.modern);
  });

  syncSegment();
  showRandom();
}

void init();

import './options.css';
import { loadSettings, saveSettings } from '../shared/settings';
import {
  MODE_DEFAULT_FONT_SIZE,
  parseLeading,
  type DisplayMode,
  type MeasureMode,
  type ThemeMode,
} from '../shared/types';
import { renderAppFooterLinks } from '../learning/feedback';
import { IMPRESSUM_PATH, START_PAGE_PATH } from '../shared/links';

async function init(): Promise<void> {
  const settings = await loadSettings();
  const display = document.getElementById('display-mode') as HTMLSelectElement;
  const measure = document.getElementById('measure') as HTMLSelectElement;
  const leading = document.getElementById('leading') as HTMLInputElement;
  const theme = document.getElementById('theme') as HTMLSelectElement;
  const force = document.getElementById('force-german') as HTMLSelectElement;
  const sizeAntiqua = document.getElementById('size-antiqua') as HTMLInputElement;
  const sizeFraktur = document.getElementById('size-fraktur') as HTMLInputElement;
  const sizeKurrent = document.getElementById('size-kurrent') as HTMLInputElement;
  const sizeSuetterlin = document.getElementById(
    'size-suetterlin',
  ) as HTMLInputElement;
  const status = document.getElementById('status')!;
  const footer = document.getElementById('options-footer');
  if (footer) {
    footer.outerHTML = renderAppFooterLinks(
      chrome.runtime.getURL(IMPRESSUM_PATH),
    ).replace('class="app-footer"', 'class="app-footer options-footer"');
  }

  const startUrl = chrome.runtime.getURL(START_PAGE_PATH);
  const startUrlEl = document.getElementById('start-url');
  if (startUrlEl) {
    startUrlEl.textContent = startUrl;
    startUrlEl.hidden = false;
  }
  document.getElementById('open-start-page')?.addEventListener('click', () => {
    void chrome.tabs.create({ url: startUrl });
  });
  document.getElementById('copy-start-url')?.addEventListener('click', () => {
    void navigator.clipboard.writeText(startUrl).then(
      () => {
        status.hidden = false;
        status.textContent = 'Startseiten-URL kopiert.';
        setTimeout(() => {
          status.hidden = true;
        }, 1800);
      },
      () => {
        status.hidden = false;
        status.textContent = 'Kopieren nicht möglich — URL unten markieren.';
      },
    );
  });

  display.value = settings.displayMode;
  measure.value = settings.measure;
  leading.value = String(settings.leading);
  theme.value = settings.theme;
  sizeAntiqua.value = String(
    settings.fontSizes.antiqua ?? MODE_DEFAULT_FONT_SIZE.antiqua,
  );
  sizeFraktur.value = String(
    settings.fontSizes.fraktur ?? MODE_DEFAULT_FONT_SIZE.fraktur,
  );
  sizeKurrent.value = String(
    settings.fontSizes.kurrent ?? MODE_DEFAULT_FONT_SIZE.kurrent,
  );
  sizeSuetterlin.value = String(
    settings.fontSizes.suetterlin ?? MODE_DEFAULT_FONT_SIZE.suetterlin,
  );
  force.value =
    settings.forceGerman === true
      ? 'yes'
      : settings.forceGerman === false
        ? 'no'
        : 'auto';

  async function persist(): Promise<void> {
    const forceVal = force.value;
    await saveSettings({
      displayMode: display.value as DisplayMode,
      measure: measure.value as MeasureMode,
      leading: parseLeading(leading.value),
      theme: theme.value as ThemeMode,
      fontSizes: {
        antiqua: Number(sizeAntiqua.value) || MODE_DEFAULT_FONT_SIZE.antiqua,
        fraktur: Number(sizeFraktur.value) || MODE_DEFAULT_FONT_SIZE.fraktur,
        kurrent: Number(sizeKurrent.value) || MODE_DEFAULT_FONT_SIZE.kurrent,
        suetterlin:
          Number(sizeSuetterlin.value) || MODE_DEFAULT_FONT_SIZE.suetterlin,
      },
      forceGerman:
        forceVal === 'yes' ? true : forceVal === 'no' ? false : null,
    });
    leading.value = String(parseLeading(leading.value));
    status.hidden = false;
    status.textContent = 'Gespeichert.';
    setTimeout(() => {
      status.hidden = true;
    }, 1500);
  }

  for (const el of [
    display,
    sizeSuetterlin,
    measure,
    leading,
    theme,
    force,
    sizeAntiqua,
    sizeFraktur,
    sizeKurrent,
  ]) {
    el.addEventListener('change', () => void persist());
  }
}

void init();

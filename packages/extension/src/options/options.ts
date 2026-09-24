import './options.css';
import { loadSettings, saveSettings } from '../shared/settings';
import {
  MODE_DEFAULT_FONT_SIZE,
  type DisplayMode,
  type MeasureMode,
  type ThemeMode,
} from '../shared/types';
import { renderAppFooterLinks } from '../learning/feedback';
import { IMPRESSUM_PATH } from '../shared/links';

async function init(): Promise<void> {
  const settings = await loadSettings();
  const display = document.getElementById('display-mode') as HTMLSelectElement;
  const measure = document.getElementById('measure') as HTMLSelectElement;
  const theme = document.getElementById('theme') as HTMLSelectElement;
  const force = document.getElementById('force-german') as HTMLSelectElement;
  const sizeAntiqua = document.getElementById('size-antiqua') as HTMLInputElement;
  const sizeFraktur = document.getElementById('size-fraktur') as HTMLInputElement;
  const sizeKurrent = document.getElementById('size-kurrent') as HTMLInputElement;
  const status = document.getElementById('status')!;
  const footer = document.getElementById('options-footer');
  if (footer) {
    footer.outerHTML = renderAppFooterLinks(
      chrome.runtime.getURL(IMPRESSUM_PATH),
    ).replace('class="app-footer"', 'class="app-footer options-footer"');
  }

  display.value = settings.displayMode;
  measure.value = settings.measure;
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
      theme: theme.value as ThemeMode,
      fontSizes: {
        antiqua: Number(sizeAntiqua.value) || MODE_DEFAULT_FONT_SIZE.antiqua,
        fraktur: Number(sizeFraktur.value) || MODE_DEFAULT_FONT_SIZE.fraktur,
        kurrent: Number(sizeKurrent.value) || MODE_DEFAULT_FONT_SIZE.kurrent,
      },
      forceGerman:
        forceVal === 'yes' ? true : forceVal === 'no' ? false : null,
    });
    status.hidden = false;
    status.textContent = 'Gespeichert.';
    setTimeout(() => {
      status.hidden = true;
    }, 1500);
  }

  for (const el of [
    display,
    measure,
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

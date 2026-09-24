import './style.css';
import { convertLongSWithStableIds } from '@langs/core';
import type { AmbiguitySpan, Result } from '@langs/core';

const STORAGE_KEY = 'langs-editor-state';

interface EditorState {
  input: string;
  overrides: Record<string, number>;
}

function loadState(): EditorState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as EditorState;
  } catch {
    /* ignore */
  }
  return { input: '', overrides: {} };
}

function saveState(state: EditorState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPreview(result: Result): string {
  return result.segments
    .map((seg) => {
      if (seg.type === 'ambiguity' && seg.ambiguity) {
        const amb = seg.ambiguity;
        return (
          `<span class="ambiguity" data-id="${escapeHtml(amb.id)}" ` +
          `tabindex="0" role="button" aria-haspopup="listbox" aria-expanded="false" ` +
          `aria-label="Mehrdeutige ſ/s-Schreibung: ${escapeHtml(seg.text)}. Variante wählen.">` +
          `<span class="ambiguity-word">${escapeHtml(seg.text)}</span>` +
          `</span>`
        );
      }
      return escapeHtml(seg.text);
    })
    .join('');
}

function renderPopover(amb: AmbiguitySpan): string {
  const options = amb.candidates
    .map((c, idx) => {
      const selected = idx === amb.selectedIndex;
      return (
        `<button type="button" class="ambiguity-option${selected ? ' selected' : ''}" ` +
        `data-id="${escapeHtml(amb.id)}" data-index="${idx}" role="option" ` +
        `aria-selected="${selected}">` +
        `<span class="ambiguity-option-text">${escapeHtml(c.text)}</span>` +
        `<span class="ambiguity-option-desc">${escapeHtml(c.description)}</span>` +
        `</button>`
      );
    })
    .join('');

  return (
    `<div class="ambiguity-popover" role="listbox" aria-label="Wortvariante wählen">` +
    `<div class="ambiguity-tooltip-title">Wort ersetzen durch</div>` +
    `${options}` +
    `</div>`
  );
}

function setOverride(
  overrides: Record<string, number>,
  id: string,
  index: number,
): Record<string, number> {
  return { ...overrides, [id]: index };
}

function showToast(message: string): void {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2000);
}

function init(): void {
  const app = document.getElementById('app');
  if (!app) return;

  let state = loadState();
  let openAmbiguityId: string | null = null;
  let lastResult: Result | null = null;

  app.innerHTML = `
    <header class="header">
      <h1>Langs-Editor</h1>
      <p class="subtitle">Historische deutsche Schreibung mit automatischem ſ/s</p>
    </header>

    <main class="main">
      <section class="panel">
        <label for="input" class="panel-label">Eingabe (moderne Schreibung)</label>
        <textarea
          id="input"
          class="editor-input"
          placeholder="Text mit normalem s eingeben …"
          spellcheck="false"
          rows="8"
        >${escapeHtml(state.input)}</textarea>
      </section>

      <section class="panel panel-preview">
        <div class="panel-header">
          <span class="panel-label">Vorschau (historische Schreibung)</span>
          <div class="actions">
            <button type="button" id="copy-btn" class="btn">Kopieren</button>
            <button type="button" id="export-btn" class="btn btn-secondary">Exportieren</button>
          </div>
        </div>
        <div id="preview" class="preview" aria-live="polite"></div>
        <p id="ambiguity-hint" class="hint hidden">
          Gepunktet unterstrichene Wörter: Wortfuge unklar — Hover oder Klick öffnet die Variantenauswahl.
        </p>
      </section>
    </main>

    <footer class="footer">
      <p>Unicode U+017F (ſ) · Regeln nach klassischem Fraktursatz · Mehrdeutigkeiten interaktiv</p>
    </footer>

    <div id="ambiguity-layer" class="ambiguity-layer" hidden></div>
    <div id="toast" class="toast" role="status"></div>
  `;

  const inputEl = document.getElementById('input') as HTMLTextAreaElement;
  const previewEl = document.getElementById('preview')!;
  const hintEl = document.getElementById('ambiguity-hint')!;
  const layerEl = document.getElementById('ambiguity-layer')!;
  const copyBtn = document.getElementById('copy-btn')!;
  const exportBtn = document.getElementById('export-btn')!;

  function getResult(): Result {
    const overrideMap = new Map(
      Object.entries(state.overrides).map(([k, v]) => [k, v]),
    );
    return convertLongSWithStableIds(state.input, overrideMap);
  }

  function closePopover(): void {
    openAmbiguityId = null;
    layerEl.hidden = true;
    layerEl.innerHTML = '';
    previewEl
      .querySelectorAll('.ambiguity[aria-expanded="true"]')
      .forEach((el) => el.setAttribute('aria-expanded', 'false'));
  }

  function positionPopover(anchor: HTMLElement): void {
    const pop = layerEl.querySelector('.ambiguity-popover') as HTMLElement | null;
    if (!pop) return;

    const rect = anchor.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const gap = 8;
    let left = rect.left + rect.width / 2 - popRect.width / 2;
    let top = rect.top - popRect.height - gap;

    // Wenn oben kein Platz: unter dem Wort
    if (top < 8) {
      top = rect.bottom + gap;
      pop.classList.add('below');
    } else {
      pop.classList.remove('below');
    }

    left = Math.max(8, Math.min(left, window.innerWidth - popRect.width - 8));
    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;
  }

  function openPopover(id: string, anchor: HTMLElement): void {
    const amb = lastResult?.ambiguities.find((a) => a.id === id);
    if (!amb) return;

    openAmbiguityId = id;
    layerEl.hidden = false;
    layerEl.innerHTML = renderPopover(amb);
    previewEl
      .querySelectorAll('.ambiguity')
      .forEach((el) =>
        el.setAttribute(
          'aria-expanded',
          el.getAttribute('data-id') === id ? 'true' : 'false',
        ),
      );

    // Zwei Frames: erst messen, dann positionieren
    requestAnimationFrame(() => positionPopover(anchor));
  }

  function update(): void {
    const result = getResult();
    lastResult = result;
    const keepOpenId = openAmbiguityId;
    previewEl.innerHTML = renderPreview(result);

    if (result.ambiguities.length > 0) {
      hintEl.classList.remove('hidden');
    } else {
      hintEl.classList.add('hidden');
    }

    saveState(state);

    if (keepOpenId && result.ambiguities.some((a) => a.id === keepOpenId)) {
      const anchor = previewEl.querySelector(
        `.ambiguity[data-id="${CSS.escape(keepOpenId)}"]`,
      ) as HTMLElement | null;
      if (anchor) openPopover(keepOpenId, anchor);
      else closePopover();
    } else {
      closePopover();
    }
  }

  previewEl.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest(
      '.ambiguity',
    ) as HTMLElement | null;
    if (!target?.dataset.id) return;

    e.preventDefault();
    e.stopPropagation();
    const id = target.dataset.id;
    if (openAmbiguityId === id) {
      closePopover();
    } else {
      openPopover(id, target);
    }
  });

  previewEl.addEventListener('mouseover', (e) => {
    const target = (e.target as HTMLElement).closest(
      '.ambiguity',
    ) as HTMLElement | null;
    if (!target?.dataset.id) return;
    if (openAmbiguityId === target.dataset.id) return;
    openPopover(target.dataset.id, target);
  });

  previewEl.addEventListener('focusin', (e) => {
    const target = (e.target as HTMLElement).closest(
      '.ambiguity',
    ) as HTMLElement | null;
    if (!target?.dataset.id) return;
    openPopover(target.dataset.id, target);
  });

  layerEl.addEventListener('click', (e) => {
    const option = (e.target as HTMLElement).closest(
      '.ambiguity-option',
    ) as HTMLElement | null;
    if (option?.dataset.id == null || option.dataset.index == null) return;

    e.preventDefault();
    e.stopPropagation();
    const id = option.dataset.id;
    const index = Number(option.dataset.index);
    const chosen =
      lastResult?.ambiguities.find((a) => a.id === id)?.candidates[index]
        ?.text ?? '';
    state.overrides = setOverride(state.overrides, id, index);
    saveState(state);
    closePopover();
    update();
    if (chosen) showToast(`Ersetzt durch: ${chosen}`);
  });

  // Popover offen halten, wenn Maus vom Wort ins Menü wandert
  let hoverCloseTimer: number | null = null;

  function scheduleClose(): void {
    if (hoverCloseTimer != null) window.clearTimeout(hoverCloseTimer);
    hoverCloseTimer = window.setTimeout(() => {
      closePopover();
      hoverCloseTimer = null;
    }, 180);
  }

  function cancelClose(): void {
    if (hoverCloseTimer != null) {
      window.clearTimeout(hoverCloseTimer);
      hoverCloseTimer = null;
    }
  }

  previewEl.addEventListener('mouseout', (e) => {
    const related = e.relatedTarget as Node | null;
    if (related && (previewEl.contains(related) || layerEl.contains(related))) {
      return;
    }
    scheduleClose();
  });

  layerEl.addEventListener('mouseenter', cancelClose);
  layerEl.addEventListener('mouseleave', scheduleClose);

  document.addEventListener('click', (e) => {
    if (!openAmbiguityId) return;
    const t = e.target as Node;
    if (previewEl.contains(t) || layerEl.contains(t)) return;
    closePopover();
  });

  previewEl.addEventListener('keydown', (e) => {
    const target = (e.target as HTMLElement).closest(
      '.ambiguity',
    ) as HTMLElement | null;
    if (!target?.dataset.id) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const id = target.dataset.id;
      if (openAmbiguityId === id) closePopover();
      else openPopover(id, target);
    } else if (e.key === 'Escape') {
      closePopover();
    }
  });

  window.addEventListener('scroll', () => {
    if (!openAmbiguityId) return;
    const anchor = previewEl.querySelector(
      `.ambiguity[data-id="${CSS.escape(openAmbiguityId)}"]`,
    ) as HTMLElement | null;
    if (anchor) positionPopover(anchor);
  }, true);

  window.addEventListener('resize', () => {
    if (!openAmbiguityId) return;
    const anchor = previewEl.querySelector(
      `.ambiguity[data-id="${CSS.escape(openAmbiguityId)}"]`,
    ) as HTMLElement | null;
    if (anchor) positionPopover(anchor);
  });

  inputEl.addEventListener('input', () => {
    state.input = inputEl.value;
    closePopover();
    update();
  });

  copyBtn.addEventListener('click', async () => {
    const result = getResult();
    try {
      await navigator.clipboard.writeText(result.output);
      showToast('In Zwischenablage kopiert');
    } catch {
      showToast('Kopieren fehlgeschlagen');
    }
  });

  exportBtn.addEventListener('click', () => {
    const result = getResult();
    const blob = new Blob([result.output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'langs-text.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Datei exportiert');
  });

  update();
}

init();

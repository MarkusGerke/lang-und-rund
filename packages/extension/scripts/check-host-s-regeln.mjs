/**
 * Build-Gate: Host-Edit darf die ſ-Anzeige nicht wieder verstecken.
 * Siehe packages/extension/docs/s-regeln-pruefung.md
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cssPath = resolve(root, 'src/reader/reader.css');
const tsPath = resolve(root, 'src/reader/reader.ts');

const errors = [];

function read(path) {
  if (!existsSync(path)) {
    errors.push(`Datei fehlt: ${path}`);
    return '';
  }
  return readFileSync(path, 'utf8');
}

const css = read(cssPath);
const ts = read(tsPath);

// Extrahiere .host-edit #content-host Block (nicht-gierig bis nächste Regel)
const contentHostEdit = css.match(
  /\.app\.host-app\.host-edit\s+#content-host\s*\{([^}]*)\}/,
);
if (!contentHostEdit) {
  errors.push(
    'CSS: Regel .app.host-app.host-edit #content-host fehlt — ſ-Schicht braucht explizite Edit-Styles.',
  );
} else {
  const body = contentHostEdit[1];
  if (/opacity\s*:\s*0\b/.test(body)) {
    errors.push(
      'CSS: .host-edit #content-host hat opacity:0 — konvertierter Text wäre unsichtbar.',
    );
  }
  if (/visibility\s*:\s*hidden\b/.test(body)) {
    errors.push(
      'CSS: .host-edit #content-host hat visibility:hidden — verboten.',
    );
  }
}

const editorEdit = css.match(
  /\.app\.host-app\.host-edit\s+#editor-body\s*\{([^}]*)\}/,
);
if (!editorEdit) {
  errors.push('CSS: Regel .app.host-app.host-edit #editor-body fehlt.');
} else {
  const body = editorEdit[1];
  // Nicht caret-color matchen
  if (/(?<![-\w])color\s*:\s*var\(--reader-text\)/.test(body)) {
    errors.push(
      'CSS: .host-edit #editor-body hat color: var(--reader-text) — zeigt modernen Tipptext statt ſ-Schicht.',
    );
  }
  if (/(?<![-\w])color\s*:\s*#/.test(body) || /(?<![-\w])color\s*:\s*rgb/.test(body)) {
    errors.push(
      'CSS: .host-edit #editor-body hat sichtbare Textfarbe — muss transparent bleiben.',
    );
  }
  if (!/(?<![-\w])color\s*:\s*transparent\b/.test(body)) {
    errors.push(
      'CSS: .host-edit #editor-body muss color: transparent setzen (nur Caret sichtbar).',
    );
  }
}

// TS: matchSourceVisual darf im Host-Pfad nicht auf true gesetzt werden
if (/matchSourceVisual\s*:\s*true/.test(ts)) {
  errors.push(
    'TS: matchSourceVisual: true in reader.ts — im Host-Edit ohne Freigabe verboten.',
  );
}

if (errors.length) {
  console.error('check-host-s-regeln: FEHLER\n');
  for (const e of errors) console.error(' •', e);
  console.error(
    '\nSiehe packages/extension/docs/s-regeln-pruefung.md\n',
  );
  process.exit(1);
}

console.log('check-host-s-regeln: ok');

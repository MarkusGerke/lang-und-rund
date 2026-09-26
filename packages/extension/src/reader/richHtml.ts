/**
 * Rich-HTML Allowlist (Grill 5B): h1–h3, p, strong/b, em/i, br, ul/ol/li, blockquote, a[href].
 * ſ-Konvertierung nur auf Textknoten (6A).
 */

const ALLOWED_TAGS = new Set([
  'H1',
  'H2',
  'H3',
  'P',
  'STRONG',
  'B',
  'EM',
  'I',
  'BR',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'A',
  'DIV', // transient wrapper; unwrapped on sanitize root
]);

function isAllowed(el: Element): boolean {
  return ALLOWED_TAGS.has(el.tagName);
}

/** Entfernt alles außer Allowlist; behält Text. */
export function sanitizeRichHtml(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const root = template.content;

  const walk = (parent: Node): void => {
    const children = Array.from(parent.childNodes);
    for (const node of children) {
      if (node.nodeType === Node.TEXT_NODE) continue;
      if (node.nodeType !== Node.ELEMENT_NODE) {
        parent.removeChild(node);
        continue;
      }
      const el = node as Element;
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') {
        parent.removeChild(el);
        continue;
      }
      // Span u. a. → Inhalt behalten
      if (!isAllowed(el) || el.tagName === 'DIV') {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
        continue;
      }
      // Attribute strippen außer href bei <a>
      const keepHref = el.tagName === 'A' ? el.getAttribute('href') : null;
      for (const attr of Array.from(el.attributes)) {
        el.removeAttribute(attr.name);
      }
      if (keepHref && /^https?:\/\//i.test(keepHref)) {
        el.setAttribute('href', keepHref);
        el.setAttribute('rel', 'noopener noreferrer');
      }
      walk(el);
    }
  };

  walk(root);

  // DIV-Wrapper am Root auflösen
  const out = document.createElement('div');
  out.appendChild(root.cloneNode(true));
  // Leere Block-Elemente entfernen
  out.querySelectorAll('p,h1,h2,h3,li,blockquote').forEach((el) => {
    if (!(el.textContent ?? '').trim() && !el.querySelector('br')) el.remove();
  });
  return out.innerHTML.trim();
}

export function htmlToPlainText(html: string): string {
  const d = document.createElement('div');
  d.innerHTML = html;
  // Block-Elemente → Newlines
  d.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  d.querySelectorAll('p,h1,h2,h3,li,blockquote').forEach((el) => {
    el.append('\n');
  });
  return (d.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Plaintext → minimales HTML (<p> + <br>). */
export function plainToSimpleHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const escape = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  return `<p>${escape(trimmed).replace(/\n/g, '<br>')}</p>`;
}

/**
 * Schreibt HTML + Plaintext in die Zwischenablage (7A).
 * `html` sollte bereits die gewünschte sichtbare Form haben (z. B. mit ſ).
 */
export async function writeClipboardHtml(
  html: string,
  plain: string,
): Promise<void> {
  const plainText = plain || htmlToPlainText(html);
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      return;
    }
  } catch {
    /* fallback */
  }
  try {
    await navigator.clipboard.writeText(plainText);
  } catch {
    /* ignore */
  }
}

/** HTML aus Paste-Event lesen. */
export function clipboardHtmlFromPaste(e: ClipboardEvent): string | null {
  const html = e.clipboardData?.getData('text/html');
  if (html && html.trim()) return html;
  return null;
}

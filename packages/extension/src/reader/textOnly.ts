/** Entfernt Bilder/Medien und typischen Ballast aus Readability-HTML. */
export function stripToTextOnly(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;

  const junk = template.content.querySelectorAll(
    [
      'img',
      'picture',
      'source',
      'figure',
      'figcaption',
      'svg',
      'video',
      'audio',
      'iframe',
      'object',
      'embed',
      'canvas',
      'noscript',
      'form',
      'button',
      'input',
      'select',
      'textarea',
      'nav',
      'aside',
      '[role="navigation"]',
      '[role="complementary"]',
      '[role="banner"]',
      '[role="contentinfo"]',
    ].join(','),
  );
  junk.forEach((el) => el.remove());

  // Leere Container nach dem Entfernen aufräumen
  template.content.querySelectorAll('div, span, section, p').forEach((el) => {
    if (!el.textContent?.trim() && el.children.length === 0) {
      el.remove();
    }
  });

  const container = document.createElement('div');
  container.appendChild(template.content.cloneNode(true));
  return container.innerHTML;
}

/** Tooltip-Lesart: immer modernes s, ohne ſ. */
export function toModernS(text: string): string {
  return text.replace(/ſ/g, 's');
}

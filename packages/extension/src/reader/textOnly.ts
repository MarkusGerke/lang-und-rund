/** Entfernt Bilder, Videos, Embeds (Tweets usw.) und typischen Ballast aus Readability-HTML. */
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
      // Social-/Medien-Embeds
      'blockquote.twitter-tweet',
      'blockquote.instagram-media',
      'blockquote.reddit-embed-bq',
      'blockquote.bluesky-embed',
      'amp-img',
      'amp-video',
      'amp-iframe',
      'amp-twitter',
      'amp-youtube',
      'amp-instagram',
      'amp-facebook',
      'amp-tiktok',
      'amp-reddit',
      '[data-tweet-id]',
      '[data-instagram-id]',
      '[class*="twitter-tweet"]',
      '[class*="instagram-media"]',
      '[class*="tiktok-embed"]',
      '[class*="fb-post"]',
      '[class*="fb-video"]',
      '[class*="youtube-embed"]',
      '[class*="yt-embed"]',
      '[class*="mastodon-embed"]',
      '[class*="bluesky-embed"]',
      '[class*="linkedin-embed"]',
      '[class*="reddit-embed"]',
      '[class*="threads-embed"]',
    ].join(','),
  );
  junk.forEach((el) => el.remove());

  // Embed-Wrapper ohne sinnvollen Fließtext (z. B. Script-Platzhalter um Tweets)
  template.content.querySelectorAll('div, section, article, aside').forEach((el) => {
    const cls = typeof el.className === 'string' ? el.className.toLowerCase() : '';
    const isEmbedShell =
      /\b(embed|oembed|tweet|twitter|instagram|tiktok|youtube|fb-|facebook|mastodon|bluesky|linkedin)\b/.test(
        cls,
      );
    if (!isEmbedShell) return;
    const text = el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    // Kurzer Resttext = typisch Widget-Hülle, kein Artikelabsatz
    if (text.length < 280) el.remove();
  });

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

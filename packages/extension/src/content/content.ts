import { Readability } from '@mozilla/readability';
import { detectGerman } from '@langs/core';
import type { ExtractResponse, RuntimeMessage } from '../shared/messages';

const globalFlag = globalThis as typeof globalThis & {
  __langsContentInstalled?: boolean;
};

function pageLang(): string | null {
  const htmlLang = document.documentElement.getAttribute('lang');
  if (htmlLang) return htmlLang;
  const meta = document.querySelector('meta[http-equiv="content-language" i]');
  return meta?.getAttribute('content') ?? null;
}

function extractArticle(forceGerman: boolean | null): ExtractResponse {
  const clone = document.cloneNode(true) as Document;
  const reader = new Readability(clone);
  const parsed = reader.parse();

  if (!parsed?.content || !parsed.textContent?.trim()) {
    return {
      ok: false,
      error: 'no-article',
      message: 'Kein lesbarer Artikel gefunden',
    };
  }

  const lang = pageLang();
  const detection = detectGerman({
    lang,
    text: parsed.textContent,
    force: forceGerman,
  });

  if (!detection.isGerman) {
    return {
      ok: false,
      error: 'not-german',
      message:
        'Seite scheint nicht deutsch zu sein (Override in den Optionen möglich)',
      score: detection.score,
    };
  }

  return {
    ok: true,
    article: {
      title: parsed.title || document.title || 'Ohne Titel',
      byline: parsed.byline || '',
      siteName: parsed.siteName || location.hostname,
      sourceUrl: location.href,
      lang,
      contentHtml: parsed.content,
      textContent: parsed.textContent,
      excerpt: parsed.excerpt || '',
    },
  };
}

if (!globalFlag.__langsContentInstalled) {
  globalFlag.__langsContentInstalled = true;
  chrome.runtime.onMessage.addListener(
    (message: RuntimeMessage, _sender, sendResponse) => {
      if (message.type !== 'EXTRACT_ARTICLE') return false;
      try {
        sendResponse(extractArticle(message.forceGerman ?? null));
      } catch (err) {
        const fail: ExtractResponse = {
          ok: false,
          error: 'unsupported',
          message: err instanceof Error ? err.message : 'Unbekannter Fehler',
        };
        sendResponse(fail);
      }
      return true;
    },
  );
}

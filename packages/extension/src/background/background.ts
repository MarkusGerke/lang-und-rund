import type { ExtractResponse, RuntimeMessage } from '../shared/messages';
import type { ArticlePayload } from '../shared/types';
import { ARTICLE_KEY_PREFIX } from '../shared/types';
import { loadSettings } from '../shared/settings';

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true;
  return /^(chrome|chrome-extension|moz-extension|about|edge|brave|devtools):/i.test(
    url,
  );
}

async function extractFromTab(
  tabId: number,
  forceGerman: boolean | null,
): Promise<ExtractResponse> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });

  return await chrome.tabs.sendMessage(tabId, {
    type: 'EXTRACT_ARTICLE',
    forceGerman,
  } satisfies RuntimeMessage);
}

async function openReader(article: ArticlePayload): Promise<void> {
  const key = `${ARTICLE_KEY_PREFIX}${article.id}`;
  await chrome.storage.session.set({
    [key]: article,
    'langs-latest': article.id,
  });
  const url = chrome.runtime.getURL(
    `reader.html?id=${encodeURIComponent(article.id)}`,
  );
  await chrome.tabs.create({ url });
}

async function flashBadge(tabId: number, title: string): Promise<void> {
  await chrome.action.setBadgeText({ text: '!', tabId });
  await chrome.action.setBadgeBackgroundColor({ color: '#8b4513', tabId });
  await chrome.action.setTitle({ title: `lang & rund: ${title}`, tabId });
  setTimeout(() => {
    void chrome.action.setBadgeText({ text: '', tabId });
  }, 4000);
}

async function runOpenFlow(): Promise<void> {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  if (isRestrictedUrl(tab.url)) {
    await flashBadge(tab.id, 'Diese Seite kann nicht gelesen werden');
    return;
  }

  const settings = await loadSettings();

  let response: ExtractResponse;
  try {
    response = await extractFromTab(tab.id, settings.forceGerman);
  } catch (err) {
    console.error('[lang & rund] Extraktion fehlgeschlagen', err);
    await flashBadge(tab.id, 'Extraktion fehlgeschlagen');
    return;
  }

  if (!response.ok) {
    await flashBadge(tab.id, response.message);
    return;
  }

  await chrome.action.setBadgeText({ text: '', tabId: tab.id });

  const article: ArticlePayload = {
    ...response.article,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  await openReader(article);
}

chrome.action.onClicked.addListener(() => {
  void runOpenFlow();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-reader') void runOpenFlow();
});

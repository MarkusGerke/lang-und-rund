/** Öffentliche Links & Markenname — bei Bedarf anpassen. */
export const BRAND_NAME = 'lang & rund';
export const BRAND_NAME_SHORT = 'lang & rund';

/** App-Version (mit Manifest abgleichen). */
export const APP_VERSION = '1.5.1';

/** macOS/iOS-Host: Fenstertitel ohne Artikel. */
export const WINDOW_TITLE_CLAIM =
  'lang & rund — Ein Lesemodus und Editor für Fraktur- und Kurrent-Enthusiasten';

/**
 * Öffentliches GitHub-Repo. `null`, solange es noch nicht existiert.
 */
export const REPO_URL: string | null =
  'https://github.com/MarkusGerke/lang-und-rund';

export const REPO_ISSUES_URL = REPO_URL ? `${REPO_URL}/issues/new` : null;

/** Fehlerberichte ohne GitHub-Konto. */
export const FEEDBACK_EMAIL = 'fehler@langundrund.de';

/** Wort-Startseite (Extension; später auch Domain). */
export const START_PAGE_PATH = 'start.html';

/** X / Twitter */
export const X_HANDLE = 'MarkusGerke';
export const X_URL = `https://x.com/${X_HANDLE}`;

/** Impressum (Extension-interne Seite). */
export const IMPRESSUM_PATH = 'impressum.html';

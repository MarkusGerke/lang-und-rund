(function () {
  'use strict';

  /** Mit packages/extension/src/shared/links.ts und package.json abgleichen. */
  var SITE = {
    appVersion: '__APP_VERSION__',
    brand: 'lang & rund',
    repoUrl: 'https://github.com/MarkusGerke/lang-und-rund',
    contactEmail: 'post@langundrund.de',
    xHandle: 'MarkusGerke',
    xUrl: 'https://x.com/MarkusGerke',
    rulesDisclaimer:
      'Das Regelwerk für langes und rundes s wurde KI-gestützt erzeugt; es kann zu Fehlern kommen.',
    editorHref: '/editor/',
    iosAppStoreUrl: null,
    macAppStoreUrl: null,
  };

  var THEMES = [
    'sepia',
    'lagune',
    'salbei',
    'flieder',
    'koralle',
    'tiefsee',
    'wald',
    'honig',
    'pflaume',
    'himmel',
    'rost',
    'schiefer',
    'rose',
    'graphite',
    'dark',
  ];

  var THEME_KEY = 'langs-landing-theme';

  /** Apple-Logo (klassische Silhouette, fill via currentColor). */
  var APPLE_SVG =
    '<svg class="apple-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 814 1000" aria-hidden="true">' +
    '<path fill="currentColor" d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-163-39.5c-77.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.2 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.9 32.4-55.9 83.6-55.9 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 140.3-71.3z"/>' +
    '</svg>';

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function editorHref() {
    if (location.protocol === 'file:') return 'editor/index.html';
    return SITE.editorHref;
  }

  function homeHref() {
    if (location.protocol === 'file:') return 'index.html';
    return './';
  }

  function pickTheme() {
    try {
      var stored = sessionStorage.getItem(THEME_KEY);
      if (stored && THEMES.indexOf(stored) >= 0) return stored;
    } catch (e) {
      /* ignore */
    }
    var t = THEMES[Math.floor(Math.random() * THEMES.length)];
    try {
      sessionStorage.setItem(THEME_KEY, t);
    } catch (e2) {
      /* ignore */
    }
    return t;
  }

  function applyTheme(root) {
    var theme = pickTheme();
    var base = root.className.replace(/\btheme-[\w-]+\b/g, '').trim();
    root.className = (base + ' theme-' + theme).trim();
  }

  function xLinkHtml() {
    return (
      '<a href="' +
      esc(SITE.xUrl) +
      '" target="_blank" rel="noopener">' +
      '<span class="x-logo" aria-hidden="true">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">' +
      '<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.259 5.698L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>' +
      '</svg></span><span class="x-handle">' +
      esc(SITE.xHandle) +
      '</span></a>'
    );
  }

  function renderFooter() {
    var parts = [];
    if (SITE.repoUrl) {
      parts.push(
        '<a href="' +
          esc(SITE.repoUrl) +
          '" target="_blank" rel="noopener">Github</a>',
      );
    }
    parts.push('<a href="impressum.html">Impressum</a>');
    parts.push('<a href="datenschutz.html">Datenschutz</a>');
    var subject = encodeURIComponent('[' + SITE.brand + '] Feedback');
    var body = encodeURIComponent(
      'Hallo,\n\nich möchte Folgendes melden:\n\n\n\n— gemeldet via ' +
        SITE.brand +
        ' v' +
        SITE.appVersion +
        '\n',
    );
    parts.push(
      '<a href="mailto:' +
        esc(SITE.contactEmail) +
        '?subject=' +
        subject +
        '&body=' +
        body +
        '">Fehler melden</a>',
    );
    parts.push(xLinkHtml());
    parts.push(
      '<span class="app-version" title="' +
        esc(SITE.brand) +
        '">v' +
        esc(SITE.appVersion) +
        '</span>',
    );
    return (
      '<footer class="app-footer">' +
      '<div class="app-footer-links">' +
      parts.join('<span class="app-footer-sep" aria-hidden="true">·</span>') +
      '</div>' +
      '<p class="app-footer-disclaimer">' +
      esc(SITE.rulesDisclaimer) +
      '</p>' +
      '</footer>'
    );
  }

  function renderHeader() {
    return (
      '<header class="landing-toolbar" role="banner">' +
      '<a class="landing-logo-link" href="' +
      esc(homeHref()) +
      '" aria-label="' +
      esc(SITE.brand) +
      '">' +
      '<span class="landing-toolbar-logo" role="img" aria-hidden="true"></span>' +
      '</a></header>'
    );
  }

  function storeButton(label, url, id) {
    if (url) {
      return (
        '<a class="btn btn-store" id="' +
        id +
        '" href="' +
        esc(url) +
        '" target="_blank" rel="noopener">' +
        APPLE_SVG +
        '<span>' +
        esc(label) +
        '</span></a>'
      );
    }
    return (
      '<span class="btn btn-store is-disabled" id="' +
      id +
      '" title="Bald im App Store" aria-disabled="true">' +
      APPLE_SVG +
      '<span>' +
      esc(label) +
      '</span></span>'
    );
  }

  function init() {
    var root = document.getElementById('landing-root');
    if (!root) return;

    applyTheme(root);

    var headerSlot = document.getElementById('landing-header');
    if (headerSlot) {
      headerSlot.outerHTML = renderHeader();
    }

    var footerSlot = document.getElementById('landing-footer');
    if (footerSlot) {
      footerSlot.outerHTML = renderFooter();
    }

    var cta = document.getElementById('landing-cta-row');
    if (cta) {
      cta.innerHTML =
        storeButton('Bald im App Store', SITE.iosAppStoreUrl, 'store-ios') +
        storeButton('Bald im Mac App Store', SITE.macAppStoreUrl, 'store-mac') +
        '<a class="btn btn-secondary" href="' +
        esc(editorHref()) +
        '">Im Browser öffnen</a>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

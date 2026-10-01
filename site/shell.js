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

  var APPLE_SVG =
    '<svg class="apple-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.47-.12-1.08.507-2.25 1.23-3.04.856-.96 2.242-1.68 2.934-1.51zm2.403 15.73c-.612 1.32-1.35 2.58-2.43 2.61-1.03.04-1.35-.67-2.52-.67-1.19 0-1.55.65-2.51.69-1.01.05-1.78-1.08-2.39-2.4-1.3-2.79-1.29-6.05.57-7.75.8-.74 1.87-1.17 2.93-1.13 1.15.05 1.67.67 2.52.67.84 0 1.43-.68 2.55-.65 1.08.04 2.01.58 2.61 1.49-2.3 1.37-1.93 4.93.38 5.87-.47 1.22-.9 2.44-1.53 3.74z"/>' +
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

  function renderHeader(active) {
    var ed = editorHref();
    return (
      '<header class="landing-toolbar" role="banner">' +
      '<a class="landing-brand" href="./">lang &amp; rund</a>' +
      '<nav class="landing-nav" aria-label="Seitennavigation">' +
      '<a href="' +
      esc(ed) +
      '"' +
      (active === 'editor' ? ' class="is-active"' : '') +
      '>Editor</a>' +
      '<a href="impressum.html"' +
      (active === 'impressum' ? ' class="is-active"' : '') +
      '>Impressum</a>' +
      '<a href="datenschutz.html"' +
      (active === 'datenschutz' ? ' class="is-active"' : '') +
      '>Datenschutz</a>' +
      '</nav></header>'
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
      '" title="Demnächst im App Store" aria-disabled="true">' +
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
    var active = root.getAttribute('data-nav-active') || '';
    if (headerSlot) {
      headerSlot.outerHTML = renderHeader(active);
    }

    var footerSlot = document.getElementById('landing-footer');
    if (footerSlot) {
      footerSlot.outerHTML = renderFooter();
    }

    var cta = document.getElementById('landing-cta-row');
    if (cta) {
      cta.innerHTML =
        storeButton('App Store', SITE.iosAppStoreUrl, 'store-ios') +
        storeButton('Mac App Store', SITE.macAppStoreUrl, 'store-mac') +
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

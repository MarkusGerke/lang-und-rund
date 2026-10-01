# Website langundrund.de (Landing)

Startseite und rechtliche Unterseiten teilen **dieselbe Shell**:

- `themes.css` — Farbthemen wie im Editor (zufällig pro Sitzung)
- `shell.css` / `shell.js` — zentriertes App-Logo (wie Editor), Footer, Store-Buttons
- `index.html`, `impressum.html`, `datenschutz.html`

Neue Root-Unterseiten: gleiche `<head>`-Assets, `#landing-root`, `#landing-header`, `#landing-footer`, `data-nav-active` setzen, Inhalt in `legal-main`.

Deploy: `.github/workflows/deploy.yml` kopiert `site-dist/`.

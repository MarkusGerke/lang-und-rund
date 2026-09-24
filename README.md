# lang & rund — langes & rundes s

Monorepo für historische deutsche ſ/s-Schreibung:

| Paket | Beschreibung |
|-------|----------------|
| `@langs/core` | Konvertierungsengine (`convertLongS`) + Deutsch-Erkennung |
| `@langs/editor` | Lokaler Texteditor mit Live-Vorschau |
| `@langs/extension` | Browser-Erweiterung **lang & rund** (Chrome, Brave, Firefox; Safari-Skeleton) |

## Voraussetzungen

- Node.js ≥ 20
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)

## Setup

```bash
pnpm install
pnpm test
pnpm build
```

### Editor

```bash
pnpm dev:editor
# http://localhost:4317
```

### Erweiterung bauen

```bash
pnpm build:extension
```

Artefakte:

- `packages/extension/dist-chrome/` — Chrome / Brave (Developer Mode → „Entpackte Erweiterung laden“)
- `packages/extension/dist-firefox/` — Firefox (`about:debugging` → „Temporäres Add-on laden“ → `manifest.json`)

**Bedienung:** Symbol klicken oder `Alt+Shift+S` → Lesemodus mit ſ/s.

**Optionen:** Rechtsklick aufs Symbol → Optionen (Darstellung, Thema, Sprach-Override).

## V1-Funktionsumfang

- Readability-Lesemodus (Text, Bilder, Links)
- Deutsche Seiten (`lang` + Heuristik), Override in Optionen
- Antiqua / Fraktur / Kurrent (letzte Wahl wird gemerkt)
- Toggle Original ↔ konvertiert
- Mehrdeutigkeiten wie im Editor (Tooltip)
- Sideload; Stores und Safari-Release später

## Lizenzen

- Code: MIT
- UnifrakturMaguntia: SIL OFL 1.1
- Deutsche Kurrent (Hans J. Zinken): Freeware, siehe `packages/extension/public/fonts/KURRENT-LICENSE.txt`

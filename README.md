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

## Datenschutz

Die Erweiterung arbeitet **lokal im Browser**:

- Extraktion, ſ/s-Konvertierung und Lesemodus laufen auf dem Gerät.
- Schriften (Fraktur/Kurrent) sind **eingebettet**; es erfolgt **kein** Nachladen von Google Fonts oder anderen CDNs.
- Es gibt **keine** Telemetrie, Tracking-Pixel oder eigenen Server der Erweiterung.
- Seiteninhalte werden **nicht** an Dritte übermittelt.

Optional / nur bei Nutzeraktion:

- Einstellungen können über die Sync-Funktion des Browsers (`storage.sync`) mit dem Browserkonto synchronisiert werden — das ist eine Browser-Funktion, kein eigener Cloud-Dienst von lang & rund.
- Links (Repo, Impressum, Fehler melden) öffnen externe Seiten erst nach einem Klick.

Damit entstehen durch den normalen Betrieb der Erweiterung **keine zusätzlichen Datenschutzbedenken** durch Font-CDNs oder Backend-Telemetrie.

## Lizenzen / Drittanbieter

- **Code** (dieses Repository): MIT — siehe `LICENSE`
- **UnifrakturMaguntia** (Fraktur-Font): SIL Open Font License 1.1 — vollständiger Text in `packages/extension/public/fonts/FRAKTUR-LICENSE.txt`
- **Deutsche Kurrent** (Hans J. Zinken): Freeware (privat & geschäftlich, Weitergabe gestattet) — `packages/extension/public/fonts/KURRENT-LICENSE.txt` · https://zinken.net/Fonts/Kurrent.html
- **@mozilla/readability**: Apache License 2.0 — `packages/extension/public/READABILITY-LICENSE.md`

Die Fraktur- und Kurrent-Schriftdateien werden **lokal in der Erweiterung mitgeliefert** (`public/fonts/*.ttf`) und nicht von Google Fonts oder anderen CDNs nachgeladen.

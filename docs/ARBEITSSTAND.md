# lang & rund — Arbeitsstand & Architektur

Stand: 2025-09-25  
Repo: https://github.com/MarkusGerke/lang-und-rund

Dieses Dokument hält fest, was gebaut wurde und wie man weiterarbeitet — damit nichts verloren geht.

---

## Produkt

**lang & rund** wandelt modernen deutschen Text in die historische ſ/s-Orthographie um (Antiqua / Fraktur / Kurrent) und erklärt Wörter im Lern-Drawer.

| Oberfläche | Rolle |
|------------|--------|
| Browser-Extension (Chrome / Firefox / Safari) | Webseite → Lesemodus |
| macOS-/iOS-**App** (Host) | Text tippen/einfügen → gleiche Analyse, live |
| Safari-**Extension** | in Safari aktivieren |

---

## Monorepo-Struktur

```
packages/core/          # ſ/s-Konvertierung, Ambiguitäten
packages/editor/        # (falls vorhanden)
packages/extension/     # Extension + Safari-App-UI
  src/reader/           # Lesemodus (UI + Live-Host-Logik)
  src/learning/         # Drawer, Pitfalls
  src/shared/           # Settings, Polyfill, Types
  scripts/build.mjs     # Extension-Build (Vite MPA, base: ./)
  scripts/build-app.mjs # Host-App IIFE → dist-app/
  scripts/build-safari.sh
  safari/app/ViewController.swift   # Vorlage für Xcode Host
  safari/xcode/         # generiertes Xcode-Projekt
  safari/README.md      # Kurz-Anleitung Signing/Test
```

---

## Wichtige UX-Regeln (Host-App)

1. **Kein Moduswechsel** Bearbeiten ↔ Analysieren.
2. **Eine Schreibfläche**: unsichtbares Textfeld über der Analyse (`#editor-body` transparent, `#content-host` darunter sichtbar).
3. **Live-Analyse** bei jedem Tippen.
4. **Live-Drawer**: immer das Wort **am Cursor** (beim Tippen und bei Cursor-Bewegung); rechts Erklärung im geöffneten Drawer.
5. **Wörter anklicken** öffnet ebenfalls den Drawer für genau dieses Vorkommen.
6. **Einstellungen** rechts in der Toolbar (Desktop immer sichtbar; mobil hinter Akkordeon „Einstellungen“).
7. Ambige ſ/s-Stellen: Hintergrund wie Esc-Chip + **gestrichelte** Unterstreichung.

---

## Warum die App früher „ohne UI“ wirkte

- ES-Module und absolute Pfade (`/assets/…`) laden unter `file://` in **WKWebView nicht**.
- Lösung: Host-UI als klassisches Bundle:
  - `Shared (App)/Resources/Base.lproj/Main.html`
  - `Style.css` + `Script.js` (**IIFE**, keine `type="module"`)
  - Fonts als **data-URI** in `Style.css` (keine extra Xcode-Font-Ressourcen)
- `ViewController.swift` lädt `Main.html?host=1` aus **Bundle.main**, nicht aus dem Appex.

---

## Build & Sync

```bash
# Alles bauen (Extension + Host-App-UI)
pnpm --filter @langs/extension build

# Safari-Xcode-Projekt neu erzeugen (nach großen Änderungen)
./packages/extension/scripts/build-safari.sh
```

`pnpm build` im Extension-Paket macht:

1. `build.mjs` → `dist/` + `dist-chrome/` / `dist-firefox/`
2. `build-app.mjs` → `dist-app/` (Main.html, Style.css, Script.js)
3. `pack.mjs` → Browser-Pakete

`build-safari.sh` zusätzlich:

- `safari-web-extension-converter` (über `/tmp` wegen Desktop-TCC)
- kopiert `dist-app/*` nach `Shared (App)/Resources/`
- setzt `ViewController.swift`
- macht macOS-Fenster skalierbar (`resizable`)

Nach UI-Änderungen für schnellen Test oft reicht:

```bash
pnpm --filter @langs/extension build
cp packages/extension/dist-app/Style.css \
   packages/extension/dist-app/Script.js \
   packages/extension/safari/xcode/Shared\ \(App\)/Resources/
cp packages/extension/dist-app/Base.lproj/Main.html \
   packages/extension/safari/xcode/Shared\ \(App\)/Resources/Base.lproj/
```

Dann in Xcode: **Clean (⇧⌘K) → Run** Scheme **LangUndRund** (ohne „Extension“).

---

## Xcode: die 4 Targets

| Target | Bedeutung |
|--------|-----------|
| LangUndRund (macOS) | Host-App Mac |
| LangUndRund (iOS) | Host-App iPhone/iPad |
| … Extension (macOS) | Safari-Extension Mac |
| … Extension (iOS) | Safari-Extension iOS |

Zum Testen der **App**: Scheme ohne „Extension“.  
Zum Testen der **Extension**: App einmal starten → Safari → Unsigned Extensions → aktivieren.

### Xcode-Lizenz (einmalig, Admin)

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

Prüfen ohne Admin: `xcodebuild -license check` (nicht `-checkFirstLaunchStatus`).

---

## Safari Extension aktivieren (macOS)

1. App aus Xcode starten  
2. Safari → Einstellungen → Erweitert → Entwicklermenü  
3. Entwickler → Unsigned-Erweiterungen zulassen  
4. Einstellungen → Erweiterungen → lang & rund aktivieren  

---

## Host-Live-Drawer (Technik)

Datei: `packages/extension/src/reader/reader.ts`

- Der Drawer folgt **immer dem Wort am Cursor** (`wordAtCursor`).
- Bei Tippen: Text neu analysieren + Drawer auf Cursor-Wort.
- Bei Cursor-Bewegung (Pfeiltasten, Klick, Selection): nur Drawer wechseln, ohne Voll-Neuanalyse.
- Mehrfach vorkommende Wörter: Vorkommen-Index (welches „der“), damit das richtige Span getroffen wird.
- Klick auf Analyse-Wort: Hit-Test durch transparentes Textfeld (`elementFromPoint`).
- Esc / Drawer-Schließen bzw. leerer Text: Drawer zu.

---

## Git / GitHub

- Remote: `origin` → `MarkusGerke/lang-und-rund`  
- `main` war zuletzt mit Datenschutz/Lizenzen gepusht  
- Safari-Skripte / `xcode/` / `dist-app` ggf. noch nicht vollständig committed — vor Push klären, ob generiertes `safari/xcode/` versioniert werden soll (groß, regenerierbar) oder nur Skripte + `safari/app/`

Empfohlen zu versionieren:

- `scripts/build-*.sh|mjs`
- `safari/app/ViewController.swift`
- `safari/README.md`
- diese Datei `docs/ARBEITSSTAND.md`
- Quellcode unter `src/`

Optional / regenerierbar:

- `safari/xcode/` (Converter-Output)
- `dist/`, `dist-chrome/`, `dist-app/`

---

## Offene / nächste Punkte

- [ ] Feintuning: Cursor/Ausrichtung Textfeld vs. Fraktur/Kurrent (Overlay)
- [ ] iPad/iPhone: Live-Drawer + Tastatur testen
- [ ] Impressum in App-Bundle (pbxproj), falls Footer-Link lokal braucht
- [ ] Commit + Push der Safari-/Host-Änderungen (ohne Secrets)
- [ ] App-Store / Signing / Bundle-IDs für Release

---

## Kurz-Checkliste nach jeder UI-Änderung

1. `pnpm --filter @langs/extension build`  
2. `dist-app` → `Shared (App)/Resources` kopieren (oder `build-safari.sh`)  
3. Xcode Clean + Run  
4. Tippen → Analyse live? Leerzeichen → Drawer mit Wort? Einstellungen sichtbar?  
5. Diesen Arbeitsstand bei Bedarf aktualisieren  

# lang & rund — Safari (macOS, iOS, iPadOS)

Ausführlicher Arbeitsstand (Build, Host-UI, bekannte Fallen):  
→ [`docs/ARBEITSSTAND.md`](../../../docs/ARBEITSSTAND.md)

Safari-Pakete brauchen **Xcode**. Die Xcode-Lizenz muss **einmal von einem Admin** akzeptiert werden; danach kann jeder Nutzer ohne `sudo` bauen.

## Einmalig (nur Admin)

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

## Bauen

Aus dem Repo-Root (erzeugt **macOS + iOS/iPadOS**):

```bash
./packages/extension/scripts/build-safari.sh
open packages/extension/safari/xcode/LangUndRund.xcodeproj
```

## In Xcode: die 4 Targets

| Target | Bedeutung |
|--------|-----------|
| **LangUndRund** (macOS) | **App** für den Mac — Text einfügen & analysieren |
| **LangUndRund** (iOS) | **App** für iPhone/iPad — dasselbe |
| **… Extension** (macOS) | Safari-**Erweiterung** am Mac |
| **… Extension** (iOS) | Safari-**Erweiterung** auf iPhone/iPad |

Zum Testen der App (Paste): Scheme **LangUndRund** (ohne „Extension“) ▶ Run.  
Zum Testen der Erweiterung: App einmal starten, dann in Safari aktivieren.

## In Xcode: Signing

1. Links das Projekt **LangUndRund** wählen  
2. Targets nacheinander: **LangUndRund** und **LangUndRund Extension** (ggf. auch die iOS-Varianten)  
3. Tab **Signing & Capabilities** → **Team** wählen (Apple-ID / Entwicklerteam)  
4. Bei Bedarf „Automatically manage signing“ anlassen  

Ohne Team lässt sich die App nicht auf Gerät/Simulator sinnvoll starten.

## macOS testen

1. Scheme oben: **LangUndRund** (macOS)  
2. ▶ Run (App startet kurz)  
3. Safari → Einstellungen → Erweitert → **Menü „Entwickler“ anzeigen**  
4. Menü **Entwickler** → **Unsigned Extensions zulassen**  
5. Safari → Einstellungen → Erweiterungen → **lang & rund** aktivieren  

## iPhone / iPad testen

1. Scheme: **LangUndRund** (iOS)  
2. Ziel: Simulator (iPhone/iPad) oder verbundenes Gerät  
3. ▶ Run — die Host-App installiert sich und führt zur Safari-Einstellung für die Extension  
4. Auf dem Gerät/Simulator: **Einstellungen → Safari → Erweiterungen** → **lang & rund** einschalten  
5. In Safari eine Seite öffnen und die Extension nutzen  

iPadOS nutzt dasselbe iOS-Target (Simulator „iPad“ oder echtes iPad).

## Apple Watch

Separate Companion-App (SwiftUI), Daten vorgebacken aus der Startwort-Liste:

```bash
pnpm --filter @langs/extension bake:watch
cd packages/extension/safari/watch && xcodegen generate
open LangUndRundWatch.xcodeproj
```

Details: [`watch/README.md`](watch/README.md). Wird auch von `build-safari.sh` mit erzeugt.

## App Store / TestFlight

Später: Bundle-IDs und Signing mit dem richtigen Team, Archive in Xcode, Upload über Organizer. Für die lokale Entwicklung reicht Personal Team / bezahltes Developer-Programm.

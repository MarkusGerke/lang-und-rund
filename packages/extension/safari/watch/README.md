# lang & rund — Apple Watch

## Echte Watch: so installieren (wichtig)

Der Button **Installieren** in der iPhone-App „Watch“ funktioniert bei **Xcode-/Entwicklungsbuilds** oft nicht: Ladekreis → danach wieder „Installieren“. Das ist ein bekanntes Verhalten, kein Bug in der Wort-Logik.

**Richtiger Weg:**

1. Watch: Entwicklermodus an (Einstellungen → Datenschutz & Sicherheit).
2. Xcode: beide Targets → Signing → **Team** (am besten bezahltes Developer-Programm; Personal Team scheitert bei Watch oft).
3. Scheme **LangUndRundWatch**, Ziel = **iPhone**.
4. ▶ Run — die Begleit-App und die Watch-App kommen über Xcode.
5. Auf der Watch im App-Raster nach **lang & rund** suchen (nicht nur in der iPhone-Watch-App).

Kontrolle: Xcode → Window → Devices and Simulators → deine Watch → Installed Apps.

## Bauen

```bash
pnpm --filter @langs/extension bake:watch
cd packages/extension/safari/watch && xcodegen generate
open LangUndRundWatch.xcodeproj
```

`bake:watch` schreibt auch `Sources/ClockNumberWords.generated.swift` (0…59 mit ſ/s über `convertLongS`).

## Verhalten

### Fraktur-Ziffernblatt (Default)
- Live-Zeit als Wörter; **horizontal wischen** wechselt **Fraktur ↔ Sütterlin**
- **UHR** dazwischen (Sans, gesperrt)
- 24h, exakte Minute; bei `:00` nur Stunde + UHR
- Gesprochen: Stunde **ein** Uhr / Minute **eins** (`1:01` → ein / UHR / eins); sonst Standard-Kardinalzahlen (`sechzehn`, `einundzwanzig`, …)
- Komposita nach `und` umgebrochen; Sütterlin mit Font-Encoding (`ſ`→`s`, Schluss-s→`#`)
- **Tippen:** Farben — System-Palette + RGB-Slider (Digital Crown) für Schrift und Hintergrund (wird gemerkt)
- Langer Druck: Wortlernen
- Always-On: gleiches Layout, gedimmt

### Wortlernen
- Fraktur / Kurrent / Sütterlin per Horizontal-Swipe
- Tap aufs Wort = nächstes Wort
- Toolbar **Uhr** zurück zum Ziffernblatt

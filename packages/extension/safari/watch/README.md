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

## Verhalten (v1)

- Fraktur/Kurrent per Horizontal-Swipe, Antiqua darunter, Kurz-Hinweise (`confusion`)
- Tap aufs Wort = nächstes Wort

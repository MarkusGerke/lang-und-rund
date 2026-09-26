# Pflichtprüfung: ſ-Regeln im Host-Editor

Diese Datei ist die **verbindliche Checkliste**, bevor Host-/Reader-Änderungen als fertig gelten.
Sie verhindert die Regression: „Editor zeigt wieder modernes s statt ſ/#“.

## Produktkontrakt (nicht verhandelbar ohne Freigabe)

| Oberfläche | Sichtbarer Text | `matchSourceVisual` |
| --- | --- | --- |
| Host **Bearbeiten** (`host-edit`) | **mit** ſ-Regeln (Fraktur: ſ; Kurrent/Sütterlin: s/#) | **aus** / nicht setzen |
| Host **Lesen** (`host-read`, iOS „Fertig“) | mit ſ-Regeln | aus |
| Extension-Reader | mit ſ-Regeln | aus |

- `#content-host` = sichtbare, konvertierte Schicht.
- `#editor-body` = Eingabe + Caret; Textfarbe **transparent**, damit die Schicht darunter zählt.
- `data-converted` bleibt die Lern-Form für den Drawer, unabhängig von der Glyphe.

## Verbotene Änderungen

1. In `.host-edit` `#content-host` mit `opacity: 0` (oder `visibility: hidden`) verstecken.
2. In `.host-edit` `#editor-body` mit `color: var(--reader-text)` (oder sonstiger sichtbarer Textfarbe) den modernen Tipptext zeigen.
3. `matchSourceVisual: true` im Host-Edit „wegen Caret“, ohne explizite Produktfreigabe.
4. Konvertierung nur im Lesemodus, im Edit modern belassen.

Caret-Versatz in Fraktur/Kurrent/Sütterlin beim Tippen ist **akzeptiert**.

## Automatischer Gate

Beim Extension-Build läuft `scripts/check-host-s-regeln.mjs`.
Er **bricht den Build ab**, wenn die verbotenen CSS-/TS-Muster wieder auftauchen.

## Manuelle Kurzprüfung (nach Host-/Reader-Touch)

1. Host öffnen (macOS oder `reader.html?host=1`).
2. Schriftart Fraktur → tippen/einfügen: `dass` → sichtbares ſſ/ſs-Muster (nicht `dass` in Antiqua-s).
3. Schriftart Kurrent oder Sütterlin → Wort mit Schluss-s → sichtbares `#` für rundes s.
4. iOS: „Fertig“ → Lesen zeigt weiter Konvertierung; Drawer öffnet an markierten Wörtern.
5. `#content-host` in den DevTools: berechnet `opacity` ≠ 0; `#editor-body` Textfarbe transparent.

## Wenn der Test rot ist

- CSS: `.host-edit`-Regeln in `src/reader/reader.css` gegen diese Datei und die Cursor-Rule prüfen.
- TS: `render()` / `convertHtmlFragment(..., hostVisual)` — `matchSourceVisual` darf im Host-Edit nicht an sein.
- Nicht „quick-fixen“, indem der Editor wieder modernen Text zeigt.

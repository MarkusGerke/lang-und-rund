# Goldkorpus ſ/s

`gold-corpus.jsonl` — eine JSON-Zeile pro Wort.

| Feld | Bedeutung |
| --- | --- |
| `input` | modernes Wort |
| `suggested` | KI/Heuristik-Vorschlag (oder Exception) |
| `status` | `suggested` (Review offen) / `confirmed` (geprüft) |
| `ambiguous` | Heuristik markiert Fuge vor st/sp |
| `note` | Kurznotiz |
| `ruleSource` | Typografie.info-Hauptregel + Heuristik |

## Review-Workflow

1. Korpus neu erzeugen: `pnpm --filter @langs/core gold:generate`
2. Abweichungen prüfen (z. B. `suggested` vs. eigene Erwartung)
3. Korrekturen als `confirmed` in `src/exceptions.ts` eintragen
4. Optional Zeile in der JSONL auf `status: confirmed` setzen
5. `pnpm --filter @langs/core test` — confirmed + Fehlerrate &lt; 0,5 %

Ziel v1: &lt;0,5 % Fehler auf confirmed/Gold und Genitiv/Fugen vor st/sp als Mehrdeutigkeit.

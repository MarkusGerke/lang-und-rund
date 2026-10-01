/**
 * Erzeugt testdata/gold-corpus.jsonl (~2000+ Einträge, status=suggested).
 * Aufruf: GOLD_GENERATE=1 pnpm exec vitest run src/goldCorpus.generate.test.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';
import { convertLongS } from './convertLongS';
import { EXCEPTION_LEXICON } from './exceptions';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'testdata', 'gold-corpus.jsonl');

/** Häufige Stämme/Wörter mit s (Alltag + Kompositum-fähig). */
const ROOTS = [
  'Haus', 'Strasse', 'Straße', 'Wasser', 'Masse', 'lassen', 'müssen', 'wissen',
  'lesen', 'reisen', 'heissen', 'heißen', 'gross', 'groß', 'dass', 'was', 'es',
  'aus', 'bis', 'des', 'das', 'als', 'uns', 'eins', 'zwei', 'drei', 'erst',
  'Angst', 'Lust', 'List', 'Nest', 'Pest', 'Rest', 'West', 'Ost', 'Fest',
  'Gast', 'Last', 'Ast', 'Kost', 'Post', 'Most', 'Frost', 'Trost',
  'Stein', 'Stock', 'Stoff', 'Strom', 'Strasse', 'Stube', 'Stück', 'Stelle',
  'Stimme', 'Stärke', 'Sturm', 'Stolz', 'Stadt', 'Staat', 'Stand', 'Stamm',
  'Spiegel', 'Spiel', 'Spitze', 'Sprache', 'Spross', 'Sport', 'Spaß',
  'Schule', 'Schiff', 'Schatten', 'Schnee', 'Schloss', 'Schluss', 'Schmerz',
  'Mensch', 'Wunsch', 'Fisch', 'Tisch', 'Fleisch', 'Frisch', 'Deutsch',
  'Bildung', 'Forschung', 'Führung', 'Nahrung', 'Wohnung', 'Zeitung',
  'Nation', 'Religion', 'Mission', 'Version', 'Situation', 'Position',
  'Freiheit', 'Sicherheit', 'Krankheit', 'Wahrheit', 'Einheit', 'Arbeit',
  'Wissenschaft', 'Gesellschaft', 'Mannschaft', 'Landschaft', 'Botschaft',
  'Leben', 'Krieg', 'Geist', 'Land', 'Volk', 'Bund', 'Reich', 'Recht',
  'Geschichte', 'Wirtschaft', 'Politik', 'Kultur', 'Natur', 'Literatur',
  'Früh', 'Roh', 'Kuh', 'Schuh', 'Ruhe', 'Höhe', 'Nähe', 'Ehe',
  'Tag', 'Weg', 'Berg', 'Zweck', 'Druck', 'Glück', 'Stück', 'Blick',
  'Hand', 'Mund', 'Grund', 'Abend', 'Jugend', 'Tugend', 'ugend',
  'Kind', 'Wind', 'Freund', 'Feind', 'Gesundheit', 'Krankheit',
  'Mutter', 'Vater', 'Schwester', 'Bruder', 'Tochter', 'Sohn',
  'Lehrer', 'Schüler', 'Meister', 'Fenster', 'Winter', 'Sommer',
  'besser', 'besser', 'grosser', 'unser', 'euer', 'dieser', 'jener',
  'ausser', 'außer', 'innerhalb', 'ausserhalb', 'außerhalb',
  'weiss', 'weiß', 'heiss', 'heiß', 'heiss', 'süss', 'süß',
  'Klasse', 'Masse', 'Rasse', 'Strasse', 'Kasse', 'Tasse', 'Nässe',
  'Pass', 'Fass', 'Hass', 'näss', 'blass', 'krass', 'nass',
  'Einsicht', 'Ansicht', 'Absicht', 'Vorsicht', 'Nachsicht', 'Übersicht',
  'Ausdruck', 'Eindruck', 'Druck', 'Versuch', 'Besuch', 'Anspruch',
  'Ausnahme', 'Aufnahme', 'Annahme', 'Zunahme', 'Abnahme',
  'Ausgang', 'Eingang', 'Übergang', 'Untergang', 'Aufgang',
  'Ausweis', 'Beweis', 'Hinweis', 'Verweis', 'Beweis',
  'Dienst', 'Kunst', 'Brunst', 'Gunst', 'Vernunft', 'Zukunft', 'Auskunft',
  'Herbst', 'Obst', 'August', 'Justiz', 'Disziplin', 'Institut',
  'Museum', 'Studium', 'Gymnasium', 'Premium', 'Medium',
  'Israel', 'Islam', 'Moslem', 'Asbest', 'Oslo', 'Dresden', 'Kosmos',
  'Maske', 'brüsk', 'Raster', 'Knospe', 'kreist', 'Busch', 'Wasser',
  'Pilger', 'Fenster', 'Monster', 'Hamster', 'Polster', 'Muster',
  'Hilfs', 'Bundes', 'Landes', 'Volkes', 'Krieges', 'Geistes',
  'Lebens', 'Arbeits', 'Tages', 'Monats', 'Jahres', 'Alters',
  'Rechts', 'Links', 'Nichts', 'Wachs', 'Lachs', 'Dachs', 'Fuchs',
  'Sachsen', 'wachsen', 'waschen', 'löschen', 'mischen', 'raschen',
  'sprechen', 'brechen', 'stechen', 'riechen', 'kriechen',
  'stehen', 'gehen', 'sehen', 'geschehen', 'verstehen',
  'essen', 'pressen', 'messen', 'vergessen', 'besessen',
  'lassen', 'passen', 'fassen', 'hassen', 'nassen',
  'reisen', 'weisen', 'preisen', 'kreisen', 'speisen',
  'lösen', 'lösen', 'bösen', 'grössen', 'stossen', 'stossen',
];

const RIGHTS = [
  'politik', 'theorie', 'stelle', 'stube', 'stück', 'stoff', 'strom',
  'strasse', 'stadt', 'staat', 'stand', 'stamm', 'stärke', 'stimme',
  'spiel', 'spitze', 'sprache', 'spiegel', 'spross', 'sport',
  'schule', 'schiff', 'schatten', 'schluss', 'schmerz',
  'haus', 'amt', 'rat', 'weg', 'werk', 'dienst', 'kraft',
  'truppen', 'mittel', 'form', 'art', 'zeit', 'tag', 'jahr',
  'ende', 'anfang', 'punkt', 'feld', 'raum', 'welt', 'leben',
  'arbeit', 'schule', 'kind', 'mann', 'frau', 'buch', 'blatt',
  'plan', 'system', 'modell', 'problem', 'frage', 'antwort',
  'geschichte', 'wissenschaft', 'forschung', 'bildung', 'kultur',
];

function uniqueWords(): string[] {
  const set = new Set<string>();
  for (const w of ROOTS) {
    const t = w.trim();
    if (t.length >= 2 && /s/i.test(t)) set.add(t);
    else if (t.length >= 2) set.add(t);
  }
  for (const left of ROOTS) {
    for (const right of RIGHTS) {
      const a = left.toLowerCase();
      const b = right.toLowerCase();
      if (a.endsWith(b.slice(0, 3))) continue;
      // Fugen-s wenn links nicht auf s endet und rechts mit Konsonant
      let compound = left;
      if (!/[sß]$/i.test(left) && /^[bcdfghjklmnpqrttvwxyz]/i.test(right)) {
        // nur bei typischen Fugen-Kandidaten
        if (
          /(ung|tion|ion|heit|keit|schaft|ismus|bund|reich|land|volk|krieg|leben|geist|recht|tag)$/i.test(
            left,
          )
        ) {
          compound = left + 's' + right;
        } else {
          compound = left + right;
        }
      } else {
        compound = left + right;
      }
      if (compound.length >= 6 && compound.length <= 28 && /s/i.test(compound)) {
        set.add(compound);
      }
      if (set.size >= 2400) break;
    }
    if (set.size >= 2400) break;
  }
  // Bekannte Problemfälle explizit
  for (const w of [
    'Frühstück',
    'Rohstoff',
    'Kuhstall',
    'Hilfstruppen',
    'Wachstube',
    'Sauerstoff',
    'Landtagswahlen',
    'Bundesrepublik',
    'Geschichtswissenschaft',
    'Bildungspolitik',
    'Reichskanzlers',
    'herausstellen',
    'Arbeitsstelle',
    'Lebensbeschreibung',
  ]) {
    set.add(w);
  }
  return [...set];
}

describe('gold corpus generate', () => {
  it('writes gold-corpus.jsonl when GOLD_GENERATE=1', () => {
    if (process.env.GOLD_GENERATE !== '1') {
      return;
    }
    const words = uniqueWords();
    mkdirSync(dirname(OUT), { recursive: true });
    const lines: string[] = [];
    for (const input of words) {
      const result = convertLongS(input);
      const key = input.toLowerCase();
      const ex = EXCEPTION_LEXICON[key];
      const suggested = ex?.output
        ? applyCasing(input, ex.output)
        : result.output;
      const entry = {
        input,
        suggested,
        status: ex?.status === 'confirmed' ? 'confirmed' : 'suggested',
        ambiguous: result.ambiguities.length > 0,
        note: ex?.note ?? (result.ambiguities.length > 0 ? 'fugen-st/sp' : ''),
        ruleSource: 'typografie.info-hauptregel+heuristik',
      };
      lines.push(JSON.stringify(entry));
    }
    writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
    // eslint-disable-next-line no-console
    console.log(`Wrote ${lines.length} entries → ${OUT}`);
  });
});

function applyCasing(source: string, targetLower: string): string {
  const src = [...source];
  const tgt = [...targetLower];
  if (src.length !== tgt.length) return targetLower;
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const s = src[i]!;
    const t = tgt[i]!;
    if (t === 'ſ') {
      out += 'ſ';
      continue;
    }
    out +=
      s === s.toUpperCase() && s !== s.toLowerCase() ? t.toUpperCase() : t;
  }
  return out;
}

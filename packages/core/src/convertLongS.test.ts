import { describe, it, expect } from 'vitest';
import { convertLongS, convertLongSWithStableIds } from './convertLongS';

describe('convertLongS', () => {
  describe('Wortfinal s → rund', () => {
    it('wandelt abschließendes s in rundes s um', () => {
      const result = convertLongS('Haus');
      expect(result.output).toBe('Haus');
    });

    it('wandelt mehrere Wörter korrekt um', () => {
      const result = convertLongS('Das Haus ist groß.');
      expect(result.output).toBe('Das Haus iſt groß.');
    });
  });

  describe('Initial/medial s → ſ', () => {
    it('wandelt anfängliches s in ſ um', () => {
      const result = convertLongS('sein');
      expect(result.output).toBe('ſein');
    });

    it('wandelt mittleres s in ſ um', () => {
      const result = convertLongS('Wasser');
      expect(result.output).toBe('Waſser');
    });

    it('wandelt s zwischen Vokalen in ſ um', () => {
      const result = convertLongS('lesen');
      expect(result.output).toBe('leſen');
    });
  });

  describe('ss → ſs', () => {
    it('wandelt ss in ſs um (erstes lang, zweites rund)', () => {
      const result = convertLongS('Masse');
      expect(result.output).toBe('Maſse');
    });

    it('behandelt mehrere ss im Wort', () => {
      const result = convertLongS('ausschließlich');
      // Präfix „aus“ → rundes s am Ende, dann ſſ im Rest
      expect(result.output).toContain('aus');
    });
  });

  describe('ß bleibt unverändert', () => {
    it('lässt ß unverändert', () => {
      const result = convertLongS('Straße');
      expect(result.output).toBe('Straße');
    });

    it('lässt ß in Wörtern mit s unverändert', () => {
      const result = convertLongS('heiß');
      expect(result.output).toBe('heiß');
    });
  });

  describe('Bindestrich-Komposita', () => {
    it('behält rundes s vor dem Bindestrich', () => {
      const result = convertLongS('Wachs-tube');
      expect(result.output).toBe('Wachs-tube');
    });

    it('wandelt den rechten Teil normal um', () => {
      const result = convertLongS('Haus-tür');
      expect(result.output).toBe('Haus-tür');
    });
  });

  describe('Präfix-Regeln', () => {
    it('behält rundes s am Ende von „aus“-Präfix', () => {
      const result = convertLongS('aussehen');
      expect(result.output).toBe('ausſehen');
    });

    it('behält rundes s am Ende von „des“-Präfix', () => {
      const result = convertLongS('dessen');
      // „des“ + „sen“ – Präfix des mit rundem s
      expect(result.output).toMatch(/^des/);
    });

    it('behält rundes s am Ende von „bis“-Präfix', () => {
      const result = convertLongS('bisher');
      expect(result.output).toBe('bisher');
    });
  });

  describe('Mehrdeutigkeiten', () => {
    it('markiert Wachstube als mehrdeutig', () => {
      const result = convertLongS('Wachstube');
      expect(result.ambiguities).toHaveLength(1);
      expect(result.ambiguities[0].candidates).toHaveLength(2);
      expect(result.ambiguities[0].candidates[0].text).toBe('Wachstube');
      expect(result.ambiguities[0].candidates[1].text).toBe('Wachſtube');
    });

    it('markiert Sauerstoff als mehrdeutig', () => {
      const result = convertLongS('Sauerstoff');
      expect(result.ambiguities).toHaveLength(1);
      expect(result.ambiguities[0].candidates).toHaveLength(2);
      expect(result.ambiguities[0].candidates[0].text).toBe('Sauerstoff');
      expect(result.ambiguities[0].candidates[1].text).toBe('Sauerſtoff');
    });

    it('markiert Tausend als mehrdeutig', () => {
      const result = convertLongS('Tausend');
      expect(result.ambiguities).toHaveLength(1);
      expect(result.ambiguities[0].candidates).toHaveLength(2);
      expect(result.ambiguities[0].candidates[0].text).toBe('Tausend');
      expect(result.ambiguities[0].candidates[1].text).toBe('Tauſend');
    });

    it('markiert Landstörtzerin als mehrdeutig (Default: Land + störtzerin)', () => {
      const result = convertLongS('Landstörtzerin');
      expect(result.ambiguities).toHaveLength(1);
      expect(result.output).toBe('Landſtörtzerin');
    });

    it('respektiert Overrides bei Mehrdeutigkeiten', () => {
      const first = convertLongS('Wachstube');
      const id = first.ambiguities[0].id;
      const overrides = new Map([[id, 1]]);
      const second = convertLongS('Wachstube', overrides);
      expect(second.output).toBe('Wachſtube');
    });

    it('verwendet stabile IDs mit convertLongSWithStableIds', () => {
      const overrides = new Map([['word-wachstube-0', 1]]);
      const result = convertLongSWithStableIds('Wachstube', overrides);
      expect(result.output).toBe('Wachſtube');
      expect(result.ambiguities[0].id).toBe('word-wachstube-0');
    });
  });

  describe('Satz mit gemischten Regeln', () => {
    it('konvertiert einen längeren Satz korrekt', () => {
      const input = 'Die Straße führt zum Haus.';
      const result = convertLongS(input);
      expect(result.output).toBe('Die Straße führt zum Haus.');
    });
  });

  describe('Heuristische Grenzregeln (kein Wörterbuch)', () => {
    it('erkennt Flexions-s: Sachs + en → Sachsen', () => {
      expect(convertLongS('Sachsen').output).toBe('Sachsen');
      expect(convertLongS('Sachsen-Anhalt').output).toBe('Sachsen-Anhalt');
    });

    it('erkennt Fugen-s in -ung/-tion-Komposita', () => {
      expect(convertLongS('Bildungspolitik').output).toBe('Bildungspolitik');
      expect(convertLongS('Migrationshintergrund').output).toBe('Migrationshintergrund');
      expect(convertLongS('Führungspositionen').output).toBe('Führungspoſitionen');
      expect(convertLongS('Forschungsgruppe').output).toBe('Forſchungsgruppe');
      expect(convertLongS('Nichtregierungsorganisationen').output).toBe(
        'Nichtregierungsorganiſationen',
      );
    });

    it('erkennt Morphem-Fuge bei ss: rund + lang statt ſs', () => {
      expect(convertLongS('herausstellen').output).toBe('herausſtellen');
      expect(convertLongS('migrationssensible').output).toBe('migrationsſenſible');
    });

    it('behält echtes ss innerhalb eines Morphems (ſs)', () => {
      expect(convertLongS('Masse').output).toBe('Maſse');
      expect(convertLongS('Wasser').output).toBe('Waſser');
      expect(convertLongS('passieren').output).toBe('paſsieren');
    });

    it('wandelt nicht nach starrem Wortabgleich um', () => {
      // Ähnlich klingendes Wort ohne passende Grenzregel → normale Heuristik
      expect(convertLongS('Bildung').output).toBe('Bildung');
      expect(convertLongS('Politik').output).toBe('Politik');
    });

    it('erkennt Genitiv-Fugen-s in Komposita', () => {
      expect(convertLongS('Bundesrepublik').output).toBe('Bundesrepublik');
      expect(convertLongS('Geschichtswissenschaft').output).toBe(
        'Geſchichtswiſsenſchaft',
      );
      expect(convertLongS('volkspädagogische').output).toBe('volkspädagogiſche');
      expect(convertLongS('Hilfstruppen').output).toBe('Hilfstruppen');
      expect(convertLongS('Landtagswahlen').output).toBe('Landtagswahlen');
      // -schaft beginnt mit ſch (Wikipedia/Typografie.info: Mannſchaft)
      expect(convertLongS('Gefolgschaft').output).toBe('Gefolgſchaft');
      expect(convertLongS('linksliberale').output).toBe('linksliberale');
      expect(convertLongS('Reichskanzlers').output).toBe('Reichskanzlers');
      expect(convertLongS('Konkursmasse').output).toBe('Konkursmaſse');
      expect(convertLongS('Antisemitismusforschung').output).toBe(
        'Antiſemitiſmusforſchung',
      );
    });

    it('setzt ſch/ſt korrekt (keine Präfix-/Genitiv-False-Positives)', () => {
      expect(convertLongS('brandschatzten').output).toBe('brandſchatzten');
      expect(convertLongS('bischöflich').output).toBe('biſchöflich');
      expect(convertLongS('Anscheinend').output).toBe('Anſcheinend');
      expect(convertLongS('erst').output).toBe('erſt');
      expect(convertLongS('wichtigste').output).toBe('wichtigſte');
      expect(convertLongS('dass').output).toBe('daſs');
      expect(convertLongS('Deutschland').output).toBe('Deutſchland');
      expect(convertLongS('widersprechen').output).toBe('widerſprechen');
      expect(convertLongS('Angst').output).toBe('Angſt');
    });

    it('setzt Fugen-s vor Vokal und Ortsnamen', () => {
      expect(convertLongS('Kriegsende').output).toBe('Kriegsende');
      expect(convertLongS('Lebensechtheit').output).toBe('Lebensechtheit');
      expect(convertLongS('Lebensbeschreibung').output).toBe('Lebensbeſchreibung');
      expect(convertLongS('Grimmelshausen').output).toBe('Grimmelshausen');
      expect(convertLongS('Springinsfeld').output).toBe('Springinsfeld');
      expect(convertLongS('Gaisbach').output).toBe('Gaisbach');
    });

    it('lässt Stamm-s in -sch- unverändert (kein Fugen-s)', () => {
      expect(convertLongS('Deutschland').output).toBe('Deutſchland');
      expect(convertLongS('widersprechen').output).toBe('widerſprechen');
      expect(convertLongS('Angst').output).toBe('Angſt');
    });

    it('setzt Diminutiv -chen mit rundem s (nicht -ischen)', () => {
      expect(convertLongS('Häschen').output).toBe('Häschen');
      expect(convertLongS('Häuschen').output).toBe('Häuschen');
      expect(convertLongS('klassischen').output).toBe('klaſsiſchen');
      expect(convertLongS('katholischen').output).toBe('katholiſchen');
    });

    it('behält großes S in Akronumen', () => {
      expect(convertLongS('NSDAP').output).toBe('NSDAP');
      expect(convertLongS('AfD').output).toBe('AfD');
    });
  });
});

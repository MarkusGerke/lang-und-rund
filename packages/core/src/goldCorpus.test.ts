import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { convertLongS } from './convertLongS';
import { confirmedExceptions } from './exceptions';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GOLD = join(ROOT, 'testdata', 'gold-corpus.jsonl');

interface GoldEntry {
  input: string;
  suggested: string;
  status: 'confirmed' | 'suggested';
  ambiguous?: boolean;
  note?: string;
}

function loadGold(): GoldEntry[] {
  if (!existsSync(GOLD)) return [];
  return readFileSync(GOLD, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as GoldEntry);
}

describe('Ausnahme-Wörterbuch', () => {
  it('trifft alle confirmed Exceptions exakt', () => {
    for (const { input, output } of confirmedExceptions()) {
      expect(convertLongS(input).output, input).toBe(output);
      // Title Case
      const titled = input[0]!.toUpperCase() + input.slice(1);
      const titledOut = output[0]!.toUpperCase() + output.slice(1);
      expect(convertLongS(titled).output, titled).toBe(titledOut);
    }
  });
});

describe('Goldkorpus', () => {
  it('hat genügend Einträge (≥2000) nach Generate', () => {
    const gold = loadGold();
    if (gold.length === 0) {
      console.warn(
        'gold-corpus.jsonl fehlt — einmal GOLD_GENERATE=1 vitest run src/goldCorpus.generate.test.ts',
      );
      return;
    }
    expect(gold.length).toBeGreaterThanOrEqual(2000);
  });

  it('confirmed-Einträge matchen convertLongS', () => {
    const confirmed = loadGold().filter((e) => e.status === 'confirmed');
    for (const e of confirmed) {
      expect(convertLongS(e.input).output, e.input).toBe(e.suggested);
    }
  });

  it('misst Fehlerrate suggested vs. Heuristik (Baseline = 0 Abweichungen)', () => {
    const gold = loadGold().filter((e) => e.status === 'suggested');
    if (gold.length === 0) return;
    let mismatches = 0;
    for (const e of gold) {
      if (convertLongS(e.input).output !== e.suggested) mismatches += 1;
    }
    // suggested wurde aus derselben Heuristik erzeugt → Baseline 0;
    // nach manuellen Korrekturen an suggested steigt die Rate, bis Exceptions greifen.
    const rate = mismatches / gold.length;
    expect(rate).toBeLessThan(0.005);
  });
});

describe('Mehrdeutigkeit vor st/sp', () => {
  it('markiert Hilfstruppen als Mehrdeutigkeit (Default rund)', () => {
    const r = convertLongS('Hilfstruppen');
    expect(r.output).toBe('Hilfstruppen');
    expect(r.ambiguities.length).toBeGreaterThan(0);
    expect(r.ambiguities[0]!.candidates[0]!.text).toBe('Hilfstruppen');
    expect(r.ambiguities[0]!.candidates[1]!.text).toContain('ſ');
  });
});

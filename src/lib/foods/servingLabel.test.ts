import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadFoods } from './foods';
import { servingLabelFor, translateServingLabel, unparsedServingLabels } from './servingLabel';
import { ENTRIES } from './servingWords';

const labels = loadFoods().map((food) => food.servingLabel);
const vi = (label: string) => translateServingLabel(label, 'vi');
const fi = (label: string) => translateServingLabel(label, 'fi');

describe('serving labels: units and numbers', () => {
  it('translates units (cup, tbsp, tsp, oz, fl oz, g, slice, piece, serving)', () => {
    expect(vi('1 cup')).toBe('1 cốc');
    expect(fi('1 cup')).toBe('1 kuppi');
    expect(vi('1 tbsp')).toBe('1 muỗng canh');
    expect(fi('2 tbsp')).toBe('2 rkl');
    expect(vi('1 tsp')).toBe('1 muỗng cà phê');
    expect(fi('1 tsp')).toBe('1 tl');
    expect(vi('1 tablespoon')).toBe('1 muỗng canh');
    expect(vi('3 oz')).toBe('3 oz');
    expect(fi('8 fl oz')).toBe('8 fl oz');
    expect(vi('100 g')).toBe('100 g');
    expect(vi('1 slice')).toBe('1 lát');
    expect(vi('1 piece')).toBe('1 miếng');
    expect(vi('1 serving')).toBe('1 phần');
    expect(fi('1 serving')).toBe('1 annos');
  });

  it('is case-insensitive for units ("2 TBSP", "2 Tbsp")', () => {
    expect(vi('2 TBSP')).toBe('2 muỗng canh');
    expect(fi('2 Tbsp')).toBe('2 rkl');
  });

  it('uses the locale decimal comma and keeps fractions', () => {
    expect(vi('0.25 cup')).toBe('0,25 cốc');
    expect(fi('0.67 cup')).toBe('0,67 kuppia');
    expect(vi('2.96 oz')).toBe('2,96 oz');
    expect(vi('1/2 slice')).toBe('1/2 lát');
    expect(fi('1/2 slice')).toBe('1/2 viipaletta');
    expect(vi('1 cup (1/2" slices)')).toBe('1 cốc (1/2" lát)');
  });
});

describe('serving labels: Finnish number agreement', () => {
  it('uses the nominative after 1 and the partitive after any other number', () => {
    expect(fi('1 slice')).toBe('1 viipale');
    expect(fi('2 slices')).toBe('2 viipaletta');
    expect(fi('10 slices')).toBe('10 viipaletta');
    expect(fi('3 pieces')).toBe('3 palaa');
    expect(fi('1 piece')).toBe('1 pala');
    expect(fi('2 eggs')).toBe('2 kananmunaa');
    expect(fi('0.5 fillet')).toBe('0,5 fileetä');
    expect(fi('1 small fillet')).toBe('1 pieni filee');
    expect(fi('4 large')).toBe('4 isoa');
  });

  it('puts what is measured in the partitive after a measure', () => {
    expect(fi('1 cup spaghetti not packed')).toBe('1 kuppi spagettia pakkaamaton');
    expect(fi('3 pieces shrimp')).toBe('3 palaa katkarapua');
    expect(fi('1 cup slices')).toBe('1 kuppi viipaleita');
    expect(fi('1 tablespoon liquid oil')).toBe('1 rkl nestemäistä öljyä');
  });
});

describe('serving labels: words, order and structure', () => {
  it('translates preparation words after a comma', () => {
    expect(vi('1 cup, chopped')).toBe('1 cốc, băm nhỏ');
    expect(fi('1 cup, chopped')).toBe('1 kuppi, pilkottu');
    expect(vi('1 cup, shredded or chopped')).toBe('1 cốc, xé sợi hoặc băm nhỏ');
    expect(fi('1 cup, shredded or chopped')).toBe('1 kuppi, raastettu tai pilkottu');
    expect(fi('1 cup, well packed')).toBe('1 kuppi, tiiviisti pakattu');
  });

  it('puts Vietnamese adjectives after the noun and Finnish adjectives before it', () => {
    expect(vi('1 small fillet')).toBe('1 miếng phi lê nhỏ');
    expect(vi('1 large or thick slice')).toBe('1 lát lớn hoặc dày');
    expect(fi('1 large or thick slice')).toBe('1 iso tai paksu viipale');
    expect(vi('1 small/regular fillet')).toBe('1 miếng phi lê nhỏ/thường');
    expect(fi('1 small/regular fillet')).toBe('1 pieni/tavallinen filee');
    expect(vi('1 small or thin/very thin slice')).toBe('1 lát nhỏ hoặc mỏng/rất mỏng');
    expect(fi('1 small or thin/very thin slice')).toBe('1 pieni tai ohut/hyvin ohut viipale');
  });

  it('handles parentheses, inch marks, "x" and "dia"', () => {
    expect(vi('1 can (12 fl oz)')).toBe('1 lon (12 fl oz)');
    expect(fi('1 can (12 fl oz)')).toBe('1 tölkki (12 fl oz)');
    expect(vi('1 cookie (3" dia)')).toBe('1 bánh quy (3" đk)');
    expect(fi('1 cookie (3" dia)')).toBe('1 keksi (3" halk.)');
    expect(vi('1 fillet, large (7" x 2-1/4" x 1/4")')).toBe('1 miếng phi lê, lớn (7" x 2-1/4" x 1/4")');
    expect(vi('1 slice (2-1/2" dia x 1/4" thick)')).toBe('1 lát (2-1/2" đk x 1/4" dày)');
  });

  it('handles with / without phrases and names', () => {
    expect(vi('1 breast, with skin')).toBe('1 ức, có da');
    expect(fi('1 breast, with skin')).toBe('1 rinta, ihoineen');
    expect(vi('1 drumstick without skin')).toBe('1 đùi tỏi không da');
    expect(fi('1 drumstick without skin')).toBe('1 koipi ihaton');
    expect(vi('1 Newton bar')).toBe('1 thanh Newton');
    expect(fi('1 Newton bar')).toBe('1 Newton-patukka');
    expect(vi('6 inch sub')).toBe('6 inch sub');
    expect(fi('6 inch sub')).toBe('6 tuuman subi');
  });

  it('keeps "of" only for fractions in Vietnamese, and leaves those Finnish labels in English', () => {
    expect(vi('1 piece (1/8 of 9" dia)')).toBe('1 miếng (1/8 của 9" đk)');
    expect(fi('1 piece (1/8 of 9" dia)')).toBeNull();
  });
});

describe('serving labels: fallback to English', () => {
  it('returns null (and servingLabelFor returns the English label) when a word is unknown', () => {
    for (const label of ['1 cup, with pits, yields', '1 scoop of plenty', '1 foot', 'Juice of 1 orange (2-5/8" dia)', '1 potato large (3" to 4-1/4" dia.']) {
      expect(vi(label), label).toBeNull();
      expect(servingLabelFor(label, 'vi'), label).toBe(label);
      expect(servingLabelFor(label, 'fi'), label).toBe(label);
    }
  });

  it('never half translates: no English word is left in a translated label', () => {
    const english = /\b(cup|slice|piece|tbsp|tablespoon|tsp|teaspoon|serving|small|large|medium|chopped|diced|cooked|bottle|can|with|without)\b/i;
    for (const label of new Set(labels)) {
      if (!label) continue;
      for (const lang of ['vi', 'fi'] as const) {
        const out = translateServingLabel(label, lang);
        if (out != null) expect(out, `${lang}: ${label}`).not.toMatch(english);
      }
    }
  });

  it('English and empty labels pass through', () => {
    expect(servingLabelFor('1 cup', 'en')).toBe('1 cup');
    expect(servingLabelFor('', 'vi')).toBe('');
    expect(servingLabelFor(undefined, 'fi')).toBeUndefined();
    expect(translateServingLabel('', 'vi')).toBeNull();
    expect(servingLabelFor('1 cup', 'vi')).toBe('1 cốc');
  });

  it('covers nearly the whole catalog: at most 30 of ~350 distinct labels stay English, and the lists are pinned', () => {
    const distinct = new Set(labels.filter(Boolean)).size;
    const viLeft = unparsedServingLabels(labels, 'vi');
    const fiLeft = unparsedServingLabels(labels, 'fi');
    expect(distinct).toBeGreaterThan(300);
    expect(viLeft.length).toBeLessThanOrEqual(30);
    expect(fiLeft.length).toBeLessThanOrEqual(30);
    // Everything Vietnamese cannot do, Finnish cannot do either, except labels only Finnish lacks forms for.
    for (const label of viLeft) expect(fiLeft).toContain(label);
    expect(viLeft).toContain('1 foot');
    expect(viLeft).not.toContain('1 cup');
  });
});

describe('serving labels: QA-20 or-chains and a guard over the whole catalog', () => {
  it('"solid or chunks" and "whole or halves" keep both parts and the conjunction in the middle', () => {
    expect(vi('1 cup, solid or chunks')).toBe('1 cốc, đặc hoặc miếng lớn');
    expect(fi('1 cup, solid or chunks')).toBe('1 kuppi, kiinteä tai kimpaleet');
    expect(vi('1 cup, whole or halves')).toBe('1 cốc, nguyên hoặc nửa');
    expect(fi('1 cup, whole or halves')).toBe('1 kuppi, kokonainen tai puolikkaat');
  });

  it('the shared-noun branch still shares one noun: "small or thin slice"', () => {
    expect(vi('1 small or thin slice')).toBe('1 lát nhỏ hoặc mỏng');
    expect(fi('1 small or thin slice')).toBe('1 pieni tai ohut viipale');
  });

  const CONJUNCTION = { vi: /^(hoặc|và)$/, fi: /^(tai|ja)$/ } as const;
  for (const lang of ['vi', 'fi'] as const) {
    it(`every translated catalog label in ${lang} is clean: no stray spaces, empty parts or dangling conjunctions`, () => {
      let translated = 0;
      for (const label of new Set(labels)) {
        if (!label) continue;
        const out = translateServingLabel(label, lang);
        if (out == null) continue;
        translated += 1;
        const where = `${lang}: [${label}] -> [${out}]`;
        expect(out, where).toBe(out.trim());
        expect(out, where).not.toMatch(/\s{2,}/);
        expect(out, where).not.toMatch(/(^|[\s(,])(hoặc|và|tai|ja)(\s*$|\s*[,)])/);
        expect(out, where).not.toMatch(/^(hoặc|và|tai|ja)\s/);
        expect(out, where).not.toMatch(/,\s*,|\(\s*\)|^\s*,|,\s*$|\s,|\(\s|\s\)|\/\s|\s\/(?!\d)/);
        // empty parts (",,", "()", "a/ /b") are caught above; here no part may be only a conjunction
        for (const part of out.split(/[,()/]/)) {
          expect(part.trim(), where).not.toMatch(CONJUNCTION[lang]);
        }
      }
      expect(translated).toBeGreaterThan(320);
    });
  }
});

describe('serving label word tables', () => {
  it('give every noun a Vietnamese word and the Finnish forms', () => {
    for (const [word, entry] of ENTRIES) {
      if (entry.kind === 'noun') {
        expect(entry.vi, word).toBeTruthy();
        expect(entry.fi, word).toBeTruthy();
        expect(entry.fiPart, word).toBeTruthy();
      }
      if (entry.kind === 'adj') {
        expect(entry.vi && entry.fi && entry.fiPart, word).toBeTruthy();
      }
    }
  });

  it('Log shows the translated label next to the food and on the serving chip', () => {
    const log = readFileSync(join(__dirname, '../../../app/(tabs)/log.tsx'), 'utf8');
    expect(log).toMatch(/servingLabelFor\(selected\.servingLabel, locale\)/g);
    expect(log.match(/servingLabelFor\(selected\.servingLabel, locale\)/g)?.length).toBe(2);
    expect(log).not.toMatch(/\$\{selected\.servingLabel\}/);
  });
});

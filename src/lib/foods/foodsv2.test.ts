import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEARCH_PAGE_SIZE, loadFoods, searchFoods, tokenize } from './foods';
import { foodName } from './names';
import { entryFromPer100 } from '../logging';

/** foods_v2.json schema check, run on the raw asset so a bad swap fails before the parser can hide it. */
const raw = JSON.parse(readFileSync(join(__dirname, '../../../assets/foods.json'), 'utf8')) as Record<string, unknown>[];

const COLUMNS = [
  'carbs_per_100g', 'category', 'fat_per_100g', 'fdc_id', 'fiber_per_100g', 'id',
  'kcal_per_100g', 'name', 'name_fi', 'name_vi', 'protein_per_100g',
  'serving_label', 'serving_size_g', 'source',
];
const SOURCES = new Set(['USDA FDC SR Legacy', 'USDA FDC Foundation', 'USDA FDC FNDDS']);
const CATEGORIES = new Set([
  'meat', 'seafood', 'eggs', 'dairy', 'grains', 'legumes', 'nuts', 'fruit', 'vegetables', 'snacks', 'beverages',
  'prepared dishes', 'fast food', 'fats & oils', 'condiments', 'sweets',
]);

describe('foods_v2 schema', () => {
  it('has 1,555 rows with exactly the 14 expected columns (12 v2 columns plus name_vi, name_fi; review metadata is not bundled)', () => {
    expect(raw).toHaveLength(1555);
    for (const row of raw) expect(Object.keys(row).sort()).toEqual(COLUMNS);
  });

  it('has sequential unique ids, unique names and unique FDC ids', () => {
    raw.forEach((row, index) => expect(row.id).toBe(index + 1));
    expect(new Set(raw.map((row) => row.name)).size).toBe(raw.length);
    expect(new Set(raw.map((row) => row.fdc_id)).size).toBe(raw.length);
  });

  it('uses only allowed sources and categories, and all three sources appear', () => {
    for (const row of raw) {
      expect(SOURCES.has(row.source as string), `${row.id} ${row.source}`).toBe(true);
      expect(CATEGORIES.has(row.category as string), `${row.id} ${row.category}`).toBe(true);
    }
    expect(new Set(raw.map((row) => row.source))).toEqual(SOURCES);
  });

  it('has finite non-negative macros; fiber is null or non-negative', () => {
    for (const row of raw) {
      for (const key of ['kcal_per_100g', 'protein_per_100g', 'carbs_per_100g', 'fat_per_100g'] as const) {
        const value = row[key];
        expect(typeof value === 'number' && Number.isFinite(value) && value >= 0, `${row.id} ${key}`).toBe(true);
      }
      const fiber = row.fiber_per_100g;
      expect(fiber === null || (typeof fiber === 'number' && fiber >= 0), `${row.id} fiber`).toBe(true);
    }
    expect(raw.some((row) => row.fiber_per_100g === null)).toBe(true);
  });

  it('has serving sizes from 2 to 435 g and a string label (a few rows have an empty label, as in v1)', () => {
    const sizes = raw.map((row) => row.serving_size_g as number);
    expect(Math.min(...sizes)).toBe(2);
    expect(Math.max(...sizes)).toBe(435);
    for (const row of raw) expect(typeof row.serving_label, `${row.id}`).toBe('string');
    expect(raw.filter((row) => row.serving_label === '1 serving' || row.serving_size_g === 100).length).toBeGreaterThan(0);
  });

  it('keeps ids 1 to 622 as in v1 and keeps food names in English (ASCII plus a few accents)', () => {
    expect(raw[0].name).toBe('Bacon, baked');
    expect(raw[621].name).toBe('Egg drop soup');
    expect(raw[622].id).toBe(623);
    for (const row of raw) expect(/^[\x20-\x7e\u00c0-\u017f]+$/.test(row.name as string), `${row.id} ${row.name}`).toBe(true);
  });

  it('parses every row (the loader drops none)', () => {
    expect(loadFoods()).toHaveLength(raw.length);
  });
});

describe('foods_v2_i18n translations', () => {
  it('has name_vi and name_fi strings on every row: trimmed, NFC, and empty or equal to English where there is no local name', () => {
    for (const row of raw) {
      for (const key of ['name_vi', 'name_fi'] as const) {
        const value = row[key];
        expect(typeof value, `${row.id} ${key}`).toBe('string');
        expect(value, `${row.id} ${key} trimmed`).toBe((value as string).trim());
        expect((value as string).normalize('NFC'), `${row.id} ${key} NFC`).toBe(value);
      }
      expect(row, `${row.id}`).not.toHaveProperty('needs_review');
      expect(row, `${row.id}`).not.toHaveProperty('review_note');
    }
  });

  it('keeps intentional English names: a translation equal to the English name is valid, shown as is and found by search', () => {
    const same = raw.filter((row) => row.name_vi === row.name || row.name_fi === row.name);
    expect(same.length).toBeGreaterThan(100);
    const foods = loadFoods();
    for (const row of same.slice(0, 40)) {
      const food = foods.find((item) => item.id === String(row.id))!;
      for (const locale of ['en', 'vi', 'fi'] as const) {
        expect(foodName(food, locale).length).toBeGreaterThan(0);
        expect(searchFoods(foods, food.name, 5000, locale).some((hit) => hit.id === food.id), `${row.id} ${locale}`).toBe(true);
      }
    }
  });

  it('every row listed in foods_v2_i18n_english_fallback.csv has the English name in that language', () => {
    const csv = join(__dirname, '../../../../foods_v2_i18n_english_fallback.csv');
    if (!existsSync(csv)) return;
    const lines = readFileSync(csv, 'utf8').replace(/^\ufeff/, '').split('\n').slice(1).filter(Boolean);
    expect(lines.length).toBeGreaterThan(100);
    const byId = new Map(raw.map((row) => [String(row.id), row]));
    for (const line of lines) {
      const id = line.split(',')[0];
      const language = /,(vi|fi),/.exec(line)?.[1] as 'vi' | 'fi';
      const row = byId.get(id)!;
      expect(row[`name_${language}`], `${id} ${language}`).toBe(row.name);
    }
  });

  it("applies Nacho's vi review: 43 of the 53 rows hold name_vi_new, the 9 intentional-English rows keep the English name, and id 1013 keeps the standard 'hũ' spelling", () => {
    const csv = join(__dirname, '../../../../foods_v2_i18n_vi_review.csv');
    if (!existsSync(csv)) return;
    const lines = readFileSync(csv, 'utf8').replace(/^\ufeff/, '').split('\n').slice(1).filter(Boolean);
    expect(lines.length).toBe(53);
    const byId = new Map(raw.map((row) => [String(row.id), row]));
    const english = new Set(['108', '166', '377', '651', '680', '869', '901', '1047', '1048']);
    let applied = 0;
    for (const line of lines) {
      const id = line.split(',')[0];
      const row = byId.get(id)!;
      if (english.has(id)) {
        expect(row.name_vi, id).toBe(row.name);
      } else if (id === '1013') {
        // Gus: the standard spelling is 'Củ hũ dừa' (Heisenberg's), not the CSV's 'hủ'
        expect(row.name_vi, id).toBe('Củ hũ dừa (hearts of palm), sống');
      } else {
        applied += 1;
        expect(line, id).toContain(row.name_vi);
      }
    }
    expect(applied).toBe(43);
  });

  it('keeps the patty fix (id 23) and the standard hearts-of-palm spelling hũ (id 1013)', () => {
    const byId = new Map(raw.map((row) => [row.id, row]));
    expect(byId.get(23)!.name_vi).toBe('Miếng bò xay (patty) 85% nạc, nướng');
    expect(byId.get(1013)!.name_vi).toBe('Củ hũ dừa (hearts of palm), sống');
  });

  it('is the v2 catalog plus names: same ids in the same order, same English names and macros as the v2 source file', () => {
    const v2 = join(__dirname, '../../../../foods_v2.json');
    if (!existsSync(v2)) return; // the source file lives outside the repo; skip where it is absent
    const source = JSON.parse(readFileSync(v2, 'utf8')) as Record<string, unknown>[];
    expect(raw.map((row) => row.id)).toEqual(source.map((row) => row.id));
    for (const [index, row] of source.entries()) {
      for (const key of Object.keys(row)) expect(raw[index][key], `${row.id} ${key}`).toEqual(row[key]);
    }
  });
});

describe('search at 1,555 rows', () => {
  const foods = loadFoods();

  it('caps every query at the page size and keeps the best matches first', () => {
    for (const query of ['chicken', 'rice', 'milk', 'a', 'cheese', 'soup']) {
      const page = searchFoods(foods, query);
      expect(page.length, query).toBeLessThanOrEqual(SEARCH_PAGE_SIZE);
      const all = searchFoods(foods, query, 5000);
      expect(all.slice(0, page.length).map((f) => f.id), query).toEqual(page.map((f) => f.id));
      expect(all.length, query).toBeGreaterThan(page.length - 1);
    }
    expect(searchFoods(foods, 'chicken', 5000).length).toBeGreaterThan(SEARCH_PAGE_SIZE);
  });

  it('puts whole-word and simple foods first', () => {
    const rice = searchFoods(foods, 'rice').map((food) => food.name);
    expect(rice[0].toLowerCase()).toMatch(/^rice/);
    expect(tokenize(rice[0]).length).toBeLessThanOrEqual(tokenize(rice[rice.length - 1]).length);
    expect(searchFoods(foods, 'baked bacon').map((food) => food.name)).toContain('Bacon, baked');
  });

  it('finds new FNDDS foods', () => {
    expect(searchFoods(foods, 'antelope').some((food) => food.name === 'Antelope, roasted')).toBe(true);
    expect(searchFoods(foods, 'tequila').length).toBeGreaterThan(0);
  });

  it('stays fast: 200 searches over the full list in well under 2 seconds', () => {
    const queries = ['chicken', 'rice', 'egg', 'bacon', 'milk', 'apple', 'pizza', 'beef steak', 'cola', 'x'];
    const started = Date.now();
    for (let i = 0; i < 200; i += 1) searchFoods(foods, queries[i % queries.length]);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('logged entries are snapshots, not references', () => {
  it('stores the food name, per-100 g values and totals, so a changed catalog or shifted id never alters a past log', () => {
    const food = loadFoods().find((item) => item.id === '700')!;
    const entry = entryFromPer100({
      name: food.name, foodId: food.id, date: '2026-10-30', meal: 'lunch', grams: 150,
      kcalPer100: food.kcalPer100g, proteinPer100: food.proteinPer100g, carbsPer100: food.carbsPer100g,
      fatPer100: food.fatPer100g, fiberPer100: food.fiberPer100g,
    });
    expect(entry.name).toBe(food.name);
    expect(entry.kcalPer100).toBe(food.kcalPer100g);
    expect(entry.proteinPer100).toBe(food.proteinPer100g);
    expect(entry.carbsPer100).toBe(food.carbsPer100g);
    expect(entry.fatPer100).toBe(food.fatPer100g);
    expect(entry.fiberPer100).toBe(food.fiberPer100g);
    expect(entry.kcal).toBeGreaterThanOrEqual(0);
    // The id is only a loose reference for the display name: macros and totals are never read back from the catalog.
    expect(JSON.stringify(entry)).toContain(food.name);
  });
});

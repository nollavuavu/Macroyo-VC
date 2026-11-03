import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadFoods, loadFoodsById, parseFoods } from './foods';
import { entryDisplayName, entryNameIsUnchanged, foodName } from './names';
import { entryFromPer100 } from '../logging';

const read = (path: string) => readFileSync(join(__dirname, '../../..', path), 'utf8');
const foods = loadFoods();
const byId = loadFoodsById();

describe('food names in the app language', () => {
  it('shows English, Vietnamese and Finnish names from the catalog', () => {
    const bacon = byId.get('1')!;
    expect(foodName(bacon, 'en')).toBe('Bacon, baked');
    expect(foodName(bacon, 'vi')).toBe('Thịt xông khói, nướng lò');
    expect(foodName(bacon, 'fi')).toBe('Pekoni, uunipaistettu');
  });

  it('every catalog row shows a non-empty name in every language (an empty or English-equal translation is fine, not missing data)', () => {
    for (const food of foods) {
      for (const locale of ['en', 'vi', 'fi'] as const) expect(foodName(food, locale).trim(), `${food.id} ${locale}`).not.toBe('');
    }
  });

  it('falls back to English when a translation is missing, empty or blank', () => {
    const [food, blank, half] = parseFoods([
      { id: 'x', name: 'Plain rice', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
      { id: 'y', name: 'Blank rice', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, name_vi: '   ', name_fi: '' },
      { id: 'z', name: 'Half rice', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, name_vi: 'Cơm', name_fi: null },
    ]);
    for (const locale of ['en', 'vi', 'fi'] as const) expect(foodName(food, locale)).toBe('Plain rice');
    expect(foodName(blank, 'vi')).toBe('Blank rice');
    expect(foodName(blank, 'fi')).toBe('Blank rice');
    expect(foodName(half, 'vi')).toBe('Cơm');
    expect(foodName(half, 'fi')).toBe('Half rice');
  });
});

function entryFor(id: string, name?: string) {
  const food = byId.get(id)!;
  return entryFromPer100({
    name: name ?? food.name, foodId: food.id, date: '2026-10-30', meal: 'lunch', grams: 150,
    kcalPer100: food.kcalPer100g, proteinPer100: food.proteinPer100g, carbsPer100: food.carbsPer100g,
    fatPer100: food.fatPer100g, fiberPer100: food.fiberPer100g,
  });
}

describe('past log entries (snapshots) are shown in the current language by id, never rewritten', () => {
  it('a catalog entry shows the current-locale name, and follows a language change', () => {
    const entry = entryFor('1');
    expect(entry.name).toBe('Bacon, baked');
    expect(entryDisplayName(entry, 'en')).toBe('Bacon, baked');
    expect(entryDisplayName(entry, 'vi')).toBe('Thịt xông khói, nướng lò');
    expect(entryDisplayName(entry, 'fi')).toBe('Pekoni, uunipaistettu');
  });

  it('a custom or quick-add entry (no foodId) shows its snapshot name in every language', () => {
    const custom = { ...entryFor('1'), foodId: null, name: 'Mum’s soup' };
    for (const locale of ['en', 'vi', 'fi'] as const) expect(entryDisplayName(custom, locale)).toBe('Mum’s soup');
  });

  it('an unknown id shows the snapshot name', () => {
    const gone = { ...entryFor('1'), foodId: '999999', name: 'Retired food' };
    expect(entryDisplayName(gone, 'vi')).toBe('Retired food');
  });

  it('a renamed entry keeps the name the user typed (deviation: the id alone is not enough)', () => {
    const renamed = entryFor('1', 'My crispy bacon');
    expect(entryDisplayName(renamed, 'vi')).toBe('My crispy bacon');
    expect(entryDisplayName(renamed, 'fi')).toBe('My crispy bacon');
  });

  it('an id that now points at a different food (shifted ids) keeps the snapshot name', () => {
    const shifted = { ...entryFor('1'), foodId: '2' };
    expect(byId.get('2')!.name).not.toBe('Bacon, baked');
    expect(entryDisplayName(shifted, 'vi')).toBe('Bacon, baked');
  });

  it('display never changes stored data: name, macros and per-100 values are untouched', () => {
    const entry = entryFor('1');
    const before = JSON.stringify(entry);
    entryDisplayName(entry, 'vi');
    entryDisplayName(entry, 'fi');
    expect(JSON.stringify(entry)).toBe(before);
  });

  it('a new entry still stores the English catalog name', () => {
    expect(entryFor('1').name).toBe(byId.get('1')!.name);
    const log = read('app/(tabs)/log.tsx');
    expect(log).toMatch(/name: selected\.name,\s*foodId: selected\.id/);
  });

  it('an untouched edit field keeps the snapshot; a typed name replaces it', () => {
    const entry = entryFor('1');
    expect(entryNameIsUnchanged(entry, entry.name)).toBe(true);
    expect(entryNameIsUnchanged(entry, 'Thịt xông khói, nướng lò')).toBe(true);
    expect(entryNameIsUnchanged(entry, 'Pekoni, uunipaistettu')).toBe(true);
    expect(entryNameIsUnchanged(entry, 'Bacon, crispy')).toBe(false);
  });
});

describe('screens show localized names', () => {
  const log = read('app/(tabs)/log.tsx');
  const today = read('app/(tabs)/index.tsx');

  it('Log search results, the detail header, day rows, delete label and undo use the localized name', () => {
    expect(log).toMatch(/foodName\(food, locale\)/);
    expect(log).toMatch(/entryDisplayName\(entry, locale\)/);
    expect(log).toMatch(/entryDisplayName\(undo\.entry, locale\)/);
    expect(log).not.toMatch(/\{food\.name\}/);
    expect(log).not.toMatch(/\{entry\.name\}/);
  });

  it('Today rows use the localized name', () => {
    expect(today).toMatch(/entryDisplayName\(item, locale\)/);
    expect(today).not.toMatch(/\{item\.name\}/);
  });
});

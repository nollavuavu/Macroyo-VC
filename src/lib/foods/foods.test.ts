import { describe, expect, it } from 'vitest';
import { formatFiber, loadFoods, matchRank, parseFoods, searchFoods } from './foods';

describe('food loader', () => {
  it('loads the USDA catalog (v2: 1,555 foods), including the added egg foods', () => {
    const foods = loadFoods();
    expect(foods.length).toBe(1555);
    expect(foods.find((food) => food.id === '1')?.name).toBe('Bacon, baked');
    expect(foods.find((food) => food.id === '622')?.name).toBe('Egg drop soup');
    expect(foods.find((food) => food.name === 'Quail egg, raw')).toBeTruthy();
  });

  it('keeps null fiber distinct from zero', () => {
    const foods = loadFoods();
    const zero = foods.find((food) => food.name === 'Bacon, baked');
    const missing = foods.find((food) => food.name === 'Beef hot dog');
    expect(zero?.fiberPer100g).toBe(0);
    expect(missing?.fiberPer100g).toBeNull();
    expect(formatFiber(null)).toBe('—');
    expect(formatFiber(0)).toBe('0');
    expect(formatFiber(missing?.fiberPer100g)).toBe('—');
  });

  it('accepts field aliases and skips invalid rows', () => {
    const foods = parseFoods([
      { id: 'a', name: 'Alias oats', calories: 370, protein_g: 13, carbohydrates: 60, fat: 7 },
      { id: 'b', name: 'No energy', protein: 1, carbs: 1, fat: 1 },
      { name: 'Negative', kcal_per_100g: -1, protein_per_100g: 1, carbs_per_100g: 1, fat_per_100g: 1 },
      { id: 'c', food_name: 'Named', kcal: 10, protein: 1, carbs: 2, fat: 0, fiber: null },
      'not a row',
    ]);
    expect(foods.map((food) => food.name)).toEqual(['Alias oats', 'Named']);
    expect(foods[0].kcalPer100g).toBe(370);
    expect(foods[0].fiberPer100g).toBeNull();
    expect(foods[1].fiberPer100g).toBeNull();
  });
});

describe('USDA name search', () => {
  const foods = loadFoods();

  it('finds Bacon, baked from baked bacon, bacon baked, and bacon', () => {
    for (const query of ['baked bacon', 'bacon baked', 'bacon']) {
      const names = searchFoods(foods, query, 20).map((food) => food.name);
      expect(names, query).toContain('Bacon, baked');
    }
  });

  it('ranks an exact token set and a starts-with match ahead of a longer name', () => {
    expect(matchRank('baked bacon', 'Bacon, baked')).toBe(0);
    expect(matchRank('bacon', 'Bacon, baked')).toBe(1);
    expect(matchRank('bacon', 'Bacon, baked, extra crumbs')).toBe(1);
    const ranked = searchFoods(
      [
        { ...foods[0], id: 'long', name: 'Bacon, baked, extra crumbs', tokens: ['bacon', 'baked', 'extra', 'crumbs'] },
        { ...foods[0], id: 'short', name: 'Bacon, baked', tokens: ['bacon', 'baked'] },
        { ...foods[0], id: 'other', name: 'Baked beans', tokens: ['baked', 'beans'] },
      ],
      'baked bacon',
    );
    expect(ranked.map((food) => food.name)).toEqual(['Bacon, baked', 'Bacon, baked, extra crumbs']);
  });

  it('matches token prefixes in any order and ignores punctuation and case', () => {
    expect(matchRank('BACON,', 'Bacon, baked')).toBe(1);
    expect(matchRank('qua egg', 'Quail egg, raw')).not.toBeNull();
    expect(searchFoods(foods, 'quail egg', 5).some((food) => food.name === 'Quail egg, raw')).toBe(true);
    expect(matchRank('zzz', 'Bacon, baked')).toBeNull();
  });
});

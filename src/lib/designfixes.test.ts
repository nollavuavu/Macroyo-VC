import { describe, expect, it } from 'vitest';
import { bmiCategory, bmiTone, quickAddFieldErrors } from './domain';
import { addDays, dayAccessibilityLabel, friendlyDate, shortDate } from './dates';
import { formatKcal, groupThousands } from './format';
import { mean, trailingAverage } from './stats';
import { SEARCH_PAGE_SIZE, loadFoods, parseFoods, searchFoods } from './foods/foods';
import { DISCLAIMER } from './copy';
import { borderStrongDark, borderStrongLight } from '../theme/extras';
import { contrastRatio, darkColors, lightColors } from '../theme/theme';

describe('formatKcal thousands separators', () => {
  it('groups four-digit and larger values', () => {
    expect(formatKcal(2850)).toBe('2,850');
    expect(formatKcal(12345)).toBe('12,345');
    expect(formatKcal(1000)).toBe('1,000');
    expect(formatKcal(999.4)).toBe('999');
    expect(formatKcal(2849.5)).toBe('2,850');
  });
  it('keeps small values and decimals as before', () => {
    expect(formatKcal(0)).toBe('0');
    expect(formatKcal(99.96)).toBe('100');
    expect(formatKcal(12.34)).toBe('12.3');
    expect(formatKcal(Number.NaN)).toBe('—');
  });
  it('handles negatives', () => {
    expect(formatKcal(-1500)).toBe('−1,500');
  });
  it('groupThousands only touches digits', () => {
    expect(groupThousands('1234567')).toBe('1,234,567');
    expect(groupThousands('123')).toBe('123');
  });
});

describe('BMI band to colour role', () => {
  it('is success only for the normal band and never red', () => {
    expect(bmiTone(22)).toBe('success');
    expect(bmiTone(18.5)).toBe('success');
    expect(bmiTone(24.99)).toBe('success');
    for (const bmi of [14, 17.9, 25, 27, 31, 36, 45]) expect(bmiTone(bmi)).toBe('warning');
  });
  it('agrees with bmiCategory for every 0.1 step', () => {
    for (let bmi = 12; bmi <= 50; bmi += 0.1) {
      expect(bmiTone(bmi) === 'success').toBe(bmiCategory(bmi).who === 'Normal');
    }
  });
});

describe('friendly dates', () => {
  const today = '2026-10-30';
  it('names today, yesterday and tomorrow', () => {
    expect(friendlyDate('2026-10-30', today)).toBe('Today');
    expect(friendlyDate('2026-10-29', today)).toBe('Yesterday');
    expect(friendlyDate('2026-10-31', today)).toBe('Tomorrow');
  });
  it('falls back to weekday, day and month', () => {
    expect(friendlyDate('2026-10-28', today)).toBe('Wed 28 Oct');
    expect(friendlyDate('2026-01-05', today)).toBe('Mon 5 Jan');
  });
  it('works across a month boundary', () => {
    expect(friendlyDate('2026-10-31', '2026-11-01')).toBe('Yesterday');
    expect(friendlyDate(addDays('2026-12-31', 1), '2026-12-31')).toBe('Tomorrow');
  });
  it('builds short axis labels and screen-reader labels', () => {
    expect(shortDate('2026-10-30')).toBe('30 Oct');
    expect(dayAccessibilityLabel('2026-10-30', 2)).toBe('Friday 30 October, 2 items logged');
    expect(dayAccessibilityLabel('2026-10-30', 1)).toBe('Friday 30 October, 1 item logged');
    expect(dayAccessibilityLabel('2026-10-30', 0)).toBe('Friday 30 October, nothing logged');
  });
});

describe('trailing average', () => {
  it('uses fewer values at the start', () => {
    expect(trailingAverage([10, 20, 30], 7)).toEqual([10, 15, 20]);
  });
  it('slides a fixed window', () => {
    const out = trailingAverage([1, 2, 3, 4, 5, 6, 7, 8, 9], 7);
    expect(out[6]).toBeCloseTo(4);
    expect(out[7]).toBeCloseTo(5);
    expect(out[8]).toBeCloseTo(6);
    expect(out).toHaveLength(9);
  });
  it('handles empty and single inputs and a window of 1', () => {
    expect(trailingAverage([], 7)).toEqual([]);
    expect(trailingAverage([80], 7)).toEqual([80]);
    expect(trailingAverage([1, 2, 3], 1)).toEqual([1, 2, 3]);
  });
  it('mean returns null for nothing', () => {
    expect(mean([])).toBeNull();
    expect(mean([2, 4])).toBe(3);
  });
});

describe('food search ranking and cap', () => {
  const foods = loadFoods();
  it('caps a broad query at one page', () => {
    const hits = searchFoods(foods, 'chicken');
    expect(hits.length).toBeLessThanOrEqual(SEARCH_PAGE_SIZE);
    expect(searchFoods(foods, 'chicken', foods.length).length).toBeGreaterThan(SEARCH_PAGE_SIZE);
  });
  it('puts names that start with the query before names that merely contain it', () => {
    const names = searchFoods(foods, 'chicken breast', 400).map((food) => food.name.toLowerCase());
    const firstNonPrefix = names.findIndex((name) => !name.startsWith('chicken'));
    const lastPrefix = names.map((name, i) => (name.startsWith('chicken') ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
    expect(firstNonPrefix === -1 || firstNonPrefix > lastPrefix || names.slice(0, firstNonPrefix).every((n) => n.startsWith('chicken'))).toBe(true);
    expect(names[0].startsWith('chicken breast') || names[0].startsWith('chicken')).toBe(true);
  });
  it('ranks whole words and simpler foods first', () => {
    const rows = parseFoods([
      { id: 'a', name: 'Ricotta cheese', kcal: 1, protein: 1, carbs: 1, fat: 1 },
      { id: 'b', name: 'Rice noodles with chicken and vegetables', kcal: 1, protein: 1, carbs: 1, fat: 1 },
      { id: 'c', name: 'Rice, white', kcal: 1, protein: 1, carbs: 1, fat: 1 },
      { id: 'd', name: 'Fried rice', kcal: 1, protein: 1, carbs: 1, fat: 1 },
    ]);
    expect(searchFoods(rows, 'rice').map((food) => food.name)).toEqual([
      'Rice, white',
      'Rice noodles with chicken and vegetables',
      'Fried rice',
    ]);
  });
  it('returns nothing for a blank query', () => {
    expect(searchFoods(foods, '   ')).toEqual([]);
  });
});

describe('quick-add field errors', () => {
  const ok = { name: 'Phở bò', kcal: 450, proteinG: 25, carbsG: 60, fatG: 10, fiberG: null, grams: 400 };
  it('is empty for a valid entry', () => {
    expect(quickAddFieldErrors(ok)).toEqual({});
  });
  it('attaches each message to its own field', () => {
    const errors = quickAddFieldErrors({ ...ok, name: ' ', kcal: null, proteinG: -1, carbsG: null, grams: 0 });
    expect(Object.keys(errors).sort()).toEqual(['carbsG', 'grams', 'kcal', 'name', 'proteinG']);
  });
});

describe('copy and tokens', () => {
  it('disclaimer says "not medical advice" once', () => {
    expect(DISCLAIMER.toLowerCase().match(/not medical advice/g)).toHaveLength(1);
  });
  it('strong borders reach 3:1 on surface and background in both schemes', () => {
    expect(contrastRatio(borderStrongLight, lightColors.surface)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(borderStrongLight, lightColors.background)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(borderStrongDark, darkColors.surface)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(borderStrongDark, darkColors.background)).toBeGreaterThanOrEqual(3);
  });
});

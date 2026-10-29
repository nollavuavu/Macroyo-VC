import { describe, expect, it } from 'vitest';
import {
  CM_PER_IN,
  DEFICIT_UNAVAILABLE_MESSAGE,
  LOW_CARB_WARNING_G,
  MAX_ENTRY_MACRO_G,
  assessTargets,
  buildMacroPlan,
  isAmbiguousThousands,
  normalizeFeetInches,
  parseDecimal,
  projectV1,
  quickAddDecision,
  quickAddFieldErrors,
  remainingDisplay,
  roundToSum,
  scaleHalfUp1,
  targetNotices,
  validateQuickAdd,
  validateTypedMeasure,
  valueUnlessUnchanged,
  type PlanInput,
} from './domain';
import { entryFromPer100, entryFromTotals, scalePortion } from './logging';
import { formatHeightCm } from './format';
import { nextBanner } from './banner';
import { EMPTY_DATA, type AppData, type LogEntry } from './storage/types';
import { READ_FAILED_MESSAGE, SAVE_FAILED_MESSAGE, createSerialQueue, insertAt, openStore } from './storage/store';

const GOOD = { name: 'Rice', kcal: 200, proteinG: 4, carbsG: 44, fatG: 0.5, fiberG: null, grams: 150 };

describe('QA-1: one exact deficit-unavailable message', () => {
  const plan = buildMacroPlan({ sex: 'male', age: 60, heightCm: 160, weightKg: 55, bodyFatPct: null, activity: 'sedentary', goal: 'cut' });
  it('is the same text in the plan and the projection warning', () => {
    expect(DEFICIT_UNAVAILABLE_MESSAGE).toBe(
      "Your maintenance calories are already close to the minimum safe intake, so a calorie deficit isn't recommended. Consider more activity, or talk to a professional.",
    );
    expect(plan.goalBlockReason).toBe(DEFICIT_UNAVAILABLE_MESSAGE);
    const projection = projectV1({
      weight_kg: 55, height_cm: 160, age: 60, sex: 'male', activity_factor: 1.2, daily_offset_kcal: -300,
      tdee_override_kcal: plan.tdee, floor_kcal: plan.calorieFloor,
    });
    expect(projection.warnings.find((warning) => warning.code === 'DEFICIT_UNAVAILABLE')?.message).toBe(DEFICIT_UNAVAILABLE_MESSAGE);
  });
});

describe('QA-2: typed Calc height, weight and age validate the raw text', () => {
  it('rejects 0, abc, empty and out-of-range, with a message and no value', () => {
    for (const raw of ['0', 'abc', '', '250', '119.9', '230.1']) {
      const result = validateTypedMeasure('height', raw, 'metric');
      expect(result.ok, raw).toBe(false);
      expect(result.value).toBeNull();
      expect(result.message).toBeTruthy();
    }
    expect(validateTypedMeasure('height', '250', 'metric').message).toBe('Enter a height from 120 to 230 cm.');
  });
  it('accepts the Calc range in metric and imperial', () => {
    expect(validateTypedMeasure('height', '180', 'metric')).toEqual({ ok: true, value: 180, message: null });
    expect(validateTypedMeasure('height', '120', 'metric').ok).toBe(true);
    expect(validateTypedMeasure('height', '230', 'metric').ok).toBe(true);
    const inches = validateTypedMeasure('height', '70.9', 'imperial');
    expect(inches.ok).toBe(true);
    expect(inches.value).toBeCloseTo(70.9 * CM_PER_IN, 9);
    expect(validateTypedMeasure('height', '100', 'imperial').ok).toBe(false); // 254 cm
    expect(validateTypedMeasure('weight', '70', 'metric').ok).toBe(true);
    expect(validateTypedMeasure('weight', '29', 'metric').ok).toBe(false);
    expect(validateTypedMeasure('weight', '251', 'metric').ok).toBe(false);
    expect(validateTypedMeasure('weight', '10', 'imperial').ok).toBe(false);
    expect(validateTypedMeasure('weight', '200', 'imperial').ok).toBe(true);
  });
  it('age is 18-120 whatever the units', () => {
    for (const raw of ['0', '17', '121', 'abc', '']) expect(validateTypedMeasure('age', raw, 'imperial').ok, raw).toBe(false);
    expect(validateTypedMeasure('age', '18', 'metric').ok).toBe(true);
    expect(validateTypedMeasure('age', '120', 'metric').ok).toBe(true);
    expect(validateTypedMeasure('age', '0', 'metric').message).toBe('Enter an age from 18 to 120 years.');
  });
});

describe('QA-3: quick add bounds', () => {
  it('rejects a macro above 2000 g', () => {
    expect(MAX_ENTRY_MACRO_G).toBe(2000);
    for (const key of ['proteinG', 'carbsG', 'fatG'] as const) {
      const errors = quickAddFieldErrors({ ...GOOD, grams: 5000, [key]: 2001 });
      expect(errors[key], key).toMatch(/2,000 g/);
      expect(quickAddFieldErrors({ ...GOOD, grams: 5000, [key]: 2000 })[key]).toBeUndefined();
    }
  });
  it('rejects protein + carbs + fat heavier than the portion', () => {
    const errors = quickAddFieldErrors({ ...GOOD, proteinG: 40, carbsG: 40, fatG: 40, grams: 100 });
    expect(errors.grams).toMatch(/more than the 100 g portion/);
    expect(validateQuickAdd({ ...GOOD, proteinG: 40, carbsG: 40, fatG: 40, grams: 100 }).issues.length).toBeGreaterThan(0);
    expect(quickAddFieldErrors({ ...GOOD, proteinG: 40, carbsG: 40, fatG: 20, grams: 100 }).grams).toBeUndefined();
    // rounding slack of 0.5 g
    expect(quickAddFieldErrors({ ...GOOD, proteinG: 50, carbsG: 25, fatG: 25.4, grams: 100 }).grams).toBeUndefined();
  });
  it('accepts a normal entry', () => {
    expect(quickAddFieldErrors(GOOD)).toEqual({});
  });
});

describe('QA-4: a kcal/macro mismatch keeps the card open with Save anyway', () => {
  const mismatch = { ...GOOD, kcal: 900 };
  it('first Save returns a visible warning, not a save', () => {
    const decision = quickAddDecision(mismatch, false);
    expect(decision.action).toBe('confirm');
    expect(decision.action === 'confirm' && decision.warning).toMatch(/add up to about/);
  });
  it('Save anyway saves; consistent numbers save straight away; errors still block', () => {
    expect(quickAddDecision(mismatch, true).action).toBe('save');
    expect(quickAddDecision(GOOD, false).action).toBe('save');
    expect(quickAddDecision({ ...mismatch, name: '' }, true).action).toBe('errors');
  });
});

describe('QA-5: imperial Profile save does not drift stored height or weight', () => {
  it('180 cm survives a save with untouched text, but not a re-parse of the rounded display', () => {
    const stored = 180;
    const { feet, inches } = normalizeFeetInches(0, stored / CM_PER_IN);
    const feetText = String(feet);
    const inchText = String(inches);
    const reparsed = (feet * 12 + Number(inchText)) * CM_PER_IN;
    expect(reparsed).not.toBe(180); // the old behaviour: 180.086
    expect(valueUnlessUnchanged(`${feetText}|${inchText}`, `${feetText}|${inchText}`, stored, reparsed)).toBe(180);
    expect(valueUnlessUnchanged(`6|${inchText}`, `${feetText}|${inchText}`, stored, 6 * 12 * CM_PER_IN + 10.9 * CM_PER_IN)).not.toBe(180);
  });
  it('a changed text uses the parsed value, and null stays null', () => {
    expect(valueUnlessUnchanged('180', '175', 175, 180)).toBe(180);
    expect(valueUnlessUnchanged('abc', '175', 175, null)).toBeNull();
    expect(valueUnlessUnchanged('175', '175', 175.3, 175)).toBe(175.3);
  });
});

describe('QA-6: clamped projection wording', () => {
  it('uses "stopped at a healthy minimum BMI" and flags the clamped cells', () => {
    const projection = projectV1({ weight_kg: 54, height_cm: 170, age: 30, sex: 'female', activity_factor: 1.9, daily_offset_kcal: -500 });
    const warning = projection.warnings.find((item) => item.code === 'BMI_FLOOR_REACHED');
    expect(warning?.message).toMatch(/^Projection stopped at a healthy minimum BMI \(\d+(\.\d)? kg\) from /);
    expect(warning?.message).not.toMatch(/18\.5/);
    const clampedLabels = projection.horizons.filter((row) => row.clamped).map((row) => row.label);
    expect(clampedLabels.length).toBeGreaterThan(0);
    expect(warning?.horizons).toEqual(clampedLabels);
  });
});

describe('persistence: save first, one queue, never overwrite unreadable data', () => {
  const entry = (id: string): LogEntry => ({
    id, date: '2026-10-30', meal: 'lunch', name: id, foodId: null, grams: 100, kcal: 1, proteinG: 0, carbsG: 0, fatG: 0, fiberG: null,
    kcalPer100: 1, proteinPer100: 0, carbsPer100: 0, fatPer100: 0, fiberPer100: null,
  });
  const empty = (): AppData => ({ ...EMPTY_DATA, logs: [], bodyStats: [] });

  it('does not change state when saving fails, and reports it', async () => {
    let fail = true;
    const saved: AppData[] = [];
    const store = await openStore({
      load: async () => empty(),
      save: async (data) => { if (fail) throw new Error('disk full'); saved.push(data); },
      backupRaw: async () => undefined,
    });
    const failed = await store.commit((cur) => ({ ...cur, logs: [entry('a'), ...cur.logs] }));
    expect(failed).toEqual({ ok: false, error: SAVE_FAILED_MESSAGE });
    expect(store.get().logs).toEqual([]); // rolled back: nothing visible that is not on disk
    fail = false;
    const ok = await store.commit((cur) => ({ ...cur, logs: [entry('a'), ...cur.logs] }));
    expect(ok.ok).toBe(true);
    expect(store.get().logs.map((item) => item.id)).toEqual(['a']);
    expect(saved).toHaveLength(1);
  });

  it('serialises concurrent commits: writes happen one at a time, in order, with no lost update', async () => {
    let active = 0;
    let maxActive = 0;
    const writes: string[][] = [];
    const store = await openStore({
      load: async () => empty(),
      save: async (data) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        writes.push(data.logs.map((item) => item.id));
        active -= 1;
      },
      backupRaw: async () => undefined,
    });
    await Promise.all(['a', 'b', 'c', 'd'].map((id) => store.commit((cur) => ({ ...cur, logs: [...cur.logs, entry(id)] }))));
    expect(maxActive).toBe(1);
    expect(writes).toEqual([['a'], ['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd']]);
    expect(store.get().logs.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('the queue keeps running after a failed task', async () => {
    const run = createSerialQueue();
    const order: number[] = [];
    await Promise.allSettled([
      run(async () => { order.push(1); throw new Error('x'); }),
      run(async () => { order.push(2); }),
    ]);
    expect(order).toEqual([1, 2]);
  });

  it('an unreadable blob is backed up, writes are blocked, and only an explicit reset lifts the block', async () => {
    let backedUp = 0;
    const saves: AppData[] = [];
    const store = await openStore({
      load: async () => { throw new SyntaxError('bad json'); },
      save: async (data) => { saves.push(data); },
      backupRaw: async () => { backedUp += 1; },
    });
    expect(backedUp).toBe(1);
    expect(store.isBlocked()).toBe(true);
    expect(store.loadError()).toBe(true);
    const blocked = await store.commit((cur) => ({ ...cur, logs: [entry('x')] }));
    expect(blocked).toEqual({ ok: false, error: READ_FAILED_MESSAGE });
    expect(saves).toEqual([]); // history is never overwritten
    const reset = await store.reset();
    expect(reset.ok).toBe(true);
    expect(store.isBlocked()).toBe(false);
    const after = await store.commit((cur) => ({ ...cur, logs: [entry('x')] }));
    expect(after.ok).toBe(true);
  });

  it('stays blocked even if the backup itself fails', async () => {
    const store = await openStore({
      load: async () => { throw new Error('unreadable'); },
      save: async () => undefined,
      backupRaw: async () => { throw new Error('no space'); },
    });
    expect(store.isBlocked()).toBe(true);
  });

  it('undo after delete restores the original position', async () => {
    const list = [entry('a'), entry('b'), entry('c')];
    const index = list.findIndex((item) => item.id === 'b');
    const without = list.filter((item) => item.id !== 'b');
    expect(insertAt(without, list[index], index).map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(insertAt(without, entry('z'), 99).map((item) => item.id)).toEqual(['a', 'c', 'z']);
    expect(insertAt(without, entry('z'), -4).map((item) => item.id)).toEqual(['z', 'a', 'c']);
  });
});

describe('INFO: number text and feet/inches', () => {
  it('"80." parses as 80, and a lone separator or junk does not parse', () => {
    expect(parseDecimal('80.')).toBe(80);
    expect(parseDecimal('80,')).toBe(80);
    expect(parseDecimal(' 80.5 ')).toBe(80.5);
    expect(parseDecimal('80,5')).toBe(80.5);
    expect(parseDecimal('.5')).toBe(0.5);
    expect(parseDecimal('.')).toBeNull();
    expect(parseDecimal('80 5')).toBeNull();
    expect(parseDecimal('')).toBeNull();
  });
  it('"1,234"-style text is rejected, never read as 1.234 (documented safe option)', () => {
    for (const raw of ['1,234', '12,345', '123,456', '+1,234']) {
      expect(isAmbiguousThousands(raw), raw).toBe(true);
      expect(parseDecimal(raw), raw).toBeNull();
    }
    expect(parseDecimal('0,125')).toBe(0.125);
    expect(parseDecimal('1,23')).toBe(1.23);
    expect(parseDecimal('1.234')).toBe(1.234);
    expect(parseDecimal('1234')).toBe(1234);
    const weight = validateTypedMeasure('weight', '1,234', 'metric');
    expect(weight.ok).toBe(false);
    expect(weight.message).toMatch(/thousands separator/);
  });
  it('5 ft 12 in becomes 6 ft 0 in, everywhere inches are shown', () => {
    expect(normalizeFeetInches(5, 12)).toEqual({ feet: 6, inches: 0 });
    expect(normalizeFeetInches(5, 11.96)).toEqual({ feet: 6, inches: 0 });
    expect(normalizeFeetInches(5, 11.94)).toEqual({ feet: 5, inches: 11.9 });
    expect(normalizeFeetInches(0, 70.9)).toEqual({ feet: 5, inches: 10.9 });
    expect(formatHeightCm(71.96 * CM_PER_IN, 'imperial')).toBe('6 ft 0 in');
    expect(formatHeightCm(180, 'imperial')).toBe('5 ft 10.9 in');
  });
});

describe('UI-1: standalone low-carb warning (spec: under 50 g)', () => {
  const draft = (carbsG: number | null, kcal = 2000) => ({ kcal, proteinG: 150, carbsG, fatG: 60 });
  it('warns under 50 g, softly under 100 g, never at 100 g or more', () => {
    expect(LOW_CARB_WARNING_G).toBe(50);
    const under50 = targetNotices(draft(49));
    expect(under50.find((issue) => issue.field === 'carbsG')?.message).toMatch(/under 50 g/);
    expect(under50.find((issue) => issue.field === 'carbsG')?.blocking).toBe(false);
    expect(targetNotices(draft(0)).some((issue) => issue.field === 'carbsG')).toBe(true);
    expect(targetNotices(draft(50)).find((issue) => issue.field === 'carbsG')?.message).toMatch(/under 100 g/);
    expect(targetNotices(draft(99.9)).find((issue) => issue.field === 'carbsG')?.message).toMatch(/under 100 g/);
    expect(targetNotices(draft(100)).some((issue) => issue.field === 'carbsG')).toBe(false);
  });
  it('is independent of the calorie target, calorie floor and other macros', () => {
    expect(targetNotices({ kcal: null, proteinG: null, carbsG: 30, fatG: null }).some((issue) => issue.field === 'carbsG')).toBe(true);
    expect(targetNotices({ kcal: 900, proteinG: 150, carbsG: 30, fatG: 60 }).some((issue) => issue.field === 'carbsG')).toBe(true);
    expect(targetNotices(draft(null)).some((issue) => issue.field === 'carbsG')).toBe(false);
  });
  it('assessTargets reports it for saved targets, with and without a blocking floor issue', () => {
    const review = assessTargets({ kcal: 1800, proteinG: 180, carbsG: 40, fatG: 100 }, 'male', 1700, 80, 2200, 'maintain');
    expect(review.issues.some((issue) => issue.field === 'carbsG' && /under 50 g/.test(issue.message))).toBe(true);
    const lowFloor = assessTargets({ kcal: 1000, proteinG: 150, carbsG: 20, fatG: 60 }, 'male', 1700, 80, 2200, 'cut');
    expect(lowFloor.blocking).toBe(true);
    expect(lowFloor.issues.some((issue) => issue.field === 'carbsG' && /under 50 g/.test(issue.message))).toBe(true);
  });
  it('appears on generated plans whose carbs are under 50 g', () => {
    const input: PlanInput = { sex: 'female', age: 50, heightCm: 150, weightKg: 130, bodyFatPct: null, activity: 'sedentary', goal: 'cut' };
    const plan = buildMacroPlan(input);
    expect(plan.carbsG).toBeLessThan(100);
    const notices = targetNotices({ kcal: plan.kcal, proteinG: plan.proteinG, carbsG: plan.carbsG, fatG: plan.fatG });
    expect(notices.some((issue) => issue.field === 'carbsG')).toBe(true);
    if (plan.carbsG < 50) expect(plan.veryLowCarb).toBe(true);
  });
});

describe('UI-2: rows, total, ring and remaining agree', () => {
  it('rounded rows sum to the rounded total (largest remainder)', () => {
    const cases = [[0.4, 0.4, 0.4], [10.5, 10.5, 10.5, 10.5], [1.1, 2.2, 3.3], [100.6, 200.6, 300.6], [0.3, 0.3, 0.4]];
    for (const values of cases) {
      const { rounded, total } = roundToSum(values);
      expect(rounded.reduce((sum, value) => sum + value, 0)).toBe(total);
      values.forEach((value, index) => expect(Math.abs(rounded[index] - value)).toBeLessThan(1));
    }
    expect(roundToSum([0.4, 0.4, 0.4]).total).toBe(1);
    expect(roundToSum([]).total).toBe(0);
  });
  it('randomised: rows always add up to the total', () => {
    let seed = 7;
    const next = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = 0; i < 2000; i += 1) {
      const values = Array.from({ length: 1 + Math.floor(next() * 8) }, () => Math.round(next() * 9000) / 10);
      const { rounded, total } = roundToSum(values);
      expect(rounded.reduce((sum, value) => sum + value, 0)).toBe(total);
    }
  });
  it('shows "0 left" at the target and never a fractional remainder', () => {
    expect(remainingDisplay(1999.7, 2000)).toEqual({ consumed: 2000, target: 2000, kind: 'left', amount: 0 });
    expect(remainingDisplay(2000, 2000).amount).toBe(0);
    expect(remainingDisplay(2000, 2000).kind).toBe('left');
    expect(remainingDisplay(2000.3, 2000)).toMatchObject({ kind: 'left', amount: 0 });
    expect(remainingDisplay(1500.4, 2000)).toMatchObject({ kind: 'left', amount: 500 });
    expect(remainingDisplay(2100, 2000)).toMatchObject({ kind: 'over', amount: 100 });
    for (const consumed of [0, 0.3, 1999.5, 2000.49, 2000.5, 2500.5]) {
      expect(Number.isInteger(remainingDisplay(consumed, 2000).amount)).toBe(true);
    }
  });
  it('consumed + remaining equals the target on the "left" side', () => {
    for (const consumed of [0, 12.4, 999.5, 1999.4, 2000]) {
      const shown = remainingDisplay(consumed, 2000);
      expect(shown.consumed + shown.amount).toBe(2000);
    }
  });
});

describe('UI-3: macro energy vs calorie target', () => {
  it('warns above and below by more than max(10 kcal, 1%)', () => {
    const base = { kcal: 2000, proteinG: 150, carbsG: 200, fatG: 66.6 }; // 600 + 800 + 599.4 = 1999.4
    expect(targetNotices(base).some((issue) => issue.field === 'kcal')).toBe(false);
    const over = targetNotices({ ...base, fatG: 80 }).find((issue) => issue.field === 'kcal');
    expect(over?.message).toMatch(/above the 2000 kcal target/);
    const under = targetNotices({ ...base, carbsG: 150 }).find((issue) => issue.field === 'kcal');
    expect(under?.message).toMatch(/below the 2000 kcal target/);
    expect(under?.message).toMatch(/not assigned to any macro/);
    expect(under?.blocking).toBe(false);
  });
  it('the threshold is exactly max(10, 1%) of the target, in both directions', () => {
    const has = (carbsG: number) => targetNotices({ kcal: 2000, proteinG: 100, carbsG, fatG: 100 }).some((issue) => issue.field === 'kcal');
    expect(has(170)).toBe(false); // 1980: 20 under, at the tolerance
    expect(has(169.75)).toBe(true); // 1979
    expect(has(180)).toBe(false); // 2020: 20 over
    expect(has(180.25)).toBe(true); // 2021
  });
  it('small targets use the 10 kcal floor', () => {
    // 500 kcal: 1% = 5, tolerance = 10
    expect(targetNotices({ kcal: 500, proteinG: 50, carbsG: 74, fatG: 0 }).some((issue) => issue.field === 'kcal')).toBe(false); // 496
    expect(targetNotices({ kcal: 500, proteinG: 50, carbsG: 70, fatG: 0 }).some((issue) => issue.field === 'kcal')).toBe(true); // 480
  });
  it('generated plans are inside the tolerance (no notice)', () => {
    const sexes = ['male', 'female', 'unspecified'] as const;
    const goals = ['cut', 'maintain', 'bulk'] as const;
    for (const sex of sexes) for (const goal of goals) for (let weightKg = 45; weightKg <= 160; weightKg += 7) {
      const plan = buildMacroPlan({ sex, age: 35, heightCm: 172, weightKg, bodyFatPct: null, activity: 'moderate', goal });
      expect(targetNotices({ kcal: plan.kcal, proteinG: plan.proteinG, carbsG: plan.carbsG, fatG: plan.fatG }).some((issue) => issue.field === 'kcal'), `${sex} ${goal} ${weightKg}`).toBe(false);
    }
  });
});

describe('UI-4: the saved banner only describes the latest save', () => {
  it('clears on the next save attempt and on any edit; a new save sets it', () => {
    expect(nextBanner(null, { type: 'saved', message: 'Targets saved.' })).toBe('Targets saved.');
    expect(nextBanner('Targets saved.', { type: 'save-attempt' })).toBeNull();
    expect(nextBanner('Targets saved.', { type: 'edit' })).toBeNull();
  });
});

describe('UI-5: half-up portion rounding on exact decimals', () => {
  it('8.3 g per 100 g x 1.5 g... : 8.3 x 150 g = 12.5, and 8.3 x 1.5 = 12.45 -> 12.5', () => {
    expect(scaleHalfUp1(8.3, 150)).toBe(12.5);
    expect(scaleHalfUp1(830, 1.5)).toBe(12.5);
    expect(scaleHalfUp1(8.3, 150.5)).toBe(12.5); // 12.4915
  });
  it('ties that floating point gets wrong now round up', () => {
    expect(scaleHalfUp1(0.3, 150)).toBe(0.5); // 0.45
    expect(scaleHalfUp1(0.6, 75)).toBe(0.5); // 0.45
    expect(scaleHalfUp1(0.6, 575)).toBe(3.5); // 3.45
    expect(scaleHalfUp1(0.7, 150)).toBe(1.1); // 1.05
    expect(scaleHalfUp1(0.7, 350)).toBe(2.5); // 2.45
    expect(scaleHalfUp1(0.7, 550)).toBe(3.9); // 3.85
  });
  it('exact decimals are untouched; zero and negatives behave', () => {
    expect(scaleHalfUp1(10, 100)).toBe(10);
    expect(scaleHalfUp1(0, 100)).toBe(0);
    expect(scaleHalfUp1(52, 150)).toBe(78);
    expect(scaleHalfUp1(-0.3, 150)).toBe(-0.5);
    expect(scaleHalfUp1(33.3, 33.3)).toBe(11.1); // 11.0889
  });
  it('agrees with integer tenths arithmetic for a sweep of per-100 values and portions', () => {
    for (let tenths = 0; tenths <= 200; tenths += 1) {
      for (const grams of [25, 30, 45, 50, 75, 85, 100, 125, 150, 175, 200, 350, 575]) {
        // value = tenths/10 per 100 g; result in tenths = round_half_up(tenths * grams / 100)
        const expectedTenths = Math.floor((tenths * grams * 2 + 100) / 200);
        expect(scaleHalfUp1(tenths / 10, grams), `${tenths / 10} x ${grams}`).toBeCloseTo(expectedTenths / 10, 9);
      }
    }
  });
  it('logged entries and previews use it', () => {
    const entry = entryFromPer100({
      name: 'x', foodId: null, date: '2026-10-30', meal: 'lunch', grams: 150,
      kcalPer100: 0.3, proteinPer100: 0.6, carbsPer100: 0.7, fatPer100: 8.3, fiberPer100: null,
    });
    expect(entry.kcal).toBe(0.5);
    expect(entry.proteinG).toBe(0.9);
    expect(entry.carbsG).toBe(1.1);
    expect(entry.fatG).toBe(12.5);
    const preview = scalePortion({ kcal: 0.3, protein: 0.6, carbs: 0.7, fat: 8.3, fiber: null }, 150);
    expect(preview).toMatchObject({ kcal: 0.5, protein: 0.9, carbs: 1.1, fat: 12.5, fiber: null });
    expect(scalePortion({ kcal: 1, protein: 1, carbs: 1, fat: 1, fiber: 1 }, null)).toBeNull();
  });
});

describe('minor fixes: edit an entry, quick add stores typed values', () => {
  it('entryFromTotals stores totals exactly as typed (rounded half-up to 0.1) and derives per-100', () => {
    const entry = entryFromTotals({ id: 'e1', name: ' Pho ', foodId: null, date: '2026-10-30', meal: 'dinner', grams: 400, kcal: 450.25, proteinG: 20, carbsG: 60, fatG: 12.05, fiberG: 3 });
    expect(entry).toMatchObject({ id: 'e1', name: 'Pho', grams: 400, kcal: 450.3, proteinG: 20, carbsG: 60, fatG: 12.1, fiberG: 3 });
    expect(entry.kcalPer100).toBeCloseTo(112.5625, 9);
    expect(entry.fiberPer100).toBeCloseTo(0.75, 9);
  });
  it('an edited name and macros keep the entry id, date and meal; untouched macros rescale from per-100', () => {
    const original = entryFromPer100({ id: 'k', name: 'Rice', foodId: 'f1', date: '2026-10-29', meal: 'lunch', grams: 100, kcalPer100: 130, proteinPer100: 2.7, carbsPer100: 28, fatPer100: 0.3, fiberPer100: 0.4 });
    const regrammed = entryFromPer100({ id: original.id, name: 'Jasmine rice', foodId: original.foodId, date: original.date, meal: original.meal, grams: 150, kcalPer100: original.kcalPer100, proteinPer100: original.proteinPer100, carbsPer100: original.carbsPer100, fatPer100: original.fatPer100, fiberPer100: original.fiberPer100 });
    expect(regrammed).toMatchObject({ id: 'k', name: 'Jasmine rice', date: '2026-10-29', meal: 'lunch', grams: 150, kcal: 195, fatG: 0.5 });
    const typed = entryFromTotals({ id: 'k', name: 'Rice (restaurant)', foodId: 'f1', date: '2026-10-29', meal: 'lunch', grams: 150, kcal: 260, proteinG: 5, carbsG: 50, fatG: 4, fiberG: null });
    expect(typed).toMatchObject({ id: 'k', name: 'Rice (restaurant)', kcal: 260, proteinG: 5, carbsG: 50, fatG: 4, fiberG: null });
  });
});

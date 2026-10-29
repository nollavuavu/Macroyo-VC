import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_FACTORS,
  assessTargets,
  bmiCategory,
  bmiImperial,
  bmiMetric,
  buildMacroPlan,
  cmToInches,
  fatFloorGrams,
  harrisBenedictRevised,
  interpretFfmi,
  katchMcArdle,
  kgToLb,
  lbToKg,
  leanMassKg,
  macrosForGrams,
  normalizedFfmi,
  parseDecimal,
  progressRatio,
  sumFiber,
  sumLogged,
  validateAge,
  validateBodyFat,
  validateHeightCm,
  validateQuickAdd,
  validateWeightKg,
  ffmiValue,
} from './nutrition';

const man = {
  sex: 'male' as const,
  age: 30,
  heightCm: 180,
  weightKg: 80,
  bodyFatPct: null,
  activity: 'moderate' as const,
};

describe('O-2 / O-2c / O-3 / O-5 energy and macros', () => {
  it('O-2 maintain: BMR 1780, TDEE 2759, P 144, F 77, C 373', () => {
    const plan = buildMacroPlan({ ...man, goal: 'maintain' });
    expect(plan.bmr).toBe(1780);
    expect(plan.tdee).toBeCloseTo(2759, 6);
    expect(plan.kcal).toBe(2759);
    expect(plan.proteinG).toBe(144);
    expect(plan.fatG).toBe(77);
    expect(plan.carbsG).toBe(373);
    expect(plan.formula).toBe('mifflin');
  });

  it('O-2b Katch-McArdle when body fat is 15%', () => {
    const plan = buildMacroPlan({ ...man, goal: 'maintain', bodyFatPct: 15 });
    expect(leanMassKg(80, 15)).toBeCloseTo(68, 6);
    expect(katchMcArdle(68)).toBeCloseTo(1838.8, 6);
    expect(plan.bmr).toBeCloseTo(1838.8, 6);
    expect(plan.tdee).toBeCloseTo(1838.8 * 1.55, 6);
    expect(plan.formula).toBe('katch');
  });

  it('O-2c / O-5 cut is -20% and bulk is +10%', () => {
    const cut = buildMacroPlan({ ...man, goal: 'cut' });
    const bulk = buildMacroPlan({ ...man, goal: 'bulk' });
    expect(cut.kcal).toBe(2207);
    expect(cut.proteinG).toBe(176);
    expect(cut.fatG).toBe(64);
    expect(cut.carbsG).toBe(232);
    expect(cut.fatG).toBeGreaterThanOrEqual(49);
    expect(bulk.kcal).toBe(3035);
    expect(bulk.proteinG).toBe(144);
    expect(bulk.fatG).toBe(84);
    expect(bulk.carbsG).toBe(425);
  });

  it('O-3 female sedentary BMR and TDEE', () => {
    const plan = buildMacroPlan({
      sex: 'female',
      age: 25,
      heightCm: 165,
      weightKg: 60,
      bodyFatPct: null,
      activity: 'sedentary',
      goal: 'maintain',
    });
    expect(plan.bmr).toBeCloseTo(1345.25, 6);
    expect(plan.tdee).toBeCloseTo(1345.25 * ACTIVITY_FACTORS.sedentary, 6);
  });

  it('O-5b female cut is capped at 1200 with an explanation', () => {
    const plan = buildMacroPlan({
      sex: 'female',
      age: 25,
      heightCm: 155,
      weightKg: 45,
      bodyFatPct: null,
      activity: 'sedentary',
      goal: 'cut',
    });
    expect(plan.bmr).toBeCloseTo(1132.75, 6);
    expect(plan.tdee).toBeCloseTo(1132.75 * 1.2, 4);
    expect(plan.goalAllowed).toBe(true);
    expect(plan.capped).toBe(true);
    expect(plan.kcal).toBe(1200);
    expect(plan.capReason).toBeTruthy();
  });

  it('O-5c male whose safe deficit is 6 kcal cannot take a cut', () => {
    const plan = buildMacroPlan({
      sex: 'male',
      age: 60,
      heightCm: 160,
      weightKg: 55,
      bodyFatPct: null,
      activity: 'sedentary',
      goal: 'cut',
    });
    expect(plan.bmr).toBe(1255);
    expect(plan.tdee).toBeCloseTo(1506, 6);
    expect(plan.maxSafeOffset).toBeCloseTo(6, 6);
    expect(plan.deficitUnavailable).toBe(true);
    expect(plan.goalAllowed).toBe(false);
    expect(plan.goal).toBe('maintain');
    expect(plan.kcal).toBe(1506);
    expect(plan.goalBlockReason).toMatch(/not available/i);
  });

  it('O-5d BMI under 18.5 does not offer a cut', () => {
    const plan = buildMacroPlan({ ...man, weightKg: 59, goal: 'cut' });
    expect(plan.bmi).toBeCloseTo(18.2, 1);
    expect(plan.goalAllowed).toBe(false);
    expect(plan.goalBlockReason).toMatch(/18\.5/);
  });
});

describe('O-4 / units', () => {
  it('O-4 imperial 5 ft 11 in and 176 lb convert and match BMI', () => {
    const heightCm = 71 * 2.54;
    const weightKg = lbToKg(176);
    expect(heightCm).toBeCloseTo(180.34, 2);
    expect(weightKg).toBeCloseTo(79.83, 1);
    const metric = bmiMetric(weightKg, heightCm)!;
    const imperial = bmiImperial(176, 71)!;
    expect(metric).toBeCloseTo(imperial, 2);
    expect(Math.round(metric * 10) / 10).toBe(24.5);
    expect(kgToLb(lbToKg(176))).toBeCloseTo(176, 8);
    expect(cmToInches(heightCm)).toBeCloseTo(71, 8);
  });
});

describe('O-6 to O-10 validation', () => {
  it('O-5e / O-7 age 17 is blocked and 18 is allowed', () => {
    expect(validateAge(17).underage).toBe(true);
    expect(validateAge(18).ok).toBe(true);
    expect(validateAge(null).ok).toBe(false);
    expect(validateAge(0).ok).toBe(false);
    expect(validateAge(5).underage).toBe(true);
    expect(validateAge(150).ok).toBe(false);
  });

  it('O-7 height and weight rejects absurd values', () => {
    for (const value of [0, -1, 999]) expect(validateHeightCm(value).ok).toBe(false);
    for (const value of [0, -1, 1000]) expect(validateWeightKg(value).ok).toBe(false);
    expect(validateHeightCm(180).ok).toBe(true);
    expect(validateWeightKg(80.5).ok).toBe(true);
  });

  it('O-8 decimals and comma decimals', () => {
    expect(parseDecimal('80.5')).toBe(80.5);
    expect(parseDecimal('80,5')).toBe(80.5);
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('80.5.1')).toBeNull();
  });

  it('O-9 / O-10 body fat blank is allowed and out-of-range values are not', () => {
    expect(validateBodyFat(null).ok).toBe(true);
    expect(validateBodyFat(60).ok).toBe(true);
    expect(validateBodyFat(3).ok).toBe(true);
    for (const value of [0, 1, 70, 100, -5, 150]) expect(validateBodyFat(value).ok).toBe(false);
  });
});

describe('G-3 to G-6 target checks', () => {
  it('G-3 floors: 800 and 1100 block a woman, 1200 is accepted; 1400 blocks a man, 1500 is accepted', () => {
    const womanBmr = 1132.75;
    const manBmr = 1255;
    const base = { proteinG: 100, carbsG: 100, fatG: 40 };
    expect(assessTargets({ ...base, kcal: 800 }, 'female', womanBmr, 45).blocking).toBe(true);
    expect(assessTargets({ ...base, kcal: 1100 }, 'female', womanBmr, 45).blocking).toBe(true);
    expect(assessTargets({ ...base, kcal: 1200, fatG: 27 }, 'female', womanBmr, 45).blocking).toBe(false);
    expect(assessTargets({ ...base, kcal: 1400 }, 'male', manBmr, 55).blocking).toBe(true);
    expect(assessTargets({ ...base, kcal: 1500, fatG: 44 }, 'male', manBmr, 55).blocking).toBe(false);
  });

  it('G-3b fat floor is 49 g at 80 kg / 2207 kcal and 27 g at 45 kg / 1200 kcal', () => {
    expect(fatFloorGrams(2207, 80)).toBeGreaterThan(49);
    expect(fatFloorGrams(2207, 80)).toBeLessThan(50);
    expect(fatFloorGrams(1200, 45)).toBeCloseTo(27, 5);
    const blocked = assessTargets({ kcal: 2207, proteinG: 176, carbsG: 232, fatG: 40 }, 'male', 1780, 80);
    expect(blocked.issues.some((issue) => issue.field === 'fatG' && issue.blocking)).toBe(true);
  });

  it('G-3c low carbs warn, G-4 rejects empty and negative, G-5 rejects 20000, G-6 shows a mismatch', () => {
    const low = assessTargets({ kcal: 2207, proteinG: 300, carbsG: 40, fatG: 80 }, 'male', 1780, 80);
    expect(low.issues.some((issue) => issue.field === 'carbsG' && !issue.blocking)).toBe(true);
    expect(assessTargets({ kcal: 0, proteinG: 1, carbsG: 1, fatG: 20 }, 'female', 1200, 60).blocking).toBe(true);
    expect(assessTargets({ kcal: -5, proteinG: 1, carbsG: 1, fatG: 20 }, 'female', 1200, 60).blocking).toBe(true);
    expect(assessTargets({ kcal: null, proteinG: 1, carbsG: 1, fatG: 20 }, 'female', 1200, 60).blocking).toBe(true);
    expect(assessTargets({ kcal: 20000, proteinG: 100, carbsG: 100, fatG: 50 }, 'male', 1780, 80).blocking).toBe(true);
    const mismatch = assessTargets({ kcal: 2000, proteinG: 200, carbsG: 250, fatG: 80 }, 'male', 1780, 80);
    expect(mismatch.issues.some((issue) => /add up/i.test(issue.message))).toBe(true);
  });
});

describe('B-1 to B-8 BMI and FFMI', () => {
  it('B-1 180 cm, 80 kg is BMI 24.7 Normal', () => {
    const bmi = bmiMetric(80, 180)!;
    expect(Math.round(bmi * 10) / 10).toBe(24.7);
    expect(bmiCategory(bmi).who).toBe('Normal');
  });

  it('B-2 WHO boundaries at 180 cm', () => {
    const cases: [number, string][] = [
      [59.9, 'Underweight'],
      [60, 'Normal'],
      [81, 'Overweight'],
      [97.2, 'Obese class I'],
      [113.4, 'Obese class II'],
      [129.6, 'Obese class III'],
    ];
    for (const [kg, who] of cases) {
      const bmi = bmiMetric(kg, 180)!;
      expect(bmiCategory(bmi).who, `${kg} -> ${bmi}`).toBe(who);
    }
    expect(bmiMetric(59.9, 180)!).toBeCloseTo(18.487, 2);
    expect(bmiMetric(60, 180)!).toBeGreaterThanOrEqual(18.5);
  });

  it('B-3 / B-3b / B-4 male FFMI bands', () => {
    const one = normalizedFfmi(ffmiValue(leanMassKg(80, 15), 180)!, 180);
    expect(leanMassKg(80, 15)).toBeCloseTo(68, 6);
    expect(round1(ffmiValue(68, 180)!)).toBe(21);
    expect(round1(one)).toBe(21);
    expect(interpretFfmi('male', one).label).toBe('Above average');

    const twoFfmi = ffmiValue(leanMassKg(70, 12), 170)!;
    const two = normalizedFfmi(twoFfmi, 170);
    expect(leanMassKg(70, 12)).toBeCloseTo(61.6, 6);
    expect(round1(twoFfmi)).toBe(21.3);
    expect(round1(two)).toBe(21.9);
    expect(interpretFfmi('male', two).label).toBe('Above average');

    const boundary = normalizedFfmi(ffmiValue(leanMassKg(70, 20), 170)!, 170);
    expect(round1(ffmiValue(56, 170)!)).toBe(19.4);
    expect(round1(boundary)).toBe(20);
    expect(interpretFfmi('male', boundary).label).toBe('Above average');
  });

  it('B-4b / B-4c women are unbanded and copy avoids natural or enhanced', () => {
    const ffmi = ffmiValue(leanMassKg(60, 25), 165)!;
    const normalized = normalizedFfmi(ffmi, 165);
    expect(leanMassKg(60, 25)).toBeCloseTo(45, 6);
    expect(round1(ffmi)).toBe(16.5);
    expect(round1(normalized)).toBe(17.4);
    const reading = interpretFfmi('female', normalized);
    expect(reading.banded).toBe(false);
    expect(reading.band).toBeNull();
    const text = `${reading.label} ${reading.detail}`.toLowerCase();
    expect(text).not.toMatch(/natural|enhanced/);
    expect(interpretFfmi('male', 26).label.toLowerCase()).not.toMatch(/natural|enhanced/);
  });

  it('B-6 / B-7 / B-8 body fat and height guards', () => {
    expect(validateBodyFat(0).ok).toBe(false);
    expect(validateBodyFat(100).ok).toBe(false);
    expect(bmiMetric(80, 0)).toBeNull();
    expect(ffmiValue(60, 0)).toBeNull();
  });
});

describe('food math, fiber, and quick add', () => {
  it('L-3 grams scale per-100g macros and keep null fiber', () => {
    const scaled = macrosForGrams({ kcal: 100, protein: 10, carbs: 20, fat: 5, fiber: null }, 150);
    expect(scaled.kcal).toBe(150);
    expect(scaled.proteinG).toBe(15);
    expect(scaled.carbsG).toBe(30);
    expect(scaled.fatG).toBe(7.5);
    expect(scaled.fiberG).toBeNull();
    const zero = macrosForGrams({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }, 250);
    expect(zero.fiberG).toBe(0);
  });

  it('null fiber stays unknown in a daily total and 0 stays 0', () => {
    expect(sumFiber([null])).toBeNull();
    expect(sumFiber([0])).toBe(0);
    expect(sumFiber([1.5, null])).toBeNull();
    expect(sumFiber([1.5, 0])).toBe(1.5);
    expect(sumFiber([])).toBeNull();
    const totals = sumLogged([
      { kcal: 350, proteinG: 20, carbsG: 40, fatG: 10, fiberG: 0 },
      { kcal: 520.5, proteinG: 30, carbsG: 50, fatG: 12, fiberG: null },
      { kcal: 129.7, proteinG: 5, carbsG: 20, fatG: 3, fiberG: 2 },
    ]);
    expect(totals.kcal).toBeCloseTo(1000.2, 6);
    expect(totals.fiberG).toBeNull();
  });

  it('D-5 a zero target does not divide into Infinity', () => {
    expect(progressRatio(100, 0)).toBe(0);
    expect(Number.isFinite(progressRatio(10, 2000))).toBe(true);
  });

  it('L-6 quick add rejects an empty name, negatives, letters, and 50000 kcal; 0 kcal is allowed', () => {
    expect(validateQuickAdd({ name: '', kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: null, grams: 100 }).issues.length).toBeGreaterThan(0);
    expect(validateQuickAdd({ name: 'Water', kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, grams: 250 }).issues).toEqual([]);
    expect(validateQuickAdd({ name: 'Cake', kcal: 50000, proteinG: 0, carbsG: 0, fatG: 0, fiberG: null, grams: 100 }).issues.join(' ')).toMatch(/10,000/);
    expect(validateQuickAdd({ name: 'Soup', kcal: -5, proteinG: 1, carbsG: 1, fatG: 1, fiberG: null, grams: 100 }).issues.join(' ')).toMatch(/negative/);
  });

  it('L-7 mismatched quick-add macros warn and still have no blocking issue', () => {
    const result = validateQuickAdd({ name: 'Guess', kcal: 100, proteinG: 40, carbsG: 40, fatG: 40, fiberG: null, grams: 100 });
    expect(result.issues).toEqual([]);
    expect(result.mismatch).toBeTruthy();
  });

  it('Harris-Benedict revised matches the worked example', () => {
    expect(harrisBenedictRevised('male', 80, 180, 30)).toBeCloseTo(1853.6, 1);
  });
});

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_FACTORS,
  assessTargets,
  buildMacroPlan,
  effectiveCalorieFloor,
  fatFloorGrams,
  lowestPassingWhole,
  macroEnergy,
  mifflinSexFor,
  resolveFormula,
  type ActivityLevel,
  type Goal,
  type PlanInput,
  type Sex,
} from './nutrition';
import { parseCustomOffset } from './offset';
import { projectV1 } from './projection';

const man80: PlanInput = { sex: 'male', age: 30, heightCm: 180, weightKg: 80, bodyFatPct: null, activity: 'moderate', goal: 'cut' };

function check(plan: ReturnType<typeof buildMacroPlan>, sex: Sex, weightKg: number, goal?: Goal) {
  return assessTargets({ kcal: plan.kcal, proteinG: plan.proteinG, carbsG: plan.carbsG, fatG: plan.fatG }, sex, plan.bmr, weightKg, plan.tdee, goal);
}

describe('Fix 1 / R-1: default plans pass their own target check', () => {
  it('70 kg woman, 165 cm, 30 y, sedentary cut: 1420 kcal against a 1420.25 floor is accepted', () => {
    const plan = buildMacroPlan({ sex: 'female', age: 30, heightCm: 165, weightKg: 70, bodyFatPct: null, activity: 'sedentary', goal: 'cut' });
    expect(plan.bmr).toBeCloseTo(1420.25, 9);
    expect(plan.kcal).toBe(1420);
    expect(plan.calorieFloor).toBeCloseTo(1420.25, 9);
    const review = check(plan, 'female', 70, 'cut');
    expect(review.blocking).toBe(false);
  });

  it('messages show whole-number floors, never decimals', () => {
    const review = assessTargets({ kcal: 1000, proteinG: 100, carbsG: 100, fatG: 50 }, 'female', 1615.25, 70, 1900);
    const message = review.issues.find((issue) => issue.field === 'kcal')?.message ?? '';
    expect(message).not.toMatch(/\d\.\d/);
    expect(message).toContain('1615 kcal');
    expect(lowestPassingWhole(1420.25)).toBe(1420);
    expect(lowestPassingWhole(1420.5)).toBe(1420);
    expect(lowestPassingWhole(1420.51)).toBe(1421);
  });

  it('a 0.5 tolerance applies to fat too, and a real shortfall is still blocked', () => {
    const floor = fatFloorGrams(1420, 70); // 42 g (0.6 g/kg)
    expect(assessTargets({ kcal: 1420, proteinG: 150, carbsG: 100, fatG: floor - 0.4 }, 'female', 1420.25, 70, 1704).blocking).toBe(false);
    expect(assessTargets({ kcal: 1420, proteinG: 150, carbsG: 100, fatG: floor - 0.6 }, 'female', 1420.25, 70, 1704).blocking).toBe(true);
  });

  it('floor is min(F, TDEE): a 45 kg woman maintaining under 1200 kcal is not blocked', () => {
    const plan = buildMacroPlan({ sex: 'female', age: 50, heightCm: 150, weightKg: 45, bodyFatPct: null, activity: 'sedentary', goal: 'maintain' });
    expect(plan.tdee).toBeLessThan(1200);
    expect(plan.kcal).toBe(Math.round(plan.tdee));
    expect(effectiveCalorieFloor('female', plan.bmr, plan.tdee)).toBeCloseTo(plan.tdee, 9);
    expect(check(plan, 'female', 45, 'maintain').blocking).toBe(false);
    // Without the TDEE the old behaviour would have blocked her.
    expect(assessTargets({ kcal: plan.kcal, proteinG: plan.proteinG, carbsG: plan.carbsG, fatG: plan.fatG }, 'female', plan.bmr, 45).blocking).toBe(true);
    // A deficit is still never offered to her.
    const cut = buildMacroPlan({ sex: 'female', age: 50, heightCm: 150, weightKg: 45, bodyFatPct: null, activity: 'sedentary', goal: 'cut' });
    expect(cut.goalAllowed).toBe(false);
    expect(cut.kcal).toBe(plan.kcal);
  });

  it('the floor still blocks a typed target below it', () => {
    expect(assessTargets({ kcal: 1100, proteinG: 80, carbsG: 100, fatG: 40 }, 'female', 1000, 60, 2000).blocking).toBe(true);
    expect(assessTargets({ kcal: 1499, proteinG: 80, carbsG: 100, fatG: 60 }, 'unspecified', 1000, 60, 2000).blocking).toBe(true);
  });

  it('R-1 sweep: 45–200 kg, 150–200 cm, 18–80 y, both sexes, all 5 PALs, on a cut: 0 failures', () => {
    let count = 0;
    const failures: string[] = [];
    for (const sex of ['male', 'female'] as const) {
      for (const activity of Object.keys(ACTIVITY_FACTORS) as ActivityLevel[]) {
        for (let weightKg = 45; weightKg <= 200; weightKg += 0.5) {
          for (let heightCm = 150; heightCm <= 200; heightCm += 10) {
            for (let age = 18; age <= 80; age += 7) {
              const plan = buildMacroPlan({ sex, age, heightCm, weightKg, bodyFatPct: null, activity, goal: 'cut' });
              count += 1;
              const review = check(plan, sex, weightKg, plan.goal);
              const blocking = review.issues.filter((issue) => issue.blocking);
              if (blocking.length || plan.carbsG < 0 || plan.proteinG > Math.round((plan.kcal * 0.35) / 4) + 1) {
                failures.push(`${sex} ${activity} ${weightKg}kg ${heightCm}cm ${age}y: ${blocking.map((issue) => issue.message).join(' | ')}`);
              }
            }
          }
        }
      }
    }
    expect(count).toBeGreaterThan(100000);
    expect(failures.slice(0, 5)).toEqual([]);
  });

  it('the same sweep holds for maintain and bulk, with body fat entered (Katch) and unspecified sex', () => {
    const failures: string[] = [];
    for (const sex of ['female', 'unspecified'] as const) {
      for (const goal of ['maintain', 'bulk', 'cut'] as const) {
        for (let weightKg = 45; weightKg <= 200; weightKg += 1.5) {
          for (const bodyFatPct of [null, 12, 35]) {
            const plan = buildMacroPlan({ sex, age: 44, heightCm: 165, weightKg, bodyFatPct, activity: 'light', goal });
            if (check(plan, sex, weightKg, plan.goal).issues.some((issue) => issue.blocking)) failures.push(`${sex} ${goal} ${weightKg} ${bodyFatPct}`);
          }
        }
      }
    }
    expect(failures.slice(0, 5)).toEqual([]);
  });
});

describe('O-5c / C-6: a 55 kg, 60 y man asking for a cut gets no cut', () => {
  it('deficit unavailable, target = TDEE ≈ 1506', () => {
    const plan = buildMacroPlan({ sex: 'male', age: 60, heightCm: 160, weightKg: 55, bodyFatPct: null, activity: 'sedentary', goal: 'cut' });
    expect(plan.bmr).toBeCloseTo(1255, 9);
    expect(plan.tdee).toBeCloseTo(1506, 9);
    expect(plan.maxSafeOffset).toBeCloseTo(6, 9);
    expect(plan.deficitUnavailable).toBe(true);
    expect(plan.goalAllowed).toBe(false);
    expect(plan.goal).toBe('maintain');
    expect(plan.kcal).toBe(1506);
    expect(plan.goalBlockReason).toMatch(/not available/);
    expect(check(plan, 'male', 55, plan.goal).blocking).toBe(false);
    const projection = projectV1({
      weight_kg: 55, height_cm: 160, age: 60, sex: 'male', activity_factor: 1.2, daily_offset_kcal: -300,
      tdee_override_kcal: plan.tdee, floor_kcal: plan.calorieFloor,
    });
    expect(projection.deficit_unavailable).toBe(true);
    expect(projection.effective_offset_kcal).toBe(0);
    expect(projection.target_kcal).toBeCloseTo(1506, 9);
    expect(projection.warnings.map((warning) => warning.code)).toEqual(['DEFICIT_UNAVAILABLE']);
  });
});

describe('Fix 4 / G-3b / R-4: fat rules', () => {
  it('O-2 man on a cut: 2207 kcal, P176, F64, C232', () => {
    const plan = buildMacroPlan(man80);
    expect(plan.kcal).toBe(2207);
    expect(plan.proteinG).toBe(176);
    expect(plan.fatG).toBe(64);
    expect(plan.carbsG).toBe(232);
    expect(plan.proteinCapped).toBe(false);
  });

  it('85 kg extra-active man on a cut gets 68 g, not 79 g', () => {
    const plan = buildMacroPlan({ ...man80, weightKg: 85, activity: 'extra' });
    expect(plan.fatG).toBe(68);
  });

  it('cut fat = max(0.8 g/kg, 20% kcal): 80 kg → 64 g, 45 kg → 36 g', () => {
    expect(buildMacroPlan(man80).fatG).toBe(64);
    const woman45 = buildMacroPlan({ sex: 'female', age: 25, heightCm: 150, weightKg: 45, bodyFatPct: null, activity: 'very', goal: 'cut' });
    expect(woman45.goalAllowed).toBe(true);
    expect(woman45.fatG).toBe(36);
    // the 20% term only binds when kcal is large relative to weight
    const lowWeightHighKcal = buildMacroPlan({ sex: 'male', age: 20, heightCm: 200, weightKg: 75, bodyFatPct: null, activity: 'extra', goal: 'cut' });
    expect(lowWeightHighKcal.goalAllowed).toBe(true);
    expect(lowWeightHighKcal.fatG).toBeGreaterThan(60);
    expect(lowWeightHighKcal.fatG).toBe(Math.round(Math.max(0.8 * 75, (0.2 * lowWeightHighKcal.kcal) / 9)));
  });

  it('G-3b: hard floors are 0.6 g/kg or 20% kcal; 60 g is below the cut default for the 80 kg man', () => {
    expect(fatFloorGrams(2207, 80)).toBeCloseTo(49.04, 1);
    expect(fatFloorGrams(2759, 80)).toBeCloseTo(61.31, 1);
    expect(fatFloorGrams(1200, 45)).toBeCloseTo(27, 6);
    const review = assessTargets({ kcal: 2207, proteinG: 176, carbsG: 250, fatG: 60 }, 'male', 1780, 80, 2759, 'cut');
    expect(review.blocking).toBe(false);
    expect(review.issues.some((issue) => issue.field === 'fatG' && !issue.blocking)).toBe(true);
    expect(assessTargets({ kcal: 2207, proteinG: 176, carbsG: 250, fatG: 40 }, 'male', 1780, 80, 2759, 'cut').blocking).toBe(true);
    expect(assessTargets({ kcal: 2207, proteinG: 176, carbsG: 232, fatG: 64 }, 'male', 1780, 80, 2759, 'cut').issues.some((issue) => issue.field === 'fatG')).toBe(false);
  });

  it('R-4: maintain and bulk use max(25% kcal, 0.6 g/kg, 20% kcal)', () => {
    const maintain = buildMacroPlan({ ...man80, goal: 'maintain' });
    expect(maintain.fatG).toBe(77);
    const bulk = buildMacroPlan({ ...man80, goal: 'bulk' });
    expect(bulk.fatG).toBe(84);
    // heavy and low calorie: 0.6 g/kg binds over 25% of kcal
    const heavy = buildMacroPlan({ sex: 'female', age: 60, heightCm: 150, weightKg: 130, bodyFatPct: null, activity: 'sedentary', goal: 'maintain' });
    expect(heavy.fatG).toBe(Math.round(Math.max((0.25 * heavy.tdee) / 9, 0.6 * 130)));
    for (const goal of ['maintain', 'bulk'] as const) {
      for (let weightKg = 45; weightKg <= 200; weightKg += 5) {
        const plan = buildMacroPlan({ sex: 'female', age: 55, heightCm: 155, weightKg, bodyFatPct: null, activity: 'sedentary', goal });
        expect(plan.fatG).toBeGreaterThanOrEqual(Math.round(0.6 * weightKg));
      }
    }
  });
});

describe('Fix 3 / R-3: heavy cuts never get negative carbs', () => {
  it('150 kg / 180 cm / 40 y sedentary man on a cut', () => {
    const plan = buildMacroPlan({ sex: 'male', age: 40, heightCm: 180, weightKg: 150, bodyFatPct: null, activity: 'sedentary', goal: 'cut' });
    expect(plan.bmr).toBeCloseTo(2430, 6);
    expect(plan.tdee).toBeCloseTo(2916, 6);
    // The 20% cut would be 2333 kcal, but the calorie floor is max(1500, BMR) = 2430, so the
    // target is held at the BMR floor (spec 2.5/2.6). The QA checklist's "≈ 2333" ignores that floor.
    expect(plan.capped).toBe(true);
    expect(plan.rawKcal).toBeCloseTo(2332.8, 6);
    expect(plan.kcal).toBe(2430);
    expect(plan.proteinCapped).toBe(true);
    expect(plan.proteinG * 4).toBeLessThanOrEqual(0.35 * plan.kcal + 2);
    expect(plan.proteinG).toBeLessThan(330);
    expect(plan.fatG).toBeGreaterThanOrEqual(120);
    expect(plan.carbsG).toBeGreaterThanOrEqual(0);
    expect(Math.abs(macroEnergy(plan.proteinG, plan.carbsG, plan.fatG) - plan.kcal)).toBeLessThanOrEqual(4);
    expect(check(plan, 'male', 150, 'cut').blocking).toBe(false);
  });

  it('200 kg / 175 cm / 50 y woman on a cut', () => {
    const plan = buildMacroPlan({ sex: 'female', age: 50, heightCm: 175, weightKg: 200, bodyFatPct: null, activity: 'sedentary', goal: 'cut' });
    expect(plan.carbsG).toBeGreaterThanOrEqual(0);
    expect(plan.proteinG * 4).toBeLessThanOrEqual(0.35 * plan.kcal + 2);
    expect(Math.abs(macroEnergy(plan.proteinG, plan.carbsG, plan.fatG) - plan.kcal)).toBeLessThanOrEqual(4);
    expect(check(plan, 'female', 200, 'cut').blocking).toBe(false);
  });

  it('spec 2.5 example: 120 kg woman cut → 1870 kcal, protein capped at 164 g, fat 96 g, carbs 88 g', () => {
    const plan = buildMacroPlan({ sex: 'female', age: 40, heightCm: 165, weightKg: 120, bodyFatPct: null, activity: 'sedentary', goal: 'cut' });
    expect(plan.kcal).toBe(1870);
    expect(plan.proteinUncappedG).toBe(264);
    expect(plan.proteinG).toBe(164);
    expect(plan.fatG).toBe(96);
    expect(plan.carbsG).toBe(88);
    expect(plan.veryLowCarb).toBe(false);
  });

  it('very heavy floor-bound cut: fat is trimmed toward its floor before carbs are clamped', () => {
    const plan = buildMacroPlan({ sex: 'male', age: 90, heightCm: 100, weightKg: 250, bodyFatPct: null, activity: 'sedentary', goal: 'cut' });
    expect(plan.goalAllowed).toBe(true);
    expect(plan.fatTrimmed).toBe(true);
    expect(plan.fatG).toBeLessThan(Math.round(0.8 * 250));
    expect(plan.fatG).toBeGreaterThanOrEqual(Math.floor(fatFloorGrams(plan.kcal, 250)));
    expect(plan.carbsG).toBe(0);
    expect(plan.veryLowCarb).toBe(true);
    expect(plan.macroOvershoot).toBe(false);
    expect(Math.abs(macroEnergy(plan.proteinG, plan.carbsG, plan.fatG) - plan.kcal)).toBeLessThanOrEqual(6);
  });

  it('low-carb warning appears under 50 g and is not a block', () => {
    const review = assessTargets({ kcal: 2000, proteinG: 200, carbsG: 40, fatG: 100 }, 'male', 1700, 80, 2500, 'maintain');
    expect(review.blocking).toBe(false);
    expect(review.issues.find((issue) => issue.field === 'carbsG')?.message).toMatch(/under 50 g/);
  });

  it('user-typed protein is never capped or altered', () => {
    const review = assessTargets({ kcal: 1870, proteinG: 264, carbsG: 20, fatG: 96 }, 'female', 1870, 120, 2244, 'cut');
    expect(review.blocking).toBe(false);
  });
});

describe('Fix 5: one resolved formula everywhere', () => {
  const input: PlanInput = { ...man80, goal: 'maintain', bodyFatPct: 15 };
  it('auto uses Katch when body fat is entered, and the user can switch back to Mifflin', () => {
    expect(resolveFormula(input)).toBe('katch');
    const katch = buildMacroPlan(input);
    expect(katch.formula).toBe('katch');
    expect(katch.bmr).toBeCloseTo(1838.8, 6);
    expect(katch.formulaNote).toMatch(/Katch/);
    const mifflin = buildMacroPlan({ ...input, formula: 'mifflin' });
    expect(mifflin.formula).toBe('mifflin');
    expect(mifflin.bmr).toBe(1780);
    expect(mifflin.formulaNote).toMatch(/Mifflin/);
  });

  it('a projection built from the resolved plan matches the plan: same TDEE, target and floor', () => {
    const plan = buildMacroPlan(input);
    const projection = projectV1({
      weight_kg: 80, height_cm: 180, age: 30, sex: plan.mifflinSex, activity_factor: 1.55,
      daily_offset_kcal: -500, tdee_override_kcal: plan.tdee, floor_kcal: plan.calorieFloor,
    });
    expect(projection.tdee_kcal).toBeCloseTo(plan.tdee, 9);
    expect(projection.target_kcal).toBeCloseTo(plan.tdee - 500, 9);
    const plain = projectV1({ weight_kg: 80, height_cm: 180, age: 30, sex: 'male', activity_factor: 1.55, daily_offset_kcal: -500 });
    expect(projection.tdee_kcal).not.toBeCloseTo(plain.tdee_kcal, 0);
  });
});

describe('Fix 6: unspecified sex', () => {
  const base: PlanInput = { sex: 'unspecified', age: 30, heightCm: 170, weightKg: 70, bodyFatPct: null, activity: 'moderate', goal: 'maintain' };
  it('defaults to Mifflin −78 with an explanatory note and the 1500 floor', () => {
    const plan = buildMacroPlan(base);
    expect(plan.bmr).toBe(700 + 1062.5 - 150 - 78);
    expect(plan.formulaNote).toMatch(/average/i);
    expect(plan.formulaNote).toMatch(/male or female constant/);
    expect(plan.mifflinSex).toBe('unspecified');
    const cut = buildMacroPlan({ ...base, activity: 'sedentary', goal: 'cut' });
    expect(cut.calorieFloor).toBeLessThanOrEqual(Math.max(1500, cut.bmr) + 1e-9);
  });
  it('the user can pick the male (+5) or female (−161) constant; the floor stays 1500', () => {
    const male = buildMacroPlan({ ...base, sexConstant: 'male' });
    const female = buildMacroPlan({ ...base, sexConstant: 'female' });
    expect(male.bmr).toBe(700 + 1062.5 - 150 + 5);
    expect(female.bmr).toBe(700 + 1062.5 - 150 - 161);
    expect(male.formulaNote).toMatch(/male constant \(\+5\)/);
    expect(female.formulaNote).toMatch(/female constant \(−161\)/);
    expect(mifflinSexFor('unspecified', 'male')).toBe('male');
    expect(mifflinSexFor('female', 'male')).toBe('female');
    const lowTdee = buildMacroPlan({ ...base, weightKg: 45, heightCm: 150, age: 70, sexConstant: 'female', activity: 'sedentary', goal: 'cut' });
    expect(lowTdee.calorieFloor).toBeLessThanOrEqual(1500);
    expect(effectiveCalorieFloor('unspecified', 1000, 5000)).toBe(1500);
  });
});

describe('Fix 2 / R-2: custom offset parsing', () => {
  it("'-300' is a deficit of 300", () => {
    const parsed = parseCustomOffset('-300', 'surplus');
    expect(parsed.valid).toBe(true);
    expect(parsed.offset).toBe(-300);
    expect(parsed.direction).toBe('deficit');
  });
  it("'+300' and '300' are a surplus when no toggle says otherwise", () => {
    expect(parseCustomOffset('+300').offset).toBe(300);
    expect(parseCustomOffset('300').offset).toBe(300);
    expect(parseCustomOffset('+300', 'deficit').offset).toBe(300);
  });
  it('an unsigned number follows the deficit/surplus toggle', () => {
    expect(parseCustomOffset('300', 'deficit').offset).toBe(-300);
    expect(parseCustomOffset('300', 'surplus').offset).toBe(300);
  });
  it("a Unicode minus '−300' is a deficit of 300", () => {
    expect(parseCustomOffset('\u2212300').offset).toBe(-300);
    expect(parseCustomOffset('\u2013300', 'surplus').offset).toBe(-300);
  });
  it("'--300', '-', '+', '-+3' and junk are invalid and never a surplus", () => {
    for (const text of ['--300', '-', '+', '-+3', '+-3', '\u2212\u2212300', 'abc', '3-00', '300-', '--', '1e3']) {
      const parsed = parseCustomOffset(text, 'surplus');
      expect(parsed.valid, text).toBe(false);
      expect(parsed.offset, text).toBe(0);
      expect(parsed.message, text).toBeTruthy();
    }
  });
  it('accepts decimals with comma or dot, whitespace, and empty text is a valid zero', () => {
    expect(parseCustomOffset('-12,5').offset).toBe(-12.5);
    expect(parseCustomOffset(' - 250 ').offset).toBe(-250);
    expect(parseCustomOffset('').empty).toBe(true);
    expect(parseCustomOffset('').offset).toBe(0);
  });
  it('the projection sign matches: -300 projects a loss, 300 in surplus a gain', () => {
    const run = (offset: number) => projectV1({ weight_kg: 80, height_cm: 180, age: 30, sex: 'male', activity_factor: 1.55, daily_offset_kcal: offset });
    expect(run(parseCustomOffset('-300', 'surplus').offset).horizons[0].delta_kg).toBeLessThan(0);
    expect(run(parseCustomOffset('+300', 'deficit').offset).horizons[0].delta_kg).toBeGreaterThan(0);
  });
});

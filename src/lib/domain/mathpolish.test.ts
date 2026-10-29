import { describe, expect, it } from 'vitest';
import {
  MAX_TARGET_KCAL,
  MIN_PLAUSIBLE_BMR,
  PROTEIN_KCAL,
  assessTargets,
  bodyPlausibilityIssue,
  buildMacroPlan,
  maxTargetGrams,
  planNotes,
  targetNotices,
  type PlanInput,
} from './index';
import { parseCustomOffset } from './offset';
import { en } from '../../i18n/testing';

const base: PlanInput = { sex: 'male', age: 30, heightCm: 180, weightKg: 80, bodyFatPct: null, activity: 'moderate', goal: 'maintain' };

function review(plan: ReturnType<typeof buildMacroPlan>, weightKg: number, sex: PlanInput['sex'] = 'male') {
  return assessTargets({ kcal: plan.kcal, proteinG: plan.proteinG, carbsG: plan.carbsG, fatG: plan.fatG }, sex, plan.bmr, weightKg, plan.tdee, plan.goal);
}

describe('A1: the generated plan is never blocked by the calorie ceiling', () => {
  it('a 300 kg, 3% body fat, very active Katch bulk (the worst case) is below the limit and passes', () => {
    const plan = buildMacroPlan({ ...base, weightKg: 300, heightCm: 250, bodyFatPct: 3, activity: 'extra', goal: 'bulk' });
    expect(plan.formula).toBe('katch');
    expect(plan.kcal).toBeGreaterThan(10000);
    expect(plan.kcal).toBeLessThanOrEqual(MAX_TARGET_KCAL);
    expect(review(plan, 300).blocking).toBe(false);
  });

  it('sweeps lean heavy profiles (200–300 kg, 3–15% fat, all activities and goals): the unedited plan is never blocked', () => {
    const activities = ['sedentary', 'light', 'moderate', 'very', 'extra'] as const;
    for (let weightKg = 200; weightKg <= 300; weightKg += 10) {
      for (const bodyFatPct of [3, 6, 10, 15]) {
        for (const activity of activities) {
          for (const goal of ['maintain', 'bulk', 'cut'] as const) {
            const plan = buildMacroPlan({ ...base, weightKg, heightCm: 220, bodyFatPct, activity, goal });
            if (goal === 'cut' && !plan.goalAllowed) continue;
            expect(plan.kcal).toBeLessThanOrEqual(MAX_TARGET_KCAL);
            const blockers = review(plan, weightKg).issues.filter((issue) => issue.blocking);
            expect(blockers.map((issue) => en(issue.message))).toEqual([]);
          }
        }
      }
    }
  });

  it('the per-macro gram limit follows the ceiling: the generated 2,068 g of carbs passes, 3,751 g typed is blocked', () => {
    const plan = buildMacroPlan({ ...base, weightKg: 300, heightCm: 250, bodyFatPct: 3, activity: 'extra', goal: 'bulk' });
    expect(plan.carbsG).toBeGreaterThan(2000);
    expect(plan.carbsG).toBeLessThanOrEqual(maxTargetGrams('carbsG'));
    const typed = assessTargets({ kcal: 9000, proteinG: 100, carbsG: 3751, fatG: 50 }, 'male', 1800, 80, 2500, 'maintain');
    expect(typed.issues.map((issue) => en(issue.message)).join(' ')).toMatch(/Carbs is above 3,750 g/);
  });

  it('a typed target above the new ceiling is still blocked, with the limit in the message', () => {
    const result = assessTargets({ kcal: 15001, proteinG: 100, carbsG: 100, fatG: 50 }, 'male', 1800, 80, 2500, 'maintain');
    expect(result.blocking).toBe(true);
    expect(result.issues.map((issue) => en(issue.message)).join(' ')).toMatch(/15,000 kcal/);
  });
});

describe('A2: soft note when custom protein is above 35% of calories', () => {
  const draft = (proteinG: number) => ({ kcal: 2000, proteinG, carbsG: 150, fatG: 60 });

  it('375 g protein (75%) gives a non-blocking note with the share', () => {
    const notices = targetNotices(draft(375));
    const note = notices.find((issue) => issue.field === 'proteinG');
    expect(note?.blocking).toBe(false);
    expect(en(note!.message)).toMatch(/about 75% of your calories/);
    const result = assessTargets(draft(375), 'male', 1800, 80, 2500, 'maintain');
    expect(result.issues.some((issue) => issue.field === 'proteinG' && !issue.blocking)).toBe(true);
  });

  it('exactly 35% (175 g of 2,000 kcal) and below gives no note', () => {
    expect(targetNotices(draft(175)).some((issue) => issue.field === 'proteinG')).toBe(false);
    expect(targetNotices(draft(120)).some((issue) => issue.field === 'proteinG')).toBe(false);
  });

  it('a generated plan, which already caps protein at 35%, never triggers the note', () => {
    for (const weightKg of [30, 45, 60, 80, 120, 200, 300]) {
      for (const goal of ['maintain', 'bulk', 'cut'] as const) {
        const plan = buildMacroPlan({ ...base, weightKg, heightCm: 170, goal });
        const notices = targetNotices({ kcal: plan.kcal, proteinG: plan.proteinG, carbsG: plan.carbsG, fatG: plan.fatG });
        expect(notices.some((issue) => issue.field === 'proteinG')).toBe(false);
        expect(plan.proteinG * PROTEIN_KCAL).toBeLessThanOrEqual(plan.kcal * 0.35 + 3);
      }
    }
  });
});

describe('A3: regenerated plans explain their adjustments', () => {
  it('lists the protein limit and the fat trim for a heavy low-calorie plan', () => {
    const plan = buildMacroPlan({ ...base, weightKg: 140, heightCm: 150, age: 80, sex: 'female', activity: 'sedentary', goal: 'cut' });
    const notes = planNotes(plan).map((note) => note.key);
    if (plan.proteinCapped) expect(notes).toContain('onboarding.proteinLimited');
    if (plan.fatTrimmed) expect(notes).toContain('onboarding.fatTrimmed');
    if (plan.capped) expect(notes[0]).toBe(plan.capReason?.key);
  });

  it('every kind of adjustment produces its own note, and an unadjusted plan produces none', () => {
    expect(planNotes(buildMacroPlan(base))).toEqual([]);
    let sawProtein = false;
    let sawTrim = false;
    for (let weightKg = 30; weightKg <= 300; weightKg += 5) {
      for (const goal of ['maintain', 'bulk', 'cut'] as const) {
        const plan = buildMacroPlan({ ...base, weightKg, heightCm: 150, age: 70, sex: 'female', activity: 'sedentary', goal });
        const keys = planNotes(plan).map((note) => note.key);
        expect(keys.includes('onboarding.proteinLimited')).toBe(plan.proteinCapped);
        expect(keys.includes('onboarding.fatTrimmed')).toBe(plan.fatTrimmed);
        expect(keys.includes('plan.macroOvershoot')).toBe(plan.macroOvershoot);
        sawProtein ||= plan.proteinCapped;
        sawTrim ||= plan.fatTrimmed;
      }
    }
    expect(sawProtein || sawTrim).toBe(true);
  });

  it('macroOvershoot becomes a visible note with the calorie figure', () => {
    const plan = { ...buildMacroPlan(base), macroOvershoot: true, capped: false, proteinCapped: false, fatTrimmed: false };
    const [note] = planNotes(plan);
    expect(note.key).toBe('plan.macroOvershoot');
    expect(en(note)).toMatch(/carbs are set to 0/);
  });

  it('the cap note can be left out where the screen already shows it', () => {
    const plan = { ...buildMacroPlan(base), capped: true, capReason: { key: 'onboarding.fatTrimmed' as const }, proteinCapped: false, fatTrimmed: false, macroOvershoot: false };
    expect(planNotes(plan)).toHaveLength(1);
    expect(planNotes(plan, false)).toHaveLength(0);
  });
});

describe('A4: a custom "-0" is a zero offset, not -0', () => {
  it.each(['-0', '−0', '-0.0', '+0', '0', '-00'])('%s gives +0', (raw) => {
    const parsed = parseCustomOffset(raw);
    expect(parsed.valid).toBe(true);
    expect(Object.is(parsed.offset, 0)).toBe(true);
  });
  it('real offsets keep their sign', () => {
    expect(parseCustomOffset('-300').offset).toBe(-300);
    expect(parseCustomOffset('+300').offset).toBe(300);
  });
});

describe('A5: an unrealistic body (very low energy) is flagged with a clear message', () => {
  it('30 kg, 100 cm, 120 years is blocked', () => {
    const issue = bodyPlausibilityIssue({ sex: 'female', age: 120, heightCm: 100, weightKg: 30, bodyFatPct: null });
    expect(issue).not.toBeNull();
    expect(en(issue!)).toMatch(/resting energy of only \d+ kcal a day, which is not realistic/);
    expect(buildMacroPlan({ ...base, sex: 'female', age: 120, heightCm: 100, weightKg: 30 }).implausible).not.toBeNull();
  });

  it('every normal profile, including the lightest and oldest realistic ones, passes', () => {
    for (const sex of ['female', 'male', 'unspecified'] as const) {
      for (const [age, heightCm, weightKg] of [[18, 150, 40], [90, 150, 40], [100, 155, 42], [30, 180, 80], [60, 165, 55], [18, 250, 300]]) {
        const plan = buildMacroPlan({ ...base, sex, age, heightCm, weightKg });
        expect(plan.bmr, `${sex} ${age}/${heightCm}/${weightKg}`).toBeGreaterThanOrEqual(MIN_PLAUSIBLE_BMR);
        expect(plan.implausible).toBeNull();
      }
    }
  });
});

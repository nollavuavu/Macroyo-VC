/**
 * Body-composition, energy, and macro targets.
 * Metric internally. Display conversions live here so the UI stays free of formulas.
 */

import {
  bmrMifflin,
  defaultFloorKcal,
  maxSafeOffset,
  projectV1,
  roundHalfUp,
  type ProjectionSex,
} from './projection';

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
export const PROTEIN_KCAL = 4;
export const CARB_KCAL = 4;
export const FAT_KCAL = 9;

export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
} as const;

export type ActivityLevel = keyof typeof ACTIVITY_FACTORS;
export type Goal = 'cut' | 'maintain' | 'bulk';
export type BmrFormula = 'mifflin' | 'katch';
export type Sex = ProjectionSex;

export const ACTIVITY_DETAILS: Record<ActivityLevel, { label: string; description: string }> = {
  sedentary: { label: 'Sedentary', description: 'Little or no exercise, desk job' },
  light: { label: 'Lightly active', description: 'Light exercise 1–3 days a week' },
  moderate: { label: 'Moderately active', description: 'Moderate exercise 3–5 days a week' },
  very: { label: 'Very active', description: 'Hard exercise 6–7 days a week' },
  extra: { label: 'Extra active', description: 'Very hard training plus a physical job' },
};

export const GOAL_DETAILS: Record<Goal, { label: string; description: string }> = {
  cut: { label: 'Lose fat', description: 'About 20% under maintenance' },
  maintain: { label: 'Maintain', description: 'Eat at maintenance' },
  bulk: { label: 'Build muscle', description: 'About 10% over maintenance' },
};

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function inchesToCm(inches: number): number {
  return inches * CM_PER_IN;
}

export function cmToInches(cm: number): number {
  return cm / CM_PER_IN;
}

export function feetInchesToCm(feet: number, inches: number): number {
  return inchesToCm(feet * 12 + inches);
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const total = cmToInches(cm);
  let feet = Math.floor(total / 12);
  let inches = total - feet * 12;
  if (inches >= 11.95) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}

/** Accepts 80.5 and 80,5. Returns null for empty or non-numeric text. */
export function parseDecimal(raw: string): number | null {
  const text = raw.trim().replace(/\s/g, '');
  if (!text) return null;
  if (!/^[-+]?(\d+([.,]\d+)?|[.,]\d+)$/.test(text)) return null;
  const normalized = text.replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function bmiMetric(weightKg: number, heightCm: number): number | null {
  if (!(weightKg > 0) || !(heightCm > 0)) return null;
  return weightKg / (heightCm / 100) ** 2;
}

export function bmiImperial(weightLb: number, heightIn: number): number | null {
  if (!(weightLb > 0) || !(heightIn > 0)) return null;
  return (703 * weightLb) / heightIn ** 2;
}

export interface BmiClass {
  /** Large label. "Obesity range" instead of shouting the class. */
  label: string;
  /** Smaller WHO detail, including thinness and obese class. */
  detail: string | null;
  /** Stable WHO name used by tests: Underweight, Normal, Overweight, Obese class I/II/III. */
  who: string;
}

export function bmiCategory(bmi: number): BmiClass {
  const boundaries = [16, 17, 18.5, 25, 30, 35, 40];
  let value = bmi;
  for (const boundary of boundaries) {
    if (Math.abs(bmi - boundary) < 1e-8) value = boundary;
  }
  bmi = value;
  if (bmi < 16) return { label: 'Underweight', detail: 'Severe thinness', who: 'Underweight' };
  if (bmi < 17) return { label: 'Underweight', detail: 'Moderate thinness', who: 'Underweight' };
  if (bmi < 18.5) return { label: 'Underweight', detail: 'Mild thinness', who: 'Underweight' };
  if (bmi < 25) return { label: 'Normal', detail: null, who: 'Normal' };
  if (bmi < 30) return { label: 'Overweight', detail: null, who: 'Overweight' };
  if (bmi < 35) return { label: 'Obesity range', detail: 'Obese class I', who: 'Obese class I' };
  if (bmi < 40) return { label: 'Obesity range', detail: 'Obese class II', who: 'Obese class II' };
  return { label: 'Obesity range', detail: 'Obese class III', who: 'Obese class III' };
}

/** Colour role for BMI text: green only for the normal band, amber otherwise. Never red. */
export type BmiTone = 'success' | 'warning';

export function bmiTone(bmi: number): BmiTone {
  return bmiCategory(bmi).who === 'Normal' ? 'success' : 'warning';
}

export function isUnderweightBmi(bmi: number): boolean {
  return bmi < 18.5;
}

export function leanMassKg(weightKg: number, bodyFatPct: number): number {
  return weightKg * (1 - bodyFatPct / 100);
}

export function ffmiValue(leanKg: number, heightCm: number): number | null {
  if (!(heightCm > 0)) return null;
  return leanKg / (heightCm / 100) ** 2;
}

export function normalizedFfmi(ffmi: number, heightCm: number): number {
  return ffmi + 6.1 * (1.8 - heightCm / 100);
}

export interface FfmiReading {
  band: string | null;
  label: string;
  detail: string;
  /** Bands are only meaningful for men. */
  banded: boolean;
}

/**
 * Bands follow the science brief (men only), applied to the value rounded to 0.1
 * so the label matches the number on screen. Lower bound is inclusive.
 * Copy never uses "natural" or "enhanced".
 */
export function interpretFfmi(sex: Sex, normalized: number): FfmiReading {
  if (sex !== 'male') {
    return {
      band: null,
      label: 'Not banded',
      detail: 'These ranges come from studies of men and are not validated for women. The number is shown on its own.',
      banded: false,
    };
  }
  const shown = roundHalfUp(normalized, 1);
  let band = 'Above the range usually reported';
  if (shown < 18) band = 'Below average';
  else if (shown < 20) band = 'Average';
  else if (shown < 22) band = 'Above average';
  else if (shown < 23) band = 'Excellent';
  else if (shown <= 25) band = 'Superior';
  return {
    band,
    label: band,
    detail: 'Informal coaching ranges for men, not a medical category.',
    banded: true,
  };
}

export function katchMcArdle(leanKg: number): number {
  return 370 + 21.6 * leanKg;
}

export function harrisBenedictRevised(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  if (sex === 'male') return 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age;
  if (sex === 'female') return 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;
  const male = 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age;
  const female = 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;
  return (male + female) / 2;
}

export function activityFactor(level: ActivityLevel): number {
  return ACTIVITY_FACTORS[level];
}

export function tdeeFromBmr(bmr: number, level: ActivityLevel): number {
  return bmr * ACTIVITY_FACTORS[level];
}

export function sexCalorieFloor(sex: Sex): number {
  return sex === 'female' ? 1200 : 1500;
}

export function calorieFloor(sex: Sex, bmr: number): number {
  return Math.max(sexCalorieFloor(sex), bmr);
}

/**
 * Effective floor = min(F, TDEE) where F = max(sex floor, BMR). The floor limits deficits only,
 * so a person whose TDEE is already under F is never blocked from eating at maintenance.
 */
export function effectiveCalorieFloor(sex: Sex, bmr: number, tdee: number | null | undefined): number {
  const f = calorieFloor(sex, bmr);
  return tdee != null && Number.isFinite(tdee) ? Math.min(f, tdee) : f;
}

/**
 * Targets are whole numbers while floors are fractional, so checks allow half a unit.
 * Returns the smallest whole number that passes `value + 0.5 >= floor`, which is what messages show.
 */
export function lowestPassingWhole(floor: number): number {
  return Math.ceil(floor - 0.5 - 1e-9);
}

export function proteinPerKg(goal: Goal): number {
  return goal === 'cut' ? 2.2 : 1.8;
}

/** Hard floor: the larger of 20% of kcal and 0.6 g/kg. */
export function fatFloorGrams(kcal: number, weightKg: number): number {
  return Math.max((kcal * 0.2) / FAT_KCAL, 0.6 * weightKg);
}

/** Share of kcal that protein may take in default targets (upper bound of the IOM AMDR). */
export const PROTEIN_MAX_KCAL_SHARE = 0.35;

export function macroEnergy(proteinG: number, carbsG: number, fatG: number): number {
  return proteinG * PROTEIN_KCAL + carbsG * CARB_KCAL + fatG * FAT_KCAL;
}

export interface MacroPlan {
  bmr: number;
  tdee: number;
  formula: BmrFormula;
  formulaNote: string;
  bmi: number;
  goal: Goal;
  goalAllowed: boolean;
  goalBlockReason: string | null;
  rawKcal: number;
  kcal: number;
  capped: boolean;
  capReason: string | null;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
  fatFloorG: number;
  lowCarb: boolean;
  veryLowCarb: boolean;
  macroKcal: number;
  deficitUnavailable: boolean;
  maxSafeOffset: number;
  proteinPerKg: number;
  /** Effective calorie floor min(F, TDEE) used for this plan. */
  calorieFloor: number;
  /** True when default protein was limited to 35% of kcal. */
  proteinCapped: boolean;
  /** Protein the g/kg default would have given, before the 35% cap. */
  proteinUncappedG: number;
  /** True when fat was trimmed toward its floor so carbs would not go negative. */
  fatTrimmed: boolean;
  /** True when protein plus fat still exceed kcal after trimming (carbs clamped to 0). */
  macroOvershoot: boolean;
  /** The sex constant Mifflin actually used. */
  mifflinSex: Sex;
}

/** For unspecified sex only: which Mifflin constant to use. Undefined/null means the average (−78). */
export type SexConstantChoice = 'male' | 'female';

export interface PlanInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number | null;
  activity: ActivityLevel;
  goal: Goal;
  formula?: BmrFormula;
  pregnant?: boolean;
  /** Used only when sex is unspecified. The calorie floor stays 1,500 either way. */
  sexConstant?: SexConstantChoice | null;
}

/** The sex whose Mifflin constant is applied: the chosen one for unspecified sex, else the sex itself. */
export function mifflinSexFor(sex: Sex, sexConstant?: SexConstantChoice | null): Sex {
  return sex === 'unspecified' && sexConstant ? sexConstant : sex;
}

export function resolveFormula(input: PlanInput): BmrFormula {
  if (input.formula) return input.formula;
  if (input.bodyFatPct != null && input.bodyFatPct >= 3) return 'katch';
  return 'mifflin';
}

export function buildMacroPlan(input: PlanInput): MacroPlan {
  const formula = resolveFormula(input);
  const bmi = bmiMetric(input.weightKg, input.heightCm) ?? 0;
  const mifflinSex = mifflinSexFor(input.sex, input.sexConstant);
  let bmr = bmrMifflin(input.weightKg, input.heightCm, input.age, mifflinSex);
  let formulaNote = 'Mifflin–St Jeor.';
  if (input.sex === 'unspecified') {
    formulaNote = mifflinSex === 'male'
      ? 'Mifflin–St Jeor with the male constant (+5), which you chose because sex was left unspecified.'
      : mifflinSex === 'female'
        ? 'Mifflin–St Jeor with the female constant (−161), which you chose because sex was left unspecified.'
        : 'Mifflin–St Jeor with an average constant (−78), because sex was left unspecified. You can pick the male or female constant instead.';
  }
  if (formula === 'katch' && input.bodyFatPct != null) {
    const lean = leanMassKg(input.weightKg, input.bodyFatPct);
    bmr = katchMcArdle(lean);
    formulaNote = 'Katch–McArdle, because body fat is entered. Lean or muscular people are often closer to this estimate.';
  }
  const tdee = tdeeFromBmr(bmr, input.activity);
  const floor = effectiveCalorieFloor(input.sex, bmr, tdee);
  const projectionSex: ProjectionSex = mifflinSex;
  const maxOffset = maxSafeOffset(input.weightKg, input.heightCm, tdee, bmr, projectionSex, floor);
  const deficitUnavailable = maxOffset < 100;

  let goalBlockReason: string | null = null;
  if (input.goal === 'cut') {
    if (input.pregnant) {
      goalBlockReason = 'A calorie deficit is not offered during pregnancy or breastfeeding. Please talk with your clinician.';
    } else if (bmi < 18.5) {
      goalBlockReason = `BMI is ${roundHalfUp(bmi, 1).toFixed(1)}, under 18.5. A cut is not offered. Maintenance or a surplus is available, and a clinician is the right next step.`;
    } else if (deficitUnavailable) {
      goalBlockReason = `A weight-loss target is not available. The largest safe deficit is ${roundHalfUp(maxOffset, 1).toFixed(1)} kcal/day, under 100, so intake would sit on the calorie floor.`;
    }
  }

  const goalAllowed = input.goal !== 'cut' || goalBlockReason == null;
  const effectiveGoal: Goal = goalAllowed ? input.goal : 'maintain';
  const rawKcal = effectiveGoal === 'cut' ? tdee * 0.8 : effectiveGoal === 'bulk' ? tdee * 1.1 : tdee;

  let kcalExact = rawKcal;
  let capped = false;
  let capReason: string | null = null;
  if (effectiveGoal === 'cut') {
    const limited = tdee - maxOffset;
    if (kcalExact < limited - 1e-6) {
      kcalExact = limited;
      capped = true;
      capReason = `The 20% cut would pass a safety limit, so the target is held at ${Math.round(limited)} kcal. The tightest limit is ${roundHalfUp(maxOffset, 1).toFixed(1)} kcal under maintenance.`;
    }
  }

  const kcal = roundHalfUp(kcalExact, 0);
  const proteinUncapped = input.weightKg * proteinPerKg(effectiveGoal);
  const proteinCap = (kcalExact * PROTEIN_MAX_KCAL_SHARE) / PROTEIN_KCAL;
  const proteinCapped = proteinUncapped > proteinCap + 1e-9;
  const proteinExact = Math.min(proteinUncapped, proteinCap);
  const proteinG = roundHalfUp(proteinExact, 0);

  const fatFloorExact = fatFloorGrams(kcalExact, input.weightKg);
  let fatExact = effectiveGoal === 'cut'
    ? Math.max(0.8 * input.weightKg, (0.2 * kcalExact) / FAT_KCAL)
    : Math.max((0.25 * kcalExact) / FAT_KCAL, 0.6 * input.weightKg, (0.2 * kcalExact) / FAT_KCAL);
  let fatTrimmed = false;
  let carbExact = (kcalExact - proteinExact * PROTEIN_KCAL - fatExact * FAT_KCAL) / CARB_KCAL;
  if (carbExact < 0) {
    // Trim fat toward its floor first, only as far as needed.
    const fatNeeded = Math.max(fatFloorExact, (kcalExact - proteinExact * PROTEIN_KCAL) / FAT_KCAL);
    if (fatNeeded < fatExact) {
      fatExact = fatNeeded;
      fatTrimmed = true;
    }
    carbExact = (kcalExact - proteinExact * PROTEIN_KCAL - fatExact * FAT_KCAL) / CARB_KCAL;
  }
  const macroOvershoot = carbExact < -1e-9;
  carbExact = Math.max(0, carbExact);
  const fatG = roundHalfUp(fatExact, 0);
  const carbsG = roundHalfUp(carbExact, 0);
  const fiberG = roundHalfUp((14 * kcal) / 1000, 0);
  const macroKcal = macroEnergy(proteinG, carbsG, fatG);

  return {
    bmr,
    tdee,
    formula: formula === 'katch' && input.bodyFatPct != null ? 'katch' : 'mifflin',
    formulaNote,
    bmi,
    goal: effectiveGoal,
    goalAllowed,
    goalBlockReason,
    rawKcal,
    kcal,
    capped,
    capReason,
    proteinG,
    fatG,
    carbsG,
    fiberG,
    fatFloorG: fatFloorGrams(kcal, input.weightKg),
    lowCarb: carbsG < 100,
    veryLowCarb: carbsG < 50,
    macroKcal,
    deficitUnavailable,
    maxSafeOffset: maxOffset,
    proteinPerKg: proteinPerKg(effectiveGoal),
    calorieFloor: floor,
    proteinCapped,
    proteinUncappedG: roundHalfUp(proteinUncapped, 0),
    fatTrimmed,
    macroOvershoot,
    mifflinSex,
  };
}

export interface TargetDraft {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export interface TargetIssue {
  field: 'kcal' | 'proteinG' | 'carbsG' | 'fatG';
  blocking: boolean;
  message: string;
}

export function assessTargets(
  draft: TargetDraft,
  sex: Sex,
  bmr: number,
  weightKg: number,
  tdee?: number | null,
  goal?: Goal,
): { issues: TargetIssue[]; blocking: boolean } {
  const issues: TargetIssue[] = [];
  const floor = effectiveCalorieFloor(sex, bmr, tdee);
  const floorShown = lowestPassingWhole(floor);
  if (draft.kcal == null) {
    issues.push({ field: 'kcal', blocking: true, message: 'Enter a calorie target.' });
  } else if (draft.kcal <= 0) {
    issues.push({ field: 'kcal', blocking: true, message: 'Calorie target has to be above 0.' });
  } else if (draft.kcal > 10000) {
    issues.push({ field: 'kcal', blocking: true, message: 'That target is above 10,000 kcal. Enter a smaller number.' });
  } else if (draft.kcal + 0.5 < floor) {
    issues.push({
      field: 'kcal',
      blocking: true,
      message: `That is below the ${floorShown} kcal floor for this profile. ${floorShown} kcal is the lowest target Macroyo will save.`,
    });
  }

  const grams: ['proteinG' | 'carbsG' | 'fatG', string][] = [
    ['proteinG', 'Protein'],
    ['carbsG', 'Carbs'],
    ['fatG', 'Fat'],
  ];
  for (const [field, label] of grams) {
    const value = draft[field];
    if (value == null) issues.push({ field, blocking: true, message: `Enter ${label.toLowerCase()} grams.` });
    else if (value < 0) issues.push({ field, blocking: true, message: `${label} cannot be negative.` });
    else if (value > 2000) issues.push({ field, blocking: true, message: `${label} is above 2,000 g. Check the number.` });
  }

  if (draft.kcal != null && draft.kcal > 0 && draft.fatG != null && draft.fatG >= 0 && weightKg > 0) {
    const floorG = fatFloorGrams(draft.kcal, weightKg);
    if (draft.fatG + 0.5 < floorG) {
      issues.push({
        field: 'fatG',
        blocking: true,
        message: `Fat is below the floor of ${lowestPassingWhole(floorG)} g (the larger of 20% of calories and 0.6 g/kg).`,
      });
    }
  }

  // On a cut the default fat is 0.8 g/kg. Going lower is allowed down to the hard floor, with a warning.
  if (goal === 'cut' && weightKg > 0 && draft.fatG != null && draft.fatG >= 0 && draft.kcal != null && draft.kcal > 0) {
    const floorG = fatFloorGrams(draft.kcal, weightKg);
    const cutDefault = 0.8 * weightKg;
    if (draft.fatG + 0.5 >= floorG && draft.fatG + 0.5 < cutDefault) {
      issues.push({
        field: 'fatG',
        blocking: false,
        message: `Fat is below the ${Math.ceil(cutDefault - 0.5)} g (0.8 g/kg) Macroyo suggests on a cut. This is a warning, not a block.`,
      });
    }
  }

  if (
    draft.kcal != null &&
    draft.proteinG != null &&
    draft.carbsG != null &&
    draft.fatG != null &&
    draft.kcal > 0 &&
    draft.proteinG >= 0 &&
    draft.carbsG >= 0 &&
    draft.fatG >= 0
  ) {
    const energy = macroEnergy(draft.proteinG, draft.carbsG, draft.fatG);
    if (energy - draft.kcal > 10) {
      issues.push({
        field: 'kcal',
        blocking: false,
        message: `Protein, carbs, and fat add up to ${Math.round(energy)} kcal, which is above the ${Math.round(draft.kcal)} kcal target.`,
      });
    }
    if (draft.carbsG < 100) {
      issues.push({
        field: 'carbsG',
        blocking: false,
        message: draft.carbsG < 50
          ? 'Carbs are under 50 g. That is very low for most people. Consider raising calories or lowering fat or protein.'
          : 'Carbs are under 100 g. That can be hard to sustain. This is a warning, not a block.',
      });
    }
  }

  return { issues, blocking: issues.some((issue) => issue.blocking) };
}

export interface FoodMacros {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
}

export function macrosForGrams(
  per100: { kcal: number; protein: number; carbs: number; fat: number; fiber: number | null },
  grams: number,
): FoodMacros {
  const scale = grams / 100;
  return {
    kcal: per100.kcal * scale,
    proteinG: per100.protein * scale,
    carbsG: per100.carbs * scale,
    fatG: per100.fat * scale,
    fiberG: per100.fiber == null ? null : per100.fiber * scale,
  };
}

export function sumFiber(values: readonly (number | null)[]): number | null {
  if (values.length === 0) return null;
  if (values.some((value) => value == null)) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

export interface LoggedTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
}

export function sumLogged(
  entries: readonly { kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number | null }[],
): LoggedTotals {
  return {
    kcal: entries.reduce((sum, entry) => sum + entry.kcal, 0),
    proteinG: entries.reduce((sum, entry) => sum + entry.proteinG, 0),
    carbsG: entries.reduce((sum, entry) => sum + entry.carbsG, 0),
    fatG: entries.reduce((sum, entry) => sum + entry.fatG, 0),
    fiberG: sumFiber(entries.map((entry) => entry.fiberG)),
  };
}

export function progressRatio(consumed: number, target: number): number {
  if (!(target > 0) || !Number.isFinite(consumed) || !Number.isFinite(target)) return 0;
  return Math.max(0, consumed / target);
}

export interface FieldCheck {
  ok: boolean;
  message: string | null;
  /** Under-18 is a hard stop, not a typo. */
  underage?: boolean;
}

export function validateAge(value: number | null): FieldCheck {
  if (value == null) return { ok: false, message: 'Enter your age.' };
  if (!Number.isFinite(value) || value < 0 || value > 120) {
    return { ok: false, message: 'Enter an age from 18 to 120.' };
  }
  if (value < 18) {
    return {
      ok: false,
      underage: true,
      message: 'Macroyo is for adults 18 and older. Calorie targets and body-composition numbers are not appropriate under 18.',
    };
  }
  return { ok: true, message: null };
}

export function validateHeightCm(value: number | null): FieldCheck {
  if (value == null) return { ok: false, message: 'Enter your height.' };
  if (!(value >= 100 && value <= 250)) {
    return { ok: false, message: 'Enter a height from 100 to 250 cm.' };
  }
  return { ok: true, message: null };
}

export function validateWeightKg(value: number | null): FieldCheck {
  if (value == null) return { ok: false, message: 'Enter your weight.' };
  if (!(value >= 30 && value <= 300)) {
    return { ok: false, message: 'Enter a weight from 30 to 300 kg.' };
  }
  return { ok: true, message: null };
}

export function validateBodyFat(value: number | null, required = false): FieldCheck {
  if (value == null) {
    return required
      ? { ok: false, message: 'Enter body fat from 3 to 60%.' }
      : { ok: true, message: null };
  }
  if (!(value >= 3 && value <= 60)) {
    return { ok: false, message: 'Enter body fat from 3 to 60%, or leave it blank.' };
  }
  return { ok: true, message: null };
}

export function validatePortionGrams(value: number | null): FieldCheck {
  if (value == null) return { ok: false, message: 'Enter grams as a number.' };
  if (!(value > 0) || value > 5000) return { ok: false, message: 'Enter a portion from just above 0 g up to 5,000 g.' };
  return { ok: true, message: null };
}

export interface QuickAddInput {
  name: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  grams: number | null;
}

export function validateQuickAdd(input: QuickAddInput): { issues: string[]; mismatch: string | null } {
  const issues: string[] = [];
  if (!input.name.trim()) issues.push('Enter a name.');
  if (input.name.trim().length > 200) issues.push('Use a name of 200 characters or fewer.');
  if (input.kcal == null) issues.push('Enter calories as a number.');
  else if (input.kcal < 0) issues.push('Calories cannot be negative.');
  else if (input.kcal > 10000) issues.push('One entry cannot be over 10,000 kcal.');
  for (const [label, value] of [
    ['Protein', input.proteinG],
    ['Carbs', input.carbsG],
    ['Fat', input.fatG],
  ] as const) {
    if (value == null) issues.push(`Enter ${label.toLowerCase()} as a number, or 0.`);
    else if (value < 0) issues.push(`${label} cannot be negative.`);
  }
  if (input.fiberG != null && input.fiberG < 0) issues.push('Fiber cannot be negative.');
  const grams = validatePortionGrams(input.grams);
  if (!grams.ok && grams.message) issues.push(grams.message);
  let mismatch: string | null = null;
  if (
    input.kcal != null &&
    input.proteinG != null &&
    input.carbsG != null &&
    input.fatG != null &&
    input.kcal >= 0 &&
    input.proteinG >= 0 &&
    input.carbsG >= 0 &&
    input.fatG >= 0
  ) {
    const energy = macroEnergy(input.proteinG, input.carbsG, input.fatG);
    if (input.kcal > 0 && Math.abs(energy - input.kcal) > Math.max(10, input.kcal * 0.1)) {
      mismatch = `Those macros add up to about ${Math.round(energy)} kcal, not ${Math.round(input.kcal)}. You can still save the entry.`;
    }
  }
  return { issues, mismatch };
}

export type QuickAddField = 'name' | 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG' | 'grams';

/** Same rules as validateQuickAdd, keyed by field so the message can sit under the input it is about. */
export function quickAddFieldErrors(input: QuickAddInput): Partial<Record<QuickAddField, string>> {
  const errors: Partial<Record<QuickAddField, string>> = {};
  if (!input.name.trim()) errors.name = 'Enter a name.';
  else if (input.name.trim().length > 200) errors.name = 'Use a name of 200 characters or fewer.';
  if (input.kcal == null) errors.kcal = 'Enter calories as a number.';
  else if (input.kcal < 0) errors.kcal = 'Calories cannot be negative.';
  else if (input.kcal > 10000) errors.kcal = 'One entry cannot be over 10,000 kcal.';
  for (const [field, label, value] of [
    ['proteinG', 'protein', input.proteinG],
    ['carbsG', 'carbs', input.carbsG],
    ['fatG', 'fat', input.fatG],
  ] as const) {
    if (value == null) errors[field] = `Enter ${label} as a number, or 0.`;
    else if (value < 0) errors[field] = `${label.charAt(0).toUpperCase()}${label.slice(1)} cannot be negative.`;
  }
  if (input.fiberG != null && input.fiberG < 0) errors.fiberG = 'Fiber cannot be negative.';
  const grams = validatePortionGrams(input.grams);
  if (!grams.ok && grams.message) errors.grams = grams.message;
  return errors;
}

/** Preview of a cut that the safety rules will not offer. Useful for explanations. */
export function explainCutBlock(input: PlanInput): string | null {
  return buildMacroPlan({ ...input, goal: 'cut' }).goalBlockReason;
}

export function projectionForOffset(input: PlanInput, offsetKcal: number) {
  const plan = buildMacroPlan({ ...input, goal: 'maintain' });
  return projectV1({
    weight_kg: input.weightKg,
    height_cm: input.heightCm,
    age: input.age,
    sex: plan.mifflinSex,
    activity_factor: activityFactor(input.activity),
    daily_offset_kcal: offsetKcal,
    tdee_override_kcal: plan.tdee,
    floor_kcal: plan.calorieFloor,
  });
}

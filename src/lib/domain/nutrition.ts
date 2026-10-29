/**
 * Body-composition, energy, and macro targets.
 * Metric internally. Display conversions live here so the UI stays free of formulas.
 */

import { getLocale } from '../../i18n/state';
import { msg, type MessageKey } from '../../i18n/msg';
import { numberSymbols } from '../../i18n/numbers';
import type { Locale, Msg } from '../../i18n/types';
import {
  DEFICIT_UNAVAILABLE_MESSAGE,
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

export const ACTIVITY_DETAILS: Record<ActivityLevel, { label: Msg; description: Msg }> = {
  sedentary: { label: msg('activity.sedentary'), description: msg('activity.sedentary.desc') },
  light: { label: msg('activity.light'), description: msg('activity.light.desc') },
  moderate: { label: msg('activity.moderate'), description: msg('activity.moderate.desc') },
  very: { label: msg('activity.very'), description: msg('activity.very.desc') },
  extra: { label: msg('activity.extra'), description: msg('activity.extra.desc') },
};

export const GOAL_DETAILS: Record<Goal, { label: Msg; description: Msg }> = {
  cut: { label: msg('goal.cut'), description: msg('goal.cut.desc') },
  maintain: { label: msg('goal.maintain'), description: msg('goal.maintain.desc') },
  bulk: { label: msg('goal.bulk'), description: msg('goal.bulk.desc') },
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

/** Feet and inches with inches rounded to 0.1 and never shown as 12: "5 ft 12 in" becomes 6 ft 0 in. */
export function normalizeFeetInches(feet: number, inches: number): { feet: number; inches: number } {
  const totalTenths = Math.round(roundHalfUp(feet * 12 + inches, 1) * 10);
  const wholeFeet = Math.floor(totalTenths / 120);
  return { feet: wholeFeet, inches: (totalTenths - wholeFeet * 120) / 10 };
}

/** Keep the stored value when the user did not touch the text, so display rounding never drifts it. */
export function valueUnlessUnchanged(
  text: string,
  initialText: string,
  stored: number,
  parsed: number | null,
): number | null {
  return text === initialText ? stored : parsed;
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

/**
 * True for text like "1,234" or "12,345" (one to three digits, a comma, exactly three digits), and in
 * Vietnamese also "1.234", where "." is the thousands mark. Such text could be a thousands separator
 * (1234) or a decimal (1.234), so we refuse to guess. A leading 0 ("0,125") is unambiguous and stays a decimal.
 * "1.234" stays a plain decimal in English and Finnish, where "." is never a thousands mark.
 */
export function isAmbiguousThousands(raw: string, locale: Locale = getLocale()): boolean {
  const text = raw.trim();
  if (/^[-+]?[1-9]\d{0,2},\d{3}$/.test(text)) return true;
  return locale === 'vi' && /^[-+]?[1-9]\d{0,2}\.\d{3}$/.test(text);
}

/** Finnish writes thousands with a space ("2 500"). It is unambiguous, so it is accepted: "2 500,5" is 2500.5. */
const FINNISH_GROUPED = /^([-+]?)(\d{1,3}(?:[ \u00a0\u202f]\d{3})+)([.,]\d+)?$/;

/**
 * Accepts 80, 80.5, 80,5, ".5" and "80." (a trailing separator while typing): both "." and "," work
 * as the decimal mark in every language, because phone keyboards differ from the UI language.
 * Returns null for empty or non-numeric text, for internal spaces ("80 5"; Finnish thousands groups of
 * three like "2 500" excepted), and for ambiguous "1,234"-style text (see isAmbiguousThousands).
 * Rejecting is the safe choice: a weight of 1.234 kg or a calorie target of 1234 would both be silent mistakes.
 */
export function parseDecimal(raw: string, locale: Locale = getLocale()): number | null {
  let text = raw.trim();
  if (!text) return null;
  if (isAmbiguousThousands(text, locale)) return null;
  if (locale === 'fi') {
    const grouped = FINNISH_GROUPED.exec(text);
    if (grouped) text = `${grouped[1]}${grouped[2].replace(/[ \u00a0\u202f]/g, '')}${grouped[3] ?? ''}`;
  }
  if (!/^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(text)) return null;
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/** The decimal mark to show in hints for a locale ("," for Vietnamese and Finnish). */
export function decimalMark(locale: Locale = getLocale()): string {
  return numberSymbols(locale).decimal;
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
  label: Msg;
  /** Smaller WHO detail, including thinness and obese class. */
  detail: Msg | null;
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
  if (bmi < 16) return { label: msg('bmi.underweight'), detail: msg('bmi.severeThinness'), who: 'Underweight' };
  if (bmi < 17) return { label: msg('bmi.underweight'), detail: msg('bmi.moderateThinness'), who: 'Underweight' };
  if (bmi < 18.5) return { label: msg('bmi.underweight'), detail: msg('bmi.mildThinness'), who: 'Underweight' };
  if (bmi < 25) return { label: msg('bmi.normal'), detail: null, who: 'Normal' };
  if (bmi < 30) return { label: msg('bmi.overweight'), detail: null, who: 'Overweight' };
  if (bmi < 35) return { label: msg('bmi.obesity'), detail: msg('bmi.obeseI'), who: 'Obese class I' };
  if (bmi < 40) return { label: msg('bmi.obesity'), detail: msg('bmi.obeseII'), who: 'Obese class II' };
  return { label: msg('bmi.obesity'), detail: msg('bmi.obeseIII'), who: 'Obese class III' };
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
  /** Stable id of the band (English, never displayed): used by tests and to pick the label. */
  band: string | null;
  label: Msg;
  detail: Msg;
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
    return { band: null, label: msg('ffmi.notBanded'), detail: msg('ffmi.notBanded.detail'), banded: false };
  }
  const shown = roundHalfUp(normalized, 1);
  let band = 'Above the range usually reported';
  let key: MessageKey = 'ffmi.aboveRange';
  if (shown < 18) { band = 'Below average'; key = 'ffmi.belowAverage'; }
  else if (shown < 20) { band = 'Average'; key = 'ffmi.average'; }
  else if (shown < 22) { band = 'Above average'; key = 'ffmi.aboveAverage'; }
  else if (shown < 23) { band = 'Excellent'; key = 'ffmi.excellent'; }
  else if (shown <= 25) { band = 'Superior'; key = 'ffmi.superior'; }
  return { band, label: msg(key), detail: msg('ffmi.men.detail'), banded: true };
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

/**
 * Highest calorie target Macroyo accepts. The largest plan it can generate is 300 kg at 3% body fat on the
 * Katch formula, very active, bulking: about 13,900 kcal. The old limit of 10,000 blocked the generated plan
 * for lean profiles from about 219 kg, so the limit sits above that ceiling and only catches typing slips.
 */
export const MAX_TARGET_KCAL = 15000;

/**
 * Gram limit for one macro target. Protein and carbs are bounded by what the calorie ceiling allows at 4 kcal/g
 * (the 13,910 kcal worst-case generated plan has 2,068 g of carbs); fat stays at 2,000 g.
 */
export function maxTargetGrams(field: 'proteinG' | 'carbsG' | 'fatG'): number {
  return field === 'fatG' ? 2000 : MAX_TARGET_KCAL / CARB_KCAL;
}

/** Resting energy below this is not a realistic human (e.g. 30 kg, 100 cm, 120 years gives about 160 kcal). */
export const MIN_PLAUSIBLE_BMR = 500;

export function macroEnergy(proteinG: number, carbsG: number, fatG: number): number {
  return proteinG * PROTEIN_KCAL + carbsG * CARB_KCAL + fatG * FAT_KCAL;
}

export interface MacroPlan {
  bmr: number;
  tdee: number;
  formula: BmrFormula;
  formulaNote: Msg;
  bmi: number;
  goal: Goal;
  goalAllowed: boolean;
  goalBlockReason: Msg | null;
  rawKcal: number;
  kcal: number;
  capped: boolean;
  capReason: Msg | null;
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
  /** Set when age, height and weight together give an unrealistic resting energy (see MIN_PLAUSIBLE_BMR). */
  implausible: Msg | null;
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
  let formulaNote: Msg = msg('plan.formula.mifflin');
  if (input.sex === 'unspecified') {
    formulaNote = mifflinSex === 'male'
      ? msg('plan.formula.mifflinMale')
      : mifflinSex === 'female'
        ? msg('plan.formula.mifflinFemale')
        : msg('plan.formula.mifflinAverage');
  }
  if (formula === 'katch' && input.bodyFatPct != null) {
    const lean = leanMassKg(input.weightKg, input.bodyFatPct);
    bmr = katchMcArdle(lean);
    formulaNote = msg('plan.formula.katch');
  }
  const tdee = tdeeFromBmr(bmr, input.activity);
  const floor = effectiveCalorieFloor(input.sex, bmr, tdee);
  const projectionSex: ProjectionSex = mifflinSex;
  const maxOffset = maxSafeOffset(input.weightKg, input.heightCm, tdee, bmr, projectionSex, floor);
  const deficitUnavailable = maxOffset < 100;

  let goalBlockReason: Msg | null = null;
  if (input.goal === 'cut') {
    if (input.pregnant) {
      goalBlockReason = msg('plan.block.pregnant');
    } else if (bmi < 18.5) {
      goalBlockReason = msg('plan.block.bmi', { bmi: roundHalfUp(bmi, 1) });
    } else if (deficitUnavailable) {
      goalBlockReason = DEFICIT_UNAVAILABLE_MESSAGE;
    }
  }

  const goalAllowed = input.goal !== 'cut' || goalBlockReason == null;
  const effectiveGoal: Goal = goalAllowed ? input.goal : 'maintain';
  const rawKcal = effectiveGoal === 'cut' ? tdee * 0.8 : effectiveGoal === 'bulk' ? tdee * 1.1 : tdee;

  let kcalExact = rawKcal;
  let capped = false;
  let capReason: Msg | null = null;
  if (effectiveGoal === 'cut') {
    const limited = tdee - maxOffset;
    if (kcalExact < limited - 1e-6) {
      kcalExact = limited;
      capped = true;
      capReason = msg('plan.capReason', { kcal: Math.round(limited), offset: roundHalfUp(maxOffset, 1) });
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
    implausible: implausibleBodyMessage(bmr),
  };
}

/** A clear message when the body numbers together are not realistic, else null. Block saving on it. */
export function implausibleBodyMessage(bmr: number): Msg | null {
  return bmr < MIN_PLAUSIBLE_BMR ? msg('validate.bodyImplausible', { bmr: Math.round(bmr) }) : null;
}

/** Same check from the raw body numbers (the onboarding body step, before activity is known). */
export function bodyPlausibilityIssue(input: Omit<PlanInput, 'activity' | 'goal'>): Msg | null {
  return buildMacroPlan({ ...input, activity: 'sedentary', goal: 'maintain' }).implausible;
}

/**
 * Notes about how the generated targets were adjusted, in the order a person should read them: the cut was held
 * at the safe limit, protein was limited to 35% of calories, fat was lowered toward its minimum, and (rare) protein
 * and fat alone exceed the calories so carbs are 0. Onboarding and the Profile recalculation both show these,
 * so a recalculated plan never changes silently.
 */
export function planNotes(plan: MacroPlan, includeCap = true): Msg[] {
  const notes: Msg[] = [];
  if (includeCap && plan.capped && plan.capReason) notes.push(plan.capReason);
  if (plan.proteinCapped) {
    notes.push(msg('onboarding.proteinLimited', { protein: plan.proteinG, uncapped: plan.proteinUncappedG, perKg: plan.proteinPerKg }));
  }
  if (plan.fatTrimmed) notes.push(msg('onboarding.fatTrimmed'));
  if (plan.macroOvershoot) notes.push(msg('plan.macroOvershoot', { kcal: plan.kcal }));
  return notes;
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
  message: Msg;
}

/** Rounding slack for the protein note: a generated plan rounds grams and kcal, and must never trigger it. */
export const PROTEIN_NOTE_SLACK_G = 0.6;

/** Carbs under this many grams get a standalone warning (spec 2.4: "under 50 g/day"). */
export const LOW_CARB_WARNING_G = 50;
/** Softer note, optional in the spec: under 100 g can be hard to sustain. */
export const LOW_CARB_NOTE_G = 100;

/** Calories implied by the grams, compared with the kcal target: tolerance is max(10 kcal, 1% of target). */
export function macroMismatchTolerance(kcal: number): number {
  return Math.max(10, kcal * 0.01);
}

/**
 * Non-blocking notices for a target draft, independent of the calorie floor and of each other:
 * - carbs under 50 g (and a softer note under 100 g), whenever the carbs number is valid;
 * - P*4 + C*4 + F*9 more than max(10 kcal, 1%) above OR below the kcal target.
 * Use it live while the user types and again on save.
 */
export function targetNotices(draft: TargetDraft): TargetIssue[] {
  const issues: TargetIssue[] = [];
  if (draft.kcal != null && draft.kcal > 0 && draft.proteinG != null && draft.proteinG >= 0) {
    const capG = (draft.kcal * PROTEIN_MAX_KCAL_SHARE) / PROTEIN_KCAL;
    if (draft.proteinG > capG + PROTEIN_NOTE_SLACK_G) {
      issues.push({
        field: 'proteinG',
        blocking: false,
        message: msg('targets.proteinHigh', { pct: Math.round(((draft.proteinG * PROTEIN_KCAL) / draft.kcal) * 100) }),
      });
    }
  }
  if (draft.carbsG != null && draft.carbsG >= 0 && draft.carbsG < LOW_CARB_NOTE_G) {
    issues.push({
      field: 'carbsG',
      blocking: false,
      message: draft.carbsG < LOW_CARB_WARNING_G ? msg('targets.carbsUnder50') : msg('targets.carbsUnder100'),
    });
  }
  if (
    draft.kcal != null &&
    draft.kcal > 0 &&
    draft.proteinG != null &&
    draft.carbsG != null &&
    draft.fatG != null &&
    draft.proteinG >= 0 &&
    draft.carbsG >= 0 &&
    draft.fatG >= 0
  ) {
    const energy = macroEnergy(draft.proteinG, draft.carbsG, draft.fatG);
    const diff = energy - draft.kcal;
    if (Math.abs(diff) > macroMismatchTolerance(draft.kcal)) {
      issues.push({
        field: 'kcal',
        blocking: false,
        message: diff > 0
          ? msg('targets.macrosAbove', { energy: Math.round(energy), kcal: Math.round(draft.kcal) })
          : msg('targets.macrosBelow', { energy: Math.round(energy), kcal: Math.round(draft.kcal), gap: Math.round(-diff) }),
      });
    }
  }
  return issues;
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
    issues.push({ field: 'kcal', blocking: true, message: msg('targets.kcalMissing') });
  } else if (draft.kcal <= 0) {
    issues.push({ field: 'kcal', blocking: true, message: msg('targets.kcalZero') });
  } else if (draft.kcal > MAX_TARGET_KCAL) {
    issues.push({ field: 'kcal', blocking: true, message: msg('targets.kcalTooHigh', { max: MAX_TARGET_KCAL }) });
  } else if (draft.kcal + 0.5 < floor) {
    issues.push({
      field: 'kcal',
      blocking: true,
      message: msg('targets.kcalFloor', { floor: floorShown }),
    });
  }

  for (const field of ['proteinG', 'carbsG', 'fatG'] as const) {
    const value = draft[field];
    if (value == null) issues.push({ field, blocking: true, message: msg(`targets.missing.${field}`) });
    else if (value < 0) issues.push({ field, blocking: true, message: msg(`targets.negative.${field}`) });
    else if (value > maxTargetGrams(field)) issues.push({ field, blocking: true, message: msg(`targets.tooHigh.${field}`, { max: maxTargetGrams(field) }) });
  }

  if (draft.kcal != null && draft.kcal > 0 && draft.fatG != null && draft.fatG >= 0 && weightKg > 0) {
    const floorG = fatFloorGrams(draft.kcal, weightKg);
    if (draft.fatG + 0.5 < floorG) {
      issues.push({
        field: 'fatG',
        blocking: true,
        message: msg('targets.fatFloor', { grams: lowestPassingWhole(floorG) }),
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
        message: msg('targets.fatBelowCutDefault', { grams: Math.ceil(cutDefault - 0.5) }),
      });
    }
  }

  issues.push(...targetNotices(draft));

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
  message: Msg | null;
  /** Under-18 is a hard stop, not a typo. */
  underage?: boolean;
}

export function validateAge(value: number | null): FieldCheck {
  if (value == null) return { ok: false, message: msg('validate.age.missing') };
  if (!Number.isFinite(value) || value < 0 || value > 120) {
    return { ok: false, message: msg('validate.age.range') };
  }
  if (value < 18) {
    return {
      ok: false,
      underage: true,
      message: msg('validate.age.underage'),
    };
  }
  return { ok: true, message: null };
}

export function validateHeightCm(value: number | null): FieldCheck {
  if (value == null) return { ok: false, message: msg('validate.height.missing') };
  if (!(value >= 100 && value <= 250)) {
    return { ok: false, message: msg('validate.height.range') };
  }
  return { ok: true, message: null };
}

export function validateWeightKg(value: number | null): FieldCheck {
  if (value == null) return { ok: false, message: msg('validate.weight.missing') };
  if (!(value >= 30 && value <= 300)) {
    return { ok: false, message: msg('validate.weight.range') };
  }
  return { ok: true, message: null };
}

export function validateBodyFat(value: number | null, required = false): FieldCheck {
  if (value == null) {
    return required
      ? { ok: false, message: msg('validate.bodyFat.required') }
      : { ok: true, message: null };
  }
  if (!(value >= 3 && value <= 60)) {
    return { ok: false, message: msg('validate.bodyFat.range') };
  }
  return { ok: true, message: null };
}

export function validatePortionGrams(value: number | null): FieldCheck {
  if (value == null) return { ok: false, message: msg('validate.portion.missing') };
  if (!(value > 0) || value > 5000) return { ok: false, message: msg('validate.portion.range') };
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

export type QuickAddField = 'name' | 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG' | 'grams';

export const MAX_ENTRY_MACRO_G = 2000;

/** Field-keyed errors for a quick add. validateQuickAdd and the inline messages both come from here. */
export function quickAddFieldErrors(input: QuickAddInput): Partial<Record<QuickAddField, Msg>> {
  const errors: Partial<Record<QuickAddField, Msg>> = {};
  if (!input.name.trim()) errors.name = msg('quickAdd.name.missing');
  else if (input.name.trim().length > 200) errors.name = msg('quickAdd.name.tooLong');
  if (input.kcal == null) errors.kcal = msg('quickAdd.kcal.missing');
  else if (input.kcal < 0) errors.kcal = msg('quickAdd.kcal.negative');
  else if (input.kcal > 10000) errors.kcal = msg('quickAdd.kcal.tooHigh');
  for (const [field, value] of [
    ['proteinG', input.proteinG],
    ['carbsG', input.carbsG],
    ['fatG', input.fatG],
  ] as const) {
    if (value == null) errors[field] = msg(`quickAdd.missing.${field}`);
    else if (value < 0) errors[field] = msg(`quickAdd.negative.${field}`);
    else if (value > MAX_ENTRY_MACRO_G) errors[field] = msg(`quickAdd.tooHigh.${field}`);
  }
  if (input.fiberG != null && input.fiberG < 0) errors.fiberG = msg('quickAdd.negative.fiberG');
  else if (input.fiberG != null && input.fiberG > MAX_ENTRY_MACRO_G) errors.fiberG = msg('quickAdd.tooHigh.fiberG');
  const grams = validatePortionGrams(input.grams);
  if (!grams.ok && grams.message) errors.grams = grams.message;
  // Protein, carbs and fat cannot weigh more than the portion itself (0.5 g of slack for rounding).
  if (
    grams.ok &&
    input.grams != null &&
    !errors.proteinG && !errors.carbsG && !errors.fatG &&
    input.proteinG != null && input.carbsG != null && input.fatG != null
  ) {
    const total = input.proteinG + input.carbsG + input.fatG;
    if (total > input.grams + 0.5) {
      errors.grams = msg('quickAdd.macrosExceedPortion', { total: roundHalfUp(total, 1), grams: roundHalfUp(input.grams, 1) });
    }
  }
  return errors;
}

export function quickAddMismatch(input: QuickAddInput): Msg | null {
  if (
    input.kcal != null &&
    input.proteinG != null &&
    input.carbsG != null &&
    input.fatG != null &&
    input.kcal > 0 &&
    input.proteinG >= 0 &&
    input.carbsG >= 0 &&
    input.fatG >= 0
  ) {
    const energy = macroEnergy(input.proteinG, input.carbsG, input.fatG);
    if (Math.abs(energy - input.kcal) > Math.max(10, input.kcal * 0.1)) {
      return msg('quickAdd.mismatch', { energy: Math.round(energy), kcal: Math.round(input.kcal) });
    }
  }
  return null;
}

export function validateQuickAdd(input: QuickAddInput): { issues: Msg[]; mismatch: Msg | null } {
  const issues = Object.values(quickAddFieldErrors(input));
  return { issues, mismatch: quickAddMismatch(input) };
}

export type QuickAddDecision =
  | { action: 'errors'; errors: Partial<Record<QuickAddField, Msg>> }
  | { action: 'confirm'; warning: Msg }
  | { action: 'save' };

/**
 * What Save should do. Errors block. A kcal/macro mismatch keeps the card open with the warning
 * and a "Save anyway" button; once the user confirms, it saves.
 */
export function quickAddDecision(input: QuickAddInput, confirmed: boolean): QuickAddDecision {
  const errors = quickAddFieldErrors(input);
  if (Object.keys(errors).length > 0) return { action: 'errors', errors };
  const warning = quickAddMismatch(input);
  if (warning && !confirmed) return { action: 'confirm', warning };
  return { action: 'save' };
}

export type TypedMeasureKind = 'height' | 'weight' | 'age';

const TYPED_RANGE = {
  height: { min: 120, max: 230 },
  weight: { min: 30, max: 250 },
  age: { min: 18, max: 120 },
} as const;

/**
 * Validates the raw text typed into a Calc box (not the clamped state behind it).
 * Calc ranges match its sliders: 120-230 cm, 30-250 kg, 18-120 years.
 * `value` is in cm / kg / years.
 */
export function validateTypedMeasure(
  kind: TypedMeasureKind,
  raw: string,
  units: 'metric' | 'imperial',
): { ok: boolean; value: number | null; message: Msg | null } {
  const range = TYPED_RANGE[kind];
  const imperial = units === 'imperial' && kind !== 'age';
  const lo = imperial ? (kind === 'height' ? Math.ceil(range.min / CM_PER_IN) : Math.ceil(range.min / KG_PER_LB)) : range.min;
  const hi = imperial ? (kind === 'height' ? Math.floor(range.max / CM_PER_IN) : Math.floor(range.max / KG_PER_LB)) : range.max;
  const rangeKey: MessageKey = kind === 'age'
    ? 'validate.typed.range.age'
    : kind === 'height'
      ? (imperial ? 'validate.typed.range.height.in' : 'validate.typed.range.height.cm')
      : imperial ? 'validate.typed.range.weight.lb' : 'validate.typed.range.weight.kg';
  const rangeText = msg(rangeKey, { min: lo, max: hi });
  const parsed = parseDecimal(raw);
  if (parsed == null) {
    const message = isAmbiguousThousands(raw)
      ? msg('validate.noThousands')
      : raw.trim() === ''
        ? msg(`validate.typed.missing.${kind}`)
        : rangeText;
    return { ok: false, value: null, message };
  }
  const value = imperial ? (kind === 'height' ? parsed * CM_PER_IN : parsed * KG_PER_LB) : parsed;
  if (!(value >= range.min - 1e-9 && value <= range.max + 1e-9)) return { ok: false, value: null, message: rangeText };
  return { ok: true, value, message: null };
}

/** Preview of a cut that the safety rules will not offer. Useful for explanations. */
export function explainCutBlock(input: PlanInput): Msg | null {
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

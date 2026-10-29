/**
 * Port of proj.py `project_v1` (nutrition-app-science.md §5.10).
 * Pure TypeScript. Do not change the arithmetic without updating the golden vectors.
 */

import { msg } from '../../i18n/msg';
import type { Msg } from '../../i18n/types';

export const KCAL_PER_KG = 7700;
export const LB_PER_KG = 2.20462;
export const BMI_FLOOR = 18.5;
export const DEFICIT_MIN_KCAL = 100;
export const SURPLUS_ABS_KCAL = 500;
export const SURPLUS_PCT_TDEE = 0.15;
export const STATIC_MAX_DAYS = 30.44;

export const DEFAULT_HORIZONS = [7, 30.44, 91.3, 182.6, 365.25] as const;

/** Stable ids for the horizons. Display text comes from `horizonMsg`, never from these. */
export const HORIZON_LABELS: Record<string, string> = {
  '7': '1 wk',
  '30.44': '1 mo',
  '91.3': '3 mo',
  '182.6': '6 mo',
  '365.25': '1 yr',
};

const SEX_FLOOR: Record<string, number> = { male: 1500, female: 1200 };

export type ProjectionSex = 'male' | 'female' | 'unspecified';

export interface OffsetComponents {
  one_pct_bw_per_week: number;
  quarter_of_tdee: number;
  calorie_floor_room: number;
  bmi_allows_deficit: boolean;
}

export interface ProjectionRow {
  horizon_days: number;
  delta_kg: number;
  delta_lb: number;
  final_weight_kg: number;
  clamped: boolean;
}

export interface HorizonResult extends ProjectionRow {
  label: string;
  model: 'static' | 'weekly_mifflin';
  delta_kg_r: number;
  delta_lb_r: number;
}

export interface ProjectionWarning {
  code:
    | 'BMI_AT_OR_BELOW_FLOOR'
    | 'DEFICIT_UNAVAILABLE'
    | 'OFFSET_CLAMPED'
    | 'SURPLUS_MOSTLY_FAT'
    | 'BMI_FLOOR_REACHED';
  message: Msg;
  horizons?: string[];
}

export interface ProjectionInput {
  weight_kg: number;
  height_cm: number;
  age: number;
  sex: ProjectionSex;
  activity_factor: number;
  daily_offset_kcal: number;
  horizons_days?: readonly number[];
  floor_kcal?: number | null;
  tdee_override_kcal?: number | null;
  apply_guardrails?: boolean;
  static_max_days?: number;
}

export interface ProjectionResult {
  inputs: {
    weight_kg: number;
    height_cm: number;
    age: number;
    sex: ProjectionSex;
    activity_factor: number;
    daily_offset_kcal: number;
    floor_kcal: number | null;
    tdee_override_kcal: number | null;
    apply_guardrails: boolean;
    horizons_days: number[];
  };
  bmr_kcal: number;
  tdee_kcal: number;
  requested_offset_kcal: number;
  effective_offset_kcal: number;
  target_kcal: number;
  max_safe_offset_kcal: number;
  max_safe_offset_components: OffsetComponents;
  deficit_unavailable: boolean;
  min_weight_kg: number;
  pct_bw_per_week: number;
  warnings: ProjectionWarning[];
  horizons: HorizonResult[];
}

/** Shortest round-trip decimal, then half-up (away from zero) to 0.1. Matches Python Decimal(repr(float)). */
/** Message key and no params: the sentence itself lives in the locale files (projection.deficitUnavailable). */
export const DEFICIT_UNAVAILABLE_MESSAGE: Msg = msg('projection.deficitUnavailable');

export function roundHalfUp1(x: number): number {
  if (!Number.isFinite(x)) return x;
  const negative = x < 0;
  const quantized = quantizeDecimal(shortestDecimal(Math.abs(x)), 1);
  const n = Number(quantized);
  if (n === 0) return 0;
  return negative ? -n : n;
}

export function roundHalfUp(value: number, decimals = 0): number {
  if (!Number.isFinite(value)) return value;
  const negative = value < 0;
  const quantized = quantizeDecimal(shortestDecimal(Math.abs(value)), decimals);
  const n = Number(quantized);
  if (n === 0) return 0;
  return negative ? -n : n;
}

function shortestDecimal(abs: number): string {
  if (abs === 0) return '0';
  for (let precision = 1; precision <= 17; precision += 1) {
    const candidate = abs.toPrecision(precision);
    if (Number(candidate) === abs) return candidate;
  }
  return String(abs);
}

function expandScientific(value: string): string {
  if (!/[eE]/.test(value)) return value;
  const [mantissa, expRaw] = value.toLowerCase().split('e');
  const exp = Number(expRaw);
  const negative = mantissa.startsWith('-');
  const body = negative ? mantissa.slice(1) : mantissa;
  const [intPart, fracPart = ''] = body.split('.');
  const digits = intPart + fracPart;
  const point = intPart.length + exp;
  let plain: string;
  if (point <= 0) plain = `0.${'0'.repeat(-point)}${digits}`;
  else if (point >= digits.length) plain = digits + '0'.repeat(point - digits.length);
  else plain = `${digits.slice(0, point)}.${digits.slice(point)}`;
  return negative ? `-${plain}` : plain;
}

function quantizeDecimal(absStr: string, decimals: number): string {
  let plain = expandScientific(absStr);
  if (!plain.includes('.')) plain += '.';
  let [intPart, frac = ''] = plain.split('.');
  while (frac.length < decimals + 1) frac += '0';
  const kept = frac.slice(0, decimals);
  const next = frac[decimals] ?? '0';
  let digits = (intPart + kept).replace(/^0+(?=\d)/, '');
  if (digits === '') digits = '0';
  if (next >= '5') digits = incrementDigits(digits);
  if (decimals === 0) return digits.replace(/^0+(?=\d)/, '') || '0';
  if (digits.length <= decimals) digits = `${'0'.repeat(decimals - digits.length + 1)}${digits}`;
  const head = digits.slice(0, -decimals);
  return `${head}.${digits.slice(-decimals)}`;
}

function incrementDigits(digits: string): string {
  const chars = digits.split('');
  let index = chars.length - 1;
  while (index >= 0 && chars[index] === '9') {
    chars[index] = '0';
    index -= 1;
  }
  if (index < 0) chars.unshift('1');
  else chars[index] = String(Number(chars[index]) + 1);
  return chars.join('');
}

export function bmrMifflin(weightKg: number, heightCm: number, age: number, sex: ProjectionSex): number {
  const constant = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + constant;
}

export function minWeightKg(heightCm: number, bmiFloor = BMI_FLOOR): number {
  return bmiFloor * (heightCm / 100) ** 2;
}

export function defaultFloorKcal(sex: ProjectionSex, bmrKcal: number): number {
  const base = SEX_FLOOR[sex] ?? 1500;
  return Math.max(base, bmrKcal);
}

export function maxSafeOffsetComponents(
  weightKg: number,
  heightCm: number,
  tdeeKcal: number,
  bmrKcal: number,
  sex: ProjectionSex,
  floorKcal?: number | null,
  bmiFloor = BMI_FLOOR,
): OffsetComponents {
  const effFloor = floorKcal != null ? floorKcal : defaultFloorKcal(sex, bmrKcal);
  return {
    one_pct_bw_per_week: 11 * weightKg,
    quarter_of_tdee: 0.25 * tdeeKcal,
    calorie_floor_room: tdeeKcal - effFloor,
    bmi_allows_deficit: weightKg > minWeightKg(heightCm, bmiFloor),
  };
}

export function maxSafeOffset(
  weightKg: number,
  heightCm: number,
  tdeeKcal: number,
  bmrKcal: number,
  sex: ProjectionSex,
  floorKcal?: number | null,
  bmiFloor = BMI_FLOOR,
): number {
  const components = maxSafeOffsetComponents(weightKg, heightCm, tdeeKcal, bmrKcal, sex, floorKcal, bmiFloor);
  if (!components.bmi_allows_deficit) return 0;
  return Math.max(0, Math.min(components.one_pct_bw_per_week, components.quarter_of_tdee, components.calorie_floor_room));
}

function weightStop(weightKg: number, heightCm: number | null | undefined, offset: number): number | null {
  if (offset < 0 && heightCm) return Math.min(minWeightKg(heightCm), weightKg);
  return null;
}

export function projectStatic(
  weightKg: number,
  dailyOffsetKcal: number,
  horizonsDays: readonly number[] = DEFAULT_HORIZONS,
  heightCm?: number | null,
): ProjectionRow[] {
  const stop = weightStop(weightKg, heightCm, dailyOffsetKcal);
  return horizonsDays.map((days) => {
    let deltaKg = (dailyOffsetKcal * days) / KCAL_PER_KG;
    let clamped = false;
    if (stop != null && weightKg + deltaKg < stop) {
      deltaKg = stop - weightKg;
      clamped = true;
    }
    return {
      horizon_days: days,
      delta_kg: deltaKg,
      delta_lb: deltaKg * LB_PER_KG,
      final_weight_kg: weightKg + deltaKg,
      clamped,
    };
  });
}

export function projectWeeklyMifflin(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: ProjectionSex,
  activityFactor: number,
  dailyOffsetKcal: number,
  horizonsDays: readonly number[] = DEFAULT_HORIZONS,
  tdeeOverrideKcal?: number | null,
  applyBmiFloor = true,
): ProjectionRow[] {
  const bmr0 = bmrMifflin(weightKg, heightCm, age, sex);
  const tdee0 = tdeeOverrideKcal != null ? tdeeOverrideKcal : bmr0 * activityFactor;
  const calib = tdee0 / (bmr0 * activityFactor);
  const intake = tdee0 + dailyOffsetKcal;
  const stop = applyBmiFloor ? weightStop(weightKg, heightCm, dailyOffsetKcal) : null;
  const weights = [weightKg];
  const hit = [false];

  const balance = (weight: number) => intake - bmrMifflin(weight, heightCm, age, sex) * activityFactor * calib;

  const extend = (n: number) => {
    while (weights.length <= n) {
      let weight = weights[weights.length - 1] + (balance(weights[weights.length - 1]) * 7) / KCAL_PER_KG;
      let flagged = hit[hit.length - 1];
      if (stop != null && weight < stop) {
        weight = stop;
        flagged = true;
      }
      weights.push(weight);
      hit.push(flagged);
    }
  };

  return horizonsDays.map((days) => {
    const k = Math.floor(days / 7);
    extend(k);
    let weight = weights[k];
    let flagged = hit[k];
    const remainder = days - 7 * k;
    if (remainder > 0) {
      weight = weight + (balance(weight) * remainder) / KCAL_PER_KG;
      if (stop != null && weight < stop) {
        weight = stop;
        flagged = true;
      }
    }
    const deltaKg = weight - weightKg;
    return {
      horizon_days: days,
      delta_kg: deltaKg,
      delta_lb: deltaKg * LB_PER_KG,
      final_weight_kg: weight,
      clamped: flagged,
    };
  });
}

const HORIZON_KEYS = {
  '7': 'horizon.week',
  '30.44': 'horizon.month',
  '91.3': 'horizon.threeMonths',
  '182.6': 'horizon.sixMonths',
  '365.25': 'horizon.year',
} as const;

/** Display name of a projection horizon ("1 wk", "1 mo", ..., or "N d" for a custom number of days). */
export function horizonMsg(days: number): Msg {
  const key = HORIZON_KEYS[String(days) as keyof typeof HORIZON_KEYS];
  return key ? msg(key) : msg('horizon.days', { count: days });
}

function horizonLabel(days: number): string {
  return HORIZON_LABELS[String(days)] ?? `${formatG(days)} d`;
}

function formatG(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(value);
}

export function projectV1(input: ProjectionInput): ProjectionResult {
  const horizons = input.horizons_days ? [...input.horizons_days] : [...DEFAULT_HORIZONS];
  const applyGuardrails = input.apply_guardrails !== false;
  const staticMax = input.static_max_days ?? STATIC_MAX_DAYS;
  const bmr = bmrMifflin(input.weight_kg, input.height_cm, input.age, input.sex);
  const tdee = input.tdee_override_kcal != null ? input.tdee_override_kcal : bmr * input.activity_factor;
  const wmin = minWeightKg(input.height_cm);
  const components = maxSafeOffsetComponents(
    input.weight_kg,
    input.height_cm,
    tdee,
    bmr,
    input.sex,
    input.floor_kcal,
  );
  const cap = maxSafeOffset(input.weight_kg, input.height_cm, tdee, bmr, input.sex, input.floor_kcal);
  const deficitUnavailable = cap < DEFICIT_MIN_KCAL;
  let effective = input.daily_offset_kcal;
  const warnings: ProjectionWarning[] = [];

  if (applyGuardrails && input.daily_offset_kcal < 0) {
    if (input.weight_kg <= wmin) {
      warnings.push({
        code: 'BMI_AT_OR_BELOW_FLOOR',
        message: msg('projection.bmiAtFloor'),
      });
    }
    if (deficitUnavailable) {
      effective = 0;
      warnings.push({
        code: 'DEFICIT_UNAVAILABLE',
        message: DEFICIT_UNAVAILABLE_MESSAGE,
      });
    } else if (-input.daily_offset_kcal > cap + 1e-12) {
      effective = -cap;
      warnings.push({
        code: 'OFFSET_CLAMPED',
        message: msg('projection.offsetClamped', {
          requested: -input.daily_offset_kcal,
          cap: roundHalfUp(cap, 1),
          used: roundHalfUp(-effective, 2),
        }),
      });
    }
  }

  if (
    input.daily_offset_kcal > 0 &&
    (input.daily_offset_kcal > SURPLUS_ABS_KCAL || input.daily_offset_kcal > SURPLUS_PCT_TDEE * tdee)
  ) {
    const overAbs = input.daily_offset_kcal > SURPLUS_ABS_KCAL;
    const overPct = input.daily_offset_kcal > SURPLUS_PCT_TDEE * tdee;
    warnings.push({
      code: 'SURPLUS_MOSTLY_FAT',
      message: msg(overAbs && overPct ? 'projection.surplusFat.both' : overAbs ? 'projection.surplusFat.abs' : 'projection.surplusFat.pct'),
    });
  }

  const staticHorizons = horizons.filter((days) => days <= staticMax);
  const weeklyHorizons = horizons.filter((days) => days > staticMax);
  const staticRows = projectStatic(input.weight_kg, effective, staticHorizons, input.height_cm);
  const weeklyRows = projectWeeklyMifflin(
    input.weight_kg,
    input.height_cm,
    input.age,
    input.sex,
    input.activity_factor,
    effective,
    weeklyHorizons,
    input.tdee_override_kcal,
  );

  let staticIndex = 0;
  let weeklyIndex = 0;
  const rows: HorizonResult[] = horizons.map((days) => {
    const model = days <= staticMax ? 'static' : 'weekly_mifflin';
    const row = model === 'static' ? staticRows[staticIndex++] : weeklyRows[weeklyIndex++];
    return {
      ...row,
      label: horizonLabel(days),
      model,
      delta_kg_r: roundHalfUp1(row.delta_kg),
      delta_lb_r: roundHalfUp1(row.delta_lb),
    };
  });

  const clamped = rows.filter((row) => row.clamped);
  if (clamped.length > 0) {
    warnings.push({
      code: 'BMI_FLOOR_REACHED',
      horizons: clamped.map((row) => row.label),
      message: msg('projection.bmiFloorReached', { weight: roundHalfUp(wmin, 1), horizon: horizonMsg(clamped[0].horizon_days) }),
    });
  }

  return {
    inputs: {
      weight_kg: input.weight_kg,
      height_cm: input.height_cm,
      age: input.age,
      sex: input.sex,
      activity_factor: input.activity_factor,
      daily_offset_kcal: input.daily_offset_kcal,
      floor_kcal: input.floor_kcal ?? null,
      tdee_override_kcal: input.tdee_override_kcal ?? null,
      apply_guardrails: applyGuardrails,
      horizons_days: horizons,
    },
    bmr_kcal: bmr,
    tdee_kcal: tdee,
    requested_offset_kcal: input.daily_offset_kcal,
    effective_offset_kcal: effective,
    target_kcal: tdee + effective,
    max_safe_offset_kcal: cap,
    max_safe_offset_components: components,
    deficit_unavailable: deficitUnavailable,
    min_weight_kg: wmin,
    pct_bw_per_week: (Math.abs(effective) * 7) / KCAL_PER_KG / input.weight_kg * 100,
    warnings,
    horizons: rows,
  };
}

/** Which guardrail is the tightest, for the calorie-calculator copy. Returns a message, not text. */
export function bindingLimit(components: OffsetComponents, cap: number): Msg {
  if (!components.bmi_allows_deficit) return msg('limit.bmi');
  const options: [Msg, number][] = [
    [msg('limit.onePct'), components.one_pct_bw_per_week],
    [msg('limit.quarter'), components.quarter_of_tdee],
    [msg('limit.floor'), components.calorie_floor_room],
  ];
  const names = options.filter(([, value]) => Math.abs(value - cap) <= 1e-6).map(([name]) => name);
  if (names.length === 0) return msg('limit.combined');
  return names.reduce((joined, name) => msg('limit.and', { a: joined, b: name }));
}

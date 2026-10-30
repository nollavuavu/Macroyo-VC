/**
 * The one place that says which heights, weights and ages the app accepts, in the units a person types them in.
 * Onboarding, Profile and Calc (typed boxes AND sliders) all read this module, so every screen accepts the same
 * values and every error message quotes exactly the range that was checked.
 *
 * Limits come from the design spec (section 3.4, Calc: height 120 to 230 cm, weight 30 to 250 kg) and the age range
 * 18 to 120. Imperial bounds are whole inches or pounds rounded INWARD from those metric limits (48 to 90 in,
 * 67 to 551 lb), so a value accepted in imperial is always inside the metric limits as well.
 */
import { msg, type MessageKey } from '../../i18n/msg';
import type { Msg } from '../../i18n/types';

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export type Units = 'metric' | 'imperial';
export type MeasureKind = 'height' | 'weight' | 'age';

/** Metric limits (cm, kg, years). Everything else is derived from these. */
export const MEASURE_LIMITS = {
  height: { min: 120, max: 230 },
  weight: { min: 30, max: 250 },
  age: { min: 18, max: 120 },
} as const;

const EPS = 1e-9;

/** The accepted range in the units the value is typed in (cm or in, kg or lb, years). */
export function measureRange(kind: MeasureKind, units: Units): { lo: number; hi: number } {
  const range = MEASURE_LIMITS[kind];
  if (units !== 'imperial' || kind === 'age') return { lo: range.min, hi: range.max };
  const perUnit = kind === 'height' ? CM_PER_IN : KG_PER_LB;
  return { lo: Math.ceil(range.min / perUnit - EPS), hi: Math.floor(range.max / perUnit + EPS) };
}

/** The same range in cm / kg, which is what a slider works in. Imperial bounds are the inward-rounded values. */
export function measureRangeMetric(kind: 'height' | 'weight', units: Units): { min: number; max: number } {
  const { lo, hi } = measureRange(kind, units);
  if (units !== 'imperial') return { min: lo, max: hi };
  const perUnit = kind === 'height' ? CM_PER_IN : KG_PER_LB;
  return { min: lo * perUnit, max: hi * perUnit };
}

/** True when a stored cm / kg / years value is accepted in `units`. */
export function inMeasureRange(kind: MeasureKind, units: Units, metricValue: number): boolean {
  if (!Number.isFinite(metricValue)) return false;
  const { lo, hi } = measureRange(kind, units);
  const perUnit = units === 'imperial' && kind !== 'age' ? (kind === 'height' ? CM_PER_IN : KG_PER_LB) : 1;
  const typed = metricValue / perUnit;
  return typed >= lo - 1e-6 && typed <= hi + 1e-6;
}

/** The imperial height range split for the feet and inches boxes of onboarding and Profile. */
export function heightFeetInchesRange(): { minFt: number; minIn: number; maxFt: number; maxIn: number } {
  const { lo, hi } = measureRange('height', 'imperial');
  return { minFt: Math.floor(lo / 12), minIn: lo % 12, maxFt: Math.floor(hi / 12), maxIn: hi % 12 };
}

/**
 * The "enter a value from A to B" message for a measure. Height in imperial reads in feet and inches when the
 * screen has a feet box and an inches box (`feetInches`, onboarding and Profile) and in inches for Calc's single box.
 */
export function measureRangeMessage(kind: MeasureKind, units: Units, form: 'feetInches' | 'inches' = 'inches'): Msg {
  const { lo, hi } = measureRange(kind, units);
  if (kind === 'height' && units === 'imperial' && form === 'feetInches') return msg('validate.height.rangeImperial', heightFeetInchesRange());
  const key: MessageKey = kind === 'age'
    ? 'validate.typed.range.age'
    : kind === 'height'
      ? (units === 'imperial' ? 'validate.typed.range.height.in' : 'validate.typed.range.height.cm')
      : units === 'imperial' ? 'validate.typed.range.weight.lb' : 'validate.typed.range.weight.kg';
  return msg(key, { min: lo, max: hi });
}

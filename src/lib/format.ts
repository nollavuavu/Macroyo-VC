import { getLocale } from '../i18n/state';
import { MINUS, formatNumberFor } from '../i18n/numbers';
import type { Locale } from '../i18n/types';
import { roundHalfUp } from './domain/projection';
import { normalizeFeetInches } from './domain/nutrition';

/*
 * Every number shown on screen goes through here, so the decimal mark and the thousands separator
 * follow the active language (en 1,234.5 · vi 1.234,5 · fi 1 234,5). Values are rounded half-up first
 * (decimal-exact), then only formatted. Units are never translated: kg, lb, cm, ft, in, kcal, g.
 */

/** Rounded to `digits` and shown without grouping ("12,5", "80"). Trailing zeros are kept only for whole `digits`. */
export function formatAmount(value: number, digits = 1, locale: Locale = getLocale()): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = roundHalfUp(value, digits);
  const fraction = Number.isInteger(rounded) ? 0 : digits;
  return formatNumberFor(locale, rounded, { minFraction: fraction, maxFraction: digits, grouping: false });
}

/** Whole kcal with grouping ("2,850"), one decimal under 100. */
export function formatKcal(value: number, locale: Locale = getLocale()): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : 1;
  const rounded = roundHalfUp(abs, digits);
  const signed = value < 0 ? -rounded : rounded;
  return formatNumberFor(locale, signed, { maxFraction: digits, grouping: true });
}

/** Always-signed delta: "+0,5", "−1,2", and an unsigned zero. */
export function formatSigned(value: number, digits = 1, locale: Locale = getLocale()): string {
  const rounded = roundHalfUp(value, digits);
  const body = formatNumberFor(locale, Math.abs(rounded), { minFraction: digits, maxFraction: digits, grouping: false });
  if (rounded === 0) return body;
  return `${rounded > 0 ? '+' : MINUS}${body}`;
}

export function formatWeightKg(kg: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') return `${formatAmount(kg / 0.45359237, 1)} lb`;
  return `${formatAmount(kg, 1)} kg`;
}

export function formatHeightCm(cm: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') {
    const { feet, inches } = normalizeFeetInches(0, cm / 2.54);
    return `${feet} ft ${formatAmount(inches, 1)} in`;
  }
  return `${formatAmount(cm, 1)} cm`;
}

/** Plain number text for an input box: the locale's decimal mark, no grouping ("80,5"). */
export function formatInputNumber(value: number, locale: Locale = getLocale()): string {
  return formatNumberFor(locale, value, { maxFraction: 4, grouping: false });
}

/** Exactly `digits` decimals ("22,0"), rounded half-up, no grouping. Used for BMI and similar readouts. */
export function formatFixed(value: number, digits = 1, locale: Locale = getLocale()): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = roundHalfUp(value, digits);
  return formatNumberFor(locale, rounded, { minFraction: digits, maxFraction: digits, grouping: false });
}

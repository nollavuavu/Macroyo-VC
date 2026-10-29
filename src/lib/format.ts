import { roundHalfUp, roundHalfUp1 } from './domain/projection';
import { normalizeFeetInches } from './domain/nutrition';

export function formatAmount(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = roundHalfUp(value, digits);
  if (rounded === 0) return digits === 0 ? '0' : '0';
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(digits);
}

/** Adds thousands separators ("2,850") without relying on Intl, which varies by engine. */
export function groupThousands(integerText: string): string {
  return integerText.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatKcal(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const negative = value < 0;
  const abs = Math.abs(value);
  const rounded = roundHalfUp(abs, abs >= 100 ? 0 : 1);
  const [whole, fraction] = (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)).split('.');
  const body = groupThousands(whole) + (fraction ? `.${fraction}` : '');
  return negative && rounded !== 0 ? `−${body}` : body;
}

export function formatSigned(value: number, digits = 1): string {
  const rounded = roundHalfUp(value, digits);
  if (rounded === 0) return digits === 0 ? '0' : (0).toFixed(digits);
  const body = Math.abs(rounded).toFixed(digits);
  return `${rounded > 0 ? '+' : '−'}${body}`;
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

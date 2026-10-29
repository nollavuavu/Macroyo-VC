import { roundHalfUp, roundHalfUp1 } from './domain/projection';

export function formatAmount(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = roundHalfUp(value, digits);
  if (rounded === 0) return digits === 0 ? '0' : '0';
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(digits);
}

export function formatKcal(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = roundHalfUp(value, value >= 100 ? 0 : 1);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
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
    const total = cm / 2.54;
    const feet = Math.floor(total / 12);
    const inches = roundHalfUp1(total - feet * 12);
    return `${feet} ft ${formatAmount(inches, 1)} in`;
  }
  return `${formatAmount(cm, 1)} cm`;
}

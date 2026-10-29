/**
 * Portion math and "round once" helpers for the Today screen.
 * Everything here is decimal-exact: no floating-point products are ever rounded.
 */
import { roundHalfUp, roundHalfUp1 } from './projection';

function toScaled(x: number): { n: bigint; scale: number } | null {
  if (!Number.isFinite(x)) return null;
  const text = String(Math.abs(x));
  if (/e/i.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return { n: BigInt(whole + fraction), scale: fraction.length };
}

/**
 * per100 x grams / 100, rounded half-up to 0.1, computed on exact decimals.
 * 8.3 x 150 g -> 12.5 (not 12.4), 0.3 x 150 g -> 0.5 (0.45 is a tie in decimal, below it in binary).
 */
export function scaleHalfUp1(per100: number, grams: number): number {
  const a = toScaled(per100);
  const b = toScaled(grams);
  if (!a || !b) return roundHalfUp1((per100 * grams) / 100);
  const den = BigInt(10) ** BigInt(a.scale + b.scale + 1);
  const num = a.n * b.n;
  let q = num / den;
  if ((num % den) * BigInt(2) >= den) q += BigInt(1);
  const magnitude = Number(q) / 10;
  if (magnitude === 0) return 0;
  return (per100 < 0) !== (grams < 0) ? -magnitude : magnitude;
}

/**
 * Round a list of values to whole numbers that add up to the rounded total (largest remainder).
 * Used so meal rows and the day total on Today never disagree by 1.
 */
export function roundToSum(values: readonly number[]): { rounded: number[]; total: number } {
  const total = roundHalfUp(values.reduce((sum, value) => sum + value, 0), 0);
  const floors = values.map((value) => Math.floor(value));
  let missing = total - floors.reduce((sum, value) => sum + value, 0);
  const order = values
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((x, y) => y.fraction - x.fraction || x.index - y.index);
  const rounded = [...floors];
  for (const item of order) {
    if (missing <= 0) break;
    rounded[item.index] += 1;
    missing -= 1;
  }
  return { rounded, total };
}

export interface RemainingDisplay {
  consumed: number;
  target: number;
  kind: 'left' | 'over';
  amount: number;
}

/**
 * Remaining calories from the same whole numbers the ring and total display:
 * at or one kcal short of the target shows "0 left"; no "0.3 left".
 */
export function remainingDisplay(consumedKcal: number, targetKcal: number): RemainingDisplay {
  const consumed = roundHalfUp(consumedKcal, 0);
  const target = roundHalfUp(targetKcal, 0);
  const diff = target - consumed;
  return diff >= 0
    ? { consumed, target, kind: 'left', amount: diff }
    : { consumed, target, kind: 'over', amount: -diff };
}

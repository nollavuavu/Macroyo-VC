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
 * THE kcal display rounding: whole kcal, half-up. Every kcal shown for a logged entry (Log rows, Today rows) goes
 * through this, and every kcal total (meal subtotal, day total, ring, "left") is the SUM OF THESE ROUNDED ROWS, so
 * the numbers on screen always add up. The old largest-remainder allocation chose its winners from the true total
 * (1000.2), so on Today 520.5 showed 520 while Log showed 521; plain half-up per row has no such cross-row effect.
 * The displayed total can differ from the exact total by under half a kcal per row (350 + 520.5 + 129.7 = 1000.2
 * shows as 1,001, the sum of 350, 521 and 130).
 */
export function displayKcal(kcal: number): number {
  return roundHalfUp(kcal, 0);
}

/** The displayed total of some entries: the sum of their displayed (rounded) rows. */
export function displayKcalTotal(entries: readonly { kcal: number }[]): number {
  return entries.reduce((sum, entry) => sum + displayKcal(entry.kcal), 0);
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

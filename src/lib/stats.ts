/** Mean of a list. Returns null for an empty list. */
export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Trailing average: for each index, the mean of the last `window` values up to and including it
 * (fewer at the start). Used for the 7-day weight line.
 */
export function trailingAverage(values: readonly number[], window = 7): number[] {
  const size = Math.max(1, Math.floor(window));
  return values.map((_, index) => {
    const slice = values.slice(Math.max(0, index - size + 1), index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });
}

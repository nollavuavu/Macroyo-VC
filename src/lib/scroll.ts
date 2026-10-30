/**
 * Scroll offset that brings a warning into view. `containerY` is the card's top inside the scroll content and
 * `innerY` the warning's top inside the card (both from onLayout). `margin` keeps a little context above it.
 * Never negative, because scrolling above the content is meaningless.
 */
export function scrollTargetY(containerY: number, innerY: number, margin: number): number {
  const y = containerY + innerY - margin;
  return Number.isFinite(y) ? Math.max(0, Math.round(y)) : 0;
}

/** A container (card, step, row) whose top is measured inside its parent; the chain ends at the scroll content. */
export type ScrollGroup = { y: number; parent?: string };

/** Total top offset inside the scroll content: the field's own y plus every group above it. */
export function fieldOffset(groups: Record<string, ScrollGroup | undefined>, field: { y: number; group?: string }): number {
  let total = field.y;
  let name = field.group;
  for (let depth = 0; name != null && depth < 8; depth += 1) {
    const group = groups[name];
    if (!group) break;
    total += group.y;
    name = group.parent;
  }
  return total;
}

/** The first key, in screen order, that has an error. Falsy values (null, undefined, false, '') are not errors. */
export function firstErrorKey<K extends string>(order: readonly K[], errors: Partial<Record<K, unknown>>): K | null {
  for (const key of order) if (errors[key]) return key;
  return null;
}

/** Prefixes error keys (`kcal` becomes `quick.kcal`) so two forms on one screen can share field names. */
export function errorKeys(prefix: string, errors: Record<string, unknown>): Record<string, true> {
  return Object.fromEntries(Object.keys(errors).filter((key) => errors[key]).map((key) => [`${prefix}.${key}`, true]));
}

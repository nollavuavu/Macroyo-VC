/**
 * Scroll offset that brings a warning into view. `containerY` is the card's top inside the scroll content and
 * `innerY` the warning's top inside the card (both from onLayout). `margin` keeps a little context above it.
 * Never negative, because scrolling above the content is meaningless.
 */
export function scrollTargetY(containerY: number, innerY: number, margin: number): number {
  const y = containerY + innerY - margin;
  return Number.isFinite(y) ? Math.max(0, Math.round(y)) : 0;
}

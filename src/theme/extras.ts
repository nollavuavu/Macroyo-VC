/**
 * Tokens that are not in Jesse's theme.ts, kept in a separate file so theme.ts stays byte-identical.
 * `borderStrong` is for input and chip outlines: at least 3:1 against surface and background (WCAG 1.4.11).
 */
import { contrastRatio, type Theme } from './theme';

export const borderStrongLight = '#838D88';
export const borderStrongDark = '#64746D';

export function borderStrong(theme: Pick<Theme, 'isDark'>): string {
  return theme.isDark ? borderStrongDark : borderStrongLight;
}

export { contrastRatio };

/**
 * Colour for warning outlines, rings and over-target marks. The amber fill `warning` is 2.68:1 on white, under the
 * 3:1 that non-text boundaries need (WCAG 1.4.11). `warningText` is 4.96:1 on white and passes in both schemes.
 */
export function warningBoundary(theme: { colors: { warningText: string } }): string {
  return theme.colors.warningText;
}

/** Small fixed marks that had no token: legend dots, the day-strip dot, the empty-state mark, the welcome logo. */
export const marks = {
  dot: 8,
  dotSmall: 5,
  emptyMark: 64,
  logo: 96,
  logoRadius: 22,
  /** The round "+" on a search result. */
  addCircle: 32,
} as const;

/** Icon sizes (dp) and stroke widths used with lucide icons. */
export const icons = { sm: 18, md: 20, nav: 22, fab: 28 } as const;
export const strokes = { regular: 2, nav: 2.2, bold: 2.4, tabActive: 2.6 } as const;

/** Border widths: `thin` for outlines of inputs, chips and rows; `emphasis` for the framed warning card; `focus` for the focused input. */
export const borders = { thin: 1, emphasis: 1.5, focus: 2 } as const;

/**
 * Fill for over-target rings and bars. The amber `warning` fill is brighter than `warningText`; on its own it is
 * under 3:1 on white (WCAG 1.4.11), so every shape that uses it also gets a `warningBoundary` outline.
 * `warningText` stays for text only.
 */
export function overTargetFill(theme: { colors: { warning: string } }): string {
  return theme.colors.warning;
}

/**
 * How an over-target ring is stroked. The TOTAL stroke never changes (so crossing the target recolours the ring and
 * does not resize it, and nothing is clipped by the SVG box): in light mode a full-width `warningText` stroke is
 * drawn first and a narrower `warning` stroke on top of it, so the rim sits INSIDE the ring's footprint. In dark mode
 * the fill is already 6.5:1 or more on the track and surface, so there is no outline at all.
 */
export function overRingStrokes(theme: Pick<Theme, 'isDark'>, stroke: number): { outline: number | null; fill: number } {
  if (theme.isDark) return { outline: null, fill: stroke };
  return { outline: stroke, fill: stroke - borders.emphasis * 2 };
}

/** Over-target bars narrower than this (viewBox units) do not get an outline: it would be mostly rim. */
export const OVER_BAR_MIN_OUTLINE_WIDTH = 8;

/**
 * Paint for an over-target bar. Light and wide enough: `warning` fill inside a `warningText` outline. Light and
 * narrow: one solid `warningText` bar (4.65:1 or more on the background). Dark: `warning` fill, no outline.
 */
export function overBarPaint(
  theme: { isDark: boolean; colors: { warning: string; warningText: string } },
  barWidth: number,
): { fill: string; outline: string | null } {
  if (theme.isDark) return { fill: overTargetFill(theme), outline: null };
  if (barWidth < OVER_BAR_MIN_OUTLINE_WIDTH) return { fill: warningBoundary(theme), outline: null };
  return { fill: overTargetFill(theme), outline: warningBoundary(theme) };
}

/** A rectangle shrunk by `inset` on every side (never below zero size): the fill inside an outline rect. */
export function insetRect(rect: { x: number; y: number; width: number; height: number }, inset: number) {
  return {
    x: rect.x + inset,
    y: rect.y + inset,
    width: Math.max(0, rect.width - inset * 2),
    height: Math.max(0, rect.height - inset * 2),
  };
}

/**
 * Where the floating action button sits and how much room the scroll content must leave under it.
 * The tab bar is laid out by the navigator, so a tab screen already ends above the bar and its inset: the button
 * only needs `spacing.lg` of its own margin (counting the bar height and the inset again floated it ~76 px too
 * high and added ~64 px of blank scroll). The content's bottom padding ends `fabGap` above the button's top edge,
 * so the last row is never covered once scrolled to the end.
 */
export function fabGeometry(theme: { sizes: { fab: number }; spacing: { lg: number } }) {
  const bottom = theme.spacing.lg;
  const top = bottom + theme.sizes.fab;
  const fabGap = theme.spacing.lg;
  return { bottom, top, contentPaddingBottom: top + fabGap, fabGap };
}

/**
 * Bottom padding of a Screen's scroll content. Inside the tab navigator the bar and the bottom inset are already
 * outside the screen, so only a normal margin (or the FAB clearance) is added. A screen outside the tabs
 * (onboarding) sits on the device edge and adds the inset itself.
 */
export function screenBottomPadding(
  theme: { sizes: { fab: number }; spacing: { lg: number; xxxl: number } },
  options: { insetBottom: number; belowTabBar: boolean; fabClearance: boolean },
): number {
  if (options.fabClearance) return fabGeometry(theme).contentPaddingBottom;
  return options.belowTabBar ? theme.spacing.xxxl : options.insetBottom + theme.spacing.xxxl;
}

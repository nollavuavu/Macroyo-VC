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

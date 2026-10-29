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

/** Small fixed marks that had no token: legend dots, the day-strip dot and the empty-state mark. */
export const marks = {
  dot: 8,
  dotSmall: 5,
  emptyMark: 64,
} as const;

/**
 * Where the floating action button sits and how much room the scroll content must leave under it.
 * Both numbers come from one place so they can never drift apart: the content's bottom padding always ends
 * `fabGap` above the top edge of the button, so the last row is never covered once scrolled to the end,
 * and content that is shorter than the screen is never under the button either.
 */
export function fabGeometry(
  theme: { sizes: { tabBarHeight: number; fab: number }; spacing: { md: number; lg: number } },
  bottomInset: number,
) {
  const bottom = bottomInset + theme.sizes.tabBarHeight + theme.spacing.md;
  const top = bottom + theme.sizes.fab;
  const fabGap = theme.spacing.lg;
  return { bottom, top, contentPaddingBottom: top + fabGap, fabGap };
}

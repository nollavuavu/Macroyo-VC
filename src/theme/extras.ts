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

/**
 * Text props for SVG chart labels. Charts used a literal fontSize "11" and no fontFamily, so the labels rendered
 * in the platform default font. They now follow the caption token (size and family) of the active theme.
 */
import type { Theme } from './theme';

export interface ChartTextProps {
  fontFamily: string;
  fontSize: number;
}

export function chartTextProps(theme: Pick<Theme, 'typography'>): ChartTextProps {
  return { fontFamily: theme.typography.caption.fontFamily, fontSize: theme.typography.caption.fontSize };
}

/**
 * How a "fit" label (single-line text in a fixed-width control: Segmented, Chip) copes with a long translation.
 * Native shrinks the font down to 80% with adjustsFontSizeToFit. react-native-web does not implement that prop,
 * so on web the label may wrap to two lines instead (the controls are 44 px minimum and grow). Never an ellipsis.
 */
export interface FitTextProps {
  numberOfLines: number;
  adjustsFontSizeToFit: boolean;
  minimumFontScale?: number;
}

export const FIT_MIN_SCALE = 0.8;
export const FIT_WEB_LINES = 2;

export function fitTextProps(os: string): FitTextProps {
  if (os === 'web') return { numberOfLines: FIT_WEB_LINES, adjustsFontSizeToFit: false };
  return { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: FIT_MIN_SCALE };
}

/**
 * Macroyo design tokens: dependency-free, no React Native imports.
 *
 * Usage: `const t = getTheme(useColorScheme());`
 *
 * Naming conventions:
 *  - Fill / brand colors keep the plain role name (`protein`, `success`, ...).
 *    Use them for bars, rings, icons, dots and backgrounds.
 *  - `*Text` variants are the AA-safe (>= 4.5:1 on both `background` and `surface`)
 *    colors to use when the same role must be rendered as TEXT. In dark mode every
 *    brand fill already passes, so the `*Text` token equals the fill.
 *  - `on*` tokens are the foreground color to place on top of that fill.
 */

/** Active color scheme. */
export type ColorScheme = 'light' | 'dark';

/** The three tracked macronutrients. */
export type MacroKey = 'protein' | 'carbs' | 'fat';

/** Every color role in a scheme. */
export interface ThemeColors {
  /** Brand teal. Fills, buttons, active tab, links. Also AA as text. */
  primary: string;
  /** Foreground on `primary` fills. */
  onPrimary: string;
  /** Lime accent. CTAs, FAB, active chips. Never use as text on light backgrounds. */
  accent: string;
  /** Foreground on `accent` fills. */
  onAccent: string;
  /** AA-safe version of the accent for text/icons on `background`/`surface`. */
  accentText: string;
  /** Protein macro fill (rings, bars, dots). */
  protein: string;
  /** Carbs macro fill. */
  carbs: string;
  /** Fat macro fill. */
  fat: string;
  /** AA-safe protein color for text. */
  proteinText: string;
  /** AA-safe carbs color for text. */
  carbsText: string;
  /** AA-safe fat color for text. */
  fatText: string;
  /** Screen background. */
  background: string;
  /** Card / sheet surface. */
  surface: string;
  /** Hairlines and dividers. */
  border: string;
  /** Primary body/heading text. */
  textPrimary: string;
  /** Secondary text, captions. */
  textSecondary: string;
  /** "In range" fill. */
  success: string;
  /** AA-safe success color for text. */
  successText: string;
  /** "Over target" fill (amber, never red). */
  warning: string;
  /** AA-safe warning color for text. */
  warningText: string;
}

/** Light-mode palette. */
export const lightColors = {
  primary: '#0E6B5C',
  onPrimary: '#FFFFFF',
  accent: '#B8F24A',
  onAccent: '#0C1210',
  accentText: '#0E6B5C',
  protein: '#FF6B5B',
  carbs: '#F5B93A',
  fat: '#5B8CFF',
  proteinText: '#CF3B2C',
  carbsText: '#966808',
  fatText: '#2F62E8',
  background: '#F7F8F5',
  surface: '#FFFFFF',
  border: '#E6E9E3',
  textPrimary: '#10201B',
  textSecondary: '#5E6B65',
  success: '#2E9E5B',
  successText: '#25804A',
  warning: '#E08A1E',
  warningText: '#9F6215',
} as const satisfies ThemeColors;

/** Dark-mode palette. */
export const darkColors = {
  primary: '#3FB59F',
  onPrimary: '#0C1210',
  accent: '#B8F24A',
  onAccent: '#0C1210',
  accentText: '#B8F24A',
  protein: '#FF7D6E',
  carbs: '#F7C55A',
  fat: '#7BA0FF',
  proteinText: '#FF7D6E',
  carbsText: '#F7C55A',
  fatText: '#7BA0FF',
  background: '#0C1210',
  surface: '#16201C',
  border: '#24312B',
  textPrimary: '#EEF3F0',
  textSecondary: '#93A19A',
  success: '#4CC57A',
  successText: '#4CC57A',
  warning: '#F2A444',
  warningText: '#F2A444',
} as const satisfies ThemeColors;

/** Macros are always displayed in this order (P, C, F). */
export const macroOrder = ['protein', 'carbs', 'fat'] as const;

/** Elevation surface steps for dark mode (used instead of shadows). */
export const darkSurfaces = {
  level0: '#0C1210',
  level1: '#16201C',
  level2: '#1C2924',
  level3: '#24312B',
} as const;

// ---------- Typography ----------

/** Font family names exactly as registered by `useFonts` from @expo-google-fonts. */
export const fontFamilies = {
  heading: 'InterTight_600SemiBold',
  headingBold: 'InterTight_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  mono: 'DMMono_500Medium',
  monoRegular: 'DMMono_400Regular',
} as const;

/** React Native-compatible numeric font weights (as strings). */
export type FontWeight = '400' | '500' | '600' | '700';

/** Font variants used by the app (RN `fontVariant`). */
export type FontVariant = 'tabular-nums';

/** A ready-to-spread React Native text style. */
export interface TextStyleToken {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: FontWeight;
  fontVariant?: FontVariant[];
}

const tabular: FontVariant[] = ['tabular-nums'];

/**
 * Text styles. Spread directly into a `<Text style>`.
 * Numeric styles carry `fontVariant: ['tabular-nums']` so animated values don't jitter.
 */
export const typography = {
  /** Screen title 28/34. */
  title: { fontFamily: fontFamilies.heading, fontSize: 28, lineHeight: 34, fontWeight: '600' },
  /** Section title 20/26. */
  section: { fontFamily: fontFamilies.heading, fontSize: 20, lineHeight: 26, fontWeight: '600' },
  /** Body 16/24. */
  body: { fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 24, fontWeight: '400' },
  /** Body 16/24 medium. */
  bodyMedium: { fontFamily: fontFamilies.bodyMedium, fontSize: 16, lineHeight: 24, fontWeight: '500' },
  /** Secondary 14/20. */
  secondary: { fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  /** Caption 12/16. */
  caption: { fontFamily: fontFamilies.body, fontSize: 12, lineHeight: 16, fontWeight: '400' },
  /** Hero number (calories) 48/52 bold, tabular. */
  heroNumber: {
    fontFamily: fontFamilies.bodyBold, fontSize: 48, lineHeight: 52, fontWeight: '700', fontVariant: tabular,
  },
  /** Metric number (BMI/FFMI) 32/36 semibold, tabular. */
  metricNumber: {
    fontFamily: fontFamilies.bodySemibold, fontSize: 32, lineHeight: 36, fontWeight: '600', fontVariant: tabular,
  },
  /** Inline macro grams 14/20 medium, tabular. */
  macroGrams: {
    fontFamily: fontFamilies.bodyMedium, fontSize: 14, lineHeight: 20, fontWeight: '500', fontVariant: tabular,
  },
  /**
   * Calculator readouts, DM Mono 32/36, tabular. DIGITS AND ASCII UNITS ONLY ("80,5 kg", "—"): DM Mono has no
   * Vietnamese letters and no ₫, so a translated word here would fall back to the system font and shift the line.
   * Never pass a catalog string or a currency to this variant.
   */
  inputNumber: {
    fontFamily: fontFamilies.mono, fontSize: 32, lineHeight: 36, fontWeight: '500', fontVariant: tabular,
  },
  /** Button label 16/24 semibold. */
  button: { fontFamily: fontFamilies.bodySemibold, fontSize: 16, lineHeight: 24, fontWeight: '600' },
} as const satisfies Record<string, TextStyleToken>;

/**
 * Vietnamese stacks tone marks above the letter (Ấ Ẳ Ế Ặ), which rise above the font's ascender line.
 * Android clips anything outside a fixed lineHeight box, so these styles get a taller line in Vietnamese only.
 * Sizes, weights and every other style are unchanged. Measured overhang: title 2.8 px, section 1.1, secondary 0.4, caption 0.9; bodyMedium and macroGrams get the same proportion as their neighbours (16/26 like 14/22).
 */
export const VI_LINE_HEIGHTS = { title: 40, section: 29, bodyMedium: 26, secondary: 22, macroGrams: 22, caption: 18 } as const;

/** Typography for a language. Only 'vi' differs (taller lines); everything else is the base set. */
export function typographyFor(locale: string | null | undefined): Record<TypographyKey, TextStyleToken> {
  if (locale !== 'vi') return typography;
  return {
    ...typography,
    title: { ...typography.title, lineHeight: VI_LINE_HEIGHTS.title },
    section: { ...typography.section, lineHeight: VI_LINE_HEIGHTS.section },
    bodyMedium: { ...typography.bodyMedium, lineHeight: VI_LINE_HEIGHTS.bodyMedium },
    secondary: { ...typography.secondary, lineHeight: VI_LINE_HEIGHTS.secondary },
    macroGrams: { ...typography.macroGrams, lineHeight: VI_LINE_HEIGHTS.macroGrams },
    caption: { ...typography.caption, lineHeight: VI_LINE_HEIGHTS.caption },
  };
}

/** Keys of {@link typography}. */
export type TypographyKey = keyof typeof typography;

// ---------- Spacing, radii, sizes ----------

/** 4pt-based spacing scale (px / dp). */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 48,
  massive: 64,
} as const;

/** Corner radii. */
export const radii = {
  xs: 8,
  thumbnail: 12,
  button: 14,
  card: 20,
  sheet: 28,
  pill: 999,
} as const;

/** Component sizes. */
export const sizes = {
  buttonHeight: 52,
  inputHeight: 56,
  tabBarHeight: 64,
  fab: 56,
  iconDefault: 24,
  iconStrokeWidth: 2,
  thumbnail: 48,
  calorieRing: 220,
  minTouchTarget: 44,
} as const;

// ---------- Shadows (light) ----------

/** React Native shadow style (iOS shadow* + Android elevation). */
export interface ShadowToken {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

/** Light-mode shadows. */
export const shadows = {
  none: {
    shadowColor: '#000000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0,
  },
  /** Cards: 0 4 16 rgba(16,32,27,0.06). */
  card: {
    shadowColor: '#10201B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2,
  },
  /** FAB / floating bars. */
  floating: {
    shadowColor: '#10201B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 20, elevation: 6,
  },
} as const satisfies Record<string, ShadowToken>;

/** Shadow set exposed by `getTheme` (all `none` in dark mode). */
export type ShadowSet = { readonly [K in keyof typeof shadows]: ShadowToken };

// ---------- Motion ----------

/** Motion durations in ms, plus spring damping ratio. */
export const motion = {
  /** Rings/bars fill when a screen opens. */
  fill: 600,
  /** Smooth value updates when a food is added. */
  update: 250,
  /** Undo snackbar visibility. Long enough to read, reach and press; paused while the snackbar is held or focused. */
  toast: 6000,
  /** Search input debounce. */
  searchDebounce: 250,
  /** Sheet spring damping ratio. */
  springDamping: 0.85,
} as const;

// ---------- Accessibility helpers ----------

/**
 * WCAG 2.x contrast ratio between two `#RRGGBB` colors (1 to 21).
 * Handy in unit tests: `expect(contrastRatio(c.successText, c.surface)).toBeGreaterThanOrEqual(4.5)`.
 */
export function contrastRatio(foreground: string, background: string): number {
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const luminance = (hex: string): number => {
    const h = hex.replace('#', '');
    const r = channel(parseInt(h.slice(0, 2), 16));
    const g = channel(parseInt(h.slice(2, 4), 16));
    const b = channel(parseInt(h.slice(4, 6), 16));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// ---------- Theme ----------

/** Fully resolved theme for one color scheme. */
export interface Theme {
  scheme: ColorScheme;
  isDark: boolean;
  colors: ThemeColors;
  /** Light-mode shadows; every entry is `none` in dark mode (use `surfaces`). */
  shadows: ShadowSet;
  /** Dark elevation surface steps; in light mode level0 is the background and the rest are white. */
  surfaces: { readonly level0: string; readonly level1: string; readonly level2: string; readonly level3: string };
  typography: Record<TypographyKey, TextStyleToken>;
  fontFamilies: typeof fontFamilies;
  spacing: typeof spacing;
  radii: typeof radii;
  sizes: typeof sizes;
  motion: typeof motion;
  macroOrder: typeof macroOrder;
  /** Macro fill color for the active scheme. */
  macroColors: Readonly<Record<MacroKey, string>>;
  /** AA-safe macro text color for the active scheme. */
  macroTextColors: Readonly<Record<MacroKey, string>>;
}

/** Resolve the theme for a scheme. `null`/`undefined` (e.g. from `useColorScheme`) falls back to light. */
export function getTheme(scheme: ColorScheme | null | undefined, locale?: string | null): Theme {
  const isDark = scheme === 'dark';
  const colors: ThemeColors = isDark ? darkColors : lightColors;
  return {
    scheme: isDark ? 'dark' : 'light',
    isDark,
    colors,
    shadows: isDark ? { none: shadows.none, card: shadows.none, floating: shadows.none } : shadows,
    surfaces: isDark
      ? darkSurfaces
      : { level0: colors.background, level1: colors.surface, level2: colors.surface, level3: colors.surface },
    typography: typographyFor(locale),
    fontFamilies,
    spacing,
    radii,
    sizes,
    motion,
    macroOrder,
    macroColors: { protein: colors.protein, carbs: colors.carbs, fat: colors.fat },
    macroTextColors: { protein: colors.proteinText, carbs: colors.carbsText, fat: colors.fatText },
  };
}

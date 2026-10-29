import type { Locale } from './types';

/**
 * BCP 47 tags used for Intl. English keeps en-US numbers (1,234.5) and en-GB dates (Wed 28 Oct),
 * the same day-month order the app has always shown.
 */
export const NUMBER_TAG: Record<Locale, string> = { en: 'en-US', vi: 'vi-VN', fi: 'fi-FI' };
export const DATE_TAG: Record<Locale, string> = { en: 'en-GB', vi: 'vi-VN', fi: 'fi-FI' };

const cache = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: Locale, min: number, max: number, grouping: boolean): Intl.NumberFormat {
  const id = `${locale}|${min}|${max}|${grouping}`;
  let format = cache.get(id);
  if (!format) {
    format = new Intl.NumberFormat(NUMBER_TAG[locale], {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      useGrouping: grouping,
    });
    cache.set(id, format);
  }
  return format;
}

export const MINUS = '\u2212';

export interface NumberOptions {
  minFraction?: number;
  maxFraction?: number;
  grouping?: boolean;
}

/**
 * Locale number text. The sign is always the typographic minus (U+2212), never the locale's own,
 * so negative numbers read the same in every language. Callers round first; this only formats.
 */
export function formatNumberFor(locale: Locale, value: number, options: NumberOptions = {}): string {
  if (!Number.isFinite(value)) return '\u2014';
  const max = options.maxFraction ?? 2;
  const min = Math.min(options.minFraction ?? 0, max);
  const body = numberFormat(locale, min, max, options.grouping ?? true).format(Math.abs(value));
  const isZero = Number(Math.abs(value).toFixed(max)) === 0;
  return value < 0 && !isZero ? `${MINUS}${body}` : body;
}

/** The decimal and grouping characters Intl uses for a locale. */
export function numberSymbols(locale: Locale): { decimal: string; group: string } {
  const parts = new Intl.NumberFormat(NUMBER_TAG[locale], { useGrouping: true, minimumFractionDigits: 1 }).formatToParts(12345.6);
  return {
    decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
    group: parts.find((part) => part.type === 'group')?.value ?? ',',
  };
}

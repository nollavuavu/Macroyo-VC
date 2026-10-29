/** Shared i18n types. Pure TypeScript: nothing here imports React, React Native or Expo. */
export type Locale = 'en' | 'vi' | 'fi';
export const LOCALES: readonly Locale[] = ['en', 'vi', 'fi'];
export const DEFAULT_LOCALE: Locale = 'en';

/** What the user picks in Profile. "system" follows the device language. */
export type LanguagePref = 'system' | Locale;
export const LANGUAGE_PREFS: readonly LanguagePref[] = ['system', 'en', 'vi', 'fi'];

/** A param may itself be a message (e.g. a limit name inside a longer sentence). */
export type ParamValue = string | number | Msg;
export type MessageParams = Record<string, ParamValue>;

/**
 * A message the domain layer hands to the UI: a catalog key plus parameters.
 * Domain code never builds sentences. The UI turns this into text with `tm()`.
 */
export interface Msg {
  key: string;
  params?: MessageParams;
}

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'vi' || value === 'fi';
}

export function isLanguagePref(value: unknown): value is LanguagePref {
  return value === 'system' || isLocale(value);
}

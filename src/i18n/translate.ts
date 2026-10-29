import en from './locales/en.json';
import fi from './locales/fi.json';
import vi from './locales/vi.json';
import { formatNumberFor } from './numbers';
import { DEFAULT_LOCALE, type Locale, type MessageParams, type Msg } from './types';

export type Catalog = Record<string, string>;

export const CATALOGS: Record<Locale, Catalog> = { en, vi, fi };

const pluralRules = new Map<Locale, Intl.PluralRules | null>();

/** CLDR plural category ("one", "other", ...). Falls back to English rules if Intl.PluralRules is missing. */
export function pluralCategory(locale: Locale, count: number): string {
  let rules = pluralRules.get(locale);
  if (rules === undefined) {
    try {
      rules = new Intl.PluralRules(locale);
    } catch {
      rules = null;
    }
    pluralRules.set(locale, rules);
  }
  if (rules) return rules.select(count);
  return count === 1 ? 'one' : 'other';
}

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** Names of the {{placeholders}} in a catalog string. */
export function placeholdersOf(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER)) names.add(match[1]);
  return [...names].sort();
}

function lookup(locale: Locale, key: string, count: number | undefined): string | undefined {
  const catalog = CATALOGS[locale];
  if (count !== undefined) {
    const plural = catalog[`${key}_${pluralCategory(locale, count)}`] ?? catalog[`${key}_other`];
    if (plural !== undefined) return plural;
  }
  return catalog[key];
}

/**
 * Look a key up and fill its {{placeholders}}. Missing in the locale falls back to English, then to the
 * key itself (visible in the UI, caught by the key-parity test). Numeric params are formatted for the
 * locale (up to 2 decimals, grouped); pass a string to control the format yourself.
 */
export function translate(locale: Locale, key: string, params?: MessageParams): string {
  const count = typeof params?.count === 'number' ? params.count : undefined;
  const template = lookup(locale, key, count) ?? lookup(DEFAULT_LOCALE, key, count) ?? key;
  if (!params) return template;
  return template.replace(PLACEHOLDER, (whole, name: string) => {
    const value = params[name];
    if (value === undefined) return whole;
    if (typeof value === 'number') return formatNumberFor(locale, value, { maxFraction: 2 });
    if (typeof value === 'string') return value;
    return translateMsg(locale, value);
  });
}

export function translateMsg(locale: Locale, message: Msg): string {
  return translate(locale, message.key, message.params);
}

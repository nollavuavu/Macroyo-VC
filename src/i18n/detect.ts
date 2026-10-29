import { DEFAULT_LOCALE, LOCALES, type LanguagePref, type Locale } from './types';

/** Primary language subtag of a BCP 47 tag or a POSIX-style locale ("vi-VN", "fi_FI", "VI"). */
export function primaryLanguage(tag: string): string {
  return tag.trim().toLowerCase().split(/[-_]/)[0] ?? '';
}

/**
 * The first supported language in the user's preference order, else English.
 * ["de-DE", "fi-FI", "en"] gives "fi": the first tag we can serve wins.
 */
export function resolveLocale(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const language = primaryLanguage(tag);
    const match = LOCALES.find((locale) => locale === language);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

export function resolvePreference(pref: LanguagePref | undefined | null, deviceTags: readonly string[]): Locale {
  if (pref && pref !== 'system') return pref;
  return resolveLocale(deviceTags);
}

/**
 * Device language tags, most preferred first. Web uses navigator.languages. Hermes (iOS and
 * Android) reports the device language through Intl, which is also the last-resort fallback on web.
 */
export function deviceLanguageTags(): string[] {
  const tags: string[] = [];
  try {
    const nav = (globalThis as { navigator?: { languages?: readonly string[]; language?: string } }).navigator;
    if (nav?.languages) tags.push(...nav.languages);
    if (nav?.language) tags.push(nav.language);
  } catch {
    // ignore: fall through to Intl
  }
  try {
    const intlTag = new Intl.DateTimeFormat().resolvedOptions().locale;
    if (intlTag) tags.push(intlTag);
  } catch {
    // Intl missing: English
  }
  return tags;
}

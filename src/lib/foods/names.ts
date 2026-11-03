/**
 * Food names in the app language.
 * `Food.name` is the English name and stays the stored snapshot. Translations live in `Food.names`.
 */

import { getLocale } from '../../i18n/state';
import { LOCALES, type Locale } from '../../i18n/types';
import { loadFoodsById, type Food } from './foods';

/** The name to show for a catalog food: the translation, or English when it is missing or empty. */
export function foodName(food: Pick<Food, 'name' | 'names'>, locale: Locale = getLocale()): string {
  if (locale === 'en') return food.name;
  const translated = food.names[locale];
  return translated && translated.trim() ? translated : food.name;
}

/**
 * The name to show for a logged entry. Entries are snapshots and are never rewritten.
 * - If the entry points at a catalog food AND still carries that food's English name, show the food's name in
 *   the current language.
 * - Otherwise show the snapshot as stored: custom foods (no foodId), ids no longer in the catalog, entries the
 *   user renamed, and entries whose id now points at a different food.
 */
export function entryDisplayName(
  entry: { name: string; foodId: string | null },
  locale: Locale = getLocale(),
  byId: ReadonlyMap<string, Pick<Food, 'name' | 'names'>> = loadFoodsById(),
): string {
  if (entry.foodId == null) return entry.name;
  const food = byId.get(entry.foodId);
  if (!food || entry.name.trim() !== food.name) return entry.name;
  return foodName(food, locale);
}

/**
 * True when `text` is still the entry's own name: the stored snapshot or its display name in any language.
 * The edit form shows the translated name; saving it untouched must keep the stored snapshot as it is.
 */
export function entryNameIsUnchanged(
  entry: { name: string; foodId: string | null },
  text: string,
  byId: ReadonlyMap<string, Pick<Food, 'name' | 'names'>> = loadFoodsById(),
): boolean {
  return text === entry.name || LOCALES.some((locale) => text === entryDisplayName(entry, locale, byId));
}

import { DATE_TAG } from '../i18n/numbers';
import { getLocale } from '../i18n/state';
import { translate } from '../i18n/translate';
import type { MessageKey } from '../i18n/msg';
import type { Locale } from '../i18n/types';

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Catalog keys for the meal names. Translate with t(MEAL_KEY[meal]). */
export const MEAL_KEY: Record<Meal, MessageKey> = {
  breakfast: 'meal.breakfast',
  lunch: 'meal.lunch',
  dinner: 'meal.dinner',
  snack: 'meal.snack',
};

export function localDateISO(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function addDays(iso: string, days: number): string {
  const date = parseLocalDate(iso);
  date.setDate(date.getDate() + days);
  return localDateISO(date);
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function dateFormat(locale: Locale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const id = `${locale}|${JSON.stringify(options)}`;
  let format = formatters.get(id);
  if (!format) {
    format = new Intl.DateTimeFormat(DATE_TAG[locale], options);
    formatters.set(id, format);
  }
  return format;
}

/** Short weekday in the locale: "Wed", "Th 4", "ke". */
export function weekdayShort(iso: string, locale: Locale = getLocale()): string {
  return dateFormat(locale, { weekday: 'short' }).format(parseLocalDate(iso));
}

/** One-letter weekday for the week strip ("W", "T4", "K"), straight from Intl. */
export function weekdayNarrow(iso: string, locale: Locale = getLocale()): string {
  return dateFormat(locale, { weekday: 'narrow' }).format(parseLocalDate(iso));
}

/** "Today", "Yesterday", "Tomorrow", else the weekday, day and month in the locale ("Wed 28 Oct"). */
export function friendlyDate(iso: string, today: string = localDateISO(), locale: Locale = getLocale()): string {
  if (iso === today) return translate(locale, 'date.today');
  if (iso === addDays(today, -1)) return translate(locale, 'date.yesterday');
  if (iso === addDays(today, 1)) return translate(locale, 'date.tomorrow');
  return dateFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(parseLocalDate(iso));
}

/** Short axis label: "28 Oct". */
export function shortDate(iso: string, locale: Locale = getLocale()): string {
  return dateFormat(locale, { day: 'numeric', month: 'short' }).format(parseLocalDate(iso));
}

/** Screen-reader label for a day cell: "Friday 30 October, 2 items logged". */
export function dayAccessibilityLabel(iso: string, entryCount: number, locale: Locale = getLocale()): string {
  const base = dateFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(parseLocalDate(iso));
  return translate(locale, 'date.dayLabel', {
    date: base,
    logged: translate(locale, entryCount === 0 ? 'date.nothingLogged' : 'date.itemsLogged', { count: entryCount }),
  });
}

export function formatLongDate(iso: string, locale: Locale = getLocale()): string {
  return dateFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(parseLocalDate(iso));
}

/** Monday-first week containing the date. */
export function weekDates(iso: string): string[] {
  const date = parseLocalDate(iso);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(monday);
    next.setDate(monday.getDate() + index);
    return localDateISO(next);
  });
}

export function mealForHour(hour: number): Meal {
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export function uid(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') return cryptoRef.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

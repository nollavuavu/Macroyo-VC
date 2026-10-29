export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
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

export function weekdayShort(iso: string): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][parseLocalDate(iso).getDay()] ?? '';
}

const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Today", "Yesterday", "Tomorrow", else "Wed 28 Oct". Deterministic English, no locale. */
export function friendlyDate(iso: string, today: string = localDateISO()): string {
  if (iso === today) return 'Today';
  if (iso === addDays(today, -1)) return 'Yesterday';
  if (iso === addDays(today, 1)) return 'Tomorrow';
  const date = parseLocalDate(iso);
  return `${weekdayShort(iso)} ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** Short axis label: "28 Oct". */
export function shortDate(iso: string): string {
  const date = parseLocalDate(iso);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** Screen-reader label for a day cell: "Friday 30 October, 2 meals logged". */
export function dayAccessibilityLabel(iso: string, entryCount: number): string {
  const date = parseLocalDate(iso);
  const base = `${WEEKDAYS_LONG[date.getDay()]} ${date.getDate()} ${MONTHS_LONG[date.getMonth()]}`;
  return `${base}, ${entryCount === 0 ? 'nothing logged' : `${entryCount} ${entryCount === 1 ? 'item' : 'items'} logged`}`;
}

export function formatLongDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
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

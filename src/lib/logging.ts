import { roundHalfUp1, scaleHalfUp1 } from './domain';
import { uid, type Meal } from './dates';
import type { LogEntry } from './storage/types';

export function roundLogged(value: number): number {
  return roundHalfUp1(value);
}

export function entryFromPer100(input: {
  name: string;
  foodId: string | null;
  date: string;
  meal: Meal;
  grams: number;
  kcalPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  fiberPer100: number | null;
  id?: string;
  /** Totals typed by the user (quick add, edits). Rounded half-up as given; per-100 values are kept for later regrams. */
  exact?: { kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number | null };
}): LogEntry {
  // Round the portion first, then scale on exact decimals, so the row always matches its own grams.
  const grams = roundLogged(input.grams);
  const scaled = input.exact ?? {
    kcal: scaleHalfUp1(input.kcalPer100, grams),
    proteinG: scaleHalfUp1(input.proteinPer100, grams),
    carbsG: scaleHalfUp1(input.carbsPer100, grams),
    fatG: scaleHalfUp1(input.fatPer100, grams),
    fiberG: input.fiberPer100 == null ? null : scaleHalfUp1(input.fiberPer100, grams),
  };
  return {
    id: input.id ?? uid(),
    date: input.date,
    meal: input.meal,
    name: input.name.trim(),
    foodId: input.foodId,
    grams,
    kcal: roundLogged(scaled.kcal),
    proteinG: roundLogged(scaled.proteinG),
    carbsG: roundLogged(scaled.carbsG),
    fatG: roundLogged(scaled.fatG),
    fiberG: scaled.fiberG == null ? null : roundLogged(scaled.fiberG),
    kcalPer100: input.kcalPer100,
    proteinPer100: input.proteinPer100,
    carbsPer100: input.carbsPer100,
    fatPer100: input.fatPer100,
    fiberPer100: input.fiberPer100,
  };
}

export interface PortionMacros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
}

/** Preview of a portion: same half-up decimal scaling the saved entry uses, so preview == saved row. */
export function scalePortion(
  per100: { kcal: number; protein: number; carbs: number; fat: number; fiber: number | null },
  grams: number | null,
): PortionMacros | null {
  if (grams == null) return null;
  const g = roundLogged(grams);
  return {
    kcal: scaleHalfUp1(per100.kcal, g),
    protein: scaleHalfUp1(per100.protein, g),
    carbs: scaleHalfUp1(per100.carbs, g),
    fat: scaleHalfUp1(per100.fat, g),
    fiber: per100.fiber == null ? null : scaleHalfUp1(per100.fiber, g),
  };
}

/** Entry from typed totals for a portion (quick add, or an edited entry). Totals are stored exactly as typed. */
export function entryFromTotals(input: {
  id?: string;
  name: string;
  foodId: string | null;
  date: string;
  meal: Meal;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
}): LogEntry {
  const per100 = 100 / input.grams;
  return entryFromPer100({
    id: input.id,
    name: input.name,
    foodId: input.foodId,
    date: input.date,
    meal: input.meal,
    grams: input.grams,
    kcalPer100: input.kcal * per100,
    proteinPer100: input.proteinG * per100,
    carbsPer100: input.carbsG * per100,
    fatPer100: input.fatG * per100,
    fiberPer100: input.fiberG == null ? null : input.fiberG * per100,
    exact: { kcal: input.kcal, proteinG: input.proteinG, carbsG: input.carbsG, fatG: input.fatG, fiberG: input.fiberG },
  });
}

import { macrosForGrams, roundHalfUp1 } from './domain';
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
}): LogEntry {
  const scaled = macrosForGrams(
    {
      kcal: input.kcalPer100,
      protein: input.proteinPer100,
      carbs: input.carbsPer100,
      fat: input.fatPer100,
      fiber: input.fiberPer100,
    },
    input.grams,
  );
  return {
    id: input.id ?? uid(),
    date: input.date,
    meal: input.meal,
    name: input.name.trim(),
    foodId: input.foodId,
    grams: roundLogged(input.grams),
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

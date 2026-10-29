import type { ActivityLevel, BmrFormula, Goal, Sex, SexConstantChoice } from '../domain/nutrition';
import type { Meal } from '../dates';
import type { LanguagePref } from '../../i18n/types';

export type UnitSystem = 'metric' | 'imperial';
export type Appearance = 'system' | 'light' | 'dark';

export interface Targets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  custom: boolean;
}

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number | null;
  activity: ActivityLevel;
  goal: Goal;
  units: UnitSystem;
  appearance: Appearance;
  pregnant: boolean;
  /** The formula in use when the profile was saved (resolved). */
  formula: BmrFormula;
  /** The user's explicit formula choice. Absent or null means automatic (Katch when body fat is entered). */
  formulaOverride?: BmrFormula | null;
  /** Unspecified sex only: male (+5) or female (−161) Mifflin constant. Absent or null means the average (−78). */
  sexConstant?: SexConstantChoice | null;
  targets: Targets;
  onboardingComplete: true;
}

export interface LogEntry {
  id: string;
  date: string;
  meal: Meal;
  name: string;
  foodId: string | null;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  kcalPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  fiberPer100: number | null;
}

export interface BodyStat {
  id: string;
  date: string;
  weightKg: number;
  heightCm: number;
  bodyFatPct: number | null;
  bmi: number;
  ffmi: number | null;
  normalizedFfmi: number | null;
}

export interface AppData {
  profile: Profile | null;
  logs: LogEntry[];
  bodyStats: BodyStat[];
  /** UI language preference. Absent means follow the device (same as 'system'). */
  language?: LanguagePref;
}

export const EMPTY_DATA: AppData = { profile: null, logs: [], bodyStats: [] };

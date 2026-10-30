/** Realistic stored-data records for storage tests (what the app itself writes). */
export const PROFILE = {
  sex: 'female', age: 30, heightCm: 170, weightKg: 65, bodyFatPct: null, activity: 'light', goal: 'maintain', units: 'metric',
  appearance: 'system', pregnant: false, formula: 'mifflin',
  targets: { kcal: 2000, proteinG: 120, carbsG: 220, fatG: 60, fiberG: 28, custom: false }, onboardingComplete: true,
};
export const LOG = {
  id: 'a', date: '2026-10-30', meal: 'lunch', name: 'Rice', foodId: null, grams: 100, kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3,
  fiberG: null, kcalPer100: 130, proteinPer100: 2.7, carbsPer100: 28, fatPer100: 0.3, fiberPer100: null,
};
export const BODY_STAT = { id: 'b', date: '2026-10-30', weightKg: 65, heightCm: 170, bodyFatPct: null, bmi: 22.5, ffmi: null, normalizedFfmi: null };

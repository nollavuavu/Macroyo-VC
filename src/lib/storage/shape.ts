/**
 * Shape checks for stored data. JSON.parse only fails on broken text, but `123`, `"abc"`, `[]`,
 * `{"profile":5,"logs":"x"}` and `{"logs":{}}` are valid JSON with the wrong shape. They must count as a read
 * failure (the store then backs the blob up and blocks writes) instead of loading as empty data that the next
 * save would overwrite, or crashing at the first `logs.filter`.
 */
import { isLanguagePref } from '../../i18n/types';
import { MEALS } from '../dates';
import { ACTIVITY_FACTORS } from '../domain/nutrition';
import { freshEmptyData, type AppData } from './types';

export const BACKUP_KEEP = 3;
export const BACKUP_PREFIX = 'macroyo.v1.backup.';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type Rec = Record<string, unknown>;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isOneOf = <T extends string>(allowed: readonly T[], value: unknown): value is T => typeof value === 'string' && (allowed as readonly string[]).includes(value);
const isIsoDate = (value: unknown): boolean => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Throws `<where>.<field>` when a required field is missing or has the wrong type. */
function need(where: string, record: Rec, field: string, ok: (value: unknown) => boolean, what: string): void {
  if (!ok(record[field])) throw new Error(`stored ${where}.${field} must be ${what}`);
}
/** An optional field: absent (or null) is fine, anything else must pass. */
function maybe(where: string, record: Rec, field: string, ok: (value: unknown) => boolean, what: string): void {
  const value = record[field];
  if (value !== undefined && value !== null && !ok(value)) throw new Error(`stored ${where}.${field} must be ${what} when present`);
}

const SEXES = ['female', 'male', 'unspecified'] as const;
const GOALS = ['cut', 'maintain', 'bulk'] as const;
const FORMULAS = ['mifflin', 'katch'] as const;
const UNITS = ['metric', 'imperial'] as const;
const APPEARANCES = ['system', 'light', 'dark'] as const;
const isBoolean = (value: unknown) => typeof value === 'boolean';
const isString = (value: unknown) => typeof value === 'string';

/**
 * The profile the app reads without guarding: who they are, the numbers every formula needs, and the four targets.
 * Fields that older builds did not write (formulaOverride, sexConstant, bodyFatPct, fiber target ...) stay optional,
 * and are only type-checked when present.
 */
function checkProfile(profile: Rec): void {
  need('profile', profile, 'sex', (v) => isOneOf(SEXES, v), 'female, male or unspecified');
  need('profile', profile, 'activity', (v) => isOneOf(Object.keys(ACTIVITY_FACTORS), v), 'a known activity level');
  need('profile', profile, 'goal', (v) => isOneOf(GOALS, v), 'cut, maintain or bulk');
  for (const field of ['age', 'heightCm', 'weightKg']) need('profile', profile, field, isFiniteNumber, 'a number');
  maybe('profile', profile, 'bodyFatPct', isFiniteNumber, 'a number');
  maybe('profile', profile, 'units', (v) => isOneOf(UNITS, v), 'metric or imperial');
  maybe('profile', profile, 'appearance', (v) => isOneOf(APPEARANCES, v), 'system, light or dark');
  maybe('profile', profile, 'pregnant', isBoolean, 'true or false');
  maybe('profile', profile, 'formula', (v) => isOneOf(FORMULAS, v), 'mifflin or katch');
  maybe('profile', profile, 'formulaOverride', (v) => isOneOf(FORMULAS, v), 'mifflin or katch');
  maybe('profile', profile, 'sexConstant', (v) => isOneOf(['male', 'female'] as const, v), 'male or female');
  maybe('profile', profile, 'onboardingComplete', isBoolean, 'true or false');
  const targets = profile.targets;
  if (!isRecord(targets)) throw new Error('stored profile.targets must be an object');
  for (const field of ['kcal', 'proteinG', 'carbsG', 'fatG']) need('profile.targets', targets, field, isFiniteNumber, 'a number');
  maybe('profile.targets', targets, 'fiberG', isFiniteNumber, 'a number');
  maybe('profile.targets', targets, 'custom', isBoolean, 'true or false');
}

/** A food-log entry: identity, when and what, and the amounts the day totals add up. */
function checkLog(entry: Rec, index: number): void {
  const where = `logs[${index}]`;
  need(where, entry, 'id', (v) => isString(v) && v !== '', 'a non-empty string');
  need(where, entry, 'date', isIsoDate, 'a YYYY-MM-DD date');
  need(where, entry, 'meal', (v) => isOneOf(MEALS, v), 'a meal');
  need(where, entry, 'name', isString, 'a string');
  for (const field of ['grams', 'kcal', 'proteinG', 'carbsG', 'fatG']) {
    need(where, entry, field, isFiniteNumber, 'a number');
  }
  maybe(where, entry, 'fiberG', isFiniteNumber, 'a number');
  // Per-100 g values are only used to rescale on edit; a missing or null one must not block the whole diary.
  for (const field of ['kcalPer100', 'proteinPer100', 'carbsPer100', 'fatPer100', 'fiberPer100']) maybe(where, entry, field, isFiniteNumber, 'a number');
  maybe(where, entry, 'foodId', isString, 'a string');
}

/** A body-stat record: the values Trends and Calc plot. */
function checkBodyStat(stat: Rec, index: number): void {
  const where = `bodyStats[${index}]`;
  need(where, stat, 'id', (v) => isString(v) && v !== '', 'a non-empty string');
  need(where, stat, 'date', isIsoDate, 'a YYYY-MM-DD date');
  for (const field of ['weightKg', 'heightCm', 'bmi']) need(where, stat, field, isFiniteNumber, 'a number');
  for (const field of ['bodyFatPct', 'ffmi', 'normalizedFfmi']) maybe(where, stat, field, isFiniteNumber, 'a number');
}

function recordList(name: string, value: unknown, check: (record: Rec, index: number) => void): void {
  if (!Array.isArray(value)) throw new Error(`stored ${name} are not a list of entries`);
  value.forEach((item, index) => {
    if (!isRecord(item)) throw new Error(`stored ${name}[${index}] is not an object`);
    check(item, index);
  });
}

/**
 * Returns clean app data, or throws when the parsed value is not the shape the app writes. The check is deep:
 * profile, profile.targets, every log entry and every body stat need their required fields with the right types.
 * Missing top-level keys are fine ({} is a fresh install) and so are the optional fields older builds never wrote.
 */
export function validateStoredData(parsed: unknown): AppData {
  if (!isRecord(parsed)) throw new Error('stored data is not an object');
  const { profile, logs, bodyStats, language, appearance } = parsed;
  if (profile != null) {
    if (!isRecord(profile)) throw new Error('stored profile is not an object');
    checkProfile(profile);
  }
  if (logs != null) recordList('logs', logs, checkLog);
  if (bodyStats != null) recordList('body stats', bodyStats, checkBodyStat);
  const empty = freshEmptyData();
  return {
    profile: (profile ?? null) as AppData['profile'],
    logs: (logs ?? empty.logs) as AppData['logs'],
    bodyStats: (bodyStats ?? empty.bodyStats) as AppData['bodyStats'],
    ...(isLanguagePref(language) ? { language } : {}),
    ...(isOneOf(APPEARANCES, appearance) ? { appearance } : {}),
  };
}

/** Parse the stored text and check its shape. Throws on either failure. */
export function parseStoredData(raw: string): AppData {
  return validateStoredData(JSON.parse(raw));
}

/** Backup keys (timestamp suffix) beyond the newest `keep`, oldest first. Unrelated keys are never returned. */
export function backupKeysToPrune(keys: readonly string[], keep = BACKUP_KEEP): string[] {
  const stamped = keys
    .filter((key) => key.startsWith(BACKUP_PREFIX) && Number.isFinite(Number(key.slice(BACKUP_PREFIX.length))))
    .sort((a, b) => Number(b.slice(BACKUP_PREFIX.length)) - Number(a.slice(BACKUP_PREFIX.length)));
  return stamped.slice(keep).reverse();
}

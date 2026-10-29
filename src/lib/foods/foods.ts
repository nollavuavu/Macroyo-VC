/**
 * Food catalog loader and search.
 * The JSON file can be swapped; only this module reads it.
 * Unknown fiber stays null. A numeric 0 stays 0.
 */

import { formatNumberFor } from '../../i18n/numbers';
import { getLocale } from '../../i18n/state';
import type { Locale } from '../../i18n/types';
import rawFoods from '../../../assets/foods.json';

export interface Food {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  servingLabel?: string;
  servingSizeG?: number;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number | null;
  source?: string;
  fdcId?: number;
  tokens: string[];
}

const KCAL_KEYS = ['kcal_per_100g', 'kcal', 'calories', 'calories_per_100g', 'energy_kcal', 'energy'];
const PROTEIN_KEYS = ['protein_per_100g', 'protein', 'protein_g'];
const CARB_KEYS = ['carbs_per_100g', 'carbs', 'carbohydrates', 'carbs_g', 'carbohydrate'];
const FAT_KEYS = ['fat_per_100g', 'fat', 'fat_g'];
const FIBER_KEYS = ['fiber_per_100g', 'fiber', 'fiber_g'];

export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    if (!(key in record)) continue;
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function readFiber(record: Record<string, unknown>): number | null | undefined {
  for (const key of FIBER_KEYS) {
    if (!(key in record)) continue;
    const value = record[key];
    if (value == null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
    return undefined;
  }
  return undefined;
}

function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

/** Parse a catalog payload. Invalid rows are skipped. Field aliases are accepted. */
export function parseFoods(input: unknown): Food[] {
  const rows = Array.isArray(input) ? input : [];
  const foods: Food[] = [];
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const name = readString(record, ['name', 'food_name', 'description']);
    if (!name) continue;
    const kcal = readNumber(record, KCAL_KEYS);
    const protein = readNumber(record, PROTEIN_KEYS);
    const carbs = readNumber(record, CARB_KEYS);
    const fat = readNumber(record, FAT_KEYS);
    if (kcal == null || protein == null || carbs == null || fat == null) continue;
    if (kcal < 0 || protein < 0 || carbs < 0 || fat < 0) continue;
    const fiber = readFiber(record);
    if (fiber != null && fiber < 0) continue;
    const idRaw = record.id ?? record.fdc_id;
    const id = typeof idRaw === 'number' || typeof idRaw === 'string' ? String(idRaw) : tokenize(name).join('-');
    if (!id) continue;
    const serving = readNumber(record, ['serving_size_g', 'serving_g']);
    const brand = readString(record, ['brand', 'brand_name']);
    const category = readString(record, ['category']);
    const servingLabel = readString(record, ['serving_label', 'serving']);
    const source = readString(record, ['source']);
    const fdc = readNumber(record, ['fdc_id']);
    foods.push({
      id,
      name,
      brand,
      category,
      servingLabel,
      servingSizeG: serving != null && serving > 0 ? serving : undefined,
      kcalPer100g: kcal,
      proteinPer100g: protein,
      carbsPer100g: carbs,
      fatPer100g: fat,
      fiberPer100g: fiber === undefined ? null : fiber,
      source,
      fdcId: fdc,
      tokens: tokenize(name),
    });
  }
  return foods;
}

let cached: Food[] | null = null;

export function loadFoods(): Food[] {
  if (!cached) cached = parseFoods(rawFoods);
  return cached;
}

function normalizePhrase(value: string): string {
  return tokenize(value).join(' ');
}

/**
 * Rank: 0 exact token-set or exact phrase, 1 name starts with the query, 2 other all-token prefix matches.
 * Every query token must be a prefix of some name token, in any order.
 */
export function matchRank(query: string, name: string): number | null {
  const queryTokens = tokenize(query);
  const nameTokens = tokenize(name);
  if (queryTokens.length === 0) return 0;
  const used = new Set<number>();
  for (const token of queryTokens) {
    const index = nameTokens.findIndex((nameToken, nameIndex) => !used.has(nameIndex) && nameToken.startsWith(token));
    if (index < 0) return null;
    used.add(index);
  }
  const queryPhrase = normalizePhrase(query);
  const namePhrase = normalizePhrase(name);
  const sameTokens =
    queryTokens.length === nameTokens.length &&
    [...queryTokens].sort().join(' ') === [...nameTokens].sort().join(' ');
  if (queryPhrase === namePhrase || sameTokens) return 0;
  if (namePhrase.startsWith(queryPhrase)) return 1;
  return 2;
}

export const SEARCH_PAGE_SIZE = 25;

/** Ranked results for a query, capped at `limit` (default one page). */
export function searchFoods(foods: readonly Food[], query: string, limit = SEARCH_PAGE_SIZE): Food[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const hits: { food: Food; rank: number }[] = [];
  for (const food of foods) {
    const rank = matchRank(trimmed, food.name);
    if (rank == null) continue;
    hits.push({ food, rank });
  }
  const queryTokens = tokenize(trimmed);
  /** 0 when every query token is a whole word of the name (so "rice" beats "Ricotta"), else 1. */
  const wholeWord = (food: Food) => (queryTokens.every((token) => food.tokens.includes(token)) ? 0 : 1);
  hits.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const whole = wholeWord(a.food) - wholeWord(b.food);
    if (whole !== 0) return whole;
    // Simple foods first: "Rice, white" before "Rice noodles with chicken and vegetables".
    if (a.food.tokens.length !== b.food.tokens.length) return a.food.tokens.length - b.food.tokens.length;
    if (a.food.name.length !== b.food.name.length) return a.food.name.length - b.food.name.length;
    return a.food.name.localeCompare(b.food.name);
  });
  return hits.slice(0, limit).map((hit) => hit.food);
}

export function formatFiber(fiber: number | null | undefined, locale: Locale = getLocale()): string {
  if (fiber == null) return '—';
  const rounded = Math.round(fiber * 10) / 10;
  if (Object.is(rounded, -0) || rounded === 0) return '0';
  return formatNumberFor(locale, rounded, { minFraction: Number.isInteger(rounded) ? 0 : 1, maxFraction: 1, grouping: false });
}

/**
 * Food catalog loader and search.
 * The JSON file can be swapped; only this module reads it.
 * Unknown fiber stays null. A numeric 0 stays 0.
 */

import { formatNumberFor } from '../../i18n/numbers';
import { getLocale } from '../../i18n/state';
import type { Locale } from '../../i18n/types';
import rawFoods from '../../../assets/foods.json';
import { tokenize } from './fold';
import { BLOCKED_COMPOUNDS, NOT_A_SOURCE, SYNONYM_GROUPS } from './synonyms';

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
  /** Translated names from the catalog (`name_vi`, `name_fi`). Missing or empty means "use `name`". `name` is always English. */
  names: Partial<Record<Exclude<Locale, 'en'>, string>>;
  tokens: string[];
}

const KCAL_KEYS = ['kcal_per_100g', 'kcal', 'calories', 'calories_per_100g', 'energy_kcal', 'energy'];
const PROTEIN_KEYS = ['protein_per_100g', 'protein', 'protein_g'];
const CARB_KEYS = ['carbs_per_100g', 'carbs', 'carbohydrates', 'carbs_g', 'carbohydrate'];
const FAT_KEYS = ['fat_per_100g', 'fat', 'fat_g'];
const FIBER_KEYS = ['fiber_per_100g', 'fiber', 'fiber_g'];

export { tokenize };

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
    const names: Food['names'] = {};
    const nameVi = readString(record, ['name_vi']);
    const nameFi = readString(record, ['name_fi']);
    if (nameVi) names.vi = nameVi;
    if (nameFi) names.fi = nameFi;
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
      names,
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

let cachedById: ReadonlyMap<string, Food> | null = null;

/** The catalog keyed by id, built once. Used to show a logged entry's name in the current language. */
export function loadFoodsById(): ReadonlyMap<string, Food> {
  if (!cachedById) cachedById = new Map(loadFoods().map((food) => [food.id, food]));
  return cachedById;
}

/** One searchable text, folded and pre-split. Built once per food and language. */
interface SearchKey {
  phrase: string;
  tokens: string[];
}

function makeKey(text: string): SearchKey {
  const tokens = tokenize(text);
  return { phrase: tokens.join(' '), tokens };
}

/** Lower-case words with their accents, so "dứa" (pineapple) is not confused with "dưa" (melon). */
function accentedPhrase(text: string): string {
  return text.normalize('NFC').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(' ');
}

const wordsOf = (word: string) => accentedPhrase(word);

/** Synonym groups per language (accented, lower case). */
const groupCache = new Map<Locale, { words: string[]; sources: string[] }[]>();

function groupsFor(locale: Locale) {
  let groups = groupCache.get(locale);
  if (!groups) {
    groups = (SYNONYM_GROUPS[locale] ?? []).map((group) => ({
      words: group.map(wordsOf),
      sources: group.filter((word) => !NOT_A_SOURCE.has(word)).map(wordsOf),
    }));
    groupCache.set(locale, groups);
  }
  return groups;
}

const blockedCompounds = new Map<string, string[]>(
  Object.entries(BLOCKED_COMPOUNDS).map(([word, compounds]) => [wordsOf(word), compounds.map(wordsOf)]),
);

/**
 * Alternative phrasings of a name: each synonym word swapped for the other words of its group, folded for search.
 * Matching is accent-aware, so only a real "dứa" gains "thơm"; "dưa hấu" does not.
 */
export function synonymPhrases(name: string, locale: Locale): string[] {
  const base = accentedPhrase(name);
  let variants = [base];
  for (const group of groupsFor(locale)) {
    const added: string[] = [];
    for (const variant of variants) {
      const padded = ` ${variant} `;
      for (const source of group.sources) {
        // Hide compounds where the word means something else (same length, so indexes line up).
        let masked = padded;
        for (const compound of blockedCompounds.get(source) ?? []) masked = masked.split(` ${compound} `).join(` ${compound.replace(/[^ ]/g, '#')} `);
        const at = masked.indexOf(` ${source} `);
        if (at < 0) continue;
        for (const word of group.words) {
          if (word === source) continue;
          added.push(`${padded.slice(0, at)} ${word} ${padded.slice(at + source.length + 2)}`.trim());
        }
      }
    }
    variants = [...variants, ...added];
  }
  return variants.slice(1).map((variant) => tokenize(variant).join(' '));
}

/** Search texts of a food in a language: its name there first, then English, then regional synonyms. */
function buildKeys(food: Food, locale: Locale): SearchKey[] {
  const keys: SearchKey[] = [];
  const local = locale === 'en' ? undefined : food.names[locale];
  if (local && local.trim()) {
    const primary = makeKey(local);
    keys.push(primary);
    for (const phrase of synonymPhrases(local, locale)) keys.push({ phrase, tokens: phrase.split(' ') });
  }
  keys.push(makeKey(food.name));
  return keys;
}

const keyCache = new WeakMap<Food, Partial<Record<Locale, SearchKey[]>>>();

/** Precomputed normalized keys for a food and language. Built on first use and kept. */
function keysFor(food: Food, locale: Locale): SearchKey[] {
  let perLocale = keyCache.get(food);
  if (!perLocale) {
    perLocale = {};
    keyCache.set(food, perLocale);
  }
  let keys = perLocale[locale];
  if (!keys) {
    keys = buildKeys(food, locale);
    perLocale[locale] = keys;
  }
  return keys;
}

/** Build every key now (call once after load or a language change so the first keystroke is not slower). */
export function warmSearchIndex(foods: readonly Food[], locale: Locale = getLocale()): void {
  for (const food of foods) keysFor(food, locale);
}

function rankKey(queryTokens: string[], queryPhrase: string, key: SearchKey): number | null {
  if (queryTokens.length === 0) return 0;
  const used = new Set<number>();
  for (const token of queryTokens) {
    const index = key.tokens.findIndex((nameToken, nameIndex) => !used.has(nameIndex) && nameToken.startsWith(token));
    if (index < 0) return null;
    used.add(index);
  }
  const sameTokens =
    queryTokens.length === key.tokens.length &&
    [...queryTokens].sort().join(' ') === [...key.tokens].sort().join(' ');
  if (queryPhrase === key.phrase || sameTokens) return 0;
  if (key.phrase.startsWith(queryPhrase)) return 1;
  return 2;
}

/**
 * Rank: 0 exact token-set or exact phrase, 1 name starts with the query, 2 other all-token prefix matches.
 * Every query token must be a prefix of some name token, in any order. Accents and case are ignored.
 */
export function matchRank(query: string, name: string): number | null {
  const queryTokens = tokenize(query);
  return rankKey(queryTokens, queryTokens.join(' '), makeKey(name));
}

export const SEARCH_PAGE_SIZE = 25;

interface Hit {
  food: Food;
  rank: number;
  /** 0 when every query token is a whole word of the matching text (so "rice" beats "Ricotta"), else 1. */
  whole: number;
  /** Token count of the matching text: simple foods first. */
  size: number;
  /** 0 when the query appears with its accents in the shown name (so "dứa" beats "dưa" for the same fold). */
  accent: number;
  shown: string;
}

/**
 * Ranked results for a query, capped at `limit` (default one page).
 * Matches the English name and the name in `locale` (default: the app language), ignoring accents and case,
 * plus regional synonyms in that language. Exact and prefix matches come first.
 */
export function searchFoods(foods: readonly Food[], query: string, limit = SEARCH_PAGE_SIZE, locale: Locale = getLocale()): Food[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const queryTokens = tokenize(trimmed);
  if (queryTokens.length === 0) return [];
  const queryPhrase = queryTokens.join(' ');
  const accented = trimmed.normalize('NFC').toLowerCase();
  const hits: Hit[] = [];
  for (const food of foods) {
    let best: { rank: number; whole: number; size: number } | null = null;
    for (const key of keysFor(food, locale)) {
      const rank = rankKey(queryTokens, queryPhrase, key);
      if (rank == null) continue;
      const whole = queryTokens.every((token) => key.tokens.includes(token)) ? 0 : 1;
      if (!best || rank < best.rank || (rank === best.rank && (whole < best.whole || (whole === best.whole && key.tokens.length < best.size)))) {
        best = { rank, whole, size: key.tokens.length };
      }
    }
    if (!best) continue;
    const shown = locale !== 'en' && food.names[locale]?.trim() ? (food.names[locale] as string) : food.name;
    hits.push({ food, ...best, accent: shown.toLowerCase().includes(accented) ? 0 : 1, shown });
  }
  hits.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.whole !== b.whole) return a.whole - b.whole;
    if (a.accent !== b.accent) return a.accent - b.accent;
    // Simple foods first: "Rice, white" before "Rice noodles with chicken and vegetables".
    if (a.size !== b.size) return a.size - b.size;
    if (a.shown.length !== b.shown.length) return a.shown.length - b.shown.length;
    return a.shown.localeCompare(b.shown);
  });
  return hits.slice(0, limit).map((hit) => hit.food);
}

export function formatFiber(fiber: number | null | undefined, locale: Locale = getLocale()): string {
  if (fiber == null) return '—';
  const rounded = Math.round(fiber * 10) / 10;
  if (Object.is(rounded, -0) || rounded === 0) return '0';
  return formatNumberFor(locale, rounded, { minFraction: Number.isInteger(rounded) ? 0 : 1, maxFraction: 1, grouping: false });
}

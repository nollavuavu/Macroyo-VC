import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MEASURE_LIMITS, CM_PER_IN, KG_PER_LB, heightFeetInchesRange, inMeasureRange, measureRange, measureRangeMessage, measureRangeMetric,
  typedMeasureRange, validateHeightCm, validateTypedMeasure, validateWeightKg,
} from './domain';
import { parseStoredData } from './storage/shape';
import { openStore } from './storage/store';
import { BODY_STAT, LOG, PROFILE } from './testFixtures';
import { en } from '../i18n/testing';
import vi from '../i18n/locales/vi.json';
import fi from '../i18n/locales/fi.json';
import enCatalog from '../i18n/locales/en.json';

const root = join(__dirname, '../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const UNITS = ['metric', 'imperial'] as const;

describe('QA-15: one units-aware range for onboarding, Profile and Calc', () => {
  it('the limits are the spec (design proposal 3.4): 120-230 cm, 30-250 kg, age 18-120', () => {
    expect(MEASURE_LIMITS).toEqual({ height: { min: 120, max: 230 }, weight: { min: 30, max: 250 }, age: { min: 18, max: 120 } });
    expect(measureRange('height', 'metric')).toEqual({ lo: 120, hi: 230 });
    expect(measureRange('weight', 'metric')).toEqual({ lo: 30, hi: 250 });
    expect(measureRange('height', 'imperial')).toEqual({ lo: 48, hi: 90 });
    expect(measureRange('weight', 'imperial')).toEqual({ lo: 67, hi: 551 });
    expect(typedMeasureRange('weight', 'imperial')).toEqual(measureRange('weight', 'imperial'));
    expect(heightFeetInchesRange()).toEqual({ minFt: 4, minIn: 0, maxFt: 7, maxIn: 6 });
  });

  // The validator every screen uses, per kind, in cm / kg. Onboarding and Profile call it with their unit; Calc too.
  const check = { height: (v: number, u: 'metric' | 'imperial') => validateHeightCm(v, u), weight: (v: number, u: 'metric' | 'imperial') => validateWeightKg(v, u) };

  it.each(['height', 'weight'] as const)('%s: edges are accepted, just outside is rejected, in both units', (kind) => {
    for (const units of UNITS) {
      const { lo, hi } = measureRange(kind, units);
      const per = units === 'metric' ? 1 : kind === 'height' ? CM_PER_IN : KG_PER_LB;
      expect(check[kind](lo * per, units).ok, `${kind} ${units} min`).toBe(true);
      expect(check[kind](hi * per, units).ok, `${kind} ${units} max`).toBe(true);
      expect(check[kind]((lo - 0.5) * per, units).ok, `${kind} ${units} below`).toBe(false);
      expect(check[kind]((hi + 0.5) * per, units).ok, `${kind} ${units} above`).toBe(false);
      expect(check[kind](null as unknown as number, units).ok).toBe(false);
    }
  });

  it.each(['height', 'weight'] as const)('%s: the form validators and the Calc typed box agree on every value', (kind) => {
    for (const units of UNITS) {
      const { lo, hi } = measureRange(kind, units);
      const per = units === 'metric' ? 1 : kind === 'height' ? CM_PER_IN : KG_PER_LB;
      for (const typed of [lo - 1, lo - 0.1, lo, (lo + hi) / 2, hi, hi + 0.1, hi + 1, 0, -5, 999, 1000]) {
        const form = check[kind](typed * per, units).ok;
        const calc = validateTypedMeasure(kind, String(typed), units).ok;
        expect(form, `${kind} ${units} ${typed}`).toBe(calc);
        expect(inMeasureRange(kind, units, typed * per)).toBe(form);
      }
    }
  });

  it('the checklist O-7 rejects still hold: height 0, -1, 999 cm; weight 0, -1, 1000 kg', () => {
    for (const v of [0, -1, 999]) expect(validateHeightCm(v).ok).toBe(false);
    for (const v of [0, -1, 1000]) expect(validateWeightKg(v).ok).toBe(false);
  });

  it('metric messages quote cm and kg from the shared range', () => {
    expect(en(validateHeightCm(100).message!)).toBe('Enter a height from 120 to 230 cm.');
    expect(en(validateWeightKg(20).message!)).toBe('Enter a weight from 30 to 250 kg.');
    expect(en(validateWeightKg(300).message!)).toBe('Enter a weight from 30 to 250 kg.');
  });

  it('imperial messages quote ft/in and lb and never cm or kg', () => {
    const height = en(validateHeightCm(100, 'imperial').message!);
    const weight = en(validateWeightKg(20, 'imperial').message!);
    expect(height).toBe('Enter a height from 4 ft 0 in to 7 ft 6 in.');
    expect(weight).toBe('Enter a weight from 67 to 551 lb.');
    expect(`${height} ${weight}`).not.toMatch(/\b(cm|kg)\b/);
    // Calc has one inches box, so it quotes inches
    expect(en(measureRangeMessage('height', 'imperial', 'inches'))).toBe('Enter a height from 48 to 90 in.');
    expect(en(validateHeightCm(100, 'imperial', 'inches').message!)).toBe('Enter a height from 48 to 90 in.');
  });

  it('the messages exist in en, vi and fi with matching placeholders, and imperial ones never name metric units', () => {
    const keys = ['validate.height.rangeImperial', 'validate.typed.range.height.in', 'validate.typed.range.weight.lb', 'validate.typed.range.height.cm', 'validate.typed.range.weight.kg'];
    for (const key of keys) {
      const holes = (text: string) => (text.match(/\{\{\w+\}\}/g) ?? []).sort().join();
      const reference = holes((enCatalog as Record<string, string>)[key]);
      expect(reference, key).not.toBe('');
      for (const catalog of [vi, fi] as Record<string, string>[]) expect(holes(catalog[key]), key).toBe(reference);
    }
    for (const catalog of [enCatalog, vi, fi] as Record<string, string>[]) {
      for (const key of ['validate.height.rangeImperial', 'validate.typed.range.height.in', 'validate.typed.range.weight.lb']) {
        expect(catalog[key], key).not.toMatch(/\b(cm|kg)\b/);
      }
      expect(catalog['validate.height.range']).toBeUndefined();
      expect(catalog['validate.weight.range']).toBeUndefined();
    }
    expect(vi['validate.typed.range.weight.lb']).toMatch(/lb/);
    expect(fi['validate.typed.range.weight.lb']).toMatch(/lb/);
  });

  it('every accepted imperial value is inside the metric range, so the three screens never disagree', () => {
    for (const kind of ['height', 'weight'] as const) {
      const metric = measureRange(kind, 'metric');
      const { min, max } = measureRangeMetric(kind, 'imperial');
      expect(min).toBeGreaterThanOrEqual(metric.lo);
      expect(max).toBeLessThanOrEqual(metric.hi);
      expect(measureRangeMetric(kind, 'metric')).toEqual({ min: metric.lo, max: metric.hi });
    }
  });

  it('onboarding, Profile and Calc all validate through the shared functions with their units', () => {
    const onboarding = read('app/onboarding.tsx');
    const profile = read('app/(tabs)/profile.tsx');
    const calc = read('app/(tabs)/calc.tsx');
    expect(onboarding).toMatch(/validateHeightCm\(heightCm, units\)/);
    expect(onboarding).toMatch(/validateWeightKg\(weightKg, units\)/);
    expect(profile).toMatch(/validateHeightCm\(value, profile\.units\)/);
    expect(profile).toMatch(/validateWeightKg\(value, profile\.units\)/);
    expect(calc).toMatch(/validateHeightCm\(heightCm, units, 'inches'\)/);
    expect(calc).toMatch(/validateWeightKg\(weightKg, units\)/);
    for (const text of [onboarding, profile, calc]) {
      expect(text).not.toMatch(/validate(Height|Weight)(Cm|Kg)\([a-zA-Z]+\)/);
    }
  });

  it('Calc sliders read the shared bounds, with no range literals left', () => {
    const calc = read('app/(tabs)/calc.tsx');
    expect(calc).toMatch(/measureRangeMetric\('height', units\)/);
    expect(calc).toMatch(/measureRangeMetric\('weight', units\)/);
    expect(calc).toMatch(/minimumValue=\{heightBounds\.min\} maximumValue=\{heightBounds\.max\}/);
    expect(calc).toMatch(/minimumValue=\{weightBounds\.min\} maximumValue=\{weightBounds\.max\}/);
    expect(calc).not.toMatch(/(minimumValue|maximumValue)=\{(120|230|30|250)\}/);
    expect(calc).not.toMatch(/Math\.(min|max)\((250|30),/);
  });

  it('Profile keeps a stored value it did not change, so an older profile outside the range can still be saved', () => {
    const profile = read('app/(tabs)/profile.tsx');
    expect(profile).toMatch(/value === profile\.heightCm/);
    expect(profile).toMatch(/value === profile\.weightKg/);
    // a changed value is still checked
    expect(validateWeightKg(270).ok).toBe(false);
    expect(inMeasureRange('weight', 'metric', 250)).toBe(true);
  });
});

describe('QA-16: stored data is checked deeply', () => {
  it.each([
    ['an empty profile', '{"profile":{}}'],
    ['profile with null targets', '{"profile":{"targets":null}}'],
    ['an empty log entry', '{"logs":[{}]}'],
    ['an empty body stat', '{"bodyStats":[{}]}'],
    ['a profile without targets', JSON.stringify({ profile: { ...PROFILE, targets: undefined } })],
    ['targets missing protein', JSON.stringify({ profile: { ...PROFILE, targets: { kcal: 2000, carbsG: 1, fatG: 1 } } })],
    ['targets with a string kcal', JSON.stringify({ profile: { ...PROFILE, targets: { ...PROFILE.targets, kcal: '2000' } } })],
    ['a profile with an unknown activity level', JSON.stringify({ profile: { ...PROFILE, activity: 'hyper' } })],
    ['a profile with a string age', JSON.stringify({ profile: { ...PROFILE, age: '30' } })],
    ['a profile with null weight', JSON.stringify({ profile: { ...PROFILE, weightKg: null } })],
    ['a log with an unknown meal', JSON.stringify({ logs: [{ ...LOG, meal: 'brunch' }] })],
    ['a log with a bad date', JSON.stringify({ logs: [{ ...LOG, date: 'yesterday' }] })],
    ['a log without grams', JSON.stringify({ logs: [{ ...LOG, grams: undefined }] })],
    ['a log with a string kcal', JSON.stringify({ logs: [{ ...LOG, kcal: '130' }] })],
    ['a second log that is broken', JSON.stringify({ logs: [LOG, { id: 'x' }] })],
    ['a body stat without weight', JSON.stringify({ bodyStats: [{ ...BODY_STAT, weightKg: undefined }] })],
    ['a body stat with a string bmi', JSON.stringify({ bodyStats: [{ ...BODY_STAT, bmi: 'x' }] })],
  ])('rejects %s', (_label, raw) => {
    expect(() => parseStoredData(raw)).toThrow();
  });

  it('accepts what the app writes, and older or partial data without the optional fields', () => {
    const { formula: _f, appearance: _a, pregnant: _p, bodyFatPct: _b, onboardingComplete: _o, units: _u, ...older } = PROFILE;
    const olderTargets = { kcal: 2000, proteinG: 120, carbsG: 220, fatG: 60 };
    const cases = [
      '{}',
      '{"profile":null,"logs":[],"bodyStats":[]}',
      JSON.stringify({ profile: PROFILE, logs: [LOG], bodyStats: [BODY_STAT], language: 'fi' }),
      JSON.stringify({ profile: { ...older, targets: olderTargets } }),
      JSON.stringify({ profile: { ...PROFILE, formulaOverride: 'katch', sexConstant: 'male', bodyFatPct: 18, pregnant: true } }),
      JSON.stringify({ profile: { ...PROFILE, sex: 'unspecified', goal: 'cut', activity: 'extra', units: 'imperial', appearance: 'dark' } }),
      JSON.stringify({ logs: [{ ...LOG, foodId: 'rice-white', fiberG: 0.4, fiberPer100: 0.4 }] }),
      JSON.stringify({ logs: [{ ...LOG, kcalPer100: null, proteinPer100: null, carbsPer100: undefined }] }),
      JSON.stringify({ bodyStats: [{ ...BODY_STAT, bodyFatPct: 18, ffmi: 19.2, normalizedFfmi: 19.9 }] }),
      JSON.stringify({ profile: { ...PROFILE, weightKg: 270, heightCm: 100 } }),
      JSON.stringify({ logs: ['breakfast', 'lunch', 'dinner', 'snack'].map((meal, i) => ({ ...LOG, id: `m${i}`, meal })) }),
    ];
    for (const raw of cases) expect(() => parseStoredData(raw), raw).not.toThrow();
    expect(parseStoredData(cases[0])).toEqual({ profile: null, logs: [], bodyStats: [] });
  });

  it('the error names the field that failed', () => {
    expect(() => parseStoredData('{"profile":{"targets":null}}')).toThrow(/profile\./);
    expect(() => parseStoredData('{"logs":[{}]}')).toThrow(/logs\[0\]\.id/);
    expect(() => parseStoredData('{"bodyStats":[{}]}')).toThrow(/bodyStats\[0\]\.id/);
  });

  it('a deep failure is a read failure: backed up, writes blocked, nothing overwritten', async () => {
    for (const raw of ['{"profile":{}}', '{"profile":{"targets":null}}', '{"logs":[{}]}', '{"bodyStats":[{}]}']) {
      let writes = 0;
      let backups = 0;
      const store = await openStore({
        load: async () => parseStoredData(raw),
        save: async () => { writes += 1; },
        backupRaw: async () => { backups += 1; },
      });
      expect(store.isBlocked(), raw).toBe(true);
      expect(backups, raw).toBe(1);
      const attempt = await store.commit((cur) => ({ ...cur, language: 'vi' }));
      expect(attempt.ok).toBe(false);
      expect(writes).toBe(0);
    }
  });

  it('well-formed older data opens unblocked and saves normally', async () => {
    let writes = 0;
    const store = await openStore({
      load: async () => parseStoredData(JSON.stringify({ profile: PROFILE, logs: [LOG], bodyStats: [BODY_STAT] })),
      save: async () => { writes += 1; },
      backupRaw: async () => {},
    });
    expect(store.isBlocked()).toBe(false);
    expect((await store.commit((cur) => ({ ...cur, language: 'vi' }))).ok).toBe(true);
    expect(writes).toBe(1);
  });
});

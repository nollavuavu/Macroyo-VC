import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BACKUP_KEEP, BACKUP_PREFIX, backupKeysToPrune, parseStoredData, validateStoredData } from './storage/shape';
import { EMPTY_DATA, freshEmptyData } from './storage/types';
import { eraseThenLeave } from './reset';
import { typedMeasureRange, validateTypedMeasure, withoutFieldError, quickAddFieldErrors } from './domain';
import { msg } from '../i18n';
import { BODY_STAT, LOG, PROFILE } from './testFixtures';

const src = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('QA-13: stored data of the wrong shape is a read failure', () => {
  it.each([
    ['a number', '123'],
    ['a string', '"abc"'],
    ['null', 'null'],
    ['an array', '[]'],
    ['logs as an object', '{"logs":{}}'],
    ['logs as a string', '{"logs":"x"}'],
    ['bodyStats as a number', '{"bodyStats":5}'],
    ['profile as a number', '{"profile":5}'],
    ['profile as an array', '{"profile":[]}'],
    ['a log entry that is not an object', '{"logs":[1]}'],
  ])('rejects %s', (_label, raw) => {
    expect(() => parseStoredData(raw)).toThrow();
  });

  it('still rejects text that is not JSON', () => {
    expect(() => parseStoredData('{oops')).toThrow();
  });

  it('accepts the shapes the app writes, and fills missing lists', () => {
    expect(parseStoredData('{}')).toEqual({ profile: null, logs: [], bodyStats: [] });
    const full = { profile: PROFILE, logs: [LOG], bodyStats: [BODY_STAT], language: 'vi' };
    expect(parseStoredData(JSON.stringify(full))).toEqual(full);
    expect(validateStoredData({ profile: null, logs: [], bodyStats: [], language: 'klingon' })).not.toHaveProperty('language');
  });

  it('both persistence implementations use the shared validator', () => {
    for (const file of ['src/lib/storage/persistImpl.ts', 'src/lib/storage/persistImpl.web.ts']) {
      expect(src(file)).toContain('parseStoredData');
      expect(src(file)).not.toMatch(/JSON\.parse/);
    }
  });
});

describe('INFO: backups are pruned to the latest 3', () => {
  it('returns only the stale timestamped backups, oldest first', () => {
    const keys = ['macroyo.v1', 'other', `${BACKUP_PREFIX}100`, `${BACKUP_PREFIX}500`, `${BACKUP_PREFIX}300`, `${BACKUP_PREFIX}200`, `${BACKUP_PREFIX}400`, `${BACKUP_PREFIX}notanumber`];
    expect(BACKUP_KEEP).toBe(3);
    expect(backupKeysToPrune(keys)).toEqual([`${BACKUP_PREFIX}100`, `${BACKUP_PREFIX}200`]);
    expect(backupKeysToPrune(keys.slice(0, 5))).toEqual([]);
  });

  it('web prunes through the helper and native deletes all but the newest rows', () => {
    expect(src('src/lib/storage/persistImpl.web.ts')).toMatch(/backupKeysToPrune[\s\S]*multiRemove/);
    const native = src('src/lib/storage/persistImpl.ts');
    expect(native).toContain('DELETE FROM app_state WHERE id > 1');
    expect(native).toContain('ORDER BY id DESC LIMIT ?');
    expect(native).toContain('BACKUP_KEEP');
  });
});

describe('INFO: native load never shares EMPTY_DATA', () => {
  it('freshEmptyData returns new arrays each time', () => {
    const a = freshEmptyData();
    const b = freshEmptyData();
    expect(a).toEqual(EMPTY_DATA);
    expect(a.logs).not.toBe(EMPTY_DATA.logs);
    expect(a.logs).not.toBe(b.logs);
    a.logs.push({} as never);
    expect(EMPTY_DATA.logs).toHaveLength(0);
  });

  it('native loadState uses it', () => {
    const native = src('src/lib/storage/persistImpl.ts');
    expect(native).toContain('freshEmptyData()');
    expect(native).not.toContain('...EMPTY_DATA');
  });
});

describe('QA-14: reset only navigates after a successful erase', () => {
  it('leaves on success', async () => {
    let left = 0;
    expect(await eraseThenLeave(async () => true, () => { left += 1; })).toBe(true);
    expect(left).toBe(1);
  });

  it('stays on failure', async () => {
    let left = 0;
    expect(await eraseThenLeave(async () => false, () => { left += 1; })).toBe(false);
    expect(left).toBe(0);
  });

  it('Profile uses it and shows the storage error in the erase card', () => {
    const profile = src('app/(tabs)/profile.tsx');
    expect(profile).toContain('eraseThenLeave(resetAll');
    expect(profile).not.toMatch(/await resetAll\(\);\s*router\.replace/);
    expect(profile).toContain('testID="erase-error"');
  });
});

describe('INFO: editing a quick-add field clears only that field\'s error', () => {
  it('withoutFieldError', () => {
    const errors = quickAddFieldErrors({ name: '', kcal: null, proteinG: null, carbsG: null, fatG: null, fiberG: null, grams: null } as never);
    const keys = Object.keys(errors);
    expect(keys.length).toBeGreaterThan(1);
    const next = withoutFieldError(errors, 'name');
    expect(next).not.toHaveProperty('name');
    expect(Object.keys(next)).toEqual(keys.filter((key) => key !== 'name'));
    expect(withoutFieldError(next, 'name')).toBe(next);
    expect(errors).toHaveProperty('name');
  });

  it('every quick-add field and the edit fields are wired to it', () => {
    const log = src('app/(tabs)/log.tsx');
    for (const field of ['name', 'kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'grams']) {
      expect(log).toMatch(new RegExp(`quickInput\\('${field}'`));
    }
    expect(log).toContain("withoutFieldError(current, EDIT_FIELD[field])");
    expect(log).toContain("withoutFieldError(current, 'name')");
    expect(log).toContain("withoutFieldError(current, 'grams')");
    expect(log).not.toMatch(/onChangeText=\{setQuick\w+\} error=/);
  });
});

describe('INFO: the imperial range message is the range that is accepted', () => {
  it('height 48 to 90 in: message and acceptance agree at and around the edges', () => {
    const { lo, hi } = typedMeasureRange('height', 'imperial');
    expect([lo, hi]).toEqual([48, 90]);
    const message = validateTypedMeasure('height', '', 'imperial').message;
    expect(message).toEqual(msg('validate.typed.missing.height'));
    const out = validateTypedMeasure('height', '10', 'imperial').message;
    expect(out?.params).toMatchObject({ min: lo, max: hi });
    expect(validateTypedMeasure('height', String(lo), 'imperial').ok).toBe(true);
    expect(validateTypedMeasure('height', String(hi), 'imperial').ok).toBe(true);
    expect(validateTypedMeasure('height', '47.5', 'imperial').ok).toBe(false);
    expect(validateTypedMeasure('height', '90.5', 'imperial').ok).toBe(false);
  });

  it('every accepted imperial value is inside the metric range, for height and weight', () => {
    for (const kind of ['height', 'weight'] as const) {
      const metric = typedMeasureRange(kind, 'metric');
      const { lo, hi } = typedMeasureRange(kind, 'imperial');
      for (const value of [lo, hi]) {
        const result = validateTypedMeasure(kind, String(value), 'imperial');
        expect(result.ok).toBe(true);
        expect(result.value!).toBeGreaterThanOrEqual(metric.lo - 1e-9);
        expect(result.value!).toBeLessThanOrEqual(metric.hi + 1e-9);
      }
      expect(validateTypedMeasure(kind, String(lo - 0.5), 'imperial').ok).toBe(false);
      expect(validateTypedMeasure(kind, String(hi + 0.5), 'imperial').ok).toBe(false);
    }
  });

  it('metric and age are unchanged', () => {
    expect(typedMeasureRange('age', 'imperial')).toEqual(typedMeasureRange('age', 'metric'));
    expect(validateTypedMeasure('height', '120', 'metric').ok).toBe(true);
    expect(validateTypedMeasure('height', '119', 'metric').ok).toBe(false);
  });
});

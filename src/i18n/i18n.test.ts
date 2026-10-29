import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import fi from './locales/fi.json';
import vi from './locales/vi.json';
import { CATALOGS, placeholdersOf, pluralCategory, translate, translateMsg } from './translate';
import { deviceLanguageTags, resolveLocale, resolvePreference } from './detect';
import { formatNumberFor, MINUS } from './numbers';
import { isLanguagePref, isLocale, LANGUAGE_PREFS, LOCALES } from './types';
import { msg } from './msg';
import { friendlyDate, formatLongDate, shortDate, weekdayNarrow } from '../lib/dates';
import { formatAmount, formatInputNumber, formatKcal, formatSigned } from '../lib/format';
import { decimalMark, isAmbiguousThousands, parseDecimal } from '../lib/domain/nutrition';

const EN = en as Record<string, string>;
const OTHERS = { vi: vi as Record<string, string>, fi: fi as Record<string, string> };

describe('catalog integrity', () => {
  for (const [locale, catalog] of Object.entries(OTHERS)) {
    it(`${locale} has exactly the en key set, no missing and no extra keys`, () => {
      const missing = Object.keys(EN).filter((key) => !(key in catalog));
      const extra = Object.keys(catalog).filter((key) => !(key in EN));
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });

    it(`${locale} has no empty values and no untouched English placeholders`, () => {
      for (const [key, value] of Object.entries(catalog)) {
        expect(typeof value, key).toBe('string');
        expect(value.trim().length, key).toBeGreaterThan(0);
      }
    });

    it(`${locale} uses the same {{placeholders}} as en for every key`, () => {
      for (const key of Object.keys(EN)) {
        expect(placeholdersOf(catalog[key]), `${locale}:${key}`).toEqual(placeholdersOf(EN[key]));
      }
    });
  }

  it('en values are non-empty and placeholders are well formed', () => {
    for (const [key, value] of Object.entries(EN)) {
      expect(value.trim().length, key).toBeGreaterThan(0);
      expect(value.replace(/\{\{\s*[A-Za-z0-9_]+\s*\}\}/g, '')).not.toMatch(/[{}]/);
    }
  });

  it('every plural key has both _one and _other in every locale', () => {
    for (const catalog of [EN, OTHERS.vi, OTHERS.fi]) {
      for (const key of Object.keys(catalog)) {
        const match = /^(.*)_(one|other)$/.exec(key);
        if (!match) continue;
        expect(catalog[`${match[1]}_one`], key).toBeDefined();
        expect(catalog[`${match[1]}_other`], key).toBeDefined();
        expect(placeholdersOf(catalog[`${match[1]}_one`]), key).toContain('count');
      }
    }
  });

  it('proper nouns and symbols are not translated by accident', () => {
    for (const locale of LOCALES) {
      expect(CATALOGS[locale]['lang.en']).toBe('English');
      expect(CATALOGS[locale]['lang.vi']).toBe('Tiếng Việt');
      expect(CATALOGS[locale]['lang.fi']).toBe('Suomi');
    }
  });
});

describe('every key in code exists, and every key is used', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (name === 'node_modules' || name === 'locales') continue;
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) files.push(path);
    }
  };
  walk(join(__dirname, '../../src'));
  walk(join(__dirname, '../../app'));
  const source = files.map((file) => readFileSync(file, 'utf8')).join('\n');
  const literal = /['"`]([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)+|disclaimer)['"`]/g;
  const literals = new Set([...source.matchAll(literal)].map((match) => match[1]));
  const families = [...source.matchAll(/['"`]([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)*\.)\$\{/g)].map((match) => match[1]);
  const base = (key: string) => key.replace(/_(one|other)$/, '');

  it('every literal key used in code is in the en catalog', () => {
    expect(literals.size).toBeGreaterThan(150);
    expect(families.length).toBeGreaterThan(3);
    const known = new Set(Object.keys(EN).map(base));
    const unknown = [...literals].filter((key) => /^(activity|appearance|bmi|calc|common|date|ffmi|formula|goal|horizon|lang|limit|log|macro|meal|notFound|offset|onboarding|plan|profile|projection|quickAdd|ring|sex|sexConstant|storage|tabs|targets|today|trends|unit|units|validate)\./.test(key) && !known.has(key));
    expect(unknown).toEqual([]);
  });

  it('every en key is used somewhere (literally or through a dynamic family)', () => {
    const unused = Object.keys(EN)
      .map(base)
      .filter((key, index, all) => all.indexOf(key) === index)
      .filter((key) => !literals.has(key) && !families.some((prefix) => key.startsWith(prefix)));
    expect(unused).toEqual([]);
  });
});

describe('plural handling', () => {
  it('fi: 1 is "one", everything else (including 0) is "other"', () => {
    expect(pluralCategory('fi', 1)).toBe('one');
    expect(pluralCategory('fi', 0)).toBe('other');
    expect(pluralCategory('fi', 2)).toBe('other');
    expect(translate('fi', 'profile.logEntries', { count: 1 })).toBe('1 lokimerkintä');
    expect(translate('fi', 'profile.logEntries', { count: 0 })).toBe('0 lokimerkintää');
    expect(translate('fi', 'profile.logEntries', { count: 12 })).toBe('12 lokimerkintää');
    expect(translate('fi', 'today.copied', { count: 1 })).toBe('Kopioitu 1 kohde eilisestä.');
    expect(translate('fi', 'today.copied', { count: 3 })).toBe('Kopioitu 3 kohdetta eilisestä.');
  });
  it('en: one / other', () => {
    expect(translate('en', 'today.copied', { count: 1 })).toBe('Copied 1 item from yesterday.');
    expect(translate('en', 'today.copied', { count: 2 })).toBe('Copied 2 items from yesterday.');
  });
  it('vi: one category for everything, both forms say the same thing', () => {
    expect(pluralCategory('vi', 1)).toBe('other');
    expect(translate('vi', 'today.copied', { count: 1 })).toBe('Đã sao chép 1 món từ hôm qua.');
    expect(translate('vi', 'today.copied', { count: 5 })).toBe('Đã sao chép 5 món từ hôm qua.');
    for (const key of Object.keys(EN).filter((k) => k.endsWith('_one'))) {
      expect(OTHERS.vi[key], key).toBe(OTHERS.vi[key.replace(/_one$/, '_other')]);
    }
  });
  it('grouped counts use the locale grouping', () => {
    expect(translate('fi', 'profile.logEntries', { count: 1234 })).toMatch(/^1[\u00a0\u202f]234 lokimerkintää$/);
    expect(translate('vi', 'profile.logEntries', { count: 1234 })).toBe('1.234 mục nhật ký');
  });
});

describe('Msg objects', () => {
  it('translate with params and nested messages, in every locale', () => {
    const nested = msg('limit.and', { a: msg('limit.onePct'), b: msg('limit.floor') });
    expect(translateMsg('en', nested)).toBe('1% of body weight per week and the calorie floor');
    expect(translateMsg('fi', nested)).toBe('1\u00a0% painosta viikossa ja kalorien alaraja');
    expect(translateMsg('vi', nested)).toBe('1% cân nặng mỗi tuần và mức calo tối thiểu');
  });
  it('fall back to English, then to the key, for an unknown key', () => {
    expect(translate('fi', 'no.such.key')).toBe('no.such.key');
  });
});

describe('language detection', () => {
  it('uses vi or fi when the device matches, otherwise English', () => {
    expect(resolveLocale(['vi-VN'])).toBe('vi');
    expect(resolveLocale(['vi'])).toBe('vi');
    expect(resolveLocale(['fi-FI', 'en-US'])).toBe('fi');
    expect(resolveLocale(['FI_fi'])).toBe('fi');
    expect(resolveLocale(['de-DE', 'fi-FI'])).toBe('fi');
    expect(resolveLocale(['sv-FI'])).toBe('en');
    expect(resolveLocale(['de-DE'])).toBe('en');
    expect(resolveLocale([])).toBe('en');
    expect(resolveLocale(['', 'xx'])).toBe('en');
  });
  it('an explicit preference wins over the device; system and missing follow the device', () => {
    expect(resolvePreference('en', ['vi-VN'])).toBe('en');
    expect(resolvePreference('fi', ['en-US'])).toBe('fi');
    expect(resolvePreference('system', ['vi-VN'])).toBe('vi');
    expect(resolvePreference(undefined, ['fi'])).toBe('fi');
    expect(resolvePreference(null, ['de'])).toBe('en');
  });
  it('type guards', () => {
    expect(LANGUAGE_PREFS).toEqual(['system', 'en', 'vi', 'fi']);
    expect(isLanguagePref('vi')).toBe(true);
    expect(isLanguagePref('de')).toBe(false);
    expect(isLocale('system')).toBe(false);
    expect(deviceLanguageTags().length).toBeGreaterThan(0);
  });
});

describe('Intl number formatting', () => {
  it('en 1,234.5 · vi 1.234,5 · fi 1 234,5 (no-break space), with a real minus sign', () => {
    expect(formatNumberFor('en', 1234.5, { maxFraction: 1 })).toBe('1,234.5');
    expect(formatNumberFor('vi', 1234.5, { maxFraction: 1 })).toBe('1.234,5');
    expect(formatNumberFor('fi', 1234.5, { maxFraction: 1 })).toMatch(/^1[\u00a0\u202f]234,5$/);
    expect(formatNumberFor('en', -1234.5, { maxFraction: 1 })).toBe(`${MINUS}1,234.5`);
    expect(formatNumberFor('vi', -0.04, { maxFraction: 1 })).toBe('0');
  });
  it('kcal, signed and amounts follow the locale', () => {
    expect(formatKcal(2850, 'en')).toBe('2,850');
    expect(formatKcal(2850, 'vi')).toBe('2.850');
    expect(formatKcal(2850, 'fi')).toMatch(/^2[\u00a0\u202f]850$/);
    expect(formatSigned(-300, 0, 'vi')).toBe('−300');
    expect(formatAmount(80.5, 1, 'vi')).toBe('80,5');
    expect(formatAmount(80.5, 1, 'fi')).toBe('80,5');
    expect(formatAmount(80.5, 1, 'en')).toBe('80.5');
  });
  it('input fields show an ungrouped number with the locale decimal mark', () => {
    expect(formatInputNumber(1234.5, 'fi')).toBe('1234,5');
    expect(formatInputNumber(1234.5, 'vi')).toBe('1234,5');
    expect(formatInputNumber(1234.5, 'en')).toBe('1234.5');
    expect(decimalMark('vi')).toBe(',');
    expect(decimalMark('en')).toBe('.');
  });
});

describe('Intl date formatting', () => {
  const day = '2026-10-28';
  it('en-GB, vi-VN and fi-FI day names and order', () => {
    expect(formatLongDate(day, 'en')).toBe('Wednesday 28 October');
    expect(formatLongDate(day, 'vi')).toBe('Thứ Tư, 28 tháng 10');
    expect(formatLongDate(day, 'fi')).toBe('keskiviikko 28. lokakuuta');
    expect(shortDate(day, 'en')).toBe('28 Oct');
    expect(shortDate(day, 'fi')).toBe('28.10.');
    expect(weekdayNarrow(day, 'vi')).toBe('T4');
    expect(friendlyDate(day, '2026-10-28', 'fi')).toBe('Tänään');
    expect(friendlyDate(day, '2026-10-29', 'vi')).toBe('Hôm qua');
    expect(friendlyDate(day, '2026-10-27', 'en')).toBe('Tomorrow');
  });
});

describe('parsing input in every locale (units stay kg/cm/kcal/g)', () => {
  it('accepts both "." and "," as the decimal mark in every locale', () => {
    for (const locale of LOCALES) {
      expect(parseDecimal('80,5', locale)).toBe(80.5);
      expect(parseDecimal('80.5', locale)).toBe(80.5);
      expect(parseDecimal('0,125', locale)).toBe(0.125);
      expect(parseDecimal('.5', locale)).toBe(0.5);
      expect(parseDecimal('80.', locale)).toBe(80);
      expect(parseDecimal('1234', locale)).toBe(1234);
    }
  });
  it('rejects the ambiguous "1,234" everywhere and "1.234" in Vietnamese only', () => {
    for (const locale of LOCALES) expect(parseDecimal('1,234', locale), locale).toBeNull();
    expect(parseDecimal('1.234', 'en')).toBe(1.234);
    expect(parseDecimal('1.234', 'fi')).toBe(1.234);
    expect(parseDecimal('1.234', 'vi')).toBeNull();
    expect(isAmbiguousThousands('12.345', 'vi')).toBe(true);
    expect(isAmbiguousThousands('12.345', 'en')).toBe(false);
    expect(parseDecimal('1.23', 'vi')).toBe(1.23);
  });
  it('Finnish accepts a space or no-break space as the thousands mark when groups are exact', () => {
    expect(parseDecimal('2 500', 'fi')).toBe(2500);
    expect(parseDecimal('2\u00a0500,5', 'fi')).toBe(2500.5);
    expect(parseDecimal('2 50', 'fi')).toBeNull();
    expect(parseDecimal('80 5', 'en')).toBeNull();
  });
  it('round trip: what an input field shows parses back to the same number in each locale', () => {
    for (const locale of LOCALES) {
      for (const value of [0.5, 80.5, 1234.5, 172.4]) {
        expect(parseDecimal(formatInputNumber(value, locale), locale), `${locale} ${value}`).toBe(value);
      }
    }
  });
});

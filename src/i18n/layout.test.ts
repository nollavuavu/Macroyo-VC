import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import fi from './locales/fi.json';
import vi from './locales/vi.json';
import { typography, typographyFor, getTheme, VI_LINE_HEIGHTS } from '../theme/theme';
import { weekdayNarrow } from '../lib/dates';
import { NBSP, formatHeightCm, formatPercent, formatWeightKg, withUnit } from '../lib/format';

/** Layout-review fixes for vi and fi (Jesse's i18n review): line heights, short labels, NBSP, soft hyphens, week letters. */
const CATALOGS = { en: en as Record<string, string>, vi: vi as Record<string, string>, fi: fi as Record<string, string> };
const read = (path: string) => readFileSync(join(__dirname, '../..', path), 'utf8');

describe('P1-1 Vietnamese line heights', () => {
  it('vi gets taller title/section/secondary/caption lines; sizes and other styles are untouched', () => {
    const vit = typographyFor('vi');
    expect(vit.title.lineHeight).toBe(40);
    expect(vit.section.lineHeight).toBe(29);
    expect(vit.secondary.lineHeight).toBe(22);
    expect(vit.caption.lineHeight).toBe(18);
    expect(VI_LINE_HEIGHTS).toEqual({ title: 40, section: 29, secondary: 22, caption: 18 });
    for (const key of Object.keys(typography) as (keyof typeof typography)[]) {
      expect(vit[key].fontSize, key).toBe(typography[key].fontSize);
      expect(vit[key].fontFamily, key).toBe(typography[key].fontFamily);
    }
    expect(vit.body).toEqual(typography.body);
    expect(vit.heroNumber).toEqual(typography.heroNumber);
    expect(vit.button).toEqual(typography.button);
  });
  it('en and fi use the base typography, and the theme picks it up per locale', () => {
    expect(typographyFor('en')).toBe(typography);
    expect(typographyFor('fi')).toBe(typography);
    expect(typographyFor(undefined)).toBe(typography);
    expect(getTheme('light', 'vi').typography.title.lineHeight).toBe(40);
    expect(getTheme('dark', 'fi').typography.title.lineHeight).toBe(34);
    expect(getTheme('light').typography.title.lineHeight).toBe(34);
  });
});

describe('P1-2 / P2-9 short labels in fixed-width controls', () => {
  it('fi lang.system is "Auto"; the 4-way language control has no long words', () => {
    expect(fi['lang.system']).toBe('Auto');
    for (const locale of ['en', 'vi', 'fi'] as const) {
      expect(CATALOGS[locale]['lang.system'].length, locale).toBeLessThanOrEqual(8);
    }
    expect(fi['appearance.system']).toBe('Järjestelmä'); // 3-way control has room
  });
  it('fi long buttons are short enough to stay on one line at 360 dp', () => {
    expect(fi['storage.eraseUnreadable']).toBe('Poista tiedot ja aloita alusta');
    expect(fi['profile.recalculate']).toBe('Laske tavoitteet uudelleen');
  });
});

describe('P1-3 / P1-4 / P1-5 component rules (source checks)', () => {
  const ui = read('src/components/ui.tsx');
  it('tab labels do not scale with system font size', () => {
    expect(read('app/(tabs)/_layout.tsx')).toContain('tabBarAllowFontScaling: false');
  });
  it('Segmented and Chip labels are one line and shrink to 80% instead of breaking mid-word', () => {
    expect(ui).toMatch(/numberOfLines=\{fit \? 1 : numberOfLines\}/);
    expect(ui).toContain('adjustsFontSizeToFit={fit}');
    expect(ui).toContain('minimumFontScale={fit ? 0.8 : undefined}');
    const segmented = ui.slice(ui.indexOf('export function Segmented'), ui.indexOf('export function Field'));
    expect(segmented).toMatch(/<AppText variant="secondary" fit /);
    const chip = ui.slice(ui.indexOf('export function Chip'), ui.indexOf('export function Chip') + 2500);
    expect(chip).toMatch(/<AppText variant="bodyMedium" fit /);
  });
  it('Finnish text gets Android hyphenation', () => {
    expect(ui).toContain("android_hyphenationFrequency={locale === 'fi' ? 'normal' : undefined}");
  });
  it('the DM Mono inputNumber variant is only used with numbers and units, never a catalog string', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (name === 'node_modules') continue;
        if (statSync(path).isDirectory()) walk(path);
        else if (name.endsWith('.tsx')) files.push(path);
      }
    };
    walk(join(__dirname, '../../app'));
    walk(join(__dirname, '../../src'));
    let uses = 0;
    for (const file of files) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!line.includes('variant="inputNumber"')) continue;
        uses += 1;
        expect(line, `${file}: ${line.trim()}`).not.toMatch(/\bt\(|\btm\(|₫/);
      }
    }
    expect(uses).toBeGreaterThan(0);
    expect(read('src/theme/theme.ts')).toContain('DIGITS AND ASCII UNITS ONLY');
  });
});

describe('P2-6 no-break space between a number and its unit', () => {
  it('withUnit and the weight/height formatters use U+00A0', () => {
    expect(withUnit('80,5', 'kg')).toBe(`80,5${NBSP}kg`);
    expect(NBSP).toBe('\u00a0');
    expect(formatWeightKg(80.5, 'metric')).toBe('80.5\u00a0kg');
    expect(formatHeightCm(180, 'metric')).toBe('180\u00a0cm');
    expect(formatPercent(0.52, 'en')).toBe('52%');
    expect(formatPercent(0.52, 'fi')).toMatch(/^52[\u00a0\u202f]%$/);
  });
  it('catalog text never has an ordinary space between a {{value}} or digit and kcal / kg / cm / g / lb', () => {
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      for (const [key, value] of Object.entries(catalog)) {
        expect(value, `${locale}:${key}`).not.toMatch(/(\}\}|\d) (kcal|kg|cm|g|lb)(?![A-Za-zÀ-ỹ/])/);
      }
    }
  });
});

describe('P2-7 week-strip letters', () => {
  // 2026-10-26 is a Monday
  const week = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
  it('en M T W T F S S · fi M T K T P L S · vi T2 … T7 CN', () => {
    expect(week.map((day) => weekdayNarrow(day, 'en')).join(' ')).toBe('M T W T F S S');
    expect(week.map((day) => weekdayNarrow(day, 'fi')).join(' ')).toBe('M T K T P L S');
    expect(week.map((day) => weekdayNarrow(day, 'vi')).join(' ')).toBe('T2 T3 T4 T5 T6 T7 CN');
  });
});

describe('P2-8 soft hyphens in the longest Finnish compounds', () => {
  const SHY = '\u00ad';
  it('only fi has them, and removing them gives plain words', () => {
    expect(JSON.stringify(en)).not.toContain('\u00ad');
    expect(JSON.stringify(vi)).not.toContain('\u00ad');
    const withShy = Object.entries(fi).filter(([, value]) => value.includes(SHY));
    expect(withShy.length).toBeGreaterThan(8);
    expect(fi['onboarding.adultsBody']).toContain(`kehon${SHY}koostumus${SHY}indeksejä`);
    for (const [key, value] of withShy) {
      expect(value.replace(/\u00ad/g, ''), key).not.toMatch(/\u00ad/);
      expect(value, key).not.toMatch(/\u00ad\s|\s\u00ad|\u00ad\u00ad/); // never doubled or next to a space
    }
  });
  it('words under 15 letters are left alone', () => {
    for (const value of Object.values(fi)) {
      for (const word of value.split(/[\s,.;:()”“]+/)) {
        if (word.includes(SHY)) expect(word.replace(/\u00ad/g, '').length).toBeGreaterThanOrEqual(15);
      }
    }
  });
});

describe('P2-10 search hint and placeholder around the English example', () => {
  it('vi and fi explain that food names are English; the example itself stays quoted English', () => {
    expect(fi['log.searchPlaceholder']).toBe('Englanniksi, esim. ”baked bacon”');
    expect(vi['log.searchPlaceholder']).toBe('Tên tiếng Anh, vd “baked bacon”');
    for (const catalog of [fi, vi]) {
      expect(catalog['log.searchHint_other']).toContain('baked bacon');
      expect(catalog['log.searchHint_other']).toContain('Bacon, baked');
      expect(catalog['log.searchHint_other']).not.toMatch(/\bUSDA names\b|\bTry\b/);
    }
    expect(fi['log.searchHint_one']).toContain('{{count}} ruoan');
  });
});

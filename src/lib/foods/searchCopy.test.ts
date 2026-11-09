import { describe, expect, it } from 'vitest';
import en from '../../i18n/locales/en.json';
import fi from '../../i18n/locales/fi.json';
import vi from '../../i18n/locales/vi.json';
import { loadFoods, searchFoods } from './foods';
import { foodName } from './names';

type Lang = 'en' | 'vi' | 'fi';
const CATALOGS: Record<Lang, Record<string, string>> = { en, vi, fi };
const foods = loadFoods();

/** QA-19: copy that tells the user food names are English only, or to search only in English. */
const ENGLISH_ONLY: Record<Lang, RegExp[]> = {
  en: [/stay in English/i, /names (are|stay) English/i],
  vi: [/tên tiếng Anh\)/i, /(vẫn|chỉ|đều) (bằng|là) tiếng Anh/i, /tên món ăn vẫn/i, /chỉ.{0,30}tiếng Anh/i],
  fi: [/pysyvät englanniksi/i, /nimet englanniksi/i, /^Englanniksi,/i, /vain englanniksi/i, /ainoastaan englanniksi/i],
};
const QUOTE = /[“”"]([^“”"]+)[“”"]/;

describe('QA-19: search and language copy matches the behaviour', () => {
  it('no vi, fi or en string says food names are English only or to search in English only', () => {
    for (const lang of ['en', 'vi', 'fi'] as const) {
      for (const [key, value] of Object.entries(CATALOGS[lang])) {
        for (const pattern of ENGLISH_ONLY[lang]) expect(value, `${lang}:${key}`).not.toMatch(pattern);
      }
    }
  });

  it('the Log hint says you can search in the app language or in English', () => {
    expect(vi['log.searchHint_other']).toMatch(/tiếng Việt hoặc tiếng Anh/);
    expect(fi['log.searchHint_other']).toMatch(/suomeksi tai englanniksi/);
    expect(vi['log.searchPlaceholder']).not.toMatch(/baked|bacon/i);
    expect(fi['log.searchPlaceholder']).not.toMatch(/baked|bacon|englanniksi/i);
  });

  it('the Profile language note says some foods keep their English name, not that all do', () => {
    expect(vi['profile.languageHint']).toContain('Một số món giữ nguyên tên tiếng Anh');
    expect(fi['profile.languageHint']).toContain('Joillakin ruoilla on englanninkielinen nimi');
    expect(en['profile.languageHint']).toContain('Foods without a local name keep their English name');
  });

  it('the placeholder example is a real food in that locale: findable, and shown under that name', () => {
    for (const lang of ['vi', 'fi'] as const) {
      const example = QUOTE.exec(CATALOGS[lang]['log.searchPlaceholder'])?.[1];
      expect(example, lang).toBeTruthy();
      const hits = searchFoods(foods, example!, 5000, lang);
      expect(hits.length, `${lang} "${example}"`).toBeGreaterThan(0);
      expect(hits.some((food) => foodName(food, lang).toLowerCase().includes(example!.toLowerCase())), lang).toBe(true);
      // The example must still match a translated name, not only an English name that happens to
      // contain the same letters (Open Food Facts rows use "bánh mì" in the English name).
      expect(
        hits.some((food) => {
          const shown = foodName(food, lang).toLowerCase();
          const english = food.name.toLowerCase();
          return shown.includes(example!.toLowerCase()) && !english.includes(example!.toLowerCase());
        }),
        lang,
      ).toBe(true);
    }
    // the English example still works in English
    expect(searchFoods(foods, 'baked bacon', 50, 'en').some((food) => food.name === 'Bacon, baked')).toBe(true);
  });

  it('the example in the hint is findable too: the accent-free form finds the accented name (vi), the Finnish example finds its food', () => {
    expect(searchFoods(foods, 'banh mi', 5000, 'vi').some((food) => foodName(food, 'vi').toLowerCase().includes('bánh mì'))).toBe(true);
    const fiExample = QUOTE.exec(fi['log.searchHint_other'])![1];
    const fiTarget = /”[^”]+”[^”]*”([^”]+)”/.exec(fi['log.searchHint_other'])![1];
    expect(searchFoods(foods, fiExample, 5000, 'fi').some((food) => foodName(food, 'fi') === fiTarget)).toBe(true);
  });

  it('English search still works in every locale', () => {
    for (const lang of ['en', 'vi', 'fi'] as const) {
      expect(searchFoods(foods, 'baked bacon', 50, lang).some((food) => food.name === 'Bacon, baked'), lang).toBe(true);
    }
  });
});

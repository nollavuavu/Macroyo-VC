import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { foldText, tokenize } from './fold';
import { loadFoods, matchRank, parseFoods, searchFoods, synonymPhrases, warmSearchIndex } from './foods';
import { foodName } from './names';
import { BLOCKED_COMPOUNDS, NOT_A_SOURCE, SYNONYM_GROUPS } from './synonyms';

const foods = loadFoods();
const names = (query: string, locale: 'en' | 'vi' | 'fi', limit = 10) => searchFoods(foods, query, limit, locale).map((food) => foodName(food, locale));

describe('folding', () => {
  it('drops accents, maps đ/Đ to d and lower-cases', () => {
    expect(foldText('Bánh mì')).toBe('banh mi');
    expect(foldText('Đậu Hà Lan')).toBe('dau ha lan');
    expect(foldText('đ Đ')).toBe('d d');
    expect(foldText('Kääpiö, Öljy, Å')).toBe('kaapio, oljy, a');
    expect(foldText('Jalapeño')).toBe('jalapeno');
  });

  it('tokenizes folded words', () => {
    expect(tokenize('Bánh mì, nướng')).toEqual(['banh', 'mi', 'nuong']);
    expect(tokenize('Đậu')).toEqual(['dau']);
  });
});

describe('accent-insensitive search in Vietnamese', () => {
  it("'banh mi', 'bánh mì' and 'BANH MÌ' all find Bánh mì foods", () => {
    for (const query of ['banh mi', 'bánh mì', 'BANH MÌ', 'banh m']) {
      const found = names(query, 'vi', 25);
      expect(found.length, query).toBeGreaterThan(5);
      expect(found.every((name) => foldText(name).includes('banh m')), query).toBe(true);
      expect(found.some((name) => name.startsWith('Bánh mì')), query).toBe(true);
    }
  });

  it('đ/Đ match d: "dau" finds Đậu and Dầu, "Đậu" finds Đậu', () => {
    const plain = names('dau', 'vi', 100);
    expect(plain.some((name) => name.startsWith('Đậu'))).toBe(true);
    expect(plain.some((name) => name.startsWith('Dầu'))).toBe(true);
    const accented = names('Đậu', 'vi', 100);
    expect(accented.length).toBeGreaterThan(5);
    expect(accented.every((name) => foldText(name).split(/[^a-z0-9]+/).some((word) => word.startsWith('dau')))).toBe(true);
  });

  it('when the query keeps its accents, the exact accented word ranks first', () => {
    expect(names('dứa', 'vi', 1)[0]).toMatch(/^Dứa/);
    expect(names('dưa', 'vi', 1)[0]).toMatch(/^Dưa/);
  });

  it('matches the Vietnamese name and the English name in Vietnamese mode', () => {
    expect(names('chicken', 'vi', 100).length).toBeGreaterThan(10);
    expect(names('bacon baked', 'vi', 5)).toContain('Thịt xông khói, nướng lò');
    expect(names('thit xong khoi', 'vi', 5)).toContain('Thịt xông khói, nướng lò');
  });
});

describe('accent-insensitive search in Finnish', () => {
  it('ä and ö fold to a and o in both directions', () => {
    expect(names('pahkina', 'fi', 50).some((name) => name.toLowerCase().includes('pähkinä'))).toBe(true);
    expect(names('pähkinä', 'fi', 50)).toEqual(names('pahkina', 'fi', 50));
    expect(names('oljy', 'fi', 50).some((name) => name.toLowerCase().includes('öljy'))).toBe(true);
    expect(names('ÖLJY', 'fi', 50)).toEqual(names('oljy', 'fi', 50));
  });

  it('finds Finnish names and English names in Finnish mode', () => {
    expect(names('kaali', 'fi', 10).some((name) => name.startsWith('Kaali'))).toBe(true);
    expect(names('chicken', 'fi', 100).length).toBeGreaterThan(10);
  });
});

describe('English always matches, in all three languages', () => {
  it('finds every English query in en, vi and fi', () => {
    for (const query of ['bacon baked', 'quail egg', 'rice', 'tequila']) {
      const ids = (locale: 'en' | 'vi' | 'fi') => searchFoods(foods, query, 5000, locale).map((food) => food.id);
      const english = new Set(ids('en'));
      expect(english.size, query).toBeGreaterThan(0);
      for (const locale of ['vi', 'fi'] as const) {
        const found = new Set(ids(locale));
        for (const id of english) expect(found.has(id), `${query} ${locale} ${id}`).toBe(true);
      }
    }
  });

  it('English matches even when the translation is empty or equal to the English name', () => {
    const rows = parseFoods([
      { id: '1', name: 'Cheerios', kcal: 370, protein: 12, carbs: 73, fat: 6, name_vi: 'Cheerios', name_fi: '' },
      { id: '2', name: 'Plain tofu', kcal: 80, protein: 8, carbs: 2, fat: 5, name_vi: '', name_fi: 'Tofu' },
    ]);
    for (const locale of ['en', 'vi', 'fi'] as const) {
      expect(searchFoods(rows, 'cheer', 5, locale).map((food) => food.id)).toEqual(['1']);
      expect(searchFoods(rows, 'plain', 5, locale).map((food) => food.id)).toEqual(['2']);
    }
    expect(searchFoods(rows, 'tofu', 5, 'fi')).toHaveLength(1);
  });

  it('does not match the other language: Vietnamese words find nothing in English mode', () => {
    expect(names('banh mi', 'en')).toEqual([]);
  });
});

describe('ranking', () => {
  it('puts exact and prefix matches before looser ones, in every language', () => {
    expect(matchRank('banh mi', 'Bánh mì')).toBe(0);
    expect(matchRank('banh', 'Bánh mì, nướng')).toBe(1);
    expect(matchRank('mi', 'Bánh mì, nướng')).toBe(2);
    expect(names('rice', 'en', 1)[0].toLowerCase()).toMatch(/^rice/);
    const [first] = names('sữa', 'vi', 1);
    expect(first).toMatch(/^Sữa/);
    expect(searchFoods(foods, '', 5, 'vi')).toEqual([]);
    expect(searchFoods(foods, '!!!', 5, 'vi')).toEqual([]);
  });

  it('a whole-word hit beats a prefix inside a longer word', () => {
    const rows = parseFoods([
      { id: 'a', name: 'Ricotta cheese', kcal: 1, protein: 1, carbs: 1, fat: 1 },
      { id: 'b', name: 'Rice, white', kcal: 1, protein: 1, carbs: 1, fat: 1 },
    ]);
    expect(searchFoods(rows, 'rice', 5, 'en').map((food) => food.id)).toEqual(['b']);
    expect(searchFoods(rows, 'ric', 5, 'en').map((food) => food.id)).toEqual(['b', 'a']);
  });
});

describe('regional Vietnamese synonyms', () => {
  const find = (query: string) => names(query, 'vi', 100);

  it('indexes the glossary groups: pineapple dứa/thơm/khóm', () => {
    for (const query of ['dứa', 'thơm', 'thom', 'khóm', 'khom']) expect(find(query), query).toContain('Dứa, tươi');
  });

  it('does not mix up dứa (pineapple) and dưa (melon) when adding synonyms', () => {
    expect(find('thom')).not.toContain('Dưa hấu, tươi');
    expect(find('khom').every((name) => /^Dứa|dứa/.test(name))).toBe(true);
  });

  it('cucumber is two-way: dưa leo <-> dưa chuột', () => {
    for (const query of ['dua leo', 'dưa chuột', 'dua chuot']) expect(find(query), query).toContain('Dưa leo, có vỏ, sống');
    expect(find('dưa chuột muối chua')).toContain('Dưa chuột muối chua (dill pickles)');
    expect(find('dua leo muoi chua')).toContain('Dưa chuột muối chua (dill pickles)');
  });

  it('pork is two-way: heo <-> lợn', () => {
    expect(find('thit lon xay')).toContain('Thịt heo xay, sống');
    expect(find('mỡ heo')).toContain('Mỡ lợn');
    expect(find('mo heo')).toContain('Mỡ lợn');
    expect(find('lợn')).toContain('Thịt heo hầm');
    expect(find('heo')).toContain('Mỡ lợn');
  });

  it('corn is two-way: bắp <-> ngô', () => {
    expect(find('bap ngot')).toContain('Bắp ngọt, luộc');
    expect(find('ngo ngot')).toContain('Bắp ngọt, luộc');
    expect(find('ngô rang')).toContain('Bắp rang caramel');
    expect(find('bắp rang')).toContain('Bắp rang caramel');
  });

  it('corn synonyms do not turn cabbage into corn or pumpkin into corn', () => {
    expect(find('ngo cai')).not.toContain('Bắp cải, luộc');
    expect(find('ngo')).not.toContain('Bắp cải, luộc');
    expect(synonymPhrases('Bắp cải, luộc', 'vi')).toEqual([]);
    expect(synonymPhrases('Bí ngô, sống', 'vi')).toEqual(['bi do song']);
    expect(synonymPhrases('Bắp ngọt, luộc', 'vi')).toEqual(['ngo ngot luoc']);
    expect(find('bí ngô')).toContain('Bí ngô, sống');
  });

  it('other glossary groups work: green beans, passion fruit, parsley, cilantro, cauliflower, shallot, cassava', () => {
    expect(find('dau que')).toContain('Đậu cô ve, sống');
    expect(find('chanh leo')).toContain('Chanh dây, tươi');
    expect(find('mui tay')).toContain('Ngò tây (mùi tây), tươi');
    expect(find('rau mui')).toContain('Ngò rí (rau mùi), tươi');
    expect(find('bong cai trang')).toContain('Súp lơ (bông cải trắng), sống');
    expect(find('hanh kho')).toContain('Hành tím nhỏ (shallot), sống');
    expect(find('san')).toContain('Khoai mì (sắn), sống');
  });

  it('ambiguous words are searched but not used to add alternatives', () => {
    expect(NOT_A_SOURCE.has('thơm')).toBe(true);
    expect(synonymPhrases('Gạo thơm, nấu chín', 'vi')).toEqual([]);
    expect(Object.keys(BLOCKED_COMPOUNDS)).toContain('bắp');
  });

  it('synonyms only apply in Vietnamese', () => {
    expect(names('thom', 'fi')).toEqual([]);
    expect(names('thom', 'en')).toEqual([]);
    expect(synonymPhrases('Dứa, tươi', 'fi')).toEqual([]);
  });

  it('every glossary group has at least two words and no duplicates', () => {
    for (const group of SYNONYM_GROUPS.vi ?? []) {
      expect(group.length).toBeGreaterThanOrEqual(2);
      expect(new Set(group.map((word) => foldText(word))).size).toBe(group.length);
    }
  });
});

describe('performance', () => {
  it('precomputes keys: 1,555 foods x 3 languages, then 300 searches in well under a second', () => {
    for (const locale of ['en', 'vi', 'fi'] as const) warmSearchIndex(foods, locale);
    const queries = ['banh mi', 'chicken', 'sữa', 'kaali', 'rice', 'dưa leo', 'x', 'thom'];
    const started = Date.now();
    for (let i = 0; i < 300; i += 1) searchFoods(foods, queries[i % queries.length], 25, (['vi', 'fi', 'en'] as const)[i % 3]);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('Log builds the index once per language and searches with the app language', () => {
    const log = readFileSync(join(__dirname, '../../../app/(tabs)/log.tsx'), 'utf8');
    expect(log).toMatch(/warmSearchIndex\(foods, locale\)/);
    expect(log).toMatch(/searchFoods\(foods, debounced, foods\.length, locale\)/);
  });
});

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

  it("accent-insensitive 'pho' finds Phở", () => {
    for (const query of ['pho', 'phở', 'PHO', 'Pho']) {
      const found = names(query, 'vi', 25);
      expect(found.some((name) => name.includes('Phở')), query).toBe(true);
    }
    const ids = searchFoods(foods, 'pho', 25, 'vi').map((food) => food.id);
    expect(ids).toContain('1335');
    expect(ids).toContain('1336');
  });

  it('searches "pho", "phở" and "banh mi" return Vietnamese dishes, including the Open Food Facts rows', () => {
    const phoIds = new Set(['1335', '1336', '1801', '1802', '1803', '1804', '1806']);
    for (const query of ['pho', 'phở']) {
      for (const locale of ['en', 'vi'] as const) {
        const hits = searchFoods(foods, query, 50, locale);
        const ids = hits.map((food) => food.id);
        const namesFound = hits.map((food) => foodName(food, locale));
        expect(namesFound.some((name) => /phở|pho/i.test(name)), `${query} ${locale}`).toBe(true);
        expect(ids.some((id) => phoIds.has(id)), `${query} ${locale} ids=${ids.slice(0, 10)}`).toBe(true);
        // New OFF dishes must show up for at least one of these queries in Vietnamese.
        if (locale === 'vi') expect(ids.some((id) => ['1801', '1802', '1803', '1804', '1806'].includes(id)), `${query} ${locale} off`).toBe(true);
      }
    }
    const banhMiIds = new Set(['1809', '1810', '1811', '1812', '1813']);
    for (const query of ['banh mi', 'bánh mì']) {
      for (const locale of ['en', 'vi'] as const) {
        const hits = searchFoods(foods, query, 50, locale);
        const ids = hits.map((food) => food.id);
        const namesFound = hits.map((food) => foodName(food, locale));
        expect(namesFound.some((name) => /bánh mì|banh mi/i.test(name)), `${query} ${locale}`).toBe(true);
        expect(ids.some((id) => banhMiIds.has(id)), `${query} ${locale} ids=${ids.slice(0, 10)}`).toBe(true);
      }
    }
    // 'bun' / 'bún' should find the new bún dishes (cha, bò Huế), not only bao buns.
    for (const query of ['bun', 'bún']) {
      const hits = searchFoods(foods, query, 50, 'vi');
      const ids = hits.map((food) => food.id);
      expect(ids.some((id) => ['1815', '1816', '1817'].includes(id)), query).toBe(true);
    }
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

  it('finds Fineli foods by their Finnish names, with or without accents', () => {
    const reindeer = names('poronliha', 'fi', 25);
    expect(reindeer.some((name) => name.toLowerCase().includes('poronliha'))).toBe(true);
    expect(names('silakka', 'fi', 25).some((name) => name.toLowerCase().includes('silakka'))).toBe(true);
    expect(names('PORONLIHA', 'fi', 25)).toEqual(names('poronliha', 'fi', 25));
    // English query still works in Finnish mode.
    expect(searchFoods(foods, 'reindeer', 25, 'fi').some((food) => food.name.toLowerCase().includes('reindeer'))).toBe(true);
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

  it('does not match the other language: a Vietnamese-only spelling finds nothing in English mode', () => {
    // 'thit xong khoi' is only in the Vietnamese name. 'banh mi' is no longer a valid example:
    // the Open Food Facts rows use "banh mi" in the English name.
    expect(names('thit xong khoi', 'en')).toEqual([]);
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
  // Synthetic rows, so these tests do not depend on how the translation file words a name today.
  const VI = [
    'Dứa, tươi', 'Dưa hấu, tươi', 'Dưa leo, có vỏ, sống', 'Dưa chuột muối chua (dill pickles)', 'Thịt heo xay, sống', 'Mỡ lợn',
    'Bắp ngọt, luộc', 'Bắp cải, luộc', 'Bắp rang caramel', 'Bột ngô', 'Bí ngô, sống', 'Đậu cô ve, sống', 'Chanh dây, tươi',
    'Ngò tây, tươi', 'Ngò rí, tươi', 'Súp lơ, sống', 'Hành tím nhỏ, sống', 'Khoai mì, sống', 'Gạo thơm, nấu chín', 'Cải bruxen, luộc',
  ];
  const rows = parseFoods(VI.map((name, index) => ({ id: String(index + 1), name: `Food ${index + 1}`, name_vi: name, kcal: 1, protein: 1, carbs: 1, fat: 1 })));
  const find = (query: string) => searchFoods(rows, query, 100, 'vi').map((food) => food.names.vi);

  it('indexes the glossary groups, including groups of three: dứa / thơm / khóm', () => {
    for (const query of ['dứa', 'thơm', 'thom', 'khóm', 'khom']) expect(find(query), query).toContain('Dứa, tươi');
    expect(find('khom tuoi')).toEqual(['Dứa, tươi']);
  });

  it('supports groups of any size, not just pairs', () => {
    expect((SYNONYM_GROUPS.vi ?? []).some((group) => group.length >= 3)).toBe(true);
    const three = synonymPhrases('Dứa, tươi', 'vi');
    expect(three).toEqual(['thom tuoi', 'khom tuoi']);
  });

  it('does not mix up dứa (pineapple) and dưa (melon) when adding synonyms', () => {
    expect(find('thom')).not.toContain('Dưa hấu, tươi');
    expect(find('khom')).toEqual(['Dứa, tươi']);
  });

  it('cucumber is two-way: dưa leo <-> dưa chuột', () => {
    for (const query of ['dua leo', 'dưa chuột', 'dua chuot']) {
      expect(find(query), query).toEqual(expect.arrayContaining(['Dưa leo, có vỏ, sống', 'Dưa chuột muối chua (dill pickles)']));
    }
    expect(synonymPhrases('Dưa leo, có vỏ, sống', 'vi')).toEqual(['dua chuot co vo song']);
    expect(synonymPhrases('Dưa chuột muối chua', 'vi')).toEqual(['dua leo muoi chua']);
  });

  it('pork is two-way: heo <-> lợn', () => {
    expect(find('thit lon xay')).toContain('Thịt heo xay, sống');
    expect(find('mỡ heo')).toContain('Mỡ lợn');
    expect(find('mo heo')).toContain('Mỡ lợn');
    expect(find('lợn')).toEqual(expect.arrayContaining(['Thịt heo xay, sống', 'Mỡ lợn']));
    expect(find('heo')).toEqual(expect.arrayContaining(['Thịt heo xay, sống', 'Mỡ lợn']));
  });

  it('corn is two-way: bắp <-> ngô', () => {
    expect(find('ngo ngot')).toContain('Bắp ngọt, luộc');
    expect(find('bap ngot')).toContain('Bắp ngọt, luộc');
    expect(find('ngô rang')).toContain('Bắp rang caramel');
    expect(find('bắp rang')).toContain('Bắp rang caramel');
    expect(find('bap bot')).toContain('Bột ngô');
    expect(find('bột bắp')).toContain('Bột ngô');
  });

  it('corn synonyms do not turn cabbage into corn or pumpkin into corn', () => {
    expect(find('ngo cai')).toEqual([]);
    expect(find('ngo')).not.toContain('Bắp cải, luộc');
    expect(synonymPhrases('Bắp cải, luộc', 'vi')).toEqual([]);
    expect(synonymPhrases('Bí ngô, sống', 'vi')).toEqual(['bi do song']);
    expect(synonymPhrases('Bắp ngọt, luộc', 'vi')).toEqual(['ngo ngot luoc']);
    expect(find('bí ngô')).toContain('Bí ngô, sống');
  });

  it('other glossary groups work: green beans, passion fruit, parsley, cilantro, cauliflower, shallot, cassava, Brussels sprouts', () => {
    expect(find('dau que')).toContain('Đậu cô ve, sống');
    expect(find('chanh leo')).toContain('Chanh dây, tươi');
    expect(find('mui tay')).toContain('Ngò tây, tươi');
    expect(find('rau mui')).toContain('Ngò rí, tươi');
    expect(find('bong cai trang')).toContain('Súp lơ, sống');
    expect(find('hanh kho')).toContain('Hành tím nhỏ, sống');
    expect(find('san')).toContain('Khoai mì, sống');
    expect(find('bap cai mini')).toContain('Cải bruxen, luộc');
  });

  it('ambiguous words are searched but not used to add alternatives', () => {
    expect(NOT_A_SOURCE.has('thơm')).toBe(true);
    expect(synonymPhrases('Gạo thơm, nấu chín', 'vi')).toEqual([]);
    expect(find('dứa')).not.toContain('Gạo thơm, nấu chín');
    expect(find('thơm')).toContain('Gạo thơm, nấu chín');
    expect(Object.keys(BLOCKED_COMPOUNDS)).toContain('bắp');
  });

  it('works on the real catalog too: dứa/thơm/khóm find the pineapple', () => {
    for (const query of ['dứa', 'thơm', 'khóm']) {
      expect(searchFoods(foods, query, 50, 'vi').some((food) => food.name === 'Pineapple, raw'), query).toBe(true);
    }
  });

  it('synonyms only apply in Vietnamese', () => {
    expect(names('thom', 'fi')).toEqual([]);
    expect(names('thom', 'en')).toEqual([]);
    expect(synonymPhrases('Dứa, tươi', 'fi')).toEqual([]);
  });

  it('every group has at least two words and no duplicates', () => {
    for (const group of SYNONYM_GROUPS.vi ?? []) {
      expect(group.length).toBeGreaterThanOrEqual(2);
      expect(new Set(group.map((word) => foldText(word))).size).toBe(group.length);
    }
  });
});

describe('performance', () => {
  it('precomputes keys: the full catalog x 3 languages, then 300 searches in well under a second', () => {
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

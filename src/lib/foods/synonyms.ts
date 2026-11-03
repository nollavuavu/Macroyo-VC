/**
 * Regional and alternative words that search also understands.
 * A group lists words for the same thing. If a food's translated name contains one word of a group, the food is
 * also found by the others: "Dứa, tươi" is found by "thơm" and "khóm". The words are matched folded (no accents).
 *
 * Source: Heisenberg's i18n_glossary.md ("Ambiguous or regional Vietnamese terms"). Groups marked EXTRA are not in
 * the glossary; they are well-known north/south pairs added for search only (display names are never changed).
 */

import type { Locale } from '../../i18n/types';

export const SYNONYM_GROUPS: Partial<Record<Locale, readonly (readonly string[])[]>> = {
  vi: [
    ['dứa', 'thơm', 'khóm'], // pineapple: north / south / Mekong
    ['ngò rí', 'rau mùi'], // cilantro: south / north
    ['súp lơ', 'bông cải trắng'], // cauliflower: north / south
    ['đậu cô ve', 'đậu que'], // green beans
    ['dưa leo', 'dưa chuột'], // cucumber: south / north
    ['chanh dây', 'chanh leo'], // passion fruit: north / south
    ['khoai mì', 'sắn'], // cassava: south / north
    ['ngò tây', 'mùi tây'], // parsley
    ['cải bruxen', 'bắp cải mini'], // Brussels sprouts
    ['hành tím nhỏ', 'hành khô'], // shallot
    ['bông cải xanh', 'súp lơ xanh'], // broccoli: EXTRA (south / north)
    ['ngô', 'bắp'], // corn: EXTRA (north / south)
    ['heo', 'lợn'], // pork: EXTRA (south / north)
    ['đậu phộng', 'lạc'], // peanut: EXTRA (south / north)
    ['đậu nành', 'đậu tương'], // soybean: EXTRA (south / north)
    ['bí ngô', 'bí đỏ'], // pumpkin: EXTRA
    ['rau bina', 'rau chân vịt'], // spinach: EXTRA (south / north)
  ],
};

/**
 * Words that are looked up (typing "thơm" finds pineapple) but never used to add alternatives to a food,
 * because they also mean something else: "thơm" is also fragrant (jasmine rice), "sắn" is also in "củ sắn dây"
 * (jicama), "hành khô" can be dried onion.
 */
export const NOT_A_SOURCE: ReadonlySet<string> = new Set(['thơm', 'sắn', 'hành khô']);

/**
 * Compounds in which a synonym word means something else, so it is not swapped there:
 * "bắp" is corn, but "bắp cải" is cabbage and "bắp bò" is beef shank (typing "ngô" must not find cabbage); "bí ngô" is pumpkin.
 */
export const BLOCKED_COMPOUNDS: Readonly<Record<string, readonly string[]>> = {
  'bắp': ['bắp cải', 'bắp bò'],
  'ngô': ['bí ngô'], // pumpkin
};

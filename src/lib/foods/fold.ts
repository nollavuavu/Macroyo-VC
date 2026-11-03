/**
 * Search folding: lower case, no diacritics, and đ/Đ as d.
 * "Bánh mì" -> "banh mi", "Đậu" -> "dau", "Kääpiö" -> "kaapio", "Jalapeño" -> "jalapeno".
 * Pure and dependency-free.
 */

const COMBINING_MARKS = /[\u0300-\u036f]/g;

export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}

/** Folded words: runs of a-z and 0-9. */
export function tokenize(value: string): string[] {
  return foldText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

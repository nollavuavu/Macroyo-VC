import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Lint-style scan: user-facing text in .tsx must come from the catalogs.
 * It flags (1) literal text between JSX tags and (2) string literals in props that are shown or read out.
 * Allowed: units (kcal g kg lb cm in %), symbols and digits, the app name.
 */
const ROOT = join(__dirname, '../..');
const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === 'node_modules') continue;
    if (statSync(path).isDirectory()) walk(path);
    else if (name.endsWith('.tsx')) files.push(path);
  }
};
walk(join(ROOT, 'app'));
walk(join(ROOT, 'src'));

const ALLOWED_WORDS = new Set(['kcal', 'g', 'kg', 'lb', 'cm', 'in', 'ft', 'Macroyo', 'P', 'C', 'F', 'DM', 'Mono', 'Inter', 'px', 'dp']);
const TEXT_PROPS = ['label', 'placeholder', 'accessibilityLabel', 'accessibilityHint', 'title', 'subtitle', 'suffix', 'unit', 'description', 'detail', 'hint', 'error', 'message', 'heading', 'caption', 'alt', 'tabBarLabel', 'headerTitle'];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function hasEnglishWords(text: string): boolean {
  const words = text.match(/[A-Za-z]{2,}/g) ?? [];
  return words.some((word) => !ALLOWED_WORDS.has(word));
}

export function findHardcoded(source: string): string[] {
  const code = stripComments(source);
  const found: string[] = [];
  // (1) text directly inside JSX: >Some text<  (no braces, no angle brackets). Skip TS generics and arrows.
  for (const match of code.matchAll(/(?<![=\-])>([^<>{}=;()]*[A-Za-z]{2,}[^<>{}=;()]*)</g)) {
    const text = match[1].trim();
    if (text && hasEnglishWords(text)) found.push(text);
  }
  // (2) prop="literal" and prop={'literal'}
  const props = TEXT_PROPS.join('|');
  for (const match of code.matchAll(new RegExp(`\\b(?:${props})=(?:"([^"]*)"|\\{\\s*['"\`]([^'"\`$]*)['"\`]\\s*\\})`, 'g'))) {
    const text = (match[1] ?? match[2] ?? '').trim();
    if (text && hasEnglishWords(text)) found.push(`${match[0]}`);
  }
  // (3) options objects: title: 'Literal'
  for (const match of code.matchAll(new RegExp(`\\b(?:${props}):\\s*['"]([^'"]*[A-Za-z]{2,}[^'"]*)['"]`, 'g'))) {
    if (hasEnglishWords(match[1])) found.push(match[0]);
  }
  return found;
}

describe('no hardcoded user-facing English in .tsx', () => {
  it('scans the real screens and components', () => {
    expect(files.length).toBeGreaterThan(8);
  });

  for (const file of files) {
    it(relative(ROOT, file), () => {
      expect(findHardcoded(readFileSync(file, 'utf8'))).toEqual([]);
    });
  }

  it('the scanner itself catches the patterns it is meant to', () => {
    expect(findHardcoded('<Text>Hello there</Text>')).toEqual(['Hello there']);
    expect(findHardcoded('<Field label="Weight" />').length).toBe(1);
    expect(findHardcoded("<Field placeholder={'Weight'} />").length).toBe(1);
    expect(findHardcoded("screenOptions({ title: 'Today' })").length).toBe(1);
    expect(findHardcoded('<Text>{t("x.y")}</Text>')).toEqual([]);
    expect(findHardcoded('<Text>kcal</Text> <Text>g</Text> <Text>%</Text>')).toEqual([]);
    expect(findHardcoded('// <Text>Hello there</Text>')).toEqual([]);
  });
});

/**
 * Serving labels ("1 cup, chopped", "1 can (12 fl oz)") in Vietnamese and Finnish.
 *
 * Not free-text translation: a label is parsed into numbers, units, size words, preparation words, punctuation and
 * parentheses, and each part is rendered from the word tables in servingWords.ts. If any word is unknown, or the
 * shape is not one the parser understands, the whole label stays English. Nothing is ever half translated.
 *
 * Grammar handled: `<number> <noun phrase> [, <words>] [(<measure>)]...`
 *   - numbers: 1, 0.25, 1/2, 2-1/2 (decimals use the locale mark; fractions are kept)
 *   - inch marks: 1" 4-1/2" dia
 *   - noun phrases: size and shape words plus a unit or thing ("1 small fillet", "1 large or thick slice", "1 can/bottle")
 *   - a measure followed by what is measured ("1 cup spaghetti", "3 pieces shrimp")
 *   - fixed words and phrases ("chopped", "with skin", "not packed")
 * Vietnamese puts adjectives after the noun ("1 miếng phi lê nhỏ"). Finnish puts them before and inflects them with the
 * number ("1 pieni filee", "2 pientä fileetä").
 */

import type { Locale } from '../../i18n/types';
import { numberSymbols } from '../../i18n/numbers';
import { ENTRIES, MAX_PHRASE_WORDS, type Adj, type Entry, type Lang, type Noun } from './servingWords';

type Token =
  | { t: 'num'; text: string; value: number }
  | { t: 'inch' }
  | { t: 'p'; ch: '(' | ')' | ',' | '/' | '~' }
  | { t: 'e'; key: string; entry: Entry }
  | { t: 'lit'; text: string };

class Unparsed extends Error {}

function numberValue(text: string): number {
  const mixed = /^(\d+)-(\d+)\/(\d+)$/.exec(text);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = /^(\d+)\/(\d+)$/.exec(text);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  return Number(text);
}

const TOKEN = /\s+|(\d+-\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)|([A-Za-z][A-Za-z'’-]*)\.?|(")|([(),/~])/gy;

function tokenize(label: string): Token[] {
  const raw: ({ t: 'word'; text: string } | Token)[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < label.length) {
    const at = TOKEN.lastIndex;
    const match = TOKEN.exec(label);
    if (!match || TOKEN.lastIndex === at) throw new Unparsed(`unexpected character at ${at}`);
    if (match[1] != null) raw.push({ t: 'num', text: match[1], value: numberValue(match[1]) });
    else if (match[2] != null) raw.push({ t: 'word', text: match[2] });
    else if (match[3] != null) raw.push({ t: 'inch' });
    else if (match[4] != null) raw.push({ t: 'p', ch: match[4] as '(' });
  }
  // Merge word runs into the longest known phrase ("fl oz", "with skin"), then single words.
  const tokens: Token[] = [];
  for (let i = 0; i < raw.length; ) {
    const first = raw[i];
    if (first.t !== 'word') {
      tokens.push(first);
      i += 1;
      continue;
    }
    let merged = false;
    for (let n = MAX_PHRASE_WORDS; n >= 1 && !merged; n -= 1) {
      const parts = raw.slice(i, i + n);
      if (parts.length < n || !parts.every((part) => part.t === 'word')) continue;
      const key = parts.map((part) => (part as { text: string }).text.toLowerCase()).join(' ');
      const entry = ENTRIES.get(key);
      if (!entry) continue;
      tokens.push({ t: 'e', key, entry });
      i += n;
      merged = true;
    }
    if (merged) continue;
    // Unknown lower-case words fail the label; a capitalised unknown word is a name ("Newton", "Capri Sun").
    if (!/^[A-Z]/.test(first.text)) throw new Unparsed(`unknown word "${first.text}"`);
    tokens.push({ t: 'lit', text: first.text });
    i += 1;
  }
  return tokens;
}

const isPhraseToken = (token: Token | undefined): boolean =>
  token != null && (token.t === 'lit' || (token.t === 'e' && (token.entry.kind === 'noun' || token.entry.kind === 'adj' || token.entry.kind === 'adv')));

const isConnector = (token: Token | undefined): boolean =>
  token != null && ((token.t === 'p' && token.ch === '/') || (token.t === 'e' && (token.key === 'or' || token.key === 'and')));

interface Context {
  lang: Lang;
  /** The number just before this phrase, or null when none ("1 cup, chopped" -> null for what follows the comma). */
  count: number | null;
  afterMeasure: boolean;
}

function pick(context: Context, plural: boolean): 'nom' | 'part' | 'pl' | 'partPl' {
  if (context.afterMeasure) return plural ? 'partPl' : 'part';
  if (context.count == null) return plural ? 'pl' : 'nom';
  return context.count === 1 ? 'nom' : 'part';
}

function nounText(noun: Noun, context: Context): string {
  if (context.lang === 'vi') return noun.vi;
  const form = pick(context, noun.plural === true);
  if (form === 'nom') return noun.fi;
  if (form === 'part') return noun.fiPart;
  if (form === 'pl') return noun.fiPl ?? noun.fi;
  return noun.fiPartPl ?? noun.fiPart;
}

function adjText(adj: Adj, context: Context): string {
  if (context.lang === 'vi') return adj.vi;
  return pick(context, false) === 'nom' ? adj.fi : adj.fiPart;
}

interface Segment {
  tokens: Token[];
}

/** Adjective groups of a segment ("very thin" is one group), nouns and names. */
function parts(segment: Segment, context: Context) {
  const adjs: string[] = [];
  const nouns: Noun[] = [];
  const lits: string[] = [];
  const { tokens } = segment;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.t === 'lit') lits.push(token.text);
    else if (token.t === 'e') {
      const entry = token.entry;
      if (entry.kind === 'noun') nouns.push(entry);
      else if (entry.kind === 'adj') adjs.push(adjText(entry, context));
      else if (entry.kind === 'adv') {
        const next = tokens[i + 1];
        if (next?.t !== 'e' || next.entry.kind !== 'adj') throw new Unparsed('adverb without adjective');
        adjs.push(`${entry[context.lang]} ${adjText(next.entry, context)}`);
        i += 1;
      }
    }
  }
  return { adjs, nouns, lits };
}

/** The noun (or name) part of a phrase in the target language. */
function head(nouns: Noun[], lits: string[], context: Context): string {
  if (context.lang === 'vi') {
    // Vietnamese puts the head first: "egg roll" -> "chả giò", "Newton bar" -> "thanh Newton".
    return [...[...nouns].reverse().map((noun) => nounText(noun, context)), ...lits].join(' ');
  }
  if (nouns.length > 1) throw new Unparsed('compound noun');
  if (nouns.length === 0) {
    if (lits.length > 0) throw new Unparsed('name without a noun');
    return '';
  }
  const word = nounText(nouns[0], context);
  return lits.length > 0 ? `${lits.join(' ')}-${word}` : word;
}

function renderChain(segments: Segment[], connectors: string[], context: Context): string {
  const lang = context.lang;
  const joiner = (index: number) => (connectors[index] === '/' ? '/' : ` ${connectors[index]} `);
  const info = segments.map((segment) => ({ segment, ...parts(segment, context) }));
  const withNoun = info.filter((item) => item.nouns.length > 0 || item.lits.length > 0);
  if (info.length === 1 || withNoun.length === info.length) {
    return info
      .map((item, index) => {
        const { adjs, nouns, lits } = item;
        const noun = head(nouns, lits, context);
        let text: string;
        if (lang === 'vi') text = [noun, ...adjs].filter(Boolean).join(' ');
        else text = [...adjs, noun].filter(Boolean).join(' ');
        if (noun === '' && lang === 'vi' && context.count != null && !context.afterMeasure && adjs.length > 0) text = `cái ${text}`;
        return text + (index < info.length - 1 ? joiner(index) : '');
      })
      .join('');
  }
  // Shared noun: "small or thin slice", "regular/thin slice", "small/regular fillet".
  if (withNoun.length === 1 && info[info.length - 1] === withNoun[0]) {
    const last = info[info.length - 1];
    const noun = head(last.nouns, last.lits, context);
    const adjText = info.map((item, index) => item.adjs.join(' ') + (index < info.length - 1 ? joiner(index) : '')).join('');
    return lang === 'vi' ? `${noun} ${adjText}` : `${adjText} ${noun}`;
  }
  // Only adjectives: "small/individual".
  if (withNoun.length === 0) {
    const text = info.map((item, index) => item.adjs.join(' ') + (index < info.length - 1 ? joiner(index) : '')).join('');
    return lang === 'vi' && context.count != null && !context.afterMeasure ? `cái ${text}` : text;
  }
  throw new Unparsed('mixed coordination');
}

function formatNumber(text: string, locale: Lang): string {
  return /^\d+\.\d+$/.test(text) ? text.replace('.', numberSymbols(locale).decimal) : text;
}

export function translateServingLabel(label: string, lang: Lang): string | null {
  try {
    const tokens = tokenize(label.trim());
    if (tokens.length === 0 || tokens[0].t !== 'num') throw new Unparsed('does not start with a number');
    const depth = tokens.reduce((sum, token) => sum + (token.t === 'p' && token.ch === '(' ? 1 : token.t === 'p' && token.ch === ')' ? -1 : 0), 0);
    if (depth !== 0) throw new Unparsed('unbalanced parentheses');
    const pieces: string[] = [];
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      const previous = tokens[i - 1];
      if (token.t === 'num') pieces.push(formatNumber(token.text, lang));
      else if (token.t === 'inch') pieces.push('"');
      else if (token.t === 'p') pieces.push(token.ch);
      else if (isPhraseToken(token)) {
        // Gather a chain: phrase words with connectors between them.
        const segments: Segment[] = [{ tokens: [] }];
        const connectors: string[] = [];
        let j = i;
        while (j < tokens.length) {
          const current = tokens[j];
          if (isPhraseToken(current)) {
            segments[segments.length - 1].tokens.push(current);
            j += 1;
          } else if (isConnector(current) && isPhraseToken(tokens[j + 1]) && segments[segments.length - 1].tokens.length > 0) {
            connectors.push(current.t === 'p' ? '/' : ((ENTRIES.get((current as Extract<Token, { t: 'e' }>).key) as { vi?: string; fi?: string })[lang] ?? ''));
            segments.push({ tokens: [] });
            j += 1;
          } else break;
        }
        if (connectors.some((connector) => connector === '')) throw new Unparsed('connector');
        let count: number | null = previous?.t === 'num' ? previous.value : null;
        // A measure followed by what is measured: "1 cup spaghetti" is "cup" + "spaghetti".
        const rendered: string[] = [];
        let tail: Segment | null = null;
        const first = segments[0];
        const measureAt = connectors.length === 0 ? first.tokens.findIndex((tk) => tk.t === 'e' && tk.entry.kind === 'noun' && tk.entry.measure === true) : -1;
        if (measureAt >= 0 && measureAt < first.tokens.length - 1) {
          tail = { tokens: first.tokens.slice(measureAt + 1) };
          first.tokens = first.tokens.slice(0, measureAt + 1);
        }
        rendered.push(renderChain(segments, connectors, { lang, count, afterMeasure: false }));
        if (tail) {
          count = null;
          rendered.push(renderChain([tail], [], { lang, count, afterMeasure: true }));
        }
        if (previous?.t !== 'num' && segments.length > 0 && tokens[j]?.t === 'num' && !segments.some((s) => s.tokens.some((tk) => tk.t === 'e' && tk.entry.kind === 'noun'))) {
          throw new Unparsed('size word before a number');
        }
        pieces.push(...rendered);
        i = j - 1;
      } else if (token.t === 'e') {
        const entry = token.entry as Entry;
        if (entry.kind !== 'fixed') throw new Unparsed('stray word');
        if (token.key === 'of') {
          if (lang !== 'vi' || previous?.t !== 'num' || !previous.text.includes('/')) throw new Unparsed('"of"');
        }
        const text = entry[lang];
        if (!text) throw new Unparsed(`no ${lang} for "${token.key}"`);
        pieces.push(text);
      }
    }
    return joinPieces(pieces);
  } catch (error) {
    if (error instanceof Unparsed) return null;
    throw error;
  }
}

function joinPieces(pieces: string[]): string {
  let out = '';
  for (let i = 0; i < pieces.length; i += 1) {
    const piece = pieces[i];
    const previous = pieces[i - 1];
    const glued = i === 0 || previous === '(' || previous === '/' || previous === '~' || piece === ')' || piece === ',' || piece === '/' || piece === '"';
    out += glued ? piece : ` ${piece}`;
  }
  return out;
}

const cache = new Map<string, string | null>();

/** The label in the app language; English when the locale is English, the label is empty, or it cannot be parsed. */
export function servingLabelFor(label: string | undefined, locale: Locale): string | undefined {
  if (label == null || locale === 'en') return label;
  const key = `${locale}|${label}`;
  let translated = cache.get(key);
  if (translated === undefined) {
    translated = translateServingLabel(label, locale);
    cache.set(key, translated);
  }
  return translated ?? label;
}

/** Labels (unique, non-empty) that stay English in a language. For the data report and the coverage test. */
export function unparsedServingLabels(labels: readonly (string | undefined)[], lang: Lang): string[] {
  const unique = [...new Set(labels.filter((label): label is string => !!label && label.trim() !== ''))];
  return unique.filter((label) => translateServingLabel(label, lang) === null).sort();
}

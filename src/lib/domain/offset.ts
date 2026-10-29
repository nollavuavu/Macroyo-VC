/**
 * Parsing of the Calc "custom kcal per day" field.
 * A leading minus (ASCII or typographic) means a deficit, a leading plus means a surplus.
 * With no sign the caller's deficit/surplus toggle decides. Anything malformed is invalid and
 * never becomes a surplus: the offset is 0.
 */
import { msg } from '../../i18n/msg';
import type { Msg } from '../../i18n/types';
import { isAmbiguousThousands } from './nutrition';

export type OffsetDirection = 'deficit' | 'surplus';

export interface ParsedOffset {
  /** Signed kcal/day: negative is a deficit. 0 when empty or invalid. */
  offset: number;
  /** Absolute kcal/day. */
  magnitude: number;
  /** The direction implied by an explicit sign, else null. */
  signedDirection: OffsetDirection | null;
  /** The direction in effect: explicit sign, else the fallback. */
  direction: OffsetDirection;
  empty: boolean;
  valid: boolean;
  message: Msg | null;
}

const MINUS_SIGNS = /^[-\u2212\u2012\u2013\u2014]/;
const PLAIN_NUMBER = /^(\d+([.,]\d+)?|[.,]\d+)$/;

export function parseCustomOffset(raw: string, fallback: OffsetDirection = 'surplus'): ParsedOffset {
  const text = raw.replace(/\s/g, '');
  if (text === '') {
    return { offset: 0, magnitude: 0, signedDirection: null, direction: fallback, empty: true, valid: true, message: null };
  }
  let signedDirection: OffsetDirection | null = null;
  let body = text;
  if (MINUS_SIGNS.test(body)) {
    signedDirection = 'deficit';
    body = body.slice(1);
  } else if (body.startsWith('+')) {
    signedDirection = 'surplus';
    body = body.slice(1);
  }
  const direction = signedDirection ?? fallback;
  if (!PLAIN_NUMBER.test(body)) {
    return {
      offset: 0,
      magnitude: 0,
      signedDirection,
      direction,
      empty: false,
      valid: false,
      message: msg('offset.invalid'),
    };
  }
  // Same safety rule as parseDecimal: "1,234" (and "1.234" in Vietnamese) is never guessed.
  if (isAmbiguousThousands(body)) {
    return { offset: 0, magnitude: 0, signedDirection, direction, empty: false, valid: false, message: msg('validate.noThousands') };
  }
  const magnitude = Number(body.replace(',', '.'));
  if (!Number.isFinite(magnitude)) {
    return { offset: 0, magnitude: 0, signedDirection, direction, empty: false, valid: false, message: msg('offset.invalid') };
  }
  return {
    offset: direction === 'deficit' ? -magnitude : magnitude,
    magnitude,
    signedDirection,
    direction,
    empty: false,
    valid: true,
    message: null,
  };
}

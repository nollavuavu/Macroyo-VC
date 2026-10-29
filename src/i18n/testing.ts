import { translateMsg } from './translate';
import type { Msg } from './types';

/** English rendering of a domain message, for tests that check wording. Returns '' for null/undefined/false. */
export function en(message: Msg | null | undefined | false): string {
  return message ? translateMsg('en', message) : '';
}

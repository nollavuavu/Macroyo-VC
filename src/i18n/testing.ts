import { translateMsg } from './translate';
import type { Msg } from './types';

/** English rendering of a domain message (no-break spaces shown as plain spaces), for tests that check wording. Returns '' for null/undefined/false. */
export function en(message: Msg | null | undefined | false): string {
  return message ? translateMsg('en', message).replace(/\u00a0/g, ' ') : '';
}

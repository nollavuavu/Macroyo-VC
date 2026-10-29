import type { Msg } from '../i18n/types';

/** Status banner ("Targets saved.") lifecycle: it only describes the most recent save. */
export type BannerEvent =
  | { type: 'save-attempt' }
  | { type: 'edit' }
  | { type: 'saved'; message: Msg };

export function nextBanner(current: Msg | null, event: BannerEvent): Msg | null {
  if (event.type === 'saved') return event.message;
  // A new save attempt or any edit makes the old confirmation stale.
  return null;
}

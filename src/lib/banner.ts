/** Status banner ("Targets saved.") lifecycle: it only describes the most recent save. */
export type BannerEvent =
  | { type: 'save-attempt' }
  | { type: 'edit' }
  | { type: 'saved'; message: string };

export function nextBanner(current: string | null, event: BannerEvent): string | null {
  if (event.type === 'saved') return event.message;
  // A new save attempt or any edit makes the old confirmation stale.
  return null;
}

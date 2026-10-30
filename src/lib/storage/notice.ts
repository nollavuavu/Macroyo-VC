/**
 * The storage notice (save/read failure card). It has two parts that must not be confused:
 * the problem itself (`error`, and in the store the write block) and whether the card is showing.
 * Dismissing only hides the card. A new failure always shows it again, and the store keeps refusing writes.
 */
import type { Msg } from '../../i18n/types';

export interface NoticeState {
  error: Msg | null;
  dismissed: boolean;
}

export const NO_NOTICE: NoticeState = { error: null, dismissed: false };

/** A failure happened (again): show the card. */
export const raiseNotice = (error: Msg): NoticeState => ({ error, dismissed: false });

/** The user closed the card. The problem is untouched. */
export const dismissNotice = (state: NoticeState): NoticeState => ({ ...state, dismissed: state.error != null });

export const noticeVisible = (state: NoticeState): boolean => state.error != null && !state.dismissed;

import { useSyncExternalStore } from 'react';
import type { MessageKey } from './msg';
import { getLocale, subscribeLocale } from './state';
import { translate, translateMsg } from './translate';
import type { Locale, MessageParams, Msg } from './types';

export interface I18n {
  locale: Locale;
  t: (key: MessageKey, params?: MessageParams) => string;
  tm: (message: Msg) => string;
}

/** Re-renders when the language changes. Every screen calls this so text and formats update together. */
export function useI18n(): I18n {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  return {
    locale,
    t: (key, params) => translate(locale, key, params),
    tm: (message) => translateMsg(locale, message),
  };
}

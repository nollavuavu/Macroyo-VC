import { translate, translateMsg } from './translate';
import { DEFAULT_LOCALE, type Locale, type MessageParams, type Msg } from './types';
import type { MessageKey } from './msg';

let current: Locale = DEFAULT_LOCALE;
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  listeners.forEach((listener) => listener());
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Translate with the active locale. */
export function t(key: MessageKey, params?: MessageParams): string {
  return translate(current, key, params);
}

/** Translate a message object from the domain layer with the active locale. */
export function tm(message: Msg): string {
  return translateMsg(current, message);
}

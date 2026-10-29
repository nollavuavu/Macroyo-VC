import type en from './locales/en.json';
import type { MessageParams, Msg } from './types';

type Catalog = typeof en;
type PluralSuffix = '_one' | '_other';

/** Every catalog key, with plural variants (`x_one`, `x_other`) collapsed to the base key `x`. */
export type MessageKey = {
  [K in keyof Catalog]: K extends `${infer Base}${PluralSuffix}` ? Base : K;
}[keyof Catalog];

/** Build a message. The key is checked against the English catalog at compile time. */
export function msg(key: MessageKey, params?: MessageParams): Msg {
  return params ? { key, params } : { key };
}

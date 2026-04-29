import { createSignal, createContext, useContext, createEffect } from 'solid-js';
import * as i18n from '@solid-primitives/i18n';
import { initData } from '@tma.js/sdk-solid';

import { dict as en } from './en.js';
import { dict as fa } from './fa.js';
import { dict as ru } from './ru.js';
import { dict as zh } from './zh.js';

const dictionaries = { en, fa, ru, zh };
export type Locale = keyof typeof dictionaries;
export type Dictionary = typeof en;

const mapLanguageCode = (code?: string): Locale => {
  if (!code) return 'en';
  const c = code.toLowerCase();
  if (c.startsWith('fa')) return 'fa';
  if (c.startsWith('ru')) return 'ru';
  if (c.startsWith('zh')) return 'zh';
  return 'en';
};

export const [locale, setLocale] = createSignal<Locale>('en');

// Reactively detect language from Telegram SDK after it initializes
createEffect(() => {
  const user = initData.user();
  const langCode = user?.language_code || navigator.language;
  const detected = mapLanguageCode(langCode);
  setLocale(detected);
});

// Keep HTML lang attribute in sync, layout always LTR
createEffect(() => {
  document.documentElement.dir = 'ltr';
  document.documentElement.lang = locale();
});

// Auto-generate all valid translation key paths from the dictionary structure
type FlattenKeys<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? FlattenKeys<T[K], `${Prefix}${K}.`>
    : `${Prefix}${K}`;
}[keyof T & string];

export type DictPaths = FlattenKeys<Dictionary>;

// Flatten dictionary for performance
export const getDict = () => i18n.flatten(dictionaries[locale()]);

// Type-safe translator: wrong keys cause a compile-time error
export const t = i18n.translator(getDict) as (key: DictPaths) => string;

export const I18nContext = createContext({ t, locale, setLocale });
export const useI18n = () => useContext(I18nContext);

import { createSignal, createContext, useContext, createEffect, createRoot } from 'solid-js';
import * as i18n from '@solid-primitives/i18n';
import { initData } from '@tma.js/sdk-solid';

import { dict as en } from './en.js';
import { dict as fa } from './fa.js';
import { dict as ru } from './ru.js';
import { dict as zh } from './zh.js';

const dictionaries = { en, fa, ru, zh };
export type Locale = keyof typeof dictionaries;
export type Dictionary = typeof en & typeof fa & typeof ru & typeof zh;

const mapLanguageCode = (code?: string): Locale => {
  if (!code) return 'en';
  const c = code.toLowerCase();
  if (c.startsWith('fa')) return 'fa';
  if (c.startsWith('ru')) return 'ru';
  if (c.startsWith('zh')) return 'zh';
  return 'en';
};

export const RTL_LOCALES: Locale[] = ['fa'];

const getInitialLocale = (): Locale => {
  const saved = localStorage.getItem('locale');
  if (saved && (saved === 'en' || saved === 'fa' || saved === 'ru' || saved === 'zh')) {
    return saved as Locale;
  }
  
  try {
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
    const tgWebAppData = params.get('tgWebAppData');
    if (tgWebAppData) {
      const data = new URLSearchParams(tgWebAppData);
      const user = JSON.parse(decodeURIComponent(data.get('user') || '{}'));
      if (user.language_code) return mapLanguageCode(user.language_code);
    }
  } catch (e) {}

  return mapLanguageCode(navigator.language);
};

export const [locale, setLocale] = createSignal<Locale>(getInitialLocale());
export const isRtl = () => RTL_LOCALES.includes(locale());

createRoot(() => {
  // Reactively detect language from Telegram SDK after it initializes
  createEffect(() => {
    if (localStorage.getItem('locale')) return;
    const user = initData.user();
    if (user?.language_code) {
      setLocale(mapLanguageCode(user.language_code));
    }
  });

  // Keep HTML lang attribute in sync, handle RTL
  createEffect(() => {
    const currentLocale = locale();
    localStorage.setItem('locale', currentLocale);
    document.documentElement.dir = RTL_LOCALES.includes(currentLocale) ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLocale;
  });
});

// Auto-generate all valid translation key paths from the dictionary structure
type FlattenKeys<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? FlattenKeys<T[K], `${Prefix}${K}.`>
    : `${Prefix}${K}`;
}[keyof T & string];

export type DictPaths = FlattenKeys<Dictionary>;

// Flatten dictionaries once at startup for high performance
const flattenedDicts = {
  en: i18n.flatten(dictionaries.en),
  fa: i18n.flatten(dictionaries.fa),
  ru: i18n.flatten(dictionaries.ru),
  zh: i18n.flatten(dictionaries.zh)
};

// Flatten dictionary for performance with 'en' fallback for missing keys
export const getDict = () => {
  const currentLocale = locale();
  if (currentLocale === 'en') return flattenedDicts.en;
  return { ...flattenedDicts.en, ...flattenedDicts[currentLocale] };
};

// Type-safe translator: wrong keys cause a compile-time error
export const t = i18n.translator(getDict) as (key: DictPaths) => string;

// Helper to format numbers based on active locale (Farsi digits for Persian)
export const formatNumber = (num: number): string => {
  return num.toLocaleString(locale() === 'fa' ? 'fa-IR' : 'en-US');
};

export const I18nContext = createContext({ t, locale, setLocale, isRtl, formatNumber });
export const useI18n = () => useContext(I18nContext);

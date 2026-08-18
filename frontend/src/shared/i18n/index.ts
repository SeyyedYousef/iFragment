import * as i18n from '@solid-primitives/i18n';
import { initData } from '@tma.js/sdk-solid';
import { createContext, createEffect, createRoot, createSignal, useContext } from 'solid-js';
import { apiFetch } from '@/shared/api/base.js';

import { dict as en } from './en.js';

export type Locale = 'en' | 'fa' | 'ru' | 'zh';
export type Dictionary = typeof en;

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
	const saved = localStorage.getItem('user_selected_locale');
	if (saved && ['en', 'fa', 'ru', 'zh'].includes(saved)) {
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
	} catch (_e) {}

	return mapLanguageCode(navigator.language);
};

const [getLocale, rawSetLocale] = createSignal<Locale>(getInitialLocale());

export { getLocale as locale };

const enFlattened = i18n.flatten(en);
const [loadedDicts, setLoadedDicts] = createSignal<Record<Locale, any>>({
	en: enFlattened,
	fa: {},
	ru: {},
	zh: {},
});

export const loadDictionary = async (loc: Locale) => {
	if (loc === 'en') return;
	const current = loadedDicts();
	if (Object.keys(current[loc] || {}).length > 0) return;

	try {
		let module: { dict: any } | undefined;
		switch (loc) {
			case 'fa':
				module = await import('./fa.js');
				break;
			case 'ru':
				module = await import('./ru.js');
				break;
			case 'zh':
				module = await import('./zh.js');
				break;
		}
		if (module?.dict) {
			const flattened = i18n.flatten(module.dict);
			setLoadedDicts((prev) => ({ ...prev, [loc]: flattened }));
		}
	} catch (err) {
		console.error(`Failed to load dictionary for ${loc}:`, err);
	}
};

// Initial background load for selected locale
loadDictionary(getInitialLocale());

export const setLocale = (newLocale: Locale) => {
	localStorage.setItem('user_selected_locale', newLocale);
	rawSetLocale(newLocale);
	loadDictionary(newLocale);
	apiFetch('/profile/language', {
		method: 'POST',
		body: JSON.stringify({ language: newLocale }),
		headers: { 'Content-Type': 'application/json' },
	}).catch(console.error);
};

export const isRtl = () => RTL_LOCALES.includes(getLocale());

createRoot(() => {
	// Reactively detect language from Telegram SDK after it initializes
	createEffect(() => {
		if (localStorage.getItem('user_selected_locale')) return;
		const user = initData.user();
		if (user?.language_code) {
			const loc = mapLanguageCode(user.language_code);
			rawSetLocale(loc);
			loadDictionary(loc);
		}
	});

	// Keep HTML lang attribute in sync, handle RTL
	createEffect(() => {
		const currentLocale = getLocale();
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

// Flatten dictionary for performance with 'en' fallback for missing keys
export const getDict = () => {
	const currentLocale = getLocale();
	const dicts = loadedDicts();
	if (currentLocale === 'en' || !dicts[currentLocale] || Object.keys(dicts[currentLocale]).length === 0) {
		return enFlattened;
	}
	return { ...enFlattened, ...dicts[currentLocale] };
};

export const customResolveTemplate = (template: string, ...args: any[]): string => {
	if (typeof template !== 'string') return (template as any) || '';
	if (!args || args.length === 0) return template;

	let result = template;
	const firstArg = args[0];

	if (firstArg && typeof firstArg === 'object') {
		for (const key of Object.keys(firstArg)) {
			const val =
				firstArg[key] !== undefined && firstArg[key] !== null ? String(firstArg[key]) : '';
			result = result.split(`{{${key}}}`).join(val).split(`{${key}}`).join(val);
		}
	} else {
		for (let i = 0; i < args.length; i++) {
			const val = args[i] !== undefined && args[i] !== null ? String(args[i]) : '';
			result = result.split(`{{${i}}}`).join(val).split(`{${i}}`).join(val);
		}
	}

	return result;
};

// Type-safe translator: wrong keys cause a compile-time error
export const t = i18n.translator(getDict, customResolveTemplate) as (
	key: DictPaths,
	args?: Record<string, any>,
) => string;

// Helper to format numbers based on active locale (en-US for consistent English digits)
export const getIntlLocale = (): string => {
	return 'en-US';
};

export const formatNumber = (num: number): string => {
	if (num === undefined || num === null || Number.isNaN(num)) return '0';
	return num.toLocaleString('en-US');
};

export const formatCoins = (coins: number | undefined | null): string => {
	if (!coins) return '+0';
	if (coins >= 1000) return `+${formatNumber(Math.floor(coins / 1000))}k`;
	return `+${formatNumber(Math.floor(coins))}`;
};

export const I18nContext = createContext({ t, locale: getLocale, setLocale, isRtl, formatNumber });
export const useI18n = () => useContext(I18nContext);


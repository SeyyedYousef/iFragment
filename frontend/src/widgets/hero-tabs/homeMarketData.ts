import { giftsApi } from '@/entities/gifts/api/giftsApi.js';
import { OFFICIAL_GIFTS_120 } from '@/entities/gifts/model/catalog120.js';
import type { CollectionSummaryItem } from '@/entities/gifts/model/types.js';
import { numbersApi } from '@/entities/numbers/api/numbersApi.js';
import { apiClient } from '@/shared/api/axios.js';

export interface HomeMarketPulse {
	tonUsdRate: number | null;
	numbersFloorTon: number | null;
	usernamesFloorTon: number | null;
	giftsFngIndex: number | null;
	giftsFngLabel: string | null;
	updatedAt: number;
}

export interface GiftAutocompleteCollection {
	slug: string;
	normSlug: string;
	name: string;
	floorTon: number;
	supply: number;
	imageUrl?: string;
	emoji?: string;
}

export interface RecentSearchItem {
	query: string;
	label: string;
	type: 'username' | 'number' | 'gift' | 'collection';
	route: string;
	timestamp: number;
}

interface UsernameCollectionStatsResponse {
	stats?: {
		floor_price?: string;
		buy_now_floor_ton?: number;
		auction_floor_ton?: number;
	} | null;
	fx?: { ton_usd?: number };
	ton_usd_rate?: number;
}

const CACHE_TTL_MS = 60_000;
const RECENT_STORAGE_KEY = 'ifragment_recent_searches_v1';
const MAX_RECENT_SEARCHES = 5;

let cachedPulse: HomeMarketPulse | null = null;
let inflightPulse: Promise<HomeMarketPulse> | null = null;

let cachedCollections: GiftAutocompleteCollection[] | null = null;
let inflightCollections: Promise<GiftAutocompleteCollection[]> | null = null;

const isTestEnv = (): boolean =>
	typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';

export const formatEnNumber = (val: number | null | undefined, maxDecimals = 0): string => {
	if (typeof val !== 'number' || !Number.isFinite(val)) return '0';
	return val.toLocaleString('en-US', {
		minimumFractionDigits: 0,
		maximumFractionDigits: maxDecimals,
	});
};

export const formatEnUsd = (val: number | null | undefined, maxDecimals = 2): string => {
	if (typeof val !== 'number' || !Number.isFinite(val)) return '0';
	return val.toLocaleString('en-US', {
		minimumFractionDigits: maxDecimals === 2 && val < 100 ? 2 : 0,
		maximumFractionDigits: maxDecimals,
	});
};

const parseTonString = (raw?: string | number | null): number => {
	if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
	if (typeof raw !== 'string') return 0;
	const cleaned = raw.replace(/[^0-9.]/g, '');
	const parsed = Number.parseFloat(cleaned);
	return Number.isFinite(parsed) ? parsed : 0;
};

const buildFallbackCatalog = (): GiftAutocompleteCollection[] =>
	OFFICIAL_GIFTS_120.map((item) => ({
		slug: item.slug,
		normSlug: item.slug.replace(/[^a-z0-9]/gi, '').toLowerCase(),
		name: item.name,
		floorTon: item.floorTon,
		supply: item.supply,
		emoji: item.emoji,
	}));

export const getInitialGiftCollections = (): GiftAutocompleteCollection[] =>
	cachedCollections ?? buildFallbackCatalog();

export const invalidateHomeMarketCache = (): void => {
	cachedPulse = null;
	cachedCollections = null;
};

export const fetchHomeMarketPulse = async (force = false): Promise<HomeMarketPulse> => {
	if (isTestEnv()) {
		return {
			tonUsdRate: null,
			numbersFloorTon: null,
			usernamesFloorTon: null,
			giftsFngIndex: null,
			giftsFngLabel: null,
			updatedAt: Date.now(),
		};
	}

	if (!force && cachedPulse && Date.now() - cachedPulse.updatedAt < CACHE_TTL_MS) {
		return cachedPulse;
	}
	if (!force && inflightPulse) {
		return inflightPulse;
	}

	inflightPulse = (async (): Promise<HomeMarketPulse> => {
		const [userRes, numRes, giftRes] = await Promise.allSettled([
			apiClient.get<UsernameCollectionStatsResponse>('/usernames/collection/stats'),
			numbersApi.getIntel(),
			giftsApi.getIntel(),
		]);

		const userData = userRes.status === 'fulfilled' ? userRes.value.data : null;
		const numData = numRes.status === 'fulfilled' ? numRes.value : null;
		const giftData = giftRes.status === 'fulfilled' ? giftRes.value : null;

		const rawTonRate =
			userData?.fx?.ton_usd ??
			userData?.ton_usd_rate ??
			giftData?.ton_usd_rate ??
			(numData?.floor_price_usd && numData?.floor_price_ton && numData.floor_price_ton > 0
				? numData.floor_price_usd / numData.floor_price_ton
				: null);
		const tonUsdRate =
			typeof rawTonRate === 'number' && Number.isFinite(rawTonRate) && rawTonRate > 0
				? rawTonRate
				: null;

		const numbersFloorTon =
			typeof numData?.floor_price_ton === 'number' && numData.floor_price_ton > 0
				? numData.floor_price_ton
				: null;

		const rawUserFloor =
			userData?.stats?.buy_now_floor_ton ||
			userData?.stats?.auction_floor_ton ||
			parseTonString(userData?.stats?.floor_price);
		const usernamesFloorTon = rawUserFloor > 0 ? rawUserFloor : null;

		const giftsFngIndex =
			typeof giftData?.fng_index === 'number' && Number.isFinite(giftData.fng_index)
				? Math.round(giftData.fng_index)
				: null;
		const giftsFngLabel = giftData?.fng_label || null;

		const pulse: HomeMarketPulse = {
			tonUsdRate,
			numbersFloorTon,
			usernamesFloorTon,
			giftsFngIndex,
			giftsFngLabel,
			updatedAt: Date.now(),
		};
		cachedPulse = pulse;
		return pulse;
	})().finally(() => {
		inflightPulse = null;
	});

	return inflightPulse;
};

export const fetchGiftCollectionsCatalog = async (): Promise<GiftAutocompleteCollection[]> => {
	if (isTestEnv()) {
		return getInitialGiftCollections();
	}
	if (cachedCollections && cachedCollections.length >= 100) {
		return cachedCollections;
	}
	if (inflightCollections) {
		return inflightCollections;
	}

	inflightCollections = (async () => {
		try {
			const liveList: CollectionSummaryItem[] = await giftsApi.listCollections();
			if (Array.isArray(liveList) && liveList.length > 0) {
				const emojiMap = new Map(
					OFFICIAL_GIFTS_120.map((c) => [c.slug.replace(/[^a-z0-9]/gi, '').toLowerCase(), c.emoji]),
				);
				const mapped: GiftAutocompleteCollection[] = liveList.map((item) => {
					const norm = (item.norm_slug || item.slug || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
					return {
						slug: item.slug,
						normSlug: norm,
						name: item.name || item.slug,
						floorTon: typeof item.floor_gram === 'number' ? item.floor_gram : 0,
						supply: typeof item.total_supply === 'number' ? item.total_supply : 0,
						imageUrl: item.thumb_url || item.image_url,
						emoji: emojiMap.get(norm),
					};
				});
				cachedCollections = mapped;
				return mapped;
			}
		} catch {
			// Graceful fallback to local catalog
		}
		return getInitialGiftCollections();
	})().finally(() => {
		inflightCollections = null;
	});

	return inflightCollections;
};

export const loadRecentSearches = (): RecentSearchItem[] => {
	if (typeof window === 'undefined' || !window.localStorage) return [];
	try {
		const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter(
				(item): item is RecentSearchItem =>
					item &&
					typeof item.query === 'string' &&
					typeof item.label === 'string' &&
					typeof item.route === 'string',
			)
			.slice(0, MAX_RECENT_SEARCHES);
	} catch {
		return [];
	}
};

export const saveRecentSearch = (
	entry: Omit<RecentSearchItem, 'timestamp'>,
): RecentSearchItem[] => {
	const existing = loadRecentSearches();
	const normalized = entry.query.trim().toLowerCase();
	const next: RecentSearchItem[] = [
		{ ...entry, timestamp: Date.now() },
		...existing.filter((item) => item.query.trim().toLowerCase() !== normalized),
	].slice(0, MAX_RECENT_SEARCHES);

	if (typeof window !== 'undefined' && window.localStorage) {
		try {
			window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
		} catch {}
	}
	return next;
};

export const clearRecentSearches = (): RecentSearchItem[] => {
	if (typeof window !== 'undefined' && window.localStorage) {
		try {
			window.localStorage.removeItem(RECENT_STORAGE_KEY);
		} catch {}
	}
	return [];
};

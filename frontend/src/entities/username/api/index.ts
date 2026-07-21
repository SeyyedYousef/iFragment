import { createQuery } from '@tanstack/solid-query';
import { createEffect, createSignal, onCleanup } from 'solid-js';
import { apiFetch } from '@/shared/api/base.js';

export interface AvailabilityStatus {
	username: string;
	status: 'available' | 'taken' | 'on_auction' | 'on_sale' | 'purchase_available' | string;
}

export interface QuickCheck {
	username: string;
	status: string;
	length: number;
	rarity_score: number;
	sale_status: string;
	buy_now_price?: number;
	highest_bid?: number;
	end_time?: string;
	fragment_url: string;
	search_popularity: number;
	linguistic_score: number;
}

const CACHE_PREFIX = 'ifrag_cache_';
const CACHE_TTL_MS = 5 * 60 * 1000;

function getLocalCache<T>(key: string): T | null {
	try {
		const raw = localStorage.getItem(CACHE_PREFIX + key);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
			return parsed.data as T;
		}
		localStorage.removeItem(CACHE_PREFIX + key);
	} catch {}
	return null;
}

function setLocalCache<T>(key: string, data: T): void {
	try {
		localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ timestamp: Date.now(), data }));
	} catch {}
}

export const useUsernameQuickAnalysis = (username: () => string | undefined | null) => {
	const [debouncedUsername, setDebouncedUsername] = createSignal<string | undefined | null>(
		username(),
	);

	createEffect(() => {
		const val = username();
		if (!val || val.length < 4) {
			setDebouncedUsername(val);
			return;
		}
		const timeout = setTimeout(() => {
			setDebouncedUsername(val);
		}, 450); // 450ms debounce
		onCleanup(() => clearTimeout(timeout));
	});

	return createQuery(() => {
		const u = debouncedUsername();
		return {
			queryKey: ['username', 'quick', u],
			queryFn: async () => {
				if (!u) throw new Error('Username is required');
				const cacheKey = `quick_${u.toLowerCase()}`;
				const cached = getLocalCache<QuickCheck>(cacheKey);
				if (cached) return cached;
				const res = await apiFetch<QuickCheck>(`/usernames/quick?u=${encodeURIComponent(u)}`);
				setLocalCache(cacheKey, res);
				return res;
			},
			enabled: !!u && u.length >= 4,
			staleTime: 3 * 60 * 1000, // 3 minutes
		};
	});
};

export interface ValuationResult {
	base_price_ton: string;
	low_ton: string;
	expected_ton: string;
	high_ton: string;
	confidence_score: number;
	rarity: number;
	reasoning_log: Record<string, any>;
}

export const useUsernameValuation = (username: () => string | undefined | null) => {
	const [debouncedUsername, setDebouncedUsername] = createSignal<string | undefined | null>(
		username(),
	);

	createEffect(() => {
		const val = username();
		if (!val || val.length < 4) {
			setDebouncedUsername(val);
			return;
		}
		const timeout = setTimeout(() => {
			setDebouncedUsername(val);
		}, 450);
		onCleanup(() => clearTimeout(timeout));
	});

	return createQuery(() => {
		const u = debouncedUsername();
		return {
			queryKey: ['username', 'valuate', u],
			queryFn: async () => {
				if (!u) throw new Error('Username is required');
				const cacheKey = `valuate_${u.toLowerCase()}`;
				const cached = getLocalCache<ValuationResult>(cacheKey);
				if (cached) return cached;
				const res = await apiFetch<ValuationResult>(
					`/usernames/valuate?u=${encodeURIComponent(u)}`,
				);
				setLocalCache(cacheKey, res);
				return res;
			},
			enabled: !!u && u.length >= 4,
			staleTime: 5 * 60 * 1000,
		};
	});
};

import { createQuery } from '@tanstack/solid-query';
import { createEffect, createSignal, onCleanup } from 'solid-js';
import { apiFetch } from '@/shared/api/base.js';

export type UsernameStatusType =
	| 'available'
	| 'taken'
	| 'reserved'
	| 'active_auction'
	| 'listed_for_sale'
	| 'collectible_not_listed'
	| 'unknown'
	| 'source_unavailable';

export interface AvailabilityStatus {
	username: string;
	status: UsernameStatusType;
}

export interface QuickCheck {
	username: string;
	status: UsernameStatusType;
	length: number;
	rarity_score: number;
	sale_status: string;
	buy_now_price?: number;
	highest_bid?: number;
	end_time?: string;
	fragment_url: string;
	search_popularity: number;
	linguistic_score: number;
	data_badges?: Record<string, string>;
	fetched_at?: string;
}

// Tiered TTL Definitions (in milliseconds)
export const TTI_TIERS = {
	ACTIVE_BID: 15 * 1000, // 15s for live bids
	OWNERSHIP: 30 * 1000, // 30s for ownership & listing
	VALUATION: 5 * 60 * 1000, // 5m for valuation calculations
	LINGUISTIC: 30 * 24 * 60 * 60 * 1000, // 30d for linguistic metrics
};

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
				return await apiFetch<QuickCheck>(`/usernames/quick?u=${encodeURIComponent(u)}`);
			},
			enabled: !!u && u.length >= 4,
			staleTime: TTI_TIERS.OWNERSHIP, // 30s fresh state
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
	reasoning_log: Record<string, unknown>;
	max_rational_bid_ton?: string;
	net_seller_proceeds_ton?: string;
	data_badges?: Record<string, string>;
	fetched_at?: string;
	is_fallback_used?: boolean;
	onchain_verified_count?: number;
	comparable_sales_count?: number;
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
				return await apiFetch<ValuationResult>(
					`/usernames/valuate?u=${encodeURIComponent(u)}`,
				);
			},
			enabled: !!u && u.length >= 4,
			staleTime: TTI_TIERS.VALUATION, // 5m fresh state
		};
	});
};

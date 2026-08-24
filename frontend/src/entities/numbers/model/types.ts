export interface NumbersIntelData {
	total_supply: number;
	supply_status: string;
	total_owners: number;
	total_sales: number;
	total_volume_ton: number;
	floor_price_ton: number;
	floor_price_usd: number;
	volume_24h_ton: number;
	volume_7d_ton: number;
	fng_index: number;
	fng_label: string;
	historical_ath_ton: number;
	ath_number: string;
	percentile_chart: {
		date: string;
		p50: number;
		p68: number;
		p85: number;
	}[];
	ending_soon: {
		number: string;
		display_number: string;
		current_bid_ton: number;
		ends_at: string;
		color: string;
	}[];
	trending_tail: {
		tail_class: string;
		label: string;
		volume_growth_pct: number;
		avg_price_ton: number;
		is_hot: boolean;
	}[];
	hall_of_fame: {
		rank: number;
		number: string;
		display_number: string;
		price_ton: number;
		price_usd: number;
		sale_date: string;
		color: string;
		tonviewer_url: string;
	}[];
	updated_at: string;
}

export interface CuriosityGateData {
	number: string;
	display_number: string;
	signals_analyzed: number;
	risks_identified: number;
	data_sources_count: number;
	is_live_listing: boolean;
	live_ask_ton?: number;
	color_name?: string;
	checked_at: string;
}

export interface RarityBarItem {
	key: string;
	label_en: string;
	label_fa: string;
	value: string;
	percentile: number;
	is_exact: boolean;
	description: string;
}

export interface ColorMeta {
	name: string;
	hex: string;
	multiplier: number;
	description: string;
}

export interface HistoricalTx {
	price_ton: number;
	price_usd: number;
	sale_date: string;
	buyer_address: string;
	seller_address: string;
	transaction_hash?: string;
	source: string;
}

export interface CompSale {
	number: string;
	price_ton: number;
	price_usd: number;
	sale_date: string;
	color: string;
	tail_class: string;
	diff_percent: number;
	tonviewer_url?: string;
}

export interface CulturalScore {
	region_key: string;
	market_name: string;
	score: number;
	verdict_en: string;
	verdict_fa: string;
	description_en: string;
	description_fa: string;
}

export interface NumberValuationResult {
	run_id: number;
	number: string;
	display_number: string;
	model_version: string;
	base_price_ton: string;
	low_ton: string;
	expected_ton: string;
	high_ton: string;
	low_usd: number;
	expected_usd: number;
	high_usd: number;
	ton_usd_rate: number;
	confidence_score: number;
	price_basis: string;
	rarity_dna: RarityBarItem[];
	color: ColorMeta;
	history: {
		is_sold: boolean;
		owner_address?: string;
		highest_past_sale_ton?: number;
		transactions: HistoricalTx[];
	};
	comps: CompSale[];
	cultural_radar: CulturalScore[];
	liquidity: {
		liquidity_rating: string;
		estimated_sell_days: string;
		median_days_to_sell: number;
		target_buyer_profile: string;
		bid_velocity_score: number;
	};
	risk_audit: {
		ownership_churn: string;
		distress_signal: boolean;
		distress_message?: string;
		restricted_risk: string;
		restricted_guide: string;
		management_deep_link: string;
	};
	economics: {
		fragment_fee_pct: number;
		fragment_fee_ton: number;
		net_payout_ton: number;
		net_payout_usd: number;
		min_bid_ton: number;
		bid_step_ton: number;
		buy_now_ton: number;
		buy_now_usd: number;
	};
	projection: {
		bull_ton: number;
		bull_usd: number;
		base_ton: number;
		base_usd: number;
		bear_ton: number;
		bear_usd: number;
	};
	recommendation: {
		verdict: string;
		confidence_tier: string;
		expected_net_ton: number;
		summary_en: string;
		summary_fa: string;
	};
	certificate_id: string;
	evaluated_at: string;
}

export interface MaskItem {
	number: string;
	display_number: string;
	status: string;
	listing_price_ton?: number;
	color: string;
	rarity_score: number;
}

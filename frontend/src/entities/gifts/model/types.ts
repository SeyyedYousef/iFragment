export interface CuriosityGateData {
	gift_id: string;
	model_id: string;
	model_name: string;
	serial_number: number;
	signals_analyzed: number;
	risks_identified: number;
	data_sources_count: number;
	is_crafted: boolean;
	floor_price_gram: number;
	floor_price_usd: number;
	checked_at: string;
}

export interface TraitDNABar {
	axis_key: string;
	label_en: string;
	label_fa: string;
	value: string;
	percentile: number;
	rarity_tier: string;
	certainty_level: 'exact' | 'measured' | 'estimated';
	colors?: {
		center_hex: string;
		edge_hex: string;
		pattern_hex: string;
		text_hex: string;
	};
	description: string;
}

export interface ExitOption {
	rank: number;
	venue_id: string;
	venue_name: string;
	currency: string;
	gross_price_gram: number;
	gross_price_usd: number;
	fee_percent: number;
	fee_amount_gram: number;
	net_payout_gram: number;
	net_payout_usd: number;
	requires_kyc: boolean;
	has_real_volume_badge: boolean;
	volume_7d_gram: number;
	estimated_days_to_sell: number;
	deep_link: string;
	recommendation_note: string;
}

export interface ExitPlannerPlan {
	best_venue_id: string;
	best_venue_name: string;
	max_net_gram: number;
	max_net_usd: number;
	arbitrage_spread_pct: number;
	options: ExitOption[];
	calculated_at: string;
}

export interface CraftingEVData {
	total_inputs_count: number;
	total_inputs_cost_gram: number;
	total_inputs_cost_usd: number;
	success_probability_pct: number;
	expected_output_gram: number;
	expected_output_usd: number;
	crafting_fee_stars: number;
	crafting_fee_gram: number;
	net_ev_gram: number;
	net_ev_usd: number;
	roi_percent: number;
	recommendation: 'YES' | 'RISKY' | 'NO';
	verdict_summary_en: string;
	verdict_summary_fa: string;
	distribution_p10_gram: number;
	distribution_p50_gram: number;
	distribution_p90_gram: number;
	formula_breakdown: Array<{
		term_name: string;
		value: string;
		description: string;
	}>;
	burn_warning_notice: string;
	lock_warning?: string;
	simulated_iterations: number;
}

export interface UpgradePricePoint {
	step_number: number;
	stars_price: number;
	gram_price: number;
	usd_price: number;
	effective_at: string;
	is_current: boolean;
	countdown_sec: number;
}

export interface UpgradeAdviceData {
	gift_id: string;
	model_id: string;
	current_price_stars: number;
	current_price_gram: number;
	current_price_usd: number;
	floor_price_stars: number;
	floor_price_gram: number;
	max_stars_savings: number;
	max_savings_gram: number;
	max_savings_usd: number;
	optimal_wait_hours: number;
	optimal_wait_minutes: number;
	recommendation: string;
	advice_headline_en: string;
	advice_headline_fa: string;
	trade_off_analysis_en: string;
	trade_off_analysis_fa: string;
	price_ladder: UpgradePricePoint[];
	telegram_deep_link: string;
	checked_at: string;
}

export interface ComparableGiftSale {
	gift_id: string;
	model_id: string;
	serial_number: number;
	venue: string;
	sale_price_gram: number;
	sale_price_usd: number;
	sale_date: string;
	backdrop_name: string;
	diff_percent: number;
	tonviewer_url: string;
}

export interface RiskItem {
	key: string;
	title_en: string;
	title_fa: string;
	passed: boolean;
	detail: string;
}

export interface RiskAuditData {
	overall_risk_level: string;
	is_resell_locked: boolean;
	is_craft_locked: boolean;
	resale_commission_pct: number;
	commission_warning?: string;
	is_copycat_collection: boolean;
	authenticity_status: string;
	ownership_churn_tier: string;
	venue_liquidity_tier: string;
	risk_checklist: RiskItem[];
	audited_at: string;
}

export interface GrowthProjection {
	bull_gram: number;
	bull_usd: number;
	base_gram: number;
	base_usd: number;
	bear_gram: number;
	bear_usd: number;
}

export interface ValuationActionVerdict {
	verdict: string;
	confidence_tier: string;
	best_venue_id: string;
	expected_net_gram: number;
	summary_en: string;
	summary_fa: string;
}

export interface GiftValuationReport {
	run_id: number;
	gift_id: string;
	model_id: string;
	collection_id?: string;
	model_name: string;
	serial_number: number;
	selected_model?: string;
	owner_name?: string;
	image_url?: string;
	display_title: string;
	model_version: string;
	base_price_gram: string;
	low_gram: string;
	expected_gram: string;
	high_gram: string;
	low_usd: number;
	expected_usd: number;
	high_usd: number;
	gram_usd_rate: number;
	confidence_score: number;
	price_basis: string;
	trait_dna: TraitDNABar[];
	joint_rarity?: {
		harmonic_rarity_score: number;
		surprisal_bits: number;
		beta_synergy: number;
	};
	aesthetic_harmony?: any;
	stars_parity?: any;
	profile_flex?: any;
	exit_planner: ExitPlannerPlan;
	crafting_ev?: CraftingEVData;
	upgrade_advisor?: UpgradeAdviceData;
	comps: ComparableGiftSale[];
	risk_audit: RiskAuditData;
	projection: GrowthProjection;
	recommendation: ValuationActionVerdict;
	certificate_id: string;
	evaluated_at: string;
	reasoning_log: Record<string, any>;
}

export interface UnifiedFloorBoardItem {
	model_id: string;
	name: string;
	total_supply: number;
	best_floor_gram: number;
	best_floor_usd: number;
	best_venue_id: string;
	best_venue_name: string;
	price_change_24h_pct: number;
	venue_floors: Record<string, number>;
	has_real_volume_badge: boolean;
}

export interface ArbitrageOpportunity {
	model_id: string;
	model_name: string;
	buy_venue: string;
	buy_price_gram: number;
	sell_venue: string;
	sell_price_gram: number;
	net_profit_gram: number;
	net_profit_usd: number;
	spread_percent: number;
	is_free_access: boolean;
}

export interface UpgradeClockItem {
	model_id: string;
	model_name: string;
	current_price_stars: number;
	floor_price_stars: number;
	next_drop_in_minutes: number;
	potential_savings_stars: number;
}

export interface TrendingModelItem {
	model_id: string;
	name: string;
	volume_growth_24h_pct: number;
	floor_gram: number;
	is_crafted: boolean;
}

export interface GiftAuctionItem {
	gift_id: string;
	model_name: string;
	serial_number: number;
	current_bid_gram: number;
	ends_at: string;
	venue: string;
}

export interface GiftsIntelResponse {
	total_cumulative_volume_usd: number;
	total_market_cap_usd: number;
	total_active_wallets: number;
	total_gifts_minted: number;
	fng_index: number;
	fng_label: string;
	unified_floor_board: UnifiedFloorBoardItem[];
	arbitrage_radar: ArbitrageOpportunity[];
	upgrade_price_clock: UpgradeClockItem[];
	trending_models: TrendingModelItem[];
	ending_soon_auctions: GiftAuctionItem[];
	updated_at: string;
}

export interface PortfolioItemSummary {
	gift_id: string;
	model_name: string;
	serial_number: number;
	estimated_val_gram: number;
	estimated_val_usd: number;
	rarity_tier: string;
	report_deep_link: string;
}

export interface CollectionShareItem {
	model_id: string;
	model_name: string;
	count: number;
	total_val_gram: number;
	share_percent: number;
}

export interface PortfolioScanResponse {
	username: string;
	total_gifts_count: number;
	total_portfolio_value_gram: number;
	total_portfolio_value_usd: number;
	historical_invested_gram: number;
	total_pnl_gram: number;
	total_pnl_percent: number;
	top_valued_gifts: PortfolioItemSummary[];
	collection_breakdown: CollectionShareItem[];
	scanned_at: string;
}

// ═══════════════════════════════════════════════════════════
// Collection Intelligence Types
// ═══════════════════════════════════════════════════════════

export interface CollectionModelFloor {
	model_id: string;
	model_name: string;
	rarity_permille: number;
	total_supply: number;
	upgraded_count: number;
	floor_gram: number;
	floor_usd: number;
	best_venue: string;
	change_24h_pct: number;
	change_7d_pct: number;
	volume_24h_gram: number;
	is_trending: boolean;
	custom_emoji_id?: string;
}

export interface RarityHeatmapCell {
	model_id: string;
	model_name: string;
	backdrop_id: string;
	backdrop_name: string;
	symbol_id?: string;
	symbol_name?: string;
	count: number;
	total_in_collection: number;
	rarity_permille: number;
	rarity_tier: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
	floor_gram: number;
	floor_usd: number;
}

export interface MarketVenueFloor {
	venue_id: string;
	venue_name: string;
	floor_gram: number;
	floor_usd: number;
	currency?: string;
	fee_pct: number;
	net_payout_gram: number;
	listed_count?: number;
	is_on_chain: boolean;
	data_status?: 'live' | 'estimated' | 'unavailable';
}

export interface CrossMarketArbitrage {
	buy_venue: string;
	buy_price_gram: number;
	sell_venue: string;
	sell_price_gram: number;
	spread_pct: number;
	net_profit_gram: number;
	net_profit_usd: number;
}

export interface WhaleProfile {
	rank: number;
	owner_address: string;
	display_name?: string;
	telegram_username?: string;
	holdings_count: number;
	total_value_gram: number;
	total_value_usd: number;
	classification: 'diamond_hands' | 'flipper' | 'accumulator';
	change_24h_count: number;
	avg_hold_days: number;
}

export interface MarketActivityItem {
	activity_type: 'sale' | 'listing' | 'upgrade' | 'craft' | 'transfer' | 'delist';
	gift_id: string;
	model_name: string;
	serial_number: number;
	price_gram?: number;
	price_usd?: number;
	venue?: string;
	from_address?: string;
	to_address?: string;
	timestamp: string;
}

export interface FearGreedData {
	index: number;
	label: string;
	volume_component: number;
	price_component: number;
	listing_ratio_component: number;
	on_chain_component: number;
	previous_index: number;
	trend: 'rising' | 'falling' | 'stable';
}

export interface UpgradeStepInfo {
	step: number;
	price_stars: number;
	price_gram: number;
	price_usd: number;
	effective_at: string;
	is_current: boolean;
	savings_vs_current_stars: number;
}

export interface CollectionBackdropSummary {
	name: string;
	rarity_permille: number;
	center_hex: string;
	edge_hex: string;
	pattern_hex: string;
	text_hex: string;
}

export interface CollectionIntelResponse {
	collection_id: string;
	collection_name: string;
	collection_slug: string;
	contract_address?: string;
	lottie_url?: string;
	image_url?: string;
	total_supply: number;
	upgraded_count: number;
	is_limited: boolean;
	is_craftable: boolean;
	release_date: string;
	upgrade_enabled_date?: string;

	// Trait Counts
	total_models?: number;
	total_backdrops?: number;
	total_symbols?: number;
	backdrops_list?: CollectionBackdropSummary[];

	// Market Pulse
	best_floor_gram: number;
	best_floor_usd: number;
	best_floor_venue: string;
	change_24h_pct: number;
	change_7d_pct: number;
	change_30d_pct: number;
	volume_24h_gram: number;
	volume_24h_usd: number;
	market_cap_gram: number;
	market_cap_usd: number;
	listed_count: number;
	liquidity_ratio: number;

	// Sections
	model_floors: CollectionModelFloor[];
	rarity_heatmap: RarityHeatmapCell[];
	venue_floors: MarketVenueFloor[];
	arbitrage: CrossMarketArbitrage | null;
	whales: WhaleProfile[];
	recent_activity: MarketActivityItem[];
	fear_greed: FearGreedData;
	upgrade_ladder: UpgradeStepInfo[];

	// Floor price history (for chart)
	floor_history: Array<{
		timestamp: string;
		floor_gram: number;
		venue_breakdown: Record<string, number>;
	}>;

	// Attribution & metadata
	data_status?: 'live' | 'estimated' | 'unavailable';
	data_sources: string[];
	updated_at: string;
}

// ═══════════════════════════════════════════════════════════
// Single Gift Deep-Dive — New Types
// ═══════════════════════════════════════════════════════════

export interface ProvenanceEvent {
	event_type: 'created' | 'sent' | 'upgraded' | 'sold' | 'transferred' | 'crafted' | 'listed' | 'delisted';
	timestamp: string;
	from_address?: string;
	from_username?: string;
	to_address?: string;
	to_username?: string;
	price_gram?: number;
	price_usd?: number;
	venue?: string;
	tx_hash?: string;
	tonviewer_url?: string;
	note?: string;
}

export interface OnChainMetadata {
	nft_address?: string;
	collection_address: string;
	owner_address?: string;
	mint_number: number;
	attributes: Array<{ trait_type: string; value: string; rarity?: string }>;
	metadata_url: string;
	tonviewer_url: string;
	tonscan_url: string;
	marketplace_links: Record<string, string>;
}

export interface EnrichedGiftReport extends GiftValuationReport {
	rarity_score: number;
	rarity_rank: number;
	rarity_percentile: number;
	provenance: ProvenanceEvent[];
	on_chain: OnChainMetadata | null;
}

export interface NumbersIntelData {
	total_supply: number;
	genesis_supply?: number;
	standard_supply?: number;
	supply_status: string;
	total_owners: number;
	avg_numbers_per_owner?: number;
	total_sales: number;
	total_volume_ton: number;
	floor_price_ton: number;
	unrestricted_floor_ton?: number;
	floor_price_usd: number;
	ton_rate_usd?: number;
	volume_24h_ton: number;
	volume_24h_usd?: number;
	volume_7d_ton: number;
	volume_30d_ton?: number;
	active_auctions_count?: number;
	fixed_price_count?: number;
	restricted_count?: number;
	lowest_auction_ton?: number;
	lowest_auction_number?: string;
	highest_auction_ton?: number;
	highest_auction_number?: string;
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
	top_auctions?: {
		number: string;
		display_number: string;
		current_bid_ton: number;
		ends_at: string;
		color: string;
	}[];
	lowest_auctions?: {
		number: string;
		display_number: string;
		current_bid_ton: number;
		ends_at: string;
		color: string;
	}[];
	recent_sales?: {
		number: string;
		display_number: string;
		price_ton: number;
		price_usd: number;
		sale_date: string;
		color: string;
		tonviewer_url?: string;
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
	data_status?: 'live' | 'insufficient_data';
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

export interface NumberVerifyResult {
	number: string;
	display_number: string;
	is_minted: boolean;
	exists: boolean;
	tier: string;
	category_club: string;
	global_rank: number;
	teaser_chips: string[];
	owner_address?: string;
	nft_address?: string;
	color?: string;
	error?: string;
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

export interface ActionablePlaybook {
	fair_buy_target_ton: number;
	fair_buy_target_usd: number;
	suggested_auction_start_ton: number;
	suggested_auction_start_usd: number;
	buy_now_target_ton: number;
	buy_now_target_usd: number;
	bid_step_ton: number;
	net_proceeds_ton: number;
	net_proceeds_usd: number;
	fragment_fee_ton: number;
}

export interface PatternAnatomyData {
	club_name_en: string;
	club_name_fa: string;
	pattern_type_en: string;
	pattern_type_fa: string;
	exact_supply_count: number;
	supply_percentage: number;
	distinct_digits: number;
	max_run: number;
	symmetry_score: number;
	memorability_score: number;
	numerology_report_en: string;
	numerology_report_fa: string;
}

export interface RentalYieldData {
	monthly_yield_ton: number;
	monthly_yield_usd: number;
	est_apy: number;
	target_audience_fa: string;
	target_audience_en: string;
}

export interface MarketDepthData {
	club_floor_ton: number;
	club_floor_usd: number;
	listed_ratio_pct: number;
	estimated_sell_days: string;
	hodl_strength_fa: string;
	hodl_strength_en: string;
	liquidity_speed_en: string;
	liquidity_speed_fa: string;
}

export interface OnChainAuditData {
	is_restricted: boolean;
	restriction_status_fa: string;
	restriction_status_en: string;
	telemint_contract: string;
	mint_date: string;
	transfer_count: number;
	highest_past_sale_ton: number;
	appreciation_pct: number;
	collection_verified?: boolean;
	real_owner_address?: string;
	escrow_contract?: string;
	is_escrow?: boolean;
	transaction_hash?: string;
	tonviewer_url?: string;
	data_status?: string;
}

export interface SecurityAdvisoryData {
	account_takeover_risk: string;
	is_active_login_credential: boolean;
	registration_utility_score: number;
	session_reset_required: boolean;
	two_factor_warning: string;
	takeover_mitigation_steps: string[];
}

export interface TelemintProvenanceData {
	collection_address: string;
	collection_verified: boolean;
	item_address?: string;
	real_owner_address?: string;
	escrow_contract_address?: string;
	is_escrow: boolean;
	transaction_hash?: string;
	tonviewer_url?: string;
	block_time?: string;
	data_status: string;
}

export interface PriceContributionBreakdown {
	pattern_premium_pct: number;
	scarcity_pct: number;
	market_sentiment_pct: number;
	safety_pct: number;
	comps_contribution_pct: number;
}

export interface SellingProbabilities {
	p_7d: number;
	p_30d: number;
	p_90d: number;
	estimated_days_to_sell: number;
}

export interface ModelCardInfo {
	engine_version: string;
	dataset_hash: string;
	last_trained_at: string;
	evaluation_method: string;
	signature_proof: string;
}

export interface NumberDigitForensicCell {
	position: number;
	digit: string;
	ascii_code: number;
	ascii_hex: string;
	ascii_binary: string;
	bcd_nibble: string;
	hamming_weight: number;
	dtmf_row_hz: number;
	dtmf_col_hz: number;
	keypad_row: number;
	keypad_col: number;
}

export interface NumberBinaryForensics {
	clean_digits: string;
	suffix_digits: string;
	utf8_hex: string;
	bcd_stream: string;
	tep62_index_sha256_hex: string;
	tep62_index_uint256_dec: string;
	collection_address: string;
	nft_item_address: string;
	shannon_entropy_bits: number;
	max_entropy_bits: number;
	kolmogorov_compression_pct: number;
	total_hamming_weight: number;
	keypad_manhattan_distance: number;
	keypad_ergonomic_score: number;
	keypad_geometry_class_en: string;
	keypad_geometry_class_fa: string;
	dtmf_acoustic_signature: string;
	tvm_code_hash?: string;
	tvm_data_hash?: string;
	tvm_last_tx_lt?: string;
	tvm_balance_nanoton?: string;
	token_name_boc_hex?: string;
	individual_content_boc_hex?: string;
	digits_matrix: NumberDigitForensicCell[];
}

export interface NumberOnChainHistoryEvent {
	event_type: 'Mint' | 'Sale' | 'Transfer';
	event_type_fa: string;
	price_ton: number;
	price_usd: number;
	date: string;
	tx_hash: string;
	tonscan_url: string;
	tonviewer_url: string;
	from_wallet: string;
	to_wallet: string;
	venue: string;
}

export interface NumberMarketProvenance {
	is_minted: boolean;
	minted_status_reason_en: string;
	minted_status_reason_fa: string;
	suggested_minted_alternatives?: {
		number: string;
		display_number: string;
		label_fa: string;
		last_sale_ton?: number;
	}[];
	nft_address: string;
	owner_address: string;
	collection_address: string;
	color_hex: string;
	color_name_en: string;
	color_name_fa: string;
	color_tier_fa: string;
	color_multiplier: number;
	is_restricted: boolean;
	restriction_source: string;
	restriction_reason_en: string;
	restriction_reason_fa: string;
	nft_image_url: string;
	nft_json_url: string;
	fragment_url: string;
	nums888_url: string;
	getgems_url: string;
	marketapp_url: string;
	tonviewer_url: string;
	owners_count: number;
	total_sales_count: number;
	first_mint_date: string;
	last_sale_ton: number;
	last_sale_usd: number;
	last_sale_date: string;
}

export interface NumberMakeOfferSimulation {
	suggested_offer_ton: number;
	suggested_offer_usd: number;
	offer_fee_mult: number;
	offer_fee_ton: number;
	offer_fee_usd: number;
	seller_ask_ton: number;
	fragment_protocol_fee_pct: number;
	fragment_protocol_fee_ton: number;
	seller_net_proceeds_ton: number;
	seller_net_proceeds_usd: number;
	acceptance_probability_pct: number;
}

export interface NumberPatternSiblingItem {
	number: string;
	display_number: string;
	clean_digits: string;
	color_hex: string;
	color_name: string;
	last_sale_ton: number;
	last_sale_usd: number;
	last_sale_date: string;
	current_bid_or_ask_ton?: number;
	is_restricted: boolean;
	owners_count: number;
	current_owner: string;
	similarity_reason_fa: string;
	similarity_reason_en: string;
	fragment_url: string;
	nums888_url: string;
}

export interface NumberOwnerHoldingItem {
	clean_digits: string;
	display_number: string;
	acquired_date: string;
	tx_hash: string;
	acquired_price_ton: number;
	acquired_price_usd: number;
	is_current_number: boolean;
	nums888_url: string;
	fragment_url: string;
}

export interface NumberOwnerIntelligence {
	owner_address: string;
	wallet_workchain: 'Masterchain (-1 Sovereign)' | 'Basechain (0 Standard)';
	wallet_interfaces: string[];
	wallet_status: string;
	liquid_balance_ton: number;
	liquid_balance_usd: number;
	total_numbers_held: number;
	total_invested_ton: number;
	total_invested_usd: number;
	portfolio_floor_worth_ton: number;
	portfolio_floor_worth_usd: number;
	entry_cost_ton: number;
	entry_cost_usd: number;
	entry_date: string;
	entry_type: 'Mint' | 'Sale' | 'Transfer';
	unrealized_pnl_ton: number;
	unrealized_pnl_usd: number;
	unrealized_pnl_pct: number;
	holder_tier_en: string;
	holder_tier_fa: string;
	seller_negotiation_score: number;
	negotiation_stance_fa: string;
	negotiation_strategy_fa: string;
	other_holdings: NumberOwnerHoldingItem[];
}

export interface NumberPriceTrajectoryPoint {
	label: string;
	label_fa: string;
	date: string;
	price_ton: number;
	price_usd: number;
	floor_multiple: number;
	point_type: 'Mint' | 'Sale' | 'FairValue' | 'Projection';
}

export interface NumberColorMatrixItem {
	hex: string;
	name_en: string;
	name_fa: string;
	tier_fa: string;
	multiplier: number;
	is_active: boolean;
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
	liquidation_ton?: number;
	liquidation_usd?: number;
	suggested_ask_ton?: number;
	suggested_ask_usd?: number;
	ton_usd_rate: number;
	confidence_score: number;
	price_basis: string;
	global_rank?: number;
	category_club?: string;
	category_club_fa?: string;
	collateral_value_ton?: number;
	collateral_value_usd?: number;
	fragment_direct_url?: string;
	price_contributions?: PriceContributionBreakdown;
	selling_probabilities?: SellingProbabilities;
	model_card?: ModelCardInfo;
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
	playbook?: ActionablePlaybook;
	pattern_anatomy?: PatternAnatomyData;
	rental_yield?: RentalYieldData;
	market_depth?: MarketDepthData;
	on_chain_audit?: OnChainAuditData;
	security_advisory?: SecurityAdvisoryData;
	telemint_provenance?: TelemintProvenanceData;
	live_listing?: {
		status: 'for_sale' | 'on_auction' | 'sold' | 'unlisted';
		ask_or_bid_ton?: number;
		ask_or_bid_usd?: number;
		fair_value_ton: number;
		arbitrage_spread_pct: number;
		deal_verdict: string;
		venue: string;
		direct_url: string;
		is_vanity_ask?: boolean;
	};
	combinatorial_scarcity?: {
		exact_pattern_pool_size: number;
		total_supply: number;
		pool_share_pct: number;
		mathematical_formula: string;
		scarcity_tier: string;
	};
	binary_forensics?: NumberBinaryForensics;
	onchain_history?: NumberOnChainHistoryEvent[];
	market_provenance?: NumberMarketProvenance;
	make_offer_simulation?: NumberMakeOfferSimulation;
	pattern_siblings?: NumberPatternSiblingItem[];
	owner_intelligence?: NumberOwnerIntelligence;
	price_trajectory?: NumberPriceTrajectoryPoint[];
	color_palette_matrix?: NumberColorMatrixItem[];
	smart_mask?: string;
	reasoning_log?: Record<string, any>;
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

export interface DealSniperItem {
	number: string;
	display_number: string;
	listing_price_ton: number;
	fair_value_ton: number;
	discount_percent: number;
	profit_potential_ton: number;
	marketplace: string;
	marketplace_url: string;
	color: string;
	global_rank: number;
	category_club: string;
}

export interface CategoryClubItem {
	id: string;
	name_en: string;
	name_fa: string;
	icon: string;
	floor_price_ton: number;
	total_supply: number;
	top_sale_ton: number;
	description_en: string;
	description_fa: string;
}

export interface WalletPortfolioResult {
	owner_address: string;
	total_assets: number;
	total_value_ton: number;
	total_value_usd: number;
	average_rarity_score: number;
	best_global_rank: number;
	assets: PortfolioAssetItem[];
}

export interface PortfolioAssetItem {
	number: string;
	display_number: string;
	expected_ton: number;
	expected_usd: number;
	rarity_score: number;
	global_rank: number;
	color: string;
}

export interface LiveActivityItem {
	id: string;
	number: string;
	display_number: string;
	sale_price_ton: number;
	sale_price_usd: number;
	sale_date: string;
	tx_hash: string;
	tonviewer_url: string;
	marketplace: string;
}

export interface NumbersFilterState {
	saleType: '' | 'auction' | 'for_sale' | 'not_for_sale';
	numberType: '' | 'banned' | 'not_banned';
	ownersHistory: '' | '1' | '2-3' | '4+';
	nftColors: string[];
	mask: string;
	page: number;
	limit: number;
}

export interface NumberTableItem {
	number: string;
	display_number: string;
	color_hex: string;
	color_name: string;
	last_sale_ton: number;
	last_sale_usd: number;
	last_sale_date: string;
	current_bid_ton?: number;
	last_sale_tx?: string;
	owners_count: number;
	current_owner: string;
	is_restricted: boolean;
	source: string;
	market_url: string;
	is_estimated?: boolean;
	data_status?: 'live' | 'estimated';
}

export interface ChartHistoricalPoint {
	date: string;
	ton: number;
	usd: number;
	volume_ton: number;
	volume_usd: number;
	open_ton: number;
	high_ton: number;
	low_ton: number;
	close_ton: number;
	open_usd: number;
	high_usd: number;
	low_usd: number;
	close_usd: number;
}

export interface MaskSearchResult {
	number: string;
	display_number: string;
	status: 'for_sale' | 'on_auction' | 'taken' | string;
	listing_price_ton?: number;
	color: string;
	rarity_score: number;
}

export interface PortfolioAssetItem {
	number: string;
	display_number: string;
	expected_ton: number;
	expected_usd: number;
	rarity_score: number;
	global_rank: number;
	category_club: string;
	color: string;
}

export interface PortfolioScanResult {
	owner_address: string;
	total_assets: number;
	total_value_ton: number;
	total_value_usd: number;
	average_rarity_score: number;
	best_global_rank: number;
	assets: PortfolioAssetItem[];
}

export interface NumbersCollectionOverview {
	total_supply: number;
	floor_price_ton: number;
	floor_price_usd: number;
	volume_24h_ton: number;
	total_volume_ton: number;
	total_owners: number;
	clubs_count?: number;
}

export interface FloorDepthSummary {
	plus_5pct_count: number;
	plus_10pct_count: number;
	plus_25pct_count: number;
	plus_5pct_volume_ton: number;
	plus_10pct_volume_ton: number;
	plus_25pct_volume_ton: number;
}

export interface MarketPulseInfo {
	demand: string;
	supply: string;
	liquidity: string;
	momentum: string;
}

export interface CollectionRiskFlag {
	code: string;
	severity: 'warning' | 'info' | 'alert';
	title: string;
	description: string;
}

export interface NumbersInstitutionalCollectionOverview {
	collection_address: string;
	collection_name: string;
	supply_total: number;
	supply_status: string;
	genesis_supply: number;
	standard_supply: number;
	unique_holders: number;
	floor_ask_ton?: number | null;
	floor_ask_usd?: number | null;
	floor_number?: string | null;
	floor_venue: string;
	floor_depth: FloorDepthSummary;
	median_sale_7d_ton?: number | null;
	median_sale_30d_ton?: number | null;
	sales_count_7d: number;
	sales_count_30d: number;
	volume_24h_ton: number;
	volume_7d_ton: number;
	sales_count_24h: number;
	unique_buyers_7d: number;
	unique_sellers_7d: number;
	active_listings_count: number;
	listed_share_pct: number;
	top10_holder_share_pct: number;
	top50_holder_share_pct: number;
	market_pulse: MarketPulseInfo;
	ton_usd_rate: number;
	data_status: 'verified' | 'stale' | 'partial' | 'unavailable' | string;
	is_live: boolean;
	observed_at: string;
	snapshot_id: string;
	active_sources: string[];
	risk_flags: CollectionRiskFlag[];
	holder_tiers?: HolderTierBreakdown | null;
}

export interface HolderTierBreakdown {
	whale_count: number;
	shark_count: number;
	dolphin_count: number;
	retail_count: number;
}

export interface NumberAlertPreferences {
	pattern_key: string;
	max_price_ton: number;
	alert_on_listing: boolean;
	alert_on_auction_end: boolean;
	alert_on_floor_drop: boolean;
}

export interface NumberCollectionHistoryPoint {
	timestamp: string;
	timeframe: string;
	floor_ton: number;
	floor_usd: number;
	median_sale_ton?: number | null;
	median_sale_usd?: number | null;
	volume_ton: number;
	volume_usd: number;
	sales_count: number;
	unique_buyers: number;
	unique_sellers: number;
	open_ton?: number | null;
	high_ton?: number | null;
	low_ton?: number | null;
	close_ton?: number | null;
	provenance: string;
}

export interface NumberCollectionHistoryResponse {
	schema_version: string;
	timeframe: string;
	points: NumberCollectionHistoryPoint[];
	rate: number;
	data_status: string;
	observed_at: string;
}

export interface NumberMarketListing {
	id: number;
	number: string;
	display_number: string;
	nft_item_address?: string | null;
	venue: string;
	listing_type: string;
	ask_price_nano_ton?: number | null;
	current_bid_nano_ton?: number | null;
	next_min_bid_nano_ton?: number | null;
	bids_count: number;
	pattern_tag?: string | null;
	is_genesis: boolean;
	ends_at?: string | null;
	is_active: boolean;
	observed_at: string;
	source_url?: string | null;
	seller_address?: string | null;
	difference_from_floor_pct: number;
}

export interface NumberPatternAnalytics {
	id: number;
	pattern_key: string;
	pattern_name_en: string;
	pattern_name_fa: string;
	sample_mask: string;
	exact_supply: number;
	supply_share_pct: number;
	active_listings_count: number;
	floor_nano_ton?: number | null;
	median_sale_nano_ton?: number | null;
	p25_sale_nano_ton?: number | null;
	p75_sale_nano_ton?: number | null;
	premium_pct: number;
	sample_size: number;
	confidence_score: number;
	updated_at: string;
}

export interface NFTColorInfo {
	name: string;
	hex: string;
	multiplier: number;
	description: string;
}

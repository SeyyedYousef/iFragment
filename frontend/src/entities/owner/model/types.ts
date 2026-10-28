/**
 * Owner Admin Panel Domain Models
 * Institutional Telegram Asset Valuation Terminal (@Usernames, +888 Numbers, Collectible Gifts)
 */

export interface OwnerAuthResponse {
	mfa_required: boolean;
	temp_token?: string;
	token?: string;
	totp_Setup_required?: boolean;
}

export interface TotpSetupResponse {
	secret: string;
	qr_uri: string;
	recovery_codes: string[];
}

export interface RecentValuationLog {
	id: string;
	asset_type: 'username' | 'number' | 'gift' | 'portfolio';
	query: string;
	display_title: string;
	fair_value_ton: number;
	fair_value_usd: number;
	confidence_score: number;
	credits_spent: number;
	latency_ms: number;
	created_at: string;
}

export interface TopSearchedAsset {
	asset_type: 'username' | 'number' | 'gift';
	query: string;
	display_title: string;
	searches_24h: number;
	fair_value_ton: number;
	fair_value_usd: number;
	status_badge: string;
}

export interface DashboardMetrics {
	total_users: number;
	dau: number;
	mau: number;
	premium_users: number;
	total_intel_credits_circulation: number;
	total_stars_revenue: number;
	ton_usd_rate: number;
	nums888_floor_ton: number;
	tracked_gift_collections: number;
	valuations_today: {
		total: number;
		usernames: number;
		numbers: number;
		gifts: number;
		portfolios: number;
	};
	credits_economy_today: {
		consumed_today: number;
		purchased_today: number;
		promo_claimed_today: number;
		referral_granted_today: number;
	};
	recent_valuations: RecentValuationLog[];
	top_searched_assets: TopSearchedAsset[];
	growth_30d: Array<{
		date: string;
		new_users: number;
		active_users: number;
		valuations_count?: number;
	}>;
}

export interface SearchedUser {
	telegram_id: number;
	username?: string;
	first_name: string;
	last_name?: string;
	intel_credits: number;
	total_valuations_run?: number;
	last_searched_asset?: string;
	is_premium: boolean;
	is_banned: boolean;
	ban_type?: 'none' | 'shadow' | 'full';
	ban_reason?: string;
	is_flagged: boolean;
	created_at: string;
	last_active_at?: string;
}

export interface UserSearchResponse {
	users: SearchedUser[];
	total: number;
}

export interface AuditLogEntry {
	id: string | number;
	owner_id: number;
	action: string;
	target_user_id?: number;
	target_id?: string;
	payload?: Record<string, unknown>;
	ip_address?: string;
	user_agent?: string;
	created_at: string;
}

export interface ManagedUserbot {
	id: string;
	phone_number: string;
	account_name?: string;
	telegram_uid?: number;
	dc_id: number;
	mtproto_layer: number;
	status: 'active' | 'connected' | 'flood_wait' | 'expired' | 'revoked';
	ping_ms: number;
	requests_24h: number;
	flood_wait_seconds: number;
	capabilities: string[];
	last_active_at: string;
	created_at: string;
}

export interface SystemSettings {
	version: number;
	maintenance_mode: boolean;
	// Intel Credit & Paywall Pricing
	free_daily_quota: number;
	signup_bonus_credits: number;
	referral_bonus_credits: number;
	referral_rev_share_pct: number;
	cost_username_report: number;
	cost_number_report: number;
	cost_gift_report: number;
	cost_portfolio_scan: number;
	// Valuation Engine Calibration
	ton_usd_override: number;
	gift_floor_strictness: number;
	vanity_ask_multiplier_threshold: number;
	enable_live_fragment_Verify: boolean;
	enable_live_tonapi_boc: boolean;
	investors_page_image_url?: string;
	updated_at?: string;
}

export interface PromoCode {
	code: string;
	credit_amount: number;
	grant_vip_days?: number;
	note?: string;
	max_uses: number;
	uses_count: number;
	expires_at?: string;
	is_active: boolean;
	created_at: string;
}

export interface BroadcastMessage {
	id: string;
	target_audience: 'all' | 'premium' | 'active_7d' | 'zero_credits';
	message: string;
	message_text?: string;
	cta_label?: string;
	cta_url?: string;
	status: 'queued' | 'sending' | 'paused' | 'completed' | 'failed';
	total_count: number;
	sent_count: number;
	failed_count: number;
	scheduled_at?: string;
	created_at: string;
}

export interface FinanceSummary {
	total_revenue_stars: number;
	revenue_7d: number;
	revenue_30d: number;
	active_subscriptions: number;
	churn_rate: number;
	total_credits_sold?: number;
	avg_order_stars?: number;
}

export interface FinanceOrder {
	id: string;
	user_id: number;
	username?: string;
	amount: number;
	amount_stars?: number;
	credits_granted?: number;
	currency: string;
	status: 'paid' | 'pending' | 'failed' | 'refunded';
	payload: string;
	created_at: string;
}

export interface SystemHealthMetrics {
	status: string;
	db_status: string;
	db_latency_ms: number;
	redis_status: string;
	cache_hit_rate_pct?: number;
	cached_valuations_count?: number;
	active_goroutines: number;
	memory_used_mb: number;
	cpu_usage_percent: number;
	uptime_seconds: number;
	ton_usd_live?: number;
	timestamp: string;
}

export interface ExternalProviderHealth {
	id: string;
	name: string;
	category: 'ton' | 'gifts' | 'market' | 'telegram' | 'macro';
	endpoint?: string;
	status: 'healthy' | 'degraded' | 'down';
	latency_ms: number;
	http_status: number;
	live_metric?: string;
	error?: string;
	checked_at: string;
}

export interface SystemErrorLog {
	id: string | number;
	source: string;
	level: string;
	error_message: string;
	stack_trace?: string;
	created_at: string;
}

export interface AdCampaign {
	id: string;
	slot: 'dashboard_banner' | 'interstitial' | string;
	title: string;
	image_url: string;
	target_url: string;
	priority: number;
	is_active: boolean;
	impressions_count: number;
	clicks_count: number;
	start_at?: string;
	end_at?: string;
	created_at: string;
}

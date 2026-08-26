export interface SearchedUser {
	telegram_id: number;
	username: string;
	first_name: string;
	last_name: string;
	language_code: string;
	created_at: string;
	balance: number;
	is_premium: boolean;
	is_flagged: boolean;
	fraud_reason?: string;
	is_banned?: boolean;
	ban_type?: string;
	ban_reason?: string;
	ban_expires_at?: string;
}

export interface AuditLogEntry {
	id: string | number;
	owner_id: number;
	action: string;
	target_user_id?: number;
	target_id?: string | number;
	payload?: Record<string, any>;
	ip_address?: string;
	user_agent?: string;
	created_at: string;
}

export interface QuestItem {
	key: string;
	title: string;
	type:
		| 'telegram_channel'
		| 'telegram_group'
		| 'daily_checkin'
		| 'invite'
		| 'external_link'
		| 'partner';
	reward_frg: number; // mapped to Coins in UI
	reward_xp: number;
	is_active: boolean;
	config?: Record<string, any>;
	expires_at?: string;
	parent_key?: string;
	created_at?: string;
}

export interface AdminDailyCombo {
	id?: number;
	date: string;
	word: string;
	reward: number;
	active_date?: string;
	secret_word?: string;
	reward_amount?: number;
}

export interface ManagedUserbot {
	id: string;
	phone_number: string;
	status: 'active' | 'connected' | 'connecting' | 'expired' | 'error';
	channels_count: number;
	created_at: string;
	updated_at: string;
}

export interface SystemSettings {
	maintenance_mode: boolean;
	tap_multiplier: number;
	referral_bonus: number;
	daily_reward_base: number;
	fatigue_threshold_1?: number;
	fatigue_threshold_2?: number;
	fatigue_threshold_3?: number;
	tap_bot_cap_seconds?: number;
	referral_rev_share_pct?: number;
	coin_decay_pct?: number;
	coin_expiry_days?: number;
	turbo_duration_seconds?: number;
	inflation_cap?: number;
	dashboard_ads?: DashboardAd[];
	version: number;
}

export interface DashboardAd {
	id: string;
	slot?: string;
	title: string;
	alt_text?: string;
	image_url: string;
	target_url?: string;
	target?: string;
	is_active: boolean;
	priority?: number;
	start_date?: string;
	end_date?: string;
}

export interface AdCampaign {
	id: string;
	slot: string;
	title: string;
	alt_text: string;
	image_url: string;
	target_url: string;
	is_active: boolean;
	priority: number;
	start_date?: string;
	end_date?: string;
	impressions_count: number;
	clicks_count: number;
	created_at: string;
	updated_at: string;
}

export interface PromoCode {
	id?: string | number;
	code: string;
	reward_amount: number;
	reward_frg?: number;
	max_uses: number;
	uses_count?: number;
	current_uses?: number;
	expires_at?: string;
	created_at: string;
}

export interface BroadcastMessage {
	id: string;
	owner_id?: number;
	target_audience: 'all' | 'premium' | 'active_7d' | 'inactive';
	message: string;
	message_text?: string;
	status: 'draft' | 'scheduled' | 'pending' | 'sending' | 'completed' | 'failed' | 'paused';
	scheduled_at?: string;
	sent_count: number;
	total_count: number;
	failed_count?: number;
	started_at?: string;
	completed_at?: string;
	created_at: string;
}

export interface FinanceOrder {
	id: string;
	user_id: number;
	username?: string;
	amount: number;
	amount_stars?: number;
	status: 'paid' | 'pending' | 'failed' | 'refunded';
	payload: string;
	created_at: string;
}

export interface FinanceSummary {
	total_revenue_stars: number;
	revenue_7d: number;
	revenue_30d: number;
	total_orders: number;
	active_subscriptions: number;
	churn_rate: number;
}

export interface SystemHealthMetrics {
	db_status: 'ok' | 'degraded' | 'down';
	db_latency_ms: number;
	redis_status: 'ok' | 'down';
	active_goroutines: number;
	memory_used_mb: number;
	allocated_mb?: number;
	total_sys_mb?: number;
	cpu_usage_percent?: number;
	uptime_seconds: number;
	recent_errors_count: number;
}

export interface SystemErrorLog {
	id: string;
	source: string;
	error_message: string;
	level?: string;
	created_at: string;
}

export interface OwnerEntityItem {
	id: string;
	entity_type: 'channel' | 'group';
	entity_id: string;
	title: string;
	status: string;
	owner_id: number;
	owner_username?: string;
	credit_balance: number;
	paid_until?: string;
}

export interface ChartPoint {
	date: string;
	value: number;
}

export interface TodayEconomy {
	minted_today: number;
	burned_today: number;
	decayed_today: number;
	rev_share_paid_today: number;
}

export interface OwnerDashboardStats {
	dau: number;
	mau: number;
	total_users: number;
	frg_circulation: number;
	coins_circulation: number;
	stars_volume: number;
	dau_trend: number;
	mau_trend: number;
	revenue_trend: number;
	circulation_trend: number;
	today_economy: TodayEconomy;
	totp_enabled: boolean;
	totp_grace_days_left: number;
	recent_activity: AuditLogEntry[];
	dau_chart: ChartPoint[];
	coin_flow_chart: ChartPoint[];
	recent_signups?: SearchedUser[];
}

export interface AuthLoginResponse {
	token?: string;
	mfa_required: boolean;
	temp_token?: string;
	totp_enabled: boolean;
	grace_days_left?: number;
}

export interface TotpSetupResponse {
	secret: string;
	provisioning_uri: string;
	recovery_codes: string[];
}

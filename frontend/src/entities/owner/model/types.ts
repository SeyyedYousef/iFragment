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
	fraud_reason: string;
	is_banned?: boolean;
	ban_type?: string;
	ban_reason?: string;
	ban_expires_at?: string;
}

export interface AuditLogEntry {
	id: string | number;
	owner_id: number;
	target_type?: string;
	target_id?: string | number;
	action: string;
	ip_address?: string;
	user_agent?: string;
	payload?: Record<string, any>;
	created_at: string;
}

export interface QuestItem {
	id: string | number;
	key?: string;
	title: string;
	description: string;
	reward_frg: number;
	reward_xp: number;
	type:
		| 'telegram_channel'
		| 'telegram_group'
		| 'daily_checkin'
		| 'invite'
		| 'external_link'
		| 'partner';
	is_active: boolean;
	config?: Record<string, any>;
	expires_at?: string;
	parent_id?: string | number;
	created_at?: string;
}

export interface AdminDailyCombo {
	id: number;
	active_date: string;
	secret_word: string;
	reward_amount: number;
	created_by?: string;
}

export interface ManagedUserbot {
	id: string;
	phone_number: string;
	status: 'connected' | 'connecting' | 'expired' | 'error';
	channels_count: number;
	created_at: string;
	updated_at: string;
}

export interface SystemSettings {
	maintenance_mode: boolean;
	tap_multiplier: number;
	referral_bonus: number;
	daily_reward_base: number;
	dashboard_ads?: DashboardAd[];
}

export interface DashboardAd {
	id: string;
	title: string;
	image_url: string;
	target: string;
	is_active: boolean;
	start_date?: string;
	end_date?: string;
}

export interface PromoCode {
	id: string | number;
	code: string;
	reward_frg: number;
	max_uses: number;
	current_uses: number;
	expires_at: string;
	is_active: boolean;
	created_at: string;
}

export interface BroadcastMessage {
	id: string | number;
	target_audience: 'all' | 'premium' | 'active_7d' | 'inactive';
	message_text: string;
	status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
	scheduled_at?: string;
	sent_count: number;
	total_count: number;
	created_at: string;
}

export interface FinanceOrder {
	id: string;
	user_id: number;
	username?: string;
	amount_stars: number;
	status: 'paid' | 'pending' | 'failed' | 'refunded';
	item_type: string;
	created_at: string;
}

export interface SystemHealthMetrics {
	db_status: 'ok' | 'degraded' | 'down';
	db_latency_ms: number;
	redis_status: 'ok' | 'down';
	active_goroutines: number;
	memory_used_mb: number;
	uptime_seconds: number;
	recent_errors_count: number;
}

export interface OwnerEntityItem {
	id: string | number;
	type: 'channel' | 'group';
	title: string;
	username?: string;
	telegram_id: number;
	owner_id: number;
	owner_username?: string;
	credit_balance: number;
	status: 'active' | 'suspended' | 'expired';
	created_at: string;
}

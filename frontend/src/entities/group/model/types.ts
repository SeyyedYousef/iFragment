export interface ManagedGroup {
	id: string;
	bot_id: string;
	chat_id: number;
	chat_title: string;
	chat_type: 'group' | 'supergroup' | 'channel';
	members_count: number;
	photo_url?: string;
	subscription_status: 'trial' | 'paid' | 'expired' | 'cancelled';
	trial_ends_at: string;
	paid_until?: string;
	created_at: string;
	updated_at: string;
}

export interface GroupSettings {
	group_id: string;
	general: Partial<{
		language: string;
		timezone: string;
		link_protection: boolean;
		welcome_message: boolean;
	}>;
	content_restrictions: Record<string, any>;
	limits: Partial<{
		minMessageLength: number;
		maxMessageLength: number;
		floodMessages: number;
		floodWindow: number;
		duplicateCount: number;
		duplicateWindow: number;
	}>;
	quiet_hours: Partial<{
		emergencyLock: boolean;
		adminOverride: boolean;
		sendNotifications: boolean;
		periods: Array<{ id: string; start: string; end: string }>;
	}>;
	mandatory_membership: Record<string, any>;
	custom_texts: Record<string, any>;
	version: number;
	updated_at: string;
	updated_by?: number;
}

export interface TopUser {
	user_id: number;
	name: string;
	msgs: number;
}

export interface AnalyticsSummary {
	total_members: number;
	members_change: number;
	total_messages: number;
	messages_change_pct: number;
	spam_blocked: number;
	new_members: number;
	members_left: number;
	active_users: number;
	top_users?: TopUser[];
}

export interface DailyMetric {
	date: string;
	value: number;
}

export interface AnalyticsData {
	summary: AnalyticsSummary;
	growth: DailyMetric[];
	activity: DailyMetric[];
}

export interface AuditLog {
	id: string;
	group_id: string;
	actor_id: number;
	action: string;
	target_type?: string;
	target_id?: string;
	old_value?: Record<string, unknown>;
	new_value?: Record<string, unknown>;
	metadata?: Record<string, unknown>;
	created_at: string;
}

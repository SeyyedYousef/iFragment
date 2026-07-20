import { apiClient } from './axios.js';

/* ==========================================================================
   Type Definitions for Owner Domain Entities
   ========================================================================== */

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
	title: string;
	description: string;
	reward_frg: number;
	reward_xp: number;
	type: 'telegram_channel' | 'telegram_group' | 'daily_checkin' | 'invite' | 'external_link' | 'partner';
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

/* ==========================================================================
   Unified Typed Owner API Client
   ========================================================================== */

export const ownerApi = {
	// --- Users ---
	searchUsers: (query: string) =>
		apiClient.get<SearchedUser[]>(`/owner/users/search?q=${encodeURIComponent(query)}`).then((r) => r.data),

	adjustFrg: (userId: number, amount: number, reason: string) =>
		apiClient
			.post<{ success: boolean; new_balance: number }>('/owner/users/adjust-frg', {
				user_id: userId,
				amount,
				reason,
			})
			.then((r) => r.data),

	banUser: (userId: number, banType: string, reason: string, durationSeconds: number) =>
		apiClient
			.post<{ success: boolean }>('/owner/users/ban', {
				user_id: userId,
				ban_type: banType,
				reason,
				duration_seconds: durationSeconds,
			})
			.then((r) => r.data),

	unbanUser: (userId: number) =>
		apiClient.post<{ success: boolean }>('/owner/users/unban', { user_id: userId }).then((r) => r.data),

	flagUser: (userId: number, isFlagged: boolean, fraudReason: string) =>
		apiClient
			.post<{ success: boolean }>('/owner/users/flag', {
				user_id: userId,
				is_flagged: isFlagged,
				fraud_reason: fraudReason,
			})
			.then((r) => r.data),

	impersonateUser: (userId: number) =>
		apiClient.post<{ token: string }>('/owner/users/impersonate', { user_id: userId }).then((r) => r.data),

	// --- Audit Logs ---
	getAuditLogs: (limit = 20, offset = 0) =>
		apiClient
			.get<{ logs: AuditLogEntry[]; has_more: boolean }>(`/owner/audit-logs?limit=${limit}&offset=${offset}`)
			.then((r) => r.data),

	// --- Quests ---
	listQuests: () => apiClient.get<QuestItem[]>('/owner/quests').then((r) => r.data),
	createQuest: (quest: Partial<QuestItem>) => apiClient.post<QuestItem>('/owner/quests', quest).then((r) => r.data),
	updateQuest: (id: string | number, quest: Partial<QuestItem>) =>
		apiClient.put<QuestItem>(`/owner/quests/${id}`, quest).then((r) => r.data),
	deleteQuest: (id: string | number) => apiClient.delete(`/owner/quests/${id}`).then((r) => r.data),

	// --- Daily Combos ---
	listCombos: () => apiClient.get<AdminDailyCombo[]>('/owner/combos').then((r) => r.data),
	createCombo: (date: string, word: string, reward: number) =>
		apiClient
			.post<AdminDailyCombo>('/owner/combos', { date, secret_word: word, reward_amount: reward })
			.then((r) => r.data),
	deleteCombo: (id: number) => apiClient.delete(`/owner/combos/${id}`).then((r) => r.data),

	// --- Userbots ---
	listUserbots: () => apiClient.get<ManagedUserbot[]>('/owner/userbots').then((r) => r.data),
	sendUserbotCode: (phone: string) =>
		apiClient.post<{ phone_code_hash: string }>('/owner/userbot/send-code', { phone }).then((r) => r.data),
	verifyUserbotCode: (phone: string, code: string, phoneCodeHash: string, password_2fa?: string) =>
		apiClient
			.post('/owner/userbot/verify-code', { phone, code, phone_code_hash: phoneCodeHash, password_2fa })
			.then((r) => r.data),
	deleteUserbot: (id: string) => apiClient.delete(`/owner/userbots/${id}`).then((r) => r.data),

	// --- System Settings & Ads (Decoupled Payload Safety) ---
	getSettings: () => apiClient.get<SystemSettings>('/owner/settings').then((r) => r.data),
	updateSettings: (settingsPayload: SystemSettings) =>
		apiClient.put<SystemSettings>('/owner/settings', settingsPayload).then((r) => r.data),
	getAds: async (): Promise<DashboardAd[]> => {
		const res = await apiClient.get<SystemSettings>('/owner/settings');
		return res.data?.dashboard_ads || [];
	},
	updateAds: async (ads: DashboardAd[]) => {
		const current = await apiClient.get<SystemSettings>('/owner/settings');
		return (
			await apiClient.put<SystemSettings>('/owner/settings', {
				...current.data,
				dashboard_ads: ads,
			})
		).data;
	},

	// --- Promos ---
	listPromos: () => apiClient.get<PromoCode[]>('/owner/promos').then((r) => r.data),
	createPromo: (code: string, reward: number, maxUses: number, expiryDate: string) =>
		apiClient
			.post<PromoCode>('/owner/promos', {
				code,
				reward_frg: reward,
				max_uses: maxUses,
				expires_at: expiryDate,
			})
			.then((r) => r.data),
	deletePromo: (id: string | number) => apiClient.delete(`/owner/promos/${id}`).then((r) => r.data),

	// --- Broadcast ---
	listBroadcasts: () =>
		apiClient
			.get<BroadcastMessage[]>('/owner/broadcast')
			.then((r) => r.data)
			.catch(() => []),
	sendBroadcast: (audience: string, text: string, scheduledAt?: string) =>
		apiClient
			.post<{ success: boolean; id: string | number }>('/owner/broadcast', {
				target_audience: audience,
				message_text: text,
				scheduled_at: scheduledAt,
			})
			.then((r) => r.data),

	// --- Finance ---
	getFinanceOrders: () => apiClient.get<FinanceOrder[]>('/owner/finance/orders').then((r) => r.data),

	// --- Health ---
	getHealthMetrics: () => apiClient.get<SystemHealthMetrics>('/owner/health/metrics').then((r) => r.data),
	getHealthLogs: () =>
		apiClient
			.get<any[]>('/owner/health/errors')
			.then((r) => (Array.isArray(r.data) ? r.data.map((e) => `[${e.source || 'SYS'}] ${e.error_message || ''}`) : []))
			.catch(() => []),

	// --- Entities ---
	listEntities: async (): Promise<OwnerEntityItem[]> => {
		const [channelsRes, groupsRes] = await Promise.all([
			apiClient.get<any[]>('/owner/entities/channels').catch(() => ({ data: [] })),
			apiClient.get<any[]>('/owner/entities/groups').catch(() => ({ data: [] })),
		]);
		const channels = (channelsRes.data || []).map((c: any) => ({ ...c, type: 'channel' as const }));
		const groups = (groupsRes.data || []).map((g: any) => ({ ...g, type: 'group' as const }));
		return [...channels, ...groups];
	},
	addEntityCredit: (id: string | number, amount: number, _reason: string) =>
		apiClient
			.post<{ success: boolean }>('/owner/entities/add-credit', {
				entity_id: String(id),
				days: amount,
			})
			.then((r) => r.data),
};

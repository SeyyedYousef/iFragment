import { apiClient } from './axios.js';

// ─── Types ────────────────────────────────────────────────

export interface ManagedBot {
	id: string;
	owner_user_id: number;
	bot_username: string;
	bot_name: string;
	bot_id: number;
	status: 'active' | 'inactive' | 'revoked';
	managed_groups_count?: number;
	subscription_status?: string;
	created_at: string;
	updated_at: string;
}

export interface ManagedGroup {
	id: string;
	bot_id: string;
	chat_id: number;
	chat_title: string;
	chat_type: 'group' | 'supergroup' | 'channel';
	members_count: number;
	subscription_status: 'trial' | 'paid' | 'expired' | 'cancelled';
	trial_ends_at: string;
	paid_until?: string;
	created_at: string;
	updated_at: string;
}

interface GroupSettings {
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

export interface SubscriptionPackage {
	id: string;
	name: string;
	groups_limit: number;
	price_frg: number;
	discount?: string;
}

interface FRGBalance {
	user_id: number;
	balance: number;
	total_earned: number;
	total_spent: number;
	updated_at: string;
}

export interface FRGTransaction {
	id: string;
	user_id: number;
	type: string;
	amount: number;
	balance_before: number;
	balance_after: number;
	metadata?: Record<string, unknown>;
	created_at: string;
}

export interface PurchaseOption {
	id: string;
	method: 'stars' | 'toncoin';
	frg_amount: number;
	price: number;
	currency: string;
	discount?: string;
	popular?: boolean;
}

interface TopUser {
	user_id: number;
	name: string;
	msgs: number;
}

interface AnalyticsSummary {
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

interface AnalyticsData {
	summary: AnalyticsSummary;
	growth: DailyMetric[];
	activity: DailyMetric[];
}

interface AuditLog {
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

// ─── Bot API ──────────────────────────────────────────────

export const botApi = {
	listBots: () => apiClient.get<ManagedBot[]>('/bots').then((r: any) => r.data),

	registerBot: (data: { token: string; username: string; name: string; bot_id: number }) =>
		apiClient.post<ManagedBot>('/bots', data).then((r: any) => r.data),

	getBot: (botId: string) => apiClient.get<ManagedBot>(`/bots/${botId}`).then((r: any) => r.data),

	revokeBot: (botId: string) => apiClient.delete(`/bots/${botId}`).then((r: any) => r.data),

	listGroups: (botId: string) =>
		apiClient.get<ManagedGroup[]>(`/bots/${botId}/groups`).then((r: any) => r.data),
};

// ─── Group API ────────────────────────────────────────────

export const groupApi = {
	getGroup: (groupId: string) =>
		apiClient.get<ManagedGroup>(`/groups/${groupId}`).then((r: any) => r.data),

	getSettings: (groupId: string) =>
		apiClient.get<GroupSettings>(`/groups/${groupId}/settings`).then((r: any) => r.data),

	updateSettings: (groupId: string, category: string, data: unknown, version: number) =>
		apiClient
			.put<GroupSettings>(`/groups/${groupId}/settings`, { category, data, version })
			.then((r: any) => r.data),

	getAnalytics: (groupId: string, days: number = 7) =>
		apiClient
			.get<AnalyticsData>(`/groups/${groupId}/analytics`, { params: { days } })
			.then((r: any) => r.data),

	getAuditLogs: (groupId: string, limit = 50, offset = 0) =>
		apiClient
			.get<AuditLog[]>(`/groups/${groupId}/audit`, { params: { limit, offset } })
			.then((r: any) => r.data),
};

// ─── Subscription API ─────────────────────────────────────

export const subscriptionApi = {
	getPackages: () =>
		apiClient.get<SubscriptionPackage[]>('/subscription/packages').then((r: any) => r.data),

	subscribe: (groupId: string, packageId: string) =>
		apiClient
			.post('/subscription/subscribe', { group_id: groupId, package_id: packageId })
			.then((r: any) => r.data),

	subscribeWithAirdrop: (groupId: string, packageId: string) =>
		apiClient
			.post('/subscription/subscribe-airdrop', { group_id: groupId, package_id: packageId })
			.then((r: any) => r.data),

	createSubscriptionStarsInvoice: (groupId: string, packageId: string) =>
		apiClient
			.post('/subscription/subscribe-stars-invoice', { group_id: groupId, package_id: packageId })
			.then((r: any) => r.data),

	subscribeChannel: (channelId: string, packageId: string) =>
		apiClient
			.post('/subscription/channel/subscribe', { channel_id: channelId, package_id: packageId })
			.then((r: any) => r.data),

	subscribeChannelWithAirdrop: (channelId: string, packageId: string) =>
		apiClient
			.post('/subscription/channel/subscribe-airdrop', { channel_id: channelId, package_id: packageId })
			.then((r: any) => r.data),

	createChannelSubscriptionStarsInvoice: (channelId: string, packageId: string) =>
		apiClient
			.post('/subscription/channel/subscribe-stars-invoice', { channel_id: channelId, package_id: packageId })
			.then((r: any) => r.data),
};

// ─── FRG Token API ────────────────────────────────────────

export const frgApi = {
	getBalance: () => apiClient.get<FRGBalance>('/frg/balance').then((r: any) => r.data),

	getTransactions: (limit = 20, offset = 0) =>
		apiClient
			.get<FRGTransaction[]>('/frg/transactions', { params: { limit, offset } })
			.then((r: any) => r.data),
};

export interface Clan {
	id: string;
	telegram_channel_id: number;
	channel_username: string;
	channel_photo?: string;
	chat_title: string;
	members_count: number;
	created_at: string;
}

export interface UserClanDetails {
	clan?: Clan;
	is_member: boolean;
	joined_at?: string;
}

export const clanApi = {
	getClan: () => apiClient.get<UserClanDetails>('/profile/clan').then((r: any) => r.data),
	joinClan: (username: string) =>
		apiClient.post<Clan>('/profile/clan/join', { username }).then((r: any) => r.data),
	leaveClan: () => apiClient.post('/profile/clan/leave').then((r: any) => r.data),
	getTopClans: () => apiClient.get<Clan[]>('/profile/clan/top').then((r: any) => r.data),
};

export const marketplaceApi = {
	getOptions: () =>
		apiClient.get<PurchaseOption[]>('/marketplace/options').then((r: any) => r.data),

	createStarsInvoice: (optionId: string) =>
		apiClient
			.post<{ invoice_link: string }>('/marketplace/purchase/stars/invoice', {
				option_id: optionId,
			})
			.then((r: any) => r.data),

	purchaseWithStars: (optionId: string, telegramChargeId: string) =>
		apiClient
			.post<FRGTransaction>('/marketplace/purchase/stars', {
				option_id: optionId,
				telegram_charge_id: telegramChargeId,
			})
			.then((r: any) => r.data),

	purchaseWithToncoin: (optionId: string, txHash: string) =>
		apiClient
			.post<FRGTransaction>('/marketplace/purchase/toncoin', {
				option_id: optionId,
				tx_hash: txHash,
			})
			.then((r: any) => r.data),

	convertAirdropCoins: (coins: number) =>
		apiClient
			.post<FRGTransaction>('/marketplace/convert/airdrop', { coins })
			.then((r: any) => r.data),
};

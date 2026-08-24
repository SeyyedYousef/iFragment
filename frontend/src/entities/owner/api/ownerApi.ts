import axios from 'axios';
import type {
	AdminDailyCombo,
	AuditLogEntry,
	AuthLoginResponse,
	BroadcastMessage,
	FinanceOrder,
	FinanceSummary,
	ManagedUserbot,
	OwnerDashboardStats,
	OwnerEntityItem,
	PromoCode,
	QuestItem,
	SearchedUser,
	SystemErrorLog,
	SystemHealthMetrics,
	SystemSettings,
	TotpSetupResponse,
	AdCampaign,
} from '../model/types';

const api = axios.create({
	baseURL: '/api/v1/owner',
	headers: {
		'Content-Type': 'application/json',
	},
});

api.interceptors.request.use((config) => {
	const token = localStorage.getItem('owner_token');
	if (token) {
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
});

export const ownerApi = {
	// ─── Authentication & MFA ───────────────────────────────────────────────────
	login: async (password: string, telegramUserId: number): Promise<AuthLoginResponse> => {
		const res = await api.post<AuthLoginResponse>('/auth/login', {
			password,
			telegram_user_id: telegramUserId,
		});
		return res.data;
	},

	verifyTotp: async (tempToken: string, code: string): Promise<{ token: string }> => {
		const res = await api.post<{ token: string }>('/auth/totp/verify', {
			temp_token: tempToken,
			code,
		});
		return res.data;
	},

	setupTotp: async (): Promise<TotpSetupResponse> => {
		const res = await api.post<TotpSetupResponse>('/auth/totp/setup');
		return res.data;
	},

	verifyTotpSetup: async (code: string): Promise<{ success: boolean }> => {
		const res = await api.post<{ success: boolean }>('/auth/totp/verify-setup', { code });
		return res.data;
	},

	disableTotp: async (code: string): Promise<{ success: boolean }> => {
		const res = await api.post<{ success: boolean }>('/auth/totp/disable', { code });
		return res.data;
	},

	// ─── Dashboard Stats & Audit Logs ───────────────────────────────────────────
	getDashboardStats: async (): Promise<OwnerDashboardStats> => {
		const res = await api.get<OwnerDashboardStats>('/dashboard/stats');
		return res.data;
	},

	getAuditLogs: async (params?: {
		limit?: number;
		offset?: number;
		action?: string;
		search?: string;
	}): Promise<{ logs: AuditLogEntry[]; total: number }> => {
		const res = await api.get<{ logs: AuditLogEntry[]; total: number }>('/audit-logs', {
			params,
		});
		return res.data;
	},

	// ─── Users ──────────────────────────────────────────────────────────────────
	searchUsers: async (params?: {
		q?: string;
		limit?: number;
		offset?: number;
		filter?: string;
	}): Promise<{ users: SearchedUser[]; total: number }> => {
		const res = await api.get<{ users: SearchedUser[]; total: number }>('/users/search', {
			params,
		});
		return res.data;
	},

	impersonateUser: async (targetUserId: number): Promise<{ token: string }> => {
		const res = await api.post<{ token: string }>('/users/impersonate', {
			target_user_id: targetUserId,
		});
		return res.data;
	},

	endImpersonation: async (sessionId: string, actionsTaken: string[] = []): Promise<{ success: boolean }> => {
		const res = await api.post<{ success: boolean }>('/users/impersonate/end', {
			session_id: sessionId,
			actions_taken: actionsTaken,
		});
		return res.data;
	},

	banUser: async (
		targetUserId: number,
		banType: string,
		reason: string,
		durationSeconds: number = 0
	): Promise<{ success: boolean }> => {
		const res = await api.post<{ success: boolean }>('/users/ban', {
			target_user_id: targetUserId,
			ban_type: banType,
			reason,
			duration_seconds: durationSeconds,
		});
		return res.data;
	},

	unbanUser: async (targetUserId: number): Promise<{ success: boolean }> => {
		const res = await api.post<{ success: boolean }>('/users/unban', {
			target_user_id: targetUserId,
		});
		return res.data;
	},

	flagUser: async (
		targetUserId: number,
		isFlagged: boolean,
		reason: string
	): Promise<{ success: boolean }> => {
		const res = await api.post<{ success: boolean }>('/users/flag', {
			target_user_id: targetUserId,
			is_flagged: isFlagged,
			reason,
		});
		return res.data;
	},

	adjustCoins: async (
		userId: number,
		amount: number,
		reason: string
	): Promise<{ success: boolean; new_balance: number }> => {
		const res = await api.post<{ success: boolean; new_balance: number }>('/users/adjust-balance', {
			user_id: userId,
			amount,
			reason,
		});
		return res.data;
	},

	// ─── Broadcasts ─────────────────────────────────────────────────────────────
	listBroadcasts: async (): Promise<BroadcastMessage[]> => {
		const res = await api.get<BroadcastMessage[]>('/broadcasts');
		return res.data;
	},

	createBroadcast: async (data: {
		target_audience: string;
		message: string;
		scheduled_at?: string;
	}): Promise<{ id: string }> => {
		const res = await api.post<{ id: string }>('/broadcasts', data);
		return res.data;
	},

	getAudienceCount: async (audience: string): Promise<{ audience: string; count: number }> => {
		const res = await api.get<{ audience: string; count: number }>('/broadcasts/audience-count', {
			params: { audience },
		});
		return res.data;
	},

	pauseBroadcast: async (id: string): Promise<{ success: boolean }> => {
		const res = await api.post<{ success: boolean }>(`/broadcasts/${id}/pause`);
		return res.data;
	},

	resumeBroadcast: async (id: string): Promise<{ success: boolean }> => {
		const res = await api.post<{ success: boolean }>(`/broadcasts/${id}/resume`);
		return res.data;
	},

	// ─── Entities (Channels & Groups) ───────────────────────────────────────────
	getAllChannels: async (limit = 50, offset = 0): Promise<OwnerEntityItem[]> => {
		const res = await api.get<OwnerEntityItem[]>('/entities/channels', {
			params: { limit, offset },
		});
		return res.data;
	},

	getAllGroups: async (limit = 50, offset = 0): Promise<OwnerEntityItem[]> => {
		const res = await api.get<OwnerEntityItem[]>('/entities/groups', {
			params: { limit, offset },
		});
		return res.data;
	},

	extendSubscription: async (
		entityType: 'channel' | 'group',
		entityId: string,
		days: number,
		reason: string
	): Promise<{ success: boolean; new_until: string }> => {
		const res = await api.post<{ success: boolean; new_until: string }>('/entities/extend-subscription', {
			entity_type: entityType,
			entity_id: entityId,
			days,
			reason,
		});
		return res.data;
	},

	grantEntityCoins: async (
		entityType: 'channel' | 'group',
		entityId: string,
		coins: number,
		reason: string
	): Promise<{ success: boolean; new_balance: number }> => {
		const res = await api.post<{ success: boolean; new_balance: number }>('/entities/grant-coins', {
			entity_type: entityType,
			entity_id: entityId,
			coins,
			reason,
		});
		return res.data;
	},

	// ─── Finance ────────────────────────────────────────────────────────────────
	getFinanceSummary: async (): Promise<FinanceSummary> => {
		const res = await api.get<FinanceSummary>('/finance/summary');
		return res.data;
	},

	getFinanceOrders: async (limit = 50, offset = 0): Promise<FinanceOrder[]> => {
		const res = await api.get<FinanceOrder[]>('/finance/orders', {
			params: { limit, offset },
		});
		return res.data;
	},

	getPremiumEntities: async (): Promise<any[]> => {
		const res = await api.get<any[]>('/finance/subscriptions');
		return res.data;
	},

	// ─── Ads & Media Pipeline ───────────────────────────────────────────────────
	uploadAdImage: async (file: File | Blob, slot = 'dashboard_banner'): Promise<{ url: string; width: number; height: number; size_bytes: number }> => {
		const formData = new FormData();
		formData.append('image', file);
		formData.append('slot', slot);

		const res = await api.post<{ url: string; width: number; height: number; size_bytes: number }>(
			'/ads/upload',
			formData,
			{
				headers: {
					'Content-Type': 'multipart/form-data',
				},
			}
		);
		return res.data;
	},

	listAdCampaigns: async (slot?: string): Promise<AdCampaign[]> => {
		const res = await api.get<AdCampaign[]>('/ads', {
			params: { slot },
		});
		return res.data;
	},

	createAdCampaign: async (ad: Partial<AdCampaign>): Promise<AdCampaign> => {
		const res = await api.post<AdCampaign>('/ads', ad);
		return res.data;
	},

	updateAdCampaign: async (id: string, ad: Partial<AdCampaign>): Promise<AdCampaign> => {
		const res = await api.put<AdCampaign>(`/ads/${id}`, ad);
		return res.data;
	},

	deleteAdCampaign: async (id: string): Promise<{ success: boolean }> => {
		const res = await api.delete<{ success: boolean }>(`/ads/${id}`);
		return res.data;
	},

	// ─── Quests ─────────────────────────────────────────────────────────────────
	listQuests: async (): Promise<QuestItem[]> => {
		const res = await api.get<QuestItem[]>('/quests');
		return res.data;
	},

	createQuest: async (quest: Partial<QuestItem>): Promise<{ success: boolean }> => {
		const res = await api.post<{ success: boolean }>('/quests', quest);
		return res.data;
	},

	updateQuest: async (key: string, quest: Partial<QuestItem>): Promise<{ success: boolean }> => {
		const res = await api.put<{ success: boolean }>(`/quests/${key}`, quest);
		return res.data;
	},

	deleteQuest: async (key: string): Promise<{ success: boolean }> => {
		const res = await api.delete<{ success: boolean }>(`/quests/${key}`);
		return res.data;
	},

	// ─── Combos ─────────────────────────────────────────────────────────────────
	listCombos: async (): Promise<AdminDailyCombo[]> => {
		const res = await api.get<AdminDailyCombo[]>('/combos');
		return res.data;
	},

	upsertCombo: async (date: string, word: string, reward: number): Promise<{ success: boolean }> => {
		const res = await api.post<{ success: boolean }>('/combos', {
			date,
			word,
			reward,
		});
		return res.data;
	},

	// ─── Promos ─────────────────────────────────────────────────────────────────
	listPromos: async (): Promise<PromoCode[]> => {
		const res = await api.get<PromoCode[]>('/promos');
		return res.data;
	},

	createPromo: async (
		code: string,
		rewardAmount: number,
		maxUses: number,
		expiresAt?: string
	): Promise<{ success: boolean }> => {
		const res = await api.post<{ success: boolean }>('/promos', {
			code,
			reward_amount: rewardAmount,
			max_uses: maxUses,
			expires_at: expiresAt || null,
		});
		return res.data;
	},

	deletePromo: async (code: string): Promise<{ success: boolean }> => {
		const res = await api.delete<{ success: boolean }>(`/promos/${code}`);
		return res.data;
	},

	// ─── Userbots ───────────────────────────────────────────────────────────────
	listUserbots: async (): Promise<ManagedUserbot[]> => {
		const res = await api.get<ManagedUserbot[]>('/userbots');
		return res.data;
	},

	sendUserbotCode: async (phoneNumber: string): Promise<{ phone_code_hash: string }> => {
		const res = await api.post<{ phone_code_hash: string }>('/userbot/send-code', {
			phone_number: phoneNumber,
		});
		return res.data;
	},

	verifyUserbotCode: async (
		phoneNumber: string,
		code: string,
		phoneCodeHash: string
	): Promise<{ success: boolean }> => {
		const res = await api.post<{ success: boolean }>('/userbot/verify-code', {
			phone_number: phoneNumber,
			code,
			phone_code_hash: phoneCodeHash,
		});
		return res.data;
	},

	deleteUserbot: async (id: string): Promise<{ success: boolean }> => {
		const res = await api.delete<{ success: boolean }>(`/userbots/${id}`);
		return res.data;
	},

	// ─── Health & Settings ──────────────────────────────────────────────────────
	getHealth: async (): Promise<SystemHealthMetrics> => {
		const res = await api.get<SystemHealthMetrics>('/health/metrics');
		return res.data;
	},

	getSystemErrors: async (limit = 100): Promise<SystemErrorLog[]> => {
		const res = await api.get<SystemErrorLog[]>('/health/errors', {
			params: { limit },
		});
		return res.data;
	},

	getSettings: async (): Promise<SystemSettings> => {
		const res = await api.get<SystemSettings>('/settings');
		return res.data;
	},

	updateSettings: async (settings: SystemSettings): Promise<{ success: boolean }> => {
		const res = await api.put<{ success: boolean }>('/settings', settings);
		return res.data;
	},
};

import { apiClient } from '@/shared/api/axios.js';
import type {
	AdminDailyCombo,
	AuditLogEntry,
	BroadcastMessage,
	DashboardAd,
	FinanceOrder,
	ManagedUserbot,
	OwnerEntityItem,
	PromoCode,
	QuestItem,
	SearchedUser,
	SystemHealthMetrics,
	SystemSettings,
} from '../model/types.js';

export const ownerApi = {
	// --- Users ---
	searchUsers: (query: string) =>
		apiClient
			.get<SearchedUser[]>(`/owner/users/search?q=${encodeURIComponent(query)}`)
			.then((r) => r.data),

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
		apiClient
			.post<{ success: boolean }>('/owner/users/unban', { user_id: userId })
			.then((r) => r.data),

	flagUser: (userId: number, isFlagged: boolean, fraudReason: string) =>
		apiClient
			.post<{ success: boolean }>('/owner/users/flag', {
				user_id: userId,
				is_flagged: isFlagged,
				fraud_reason: fraudReason,
			})
			.then((r) => r.data),

	impersonateUser: (userId: number) =>
		apiClient
			.post<{ token: string }>('/owner/users/impersonate', { user_id: userId })
			.then((r) => r.data),

	// --- Audit Logs ---
	getAuditLogs: (limit = 20, offset = 0) =>
		apiClient
			.get<{ logs: AuditLogEntry[]; has_more: boolean }>(
				`/owner/audit-logs?limit=${limit}&offset=${offset}`,
			)
			.then((r) => r.data),

	// --- Quests ---
	listQuests: () => apiClient.get<QuestItem[]>('/owner/quests').then((r) => r.data),
	createQuest: (quest: Partial<QuestItem>) =>
		apiClient.post<QuestItem>('/owner/quests', quest).then((r) => r.data),
	updateQuest: (id: string | number, quest: Partial<QuestItem>) =>
		apiClient.put<QuestItem>(`/owner/quests/${id}`, quest).then((r) => r.data),
	deleteQuest: (key: string) =>
		apiClient.delete(`/owner/quests?key=${encodeURIComponent(key)}`).then((r) => r.data),

	// --- Daily Combos ---
	listCombos: () => apiClient.get<AdminDailyCombo[]>('/owner/combos').then((r) => r.data),
	createCombo: (date: string, word: string, reward: number) =>
		apiClient
			.post<AdminDailyCombo>('/owner/combos', {
				date,
				secret_word: word,
				reward_amount: reward,
			})
			.then((r) => r.data),
	deleteCombo: (id: number) => apiClient.delete(`/owner/combos/${id}`).then((r) => r.data),

	// --- Userbots ---
	listUserbots: () => apiClient.get<ManagedUserbot[]>('/owner/userbots').then((r) => r.data),
	sendUserbotCode: (phone: string) =>
		apiClient
			.post<{ phone_code_hash: string }>('/owner/userbot/send-code', { phone })
			.then((r) => r.data),
	verifyUserbotCode: (
		phone: string,
		code: string,
		phoneCodeHash: string,
		password_2fa?: string,
	) =>
		apiClient
			.post('/owner/userbot/verify-code', {
				phone,
				code,
				phoneCodeHash,
				password_2fa,
			})
			.then((r) => r.data),
	deleteUserbot: (id: string) => apiClient.delete(`/owner/userbots/${id}`).then((r) => r.data),

	// --- System Settings & Ads ---
	getSettings: () => apiClient.get<SystemSettings>('/owner/settings').then((r) => r.data),
	updateSettings: async (settingsPayload: Partial<SystemSettings>) => {
		let existing: SystemSettings | null = null;
		try {
			const res = await apiClient.get<SystemSettings>('/owner/settings');
			existing = res.data;
		} catch (_e) {}

		const mergedPayload: SystemSettings = {
			maintenance_mode: settingsPayload.maintenance_mode ?? existing?.maintenance_mode ?? false,
			tap_multiplier: settingsPayload.tap_multiplier ?? existing?.tap_multiplier ?? 1,
			referral_bonus: settingsPayload.referral_bonus ?? existing?.referral_bonus ?? 0,
			daily_reward_base: settingsPayload.daily_reward_base ?? existing?.daily_reward_base ?? 0,
			dashboard_ads: settingsPayload.dashboard_ads ?? existing?.dashboard_ads ?? [],
		};

		return (await apiClient.put<SystemSettings>('/owner/settings', mergedPayload)).data;
	},
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
	createPromo: (code: string, reward: number, maxUses: number, expiresInHours?: number) =>
		apiClient
			.post('/owner/promos', {
				code,
				reward_amount: reward,
				max_uses: maxUses,
				...(expiresInHours != null && expiresInHours > 0
					? { expires_in_hours: expiresInHours }
					: {}),
			})
			.then((r) => r.data),
	deletePromo: (code: string) =>
		apiClient.delete(`/owner/promos?code=${encodeURIComponent(code)}`).then((r) => r.data),

	// --- Broadcast ---
	listBroadcasts: () =>
		apiClient
			.get<BroadcastMessage[]>('/owner/broadcasts')
			.then((r) => r.data)
			.catch(() => []),
	sendBroadcast: (audience: string, text: string, _scheduledAt?: string) =>
		apiClient
			.post<{ success: boolean; id: string | number }>('/owner/broadcasts', {
				target_audience: audience,
				message: text,
			})
			.then((r) => r.data),

	// --- Finance ---
	getFinanceOrders: () =>
		apiClient.get<FinanceOrder[]>('/owner/finance/orders').then((r) => r.data),

	// --- Health ---
	getHealthMetrics: () =>
		apiClient.get<SystemHealthMetrics>('/owner/health/metrics').then((r) => r.data),
	getHealthLogs: () =>
		apiClient
			.get<any[]>('/owner/health/errors')
			.then((r) =>
				Array.isArray(r.data)
					? r.data.map((e) => `[${e.source || 'SYS'}] ${e.error_message || ''}`)
					: [],
			)
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

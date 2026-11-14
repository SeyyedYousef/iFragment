import axios from 'axios';
import { API_CONFIG } from '@/shared/api/config.js';
import type {
	AdCampaign,
	AuditLogEntry,
	BroadcastMessage,
	DashboardMetrics,
	ExternalProviderHealth,
	FinanceOrder,
	FinanceSummary,
	ManagedUserbot,
	OwnerAuthResponse,
	PromoCode,
	SystemErrorLog,
	SystemHealthMetrics,
	SystemSettings,
	TotpSetupResponse,
	UserSearchResponse,
} from '../model/types.js';

export const ownerHttp = axios.create({
	baseURL: `${API_CONFIG.BASE_URL}/owner`,
	timeout: API_CONFIG.TIMEOUT,
});

// Automatically attach Owner Session JWT
ownerHttp.interceptors.request.use((config) => {
	const token = sessionStorage.getItem('owner_token');
	if (token && config.headers) {
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
});

ownerHttp.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response?.status === 401) {
			const url = error.config?.url || '';
			if (!url.includes('/auth/')) {
				sessionStorage.removeItem('owner_token');
				sessionStorage.removeItem('owner_telegram_id');
				window.location.href = `${window.location.pathname}#/`;
			}
		}
		return Promise.reject(error);
	},
);

export const ownerApi = {
	// =========================================================================
	// 1. Authentication & TOTP MFA
	// =========================================================================
	login: async (password: string, telegramId?: number): Promise<OwnerAuthResponse> => {
		const { data } = await ownerHttp.post<OwnerAuthResponse>('/auth/login', {
			password,
			telegram_user_id: telegramId,
		});
		return data;
	},

	verifyTotp: async (tempToken: string, totpCode: string): Promise<{ token: string }> => {
		const { data } = await ownerHttp.post<{ token: string }>('/auth/totp/verify', {
			temp_token: tempToken,
			code: totpCode,
		});
		return data;
	},

	setupTotp: async (): Promise<TotpSetupResponse> => {
		const { data } = await ownerHttp.post<TotpSetupResponse>('/auth/totp/setup', {});
		return data;
	},

	verifyTotpSetup: async (code: string) => {
		const { data } = await ownerHttp.post('/auth/totp/verify-setup', { code });
		return data;
	},

	confirmTotpSetup: async (_secret: string, code: string, _recoveryCodes: string[]) => {
		const { data } = await ownerHttp.post('/auth/totp/verify-setup', { code });
		return data;
	},

	// =========================================================================
	// 2. Command Center & Live Valuation Telemetry
	// =========================================================================
	getDashboardMetrics: async (): Promise<DashboardMetrics> => {
		const { data } = await ownerHttp.get<DashboardMetrics>('/dashboard/stats');
		return data;
	},

	// =========================================================================
	// 3. Users, Intel Credits (⚡) & VIP Access Control
	// =========================================================================
	searchUsers: async (params: {
		q?: string;
		filter?: string;
		limit?: number;
		offset?: number;
	}): Promise<UserSearchResponse> => {
		const { data } = await ownerHttp.get<UserSearchResponse>('/users/search', { params });
		return data;
	},

	impersonateUser: async (targetUserId: number): Promise<{ token: string }> => {
		const { data } = await ownerHttp.post<{ token: string }>('/users/impersonate', {
			target_user_id: targetUserId,
		});
		return data;
	},

	banUser: async (
		targetUserId: number,
		banType: 'shadow' | 'full',
		reason: string,
		durationSeconds?: number,
	) => {
		const { data } = await ownerHttp.post('/users/ban', {
			target_user_id: targetUserId,
			ban_type: banType,
			reason,
			duration_seconds: durationSeconds || 0,
		});
		return data;
	},

	unbanUser: async (targetUserId: number) => {
		const { data } = await ownerHttp.post('/users/unban', {
			target_user_id: targetUserId,
		});
		return data;
	},

	adjustIntelCredits: async (
		targetUserId: number,
		delta: number,
		reason: string,
	): Promise<{ status: string; new_credits: number }> => {
		const { data } = await ownerHttp.post<{
			success?: boolean;
			status?: string;
			new_intel_credit?: number;
			new_credits?: number;
		}>('/users/adjust-credits', { user_id: targetUserId, delta, reason });
		return {
			status: data?.status ?? (data?.success ? 'ok' : 'ok'),
			new_credits: data?.new_intel_credit ?? data?.new_credits ?? 0,
		};
	},

	toggleUserVip: async (
		targetUserId: number,
		isPremium: boolean,
		reason: string,
	): Promise<{ status: string; is_premium: boolean }> => {
		const { data } = await ownerHttp.post<{ status: string; is_premium: boolean }>(
			'/users/toggle-vip',
			{ target_user_id: targetUserId, is_premium: isPremium, reason },
		);
		return data;
	},

	flagUser: async (
		targetUserId: number,
		isFlagged: boolean,
		reason = '',
	): Promise<{ status: string; is_flagged: boolean }> => {
		const { data } = await ownerHttp.post<{
			status?: string;
			success?: boolean;
			is_flagged?: boolean;
		}>('/users/flag', { target_user_id: targetUserId, is_flagged: isFlagged, reason });
		return {
			status: data?.status ?? (data?.success ? 'ok' : 'ok'),
			is_flagged: data?.is_flagged ?? isFlagged,
		};
	},

	// =========================================================================
	// 4. Security Audit Logs
	// =========================================================================
	getAuditLogs: async (params: {
		action?: string;
		search?: string;
		limit?: number;
		offset?: number;
	}): Promise<{ logs: AuditLogEntry[]; total: number }> => {
		const { data } = await ownerHttp.get<{ logs: AuditLogEntry[]; total: number }>('/audit-logs', {
			params,
		});
		return data;
	},

	// =========================================================================
	// 5. MTProto Session & Telegram Core Bridge Manager
	// =========================================================================
	listUserbots: async (): Promise<ManagedUserbot[]> => {
		const { data } = await ownerHttp.get<ManagedUserbot[] | { userbots: ManagedUserbot[] }>(
			'/userbots',
		);
		return Array.isArray(data) ? data : data?.userbots || [];
	},

	sendUserbotCode: async (
		phoneNumber: string,
	): Promise<{ phone_code_hash: string; dc_id?: number }> => {
		const { data } = await ownerHttp.post<{ phone_code_hash: string; dc_id?: number }>(
			'/userbot/send-code',
			{
				phone_number: phoneNumber,
			},
		);
		return data;
	},

	verifyUserbotCode: async (
		phoneNumber: string,
		code: string,
		phoneCodeHash: string,
		password2fa?: string,
		accountLabel?: string,
	) => {
		const { data } = await ownerHttp.post('/userbot/verify-code', {
			phone_number: phoneNumber,
			code,
			phone_code_hash: phoneCodeHash,
			password_2fa: password2fa,
			account_name: accountLabel,
		});
		return data;
	},

	pingUserbot: async (id: string): Promise<{ status: string; ping_ms: number; dc_id: number }> => {
		const { data } = await ownerHttp.post<{ status: string; ping_ms: number; dc_id: number }>(
			`/userbots/${id}/ping`,
		);
		return data;
	},

	deleteUserbot: async (id: string) => {
		const { data } = await ownerHttp.delete(`/userbots/${id}`);
		return data;
	},

	// =========================================================================
	// 6. Valuation Engine Calibration & Credit Pricing Settings
	// =========================================================================
	getSettings: async (): Promise<SystemSettings> => {
		const { data } = await ownerHttp.get<SystemSettings>('/settings');
		return data;
	},

	updateSettings: async (settings: SystemSettings): Promise<SystemSettings> => {
		const { data } = await ownerHttp.put<SystemSettings>('/settings', settings);
		return data;
	},

	// =========================================================================
	// 7. Intel Credit & VIP Promo Codes (⚡)
	// =========================================================================
	listPromos: async (): Promise<PromoCode[]> => {
		const { data } = await ownerHttp.get<PromoCode[] | { promos: PromoCode[] }>('/promos');
		return Array.isArray(data) ? data : data?.promos || [];
	},

	createPromo: async (
		code: string,
		creditAmount: number,
		maxUses: number,
		expiresAt?: string,
		grantVipDays?: number,
		note?: string,
	) => {
		const { data } = await ownerHttp.post('/promos', {
			code,
			reward_amount: creditAmount,
			max_uses: maxUses,
			expires_at: expiresAt,
			grant_vip_days: grantVipDays || 0,
			note: note || '',
		});
		return data;
	},

	deletePromo: async (code: string) => {
		const { data } = await ownerHttp.delete(`/promos/${encodeURIComponent(code)}`);
		return data;
	},

	// =========================================================================
	// 8. Telegram Broadcasts & Audience Messaging
	// =========================================================================
	listBroadcasts: async (): Promise<BroadcastMessage[]> => {
		const { data } = await ownerHttp.get<BroadcastMessage[] | { broadcasts: BroadcastMessage[] }>(
			'/broadcasts',
		);
		return Array.isArray(data) ? data : data?.broadcasts || [];
	},

	getAudienceCount: async (target: string): Promise<{ count: number }> => {
		const { data } = await ownerHttp.get<{ count: number }>('/broadcasts/audience-count', {
			params: { audience: target },
		});
		return data;
	},

	createBroadcast: async (payload: {
		target_audience: string;
		message: string;
		cta_label?: string;
		cta_url?: string;
		scheduled_at?: string;
	}) => {
		const { data } = await ownerHttp.post('/broadcasts', payload);
		return data;
	},

	pauseBroadcast: async (id: string) => {
		const { data } = await ownerHttp.post(`/broadcasts/${id}/pause`);
		return data;
	},

	resumeBroadcast: async (id: string) => {
		const { data } = await ownerHttp.post(`/broadcasts/${id}/resume`);
		return data;
	},

	// =========================================================================
	// 9. Stars & Credit Package Revenue Analytics
	// =========================================================================
	getFinanceSummary: async (): Promise<FinanceSummary> => {
		const { data } = await ownerHttp.get<FinanceSummary>('/finance/summary');
		return data;
	},

	getFinanceOrders: async (limit = 25, offset = 0): Promise<FinanceOrder[]> => {
		const { data } = await ownerHttp.get<FinanceOrder[] | { orders: FinanceOrder[] }>(
			'/finance/orders',
			{
				params: { limit, offset },
			},
		);
		return Array.isArray(data) ? data : data?.orders || [];
	},

	// =========================================================================
	// 10. Ecosystem Oracle Health & Valuation Cache Control
	// =========================================================================
	getHealth: async (): Promise<SystemHealthMetrics> => {
		const { data } = await ownerHttp.get<SystemHealthMetrics>('/health/metrics');
		return data;
	},

	getExternalHealth: async (): Promise<{
		status: string;
		checked_at: string;
		providers: ExternalProviderHealth[];
	}> => {
		const { data } = await ownerHttp.get<{
			status: string;
			checked_at: string;
			providers: ExternalProviderHealth[];
		}>('/health/external');
		return data;
	},

	clearCache: async (): Promise<{ status: string; deleted_keys: number }> => {
		const { data } = await ownerHttp.post<{
			success?: boolean;
			status?: string;
			deleted_keys?: number;
		}>('/cache/clear');
		return {
			status: data?.status ?? (data?.success ? 'ok' : 'ok'),
			deleted_keys: data?.deleted_keys ?? 0,
		};
	},

	getSystemErrors: async (limit = 50): Promise<SystemErrorLog[]> => {
		const { data } = await ownerHttp.get<SystemErrorLog[] | { errors: SystemErrorLog[] }>(
			'/health/errors',
			{
				params: { limit },
			},
		);
		return Array.isArray(data) ? data : data?.errors || [];
	},

	// =========================================================================
	// 11. Ads & Banners Management
	// =========================================================================
	listAdCampaigns: async (slot?: string): Promise<AdCampaign[]> => {
		const { data } = await ownerHttp.get<AdCampaign[] | { ads: AdCampaign[] }>('/ads', {
			params: slot ? { slot } : {},
		});
		return Array.isArray(data) ? data : data?.ads || [];
	},

	createAdCampaign: async (ad: Partial<AdCampaign>): Promise<AdCampaign> => {
		const { data } = await ownerHttp.post<AdCampaign | { ad: AdCampaign }>('/ads', ad);
		return (data as { ad?: AdCampaign })?.ad ?? (data as AdCampaign);
	},

	updateAdCampaign: async (id: string, ad: Partial<AdCampaign>): Promise<AdCampaign> => {
		const { data } = await ownerHttp.put<AdCampaign | { ad: AdCampaign }>(`/ads/${id}`, ad);
		return (data as { ad?: AdCampaign })?.ad ?? (data as AdCampaign);
	},

	deleteAdCampaign: async (id: string): Promise<void> => {
		await ownerHttp.delete(`/ads/${id}`);
	},

	uploadAdImage: async (
		blob: Blob,
		slot: string,
	): Promise<{
		url: string;
		width: number;
		height: number;
		size_bytes: number;
		mime_type?: string;
	}> => {
		const formData = new FormData();
		formData.append('file', blob, `${slot}_banner.webp`);
		formData.append('slot', slot);

		const { data } = await ownerHttp.post<{
			url: string;
			width: number;
			height: number;
			size_bytes: number;
			mime_type?: string;
		}>('/ads/upload', formData);
		return data;
	},
};

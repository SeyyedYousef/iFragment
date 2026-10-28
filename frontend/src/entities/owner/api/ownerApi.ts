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
			telegram_id: telegramId,
		});
		return data;
	},

	verifyTotp: async (tempToken: string, totpCode: string): Promise<{ token: string }> => {
		const { data } = await ownerHttp.post<{ token: string }>('/auth/verify-totp', {
			temp_token: tempToken,
			totp_code: totpCode,
		});
		return data;
	},

	setupTotp: async (): Promise<TotpSetupResponse> => {
		const { data } = await ownerHttp.post<TotpSetupResponse>('/auth/setup-totp');
		return data;
	},

	confirmTotpSetup: async (secret: string, code: string, recoveryCodes: string[]) => {
		const { data } = await ownerHttp.post('/auth/confirm-totp', {
			secret,
			code,
			recovery_codes: recoveryCodes,
		});
		return data;
	},

	// =========================================================================
	// 2. Command Center & Live Valuation Telemetry
	// =========================================================================
	getDashboardMetrics: async (): Promise<DashboardMetrics> => {
		const { data } = await ownerHttp.get<DashboardMetrics>('/dashboard');
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
		const { data } = await ownerHttp.get<UserSearchResponse>('/users', { params });
		return data;
	},

	impersonateUser: async (targetUserId: number): Promise<{ token: string }> => {
		const { data } = await ownerHttp.post<{ token: string }>(`/users/${targetUserId}/impersonate`);
		return data;
	},

	banUser: async (
		targetUserId: number,
		banType: 'shadow' | 'full',
		reason: string,
		durationSeconds?: number,
	) => {
		const { data } = await ownerHttp.post(`/users/${targetUserId}/ban`, {
			ban_type: banType,
			reason,
			duration_seconds: durationSeconds,
		});
		return data;
	},

	unbanUser: async (targetUserId: number) => {
		const { data } = await ownerHttp.post(`/users/${targetUserId}/unban`);
		return data;
	},

	adjustIntelCredits: async (
		targetUserId: number,
		delta: number,
		reason: string,
	): Promise<{ status: string; new_credits: number }> => {
		const { data } = await ownerHttp.post<{ status: string; new_credits: number }>(
			`/users/${targetUserId}/intel-credits`,
			{ delta, reason },
		);
		return data;
	},

	toggleUserVip: async (
		targetUserId: number,
		isPremium: boolean,
		reason: string,
	): Promise<{ status: string; is_premium: boolean }> => {
		const { data } = await ownerHttp.post<{ status: string; is_premium: boolean }>(
			`/users/${targetUserId}/vip`,
			{ is_premium: isPremium, reason },
		);
		return data;
	},

	flagUser: async (
		targetUserId: number,
		isFlagged: boolean,
	): Promise<{ status: string; is_flagged: boolean }> => {
		const { data } = await ownerHttp.post<{ status: string; is_flagged: boolean }>(
			`/users/${targetUserId}/flag`,
			{ is_flagged: isFlagged },
		);
		return data;
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
		const { data } = await ownerHttp.get<{ userbots: ManagedUserbot[] }>('/userbots');
		return data.userbots || [];
	},

	sendUserbotCode: async (
		phoneNumber: string,
	): Promise<{ phone_code_hash: string; dc_id?: number }> => {
		const { data } = await ownerHttp.post<{ phone_code_hash: string; dc_id?: number }>(
			'/userbots/send-code',
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
		const { data } = await ownerHttp.post('/userbots/verify-code', {
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
		const { data } = await ownerHttp.get<{ promos: PromoCode[] }>('/promos');
		return data.promos || [];
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
			credit_amount: creditAmount,
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
		const { data } = await ownerHttp.get<{ broadcasts: BroadcastMessage[] }>('/broadcasts');
		return data.broadcasts || [];
	},

	getAudienceCount: async (target: string): Promise<{ count: number }> => {
		const { data } = await ownerHttp.get<{ count: number }>('/broadcasts/audience-count', {
			params: { target },
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
		const { data } = await ownerHttp.get<{ orders: FinanceOrder[] }>('/finance/orders', {
			params: { limit, offset },
		});
		return data.orders || [];
	},

	// =========================================================================
	// 10. Ecosystem Oracle Health & Valuation Cache Control
	// =========================================================================
	getHealth: async (): Promise<SystemHealthMetrics> => {
		const { data } = await ownerHttp.get<SystemHealthMetrics>('/health');
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
		const { data } = await ownerHttp.post<{ status: string; deleted_keys: number }>(
			'/health/clear-cache',
		);
		return data;
	},

	getSystemErrors: async (limit = 50): Promise<SystemErrorLog[]> => {
		const { data } = await ownerHttp.get<{ errors: SystemErrorLog[] }>('/health/errors', {
			params: { limit },
		});
		return data.errors || [];
	},

	// =========================================================================
	// 11. Ads & Banners Management
	// =========================================================================
	listAdCampaigns: async (slot?: string): Promise<AdCampaign[]> => {
		const { data } = await ownerHttp.get<{ ads: AdCampaign[] }>('/ads', {
			params: slot ? { slot } : {},
		});
		return data.ads || [];
	},

	createAdCampaign: async (ad: Partial<AdCampaign>): Promise<AdCampaign> => {
		const { data } = await ownerHttp.post<{ ad: AdCampaign }>('/ads', ad);
		return data.ad;
	},

	updateAdCampaign: async (id: string, ad: Partial<AdCampaign>): Promise<AdCampaign> => {
		const { data } = await ownerHttp.put<{ ad: AdCampaign }>(`/ads/${id}`, ad);
		return data.ad;
	},

	deleteAdCampaign: async (id: string): Promise<void> => {
		await ownerHttp.delete(`/ads/${id}`);
	},

	uploadAdImage: async (blob: Blob, slot: string): Promise<{ image_url: string }> => {
		const formData = new FormData();
		formData.append('file', blob, `${slot}_banner.webp`);
		formData.append('slot', slot);

		const { data } = await ownerHttp.post<{ image_url: string }>('/ads/upload', formData);
		return data;
	},
};

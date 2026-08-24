import { apiClient } from '@/shared/api/axios.js';

export interface ValuationAccessResponse {
	has_access: boolean;
	method?: 'free' | 'stars' | 'coins' | 'pro' | 'credit';
	is_pro?: boolean;
	daily_used?: number;
	daily_limit?: number;
	free_quota_used: boolean;
	in_channel: boolean;
	in_group: boolean;
	credits_balance?: number;
	first_report_discount_eligible?: boolean;
	is_monitored?: boolean;
}

export interface StarsInvoiceResponse {
	invoice_link: string;
	payload: string;
	final_stars: number;
}

export interface OrderStatusResponse {
	paid: boolean;
	status: 'paid' | 'pending' | 'failed' | 'cancelled';
}

export const valuationApi = {
	/**
	 * Checks access permissions, subscription status, and available credits for a username valuation.
	 */
	checkAccess: (username: string) =>
		apiClient
			.get<ValuationAccessResponse>(`/usernames/valuation-access`, { params: { u: username } })
			.then((r: any) => r.data)
			.catch(() => ({
				has_access: false,
				free_quota_used: false,
				in_channel: false,
				in_group: false,
				credits_balance: 0,
				first_report_discount_eligible: true,
			})),

	/**
	 * Purchases full intelligence report using Airdrop Coins.
	 * Handled server-side with strict balance validation and atomic deduction.
	 */
	payWithAirdrop: (username: string) =>
		apiClient
			.post<{ success: boolean; method: string; remaining_coins?: number }>('/usernames/valuation-pay-airdrop', { username })
			.then((r: any) => r.data),

	/**
	 * Creates a Telegram Stars invoice link for either a Credit Pack or Pro subscription.
	 */
	createStarsInvoice: (username: string, packId?: string, discountPercent?: number) =>
		apiClient
			.post<StarsInvoiceResponse>('/usernames/valuation-pay-stars', {
				username,
				pack_id: packId || 'pack_starter_3',
				discount_percent: discountPercent || 0,
			})
			.then((r: any) => r.data),

	/**
	 * Polls server-side order status to confirm invoice payment on-chain before granting access.
	 */
	checkOrderStatus: (params: { payload?: string; username?: string }) =>
		apiClient
			.get<OrderStatusResponse>('/usernames/valuation-order-status', { params: { payload: params.payload, u: params.username } })
			.then((r: any) => r.data)
			.catch(() => ({ paid: false, status: 'pending' as const })),

	/**
	 * Verifies free access requirements (Channel + Group membership) and grants 1-time report.
	 */
	verifyFreeAccess: (username: string) =>
		apiClient
			.post<{ success: boolean; has_access: boolean; in_channel: boolean; in_group: boolean }>(
				'/usernames/valuation-verify-free',
				{ username },
			)
			.then((r: any) => r.data),

	/**
	 * Toggles alert monitoring for a purchased username.
	 */
	toggleMonitoring: (username: string, enabled: boolean, alertTypes?: string[]) =>
		apiClient
			.post<{ success: boolean; is_monitored: boolean }>('/usernames/valuation-monitor', {
				username,
				enabled,
				alert_types: alertTypes || ['auction_start', 'sale', 'price_alert'],
			})
			.then((r: any) => r.data)
			.catch(() => ({ success: false, is_monitored: false })),
};


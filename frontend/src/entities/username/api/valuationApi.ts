import { apiClient } from '@/shared/api/axios.js';

export interface ValuationAccessResponse {
	has_access: boolean;
	method?: 'free' | 'stars' | 'coins' | 'pro';
	is_pro?: boolean;
	daily_used?: number;
	daily_limit?: number;
	free_quota_used: boolean;
	in_channel: boolean;
	in_group: boolean;
}

export const valuationApi = {
	checkAccess: (username: string) =>
		apiClient
			.get<ValuationAccessResponse>(`/usernames/valuation-access`, { params: { u: username } })
			.then((r: any) => r.data)
			.catch(() => ({
				has_access: false,
				free_quota_used: false,
				in_channel: false,
				in_group: false,
			})),

	payWithAirdrop: (username: string) =>
		apiClient
			.post<{ success: boolean; method: string }>('/usernames/valuation-pay-airdrop', { username })
			.then((r: any) => r.data),

	createStarsInvoice: (username: string, discountPercent?: number) =>
		apiClient
			.post<{ invoice_link: string }>('/usernames/valuation-pay-stars', {
				username,
				discount_percent: discountPercent || 0,
			})
			.then((r: any) => r.data),

	verifyFreeAccess: (username: string) =>
		apiClient
			.post<{ success: boolean; has_access: boolean; in_channel: boolean; in_group: boolean }>(
				'/usernames/valuation-verify-free',
				{ username },
			)
			.then((r: any) => r.data),
};

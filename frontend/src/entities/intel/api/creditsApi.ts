import { apiClient } from '@/shared/api/axios.js';

export interface IntelCreditsBalance {
	balance: number;
	next_expiry: string | null;
}

export interface ConsumeCreditResponse {
	success: boolean;
	balance: number;
}

export interface CreditPack {
	id: string;
	credits: number;
	bonus_credits: number;
	stars_price: number;
	popular?: boolean;
	best_value?: boolean;
}

export interface CreditsConfig {
	credits_per_report: number;
	coins_per_credit: number;
	packs: CreditPack[];
}

export type CreditPurchaseMethod = 'stars' | 'ton';

export interface CreditPurchaseResponse {
	success: boolean;
	invoice_link?: string;
	order_payload?: string;
}

export const creditsApi = {
	getCredits: async (): Promise<IntelCreditsBalance> => {
		try {
			const { data } = await apiClient.get<IntelCreditsBalance>('/intel/credits');
			return data;
		} catch (_err) {
			return { balance: 0, next_expiry: null };
		}
	},

	consumeCredit: async (
		reason: string,
		entity: string,
		idemKey?: string,
	): Promise<ConsumeCreditResponse> => {
		const key =
			idemKey ||
			(typeof crypto !== 'undefined' && crypto.randomUUID
				? crypto.randomUUID()
				: `idem_${Date.now()}`);
		const { data } = await apiClient.post<ConsumeCreditResponse>('/intel/credits/consume', {
			reason,
			entity,
			idem_key: key,
		});
		return data;
	},

	getConfig: async (): Promise<CreditsConfig> => {
		const { data } = await apiClient.get<CreditsConfig>('/intel/credits/config');
		return data;
	},

	exchangeCoins: async (): Promise<ConsumeCreditResponse> => {
		const { data } = await apiClient.post<ConsumeCreditResponse>('/intel/credits/exchange-coins', {});
		return data;
	},

	purchaseCredits: async (
		method: CreditPurchaseMethod,
		packId: string,
	): Promise<CreditPurchaseResponse> => {
		const { data } = await apiClient.post<CreditPurchaseResponse>('/intel/credits/purchase', {
			method,
			pack: packId,
		});
		return data;
	},
};

import { apiClient } from '@/shared/api/axios.js';

export interface IntelCreditsBalance {
	balance: number;
	next_expiry: string | null;
}

export interface ConsumeCreditResponse {
	success: boolean;
	balance: number;
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
		idemKey?: string
	): Promise<ConsumeCreditResponse> => {
		const key = idemKey || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idem_${Date.now()}`);
		const { data } = await apiClient.post<ConsumeCreditResponse>('/intel/credits/consume', {
			reason,
			entity,
			idem_key: key,
		});
		return data;
	},
};

import { apiClient } from '@/shared/api/axios.js';
import type {
	CuriosityGateData,
	MaskItem,
	NumbersIntelData,
	NumberValuationResult,
} from '../model/types.js';

export const numbersApi = {
	getIntel: async (): Promise<NumbersIntelData> => {
		const { data } = await apiClient.get<NumbersIntelData>('/numbers/intel');
		return data;
	},

	getCuriosityGate: async (number: string): Promise<CuriosityGateData> => {
		const { data } = await apiClient.get<CuriosityGateData>('/numbers/gate', {
			params: { n: number },
		});
		return data;
	},

	getValuation: async (number: string): Promise<NumberValuationResult> => {
		const { data } = await apiClient.get<NumberValuationResult>('/numbers/valuate', {
			params: { n: number },
		});
		return data;
	},

	unlockWithCoins: async (number: string): Promise<NumberValuationResult> => {
		const { data } = await apiClient.post<NumberValuationResult>('/numbers/unlock-coins', {
			number,
		});
		return data;
	},

	unlockWithCredit: async (number: string): Promise<NumberValuationResult> => {
		const { data } = await apiClient.post<NumberValuationResult>('/numbers/unlock-credit', {
			number,
		});
		return data;
	},

	toggleWatchlist: async (
		number: string,
		enable: boolean,
	): Promise<{ success: boolean; number: string; enabled: boolean }> => {
		const { data } = await apiClient.post<{ success: boolean; number: string; enabled: boolean }>(
			'/numbers/watchlist',
			{
				number,
				enable,
			},
		);
		return data;
	},

	getWatchlist: async (): Promise<any[]> => {
		const { data } = await apiClient.get<any[]>('/numbers/watchlist');
		return data;
	},

	searchMask: async (query: string, limit = 30, offset = 0): Promise<MaskItem[]> => {
		const { data } = await apiClient.get<MaskItem[]>('/numbers/mask', {
			params: { q: query, limit, offset },
		});
		return data;
	},

	getDeals: async (): Promise<import('../model/types.js').DealSniperItem[]> => {
		const { data } = await apiClient.get<import('../model/types.js').DealSniperItem[]>('/numbers/deals');
		return data;
	},

	getClubs: async (): Promise<import('../model/types.js').CategoryClubItem[]> => {
		const { data } = await apiClient.get<import('../model/types.js').CategoryClubItem[]>('/numbers/clubs');
		return data;
	},

	scanPortfolio: async (address: string): Promise<import('../model/types.js').WalletPortfolioResult> => {
		const { data } = await apiClient.get<import('../model/types.js').WalletPortfolioResult>('/numbers/portfolio', {
			params: { address },
		});
		return data;
	},

	getActivity: async (): Promise<import('../model/types.js').LiveActivityItem[]> => {
		const { data } = await apiClient.get<import('../model/types.js').LiveActivityItem[]>('/numbers/activity');
		return data;
	},
};

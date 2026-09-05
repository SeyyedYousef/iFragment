import { apiClient } from '@/shared/api/axios.js';
import type {
	CollectionIntelResponse,
	CraftingEVData,
	CuriosityGateData,
	EnrichedGiftReport,
	GiftsIntelResponse,
	GiftValuationReport,
	PortfolioScanResponse,
	UpgradeAdviceData,
} from '../model/types.js';

export const giftsApi = {
	getIntel: async (): Promise<GiftsIntelResponse> => {
		const res = await apiClient.get<GiftsIntelResponse>('/gifts/intel');
		return res.data;
	},

	getCuriosityGate: async (giftID: string): Promise<CuriosityGateData> => {
		const res = await apiClient.get<CuriosityGateData>('/gifts/gate', {
			params: { g: giftID },
		});
		return res.data;
	},

	valuate: async (giftID: string): Promise<GiftValuationReport> => {
		const res = await apiClient.get<GiftValuationReport>('/gifts/valuate', {
			params: { g: giftID },
		});
		return res.data;
	},

	unlockWithCoins: async (giftID: string): Promise<GiftValuationReport> => {
		const res = await apiClient.post<GiftValuationReport>('/gifts/unlock-coins', {
			gift_id: giftID,
		});
		return res.data;
	},

	unlockWithCredit: async (giftID: string): Promise<GiftValuationReport> => {
		const res = await apiClient.post<GiftValuationReport>('/gifts/unlock-credit', {
			gift_id: giftID,
		});
		return res.data;
	},

	calculateCraftingEV: async (
		inputs: Array<{
			gift_id: string;
			model_id: string;
			name: string;
			serial_number: number;
			estimated_value_gram: number;
			craft_chance_permille: number;
		}>,
	): Promise<CraftingEVData> => {
		const res = await apiClient.post<CraftingEVData>('/gifts/crafting-ev', {
			inputs,
		});
		return res.data;
	},

	getUpgradeAdvice: async (giftID: string): Promise<UpgradeAdviceData> => {
		const res = await apiClient.get<UpgradeAdviceData>('/gifts/upgrade-advice', {
			params: { g: giftID },
		});
		return res.data;
	},

	scanPortfolio: async (username: string): Promise<PortfolioScanResponse> => {
		const res = await apiClient.get<PortfolioScanResponse>('/gifts/portfolio', {
			params: { u: username },
		});
		return res.data;
	},

	toggleWatchlist: async (
		giftID: string,
		enable: boolean,
	): Promise<{ success: boolean; gift_id: string; enabled: boolean }> => {
		const res = await apiClient.post('/gifts/watchlist', {
			gift_id: giftID,
			enable,
		});
		return res.data;
	},

	getWatchlist: async (): Promise<any[]> => {
		const res = await apiClient.get('/gifts/watchlist');
		return res.data;
	},

	// ═══════════════════════════════════════════════════════════
	// Collection Intelligence API
	// ═══════════════════════════════════════════════════════════

	getCollectionIntel: async (collectionSlug: string): Promise<CollectionIntelResponse> => {
		const res = await apiClient.get<CollectionIntelResponse>('/gifts/collection-intel', {
			params: { c: collectionSlug },
		});
		return res.data;
	},

	listCollections: async (): Promise<
		Array<{
			slug: string;
			name: string;
			image_url?: string;
			total_supply: number;
			floor_gram: number;
		}>
	> => {
		const res = await apiClient.get('/gifts/collections');
		return res.data;
	},

	// Enriched Single Gift Report (with provenance + on-chain)
	getEnrichedReport: async (giftID: string): Promise<EnrichedGiftReport> => {
		const res = await apiClient.get<EnrichedGiftReport>('/gifts/enriched-report', {
			params: { g: giftID },
		});
		return res.data;
	},
};

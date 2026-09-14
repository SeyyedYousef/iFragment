import { apiClient } from '@/shared/api/axios.js';
import type {
	ArbitrageOpportunity,
	CollectionIntelResponse,
	CollectionSummaryItem,
	CraftingEVData,
	CuriosityGateData,
	EnrichedGiftReport,
	GiftsIntelResponse,
	GiftValuationReport,
	PortfolioScanResponse,
	SerialClassification,
	UpgradeAdviceData,
	WhaleProfile,
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

	listCollections: async (): Promise<CollectionSummaryItem[]> => {
		const res = await apiClient.get<CollectionSummaryItem[]>('/gifts/collections');
		return res.data;
	},

	// Enriched Single Gift Report (with provenance + on-chain)
	getEnrichedReport: async (giftID: string): Promise<EnrichedGiftReport> => {
		const res = await apiClient.get<EnrichedGiftReport>('/gifts/enriched-report', {
			params: { g: giftID },
		});
		return res.data;
	},

	// ═══════════════════════════════════════════════════════════
	// Phase 2: Omni-Analytics, Arbitrage, Whales & Serial Genetics
	// ═══════════════════════════════════════════════════════════

	getArbitrageRadar: async (): Promise<ArbitrageOpportunity[]> => {
		const res = await apiClient.get<ArbitrageOpportunity[]>('/gifts/arbitrage');
		return res.data;
	},

	getWhaleLeaderboard: async (): Promise<WhaleProfile[]> => {
		const res = await apiClient.get<WhaleProfile[]>('/gifts/whales');
		return res.data;
	},

	classifySerial: async (serial: number, baseFloor?: number): Promise<SerialClassification> => {
		const res = await apiClient.get<SerialClassification>('/gifts/serials/classify', {
			params: { serial, base_floor: baseFloor },
		});
		return res.data;
	},

	triggerSync: async (): Promise<{ status: string; message: string }> => {
		const res = await apiClient.post<{ status: string; message: string }>('/gifts/sync');
		return res.data;
	},
};


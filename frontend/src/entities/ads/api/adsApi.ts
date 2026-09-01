import { apiClient } from '@/shared/api/axios.js';
import type { AdCampaign } from '@/entities/owner/model/types.js';

export const adsApi = {
	getActiveAds: async (slot = 'dashboard_banner'): Promise<AdCampaign[]> => {
		try {
			const res = await apiClient.get<AdCampaign[]>('/ads/active', {
				params: { slot },
			});
			return res.data || [];
		} catch (e) {
			console.warn('[AdsAPI] Failed to fetch active ads:', e);
			return [];
		}
	},

	trackImpression: async (id: string): Promise<void> => {
		if (!id) return;
		try {
			await apiClient.post(`/ads/${encodeURIComponent(id)}/impression`);
		} catch (_e) {}
	},

	trackClick: async (id: string): Promise<void> => {
		if (!id) return;
		try {
			await apiClient.post(`/ads/${encodeURIComponent(id)}/click`);
		} catch (_e) {}
	},
};

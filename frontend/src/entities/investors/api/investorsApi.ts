import { publicApi } from '@/shared/api/axios.js';
import type { InvestorsPageConfig } from '../model/types.js';

export const investorsApi = {
	getPageConfig: async (): Promise<InvestorsPageConfig> => {
		const response = await publicApi.get<InvestorsPageConfig>('/public/investors-page');
		return response.data;
	},
};

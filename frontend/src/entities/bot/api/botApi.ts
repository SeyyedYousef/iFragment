import { apiClient } from '@/shared/api/axios.js';
import type { ManagedBot, SubscriptionPackage } from '../model/types.js';

export const botApi = {
	listBots: () => apiClient.get<ManagedBot[]>('/bots').then((r: any) => r.data),

	registerBot: (data: { token: string; username: string; name: string; bot_id: number }) =>
		apiClient.post<ManagedBot>('/bots', data).then((r: any) => r.data),

	getBot: (botId: string) => apiClient.get<ManagedBot>(`/bots/${botId}`).then((r: any) => r.data),

	revokeBot: (botId: string) => apiClient.delete(`/bots/${botId}`).then((r: any) => r.data),

	listGroups: (botId: string) =>
		apiClient.get<any[]>(`/bots/${botId}/groups`).then((r: any) => r.data),
};

export const subscriptionApi = {
	getPackages: () =>
		apiClient.get<SubscriptionPackage[]>('/subscription/packages').then((r: any) => r.data),

	subscribe: (groupId: string, packageId: string) =>
		apiClient
			.post('/subscription/subscribe', { group_id: groupId, package_id: packageId })
			.then((r: any) => r.data),

	subscribeWithAirdrop: (groupId: string, packageId: string) =>
		apiClient
			.post('/subscription/subscribe-airdrop', { group_id: groupId, package_id: packageId })
			.then((r: any) => r.data),

	createSubscriptionStarsInvoice: (groupId: string, packageId: string, discountPercent?: number) =>
		apiClient
			.post('/subscription/subscribe-stars-invoice', {
				group_id: groupId,
				package_id: packageId,
				discount_percent: discountPercent || 0,
			})
			.then((r: any) => r.data),

	subscribeChannel: (channelId: string, packageId: string) =>
		apiClient
			.post('/subscription/channel/subscribe', { channel_id: channelId, package_id: packageId })
			.then((r: any) => r.data),

	subscribeChannelWithAirdrop: (channelId: string, packageId: string) =>
		apiClient
			.post('/subscription/channel/subscribe-airdrop', {
				channel_id: channelId,
				package_id: packageId,
			})
			.then((r: any) => r.data),

	createChannelSubscriptionStarsInvoice: (
		channelId: string,
		packageId: string,
		discountPercent?: number,
	) =>
		apiClient
			.post('/subscription/channel/subscribe-stars-invoice', {
				channel_id: channelId,
				package_id: packageId,
				discount_percent: discountPercent || 0,
			})
			.then((r: any) => r.data),
};

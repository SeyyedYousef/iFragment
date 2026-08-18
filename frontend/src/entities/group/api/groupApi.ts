import { apiClient } from '@/shared/api/axios.js';
import type { AnalyticsData, AuditLog, GroupSettings, ManagedGroup } from '../model/types.js';

export const groupApi = {
	getGroup: (groupId: string) =>
		apiClient.get<ManagedGroup>(`/groups/${groupId}`).then((r: any) => r.data),

	revokeGroup: (groupId: string) => apiClient.delete(`/groups/${groupId}`).then((r: any) => r.data),

	getSettings: (groupId: string) =>
		apiClient.get<GroupSettings>(`/groups/${groupId}/settings`).then((r: any) => r.data),

	updateSettings: (groupId: string, category: string, data: unknown, version: number) =>
		apiClient
			.put<GroupSettings>(`/groups/${groupId}/settings`, { category, data, version })
			.then((r: any) => r.data),

	getAnalytics: (groupId: string, days: number = 7) =>
		apiClient
			.get<AnalyticsData>(`/groups/${groupId}/analytics`, { params: { days } })
			.then((r: any) => r.data),

	getAuditLogs: (groupId: string, limit = 50, offset = 0) =>
		apiClient
			.get<AuditLog[]>(`/groups/${groupId}/audit`, { params: { limit, offset } })
			.then((r: any) => r.data),
};

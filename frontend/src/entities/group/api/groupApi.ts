import { apiClient } from '@/shared/api/axios.js';
import type { AnalyticsData, AuditLog, GroupSettings, GroupTelegramInfo, ManagedGroup, MemberWarning } from '../model/types.js';

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

	getGroupTelegramInfo: (groupId: string) =>
		apiClient.get<GroupTelegramInfo>(`/groups/${groupId}/telegram-info`).then((r: any) => r.data),

	listGroupWarnings: (groupId: string) =>
		apiClient.get<MemberWarning[]>(`/groups/${groupId}/members/warnings`).then((r: any) => r.data),

	resetGroupWarnings: (groupId: string, targetUserId: number) =>
		apiClient.post(`/groups/${groupId}/members/warnings/${targetUserId}/reset`).then((r: any) => r.data),

	restrictMember: (groupId: string, data: { target_user_id: number; until_date: number; permissions?: Record<string, boolean> }) =>
		apiClient.post(`/groups/${groupId}/members/restrict`, data).then((r: any) => r.data),

	unbanMember: (groupId: string, targetUserId: number) =>
		apiClient.post(`/groups/${groupId}/members/unban`, { target_user_id: targetUserId }).then((r: any) => r.data),

	getAnalytics: (groupId: string, days: number = 7) =>
		apiClient
			.get<AnalyticsData>(`/groups/${groupId}/analytics`, { params: { days } })
			.then((r: any) => r.data),

	getAuditLogs: (groupId: string, limit = 50, offset = 0) =>
		apiClient
			.get<AuditLog[]>(`/groups/${groupId}/audit`, { params: { limit, offset } })
			.then((r: any) => r.data),
};


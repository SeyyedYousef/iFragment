import { apiClient } from '@/shared/api/axios.js';
import type {
	ChannelAdmin,
	ChannelAnalyticsData,
	ChannelAuditResponse,
	ChannelConfig,
	ChannelHealth,
	ChannelInlineButton,
	ForwardingRule,
	ManagedChannel,
	Project,
} from '../model/types.js';

const unwrapApiData = (payload: any) => payload?.data?.data || payload?.data || payload;

const normalizeJsonObject = (value: any) => {
	if (!value) return {};
	if (typeof value === 'string') {
		try {
			return JSON.parse(value);
		} catch (_err) {
			return {};
		}
	}
	return typeof value === 'object' ? value : {};
};

const normalizeSettings = (raw: any): ChannelConfig => {
	const data = raw || {};
	return {
		...data,
		general: normalizeJsonObject(data.general),
		posting: normalizeJsonObject(data.posting),
		forwarding: normalizeJsonObject(data.forwarding),
		inline_buttons: normalizeJsonObject(data.inline_buttons),
		dynamic_bio: normalizeJsonObject(data.dynamic_bio),
		auto_responder: normalizeJsonObject(data.auto_responder),
		version: data.version || 1,
	};
};

export const channelApi = {
	getChannel: (id: string) =>
		apiClient.get<ManagedChannel>(`/channels/${id}`).then((r: any) => {
			const data = unwrapApiData(r);
			return {
				...data,
				members_count: data?.subscribers_count || 0,
			};
		}),

	getUserChannels: (botId?: string) =>
		apiClient.get<any>(`/channels`, { params: botId ? { bot_id: botId } : {} }).then((r: any) => {
			const list = Array.isArray(r.data) ? r.data : r.data?.data || [];
			return list.map((c: any) => ({
				id: c.id,
				title: c.chat_title || 'Unknown Channel',
				members:
					c.subscribers_count >= 1000
						? `${(c.subscribers_count / 1000).toFixed(1)}k`
						: `${c.subscribers_count || 0}`,
				avatar: c.chat_title ? c.chat_title.charAt(0).toUpperCase() : 'C',
				...c,
				members_count: c.subscribers_count || 0,
			}));
		}),

	connectChannel: (botId: string, username: string) =>
		apiClient
			.post<ManagedChannel>(`/channels/connect`, { bot_id: botId, username })
			.then((r: any) => r.data?.data || r.data),

	disconnectChannel: (id: string) =>
		apiClient.delete(`/channels/${id}`).then((r: any) => r.data?.data || r.data),

	getSettings: (id: string) =>
		apiClient
			.get<ChannelConfig>(`/channels/${id}/settings`)
			.then((r: any) => normalizeSettings(unwrapApiData(r))),

	updateSettings: (id: string, category: string, data: any, version: number) =>
		apiClient
			.put<ChannelConfig>(`/channels/${id}/settings`, { category, data, version })
			.then((r: any) => r.data?.data || r.data),

	getAnalytics: (id: string, days: number = 7): Promise<ChannelAnalyticsData> =>
		apiClient.get<any>(`/channels/${id}/analytics`, { params: { days } }).then((r: any) => {
			const data = unwrapApiData(r);
			const list = Array.isArray(data) ? data : data?.data || [];
			const summary = data?.summary || {};

			return {
				data: list,
				summary: {
					total_members: summary.total_members || 0,
					new_members: summary.new_members || 0,
					total_views: summary.total_views || 0,
					new_members_today: summary.new_members_today || 0,
					views_today: summary.views_today || 0,
					posts_today: summary.posts_today || 0,
					engagement_rate: summary.engagement_rate || 0,
					citation_index: summary.citation_index || 'N/A',
					best_time: summary.best_time || null,
					mentions_in: summary.mentions_in || 0,
					mentions_out: summary.mentions_out || 0,
					top_posts: summary.top_posts || [],
				},
			};
		}),

	getChannelHealth: (id: string): Promise<ChannelHealth> =>
		apiClient.get<ChannelHealth>(`/channels/${id}/health`).then((r: any) => unwrapApiData(r)),

	getAuditLogs: (id: string, limit = 50, cursor?: string): Promise<ChannelAuditResponse> =>
		apiClient.get<any>(`/channels/${id}/audit`, { params: { limit, cursor } }).then((r: any) => {
			const list = Array.isArray(r.data) ? r.data : r.data?.data || [];
			return {
				logs: list.map((l: any) => ({
					...l,
					id: l.id,
					action: l.action,
					actor_name: l.actor_id === 0 ? 'System' : l.actor_name || `User (${l.actor_id})`,
					created_at: l.created_at,
				})),
				next_cursor: r.data?.next_cursor || undefined,
			};
		}),

	getForwardingRules: (channelId: string) =>
		apiClient
			.get<ForwardingRule[]>(`/channels/${channelId}/forwarding/rules`)
			.then((r: any) => (Array.isArray(r.data) ? r.data : r.data?.data || [])),

	createForwardingRule: (channelId: string, rule: ForwardingRule) =>
		apiClient
			.post<ForwardingRule>(`/channels/${channelId}/forwarding/rules`, rule)
			.then((r: any) => r.data?.data || r.data),

	updateForwardingRule: (channelId: string, ruleId: string, rule: ForwardingRule) =>
		apiClient
			.put<ForwardingRule>(`/channels/${channelId}/forwarding/rules/${ruleId}`, rule)
			.then((r: any) => r.data?.data || r.data),

	deleteForwardingRule: (channelId: string, ruleId: string) =>
		apiClient
			.delete(`/channels/${channelId}/forwarding/rules/${ruleId}`)
			.then((r: any) => r.data?.data || r.data),

	verifyForwardingTarget: (channelId: string, target: string) =>
		apiClient
			.get(`/channels/${channelId}/forwarding/verify`, { params: { target } })
			.then((r: any) => r.data?.data || r.data),

	getForwardingLogs: (channelId: string) =>
		apiClient
			.get(`/channels/${channelId}/forwarding/logs`)
			.then((r: any) => (Array.isArray(r.data) ? r.data : r.data?.data || [])),

	pingWebhook: (channelId: string, url: string, secret?: string) =>
		apiClient
			.post(`/channels/${channelId}/webhooks/ping`, { url, secret: secret || '' })
			.then((r: any) => unwrapApiData(r)),

	getAdmins: (channelId: string) =>
		apiClient
			.get<ChannelAdmin[]>(`/channels/${channelId}/admins`)
			.then((r: any) => (Array.isArray(r.data) ? r.data : r.data?.data || [])),

	syncAdmins: (channelId: string) =>
		apiClient.post(`/channels/${channelId}/admins/sync`).then((r: any) => r.data?.data || r.data),

	updateAdmin: (channelId: string, adminId: string, data: any) =>
		apiClient
			.put(`/channels/${channelId}/admins/${adminId}`, data)
			.then((r: any) => r.data?.data || r.data),

	getMembers: (channelId: string) =>
		apiClient
			.get<any[]>(`/channels/${channelId}/members`)
			.then((r: any) => (Array.isArray(r.data) ? r.data : r.data?.data || [])),

	banMember: (channelId: string, memberId: string | number) =>
		apiClient
			.post(`/channels/${channelId}/members/${memberId}/ban`)
			.then((r: any) => r.data?.data || r.data),

	restrictMember: (channelId: string, memberId: string | number) =>
		apiClient
			.post(`/channels/${channelId}/members/${memberId}/restrict`)
			.then((r: any) => r.data?.data || r.data),

	getButtons: (channelId: string) =>
		apiClient
			.get<ChannelInlineButton[]>(`/channels/${channelId}/buttons`)
			.then((r: any) => (Array.isArray(r.data) ? r.data : r.data?.data || [])),

	saveButtons: (channelId: string, buttons: ChannelInlineButton[]) =>
		apiClient
			.post(`/channels/${channelId}/buttons`, buttons)
			.then((r: any) => r.data?.data || r.data),

	saveInlineButtonsAtomic: (
		channelId: string,
		payload: { enabled?: boolean; preset?: string; buttons: ChannelInlineButton[] },
	) =>
		apiClient
			.put(`/channels/${channelId}/inline-buttons`, payload)
			.then((r: any) => r.data?.data || r.data),

	getTelegramInfo: async (channelId: string) => {
		const res = await apiClient.get(`/channels/${channelId}/telegram-info`);
		return unwrapApiData(res);
	},

	simulateAIPost: (
		channelId: string,
		text: string,
		action: string,
		extra?: {
			aiProvider?: string;
			apiKey?: string;
			aiModel?: string;
			selectedSkill?: string;
			customSkillPrompt?: string;
		},
	) =>
		apiClient
			.post(`/channels/${channelId}/simulate`, { text, action, ...extra })
			.then((r: any) => r.data?.data?.text || r.data?.text),

	// ================= Project Endpoints (Independent Entity) =================
	getProjects: (): Promise<Project[]> =>
		apiClient.get<Project[]>(`/projects`).then((r: any) => {
			const data = unwrapApiData(r);
			return Array.isArray(data) ? data : [];
		}),

	getProject: (projectId: string): Promise<Project> =>
		apiClient.get<Project>(`/projects/${projectId}`).then((r: any) => unwrapApiData(r)),

	createProject: (payload: {
		name: string;
		source_channel_id?: string | null;
		target_channel_id?: string | null;
		source_channel_identifier?: string;
		target_channel_identifier?: string;
		pipeline_config?: any;
	}): Promise<Project> =>
		apiClient.post<Project>(`/projects`, payload).then((r: any) => unwrapApiData(r)),

	updateProject: (
		projectId: string,
		payload: {
			name?: string;
			source_channel_id?: string | null;
			target_channel_id?: string | null;
			source_channel_identifier?: string;
			target_channel_identifier?: string;
			pipeline_config?: any;
		},
	): Promise<Project> =>
		apiClient.put<Project>(`/projects/${projectId}`, payload).then((r: any) => unwrapApiData(r)),

	toggleProject: (projectId: string, status: 'active' | 'paused'): Promise<Project> =>
		apiClient.post<Project>(`/projects/${projectId}/toggle`, { status }).then((r: any) => unwrapApiData(r)),

	renewProject: (projectId: string): Promise<{ success: boolean; expires_at: string }> =>
		apiClient.post(`/projects/${projectId}/renew`).then((r: any) => unwrapApiData(r)),

	deleteProject: (projectId: string) =>
		apiClient.delete(`/projects/${projectId}`).then((r: any) => unwrapApiData(r)),

	// Legacy backward compatibility aliases
	getFunnel: (channelId: string) =>
		apiClient.get<any>(`/channels/${channelId}/funnel`).then((r: any) => {
			const data = r.data?.data || r.data;
			return data?.funnel === null ? null : data;
		}),

	createFunnel: (
		channelId: string,
		inputChannelId: string,
		projectName: string,
		inputChannelIdentifier?: string,
	) =>
		apiClient
			.post<any>(`/channels/${channelId}/funnel`, {
				project_name: projectName,
				input_channel_id: inputChannelId,
				input_channel_identifier: inputChannelIdentifier,
			})
			.then((r: any) => r.data?.data || r.data),

	deleteFunnel: (channelId: string) =>
		apiClient.delete(`/channels/${channelId}/funnel`).then((r: any) => r.data?.data || r.data),

	updateFunnel: (
		channelId: string,
		payload: {
			project_name: string;
			input_channel_id: string;
			output_channel_id: string;
			input_channel_identifier?: string;
		},
	) =>
		apiClient
			.put(`/channels/${channelId}/funnel`, payload)
			.then((r: any) => r.data?.data || r.data),
};

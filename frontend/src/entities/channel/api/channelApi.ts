import { apiClient } from '@/shared/api/axios.js';
import type {
	ChannelAdmin,
	ChannelConfig,
	ChannelInlineButton,
	ForwardingRule,
	ManagedChannel,
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

	getUserChannels: (botId: string) =>
		apiClient.get<any>(`/channels`, { params: { bot_id: botId } }).then((r: any) => {
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

	getAnalytics: (id: string, days: number = 7) =>
		apiClient.get<any>(`/channels/${id}/analytics`, { params: { days } }).then((r: any) => {
			const list = Array.isArray(r.data) ? r.data : r.data?.data || [];
			const topPosts = r.data?.summary?.top_posts || [];

			const latest = list[list.length - 1];
			const totalMembers = latest ? latest.subscribers_count : 0;
			const newMembers = list.reduce((sum: number, item: any) => sum + item.new_subscribers, 0);
			const totalViews = list.reduce((sum: number, item: any) => sum + item.views_count, 0);

			const newMembersToday = latest ? latest.new_subscribers || 0 : 0;
			const viewsToday = latest ? latest.views_count || 0 : 0;
			const postsToday = latest ? latest.posts_count || 0 : 0;
			const mentionsIn = r.data?.summary?.mentions_in || 0;
			const mentionsOut = r.data?.summary?.mentions_out || 0;
			const bestTime = r.data?.summary?.best_time || '18:30';

			let ciScore = 'N/A';
			if (totalMembers > 0 && totalViews > 0) {
				const ratio = totalViews / totalMembers;
				if (ratio > 2.0) ciScore = 'A+';
				else if (ratio > 1.0) ciScore = 'A';
				else if (ratio > 0.5) ciScore = 'B';
				else if (ratio > 0.2) ciScore = 'C';
				else ciScore = 'D';
			}

			const engagementRate =
				totalMembers > 0
					? Math.min(100, Math.round(((viewsToday + newMembersToday) / totalMembers) * 100))
					: 0;

			return {
				summary: {
					total_members: totalMembers,
					new_members: newMembers,
					total_views: totalViews,
					engagement_rate: engagementRate,
					top_posts: topPosts,
					new_members_today: newMembersToday,
					views_today: viewsToday,
					posts_today: postsToday,
					citation_index: ciScore,
					mentions_in: mentionsIn,
					mentions_out: mentionsOut,
					best_time: bestTime,
				},
				timeline: list,
			};
		}),

	getAuditLogs: (id: string, limit = 50, cursor?: string) =>
		apiClient.get<any>(`/channels/${id}/audit`, { params: { limit, cursor } }).then((r: any) => {
			const list = Array.isArray(r.data) ? r.data : r.data?.data || [];
			return {
				data: list.map((l: any) => ({
					...l,
					id: l.id,
					action: l.action,
					actor_name: l.actor_id === 0 ? 'System' : l.actor_name || `User (${l.actor_id})`,
					created_at: l.created_at,
				})),
				nextCursor: r.data?.next_cursor || null,
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

	banMember: (channelId: string, memberId: string) =>
		apiClient
			.post(`/channels/${channelId}/members/${memberId}/ban`)
			.then((r: any) => r.data?.data || r.data),

	restrictMember: (channelId: string, memberId: string) =>
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

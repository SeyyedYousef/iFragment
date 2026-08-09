import { apiClient } from './axios.js';

export interface ChannelConfig {
	channel_id: string;
	general: {
		language: string;
		timezone: string;
		signMessages: boolean;
		customSignature: string;
		autoForward: boolean;
		forwardDestination: string;
		disableReactions: boolean;
		name: string;
		description: string;
		photo: string;
		username: string;
		channelName?: string;
		channelBio?: string;
		channelPhotoUrl?: string;
		channelUsername?: string;
		showAdminProfile: boolean;
		hideChatHistory: boolean;
		hideMemberList: boolean;
		antiSpam: boolean;
		slowMode: number;
		autoDelete: number;
		discussionGroupId: string | null;
		joinReqAge: number;
		joinReqPhoto: boolean;
	};
	posting: {
		autoPostEnabled: boolean;
		postInterval: string;
		watermarkEnabled: boolean;
		watermarkText: string;
		silentPosting: boolean;
		deleteAfter: number;
		aiProvider?: string;
		apiKey?: string;
		aiModel?: string;
		tone?: string;
		aiConfirmBeforeEdit?: boolean;
		aiComposerEnabled?: boolean;
		selectedSkill?: string;
		customSkillPrompt?: string;
	};
	forwarding?: Record<string, unknown>;
	inline_buttons?: Record<string, unknown>;
	dynamic_bio?: Record<string, unknown>;
	auto_responder?: Record<string, unknown>;
	version: number;
	updated_at?: string;
}

export interface ManagedChannel {
	id: string;
	bot_id: string;
	chat_id: number;
	chat_title: string;
	subscribers_count: number;
	subscription_status: 'trial' | 'paid' | 'expired' | 'cancelled';
	trial_ends_at: string;
	paid_until?: string;
	linked_chat_id?: number;
	slow_mode_delay: number;
	auto_delete_time: number;
	sign_messages: boolean;
	protect_content: boolean;
	created_at: string;
	updated_at: string;
}

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

			// Calculate Citation Index based on views per member ratio
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

	// Forwarding Rules CRUD
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

	// Channel Admins
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

	// Channel Members
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

	// Inline Buttons
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
		extra?: { aiProvider?: string; apiKey?: string; aiModel?: string; selectedSkill?: string; customSkillPrompt?: string },
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

export interface ChannelFunnel {
	id: string;
	bot_id: string;
	project_name?: string;
	input_chat_id: number;
	output_chat_id: number;
	owner_user_id: number;
	is_active: boolean;
	created_at?: string;
	updated_at?: string;
	input_title?: string;
}

export interface ForwardingRule {
	id?: string;
	channel_id: string;
	direction: 'inbound' | 'outbound';
	target_type: 'telegram' | 'webhook';
	target: string;
	source_channel?: string;
	target_channel?: string;
	mode: 'forward' | 'copy' | 'ai';
	delay: string;
	is_active: boolean;
	content_types: {
		text: boolean;
		photos: boolean;
		videos: boolean;
		files: boolean;
		voice: boolean;
	};
	remove_ads: boolean;
	remove_hashtags: boolean;
	remove_links: boolean;
	watermark: string;
	created_at?: string;
}

export interface ChannelAdmin {
	id?: string;
	channel_id: string;
	telegram_id: number;
	username?: string;
	first_name: string;
	custom_title?: string;
	is_owner: boolean;
	created_at?: string;
}

export interface ChannelInlineButton {
	id?: string;
	channel_id: string;
	title: string;
	value: string;
	type: 'url' | 'counter' | 'share' | 'webapp' | 'payment';
	style: string;
	emoji?: string;
	click_count: number;
	created_at?: string;
}

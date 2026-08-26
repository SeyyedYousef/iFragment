import { t } from '@/shared/i18n/index.js';
import { DEMO_BOT_ID, DEMO_CHANNEL_ID, DEMO_GROUP_ID } from '@/shared/lib/demo-mode.js';

const now = () => new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
const daysAhead = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

const createState = () => ({
	bot: {
		id: DEMO_BOT_ID,
		owner_user_id: 0,
		bot_username: 'ifragment_demo_bot',
		bot_name: 'iFragment Demo Bot',
		bot_id: 8000000001,
		status: 'active' as const,
		managed_groups_count: 1,
		subscription_status: 'trial',
		created_at: daysAgo(21),
		updated_at: now(),
	},

	group: {
		id: DEMO_GROUP_ID,
		bot_id: DEMO_BOT_ID,
		chat_id: -1002000000001,
		chat_title: 'iFragment Demo Group',
		chat_type: 'supergroup' as const,
		members_count: 4820,
		subscription_status: 'trial' as const,
		trial_ends_at: daysAhead(6),
		created_at: daysAgo(21),
		updated_at: now(),
	},

	groupSettings: {
		group_id: DEMO_GROUP_ID,
		general: {
			language: 'fa',
			timezone: 'Asia/Tehran',
			link_protection: true,
			welcome_message: true,
			delete_joins: true,
			delete_leaves: true,
			nightMode: false,
		},
		content_restrictions: {
			links: 'delete',
			forward: 'warn',
			photos: 'allow',
			videos: 'allow',
			stickers: 'allow',
			voice: 'allow',
			files: 'warn',
			mentions: 'allow',
			profanity: 'delete',
		},
		limits: {
			minMessageLength: 0,
			maxMessageLength: 2000,
			floodMessages: 5,
			floodWindow: 10,
			duplicateCount: 3,
			duplicateWindow: 60,
			maxWarnings: 3,
		},
		quiet_hours: {
			enabled: true,
			emergencyLock: false,
			adminOverride: true,
			sendNotifications: true,
			periods: [{ id: 'demo-period-1', start: '00:30', end: '07:00' }],
		},
		mandatory_membership: {
			forceJoinEnabled: true,
			channels: [{ id: 'demo-fj-1', username: '@ifragment', title: 'iFragment' }],
		},
		custom_texts: {
			welcome: t('demoContent.welcome'),
			warn: t('demoContent.warn'),
			ban: t('demoContent.ban'),
			muted: t('demoContent.muted'),
		},
		dynamic_bio: {
			enabled: true,
			bioTemplate: t('demoContent.bioTemplate'),
			displayInName: false,
			nameTemplate: '',
			interval: '10m',
		},
		version: 1,
		updated_at: now(),
	},

	groupAudit: [
		{
			id: 'g-log-1',
			group_id: DEMO_GROUP_ID,
			actor_id: 0,
			actor_name: 'System',
			action: t('demoContent.logDeleteAdMessage'),
			created_at: daysAgo(0),
		},
		{
			id: 'g-log-2',
			group_id: DEMO_GROUP_ID,
			actor_id: 55501,
			actor_name: 'Demo Admin',
			action: t('demoContent.logWarnSpamUser'),
			created_at: daysAgo(1),
		},
		{
			id: 'g-log-3',
			group_id: DEMO_GROUP_ID,
			actor_id: 0,
			actor_name: 'System',
			action: t('demoContent.logFloodBlock'),
			created_at: daysAgo(2),
		},
	],

	channel: {
		id: DEMO_CHANNEL_ID,
		bot_id: DEMO_BOT_ID,
		chat_id: -1002000000002,
		chat_title: 'iFragment Demo Channel',
		subscribers_count: 12840,
		members_count: 12840,
		subscription_status: 'trial' as const,
		trial_ends_at: daysAhead(6),
		linked_chat_id: -1002000000001,
		slow_mode_delay: 0,
		auto_delete_time: 0,
		sign_messages: true,
		protect_content: false,
		created_at: daysAgo(21),
		updated_at: now(),
	},

	funnel: {
		id: 'demo-funnel-1',
		project_name: 'iFragment Demo Project',
		input_chat_id: -1002000000003,
		output_chat_id: -1002000000002,
		input_channel_identifier: '@source_channel',
		is_active: true,
		created_at: daysAgo(14),
	},

	channelSettings: {
		channel_id: DEMO_CHANNEL_ID,
		general: {
			language: 'fa',
			timezone: 'Asia/Tehran',
			signMessages: true,
			customSignature: 'iFragment Demo',
			autoForward: false,
			forwardDestination: '',
			disableReactions: false,
			name: 'iFragment Demo Channel',
			description: t('demoContent.channelDescription'),
			photo: '',
			username: 'ifragment_demo',
			showAdminProfile: true,
			hideChatHistory: false,
			hideMemberList: false,
			antiSpam: true,
			slowMode: 0,
			autoDelete: 0,
			discussionGroupId: null,
			joinReqAge: 0,
			joinReqPhoto: false,
		},
		posting: {
			autoPostEnabled: true,
			postInterval: '1h',
			watermarkEnabled: true,
			watermarkText: '@ifragment_demo',
			silentPosting: false,
			deleteAfter: 0,
			aiComposerEnabled: true,
			aiProvider: 'demo',
			aiModel: 'demo-1',
			tone: 'friendly',
		},
		inline_buttons: { enabled: true, preset: 'like' },
		forwarding: { enabled: true },
		dynamic_bio: {
			enabled: true,
			bioTemplate: t('demoContent.bioTemplate'),
			displayInName: false,
			nameTemplate: '',
			interval: '10m',
		},
		auto_responder: { enabled: true, rules: [] },
		version: 1,
		updated_at: now(),
	},

	channelAdmins: [
		{
			id: 'demo-admin-1',
			channel_id: DEMO_CHANNEL_ID,
			telegram_id: 55501,
			username: 'demo_owner',
			first_name: 'Demo Owner',
			custom_title: t('demoContent.customTitleOwner'),
			is_owner: true,
			created_at: daysAgo(21),
		},
		{
			id: 'demo-admin-2',
			channel_id: DEMO_CHANNEL_ID,
			telegram_id: 55502,
			username: 'demo_editor',
			first_name: 'Demo Editor',
			custom_title: t('demoContent.customTitleEditor'),
			is_owner: false,
			created_at: daysAgo(9),
		},
	],

	channelButtons: [
		{
			id: 'demo-btn-1',
			channel_id: DEMO_CHANNEL_ID,
			title: t('demoContent.buttonViewSite'),
			value: 'https://example.com',
			type: 'url' as const,
			style: 'primary',
			emoji: '🌐',
			click_count: 421,
			created_at: daysAgo(7),
		},
		{
			id: 'demo-btn-2',
			channel_id: DEMO_CHANNEL_ID,
			title: t('demoContent.buttonLike'),
			value: 'like',
			type: 'counter' as const,
			style: 'secondary',
			emoji: '👍',
			click_count: 1893,
			created_at: daysAgo(7),
		},
	],

	forwardingRules: [
		{
			id: 'demo-rule-1',
			channel_id: DEMO_CHANNEL_ID,
			direction: 'inbound' as const,
			target_type: 'telegram' as const,
			target: '@source_channel',
			mode: 'copy' as const,
			delay: '0s',
			is_active: true,
			content_types: { text: true, photos: true, videos: true, files: false, voice: false },
			remove_ads: true,
			remove_hashtags: false,
			remove_links: true,
			watermark: '@ifragment_demo',
			created_at: daysAgo(4),
		},
	],

	channelAudit: [
		{
			id: 'c-log-1',
			channel_id: DEMO_CHANNEL_ID,
			actor_id: 55501,
			actor_name: 'Demo Owner',
			action: t('demoContent.logEditPostingSettings'),
			created_at: daysAgo(0),
		},
		{
			id: 'c-log-2',
			channel_id: DEMO_CHANNEL_ID,
			actor_id: 0,
			actor_name: 'System',
			action: t('demoContent.logScheduledPostSent'),
			created_at: daysAgo(1),
		},
		{
			id: 'c-log-3',
			channel_id: DEMO_CHANNEL_ID,
			actor_id: 55502,
			actor_name: 'Demo Editor',
			action: t('demoContent.logGlassButtonAdded'),
			created_at: daysAgo(3),
		},
	],
});

let state = createState();
export const getDemoState = () => state;
export const resetDemoState = () => {
	state = createState();
};

const groupAnalytics = () => {
	const days = Array.from({ length: 7 }, (_, i) => ({
		date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0],
		members_count: 4700 + i * 20,
		messages_count: 900 + i * 55,
		active_users: 300 + i * 9,
	}));
	return {
		summary: {
			total_members: state.group.members_count,
			members_change: 120,
			total_messages: 7420,
			messages_change_pct: 14.2,
			spam_blocked: 318,
			new_members: 164,
			members_left: 44,
			active_users: 362,
			deleted_messages: 210,
			warnings_issued: 27,
			bans_issued: 3,
			top_users: [
				{ user_id: 1, name: 'Demo User A', msgs: 412 },
				{ user_id: 2, name: 'Demo User B', msgs: 305 },
				{ user_id: 3, name: 'Demo User C', msgs: 288 },
			],
		},
		growth: days.map((d) => ({
			date: d.date,
			members_count: d.members_count,
			value: d.members_count,
		})),
		activity: days.map((d) => ({
			date: d.date,
			messages_count: d.messages_count,
			active_users: d.active_users,
			value: d.messages_count,
		})),
	};
};

const channelAnalytics = () => ({
	data: Array.from({ length: 7 }, (_, i) => ({
		date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0],
		subscribers_count: 12500 + i * 48,
		new_subscribers: 40 + i * 6,
		views_count: 9000 + i * 420,
		posts_count: 3 + (i % 3),
	})),
	summary: {
		mentions_in: 34,
		mentions_out: 12,
		best_time: '20:30',
		top_posts: [
			{ id: 'demo-post-1', title: t('demoContent.postIntroTitle'), views: 8210, reactions: 412 },
			{ id: 'demo-post-2', title: t('demoContent.postConnectGuide'), views: 6140, reactions: 287 },
		],
	},
});

/** خطای «در دمو قفل است» با شکل خطای اکسیوس تا UIهای موجود آن را بفهمند */
const lockedError = async (config: any, fallback: string) => {
	let message = fallback;
	try {
		const { t } = await import('@/shared/i18n/index.js');
		message = t('demo.lockedAction');
	} catch (_e) {}
	const err: any = new Error('DEMO_LOCKED');
	err.isDemoLocked = true;
	err.config = config;
	err.response = {
		status: 423,
		statusText: 'Locked (demo)',
		headers: {},
		config,
		data: { error: message, demo_locked: true },
	};
	return err;
};

const mergeCategory = (target: any, body: any) => {
	const category = body?.category;
	if (category && target[category]) {
		target[category] = { ...target[category], ...(body.data || {}) };
	} else if (body?.data && typeof body.data === 'object') {
		Object.assign(target, body.data);
	}
	target.version = (target.version || 1) + 1;
	target.updated_at = now();
	return { ...target };
};

export interface DemoResult {
	data?: any;
	error?: any;
}

export const resolveDemoRoute = async (
	method: string,
	rawPath: string,
	body: any,
	config: any,
): Promise<DemoResult> => {
	const p = rawPath.split('?')[0];
	const m = method.toUpperCase();
	const s = state;

	// ── پکیج‌های اشتراک ──
	if (p.endsWith('/subscription/packages') && m === 'GET') {
		return {
			data: [
				{
					id: '1m',
					name: '1 Month',
					price_usd: 4.99,
					price_stars: 250,
					price_coins: 50000,
					price_per_month: 4.99,
					duration_months: 1,
				},
				{
					id: '3m',
					name: '3 Months',
					price_usd: 11.99,
					price_stars: 600,
					price_coins: 120000,
					price_per_month: 3.99,
					discount: '20%',
					badge: 'popular',
					duration_months: 3,
				},
				{
					id: '12m',
					name: '1 Year',
					price_usd: 35.99,
					price_stars: 1800,
					price_coins: 350000,
					price_per_month: 2.99,
					discount: '40%',
					badge: 'best_value',
					duration_months: 12,
				},
			],
		};
	}

	// ── ربات ──
	if (/\/bots\/[^/]+\/groups$/.test(p)) return { data: [s.group] };
	if (/\/bots\/[^/]+$/.test(p) && m === 'GET') return { data: s.bot };
	if (/\/bots\/[^/]+$/.test(p) && m === 'DELETE')
		return { error: await lockedError(config, t('demoContent.lockedGeneric')) };

	// ── گروه ──
	if (p.includes(`/groups/${DEMO_GROUP_ID}`)) {
		if (p.endsWith('/settings')) {
			if (m === 'PUT') return { data: mergeCategory(s.groupSettings, body) };
			return { data: { ...s.groupSettings } };
		}
		if (p.endsWith('/analytics')) return { data: groupAnalytics() };
		if (p.endsWith('/audit')) return { data: s.groupAudit };
		if (m === 'DELETE') return { error: await lockedError(config, t('demoContent.lockedGeneric')) };
		return { data: s.group };
	}

	// ── کانال ──
	if (p.includes('/channels')) {
		if (p.endsWith('/connect'))
			return { error: await lockedError(config, t('demoContent.lockedGeneric')) };
		if (p.endsWith('/telegram-info'))
			return {
				data: {
					title: s.channel.chat_title,
					username: 'ifragment_demo',
					description: s.channelSettings.general.description,
					members_count: s.channel.subscribers_count,
					photo_url: '',
				},
			};
		if (p.endsWith('/simulate'))
			return { data: { text: `${t('demoContent.aiSamplePrefix')}\n\n${body?.text || ''}` } };
		if (p.includes('/forwarding/rules')) {
			if (m === 'GET') return { data: s.forwardingRules };
			if (m === 'POST') {
				const rule = { ...body, id: `demo-rule-${Date.now()}`, created_at: now() };
				s.forwardingRules = [...s.forwardingRules, rule];
				return { data: rule };
			}
			if (m === 'PUT') {
				const id = p.split('/').pop();
				s.forwardingRules = s.forwardingRules.map((r) => (r.id === id ? { ...r, ...body } : r));
				return { data: { ...body, id } };
			}
			if (m === 'DELETE') {
				const id = p.split('/').pop();
				s.forwardingRules = s.forwardingRules.filter((r) => r.id !== id);
				return { data: { success: true } };
			}
		}
		if (p.endsWith('/forwarding/verify'))
			return { data: { ok: true, title: 'Demo Target Channel' } };
		if (p.endsWith('/forwarding/logs')) return { data: [] };
		if (p.includes('/admins')) {
			if (p.endsWith('/sync')) return { data: { synced: s.channelAdmins.length } };
			if (m === 'PUT') {
				const id = p.split('/').pop();
				s.channelAdmins = s.channelAdmins.map((a) => (a.id === id ? { ...a, ...body } : a));
				return { data: { success: true } };
			}
			return { data: s.channelAdmins };
		}
		if (p.includes('/buttons')) {
			if (m === 'POST') {
				if (Array.isArray(body)) s.channelButtons = body;
				return { data: { success: true, count: s.channelButtons.length } };
			}
			return { data: s.channelButtons };
		}
		if (p.endsWith('/analytics')) return { data: channelAnalytics() };
		if (p.endsWith('/audit')) return { data: { data: s.channelAudit, next_cursor: null } };
		if (p.endsWith('/members')) return { data: [] };
		if (p.endsWith('/funnel')) {
			if (m === 'GET') return { data: s.funnel };
			if (m === 'POST' || m === 'PUT') {
				s.funnel = { ...s.funnel, ...(body || {}) };
				return { data: s.funnel };
			}
			return { error: await lockedError(config, t('demoContent.lockedGeneric')) };
		}
		if (p.endsWith('/settings')) {
			if (m === 'PUT') return { data: mergeCategory(s.channelSettings, body) };
			return { data: { ...s.channelSettings } };
		}
		if (new RegExp(`/channels/${DEMO_CHANNEL_ID}$`).test(p)) {
			if (m === 'DELETE')
				return { error: await lockedError(config, t('demoContent.lockedGeneric')) };
			return { data: s.channel };
		}
		if (m === 'GET') return { data: [s.channel] }; // GET /channels?bot_id=demo-bot
	}

	// ── سایر عملیات‌های پرداخت/اشتراک: در دمو قفل است ──
	if (p.includes('/subscription'))
		return { error: await lockedError(config, t('demoContent.lockedPurchase')) };

	return { data: { success: true, demo: true } };
};

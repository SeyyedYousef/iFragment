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
		showAdminProfile: boolean;
		hideMemberList: boolean;
		antiSpam: boolean;
		slowMode: number;
		autoDelete: number;
		discussionGroupId: string | null;
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
	inline_buttons?: {
		enabled?: boolean;
		preset?: string;
		buttons?: ChannelInlineButton[];
	};
	dynamic_bio?: {
		enabled?: boolean;
		bioTemplate?: string;
		nameTemplate?: string;
		interval?: number | string;
		targetEvent?: string;
		eventName?: string;
		activePreset?: string;
	};
	auto_responder?: {
		enabled?: boolean;
		mode?: 'rotating' | 'fixed' | 'ai';
		fixedComment?: string;
		rotatingTexts?: string[];
		attachButton?: boolean;
		rules?: AutoResponderRule[];
	};
	version: number;
	updated_at?: string;
}

export interface ManagedChannel {
	id: string;
	bot_id: string;
	chat_id: number;
	chat_title: string;
	chat_username?: string;
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

export interface Project {
	id: string;
	owner_user_id: number;
	name: string;
	status: 'active' | 'paused' | 'expired';
	stars_subscription_active: boolean;
	stars_expires_at?: string | null;
	trial_used: boolean;
	trial_ends_at?: string | null;
	source_channel_id?: string | null;
	target_channel_id?: string | null;
	source_chat_id?: number | null;
	target_chat_id?: number | null;
	pipeline_config?: {
		drop_media?: boolean;
		remove_ads?: boolean;
		remove_hashtags?: boolean;
		remove_links?: boolean;
		watermark?: string;
		ai_rewrite?: boolean;
	} | null;
	source_title?: string;
	target_title?: string;
	source_username?: string;
	target_username?: string;
	created_at: string;
	updated_at: string;
}

export interface ContentRevision {
	id: string;
	content_item_id: string;
	version: number;
	text?: string;
	caption?: string;
	entities?: any[];
	caption_entities?: any[];
	media_manifest?: { file_id: string; type: string }[];
	buttons?: any[];
	transformations?: { type: string; details?: string; actor?: string }[];
	created_by?: number;
	created_at: string;
}

export interface ContentItem {
	id: string;
	project_id: string;
	source_chat_id: number;
	source_message_id: number;
	source_media_group_id?: string | null;
	status:
		| 'received'
		| 'processing'
		| 'awaiting_review'
		| 'editing'
		| 'approved'
		| 'scheduled'
		| 'publishing'
		| 'published'
		| 'rejected'
		| 'failed';
	current_revision_id?: string | null;
	received_at: string;
	created_at: string;
	updated_at: string;
	revision?: ContentRevision;
}

export interface Delivery {
	id: string;
	project_id: string;
	content_item_id?: string;
	destination_chat_id: number;
	telegram_message_id?: number;
	revision_id?: string;
	created_by_bot: boolean;
	status: 'publishing' | 'published' | 'failed';
	idempotency_key: string;
	error_message?: string;
	created_at: string;
	published_at?: string;
}

export interface ProjectMember {
	id: string;
	project_id: string;
	user_id: number;
	role: 'owner' | 'admin' | 'editor' | 'approver' | 'viewer';
	created_at: string;
}

export interface PreflightResult {
	valid: boolean;
	source_channel?: {
		chat_id: number;
		title: string;
		username: string;
		is_bot_admin: boolean;
		can_post: boolean;
		can_edit: boolean;
		error?: string;
	};
	target_channel?: {
		chat_id: number;
		title: string;
		username: string;
		is_bot_admin: boolean;
		can_post: boolean;
		can_edit: boolean;
		error?: string;
	};
	errors?: string[];
	warnings?: string[];
}

// Deprecated: Alias for legacy compatibility
export type ChannelFunnel = Project;

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
	type: 'url' | 'counter' | 'share' | 'webapp' | 'payment' | 'callback';
	style: string;
	emoji?: string;
	click_count: number;
	created_at?: string;
}

export interface AutoResponderRule {
	id?: string;
	keys?: string[];
	trigger?: string;
	replyText?: string;
	response?: string;
	match?: 'exact' | 'contains' | 'regex' | 'ai';
	useAI?: boolean;
	enabled?: boolean;
}

export interface ChannelHealth {
	score: number; // 0-100
	grade: 'A' | 'B' | 'C' | 'D' | 'F';
	status: 'healthy' | 'warning' | 'critical';
	bot_admin_verified: boolean;
	has_posting_configured: boolean;
	has_forwarding_rules: boolean;
	has_auto_responder: boolean;
	has_dynamic_bio: boolean;
	has_inline_buttons: boolean;
	subscribers_count: number;
	recommendations: Array<{
		code: string;
		severity: 'high' | 'medium' | 'low';
		title_key: string;
		desc_key: string;
	}>;
}

export interface ChannelAnalyticsTimelineItem {
	date: string;
	subscribers_count: number;
	new_subscribers: number;
	left_subscribers: number;
	views_count: number;
	posts_count: number;
}

export interface ChannelAnalyticsSummary {
	total_members: number;
	new_members: number;
	total_views: number;
	new_members_today: number;
	views_today: number;
	posts_today: number;
	engagement_rate: number;
	citation_index: string;
	best_time?: string | null;
	mentions_in: number;
	mentions_out: number;
	top_posts: Array<{
		id: string;
		channel_id: string;
		telegram_message_id?: number;
		text: string;
		views_count: number;
		created_at: string;
	}>;
}

export interface ChannelAnalyticsData {
	data: ChannelAnalyticsTimelineItem[];
	summary: ChannelAnalyticsSummary;
}

export interface ChannelAuditLog {
	id: string;
	channel_id: string;
	actor_id: number;
	action: string;
	metadata?: Record<string, unknown>;
	ip_address?: string;
	created_at: string;
}

export interface ChannelAuditResponse {
	logs: ChannelAuditLog[];
	next_cursor?: string;
}

export interface ChannelMember {
	id: number;
	first_name: string;
	last_name?: string;
	username?: string;
	status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
	until_date?: number;
}

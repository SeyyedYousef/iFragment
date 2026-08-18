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

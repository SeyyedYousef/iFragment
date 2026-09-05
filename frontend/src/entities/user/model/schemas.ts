import * as v from 'valibot';

export const UserBoostsSchema = v.object({
	user_id: v.pipe(v.number(), v.integer()),
	multitap_level: v.pipe(v.number(), v.integer()),
	energy_limit_level: v.pipe(v.number(), v.integer()),
	tap_bot_level: v.pipe(v.number(), v.integer()),
});

export const ActiveSubscriptionSummarySchema = v.object({
	type: v.string(),
	isActive: v.boolean(),
	autoRenew: v.boolean(),
	expiresAt: v.optional(v.string()),
	daysLeft: v.pipe(v.number(), v.integer()),
	packageTitle: v.string(),
});

export const ProfileStatsSchema = v.object({
	telegramId: v.optional(v.number()),
	username: v.optional(v.nullable(v.string())),
	firstName: v.optional(v.nullable(v.string())),
	lastName: v.optional(v.nullable(v.string())),
	usernamesAnalyzed: v.pipe(v.number(), v.integer(), v.minValue(0)),
	groupsManaged: v.pipe(v.number(), v.integer(), v.minValue(0)),
	channelsManaged: v.pipe(v.number(), v.integer(), v.minValue(0)),
	daysActive: v.pipe(v.number(), v.integer(), v.minValue(0)),
	currentStreak: v.pipe(v.number(), v.integer(), v.minValue(0)),
	globalRank: v.pipe(v.number(), v.integer(), v.minValue(0)),
	totalTaps: v.pipe(v.number(), v.integer(), v.minValue(0)),
	memberSince: v.optional(v.nullable(v.string()), ''),
	level: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 1),
	xp: v.pipe(v.number(), v.integer(), v.minValue(0)),
	xpToNextLevel: v.pipe(v.number(), v.integer(), v.minValue(0)),
	isPremium: v.optional(v.boolean(), false),
	premiumUntil: v.optional(v.nullable(v.string())),
	emojiStatus: v.optional(v.nullable(v.string()), ''),
	equippedBorder: v.optional(v.nullable(v.string()), ''),
	equippedSkin: v.optional(v.nullable(v.string()), ''),
	airdropCoins: v.optional(v.number()),
	creditExpiresInDays: v.optional(v.number(), 30),
	energy: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
	energyUpdatedAt: v.optional(v.nullable(v.string())),
	photoUrl: v.optional(v.nullable(v.string())),
	dailyTappedCoins: v.optional(v.number()),
	dailyTurboUsed: v.optional(v.number(), 0),
	dailyFullEnergyUsed: v.optional(v.number(), 0),
	valuationCredits: v.optional(v.number(), 0),
	intelCredits: v.optional(v.number(), 0),
	subscription: v.optional(ActiveSubscriptionSummarySchema),
});

export const AchievementSchema = v.object({
	id: v.string(),
	category: v.optional(
		v.nullable(
			v.picklist([
				'onboarding',
				'mining',
				'analysis',
				'social',
				'management',
				'streaks',
				'special',
			]),
		),
	),
	icon: v.optional(v.nullable(v.string())),
	unlocked: v.boolean(),
	unlockedAt: v.nullish(v.string()),
	progress: v.pipe(v.number(), v.minValue(0)),
	target: v.pipe(v.number(), v.minValue(0)),
});

export const ReferralFriendSchema = v.object({
	id: v.number(),
	name: v.optional(v.nullable(v.string()), ''),
	avatar: v.optional(v.nullable(v.string())),
	joinedAt: v.optional(v.nullable(v.string()), ''),
	earned: v.pipe(v.number(), v.minValue(0)),
	airdropCoins: v.optional(v.pipe(v.number(), v.minValue(0)), 0),
	frensCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 0),
	isActive: v.optional(v.boolean()),
	status: v.optional(v.nullable(v.string())),
});

export const ReferralInfoSchema = v.object({
	referralCode: v.string(),
	totalInvited: v.pipe(v.number(), v.integer(), v.minValue(0)),
	totalEarned: v.pipe(v.number(), v.minValue(0)),
	friends: v.optional(v.nullable(v.array(ReferralFriendSchema)), []),
});

export const DailyStatusSchema = v.object({
	streak: v.pipe(v.number(), v.integer(), v.minValue(0)),
	coins_reward: v.optional(v.number()),
	frg_reward: v.optional(v.number()),
	xp_reward: v.pipe(v.number(), v.minValue(0)),
	claimed: v.boolean(),
	can_claim: v.boolean(),
	time_left_seconds: v.optional(v.number()),
});

export const TaskStatusSchema = v.object({
	key: v.string(),
	title: v.string(),
	reward_coins: v.optional(v.number()),
	reward_frg: v.optional(v.number()),
	reward_xp: v.pipe(v.number(), v.minValue(0)),
	completed: v.boolean(),
	type: v.optional(v.string()),
	parent_key: v.nullish(v.string()),
	config: v.nullish(v.unknown()),
	progress_current: v.optional(v.number()),
	progress_target: v.optional(v.number()),
	action_text: v.optional(v.string()),
	action_url: v.optional(v.string()),
	is_premium_req: v.optional(v.boolean()),
	is_clan_req: v.optional(v.boolean()),
});

export const DailyComboStatusSchema = v.object({
	is_active: v.boolean(),
	is_claimed: v.boolean(),
	reward: v.number(),
});

export const BoostStatusSchema = v.object({
	type: v.string(),
	title: v.string(),
	current_level: v.pipe(v.number(), v.integer(), v.minValue(0)),
	next_level: v.pipe(v.number(), v.integer(), v.minValue(0)),
	price_coins: v.optional(v.number()),
	price_frg: v.optional(v.number()),
	max_level: v.boolean(),
});

export const LeaderboardMemberSchema = v.object({
	rank: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 1),
	user_id: v.number(),
	first_name: v.optional(v.nullable(v.string()), ''),
	username: v.optional(v.nullable(v.string()), ''),
	level: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 1),
	xp: v.pipe(v.number(), v.integer(), v.minValue(0)),
	clan_name: v.optional(v.nullable(v.string())),
});

export const LeaderboardResponseSchema = v.object({
	leaderboard: v.optional(v.nullable(v.array(LeaderboardMemberSchema)), []),
	total_miners: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
	user_rank: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
	league: v.optional(v.nullable(v.string())),
});

export const AchievementDefSchema = v.object({
	id: v.string(),
	target: v.pipe(v.number(), v.minValue(0)),
});

export const CosmeticItemSchema = v.object({
	id: v.string(),
	type: v.picklist(['border', 'skin']),
	name: v.string(),
	cost: v.pipe(v.number(), v.minValue(0)),
	purchased: v.boolean(),
	borderClass: v.optional(v.string()),
	skinClass: v.optional(v.string()),
});

export const ClanSchema = v.object({
	id: v.string(),
	telegram_channel_id: v.number(),
	channel_username: v.string(),
	channel_photo: v.optional(v.nullable(v.string())),
	chat_title: v.string(),
	members_count: v.pipe(v.number(), v.integer(), v.minValue(0)),
	total_score: v.optional(v.nullable(v.pipe(v.number(), v.minValue(0)))),
	rank: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
});

export const UserClanDetailsSchema = v.object({
	clan: v.optional(ClanSchema),
	is_member: v.boolean(),
	joined_at: v.optional(v.string()),
});

export const ClanMemberSchema = v.object({
	telegram_id: v.number(),
	username: v.optional(v.nullable(v.string())),
	first_name: v.optional(v.nullable(v.string()), ''),
	last_name: v.optional(v.nullable(v.string())),
	score: v.optional(v.nullable(v.pipe(v.number(), v.minValue(0))), 0),
	level: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 1),
	xp: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 0),
});

export const SuccessResponseSchema = v.record(v.string(), v.unknown());

export const ProfileSettingsSchema = v.object({
	notifications: v.optional(
		v.partial(
			v.object({
				mining: v.boolean(),
				referral: v.boolean(),
				community: v.boolean(),
				promotions: v.boolean(),
			}),
		),
	),
	hapticEnabled: v.optional(v.boolean()),
	soundEnabled: v.optional(v.boolean()),
	autoPlayAnimations: v.optional(v.boolean()),
	biometricEnabled: v.optional(v.boolean()),
});

// ─── Unified Ledger Schemas ───
export const LedgerEventSchema = v.object({
	id: v.string(),
	userId: v.number(),
	category: v.picklist(['coins', 'credits', 'stars', 'subscription']),
	eventType: v.string(),
	amount: v.number(),
	balanceBefore: v.number(),
	balanceAfter: v.number(),
	title: v.string(),
	referenceId: v.optional(v.nullable(v.string()), ''),
	status: v.picklist(['completed', 'pending', 'failed']),
	metadata: v.optional(v.record(v.string(), v.unknown())),
	createdAt: v.string(),
});

export const LedgerResponseSchema = v.object({
	events: v.optional(v.nullable(v.array(LedgerEventSchema)), []),
	nextCursor: v.optional(v.nullable(v.string())),
	hasMore: v.optional(v.boolean(), false),
	totalCount: v.optional(v.number(), 0),
});

// ─── My Assets Schemas ───
export const MyReportsAssetSchema = v.object({
	username: v.string(),
	rarityScore: v.number(),
	status: v.string(),
	generatedAt: v.string(),
	certificateUrl: v.string(),
	notificationEnabled: v.boolean(),
});

export const MyConnectedPropertySchema = v.object({
	id: v.string(),
	type: v.picklist(['channel', 'group', 'bot']),
	title: v.string(),
	username: v.string(),
	photoUrl: v.optional(v.nullable(v.string())),
	memberCount: v.number(),
	subscriptionStatus: v.string(),
	paidUntil: v.optional(v.nullable(v.string())),
	daysLeft: v.number(),
	dashboardUrl: v.string(),
});

export const MyProjectAssetSchema = v.object({
	id: v.string(),
	name: v.string(),
	status: v.string(),
	sourceChatTitle: v.string(),
	targetChatTitle: v.string(),
	sourceChatUsername: v.string(),
	targetChatUsername: v.string(),
	starsExpiresAt: v.optional(v.nullable(v.string())),
	daysLeft: v.number(),
	subscriptionActive: v.boolean(),
	pipelineEnabled: v.boolean(),
	autoRenew: v.boolean(),
});

export const MyBoostersAssetSchema = v.object({
	multitapLevel: v.number(),
	energyLimitLevel: v.number(),
	tapBotLevel: v.number(),
	tapBotCapHours: v.number(),
});

export const MyAssetsResponseSchema = v.object({
	reports: v.optional(v.nullable(v.array(MyReportsAssetSchema)), []),
	properties: v.optional(v.nullable(v.array(MyConnectedPropertySchema)), []),
	projects: v.optional(v.nullable(v.array(MyProjectAssetSchema)), []),
	boosters: v.optional(MyBoostersAssetSchema),
	summaryText: v.optional(v.nullable(v.string()), ''),
});

export const EmojiRewardResponseSchema = v.object({
	success: v.boolean(),
	rewarded: v.boolean(),
	amount: v.number(),
	message: v.string(),
});

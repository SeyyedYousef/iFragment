export interface Achievement {
	id: string;
	category?: 'onboarding' | 'mining' | 'analysis' | 'social' | 'management' | 'streaks' | 'special';
	icon?: string;
	unlocked: boolean;
	unlockedAt?: string | null;
	progress: number;
	target: number;
}

export interface ActiveSubscriptionSummary {
	type: string; // "none" | "pro" | "enterprise"
	isActive: boolean;
	autoRenew: boolean;
	expiresAt?: string;
	daysLeft: number;
	packageTitle: string;
}

export interface ProfileStats {
	telegramId?: number;
	username?: string;
	firstName?: string;
	lastName?: string;
	usernamesAnalyzed: number;
	groupsManaged: number;
	channelsManaged: number;
	daysActive: number;
	currentStreak: number;
	globalRank: number;
	totalTaps: number;
	memberSince: string;
	level: number;
	xp: number;
	xpToNextLevel: number;
	isPremium: boolean;
	premiumUntil?: string;
	emojiStatus: string;
	equippedBorder: string;
	equippedSkin: string;
	airdropCoins?: number;
	creditExpiresInDays?: number;
	energy?: number;
	energyUpdatedAt?: string;
	photoUrl?: string;
	dailyTappedCoins?: number;
	dailyFatigueMultiplier?: number;
	dailyFatigueLimitRemaining?: number;
	dailyTurboUsed?: number;
	dailyFullEnergyUsed?: number;
	boosterResetAt?: number;
	turboExpiresAt?: string;
	valuationCredits?: number;
	earliestExpiringCoins?: number;
	earliestExpiringDays?: number;
	intelCredits?: number;
	subscription?: ActiveSubscriptionSummary;
}

export interface ReferralInfo {
	referralCode: string;
	totalInvited: number;
	totalEarned: number;
	friends: {
		id: number;
		name: string;
		avatar?: string;
		joinedAt: string;
		earned: number;
		airdropCoins?: number;
		frensCount?: number;
		isActive?: boolean;
		status?: string;
	}[];
}

export interface ProfileSettings {
	notifications: {
		mining: boolean;
		referral: boolean;
		community: boolean;
		promotions: boolean;
	};
	hapticEnabled: boolean;
	soundEnabled: boolean;
	autoPlayAnimations: boolean;
	biometricEnabled: boolean;
}

export interface DailyStatus {
	streak: number;
	coins_reward?: number;
	frg_reward?: number;
	xp_reward: number;
	claimed: boolean;
	can_claim: boolean;
	time_left_seconds?: number;
}

export interface TaskStatus {
	key: string;
	title: string;
	reward_coins?: number;
	reward_frg?: number;
	reward_xp: number;
	completed: boolean;
	type?: string;
	parent_key?: string | null;
	config?: any;
	progress_current?: number;
	progress_target?: number;
	action_text?: string;
	action_url?: string;
	is_premium_req?: boolean;
	is_clan_req?: boolean;
}

export interface DailyComboStatus {
	is_active: boolean;
	is_claimed: boolean;
	reward: number;
}

export interface BoostStatus {
	type: string;
	title: string;
	current_level: number;
	next_level: number;
	price_coins?: number;
	price_frg?: number;
	max_level: boolean;
}

export interface UserBoosts {
	user_id: number;
	multitap_level: number;
	energy_limit_level: number;
	tap_bot_level: number;
}

export interface LeaderboardMember {
	rank: number;
	user_id: number;
	first_name: string;
	username: string;
	level: number;
	xp: number;
	clan_name?: string;
}

export interface LeaderboardResponse {
	leaderboard: LeaderboardMember[];
	total_miners?: number;
	user_rank?: number;
	league?: string;
}

export interface AchievementDef {
	id: string;
	target: number;
}

export interface PurchaseOption {
	id: string;
	title: string;
	amount_stars: number;
	amount_coins: number;
	popular?: boolean;
	price: number;
	discount?: string;
}

export interface CosmeticItem {
	id: string;
	type: 'border' | 'skin';
	name: string;
	cost: number; // in AirdropCoins
	purchased: boolean;
	borderClass?: string;
	skinClass?: string;
}

export interface Clan {
	id: string;
	telegram_channel_id: number;
	channel_username: string;
	channel_photo?: string;
	chat_title: string;
	members_count: number;
	total_score?: number;
	rank?: number;
}

export interface UserClanDetails {
	clan?: Clan;
	is_member: boolean;
	joined_at?: string;
}

export interface ClanMember {
	telegram_id: number;
	username?: string;
	first_name: string;
	last_name?: string;
	score: number;
	level: number;
	xp: number;
}

export interface SuccessResponse {
	status?: string;
	message?: string;
	[key: string]: unknown;
}

// ─── Unified Financial Ledger Types ───
export interface LedgerEvent {
	id: string;
	userId: number;
	category: 'coins' | 'credits' | 'stars' | 'subscription';
	eventType: string;
	amount: number;
	balanceBefore: number;
	balanceAfter: number;
	title: string;
	referenceId: string;
	status: 'completed' | 'pending' | 'failed';
	metadata?: Record<string, unknown>;
	createdAt: string;
}

export interface LedgerResponse {
	events: LedgerEvent[];
	nextCursor?: string;
	hasMore: boolean;
	totalCount: number;
}

// ─── My Assets Types ───
export interface MyReportsAsset {
	username: string;
	rarityScore: number;
	status: string;
	generatedAt: string;
	certificateUrl: string;
	notificationEnabled: boolean;
}

export interface MyConnectedProperty {
	id: string;
	type: 'channel' | 'group' | 'bot';
	title: string;
	username: string;
	photoUrl?: string;
	memberCount: number;
	subscriptionStatus: string;
	paidUntil?: string;
	daysLeft: number;
	dashboardUrl: string;
}

export interface MyProjectAsset {
	id: string;
	name: string;
	status: string;
	sourceChatTitle: string;
	targetChatTitle: string;
	sourceChatUsername: string;
	targetChatUsername: string;
	starsExpiresAt?: string;
	daysLeft: number;
	subscriptionActive: boolean;
	pipelineEnabled: boolean;
	autoRenew: boolean;
}

export interface MyBoostersAsset {
	multitapLevel: number;
	energyLimitLevel: number;
	tapBotLevel: number;
	tapBotCapHours: number;
}

export interface MyAssetsResponse {
	reports: MyReportsAsset[];
	properties: MyConnectedProperty[];
	projects: MyProjectAsset[];
	boosters: MyBoostersAsset;
	summaryText: string;
}

export interface EmojiRewardResponse {
	success: boolean;
	rewarded: boolean;
	amount: number;
	message: string;
}

export const LEVELS = [
	{ level: 1, title: 'Newcomer', xpRequired: 0 },
	{ level: 2, title: 'Observer', xpRequired: 500 },
	{ level: 3, title: 'Scout', xpRequired: 1500 },
	{ level: 4, title: 'Tracker', xpRequired: 3500 },
	{ level: 5, title: 'Analyst', xpRequired: 7000 },
	{ level: 6, title: 'Investigator', xpRequired: 12000 },
	{ level: 7, title: 'Strategist', xpRequired: 20000 },
	{ level: 8, title: 'Expert', xpRequired: 35000 },
	{ level: 9, title: 'Master', xpRequired: 55000 },
	{ level: 10, title: 'Grandmaster', xpRequired: 80000 },
	{ level: 11, title: 'Legend', xpRequired: 120000 },
	{ level: 12, title: 'Mythic', xpRequired: 200000 },
];

export const getLevelInfo = (rawXp: number) => {
	const xp = Number.isFinite(rawXp) && rawXp >= 0 ? rawXp : 0;
	let current = LEVELS[0];
	let next = LEVELS[1];
	for (let i = 0; i < LEVELS.length; i++) {
		if (xp >= LEVELS[i].xpRequired) {
			current = LEVELS[i];
			next = LEVELS[i + 1] || LEVELS[i];
		}
	}
	const progress =
		next.xpRequired === current.xpRequired
			? 100
			: Math.floor(((xp - current.xpRequired) / (next.xpRequired - current.xpRequired)) * 100);
	return { current, next, progress: Math.min(100, Math.max(0, progress)) };
};

export const ACHIEVEMENT_DEFS: Omit<
	Achievement,
	'unlocked' | 'unlockedAt' | 'progress' | 'target'
>[] = [
	{ id: 'first_steps', category: 'onboarding', icon: '🐣' },
	{ id: 'home_base', category: 'onboarding', icon: '🏠' },
	{ id: 'tap_novice', category: 'mining', icon: '⛏️' },
	{ id: 'mining_machine', category: 'mining', icon: '🤖' },
	{ id: 'frg_millionaire', category: 'mining', icon: '💎' },
	{ id: 'first_scan', category: 'analysis', icon: '🔬' },
	{ id: 'whale_hunter', category: 'analysis', icon: '🐋' },
	{ id: 'data_scientist', category: 'analysis', icon: '🧪' },
	{ id: 'social_butterfly', category: 'social', icon: '🦋' },
	{ id: 'army_builder', category: 'social', icon: '🪖' },
	{ id: 'network_king', category: 'social', icon: '👑' },
	{ id: 'group_guardian', category: 'management', icon: '🛡️' },
	{ id: 'channel_commander', category: 'management', icon: '📡' },
	{ id: 'empire_builder', category: 'management', icon: '🏰' },
	{ id: 'week_warrior', category: 'streaks', icon: '🗓️' },
	{ id: 'month_master', category: 'streaks', icon: '📅' },
	{ id: 'legendary', category: 'streaks', icon: '🌟' },
	{ id: 'early_adopter', category: 'special', icon: '🎖️' },
	{ id: 'premium_user', category: 'special', icon: '💫' },
	{ id: 'bug_hunter', category: 'special', icon: '🐛' },
];

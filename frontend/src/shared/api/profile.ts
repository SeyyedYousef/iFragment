import { z } from 'zod';
import type { Achievement, ProfileStats, ReferralInfo } from '@/shared/store/profile.js';
import { setProfilePhotoUrl } from '@/shared/store/profile.js';
import { apiFetch } from './base.js';

// ─── Zod Schemas ───
export const UserBoostsSchema = z.object({
	user_id: z.number().int(),
	multitap_level: z.number().int(),
	energy_limit_level: z.number().int(),
	tap_bot_level: z.number().int(),
});

export type UserBoosts = z.infer<typeof UserBoostsSchema>;

export const ProfileStatsSchema = z.object({
	telegramId: z.number().optional(),
	username: z.string().optional(),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	usernamesAnalyzed: z.number().int().nonnegative(),
	groupsManaged: z.number().int().nonnegative(),
	channelsManaged: z.number().int().nonnegative(),
	daysActive: z.number().int().nonnegative(),
	currentStreak: z.number().int().nonnegative(),
	globalRank: z.number().int().nonnegative(),
	totalTaps: z.number().int().nonnegative(),
	totalFrgEarned: z.number().nonnegative(),
	totalFrgSpent: z.number().nonnegative(),
	frgBalance: z.number().nonnegative(),
	memberSince: z.string(),
	level: z.number().int().min(1),
	xp: z.number().int().nonnegative(),
	xpToNextLevel: z.number().int().nonnegative(),
	isPremium: z.boolean(),
	premiumUntil: z.string().optional(),
	emojiStatus: z.string(),
	equippedBorder: z.string(),
	equippedSkin: z.string(),
	airdropCoins: z.number().optional(),
	energy: z.number().int().nonnegative().optional(),
	energyUpdatedAt: z.string().optional(),
	photoUrl: z.string().optional(),
	dailyTappedCoins: z.number().optional(),
	dailyTurboUsed: z.number().optional().default(0),
	dailyFullEnergyUsed: z.number().optional().default(0),
});

export const AchievementSchema = z.object({
	id: z.string(),
	category: z
		.enum(['onboarding', 'mining', 'analysis', 'social', 'management', 'streaks', 'special'])
		.optional(),
	icon: z.string().optional(),
	unlocked: z.boolean(),
	unlockedAt: z.string().nullable().optional(),
	progress: z.number().nonnegative(),
	target: z.number().positive(),
});

export const ReferralFriendSchema = z.object({
	id: z.number(),
	name: z.string(),
	avatar: z.string().optional(),
	joinedAt: z.string(),
	earned: z.number().nonnegative(),
	airdropCoins: z.number().nonnegative().optional().default(0),
	frensCount: z.number().int().nonnegative().optional().default(0),
});

export const ReferralInfoSchema = z.object({
	referralCode: z.string(),
	totalInvited: z.number().int().nonnegative(),
	totalEarned: z.number().nonnegative(),
	friends: z.array(ReferralFriendSchema),
});

export const DailyStatusSchema = z.object({
	streak: z.number().int().nonnegative(),
	frg_reward: z.number().nonnegative(),
	xp_reward: z.number().nonnegative(),
	claimed: z.boolean(),
	can_claim: z.boolean(),
	time_left_seconds: z.number().optional(),
});

export const TaskStatusSchema = z.object({
	key: z.string(),
	title: z.string(),
	reward_frg: z.number().nonnegative(),
	reward_xp: z.number().nonnegative(),
	completed: z.boolean(),
	type: z.string().optional(),
	parent_key: z.string().optional().nullable(),
	config: z.any().optional().nullable(),
	progress_current: z.number().optional(),
	progress_target: z.number().optional(),
	action_text: z.string().optional(),
	action_url: z.string().optional(),
	is_premium_req: z.boolean().optional(),
	is_clan_req: z.boolean().optional(),
});

export const DailyComboStatusSchema = z.object({
	is_active: z.boolean(),
	is_claimed: z.boolean(),
	reward: z.number(),
});

export type DailyComboStatus = z.infer<typeof DailyComboStatusSchema>;

export const BoostStatusSchema = z.object({
	type: z.string(),
	title: z.string(),
	current_level: z.number().int().nonnegative(),
	next_level: z.number().int().nonnegative(),
	price_frg: z.number().nonnegative(),
	max_level: z.boolean(),
});

export const LeaderboardMemberSchema = z.object({
	rank: z.number().int().positive(),
	user_id: z.number(),
	first_name: z.string(),
	username: z.string(),
	level: z.number().int().min(1),
	xp: z.number().int().nonnegative(),
	clan_name: z.string().optional(),
});

export const AchievementDefSchema = z.object({
	id: z.string(),
	target: z.number().positive(),
});

export const CosmeticItemSchema = z.object({
	id: z.string(),
	type: z.enum(['border', 'skin']),
	name: z.string(),
	cost: z.number().nonnegative(),
	purchased: z.boolean(),
	borderClass: z.string().optional(),
	skinClass: z.string().optional(),
});

export const ClanSchema = z.object({
	id: z.string(),
	telegram_channel_id: z.number(),
	channel_username: z.string(),
	channel_photo: z.string().optional(),
	chat_title: z.string(),
	members_count: z.number().int().nonnegative(),
	total_score: z.number().nonnegative().optional(),
	rank: z.number().int().nonnegative().optional(),
});

export const UserClanDetailsSchema = z.object({
	clan: ClanSchema.optional(),
	is_member: z.boolean(),
	joined_at: z.string().optional(),
});

export const ClanMemberSchema = z.object({
	telegram_id: z.number(),
	username: z.string().optional(),
	first_name: z.string(),
	last_name: z.string().optional(),
	score: z.number(),
	level: z.number().int().nonnegative(),
	xp: z.number().int().nonnegative(),
});

export const SuccessResponseSchema = z
	.object({
		status: z.string().optional(),
		message: z.string().optional(),
	})
	.catchall(z.unknown());

export const LeaderboardResponseSchema = z.object({
	leaderboard: z.array(LeaderboardMemberSchema),
	total_miners: z.number().int().nonnegative().optional(),
});

export type DailyStatus = z.infer<typeof DailyStatusSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type BoostStatus = z.infer<typeof BoostStatusSchema>;
export type LeaderboardMember = z.infer<typeof LeaderboardMemberSchema>;
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;
export type Clan = z.infer<typeof ClanSchema>;
export type UserClanDetails = z.infer<typeof UserClanDetailsSchema>;
export type ClanMember = z.infer<typeof ClanMemberSchema>;
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;

// ─── Validated Fetch Helper ───
const validatedFetch = async <T extends z.ZodTypeAny>(
	endpoint: string,
	schema: T,
	options?: RequestInit,
): Promise<z.infer<T>> => {
	const raw = await apiFetch<unknown>(endpoint, options);
	const result = schema.safeParse(raw);
	if (!result.success) {
		console.error(`[API Schema Mismatch] at ${endpoint}:`, result.error.format());
		throw new Error(`Server returned invalid data format at ${endpoint}`);
	}
	return result.data;
};

// ─── Validated API Exports ───
export const getProfileStats = async (): Promise<ProfileStats> => {
	const stats = await validatedFetch('/profile/stats', ProfileStatsSchema);
	if (stats.photoUrl !== undefined) {
		setProfilePhotoUrl(stats.photoUrl);
	}
	return stats;
};

export const getProfileAchievements = (): Promise<Achievement[]> =>
	validatedFetch('/profile/achievements', z.array(AchievementSchema));

export const getReferralInfo = (): Promise<ReferralInfo> =>
	validatedFetch('/profile/referral', ReferralInfoSchema);

export const getDailyStatus = (): Promise<DailyStatus> =>
	validatedFetch('/profile/daily', DailyStatusSchema);

export async function claimDailyReward(): Promise<DailyStatus> {
	return await apiFetch<DailyStatus>('/profile/daily/claim', {
		method: 'POST',
	});
}

export async function getDailyComboStatus(): Promise<DailyComboStatus> {
	return await apiFetch<DailyComboStatus>('/profile/daily-combo', {
		method: 'GET',
	});
}

export async function claimDailyCombo(secretWord: string): Promise<boolean> {
	await apiFetch<{ success: boolean }>('/profile/daily-combo/claim', {
		method: 'POST',
		body: JSON.stringify({ secret_word: secretWord }),
		headers: { 'Content-Type': 'application/json' },
	});
	return true;
}

export const getTasksStatus = (): Promise<TaskStatus[]> =>
	validatedFetch('/profile/tasks', z.array(TaskStatusSchema));

export const completeTask = (taskKey: string, answer?: string): Promise<TaskStatus> =>
	validatedFetch('/profile/tasks/complete', TaskStatusSchema, {
		method: 'POST',
		body: JSON.stringify({ taskKey, answer }),
	});

export const getBoostsStatus = (): Promise<BoostStatus[]> =>
	validatedFetch('/profile/boosts', z.array(BoostStatusSchema));

export const upgradeBoost = (boostType: string): Promise<UserBoosts> =>
	validatedFetch('/profile/boosts/upgrade', UserBoostsSchema, {
		method: 'POST',
		body: JSON.stringify({ boostType }),
	});

export const getLeaderboard = (period?: string | unknown): Promise<LeaderboardResponse> => {
	const p = typeof period === 'string' ? period : 'day';
	return validatedFetch(`/profile/leaderboard?period=${p}`, LeaderboardResponseSchema);
};

export interface AchievementDef {
	id: string;
	target: number;
}

export const getAchievementDefs = (): Promise<AchievementDef[]> =>
	validatedFetch('/profile/achievements/defs', z.array(AchievementDefSchema));

export interface CosmeticItem {
	id: string;
	type: 'border' | 'skin';
	name: string;
	cost: number;
	purchased: boolean;
	borderClass?: string;
	skinClass?: string;
}

export const getCosmetics = (): Promise<CosmeticItem[]> =>
	validatedFetch('/profile/cosmetics', z.array(CosmeticItemSchema));

export const purchaseCosmetic = (cosmeticId: string): Promise<SuccessResponse> =>
	validatedFetch('/profile/cosmetics/purchase', SuccessResponseSchema, {
		method: 'POST',
		body: JSON.stringify({ cosmeticId }),
	});

export const equipCosmetic = (
	cosmeticId: string,
	type: 'border' | 'skin',
): Promise<SuccessResponse> =>
	validatedFetch('/profile/cosmetics/equip', SuccessResponseSchema, {
		method: 'POST',
		body: JSON.stringify({ cosmeticId, type }),
	});

export const setEmojiStatus = (emoji: string): Promise<SuccessResponse> =>
	validatedFetch('/profile/emoji-status', SuccessResponseSchema, {
		method: 'POST',
		body: JSON.stringify({ emoji }),
	});

export const createPremiumCheckout = (): Promise<{ invoice_link: string }> =>
	validatedFetch('/profile/premium/checkout', z.object({ invoice_link: z.string() }), {
		method: 'POST',
	});

export const addTaps = async (
	taps: number,
	multiplier: number,
	nonce: string,
	clientTS: number,
	sig: string,
): Promise<ProfileStats> => {
	const stats = await validatedFetch('/profile/tap', ProfileStatsSchema, {
		method: 'POST',
		body: JSON.stringify({ taps, multiplier, nonce, client_ts: clientTS, signature: sig }),
	});
	if (stats.photoUrl !== undefined) {
		setProfilePhotoUrl(stats.photoUrl);
	}
	return stats;
};

export const collectOfflineMining = async (): Promise<{
	earned: number;
	durationSeconds: number;
	sessionCap?: number;
	dailyRemaining?: number;
}> => {
	return validatedFetch(
		'/profile/mining/collect',
		z.object({
			earned: z.number(),
			durationSeconds: z.number(),
			sessionCap: z.number().optional(),
			dailyRemaining: z.number().optional(),
		}),
		{ method: 'POST' },
	);
};

export const startOfflineMining = async (): Promise<SuccessResponse> => {
	return validatedFetch('/profile/mining/start', SuccessResponseSchema, {
		method: 'POST',
	});
};

export const activateTurboServer = (): Promise<SuccessResponse> =>
	validatedFetch('/profile/boosts/daily/turbo', SuccessResponseSchema, { method: 'POST' });

export const activateFullEnergyServer = (): Promise<SuccessResponse> =>
	validatedFetch('/profile/boosts/daily/full-energy', SuccessResponseSchema, { method: 'POST' });

export const getClan = (): Promise<UserClanDetails> =>
	validatedFetch('/profile/clan', UserClanDetailsSchema);

export const joinClan = (username: string): Promise<Clan> =>
	validatedFetch('/profile/clan/join', ClanSchema, {
		method: 'POST',
		body: JSON.stringify({ username }),
	});

export const leaveClan = (): Promise<SuccessResponse> =>
	validatedFetch('/profile/clan/leave', SuccessResponseSchema, {
		method: 'POST',
	});

export const getTopClans = (period?: string | unknown): Promise<Clan[]> => {
	const p = typeof period === 'string' ? period : 'day';
	return validatedFetch(`/profile/clan/top?period=${p}`, z.array(ClanSchema));
};

export const getClanMembers = (clanId?: string, limit?: number): Promise<ClanMember[]> =>
	validatedFetch(
		`/profile/clan/members?clan_id=${clanId || ''}&limit=${limit || 50}`,
		z.array(ClanMemberSchema),
	);

export const deleteAccountGDPR = (): Promise<{ status: string; message: string }> =>
	validatedFetch('/profile/gdpr', z.object({ status: z.string(), message: z.string() }), {
		method: 'DELETE',
	});

export const setLanguage = (language: string): Promise<{ status: string }> =>
	validatedFetch('/profile/language', z.object({ status: z.string() }), {
		method: 'POST',
		body: JSON.stringify({ language }),
	});

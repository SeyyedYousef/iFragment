import * as v from 'valibot';
import { apiFetch } from '@/shared/api/base.js';
import { setProfilePhotoUrl } from '../model/store.js';
import {
	AchievementDefSchema,
	AchievementSchema,
	BoostStatusSchema,
	ClanMemberSchema,
	ClanSchema,
	CosmeticItemSchema,
	DailyStatusSchema,
	EmojiRewardResponseSchema,
	LeaderboardResponseSchema,
	LedgerResponseSchema,
	MyAssetsResponseSchema,
	ProfileStatsSchema,
	ReferralInfoSchema,
	SuccessResponseSchema,
	TaskStatusSchema,
	UserBoostsSchema,
	UserClanDetailsSchema,
} from '../model/schemas.js';
import type {
	Achievement,
	AchievementDef,
	BoostStatus,
	Clan,
	ClanMember,
	CosmeticItem,
	DailyComboStatus,
	DailyStatus,
	EmojiRewardResponse,
	LeaderboardResponse,
	LedgerResponse,
	MyAssetsResponse,
	ProfileStats,
	ReferralInfo,
	SuccessResponse,
	TaskStatus,
	UserBoosts,
	UserClanDetails,
} from '../model/types.js';

// ─── Validated Fetch Helper ───
const validatedFetch = async <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
	endpoint: string,
	schema: T,
	options?: RequestInit,
): Promise<v.InferOutput<T>> => {
	const raw = await apiFetch<unknown>(endpoint, options);
	const result = v.safeParse(schema, raw);
	if (!result.success) {
		console.error(`[API Schema Mismatch] at ${endpoint}:`, result.issues);
		throw new Error(`Server returned invalid data format at ${endpoint}`);
	}
	return result.output;
};

// ─── Validated API Exports ───
export const getProfileStats = async (): Promise<ProfileStats> => {
	const stats = (await validatedFetch('/profile/stats', ProfileStatsSchema)) as ProfileStats;
	if (stats.photoUrl !== undefined) {
		setProfilePhotoUrl(stats.photoUrl);
	}
	return stats;
};

export const getProfileAchievements = (): Promise<Achievement[]> =>
	validatedFetch('/profile/achievements', v.array(AchievementSchema)) as Promise<Achievement[]>;

export const getReferralInfo = (): Promise<ReferralInfo> =>
	validatedFetch('/profile/referral', ReferralInfoSchema) as Promise<ReferralInfo>;

export const getDailyStatus = (): Promise<DailyStatus> =>
	validatedFetch('/profile/daily', DailyStatusSchema) as Promise<DailyStatus>;

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
	validatedFetch('/profile/tasks', v.array(TaskStatusSchema)) as Promise<TaskStatus[]>;

export const completeTask = (taskKey: string, answer?: string): Promise<TaskStatus> =>
	validatedFetch('/profile/tasks/complete', TaskStatusSchema, {
		method: 'POST',
		body: JSON.stringify({ taskKey, answer }),
	}) as Promise<TaskStatus>;

export const getBoostsStatus = (): Promise<BoostStatus[]> =>
	validatedFetch('/profile/boosts', v.array(BoostStatusSchema)) as Promise<BoostStatus[]>;

export const upgradeBoost = (boostType: string): Promise<UserBoosts> =>
	validatedFetch('/profile/boosts/upgrade', UserBoostsSchema, {
		method: 'POST',
		body: JSON.stringify({ boostType }),
	}) as Promise<UserBoosts>;

export const getLeaderboard = (period?: string | unknown, league?: string): Promise<LeaderboardResponse> => {
	const p = typeof period === 'string' ? period : 'day';
	const url = league ? `/profile/leaderboard?period=${p}&league=${encodeURIComponent(league)}` : `/profile/leaderboard?period=${p}`;
	return validatedFetch(url, LeaderboardResponseSchema) as Promise<LeaderboardResponse>;
};

export const getAchievementDefs = (): Promise<AchievementDef[]> =>
	validatedFetch('/profile/achievements/defs', v.array(AchievementDefSchema)) as Promise<AchievementDef[]>;

export const getCosmetics = (): Promise<CosmeticItem[]> =>
	validatedFetch('/profile/cosmetics', v.array(CosmeticItemSchema)) as Promise<CosmeticItem[]>;

export const purchaseCosmetic = (cosmeticId: string): Promise<SuccessResponse> =>
	validatedFetch('/profile/cosmetics/purchase', SuccessResponseSchema, {
		method: 'POST',
		body: JSON.stringify({ cosmeticId }),
	}) as Promise<SuccessResponse>;

export const equipCosmetic = (
	cosmeticId: string,
	type: 'border' | 'skin',
): Promise<SuccessResponse> =>
	validatedFetch('/profile/cosmetics/equip', SuccessResponseSchema, {
		method: 'POST',
		body: JSON.stringify({ cosmeticId, type }),
	}) as Promise<SuccessResponse>;

export const setEmojiStatus = (emoji: string): Promise<SuccessResponse> =>
	validatedFetch('/profile/emoji-status', SuccessResponseSchema, {
		method: 'POST',
		body: JSON.stringify({ emoji }),
	}) as Promise<SuccessResponse>;

export const createPremiumCheckout = (): Promise<{ invoice_link: string }> =>
	validatedFetch('/profile/premium/checkout', v.object({ invoice_link: v.string() }), {
		method: 'POST',
	}) as Promise<{ invoice_link: string }>;

export const addTaps = async (
	taps: number,
	multiplier: number,
	nonce: string,
	clientTS: number,
	sig: string,
): Promise<ProfileStats> => {
	const stats = (await validatedFetch('/profile/tap', ProfileStatsSchema, {
		method: 'POST',
		body: JSON.stringify({ taps, multiplier, nonce, client_ts: clientTS, signature: sig }),
	})) as ProfileStats;
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
		v.object({
			earned: v.number(),
			durationSeconds: v.number(),
			sessionCap: v.optional(v.number()),
			dailyRemaining: v.optional(v.number()),
		}),
		{ method: 'POST' },
	) as Promise<{
		earned: number;
		durationSeconds: number;
		sessionCap?: number;
		dailyRemaining?: number;
	}>;
};

export const startOfflineMining = async (): Promise<SuccessResponse> => {
	return validatedFetch('/profile/mining/start', SuccessResponseSchema, {
		method: 'POST',
	}) as Promise<SuccessResponse>;
};

export const activateTurboServer = (): Promise<SuccessResponse> =>
	validatedFetch('/profile/boosts/daily/turbo', SuccessResponseSchema, { method: 'POST' }) as Promise<SuccessResponse>;

export const activateFullEnergyServer = (): Promise<SuccessResponse> =>
	validatedFetch('/profile/boosts/daily/full-energy', SuccessResponseSchema, { method: 'POST' }) as Promise<SuccessResponse>;

export const getClan = (): Promise<UserClanDetails> =>
	validatedFetch('/profile/clan', UserClanDetailsSchema) as Promise<UserClanDetails>;

export const joinClan = (username: string): Promise<Clan> =>
	validatedFetch('/profile/clan/join', ClanSchema, {
		method: 'POST',
		body: JSON.stringify({ username }),
	}) as Promise<Clan>;

export const leaveClan = (): Promise<SuccessResponse> =>
	validatedFetch('/profile/clan/leave', SuccessResponseSchema, {
		method: 'POST',
	}) as Promise<SuccessResponse>;

export const getTopClans = (period?: string | unknown): Promise<Clan[]> => {
	const p = typeof period === 'string' ? period : 'day';
	return validatedFetch(`/profile/clan/top?period=${p}`, v.array(ClanSchema)) as Promise<Clan[]>;
};

export const getClanMembers = (clanId?: string, limit?: number): Promise<ClanMember[]> =>
	validatedFetch(
		`/profile/clan/members?clan_id=${clanId || ''}&limit=${limit || 50}`,
		v.array(ClanMemberSchema),
	) as Promise<ClanMember[]>;

export const deleteAccountGDPR = (): Promise<{ status: string; message: string }> =>
	validatedFetch('/profile/gdpr', v.object({ status: v.string(), message: v.string() }), {
		method: 'DELETE',
	}) as Promise<{ status: string; message: string }>;

// ─── Unified Financial Ledger API ───
export const getLedger = (
	category?: string,
	cursor?: string,
	limit = 20,
): Promise<LedgerResponse> => {
	const params = new URLSearchParams();
	if (category && category !== 'all') params.set('category', category);
	if (cursor) params.set('cursor', cursor);
	if (limit) params.set('limit', String(limit));
	const queryString = params.toString() ? `?${params.toString()}` : '';
	return validatedFetch(`/profile/ledger${queryString}`, LedgerResponseSchema) as Promise<LedgerResponse>;
};

// ─── My Assets API ───
export const getMyAssets = (): Promise<MyAssetsResponse> =>
	validatedFetch('/profile/assets', MyAssetsResponseSchema) as Promise<MyAssetsResponse>;

// ─── Emoji Status Reward API ───
export const claimEmojiStatusReward = (): Promise<EmojiRewardResponse> =>
	validatedFetch('/profile/emoji-status/claim-reward', EmojiRewardResponseSchema, {
		method: 'POST',
	}) as Promise<EmojiRewardResponse>;

export const sessionsApi = {
	getSessions: () =>
		apiFetch<{ active_sessions_count: number; sessions?: any[] }>('/profile/sessions'),
	revokeAllSessions: () =>
		apiFetch<{ success: boolean; message: string }>('/profile/sessions/revoke-all', {
			method: 'POST',
		}),
};

export const clanApi = {
	getClan: () => getClan(),
	joinClan: (username: string) => joinClan(username),
	leaveClan: () => leaveClan(),
	getTopClans: (period?: string) => getTopClans(period),
};

export const setLanguage = (language: string): Promise<{ status: string }> =>
	validatedFetch('/profile/language', v.object({ status: v.string() }), {
		method: 'POST',
		body: JSON.stringify({ language }),
	}) as Promise<{ status: string }>;

import { apiFetch } from './base.js';
import type { Achievement, ProfileStats, ReferralInfo } from '@/shared/store/profile.js';
import { z } from 'zod';

// ─── Zod Schemas ───
export const UserBoostsSchema = z.object({
  user_id: z.number().int(),
  multitap_level: z.number().int(),
  energy_limit_level: z.number().int(),
  tap_bot_level: z.number().int(),
});

export type UserBoosts = z.infer<typeof UserBoostsSchema>;

export const ProfileStatsSchema = z.object({
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
});

export const AchievementSchema = z.object({
  id: z.string(),
  category: z.enum(['onboarding', 'mining', 'analysis', 'social', 'management', 'streaks', 'special']).optional(),
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
});

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
});

export const UserClanDetailsSchema = z.object({
  clan: ClanSchema.optional(),
  is_member: z.boolean(),
  joined_at: z.string().optional(),
});

// Infer and export types
export type DailyStatus = z.infer<typeof DailyStatusSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type BoostStatus = z.infer<typeof BoostStatusSchema>;
export type LeaderboardMember = z.infer<typeof LeaderboardMemberSchema>;
export type Clan = z.infer<typeof ClanSchema>;
export type UserClanDetails = z.infer<typeof UserClanDetailsSchema>;

// ─── Validated Fetch Helper ───
const validatedFetch = async <T extends z.ZodTypeAny>(
  endpoint: string,
  schema: T,
  options?: RequestInit
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
export const getProfileStats = (): Promise<ProfileStats> => 
  validatedFetch('/profile/stats', ProfileStatsSchema);

export const getProfileAchievements = (): Promise<Achievement[]> => 
  validatedFetch('/profile/achievements', z.array(AchievementSchema));

export const getReferralInfo = (): Promise<ReferralInfo> => 
  validatedFetch('/profile/referral', ReferralInfoSchema);

export const getDailyStatus = (): Promise<DailyStatus> => 
  validatedFetch('/profile/daily', DailyStatusSchema);

export const claimDailyReward = (): Promise<DailyStatus> => 
  validatedFetch('/profile/daily/claim', DailyStatusSchema, { method: 'POST' });

export const getTasksStatus = (): Promise<TaskStatus[]> => 
  validatedFetch('/profile/tasks', z.array(TaskStatusSchema));

export const completeTask = (taskKey: string): Promise<TaskStatus> => 
  validatedFetch('/profile/tasks/complete', TaskStatusSchema, {
    method: 'POST',
    body: JSON.stringify({ taskKey })
  });

export const getBoostsStatus = (): Promise<BoostStatus[]> => 
  validatedFetch('/profile/boosts', z.array(BoostStatusSchema));

export const upgradeBoost = (boostType: string): Promise<UserBoosts> => 
  validatedFetch('/profile/boosts/upgrade', UserBoostsSchema, {
    method: 'POST',
    body: JSON.stringify({ boostType })
  });

export const getLeaderboard = (): Promise<LeaderboardMember[]> => 
  validatedFetch('/profile/leaderboard', z.array(LeaderboardMemberSchema));

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

export const purchaseCosmetic = (cosmeticId: string): Promise<any> => 
  validatedFetch('/profile/cosmetics/purchase', z.any(), {
    method: 'POST',
    body: JSON.stringify({ cosmeticId })
  });

export const equipCosmetic = (cosmeticId: string, type: 'border' | 'skin'): Promise<any> => 
  validatedFetch('/profile/cosmetics/equip', z.any(), {
    method: 'POST',
    body: JSON.stringify({ cosmeticId, type })
  });

export const setEmojiStatus = (emoji: string): Promise<any> => 
  validatedFetch('/profile/emoji-status', z.any(), {
    method: 'POST',
    body: JSON.stringify({ emoji })
  });

export const createPremiumCheckout = (): Promise<{ invoice_link: string }> => 
  validatedFetch('/profile/premium/checkout', z.object({ invoice_link: z.string() }), {
    method: 'POST'
  });

export const addTaps = (taps: number): Promise<ProfileStats> => 
  validatedFetch('/profile/tap', ProfileStatsSchema, {
    method: 'POST',
    body: JSON.stringify({ taps })
  });

export const getClan = (): Promise<UserClanDetails> => 
  validatedFetch('/profile/clan', UserClanDetailsSchema);

export const joinClan = (username: string): Promise<any> => 
  validatedFetch('/profile/clan/join', z.any(), {
    method: 'POST',
    body: JSON.stringify({ username })
  });

export const leaveClan = (): Promise<any> => 
  validatedFetch('/profile/clan/leave', z.any(), {
    method: 'POST'
  });

export const getTopClans = (): Promise<Clan[]> => 
  validatedFetch('/profile/clan/top', z.array(ClanSchema));

export const deleteAccountGDPR = (): Promise<{ status: string; message: string }> =>
  validatedFetch(
    '/profile/gdpr',
    z.object({ status: z.string(), message: z.string() }),
    { method: 'DELETE' }
  );

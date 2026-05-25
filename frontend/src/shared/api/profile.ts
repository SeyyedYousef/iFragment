import { apiFetch } from './base.js';
import type { Achievement, ProfileStats, ReferralInfo } from '@/shared/store/profile.js';
import { z } from 'zod';

export const UserBoostsSchema = z.object({
  user_id: z.number().int(),
  multitap_level: z.number().int(),
  energy_limit_level: z.number().int(),
  tap_bot_level: z.number().int(),
});

export type UserBoosts = z.infer<typeof UserBoostsSchema>;

export const getProfileStats = async (): Promise<ProfileStats> => {
  // Simulate network delay in dev for smooth transitions
  if (import.meta.env.DEV) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return apiFetch<ProfileStats>('/profile/stats');
};

export const getProfileAchievements = async (): Promise<Achievement[]> => {
  if (import.meta.env.DEV) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return apiFetch<Achievement[]>('/profile/achievements');
};

export const getReferralInfo = async (): Promise<ReferralInfo> => {
  if (import.meta.env.DEV) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return apiFetch<ReferralInfo>('/profile/referral');
};

// Gamification API wrappers
export interface DailyStatus {
  streak: number;
  frg_reward: number;
  xp_reward: number;
  claimed: boolean;
  can_claim: boolean;
  time_left_seconds?: number;
}

export interface TaskStatus {
  key: string;
  title: string;
  reward_frg: number;
  reward_xp: number;
  completed: boolean;
}

export interface BoostStatus {
  type: string;
  title: string;
  current_level: number;
  next_level: number;
  price_frg: number;
  max_level: boolean;
}

export interface LeaderboardMember {
  rank: number;
  user_id: number;
  first_name: string;
  username: string;
  level: number;
  xp: number;
}

export const getDailyStatus = async (): Promise<DailyStatus> => {
  return apiFetch<DailyStatus>('/profile/daily');
};

export const claimDailyReward = async (): Promise<DailyStatus> => {
  return apiFetch<DailyStatus>('/profile/daily/claim', { method: 'POST' });
};

export const getTasksStatus = async (): Promise<TaskStatus[]> => {
  return apiFetch<TaskStatus[]>('/profile/tasks');
};

export const completeTask = async (taskKey: string): Promise<TaskStatus> => {
  return apiFetch<TaskStatus>('/profile/tasks/complete', {
    method: 'POST',
    body: JSON.stringify({ taskKey })
  });
};

export const getBoostsStatus = async (): Promise<BoostStatus[]> => {
  return apiFetch<BoostStatus[]>('/profile/boosts');
};

export const upgradeBoost = async (boostType: string): Promise<UserBoosts> => {
  const raw = await apiFetch<unknown>('/profile/boosts/upgrade', {
    method: 'POST',
    body: JSON.stringify({ boostType })
  });
  return UserBoostsSchema.parse(raw);
};

export const getLeaderboard = async (): Promise<LeaderboardMember[]> => {
  return apiFetch<LeaderboardMember[]>('/profile/leaderboard');
};

export interface AchievementDef {
  id: string;
  target: number;
}

export const getAchievementDefs = async (): Promise<AchievementDef[]> => {
  return apiFetch<AchievementDef[]>('/profile/achievements/defs');
};

export interface CosmeticItem {
  id: string;
  type: 'border' | 'skin';
  name: string;
  cost: number;
  purchased: boolean;
  borderClass?: string;
  skinClass?: string;
}

export const getCosmetics = async (): Promise<CosmeticItem[]> => {
  return apiFetch<CosmeticItem[]>('/profile/cosmetics');
};

export const purchaseCosmetic = async (cosmeticId: string): Promise<any> => {
  return apiFetch<any>('/profile/cosmetics/purchase', {
    method: 'POST',
    body: JSON.stringify({ cosmeticId })
  });
};

export const equipCosmetic = async (cosmeticId: string, type: 'border' | 'skin'): Promise<any> => {
  return apiFetch<any>('/profile/cosmetics/equip', {
    method: 'POST',
    body: JSON.stringify({ cosmeticId, type })
  });
};

export const setEmojiStatus = async (emoji: string): Promise<any> => {
  return apiFetch<any>('/profile/emoji-status', {
    method: 'POST',
    body: JSON.stringify({ emoji })
  });
};

export const createPremiumCheckout = async (): Promise<{ invoice_link: string }> => {
  return apiFetch<{ invoice_link: string }>('/profile/premium/checkout', {
    method: 'POST'
  });
};

export const addTaps = async (taps: number): Promise<ProfileStats> => {
  return apiFetch<ProfileStats>('/profile/tap', {
    method: 'POST',
    body: JSON.stringify({ taps })
  });
};

export interface UserClanDetails {
  clan?: {
    id: string;
    telegram_channel_id: number;
    channel_username: string;
    channel_photo?: string;
    chat_title: string;
    members_count: number;
  };
  is_member: boolean;
  joined_at?: string;
}

export const getClan = async (): Promise<UserClanDetails> => {
  return apiFetch<UserClanDetails>('/profile/clan');
};

export const joinClan = async (username: string): Promise<any> => {
  return apiFetch<any>('/profile/clan/join', {
    method: 'POST',
    body: JSON.stringify({ username })
  });
};

export const leaveClan = async (): Promise<any> => {
  return apiFetch<any>('/profile/clan/leave', {
    method: 'POST'
  });
};

export interface Clan {
  id: string;
  telegram_channel_id: number;
  channel_username: string;
  channel_photo?: string;
  chat_title: string;
  members_count: number;
}

export const getTopClans = async (): Promise<Clan[]> => {
  return apiFetch<Clan[]>('/profile/clan/top');
};


import { apiFetch } from './base.js';
import type { Achievement, ProfileStats, ReferralInfo } from '@/shared/store/profile.js';

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

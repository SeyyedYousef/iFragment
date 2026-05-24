/**
 * Profile Store — Signals for profile-related state
 * Uses localStorage for persistence (same pattern as airdrop store)
 */
import { createSignal, createEffect, createRoot } from 'solid-js';

// ─── Types ───
export interface Achievement {
  id: string;
  category: 'onboarding' | 'mining' | 'analysis' | 'social' | 'management' | 'streaks' | 'special';
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;
  target: number;
}

export interface ProfileStats {
  usernamesAnalyzed: number;
  groupsManaged: number;
  channelsManaged: number;
  daysActive: number;
  currentStreak: number;
  globalRank: number;
  totalTaps: number;
  totalFrgEarned: number;
  totalFrgSpent: number;
  frgBalance: number;
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
}

export interface ReferralInfo {
  referralCode: string;
  totalInvited: number;
  totalEarned: number;
  friends: { id: number; name: string; avatar?: string; joinedAt: string; earned: number }[];
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

// ─── Load State ───
const loadProfileState = (): Partial<ProfileSettings> => {
  try {
    const data = localStorage.getItem('profile-settings');
    if (data) return JSON.parse(data);
  } catch {}
  return {};
};

const saved = loadProfileState();

// ─── Settings Signals ───
export const [profileSettings, setProfileSettings] = createSignal<ProfileSettings>({
  notifications: {
    mining: saved.notifications?.mining ?? true,
    referral: saved.notifications?.referral ?? true,
    community: saved.notifications?.community ?? true,
    promotions: saved.notifications?.promotions ?? false,
  },
  hapticEnabled: saved.hapticEnabled ?? true,
  soundEnabled: saved.soundEnabled ?? true,
  autoPlayAnimations: saved.autoPlayAnimations ?? true,
  biometricEnabled: saved.biometricEnabled ?? false,
});

export const updateSetting = <K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]) => {
  setProfileSettings(prev => ({ ...prev, [key]: value }));
};

export const updateNotification = (key: keyof ProfileSettings['notifications'], value: boolean) => {
  setProfileSettings(prev => ({
    ...prev,
    notifications: { ...prev.notifications, [key]: value },
  }));
};

// ─── Levels ───
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

export const getLevelInfo = (xp: number) => {
  let current = LEVELS[0];
  let next = LEVELS[1];
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].xpRequired) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || LEVELS[i];
    }
  }
  const progress = next.xpRequired === current.xpRequired
    ? 100
    : Math.floor(((xp - current.xpRequired) / (next.xpRequired - current.xpRequired)) * 100);
  return { current, next, progress: Math.min(100, Math.max(0, progress)) };
};

// ─── Achievement Definitions ───
export const ACHIEVEMENT_DEFS: Omit<Achievement, 'unlocked' | 'unlockedAt' | 'progress'>[] = [
  { id: 'first_steps', category: 'onboarding', icon: '🐣', target: 1 },
  { id: 'home_base', category: 'onboarding', icon: '🏠', target: 1 },
  { id: 'tap_novice', category: 'mining', icon: '⛏️', target: 1000 },
  { id: 'mining_machine', category: 'mining', icon: '🤖', target: 100000 },
  { id: 'frg_millionaire', category: 'mining', icon: '💎', target: 1000000 },
  { id: 'first_scan', category: 'analysis', icon: '🔬', target: 1 },
  { id: 'whale_hunter', category: 'analysis', icon: '🐋', target: 100 },
  { id: 'data_scientist', category: 'analysis', icon: '🧪', target: 500 },
  { id: 'social_butterfly', category: 'social', icon: '🦋', target: 5 },
  { id: 'army_builder', category: 'social', icon: '🪖', target: 50 },
  { id: 'network_king', category: 'social', icon: '👑', target: 200 },
  { id: 'group_guardian', category: 'management', icon: '🛡️', target: 1 },
  { id: 'channel_commander', category: 'management', icon: '📡', target: 1 },
  { id: 'empire_builder', category: 'management', icon: '🏰', target: 10 },
  { id: 'week_warrior', category: 'streaks', icon: '🗓️', target: 7 },
  { id: 'month_master', category: 'streaks', icon: '📅', target: 30 },
  { id: 'legendary', category: 'streaks', icon: '🌟', target: 100 },
  { id: 'early_adopter', category: 'special', icon: '🎖️', target: 1 },
  { id: 'premium_user', category: 'special', icon: '💫', target: 1 },
  { id: 'bug_hunter', category: 'special', icon: '🐛', target: 1 },
];

// ─── Persist Settings ───
export const initProfileSync = () => {
  createRoot(() => {
    createEffect(() => {
      const state = profileSettings();
      setTimeout(() => {
        localStorage.setItem('profile-settings', JSON.stringify(state));
      }, 500);
    });
  });
};

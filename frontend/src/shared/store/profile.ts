/**
 * Profile Store — Signals for profile-related state
 * Uses localStorage for persistence (same pattern as airdrop store)
 */
import { createEffect, createRoot, createSignal, onCleanup } from 'solid-js';
import { z } from 'zod';

// ─── Types ───
export interface Achievement {
	id: string;
	category?: 'onboarding' | 'mining' | 'analysis' | 'social' | 'management' | 'streaks' | 'special';
	icon?: string;
	unlocked: boolean;
	unlockedAt?: string | null;
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
	energy?: number;
	energyUpdatedAt?: string;
	photoUrl?: string;
	dailyTappedCoins?: number;
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

const ProfileSettingsSchema = z.object({
	notifications: z
		.object({
			mining: z.boolean(),
			referral: z.boolean(),
			community: z.boolean(),
			promotions: z.boolean(),
		})
		.partial()
		.optional(),
	hapticEnabled: z.boolean().optional(),
	soundEnabled: z.boolean().optional(),
	autoPlayAnimations: z.boolean().optional(),
	biometricEnabled: z.boolean().optional(),
});

const STORAGE_KEY = 'profile-settings';
const STORAGE_VERSION = 2;

// ─── Load State ───
const loadProfileState = (): Partial<ProfileSettings> => {
	if (typeof window === 'undefined' || !window.localStorage) return {};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		if (parsed?._v !== STORAGE_VERSION) {
			localStorage.removeItem(STORAGE_KEY);
			return {};
		}
		const result = ProfileSettingsSchema.safeParse(parsed.data);
		if (!result.success) {
			console.warn('[profile-store] corrupted localStorage, wiping');
			localStorage.removeItem(STORAGE_KEY);
			return {};
		}
		return result.data as Partial<ProfileSettings>;
	} catch (e) {
		console.warn('[profile-store] load failed', e);
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {}
		return {};
	}
};

const saved = loadProfileState();

const loadCachedPhotoUrl = (): string => {
	if (typeof window === 'undefined' || !window.localStorage) return '';
	try {
		const raw = localStorage.getItem('cached_profile_stats');
		if (raw) {
			const parsed = JSON.parse(raw);
			return typeof parsed?.photoUrl === 'string' ? parsed.photoUrl : '';
		}
	} catch {}
	return '';
};

export const [profilePhotoUrl, setProfilePhotoUrl] = createSignal<string>(loadCachedPhotoUrl());

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

export const updateSetting = <K extends keyof ProfileSettings>(
	key: K,
	value: ProfileSettings[K],
) => {
	setProfileSettings((prev) => ({ ...prev, [key]: value }));
};

export const updateNotification = (key: keyof ProfileSettings['notifications'], value: boolean) => {
	setProfileSettings((prev) => ({
		...prev,
		notifications: { ...(prev.notifications || {}), [key]: value },
	}));
};

export const resetProfileSettings = () => {
	setProfileSettings({
		notifications: {
			mining: true,
			referral: true,
			community: true,
			promotions: false,
		},
		hapticEnabled: true,
		soundEnabled: true,
		autoPlayAnimations: true,
		biometricEnabled: false,
	});
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

// ─── Achievement Definitions ───
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

// ─── Persist Settings ───
let _disposeFn: (() => void) | null = null;

export const initProfileSync = () => {
	if (_disposeFn) return _disposeFn; // idempotent
	_disposeFn = createRoot((dispose) => {
		let saveTimer: ReturnType<typeof setTimeout> | null = null;

		const flushSave = (state: ProfileSettings) => {
			if (typeof window === 'undefined' || !window.localStorage) return;
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify({ _v: STORAGE_VERSION, data: state }));
			} catch (e) {
				console.warn('localStorage write failed', e);
			}
		};

		createEffect(() => {
			const state = profileSettings();
			if (saveTimer) clearTimeout(saveTimer);
			saveTimer = setTimeout(() => {
				flushSave(state);
				saveTimer = null;
			}, 500);
		});

		onCleanup(() => {
			if (saveTimer) {
				clearTimeout(saveTimer);
				flushSave(profileSettings());
			}
		});

		return dispose;
	});
	return _disposeFn;
};

export const teardownProfileSync = () => {
	if (_disposeFn) {
		_disposeFn();
		_disposeFn = null;
	}
};

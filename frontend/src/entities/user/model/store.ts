/**
 * Profile Store — Signals for profile-related state
 * Uses localStorage for persistence with strict User ID scoping
 * and a formal Save / Discard state machine.
 */
import { createEffect, createRoot, createSignal, onCleanup } from 'solid-js';
import * as v from 'valibot';
import { ProfileSettingsSchema } from './schemas.js';
import type { ProfileSettings } from './types.js';

const STORAGE_KEY = 'profile-settings';
const STORAGE_VERSION = 2;

const defaultSettings: ProfileSettings = {
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
};

// ─── Load State ───
const loadProfileState = (): ProfileSettings => {
	if (typeof window === 'undefined' || !window.localStorage) return { ...defaultSettings };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...defaultSettings };
		const parsed = JSON.parse(raw);
		if (parsed?._v !== STORAGE_VERSION) {
			localStorage.removeItem(STORAGE_KEY);
			return { ...defaultSettings };
		}
		const result = v.safeParse(ProfileSettingsSchema, parsed.data);
		if (!result.success) {
			console.warn('[profile-store] corrupted localStorage, wiping');
			localStorage.removeItem(STORAGE_KEY);
			return { ...defaultSettings };
		}
		return {
			...defaultSettings,
			...(result.output || {}),
			notifications: {
				...defaultSettings.notifications,
				...((result.output as any)?.notifications || {}),
			},
		};
	} catch (e) {
		console.warn('[profile-store] load failed', e);
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {}
		return { ...defaultSettings };
	}
};

const savedState = loadProfileState();

const loadCachedPhotoUrl = (): string => {
	if (typeof window === 'undefined' || !window.localStorage) return '';
	try {
		const storedUserId = localStorage.getItem('tg_user_id');
		if (!storedUserId) return '';
		const key = `cached_profile_stats_${storedUserId}`;
		const raw = localStorage.getItem(key);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (parsed?.telegramId && String(parsed.telegramId) === storedUserId) {
				return typeof parsed?.photoUrl === 'string' ? parsed.photoUrl : '';
			}
		}
	} catch {}
	return '';
};

export const [profilePhotoUrl, setProfilePhotoUrl] = createSignal<string>(loadCachedPhotoUrl());

// ─── Saved vs Draft Settings Signals ───
export const [profileSettings, setProfileSettings] = createSignal<ProfileSettings>(savedState);
export const [draftProfileSettings, setDraftProfileSettings] = createSignal<ProfileSettings>(
	JSON.parse(JSON.stringify(savedState)),
);

/**
 * Initialize draft settings from current saved settings
 */
export const initDraftSettings = () => {
	setDraftProfileSettings(JSON.parse(JSON.stringify(profileSettings())));
};

/**
 * Update a field in the draft settings (does not persist immediately)
 */
export const updateDraftSetting = <K extends keyof ProfileSettings>(
	key: K,
	value: ProfileSettings[K],
) => {
	setDraftProfileSettings((prev) => ({ ...prev, [key]: value }));
};

/**
 * Update a notification toggle in the draft settings
 */
export const updateDraftNotification = (
	key: keyof ProfileSettings['notifications'],
	value: boolean,
) => {
	setDraftProfileSettings((prev) => ({
		...prev,
		notifications: { ...(prev.notifications || {}), [key]: value },
	}));
};

/**
 * Check if the draft settings differ from the committed saved settings
 */
export const isSettingsDirty = (): boolean => {
	return JSON.stringify(profileSettings()) !== JSON.stringify(draftProfileSettings());
};

/**
 * Persist an exact ProfileSettings object to localStorage
 */
const persistSettings = (state: ProfileSettings) => {
	if (typeof window === 'undefined' || !window.localStorage) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ _v: STORAGE_VERSION, data: state }));
	} catch (e) {
		console.warn('localStorage write failed', e);
	}
};

/**
 * Commit draft settings into saved settings and persist to localStorage
 */
export const commitDraftSettings = (): ProfileSettings => {
	const committed = JSON.parse(JSON.stringify(draftProfileSettings()));
	setProfileSettings(committed);
	persistSettings(committed);
	return committed;
};

/**
 * Discard draft settings and rollback to currently saved settings
 */
export const discardDraftSettings = (): ProfileSettings => {
	const reverted = JSON.parse(JSON.stringify(profileSettings()));
	setDraftProfileSettings(reverted);
	return reverted;
};

/**
 * Legacy immediate update setting helper (also syncs draft and persists)
 */
export const updateSetting = <K extends keyof ProfileSettings>(
	key: K,
	value: ProfileSettings[K],
) => {
	setProfileSettings((prev) => {
		const next = { ...prev, [key]: value };
		persistSettings(next);
		return next;
	});
	setDraftProfileSettings((prev) => ({ ...prev, [key]: value }));
};

/**
 * Legacy immediate update notification helper (also syncs draft and persists)
 */
export const updateNotification = (
	key: keyof ProfileSettings['notifications'],
	value: boolean,
) => {
	setProfileSettings((prev) => {
		const next = {
			...prev,
			notifications: { ...(prev.notifications || {}), [key]: value },
		};
		persistSettings(next);
		return next;
	});
	setDraftProfileSettings((prev) => ({
		...prev,
		notifications: { ...(prev.notifications || {}), [key]: value },
	}));
};

export const resetProfileSettings = () => {
	const reset = { ...defaultSettings };
	setProfileSettings(reset);
	setDraftProfileSettings(JSON.parse(JSON.stringify(reset)));
	persistSettings(reset);
};

/**
 * Completely purges all user-specific and profile cache from localStorage and signals.
 * Used upon account deletion, switch, or logout to prevent data leakage.
 */
export const purgeAllUserCache = (explicitUserId?: string | number) => {
	if (typeof window === 'undefined' || !window.localStorage) return;
	try {
		const uid = explicitUserId || localStorage.getItem('tg_user_id');
		if (uid) {
			localStorage.removeItem(`cached_profile_stats_${uid}`);
			localStorage.removeItem(`cached_profile_achievements_${uid}`);
			localStorage.removeItem(`ifragment_profile_stats_${uid}`);
		}
		// Generic keys (for total purge)
		localStorage.removeItem('cached_profile_stats');
		localStorage.removeItem('cached_profile_achievements');
		localStorage.removeItem('profile-cache');
		localStorage.removeItem(STORAGE_KEY);
		localStorage.removeItem('kyc_verified');
		localStorage.removeItem('access_token');
		localStorage.removeItem('refresh_token');
		localStorage.removeItem('tg_user_id');

		if (typeof window.sessionStorage !== 'undefined') {
			sessionStorage.clear();
		}

		setProfilePhotoUrl('');
		resetProfileSettings();
	} catch (e) {
		console.warn('purgeAllUserCache failed', e);
	}
};

// ─── Persist Settings Lifecycle ───
let _disposeFn: (() => void) | null = null;

export const initProfileSync = () => {
	if (_disposeFn) return _disposeFn;
	_disposeFn = createRoot((dispose) => {
		onCleanup(() => {
			persistSettings(profileSettings());
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

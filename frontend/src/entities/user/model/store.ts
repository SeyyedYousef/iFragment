/**
 * Profile Store — Signals for profile-related state
 * Uses localStorage for persistence
 */
import { createEffect, createRoot, createSignal, onCleanup } from 'solid-js';
import * as v from 'valibot';
import { ProfileSettingsSchema } from './schemas.js';
import type { ProfileSettings } from './types.js';

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
		const result = v.safeParse(ProfileSettingsSchema, parsed.data);
		if (!result.success) {
			console.warn('[profile-store] corrupted localStorage, wiping');
			localStorage.removeItem(STORAGE_KEY);
			return {};
		}
		return (result.output || {}) as Partial<ProfileSettings>;
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
		const storedUserId = localStorage.getItem('tg_user_id');
		const key = storedUserId ? `cached_profile_stats_${storedUserId}` : 'cached_profile_stats';
		const raw = localStorage.getItem(key) || localStorage.getItem('cached_profile_stats');
		if (raw) {
			const parsed = JSON.parse(raw);
			if (storedUserId && parsed?.telegramId && String(parsed.telegramId) !== storedUserId) {
				return '';
			}
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

// ─── Persist Settings ───
let _disposeFn: (() => void) | null = null;

export const initProfileSync = () => {
	if (_disposeFn) return _disposeFn;
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

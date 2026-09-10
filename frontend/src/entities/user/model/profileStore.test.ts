import { beforeEach, describe, expect, it } from 'vitest';
import {
	commitDraftSettings,
	discardDraftSettings,
	draftProfileSettings,
	initDraftSettings,
	isSettingsDirty,
	profileSettings,
	purgeAllUserCache,
	resetProfileSettings,
	updateDraftNotification,
	updateDraftSetting,
	updateNotification,
	updateSetting,
} from './store.js';

describe('Profile Store State Machine and Cache Isolation', () => {
	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
		resetProfileSettings();
		initDraftSettings();
	});

	it('should initialize draft settings matching saved settings', () => {
		const saved = profileSettings();
		const draft = draftProfileSettings();

		expect(draft.hapticEnabled).toBe(saved.hapticEnabled);
		expect(draft.soundEnabled).toBe(saved.soundEnabled);
		expect(draft.autoPlayAnimations).toBe(saved.autoPlayAnimations);
		expect(isSettingsDirty()).toBe(false);
	});

	it('should mark dirty when modifying draft settings without modifying saved settings', () => {
		updateDraftSetting('soundEnabled', false);

		expect(isSettingsDirty()).toBe(true);
		expect(draftProfileSettings().soundEnabled).toBe(false);
		expect(profileSettings().soundEnabled).toBe(true); // saved remains untouched
	});

	it('should discard draft changes and revert to saved settings', () => {
		updateDraftSetting('soundEnabled', false);
		updateDraftNotification('mining', false);
		expect(isSettingsDirty()).toBe(true);

		discardDraftSettings();

		expect(isSettingsDirty()).toBe(false);
		expect(draftProfileSettings().soundEnabled).toBe(true);
		expect(draftProfileSettings().notifications.mining).toBe(true);
	});

	it('should commit draft settings to saved settings and persist to localStorage', () => {
		updateDraftSetting('soundEnabled', false);
		updateDraftNotification('mining', false);

		commitDraftSettings();

		expect(isSettingsDirty()).toBe(false);
		expect(profileSettings().soundEnabled).toBe(false);
		expect(profileSettings().notifications.mining).toBe(false);

		const raw = localStorage.getItem('profile-settings');
		expect(raw).toBeTruthy();
		const parsed = JSON.parse(raw!);
		expect(parsed.data.soundEnabled).toBe(false);
		expect(parsed.data.notifications.mining).toBe(false);
	});

	it('should isolate and purge all user cache on purgeAllUserCache', () => {
		const testUserId = 987654321;
		localStorage.setItem(`cached_profile_stats_${testUserId}`, JSON.stringify({ telegramId: testUserId }));
		localStorage.setItem(`cached_profile_achievements_${testUserId}`, JSON.stringify([{ id: 1 }]));
		localStorage.setItem('cached_profile_stats', 'leak');
		localStorage.setItem('cached_profile_achievements', 'leak');
		localStorage.setItem('access_token', 'jwt_secret');
		localStorage.setItem('refresh_token', 'rt_secret');
		localStorage.setItem('tg_user_id', String(testUserId));
		sessionStorage.setItem('impersonated_username', 'test_imp');

		purgeAllUserCache(testUserId);

		expect(localStorage.getItem(`cached_profile_stats_${testUserId}`)).toBeNull();
		expect(localStorage.getItem(`cached_profile_achievements_${testUserId}`)).toBeNull();
		expect(localStorage.getItem('cached_profile_stats')).toBeNull();
		expect(localStorage.getItem('cached_profile_achievements')).toBeNull();
		expect(localStorage.getItem('access_token')).toBeNull();
		expect(localStorage.getItem('refresh_token')).toBeNull();
		expect(localStorage.getItem('tg_user_id')).toBeNull();
		expect(sessionStorage.getItem('impersonated_username')).toBeNull();
	});
});

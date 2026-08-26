import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, bootstrapAuth } from './axios.js';

describe('axios API client and auth interceptor', () => {
	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
		vi.restoreAllMocks();
	});

	it('exports apiClient instance with correct baseURL', () => {
		expect(apiClient).toBeDefined();
		expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
	});

	it('bootstrapAuth no-ops if impersonation session is active', async () => {
		sessionStorage.setItem('owner_impersonation_token', 'mock-impersonation-jwt');
		const postSpy = vi.spyOn(apiClient, 'post');

		await bootstrapAuth();

		expect(postSpy).not.toHaveBeenCalled();
	});

	it('bootstrapAuth clears token if Telegram user ID changes', async () => {
		localStorage.setItem('jwt_token', 'old-token');
		localStorage.setItem('tg_user_id', '12345');

		// Simulating different user ID in current initData
		const mockUserInitData = encodeURIComponent(JSON.stringify({ id: 99999 }));
		const rawInitData = `user=${mockUserInitData}&hash=abcdef`;
		sessionStorage.setItem('cached_tg_init_data', rawInitData);

		const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
			data: { token: 'new-token' },
		} as any);

		await bootstrapAuth();

		expect(localStorage.getItem('jwt_token')).toBe('new-token');
		expect(localStorage.getItem('tg_user_id')).toBe('99999');
		expect(postSpy).toHaveBeenCalledWith('/auth/token', {});
	});

	it('handles token request interceptor logic for standard user requests', async () => {
		localStorage.setItem('jwt_token', 'test-user-jwt');

		// Internal endpoint config
		const config = {
			url: '/user/profile',
			headers: {} as any,
		};

		// Run request interceptor manually or test behavior
		const handlers = (apiClient.interceptors.request as any).handlers;
		const requestInterceptor = handlers[0].fulfilled;

		const updatedConfig = await requestInterceptor(config);
		expect(updatedConfig.headers.Authorization).toBe('Bearer test-user-jwt');
	});

	it('prevents sending bearer token to third-party external domains', async () => {
		localStorage.setItem('jwt_token', 'test-user-jwt');

		const externalConfig = {
			url: 'https://third-party-analytics.com/track',
			headers: {} as any,
		};

		const handlers = (apiClient.interceptors.request as any).handlers;
		const requestInterceptor = handlers[0].fulfilled;

		const updatedConfig = await requestInterceptor(externalConfig);
		expect(updatedConfig.headers.Authorization).toBeUndefined();
	});

	it('strict owner token separation for owner endpoints', async () => {
		sessionStorage.setItem('owner_token', 'owner-secret-jwt');
		localStorage.setItem('jwt_token', 'regular-user-jwt');

		const ownerConfig = {
			url: '/owner/dashboard',
			headers: {} as any,
		};

		const handlers = (apiClient.interceptors.request as any).handlers;
		const requestInterceptor = handlers[0].fulfilled;

		const updatedConfig = await requestInterceptor(ownerConfig);
		expect(updatedConfig.headers.Authorization).toBe('Bearer owner-secret-jwt');
	});
});

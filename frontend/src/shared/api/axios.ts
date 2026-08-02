import { retrieveLaunchParams } from '@tma.js/sdk-solid';
import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG } from './config.js';

import { demoAdapter, isDemoRequest } from './demo-adapter.js';

const getInitData = (): string => {
	let initDataStr = '';

	try {
		const raw = retrieveLaunchParams().initDataRaw as string;
		if (raw) initDataStr = raw;
	} catch (_e) {
		// Ignore error
	}

	if (!initDataStr) {
		const tgData = (window as any).Telegram?.WebApp?.initData;
		if (tgData) initDataStr = tgData;
	}

	// Cache in sessionStorage to survive path changes where hash is lost
	if (initDataStr) {
		try {
			sessionStorage.setItem('cached_tg_init_data', initDataStr);
		} catch (_e) {}
		return initDataStr;
	}

	return sessionStorage.getItem('cached_tg_init_data') || '';
};

const getUserIdFromInitData = (initData: string): string | null => {
	try {
		const params = new URLSearchParams(initData);
		const userStr = params.get('user');
		if (userStr) {
			const user = JSON.parse(userStr);
			return user.id ? String(user.id) : null;
		}
	} catch (_e) {}
	return null;
};

// Reset failed initData cache on app load/reload to allow re-authentication attempts
try {
	sessionStorage.removeItem('failed_init_data');
} catch (_e) {}

export const apiClient: AxiosInstance = axios.create({
	baseURL: API_CONFIG.BASE_URL,
	timeout: API_CONFIG.TIMEOUT,
	headers: {
		'Content-Type': 'application/json',
	},
});

const isOwnerPath = (url?: string) => (url ? /\/owner(\/|\?|#|$)/.test(url) : false);
let refreshPromise: Promise<string> | null = null;

// Request Interceptor
apiClient.interceptors.request.use(
	(config: InternalAxiosRequestConfig) => {
		// ⛑ جعبه‌شنی دمو: درخواست هرگز به شبکه نمی‌رود و توکنی هم ضمیمه نمی‌شود
		if (isDemoRequest(config)) {
			config.adapter = demoAdapter as any;
			return config;
		}

		const initData = getInitData();

		// Attempt to retrieve a valid JWT token (Prefer impersonation session token if active, then owner token if administrative path, then standard user token)
		const impersonationToken = sessionStorage.getItem('owner_impersonation_token');
		const isOwnerRequest = isOwnerPath(config.url);
		const ownerToken = isOwnerRequest ? sessionStorage.getItem('owner_token') : null;

		// STRICT TOKEN SEPARATION: administrative requests only send owner token, standard requests only send standard token
		let token = null;
		if (isOwnerRequest) {
			token = ownerToken;
		} else {
			token = impersonationToken || localStorage.getItem('jwt_token');
			if (!impersonationToken && token) {
				const currentUserId = getUserIdFromInitData(initData);
				const storedUserId = localStorage.getItem('tg_user_id');
				if (currentUserId && currentUserId !== storedUserId) {
					console.warn('[API] Telegram account switched, invalidating token');
					token = null;
					localStorage.removeItem('jwt_token');
				}
			}
		}

		// Prevent token leakage to third-party domains
		const url = config.url || '';
		const isAbsoluteUrl = /^(?:[a-z]+:)?\/\//i.test(url);
		const isInternalUrl = !isAbsoluteUrl || url.startsWith(API_CONFIG.BASE_URL);

		if (token && isInternalUrl) {
			config.headers.Authorization = `Bearer ${token}`;
		}

		// Attach Idempotency-Key for mutating administrative operations to prevent duplicate execution
		const reqMethod = (config.method || 'get').toLowerCase();
		if (isOwnerRequest && ['post', 'put', 'patch', 'delete'].includes(reqMethod)) {
			if (!config.headers['Idempotency-Key']) {
				const key =
					typeof crypto !== 'undefined' && crypto.randomUUID
						? crypto.randomUUID()
						: `idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
				config.headers['Idempotency-Key'] = key;
			}
		}

		// Pass Telegram InitData for authentication handshake if available
		// IMPORTANT: Do NOT send initData during impersonation — it contains the owner's
		// identity and would cause the backend to resolve the wrong user.
		if (initData && isInternalUrl && !impersonationToken) {
			config.headers['X-Telegram-Init-Data'] = initData;
		}

		return config;
	},
	(error: AxiosError) => {
		return Promise.reject(error);
	},
);

// Response Interceptor
apiClient.interceptors.response.use(
	(response: AxiosResponse) => {
		return response;
	},
	async (error: AxiosError) => {
		const originalRequest = error.config as InternalAxiosRequestConfig & { _retryCount?: number };
		if (!originalRequest) {
			return Promise.reject(error);
		}

		const maxRetries = 3;
		const baseDelay = 1000; // 1s base delay
		const retryCount = originalRequest._retryCount || 0;
		const reqMethod = (originalRequest.method || 'get').toLowerCase();
		const isIdempotentMethod = ['get', 'head', 'options'].includes(reqMethod);
		const isNetworkOr5xx =
			!error.response || (error.response.status >= 500 && error.response.status < 600);

		// P0-1 FIX: Automatic retry ONLY for idempotent GET/HEAD/OPTIONS requests. Never auto-retry POST/PUT/PATCH/DELETE.
		if (isIdempotentMethod && isNetworkOr5xx && retryCount < maxRetries) {
			originalRequest._retryCount = retryCount + 1;
			const delay = baseDelay * 2 ** retryCount;
			console.warn(
				`[API] Attempt ${originalRequest._retryCount} failed for ${originalRequest.url}. Retrying in ${delay}ms...`,
			);
			await new Promise((resolve) => setTimeout(resolve, delay));
			return apiClient(originalRequest);
		}

		// P1-F4: Silent token refresh when JWT expires (Bypassed for administrative owner requests which require MFA)
		const isOwnerRequest = isOwnerPath(originalRequest.url);
		const isImpersonating =
			!isOwnerRequest && !!sessionStorage.getItem('owner_impersonation_token');

		if (error.response?.status === 401 && !(originalRequest as any)._isRetryForAuth) {
			if (isOwnerRequest) {
				// Owner tokens are not silently refreshed via Telegram initData
			} else if (isImpersonating) {
				console.warn('[API] Impersonation token expired, redirecting back to owner panel');
				sessionStorage.removeItem('owner_impersonation_token');
				sessionStorage.removeItem('impersonated_user_id');
				sessionStorage.removeItem('impersonated_username');
				// Clear cached user data so owner doesn't see stale impersonated data
				localStorage.removeItem('cached_profile_stats');
				localStorage.removeItem('cached_profile_achievements');
				localStorage.removeItem('cached_profile_referral');
				// Redirect back to owner panel
				window.location.href = `${window.location.pathname}#/owner/users`;
				window.location.reload();
			} else {
				(originalRequest as any)._isRetryForAuth = true;
				try {
					const initData = getInitData();
					const failedInitData = sessionStorage.getItem('failed_init_data');
					if (initData && initData !== failedInitData) {
						if (!refreshPromise) {
							// Use apiClient (not raw axios) so request interceptor attaches
							// X-Telegram-Init-Data and Content-Type headers automatically
							refreshPromise = apiClient
								.post('/auth/token', {})
								.then((refreshResponse) => {
									if (refreshResponse.data?.token) {
										localStorage.setItem('jwt_token', refreshResponse.data.token);
										const currentUserId = getUserIdFromInitData(getInitData());
										if (currentUserId) localStorage.setItem('tg_user_id', currentUserId);
										return refreshResponse.data.token as string;
									}
									throw new Error('No token in refresh response');
								})
								.finally(() => {
									refreshPromise = null;
								});
						}

						const newToken = await refreshPromise;
						originalRequest.headers.Authorization = `Bearer ${newToken}`;
						return apiClient(originalRequest);
					} else {
						console.warn('[API] No initData available for token refresh');
						localStorage.removeItem('jwt_token');
					}
				} catch (refreshErr: any) {
					console.warn('[API] Token refresh failed, clearing session');
					localStorage.removeItem('jwt_token');

					const status = refreshErr.response?.status;
					if (status && status >= 400 && status < 500) {
						const currentInitData = getInitData();
						if (currentInitData) {
							sessionStorage.setItem('failed_init_data', currentInitData);
						}
					}
				}
			}
		}

		return Promise.reject(error);
	},
);

/**
 * Proactive auth bootstrap — call at app startup to obtain a JWT
 * before any API request triggers a reactive 401 → refresh loop.
 * Safe to call multiple times; no-ops if a token already exists.
 */
export async function bootstrapAuth(): Promise<void> {
	// Skip bootstrap entirely if an impersonation session is active.
	// The impersonation token in sessionStorage handles auth for all non-owner requests.
	// Running bootstrap would re-authenticate as the real owner via Telegram initData,
	// which would override the impersonation context.
	const isImpersonating = !!sessionStorage.getItem('owner_impersonation_token');
	if (isImpersonating) {
		return;
	}

	const initData = getInitData();
	const existingToken = localStorage.getItem('jwt_token');
	const currentUserId = getUserIdFromInitData(initData);
	const storedUserId = localStorage.getItem('tg_user_id');

	if (existingToken) {
		let hasStartParam = false;
		try {
			const launchParams = retrieveLaunchParams();
			hasStartParam = !!launchParams.tgWebAppStartParam;
		} catch (_e) {}

		if (currentUserId && currentUserId !== storedUserId) {
			console.warn('[Auth] Telegram account switched on bootstrap, clearing old token');
			localStorage.removeItem('jwt_token');
		} else if (hasStartParam && !sessionStorage.getItem('start_param_processed')) {
			console.log(
				'[Auth] start_param detected on startup, forcing bootstrap to process referral/deeplink',
			);
			localStorage.removeItem('jwt_token');
			sessionStorage.setItem('start_param_processed', 'true');
		} else {
			return; // Already authenticated
		}
	}

	if (!initData) return; // No Telegram context available

	try {
		const response = await apiClient.post('/auth/token', {});
		if (response.data?.token) {
			localStorage.setItem('jwt_token', response.data.token);
			if (currentUserId) localStorage.setItem('tg_user_id', currentUserId);
		}
	} catch (err) {
		console.warn('[Auth] Proactive bootstrap failed:', err);
	}
}

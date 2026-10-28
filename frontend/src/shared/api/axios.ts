import { retrieveLaunchParams, retrieveRawInitData } from '@tma.js/sdk-solid';
import axios, {
	type AxiosError,
	type AxiosInstance,
	type AxiosResponse,
	type InternalAxiosRequestConfig,
} from 'axios';
import { API_CONFIG } from './config.js';

export const clearUserSessionData = () => {
	try {
		localStorage.removeItem('jwt_token');
		localStorage.removeItem('tg_user_id');
		localStorage.removeItem('cached_profile_stats');
		localStorage.removeItem('cached_profile_achievements');
		localStorage.removeItem('cached_profile_referral');
		localStorage.removeItem('airdrop-pending-taps');
		sessionStorage.removeItem('cached_tg_init_data');
		sessionStorage.removeItem('cached_tg_init_data_user_id');
		sessionStorage.removeItem('owner_impersonation_token');
		sessionStorage.removeItem('owner_impersonation_expires_at');
		sessionStorage.removeItem('impersonated_user_id');
		sessionStorage.removeItem('impersonated_username');
		sessionStorage.removeItem('impersonated_first_name');
		sessionStorage.removeItem('impersonated_last_name');

		for (let i = localStorage.length - 1; i >= 0; i--) {
			const key = localStorage.key(i);
			if (
				key &&
				(key.startsWith('cached_profile_') ||
					key.startsWith('airdrop-pending-taps') ||
					key.startsWith('val_report_'))
			) {
				localStorage.removeItem(key);
			}
		}
	} catch (_e) {}
};

const getInitData = (): string => {
	let initDataStr = '';

	try {
		const raw = retrieveRawInitData();
		if (raw) initDataStr = raw;
	} catch (_e) {
		try {
			const raw = (retrieveLaunchParams() as any)?.initDataRaw as string;
			if (raw) initDataStr = raw;
		} catch (_err) {
			// Ignore error
		}
	}

	if (!initDataStr) {
		const tgData = (window as any).Telegram?.WebApp?.initData;
		if (tgData) initDataStr = tgData;
	}

	// Cache in sessionStorage to survive path changes where hash is lost
	if (initDataStr) {
		const currentUserId = getUserIdFromInitData(initDataStr);
		const storedUserId = localStorage.getItem('tg_user_id');
		if (currentUserId && storedUserId && currentUserId !== storedUserId) {
			console.warn('[API] Account switch detected in initData, clearing session data');
			clearUserSessionData();
		}
		try {
			sessionStorage.setItem('cached_tg_init_data', initDataStr);
			if (currentUserId) {
				sessionStorage.setItem('cached_tg_init_data_user_id', currentUserId);
			}
		} catch (_e) {}
		return initDataStr;
	}

	const cachedUserId = sessionStorage.getItem('cached_tg_init_data_user_id');
	const storedUserId = localStorage.getItem('tg_user_id');
	if (cachedUserId && storedUserId && cachedUserId !== storedUserId) {
		sessionStorage.removeItem('cached_tg_init_data');
		sessionStorage.removeItem('cached_tg_init_data_user_id');
		return '';
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

export const getActiveImpersonationToken = (): string | null => {
	const token = sessionStorage.getItem('owner_impersonation_token');
	if (!token) return null;
	const expiresAt = sessionStorage.getItem('owner_impersonation_expires_at');
	if (expiresAt && Date.now() > Number(expiresAt)) {
		console.warn('[API] Impersonation token TTL expired, clearing token');
		sessionStorage.removeItem('owner_impersonation_token');
		sessionStorage.removeItem('owner_impersonation_expires_at');
		sessionStorage.removeItem('impersonated_user_id');
		sessionStorage.removeItem('impersonated_username');
		sessionStorage.removeItem('impersonated_first_name');
		sessionStorage.removeItem('impersonated_last_name');
		return null;
	}
	return token;
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

export const publicApi: AxiosInstance = axios.create({
	baseURL: API_CONFIG.BASE_URL,
	timeout: API_CONFIG.TIMEOUT,
	headers: {
		'Content-Type': 'application/json',
	},
});

const isOwnerPath = (url?: string) => (url ? /\/owner(\/|\?|#|$)/.test(url) : false);
let refreshPromise: Promise<string> | null = null;

const MOCK_INIT_DATA_HASH = '89d6079ad6762351f38c6dbbc41bb53048019256a9443988af7a48bcad16ba31';

const getPreviewAuthFallbackData = (url: string): unknown | undefined => {
	const cleanPath = url.split('?')[0].replace(/^.*\/api\/v1/, '');
	if (cleanPath === '/intel/credits') {
		return { balance: 5, next_expiry: null };
	}
	if (cleanPath === '/intel/credits/config') {
		return {
			credits_per_report: 1,
			coins_per_credit: 1000,
			packs: [
				{ id: 'starter', credits: 3, bonus_credits: 0, stars_price: 50 },
				{ id: 'pro', credits: 10, bonus_credits: 2, stars_price: 150, popular: true },
				{ id: 'whale', credits: 30, bonus_credits: 10, stars_price: 400, best_value: true },
			],
		};
	}
	if (cleanPath === '/profile/stats') {
		return {
			telegramId: 5076130392,
			username: 'ifragment',
			firstName: 'iFragment',
			lastName: 'Preview',
			usernamesAnalyzed: 12,
			giftsAppraised: 8,
			daysActive: 14,
			currentStreak: 5,
			globalRank: 42,
			totalTaps: 1500,
			memberSince: '2026-01-01T00:00:00Z',
			level: 4,
			xp: 450,
			xpToNextLevel: 1000,
			isPremium: true,
			emojiStatus: '',
			equippedBorder: '',
			equippedSkin: '',
			airdropCoins: 2500,
			creditExpiresInDays: 30,
			energy: 1000,
			photoUrl: '',
			dailyTappedCoins: 0,
			dailyTurboUsed: 0,
			dailyFullEnergyUsed: 0,
			valuationCredits: 5,
			intelCredits: 5,
		};
	}
	if (cleanPath === '/profile/achievements' || cleanPath === '/profile/achievements/defs') {
		return [];
	}
	if (cleanPath === '/profile/referral') {
		return { referralCode: 'IFRAGMENT', totalInvited: 0, totalEarned: 0, friends: [] };
	}
	if (cleanPath === '/profile/daily') {
		return {
			streak: 5,
			coins_reward: 500,
			xp_reward: 100,
			claimed: false,
			can_claim: true,
			time_left_seconds: 0,
		};
	}
	if (cleanPath === '/profile/daily-combo') {
		return { is_active: false, is_claimed: false, reward: 5000 };
	}
	if (
		cleanPath === '/profile/tasks' ||
		cleanPath === '/profile/boosts' ||
		cleanPath === '/profile/cosmetics'
	) {
		return [];
	}
	if (cleanPath === '/profile/ledger') {
		return { events: [], nextCursor: null, hasMore: false, totalCount: 0 };
	}
	if (cleanPath === '/profile/assets') {
		return {
			reports: [],
			properties: [],
			projects: [],
			boosters: {
				multitapLevel: 1,
				energyLimitLevel: 1,
				tapBotLevel: 0,
				tapBotCapHours: 12,
			},
			summaryText: '',
		};
	}
	if (cleanPath === '/profile/sessions') {
		return { active_sessions_count: 1, sessions: [] };
	}
	if (cleanPath === '/profile/wallet-expiry') {
		return { expiring_soon: false, days_left: 30, expiring_amount: 0 };
	}
	if (cleanPath === '/profile/language') {
		return { status: 'ok' };
	}
	if (cleanPath === '/numbers/watchlist' || cleanPath === '/gifts/watchlist') {
		return { items: [], numbers: [], gifts: [] };
	}
	if (cleanPath === '/usernames/valuation-access') {
		return { has_access: true, free_available: true, credits: 5, airdrop_coins: 2500 };
	}
	return undefined;
};

// Request Interceptor
apiClient.interceptors.request.use(
	(config: InternalAxiosRequestConfig) => {
		const initData = getInitData();
		const isMockInitData = initData.includes(MOCK_INIT_DATA_HASH);

		// Attempt to retrieve a valid JWT token (Prefer impersonation session token if active, then owner token if administrative path, then standard user token)
		const impersonationToken = getActiveImpersonationToken();
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
				if (currentUserId && storedUserId && currentUserId !== storedUserId) {
					console.warn('[API] Telegram account switched, wiping old session data');
					clearUserSessionData();
					token = null;
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

		// Attach Idempotency-Key for ALL mutating operations to prevent duplicate execution and double debits
		const reqMethod = (config.method || 'get').toLowerCase();
		if (['post', 'put', 'patch', 'delete'].includes(reqMethod)) {
			if (!config.headers['Idempotency-Key']) {
				const key =
					typeof crypto !== 'undefined' && crypto.randomUUID
						? crypto.randomUUID()
						: `idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
				config.headers['Idempotency-Key'] = key;
			}
		}

		// When running in browser/AI Studio preview with synthetic mock initData and no real JWT,
		// do not attach the synthetic X-Telegram-Init-Data header (which production rejects with 401),
		// and resolve user-session-only endpoints locally so market intelligence endpoints remain 100% live.
		if (isMockInitData && !token && !isOwnerRequest && isInternalUrl) {
			const previewData = getPreviewAuthFallbackData(url);
			if (previewData !== undefined) {
				config.adapter = async () => ({
					data: previewData,
					status: 200,
					statusText: 'OK',
					headers: {},
					config,
				});
			}
			return config;
		}

		// Pass Telegram InitData for authentication handshake if available
		// IMPORTANT: Do NOT send initData during impersonation — it contains the owner's
		// identity and would cause the backend to resolve the wrong user.
		if (initData && isInternalUrl && !impersonationToken && !isMockInitData) {
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
				sessionStorage.removeItem('owner_impersonation_expires_at');
				sessionStorage.removeItem('impersonated_user_id');
				sessionStorage.removeItem('impersonated_username');
				sessionStorage.removeItem('impersonated_first_name');
				sessionStorage.removeItem('impersonated_last_name');
				// Clear cached user data so owner doesn't see stale impersonated data
				clearUserSessionData();
				// Redirect back to owner panel
				window.location.href = `${window.location.pathname}#/owner/users`;
				window.location.reload();
			} else {
				(originalRequest as any)._isRetryForAuth = true;
				try {
					const initData = getInitData();
					const isMockInitData = initData.includes(MOCK_INIT_DATA_HASH);
					const failedInitData = sessionStorage.getItem('failed_init_data');
					if (isMockInitData) {
						const fallback = getPreviewAuthFallbackData(originalRequest.url || '');
						if (fallback !== undefined) {
							return {
								data: fallback,
								status: 200,
								statusText: 'OK',
								headers: {},
								config: originalRequest,
							};
						}
					} else if (initData && initData !== failedInitData) {
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
						localStorage.removeItem('jwt_token');
					}
				} catch (refreshErr: any) {
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

	// Skip token handshake in browser/preview mock mode where initData has a synthetic signature
	if (initData.includes('89d6079ad6762351f38c6dbbc41bb53048019256a9443988af7a48bcad16ba31')) {
		if (currentUserId) {
			localStorage.setItem('tg_user_id', currentUserId);
		}
		return;
	}

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

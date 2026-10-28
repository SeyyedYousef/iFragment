import { retrieveLaunchParams, retrieveRawInitData } from '@tma.js/sdk-solid';
import { apiClient } from './axios.js';

export const apiFetch = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
	let initDataRaw = '';
	try {
		initDataRaw = retrieveRawInitData() || '';
	} catch (_e) {
		try {
			const params = retrieveLaunchParams() as { initDataRaw?: string };
			initDataRaw = params?.initDataRaw || '';
		} catch {
			// Handled gracefully by axios interceptor
		}
	}

	// Fallback for dev mode if needed
	if (import.meta.env.DEV && !initDataRaw && !(window as any).Telegram?.WebApp?.initData) {
		const devMockId = localStorage.getItem('dev_mock_user_id');
		const devPayload = devMockId ? `dev-user-${devMockId}` : 'dev-user';
		apiClient.defaults.headers.common['X-Telegram-Init-Data'] = devPayload;
	}

	const response = await apiClient({
		url: endpoint,
		method: options.method || 'GET',
		data: options.body,
		headers: options.headers as Record<string, string>,
	});

	return response.data as T;
};

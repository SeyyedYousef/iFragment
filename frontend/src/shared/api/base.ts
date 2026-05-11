import { retrieveLaunchParams } from '@tma.js/sdk-solid';
import { apiClient } from './axios.js';

export const apiFetch = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  let initDataRaw = '';
  try {
    const params = retrieveLaunchParams();
    initDataRaw = (params.initDataRaw as string) || '';
  } catch (e) {
    console.warn('TMA LaunchParams not found, using dev-mode fallback');
  }

  // Fallback for dev mode if needed
  if (import.meta.env.DEV && !initDataRaw && !(window as any).Telegram?.WebApp?.initData) {
     apiClient.defaults.headers.common['X-Telegram-Init-Data'] = 'dev-user';
  }

  const response = await apiClient({
    url: endpoint,
    method: options.method || 'GET',
    data: options.body,
    headers: options.headers as Record<string, string>,
  });

  return response.data as T;
};

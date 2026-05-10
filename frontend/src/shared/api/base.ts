import { retrieveLaunchParams } from '@tma.js/sdk-solid';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export const apiFetch = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  let initDataRaw = '';
  try {
    const params = retrieveLaunchParams();
    initDataRaw = (params.initDataRaw as string) || '';
  } catch (e) {
    // Fallback for non-TMA environment (browser)
    console.warn('TMA LaunchParams not found, using dev-mode fallback');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Telegram-Init-Data': (initDataRaw as string) || (import.meta.env.DEV ? 'dev-user' : ''),
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'API Request failed');
  }

  return response.json() as Promise<T>;
};

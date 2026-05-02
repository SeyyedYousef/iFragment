import { retrieveLaunchParams } from '@tma.js/sdk-solid';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export const apiFetch = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const { initDataRaw } = retrieveLaunchParams();

  const headers = {
    'Content-Type': 'application/json',
    'X-Telegram-Init-Data': initDataRaw || '',
    ...options.headers,
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

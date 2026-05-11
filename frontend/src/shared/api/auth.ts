import { apiClient } from './axios.js';

export const authenticate = async (): Promise<string | null> => {
  // If we already have a valid token (you'd normally check expiration too)
  const existingToken = localStorage.getItem('jwt_token');
  if (existingToken) {
    return existingToken;
  }

  // If no initData, we can't authenticate as Telegram user
  if (!(window as any).Telegram?.WebApp?.initData) {
    return null;
  }

  try {
    const response = await apiClient.post<{ token: string }>('/auth/token');
    const { token } = response.data;
    
    // Save to localStorage
    localStorage.setItem('jwt_token', token);
    
    return token;
  } catch (error) {
    console.error('Authentication failed', error);
    return null;
  }
};

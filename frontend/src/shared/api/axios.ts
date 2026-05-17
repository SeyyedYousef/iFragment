import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import { mockApiLogic } from './mock-api.js';
import { API_CONFIG } from './config.js';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Attempt to retrieve a valid JWT token
    const token = localStorage.getItem('jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Pass Telegram InitData for authentication handshake if available
    if ((window as any).Telegram?.WebApp?.initData) {
      config.headers['X-Telegram-Init-Data'] = (window as any).Telegram.WebApp.initData;
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response Interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Fallback to MOCK data ONLY if enabled in config (Dev/Forced)
    if (API_CONFIG.USE_MOCKS && (!error.response || error.response.status >= 500)) {
      console.warn('⚠️ Backend unreachable or errored, using MOCK data for:', originalRequest.url);
      try {
        const mockData = mockApiLogic(originalRequest.method, originalRequest.url, originalRequest.data);
        return {
          data: mockData,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: originalRequest,
        } as AxiosResponse;
      } catch (mockErr) {
        // If no mock exists, just pass the original error
      }
    }

    // Basic auto-retry logic for network errors
    if (!error.response && !originalRequest._retry) {
      originalRequest._retry = true;
      return apiClient(originalRequest);
    }

    // If unauthorized, could trigger a re-auth flow here
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Trigger token refresh logic or redirect
    }

    return Promise.reject(error);
  }
);

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
    // Attempt to retrieve a valid JWT token (Prefer impersonation session token if active)
    const impersonationToken = localStorage.getItem('owner_impersonation_token');
    const token = impersonationToken || localStorage.getItem('jwt_token');
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
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retryCount?: number };
    if (!originalRequest) {
      return Promise.reject(error);
    }

    const maxRetries = 3;
    const baseDelay = 1000; // 1s base delay
    const retryCount = originalRequest._retryCount || 0;
    const isNetworkOr5xx = !error.response || (error.response.status >= 500 && error.response.status < 600);

    if (isNetworkOr5xx && retryCount < maxRetries) {
      originalRequest._retryCount = retryCount + 1;
      const delay = baseDelay * Math.pow(2, retryCount);
      console.warn(`[API] Attempt ${originalRequest._retryCount} failed for ${originalRequest.url}. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return apiClient(originalRequest);
    }

    // Fallback to MOCK data ONLY if enabled in config (Dev/Forced) and retries failed
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

    // If unauthorized, could trigger a re-auth flow here
    if (error.response?.status === 401 && !originalRequest._retryCount) {
      originalRequest._retryCount = 1; // prevent infinite loops
      // Trigger token refresh logic or redirect
    }

    return Promise.reject(error);
  }
);

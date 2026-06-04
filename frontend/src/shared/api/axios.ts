import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import { retrieveLaunchParams } from '@tma.js/sdk-solid';
import { mockApiLogic } from './mock-api.js';
import { API_CONFIG } from './config.js';

const getInitData = (): string => {
  try {
    const raw = retrieveLaunchParams().initDataRaw as string;
    if (raw) return raw;
  } catch (e) {
    // Ignore error
  }
  
  const tgData = (window as any).Telegram?.WebApp?.initData;
  if (tgData) return tgData;
  
  if (import.meta.env.DEV) {
    return 'dev-user';
  }
  
  return '';
};

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
    // Attempt to retrieve a valid JWT token (Prefer impersonation session token if active, then owner token if administrative path, then standard user token)
    const impersonationToken = sessionStorage.getItem('owner_impersonation_token');
    const isOwnerRequest = config.url?.includes('/owner/');
    const ownerToken = isOwnerRequest ? sessionStorage.getItem('owner_token') : null;
    
    // STRICT TOKEN SEPARATION: administrative requests only send owner token, standard requests only send standard token
    let token = null;
    if (isOwnerRequest) {
      token = impersonationToken || ownerToken;
    } else {
      token = impersonationToken || localStorage.getItem('jwt_token');
    }
    
    // Prevent token leakage to third-party domains
    const url = config.url || '';
    const isAbsoluteUrl = url.startsWith('http://') || url.startsWith('https://');
    const isInternalUrl = !isAbsoluteUrl || url.startsWith(API_CONFIG.BASE_URL);

    if (token && isInternalUrl) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Pass Telegram InitData for authentication handshake if available
    const initData = getInitData();
    if (initData && isInternalUrl) {
      config.headers['X-Telegram-Init-Data'] = initData;
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

    // P1-F4: Silent token refresh when JWT expires (Bypassed for administrative owner requests which require MFA)
    const isOwnerRequest = originalRequest.url?.includes('/owner/');
    if (error.response?.status === 401 && !originalRequest._retryCount && !isOwnerRequest) {
      originalRequest._retryCount = 1;
      try {
        const initData = getInitData();
        if (initData) {
          const tokenUrl = API_CONFIG.BASE_URL.replace(/\/api\/v1\/?$/, '') + '/api/v1/auth/token';
          const refreshResponse = await axios.post(
            tokenUrl,
            {},
            { headers: { 'X-Telegram-Init-Data': initData } }
          );
          if (refreshResponse.data?.token) {
            localStorage.setItem('jwt_token', refreshResponse.data.token);
            originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.token}`;
            return apiClient(originalRequest);
          }
        }
      } catch (refreshErr) {
        console.warn('[API] Token refresh failed, clearing session');
        localStorage.removeItem('jwt_token');
        sessionStorage.removeItem('owner_impersonation_token');
      }
    }

    return Promise.reject(error);
  }
);

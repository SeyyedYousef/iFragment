import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import { retrieveLaunchParams } from '@tma.js/sdk-solid';
import { API_CONFIG } from './config.js';

const getInitData = (): string => {
  let initDataStr = '';

  try {
    const raw = retrieveLaunchParams().initDataRaw as string;
    if (raw) initDataStr = raw;
  } catch (e) {
    // Ignore error
  }
  
  if (!initDataStr) {
    const tgData = (window as any).Telegram?.WebApp?.initData;
    if (tgData) initDataStr = tgData;
  }
  
// Cache in sessionStorage to survive path changes where hash is lost
  if (initDataStr) {
    try { sessionStorage.setItem('cached_tg_init_data', initDataStr); } catch(e) {}
    return initDataStr;
  }
  
  return sessionStorage.getItem('cached_tg_init_data') || '';
};

// Reset failed initData cache on app load/reload to allow re-authentication attempts
try { sessionStorage.removeItem('failed_init_data'); } catch (e) {}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

const isOwnerPath = (url?: string) => url ? /\/owner(\/|\?|#|$)/.test(url) : false;
let refreshPromise: Promise<string> | null = null;

// Request Interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
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
    }
    
    // Prevent token leakage to third-party domains
    const url = config.url || '';
    const isAbsoluteUrl = /^(?:[a-z]+:)?\/\//i.test(url);
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

    // P1-F4: Silent token refresh when JWT expires (Bypassed for administrative owner requests which require MFA)
    const isOwnerRequest = isOwnerPath(originalRequest.url);
    const isImpersonating = !isOwnerRequest && !!sessionStorage.getItem('owner_impersonation_token');

    if (error.response?.status === 401 && !(originalRequest as any)._isRetryForAuth) {
      if (isOwnerRequest) {
        // Owner tokens are not silently refreshed via Telegram initData
      } else if (isImpersonating) {
        console.warn('[API] Impersonation token expired, clearing');
        sessionStorage.removeItem('owner_impersonation_token');
      } else {
        (originalRequest as any)._isRetryForAuth = true;
        try {
          const initData = getInitData();
          const failedInitData = sessionStorage.getItem('failed_init_data');
          if (initData && initData !== failedInitData) {
            if (!refreshPromise) {
              const tokenUrl = API_CONFIG.BASE_URL.replace(/\/api\/v1\/?$/, '') + '/api/v1/auth/token';
              refreshPromise = axios.post(
                tokenUrl,
                {},
                { headers: { 'X-Telegram-Init-Data': initData } }
              ).then(refreshResponse => {
                if (refreshResponse.data?.token) {
                  localStorage.setItem('jwt_token', refreshResponse.data.token);
                  return refreshResponse.data.token as string;
                }
                throw new Error('No token in refresh response');
              }).finally(() => {
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
  }
);

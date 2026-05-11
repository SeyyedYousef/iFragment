import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import { mockApiLogic } from './mock-api.js';

// Ensure the baseURL points to the correct backend API endpoint
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
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

    // Fallback to MOCK data if Network Error or 500 (Server Down)
    if (!error.response || error.response.status >= 500) {
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

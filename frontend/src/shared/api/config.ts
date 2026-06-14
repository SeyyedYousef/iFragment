/**
 * API Configuration
 * 2026 Production Standards
 */

export const API_CONFIG = {
	// detect if running in Telegram Mini App production environment
	IS_PRODUCTION: import.meta.env.PROD,

	// Base URL for real API
	BASE_URL: import.meta.env.VITE_API_URL || 'https://ifragment-api.onrender.com/api/v1',

	// Should we use mocks?
	// Safety: NEVER use mocks in production unless explicitly forced for demo
	USE_MOCKS: import.meta.env.DEV || import.meta.env.VITE_FORCE_MOCKS === 'true',

	TIMEOUT: 15000,
};

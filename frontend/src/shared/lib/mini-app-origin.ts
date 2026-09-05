/**
 * Mini App origin guard (Bot API 10.2 security hardening).
 *
 * Since July 20, 2026 Telegram automatically disallows Mini App methods from
 * origins different from the domain registered in @BotFather. This helper:
 *   1. Detects at runtime whether we are running inside Telegram at all.
 *   2. Warns loudly in the console when the current origin does not match the
 *      production allow-list, so a misconfigured deploy (e.g. preview URL)
 *      is immediately visible instead of failing silently.
 *
 * The app still renders outside Telegram (dev/browser) — only TMA-native
 * features (haptics, BackButton, CloudStorage) degrade there, which the rest
 * of the codebase already handles via optional chaining.
 */

const ALLOWED_MINI_APP_HOSTS = new Set<string>([
	// Production Cloudflare Pages host (must equal the BotFather-registered domain).
	'ifragment.pages.dev',
	'ifragment.app',
	'www.ifragment.app',
]);

export const isTelegramWebApp = (): boolean =>
	typeof window !== 'undefined' &&
	!!(window as any).Telegram?.WebApp?.initData !== undefined &&
	!!(window as any).Telegram?.WebApp;

export const isAllowedMiniAppOrigin = (): boolean => {
	if (typeof window === 'undefined') return true;
	try {
		const host = window.location.hostname.toLowerCase();
		if (ALLOWED_MINI_APP_HOSTS.has(host)) return true;
		// Local development is always fine.
		if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return true;
		return false;
	} catch {
		return true;
	}
};

/** Call once from app init; logs a prominent warning on mismatch. */
export const checkMiniAppOrigin = (): void => {
	if (!isTelegramWebApp()) return; // not inside Telegram → nothing to guard
	if (isAllowedMiniAppOrigin()) return;

	const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
	console.warn(
		`[iFragment] ⚠️ MINI APP ORIGIN MISMATCH: "${origin}" is not in the BotFather allow-list.\n` +
			'Telegram will block native methods here since 2026-07-20.\n' +
			'Fix: update the Mini App domain in @BotFather or deploy to an allowed host.',
	);
};

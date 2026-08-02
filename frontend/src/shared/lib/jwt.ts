/**
 * Safely decodes a Base64URL encoded JWT payload without throwing.
 * Handles UTF-8 decoding and padded Base64 strings correctly.
 */
export function parseJwtPayload<T = Record<string, any>>(token: string): T | null {
	if (!token || typeof token !== 'string') return null;

	try {
		const parts = token.split('.');
		if (parts.length < 2) return null;

		const base64Url = parts[1];
		let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

		while (base64.length % 4 !== 0) {
			base64 += '=';
		}

		const jsonPayload = decodeURIComponent(
			atob(base64)
				.split('')
				.map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
				.join(''),
		);

		return JSON.parse(jsonPayload) as T;
	} catch (_e) {
		return null;
	}
}

/**
 * Checks if a JWT token is expired (or will expire within bufferSeconds).
 */
export function isJwtExpired(token: string, bufferSeconds = 5): boolean {
	const payload = parseJwtPayload<{ exp?: number }>(token);
	if (!payload || typeof payload.exp !== 'number') return false; // Non-standard or untimed token

	const expiresAtMs = payload.exp * 1000;
	return Date.now() >= expiresAtMs - bufferSeconds * 1000;
}

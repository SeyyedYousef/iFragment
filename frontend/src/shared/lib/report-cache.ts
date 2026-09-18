/**
 * 24-hour cache for username valuation reports.
 *
 * A report costs the user Stars, coins or their one free pass, so losing it to a
 * stray back-press is not acceptable. Every successful valuation is stored
 * locally for 24 hours; re-opening the same username inside that window renders
 * instantly from cache instead of re-fetching, and the list of recent reports is
 * shown so the user can walk back into anything they paid for.
 *
 * Entries expire exactly 24 hours after they were written and are pruned on every
 * read, so nothing lingers beyond the promised window.
 */

const getSessionUserId = (): string => {
	try {
		const userId = localStorage.getItem('tg_user_id');
		if (userId && userId.trim() !== '') {
			return userId.trim();
		}
		// RB-P0-009, SEC-P0-003: Never use a shared 'anon' namespace across different users.
		// Use an isolated per-session ephemeral ID so anonymous sessions never share cache.
		let sessionId = sessionStorage.getItem('ephemeral_session_id');
		if (!sessionId) {
			sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
			sessionStorage.setItem('ephemeral_session_id', sessionId);
		}
		return sessionId;
	} catch {
		return 'ephemeral_' + Date.now().toString(36);
	}
};

const getReportPrefix = (): string => `val_report_${getSessionUserId()}_`;
const getIndexKey = (): string => `val_report_index_${getSessionUserId()}`;
export const REPORT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RECENTS = 20;

export interface RecentReport {
	username: string;
	/** Epoch ms when the report was fetched. */
	savedAt: number;
	/** Denormalised so the recents list renders without reading every payload. */
	expectedTon?: string;
	expectedUsd?: string;
	tier?: string;
}

interface CachedReport<T> {
	savedAt: number;
	data: T;
}

const readJson = <T>(key: string): T | null => {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
};

const writeJson = (key: string, value: unknown): void => {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Quota exceeded or storage disabled — caching is a convenience, never a
		// requirement, so this stays silent.
	}
};

const removeKey = (key: string): void => {
	try {
		localStorage.removeItem(key);
	} catch {}
};

const normalize = (username: string): string => username.trim().replace(/^@/, '').toLowerCase();

const isExpired = (savedAt: number, now: number): boolean => now - savedAt >= REPORT_TTL_MS;

/**
 * Returns the still-valid recent reports, newest first, and removes any that have
 * passed their 24-hour window along with their payloads.
 */
export const getRecentReports = (): RecentReport[] => {
	const now = Date.now();
	const index = readJson<RecentReport[]>(getIndexKey()) ?? [];

	const live: RecentReport[] = [];
	for (const entry of index) {
		if (!entry?.username || typeof entry.savedAt !== 'number') continue;
		if (isExpired(entry.savedAt, now)) {
			removeKey(getReportPrefix() + entry.username);
			continue;
		}
		live.push(entry);
	}

	live.sort((a, b) => b.savedAt - a.savedAt);

	if (live.length !== index.length) writeJson(getIndexKey(), live);
	return live;
};

/** Reads a cached report, or null when absent or older than 24 hours. */
export const getCachedReport = <T>(username: string): T | null => {
	const key = normalize(username);
	if (!key) return null;

	const cached = readJson<CachedReport<T>>(getReportPrefix() + key);
	if (!cached || typeof cached.savedAt !== 'number') return null;

	if (isExpired(cached.savedAt, Date.now())) {
		removeKey(getReportPrefix() + key);
		return null;
	}
	return cached.data;
};

/** Epoch ms at which the cached report for this username expires, or null. */
export const getCacheExpiry = (username: string): number | null => {
	const cached = readJson<CachedReport<unknown>>(getReportPrefix() + normalize(username));
	if (!cached || typeof cached.savedAt !== 'number') return null;
	const expiry = cached.savedAt + REPORT_TTL_MS;
	return expiry > Date.now() ? expiry : null;
};

/** Stores a report and puts it at the head of the recents list. */
export const saveReport = <T extends Record<string, any>>(username: string, data: T): void => {
	const key = normalize(username);
	if (!key || !data) return;

	const savedAt = Date.now();
	writeJson(getReportPrefix() + key, { savedAt, data } satisfies CachedReport<T>);

	const others = getRecentReports().filter((entry) => entry.username !== key);
	const next: RecentReport[] = [
		{
			username: key,
			savedAt,
			expectedTon: data.expected_ton,
			expectedUsd: data.expected_usd,
			tier: data.rarity?.tier,
		},
		...others,
	];

	// Drop anything past the cap, payload included, so storage stays bounded.
	for (const stale of next.slice(MAX_RECENTS)) {
		removeKey(getReportPrefix() + stale.username);
	}
	writeJson(getIndexKey(), next.slice(0, MAX_RECENTS));
};

/** Removes a single cached report — used when the user asks for a fresh run. */
export const invalidateReport = (username: string): void => {
	const key = normalize(username);
	if (!key) return;
	removeKey(getReportPrefix() + key);
	writeJson(
		getIndexKey(),
		getRecentReports().filter((entry) => entry.username !== key),
	);
};

/** Human-readable remaining lifetime, e.g. "23h" or "42m". */
export const formatRemaining = (expiresAt: number): string => {
	const ms = Math.max(0, expiresAt - Date.now());
	const hours = Math.floor(ms / 3_600_000);
	if (hours >= 1) return `${hours}h`;
	const minutes = Math.max(1, Math.floor(ms / 60_000));
	return `${minutes}m`;
};

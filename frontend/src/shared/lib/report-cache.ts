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

const REPORT_PREFIX = 'val_report_';
const INDEX_KEY = 'val_report_index';
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
	const index = readJson<RecentReport[]>(INDEX_KEY) ?? [];

	const live: RecentReport[] = [];
	for (const entry of index) {
		if (!entry?.username || typeof entry.savedAt !== 'number') continue;
		if (isExpired(entry.savedAt, now)) {
			removeKey(REPORT_PREFIX + entry.username);
			continue;
		}
		live.push(entry);
	}

	live.sort((a, b) => b.savedAt - a.savedAt);

	if (live.length !== index.length) writeJson(INDEX_KEY, live);
	return live;
};

/** Reads a cached report, or null when absent or older than 24 hours. */
export const getCachedReport = <T>(username: string): T | null => {
	const key = normalize(username);
	if (!key) return null;

	const cached = readJson<CachedReport<T>>(REPORT_PREFIX + key);
	if (!cached || typeof cached.savedAt !== 'number') return null;

	if (isExpired(cached.savedAt, Date.now())) {
		removeKey(REPORT_PREFIX + key);
		return null;
	}
	return cached.data;
};

/** Epoch ms at which the cached report for this username expires, or null. */
export const getCacheExpiry = (username: string): number | null => {
	const cached = readJson<CachedReport<unknown>>(REPORT_PREFIX + normalize(username));
	if (!cached || typeof cached.savedAt !== 'number') return null;
	const expiry = cached.savedAt + REPORT_TTL_MS;
	return expiry > Date.now() ? expiry : null;
};

/** Stores a report and puts it at the head of the recents list. */
export const saveReport = <T extends Record<string, any>>(username: string, data: T): void => {
	const key = normalize(username);
	if (!key || !data) return;

	const savedAt = Date.now();
	writeJson(REPORT_PREFIX + key, { savedAt, data } satisfies CachedReport<T>);

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
		removeKey(REPORT_PREFIX + stale.username);
	}
	writeJson(INDEX_KEY, next.slice(0, MAX_RECENTS));
};

/** Removes a single cached report — used when the user asks for a fresh run. */
export const invalidateReport = (username: string): void => {
	const key = normalize(username);
	if (!key) return;
	removeKey(REPORT_PREFIX + key);
	writeJson(
		INDEX_KEY,
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

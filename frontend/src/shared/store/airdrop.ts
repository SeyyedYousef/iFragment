import { createEffect, createMemo, createRoot, createSignal, onCleanup } from 'solid-js';
import { showToast } from '@/shared/ui/toast.js';

// --- Levels & Leagues ---
export interface League {
	name: string;
	icon: string;
	minScore: number;
	color: string;
}

export interface LeaderEntry {
	rank: number;
	name: string;
	score: number;
	league: string;
	level: number;
	clanName?: string;
}

export const LEAGUES: League[] = [
	{ name: 'Wood', icon: 'park', minScore: 0, color: '#8B6F47' },
	{ name: 'Bronze', icon: 'looks_3', minScore: 5_000, color: '#cd7f32' },
	{ name: 'Silver', icon: 'looks_two', minScore: 50_000, color: '#c0c0c0' },
	{ name: 'Gold', icon: 'looks_one', minScore: 500_000, color: '#ffd700' },
	{ name: 'Platinum', icon: 'workspace_premium', minScore: 2_000_000, color: '#e5e4e2' },
	{ name: 'Diamond', icon: 'diamond', minScore: 10_000_000, color: '#3390ec' },
	{ name: 'Master', icon: 'auto_awesome', minScore: 50_000_000, color: '#ff6b35' },
	{ name: 'Grandmaster', icon: 'emoji_events', minScore: 100_000_000, color: '#ff1744' },
];

import { Clan } from '@/shared/api/profile.js';

const loadState = () => {
	try {
		const data = localStorage.getItem('airdrop-state');
		if (data) {
			const parsed = JSON.parse(data);
			if (parsed && typeof parsed.savedAt === 'number') {
				const elapsedSec = Math.floor((Date.now() - parsed.savedAt) / 1000);
				const validElapsed = Math.max(0, elapsedSec);
				const recoveryRate = typeof parsed.energyRecovery === 'number' ? parsed.energyRecovery : 1;
				const maxE = typeof parsed.maxEnergy === 'number' ? parsed.maxEnergy : 500;
				const currentE = typeof parsed.energy === 'number' ? parsed.energy : 0;
				parsed.energy = Math.min(maxE, currentE + validElapsed * recoveryRate);
			}
			return parsed;
		}
	} catch (e) {
		console.error('Failed to parse airdrop state:', e);
	}
	return null;
};
const savedState = loadState() || {};

// --- Core State ---
export const [userClan, setUserClan] = createSignal<Clan | null>(null);
export const [balance, setBalance] = createSignal(
	typeof savedState.balance === 'number' ? savedState.balance : 0,
);
export const [totalTaps, setTotalTaps] = createSignal(
	typeof savedState.totalTaps === 'number' ? savedState.totalTaps : 0,
);
export const [userXp, setUserXp] = createSignal(
	typeof savedState.userXp === 'number' ? savedState.userXp : 0,
);
export const [globalRank, setGlobalRank] = createSignal(
	typeof savedState.globalRank === 'number' ? savedState.globalRank : 0,
);
export const [energy, setEnergy] = createSignal(
	typeof savedState.energy === 'number'
		? Math.min(savedState.energy, savedState.maxEnergy || 500)
		: 500,
);
export const [maxEnergy, setMaxEnergy] = createSignal(
	typeof savedState.maxEnergy === 'number' ? savedState.maxEnergy : 500,
);
export const [tapPower, setTapPower] = createSignal(
	typeof savedState.tapPower === 'number' ? savedState.tapPower : 1,
);
export const [energyRecovery, setEnergyRecovery] = createSignal(
	typeof savedState.energyRecovery === 'number' ? savedState.energyRecovery : 1,
);
export const [frgBalance, setFrgBalance] = createSignal(
	typeof savedState.frgBalance === 'number' ? savedState.frgBalance : 0,
);
export const [turboCount, setTurboCount] = createSignal(
	typeof savedState.turboCount === 'number' ? savedState.turboCount : 2,
);
export const [fullEnergyCount, setFullEnergyCount] = createSignal(
	typeof savedState.fullEnergyCount === 'number' ? savedState.fullEnergyCount : 3,
);
export const [isRocketSpawned, setIsRocketSpawned] = createSignal(false);
export const [isTurboActive, setIsTurboActive] = createSignal(false);
export const [turboExpiresAt, setTurboExpiresAt] = createSignal(0);
export const [dailyTappedCoins, setDailyTappedCoins] = createSignal(
	typeof savedState.dailyTappedCoins === 'number' ? savedState.dailyTappedCoins : 0,
);

export const spawnRocket = () => {
	if (turboCount() > 0 && !isTurboActive() && !isRocketSpawned()) {
		setTurboCount((c) => c - 1);
		setIsRocketSpawned(true);
		
		// Optional: Despawn if they don't click it within 10 seconds
		setTimeout(() => {
			if (isRocketSpawned()) {
				setIsRocketSpawned(false);
			}
		}, 10000);
	}
};

export const activateTurbo = async () => {
	if (!isTurboActive()) {
		try {
			await activateTurboServer();
			setIsRocketSpawned(false);
			setIsTurboActive(true);
			setTurboExpiresAt(Date.now() + 15000); // 15 seconds
			setTimeout(() => {
				if (Date.now() >= turboExpiresAt()) {
					setIsTurboActive(false);
				}
			}, 15000);
		} catch (e: any) {
			console.error('Failed to activate turbo on server:', e);
			setIsRocketSpawned(false);
			const msg = e?.message || 'Failed to activate turbo';
			showToast(msg, 'error');
			if (msg.toLowerCase().includes('limit')) {
				setTurboCount(0);
			}
		}
	}
};

export const activateFullEnergy = async () => {
	if (fullEnergyCount() > 0) {
		try {
			await activateFullEnergyServer();
			setFullEnergyCount((c) => c - 1);
			setEnergy(maxEnergy());
		} catch (e: any) {
			console.error('Failed to activate full energy on server:', e);
			const msg = e?.message || 'Failed to activate full energy';
			showToast(msg, 'error');
			if (msg.toLowerCase().includes('limit')) {
				setFullEnergyCount(0);
			}
		}
	}
};

export const [lastBoosterResetDate, setLastBoosterResetDate] = createSignal<string | null>(
	typeof savedState.lastBoosterResetDate === 'string' ? savedState.lastBoosterResetDate : null,
);

export const checkDailyBoosterReset = () => {
	const today = new Date().toISOString().split('T')[0];
	if (lastBoosterResetDate() !== today) {
		setTurboCount(2);
		setFullEnergyCount(3);
		setLastBoosterResetDate(today);
	}
};

// --- Boosters ---
export interface Booster {
	id: string;
	level: number;
	maxLevel: number;
	baseCost: number;
}

export const [boosters, setBoosters] = createSignal<Record<string, Booster>>({
	tapPower: { id: 'tapPower', level: 1, maxLevel: 10, baseCost: 3000 },
	energyCap: { id: 'energyCap', level: 1, maxLevel: 10, baseCost: 2500 },
	tapBot: { id: 'tapBot', level: 0, maxLevel: 1, baseCost: 50000 },
});

export const getBoosterCost = (booster: Booster) => booster.baseCost;

import { upgradeBoost as apiUpgradeBoost, getBoostsStatus, activateTurboServer, activateFullEnergyServer } from '@/shared/api/profile.js';

export const syncBoostersStatus = async () => {
	try {
		const backendBoosts = await getBoostsStatus();
		if (Array.isArray(backendBoosts)) {
			setBoosters((prev) => {
				const next = { ...prev };
				for (const b of backendBoosts) {
					if (b && b.type === 'multitap') {
						next.tapPower = {
							id: 'tapPower',
							level: b.current_level,
							maxLevel: b.max_level ? b.current_level : Math.max(10, b.current_level + 1),
							baseCost: b.price_frg,
						};
						setTapPower(b.current_level);
					} else if (b && b.type === 'energy_limit') {
						next.energyCap = {
							id: 'energyCap',
							level: b.current_level,
							maxLevel: b.max_level ? b.current_level : Math.max(10, b.current_level + 1),
							baseCost: b.price_frg,
						};
						setMaxEnergy(500 + (b.current_level - 1) * 250);
					} else if (b && b.type === 'tap_bot') {
						next.tapBot = {
							id: 'tapBot',
							level: b.current_level,
							maxLevel: b.max_level ? b.current_level : 1,
							baseCost: b.price_frg,
						};
					}
				}
				return next;
			});
			setEnergy((e) => Math.min(e, maxEnergy()));
		}
	} catch (e) {
		console.error('Failed to sync boosters status:', e);
	}
};

export const currentLeague = createMemo(() => {
	const currentXp = userXp();
	let league = LEAGUES[0];
	for (const l of LEAGUES) {
		if (currentXp >= l.minScore) league = l;
	}
	return league;
});

export const nextLeague = createMemo(() => {
	const idx = LEAGUES.indexOf(currentLeague());
	return idx < LEAGUES.length - 1 ? LEAGUES[idx + 1] : null;
});

export const leagueProgress = createMemo(() => {
	const current = currentLeague();
	const next = nextLeague();
	if (!next) return 100;
	const range = next.minScore - current.minScore;
	const progress = userXp() - current.minScore;
	return Math.min(100, Math.max(0, Math.floor((progress / range) * 100)));
});

// --- Daily Check-in ---
export const [streakDay, setStreakDay] = createSignal(0);
export const [lastCheckIn, setLastCheckIn] = createSignal<string | null>(null);

export const checkedInToday = createMemo(() => {
	const today = new Date().toISOString().split('T')[0];
	return lastCheckIn() === today;
});

import { claimDailyReward as apiClaimDailyReward, getDailyStatus } from '@/shared/api/profile.js';

export const syncDailyRewardStatus = async () => {
	try {
		const status = await getDailyStatus();
		if (status) {
			setStreakDay(status.streak);
			setLastCheckIn(status.claimed ? new Date().toISOString().split('T')[0] : null);
		}
	} catch (e) {
		console.error('Failed to sync daily status:', e);
	}
};

export const DAILY_REWARDS = [200, 400, 800, 1500, 3000, 5000, 8000];

export const claimDailyReward = async () => {
	try {
		const status = await apiClaimDailyReward();
		if (status) {
			setStreakDay(status.streak);
			setLastCheckIn(status.claimed ? new Date().toISOString().split('T')[0] : null);
			await syncProfileStats();
			return status.frg_reward;
		}
	} catch (e) {
		console.error('Failed to claim daily reward:', e);
	}
	return false;
};

// --- Referral ---
export const [referralCount, setReferralCount] = createSignal(0);
export const REFERRAL_REWARD = 1000;

// --- Leaderboard functionality has been moved to LeaderboardView.tsx using TanStack Query ---

export const initEnergyRegen = () => {
	let lastRegenTime = Date.now();
	const timer = setInterval(() => {
		const now = Date.now();
		const elapsed = (now - lastRegenTime) / 1000;
		if (elapsed >= 1.0) {
			const recoveryRate = Math.max(0, energyRecovery() || 1);
			const recoveryAmount = Math.floor(elapsed * recoveryRate);
			if (recoveryAmount > 0) {
				setEnergy((e) => {
					if (e >= maxEnergy()) return e; // Prevent energy chop-down if maxEnergy is not synced yet
					return Math.min(maxEnergy(), e + recoveryAmount);
				});
				lastRegenTime += (recoveryAmount / recoveryRate) * 1000;
			}
		}
	}, 1000);
	return () => clearInterval(timer);
};

import { addTaps, getClan, getProfileStats } from '@/shared/api/profile.js';

interface TapBucket {
	count: number;
	multiplier: number;
	nonce: string;
	ts: number;
}

let pendingTapBuckets: TapBucket[] = [];
try {
	const savedPending = localStorage.getItem('airdrop-pending-taps');
	if (savedPending) {
		const parsed = JSON.parse(savedPending);
		if (Array.isArray(parsed)) {
			pendingTapBuckets = parsed;
		}
	}
} catch (e) {
	console.error('Failed to load pending taps:', e);
}

let syncTimeout: ReturnType<typeof setTimeout> | undefined;

let isSyncing = false;
let syncPromise: Promise<void> | null = null;

const getOptimisticCoins = () => pendingTapBuckets.reduce((acc, b) => acc + b.count * b.multiplier * tapPower(), 0);
const getOptimisticEnergyCost = () => pendingTapBuckets.reduce((acc, b) => acc + (b.multiplier === 1 ? b.count * tapPower() : 0), 0);
const getOptimisticTaps = () => pendingTapBuckets.reduce((acc, b) => acc + b.count, 0);

export const syncPendingTaps = async () => {
	if (pendingTapBuckets.length === 0) return;
	if (syncPromise) return syncPromise;

	syncPromise = (async () => {
		isSyncing = true;
		try {
			while (pendingTapBuckets.length > 0) {
				const bucket = pendingTapBuckets[0];
				
				let sig = `dummy_signature_for_${bucket.nonce}`;
				try {
					const encoder = new TextEncoder();
					const initData = (window as any).Telegram?.WebApp?.initData || "dev_init_data_fallback";
					const keyMaterial = await crypto.subtle.importKey(
						"raw",
						encoder.encode(initData),
						{ name: "HMAC", hash: "SHA-256" },
						false,
						["sign"]
					);
					const payload = `${bucket.nonce}:${bucket.count}:${bucket.ts}`;
					const signatureBuffer = await crypto.subtle.sign("HMAC", keyMaterial, encoder.encode(payload));
					const signatureArray = Array.from(new Uint8Array(signatureBuffer));
					sig = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
				} catch (e) {
					console.error("HMAC generation failed", e);
				}
				
				try {
					const stats = await addTaps(bucket.count, bucket.multiplier, bucket.nonce, bucket.ts, sig);
					if (stats) {
						pendingTapBuckets.shift(); // Remove the bucket we just synced

						setBalance(
							(typeof stats.airdropCoins === 'number' ? stats.airdropCoins : 0) +
								getOptimisticCoins(),
						);
						if (typeof stats.energy === 'number') {
							setEnergy(Math.max(0, stats.energy - getOptimisticEnergyCost()));
						}
						setFrgBalance(typeof stats.frgBalance === 'number' ? stats.frgBalance : 0);
						setTotalTaps((typeof stats.totalTaps === 'number' ? stats.totalTaps : 0) + getOptimisticTaps());
						setUserXp((typeof stats.xp === 'number' ? stats.xp : 0) + getOptimisticTaps() * 2);
						if (typeof stats.globalRank === 'number') {
							setGlobalRank(stats.globalRank);
						}

						try {
							if (pendingTapBuckets.length === 0) {
								localStorage.removeItem('airdrop-pending-taps');
							} else {
								localStorage.setItem('airdrop-pending-taps', JSON.stringify(pendingTapBuckets));
							}
						} catch (e) {
							console.error('Failed to save pending taps:', e);
						}
					} else {
						break;
					}
				} catch (e) {
					console.error('Failed to sync taps with server:', e);
					break;
				}
			}
		} finally {
			isSyncing = false;
			syncPromise = null;
		}
	})();
	return syncPromise;
};

export const recordTaps = (count: number) => {
	if (typeof count !== 'number' || !Number.isInteger(count) || count <= 0) return;
	
	const turboActive = isTurboActive();
	const multiplier = turboActive ? 5 : 1;
	let energyConsumed = turboActive ? 0 : count * tapPower();
	let coinsEarned = turboActive ? count * tapPower() * multiplier : energyConsumed;

	if (!turboActive && energy() < energyConsumed) {
		if (energy() <= 0) return;
		energyConsumed = energy();
		coinsEarned = energyConsumed; // Multiplier is 1 if not turbo
	}

	let fatigueMultiplier = 1.0;
	if (dailyTappedCoins() > 30000) {
		fatigueMultiplier = 0.1;
	} else if (dailyTappedCoins() > 15000) {
		fatigueMultiplier = 0.25;
	} else if (dailyTappedCoins() > 5000) {
		fatigueMultiplier = 0.5;
	}

	coinsEarned = coinsEarned * fatigueMultiplier;
	
	if (energyConsumed > 0) {
		setEnergy((e) => Math.max(0, e - energyConsumed));
	}
	
	setBalance((b) => b + coinsEarned);
	setDailyTappedCoins((d) => d + coinsEarned);
	setTotalTaps((t) => t + count);
	setUserXp((x) => x + count * 2);

	const lastBucket = pendingTapBuckets[pendingTapBuckets.length - 1];
	// Aggregate if it's the same multiplier and under the safe limit (max 500 on backend, let's use 400 to be safe)
	if (lastBucket && lastBucket.multiplier === multiplier && lastBucket.count + count <= 400) {
		lastBucket.count += count;
		lastBucket.ts = Date.now();
	} else {
		pendingTapBuckets.push({
			count,
			multiplier,
			nonce: Math.random().toString(36).substring(2, 15),
			ts: Date.now(),
		});
	}

	try {
		localStorage.setItem('airdrop-pending-taps', JSON.stringify(pendingTapBuckets));
	} catch (e) {
		console.error('Failed to save pending taps:', e);
	}

	if (syncTimeout) clearTimeout(syncTimeout);
	syncTimeout = setTimeout(async () => {
		await syncPendingTaps();
	}, 1500); // 1.5 seconds debounce
};

export const syncProfileStats = async () => {
	try {
		const stats = await getProfileStats();
		if (stats) {
			setFrgBalance(typeof stats.frgBalance === 'number' ? stats.frgBalance : 0);
			if (!isSyncing) {
				setBalance(
					(typeof stats.airdropCoins === 'number' ? stats.airdropCoins : 0) +
						getOptimisticCoins(),
				);
				setTotalTaps((typeof stats.totalTaps === 'number' ? stats.totalTaps : 0) + getOptimisticTaps());
				setUserXp(typeof stats.xp === 'number' ? stats.xp + getOptimisticTaps() * 2 : 0 + getOptimisticTaps() * 2);
				if (typeof stats.globalRank === 'number') {
					setGlobalRank(stats.globalRank);
				}
				if (typeof stats.energy === 'number') {
					setEnergy(Math.max(0, stats.energy - getOptimisticEnergyCost()));
				}
				if (typeof stats.dailyTappedCoins === 'number') {
					setDailyTappedCoins(stats.dailyTappedCoins);
				}
			}
		}
	} catch (e) {
		console.error('Failed to sync profile stats:', e);
	}
};

export const upgradeBooster = async (id: string) => {
	if (pendingTapBuckets.length > 0) {
		await syncPendingTaps();
	}

	const b = boosters()[id];
	if (!b || b.level >= b.maxLevel) return false;

	let backendType = '';
	if (id === 'tapPower') backendType = 'multitap';
	else if (id === 'energyCap') backendType = 'energy_limit';
	else if (id === 'tapBot') backendType = 'tap_bot';

	if (backendType === '') return false;

	try {
		await apiUpgradeBoost(backendType);
		await syncBoostersStatus();
		await syncProfileStats();
		return true;
	} catch (e: any) {
		console.error('upgrade error:', e);
		showToast(e?.message || 'Failed to upgrade booster', 'error');
		if (e?.message?.includes('limit')) {
			setTurboCount(0);
			setFullEnergyCount(0);
		}
		return false;
	};
};

export const syncAllData = async () => {
	try {
		// 1. Sync boosters status first to know correct maxEnergy & tapPower
		await syncBoostersStatus();
		// 2. Sync pending taps to update server balance with local taps
		await syncPendingTaps();
		// 3. Sync profile stats to get latest correct balance and energy
		await syncProfileStats();
		// 4. Sync daily reward status
		await syncDailyRewardStatus();
	} catch (e) {
		console.error('Failed to sync all data sequentially:', e);
	}
};

// Sync to local storage with throttle
let pendingSave: ReturnType<typeof setTimeout> | undefined;

let _disposeAirdropFn: (() => void) | null = null;

export const initStorageSync = () => {
	if (_disposeAirdropFn) return _disposeAirdropFn;

	_disposeAirdropFn = createRoot((dispose) => {
		// Energy regen in store root
		const cleanupEnergy = initEnergyRegen();

		// Fetch initial data sequentially to prevent race conditions
		syncAllData();
		checkDailyBoosterReset();

		getClan()
			.then((res) => {
				if (res?.is_member && res.clan) {
					setUserClan(res.clan as Clan);
				} else {
					setUserClan(null);
				}
			})
			.catch((e) => console.error('Failed to load user clan:', e));

		createEffect(() => {
			// Access only UI signals to persist them securely
			const state = {
				balance: balance(),
				totalTaps: totalTaps(),
				frgBalance: frgBalance(),
				energy: energy(),
				maxEnergy: maxEnergy(),
				tapPower: tapPower(),
				energyRecovery: energyRecovery(),
				turboCount: turboCount(),
				fullEnergyCount: fullEnergyCount(),
				lastBoosterResetDate: lastBoosterResetDate(),
				dailyTappedCoins: dailyTappedCoins(),
				savedAt: Date.now(), // Save exact timestamp
			};

			if (pendingSave) clearTimeout(pendingSave);

			pendingSave = setTimeout(() => {
				try {
					localStorage.setItem('airdrop-state', JSON.stringify(state));
				} catch (e) {
					console.error('Failed to save state:', e);
				}
				pendingSave = undefined;
			}, 1000); // 1 second debounce/throttle for persistence
		});

		onCleanup(() => {
			cleanupEnergy();
			if (pendingSave) clearTimeout(pendingSave);
		});

		return () => {
			dispose();
			cleanupEnergy();
			if (pendingSave) clearTimeout(pendingSave);
		};
	});
	return _disposeAirdropFn;
};

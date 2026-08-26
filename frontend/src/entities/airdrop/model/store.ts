import { createEffect, createMemo, createRoot, createSignal, onCleanup } from 'solid-js';
import {
	activateFullEnergyServer,
	activateTurboServer,
	addTaps,
	claimDailyReward as apiClaimDailyReward,
	upgradeBoost as apiUpgradeBoost,
	type Clan,
	getBoostsStatus,
	getClan,
	getDailyStatus,
	getProfileStats,
} from '@/entities/user/index.js';
import { showToast } from '@/shared/ui/toast.js';
import { type Booster, LEAGUES } from './types.js';

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
export const [dailyFatigueMultiplier, setDailyFatigueMultiplier] = createSignal(1.0);
export const [dailyFatigueLimitRemaining, setDailyFatigueLimitRemaining] = createSignal(5000);
export const [creditExpiresInDays, setCreditExpiresInDays] = createSignal(
	typeof savedState.creditExpiresInDays === 'number' ? savedState.creditExpiresInDays : 30,
);
export const [earliestExpiringCoins, setEarliestExpiringCoins] = createSignal(0);
export const [earliestExpiringDays, setEarliestExpiringDays] = createSignal(30);
export const [valuationCredits, setValuationCredits] = createSignal(0);
export const [boosterResetAt, setBoosterResetAt] = createSignal(0);

export const spawnRocket = () => {
	if (turboCount() > 0 && !isTurboActive() && !isRocketSpawned()) {
		setTurboCount((c) => c - 1);
		setIsRocketSpawned(true);

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
			const expiry = Date.now() + 15000; // Unified 15-second Turbo
			setTurboExpiresAt(expiry);
			setTimeout(() => {
				if (Date.now() >= turboExpiresAt()) {
					setIsTurboActive(false);
				}
			}, 15000);
		} catch (e: any) {
			console.error('Failed to activate turbo on server:', e);
			setIsRocketSpawned(false);
			const msg =
				e?.response?.data?.err ||
				e?.response?.data?.message ||
				e?.message ||
				'Failed to activate turbo';
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
			const msg =
				e?.response?.data?.err ||
				e?.response?.data?.message ||
				e?.message ||
				'Failed to activate full energy';
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
	const now = Date.now();
	const resetTs = boosterResetAt();
	if (resetTs > 0 && now >= resetTs) {
		setTurboCount(2);
		setFullEnergyCount(3);
		setDailyTappedCoins(0);
		setDailyFatigueMultiplier(1.0);
		setDailyFatigueLimitRemaining(5000);
	} else {
		const todayUTC = new Date().toISOString().split('T')[0];
		if (lastBoosterResetDate() !== todayUTC) {
			setTurboCount(2);
			setFullEnergyCount(3);
			setLastBoosterResetDate(todayUTC);
		}
	}
};

export const [boosters, setBoosters] = createSignal<Record<string, Booster>>({
	tapPower: {
		id: 'tapPower',
		name: 'Multi-Tap',
		level: 1,
		maxLevel: 10,
		basePrice: 3000,
		priceMultiplier: 2,
		effect: 1,
		effectUnit: 'tap',
		icon: 'touch_app',
	},
	energyCap: {
		id: 'energyCap',
		name: 'Energy Limit',
		level: 1,
		maxLevel: 10,
		basePrice: 2500,
		priceMultiplier: 2,
		effect: 500,
		effectUnit: 'cap',
		icon: 'bolt',
	},
	tapBot: {
		id: 'tapBot',
		name: 'Tap Bot',
		level: 0,
		maxLevel: 1,
		basePrice: 50000,
		priceMultiplier: 1,
		effect: 1,
		effectUnit: 'bot',
		icon: 'smart_toy',
	},
});

export const getBoosterCost = (booster: Booster) => booster.basePrice;

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
							name: 'Multi-Tap',
							level: b.current_level,
							maxLevel: typeof b.max_level === 'number' ? b.max_level : 10,
							basePrice: typeof b.price_frg === 'number' ? b.price_frg : 100,
							priceMultiplier: 2,
							effect: 1,
							effectUnit: 'tap',
							icon: 'touch_app',
						};
						setTapPower(b.current_level);
					} else if (b && b.type === 'energy_limit') {
						next.energyCap = {
							id: 'energyCap',
							name: 'Energy Limit',
							level: b.current_level,
							maxLevel: typeof b.max_level === 'number' ? b.max_level : 10,
							basePrice: typeof b.price_frg === 'number' ? b.price_frg : 100,
							priceMultiplier: 2,
							effect: 500,
							effectUnit: 'cap',
							icon: 'bolt',
						};
						setMaxEnergy(500 + (b.current_level - 1) * 250);
					} else if (b && b.type === 'tap_bot') {
						next.tapBot = {
							id: 'tapBot',
							name: 'Tap Bot',
							level: b.current_level,
							maxLevel: typeof b.max_level === 'number' ? b.max_level : 1,
							basePrice: typeof b.price_frg === 'number' ? b.price_frg : 50000,
							priceMultiplier: 1,
							effect: 1,
							effectUnit: 'bot',
							icon: 'smart_toy',
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

export const DAILY_REWARDS = [500, 1000, 2500, 5000, 10000, 25000, 50000];

export const claimDailyReward = async () => {
	try {
		const status = await apiClaimDailyReward();
		if (status) {
			setStreakDay(status.streak);
			setLastCheckIn(status.claimed ? new Date().toISOString().split('T')[0] : null);
			await syncProfileStats();
			return status.frg_reward || status.coins_reward;
		}
	} catch (e) {
		console.error('Failed to claim daily reward:', e);
	}
	return false;
};

// --- Referral ---
export const [referralCount, setReferralCount] = createSignal(0);
export const REFERRAL_REWARD = 10000;

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
					if (e >= maxEnergy()) return e;
					return Math.min(maxEnergy(), e + recoveryAmount);
				});
				lastRegenTime += (recoveryAmount / recoveryRate) * 1000;
			}
		}
	}, 1000);
	return () => clearInterval(timer);
};

interface TapBucket {
	count: number;
	multiplier: number;
	nonce: string;
	ts: number;
}

const getPendingTapsKey = () => {
	try {
		const userId = localStorage.getItem('tg_user_id');
		return userId ? `airdrop-pending-taps_${userId}` : 'airdrop-pending-taps';
	} catch {
		return 'airdrop-pending-taps';
	}
};

let pendingTapBuckets: TapBucket[] = [];
try {
	const savedPending =
		localStorage.getItem(getPendingTapsKey()) || localStorage.getItem('airdrop-pending-taps');
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

const getOptimisticCoins = () => {
	const raw = pendingTapBuckets.reduce((acc, b) => {
		const energyConsumed = b.multiplier === 5 ? 0 : b.count * tapPower();
		const coinsEarned = b.multiplier === 5 ? b.count * tapPower() * 5 : energyConsumed;
		return acc + coinsEarned;
	}, 0);

	let fatigueMultiplier = dailyFatigueMultiplier();
	if (dailyTappedCoins() > 30000) {
		fatigueMultiplier = 0.1;
	} else if (dailyTappedCoins() > 15000) {
		fatigueMultiplier = 0.25;
	} else if (dailyTappedCoins() > 5000) {
		fatigueMultiplier = 0.5;
	}
	return raw * fatigueMultiplier;
};

const getOptimisticEnergyCost = () =>
	pendingTapBuckets.reduce((acc, b) => acc + (b.multiplier === 5 ? 0 : b.count * tapPower()), 0);
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
					const initData = (window as any).Telegram?.WebApp?.initData || 'dev_init_data_fallback';
					const keyMaterial = await crypto.subtle.importKey(
						'raw',
						encoder.encode(initData),
						{ name: 'HMAC', hash: 'SHA-256' },
						false,
						['sign'],
					);
					const payload = `${bucket.nonce}:${bucket.count}:${bucket.ts}`;
					const signatureBuffer = await crypto.subtle.sign(
						'HMAC',
						keyMaterial,
						encoder.encode(payload),
					);
					const signatureArray = Array.from(new Uint8Array(signatureBuffer));
					sig = signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('');
				} catch (e) {
					console.error('HMAC generation failed', e);
				}

				try {
					const stats = await addTaps(
						bucket.count,
						bucket.multiplier,
						bucket.nonce,
						bucket.ts,
						sig,
					);
					if (stats) {
						pendingTapBuckets.shift();

						setBalance(
							(typeof stats.airdropCoins === 'number' ? stats.airdropCoins : 0) +
								getOptimisticCoins(),
						);
						if (typeof stats.energy === 'number') {
							setEnergy(Math.max(0, stats.energy - getOptimisticEnergyCost()));
						}
						setFrgBalance(
							typeof (stats as any).frgBalance === 'number'
								? (stats as any).frgBalance
								: ((stats as any).frg_balance ?? 0),
						);
						setTotalTaps(
							(typeof stats.totalTaps === 'number' ? stats.totalTaps : 0) + getOptimisticTaps(),
						);
						// Server-Authoritative XP
						setUserXp(
							(typeof stats.xp === 'number' ? stats.xp : 0) + Math.floor(getOptimisticCoins()),
						);
						if (typeof stats.globalRank === 'number') {
							setGlobalRank(stats.globalRank);
						}
						if (typeof stats.dailyFatigueMultiplier === 'number') {
							setDailyFatigueMultiplier(stats.dailyFatigueMultiplier);
						}
						if (typeof stats.dailyFatigueLimitRemaining === 'number') {
							setDailyFatigueLimitRemaining(stats.dailyFatigueLimitRemaining);
						}

						try {
							if (pendingTapBuckets.length === 0) {
								localStorage.removeItem(getPendingTapsKey());
								localStorage.removeItem('airdrop-pending-taps');
							} else {
								localStorage.setItem(getPendingTapsKey(), JSON.stringify(pendingTapBuckets));
							}
						} catch (e) {
							console.error('Failed to save pending taps:', e);
						}
					} else {
						break;
					}
				} catch (e: any) {
					console.error('Failed to sync taps with server:', e);
					const status = e?.status || e?.response?.status;
					if (status === 400) {
						pendingTapBuckets.shift();
						try {
							localStorage.setItem(getPendingTapsKey(), JSON.stringify(pendingTapBuckets));
						} catch (err) {
							console.error('Failed to save pending taps after discard:', err);
						}
					}
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
		coinsEarned = energyConsumed;
	}

	let fatigueMultiplier = dailyFatigueMultiplier();
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
	setUserXp((x) => x + Math.floor(coinsEarned));

	const lastBucket = pendingTapBuckets[pendingTapBuckets.length - 1];
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
		localStorage.setItem(getPendingTapsKey(), JSON.stringify(pendingTapBuckets));
	} catch (e) {
		console.error('Failed to save pending taps:', e);
	}

	if (syncTimeout) clearTimeout(syncTimeout);
	syncTimeout = setTimeout(async () => {
		await syncPendingTaps();
	}, 1500);
};

export const syncProfileStats = async () => {
	try {
		const stats = await getProfileStats();
		if (stats) {
			setFrgBalance(
				typeof (stats as any).frgBalance === 'number'
					? (stats as any).frgBalance
					: ((stats as any).frg_balance ?? 0),
			);
			if (!isSyncing) {
				setBalance(
					(typeof stats.airdropCoins === 'number' ? stats.airdropCoins : 0) + getOptimisticCoins(),
				);
				setTotalTaps(
					(typeof stats.totalTaps === 'number' ? stats.totalTaps : 0) + getOptimisticTaps(),
				);
				setUserXp(
					typeof stats.xp === 'number'
						? stats.xp + Math.floor(getOptimisticCoins())
						: Math.floor(getOptimisticCoins()),
				);
				if (typeof stats.globalRank === 'number') {
					setGlobalRank(stats.globalRank);
				}
				if (typeof stats.energy === 'number') {
					setEnergy(Math.max(0, stats.energy - getOptimisticEnergyCost()));
				}
				if (typeof stats.dailyTappedCoins === 'number') {
					setDailyTappedCoins(stats.dailyTappedCoins);
				}
				if (typeof stats.dailyFatigueMultiplier === 'number') {
					setDailyFatigueMultiplier(stats.dailyFatigueMultiplier);
				}
				if (typeof stats.dailyFatigueLimitRemaining === 'number') {
					setDailyFatigueLimitRemaining(stats.dailyFatigueLimitRemaining);
				}
				if (typeof stats.dailyTurboUsed === 'number') {
					setTurboCount(Math.max(0, 2 - stats.dailyTurboUsed));
				}
				if (typeof stats.creditExpiresInDays === 'number') {
					setCreditExpiresInDays(stats.creditExpiresInDays);
				}
				if (typeof stats.earliestExpiringCoins === 'number') {
					setEarliestExpiringCoins(stats.earliestExpiringCoins);
				}
				if (typeof stats.earliestExpiringDays === 'number') {
					setEarliestExpiringDays(stats.earliestExpiringDays);
				}
				if (typeof stats.valuationCredits === 'number') {
					setValuationCredits(stats.valuationCredits);
				}
				if (typeof stats.boosterResetAt === 'number' && stats.boosterResetAt > 0) {
					setBoosterResetAt(stats.boosterResetAt);
				}
				if (stats.turboExpiresAt) {
					const exp = new Date(stats.turboExpiresAt).getTime();
					if (exp > Date.now()) {
						setIsTurboActive(true);
						setTurboExpiresAt(exp);
					}
				}
				if (typeof stats.dailyFullEnergyUsed === 'number') {
					setFullEnergyCount(Math.max(0, 3 - stats.dailyFullEnergyUsed));
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
		const msg =
			e?.response?.data?.err ||
			e?.response?.data?.message ||
			e?.message ||
			'Failed to upgrade booster';
		showToast(msg, 'error');
		if (msg.toLowerCase().includes('limit')) {
			setTurboCount(0);
			setFullEnergyCount(0);
		}
		return false;
	}
};

export const syncAllData = async () => {
	try {
		await syncBoostersStatus();
		await syncPendingTaps();
		await syncProfileStats();
		await syncDailyRewardStatus();
	} catch (e) {
		console.error('Failed to sync all data sequentially:', e);
	}
};

let pendingSave: ReturnType<typeof setTimeout> | undefined;
let _disposeAirdropFn: (() => void) | null = null;

export const initStorageSync = () => {
	if (_disposeAirdropFn) return _disposeAirdropFn;

	_disposeAirdropFn = createRoot((dispose) => {
		const cleanupEnergy = initEnergyRegen();

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
				savedAt: Date.now(),
			};

			if (pendingSave) clearTimeout(pendingSave);

			pendingSave = setTimeout(() => {
				try {
					localStorage.setItem('airdrop-state', JSON.stringify(state));
				} catch (e) {
					console.error('Failed to save state:', e);
				}
				pendingSave = undefined;
			}, 1000);
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

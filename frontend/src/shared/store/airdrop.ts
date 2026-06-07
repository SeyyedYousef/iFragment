import { createSignal, createMemo, createEffect, createRoot, onCleanup } from 'solid-js';

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
}

export const LEAGUES: League[] = [
  { name: 'Bronze',   icon: 'looks_3',       minScore: 0,          color: '#cd7f32' },
  { name: 'Silver',   icon: 'looks_two',      minScore: 50_000,     color: '#c0c0c0' },
  { name: 'Gold',     icon: 'looks_one',      minScore: 200_000,    color: '#ffd700' },
  { name: 'Platinum', icon: 'workspace_premium', minScore: 500_000, color: '#e5e4e2' },
  { name: 'Diamond',  icon: 'diamond',        minScore: 1_000_000,  color: '#3390ec' },
  { name: 'Legendary', icon: 'auto_awesome',  minScore: 5_000_000,  color: '#ff6b35' },
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
    console.error("Failed to parse airdrop state:", e);
  }
  return null;
};
const savedState = loadState() || {};

// --- Core State ---
export const [userClan, setUserClan] = createSignal<Clan | null>(null);
export const [balance, setBalance] = createSignal(typeof savedState.balance === 'number' ? savedState.balance : 0);
export const [totalTaps, setTotalTaps] = createSignal(typeof savedState.totalTaps === 'number' ? savedState.totalTaps : 0);
export const [energy, setEnergy] = createSignal(typeof savedState.energy === 'number' ? Math.min(savedState.energy, savedState.maxEnergy || 500) : 500);
export const [maxEnergy, setMaxEnergy] = createSignal(typeof savedState.maxEnergy === 'number' ? savedState.maxEnergy : 500);
export const [tapPower, setTapPower] = createSignal(typeof savedState.tapPower === 'number' ? savedState.tapPower : 1);
export const [energyRecovery, setEnergyRecovery] = createSignal(typeof savedState.energyRecovery === 'number' ? savedState.energyRecovery : 1);
export const [frgBalance, setFrgBalance] = createSignal(typeof savedState.frgBalance === 'number' ? savedState.frgBalance : 0);

// --- Boosters ---
export interface Booster {
  id: string;
  level: number;
  maxLevel: number;
  baseCost: number;
}

export const [boosters, setBoosters] = createSignal<Record<string, Booster>>({
  tapPower:  { id: 'tapPower',  level: 1,  maxLevel: 10, baseCost: 2000 },
  energyCap: { id: 'energyCap', level: 1,  maxLevel: 10, baseCost: 1500 },
});

export const getBoosterCost = (booster: Booster) => booster.baseCost;

import { upgradeBoost as apiUpgradeBoost, getBoostsStatus } from '@/shared/api/profile.js';

export const syncBoostersStatus = async () => {
  try {
    const backendBoosts = await getBoostsStatus();
    if (Array.isArray(backendBoosts)) {
      setBoosters(prev => {
        const next = { ...prev };
        for (const b of backendBoosts) {
          if (b && b.type === "multitap") {
            next.tapPower = { id: 'tapPower', level: b.current_level, maxLevel: b.max_level ? b.current_level : Math.max(10, b.current_level + 1), baseCost: b.price_frg };
            setTapPower(b.current_level);
          } else if (b && b.type === "energy_limit") {
            next.energyCap = { id: 'energyCap', level: b.current_level, maxLevel: b.max_level ? b.current_level : Math.max(10, b.current_level + 1), baseCost: b.price_frg };
            setMaxEnergy(500 + (b.current_level - 1) * 250);
          }
        }
        return next;
      });
      setEnergy(e => Math.min(e, maxEnergy()));
    }
  } catch (e) {
    console.error("Failed to sync boosters status:", e);
  }
};

export const upgradeBooster = async (id: string) => {
  const b = boosters()[id];
  if (!b || b.level >= b.maxLevel) return false;
  
  let backendType = "";
  if (id === 'tapPower') backendType = "multitap";
  else if (id === 'energyCap') backendType = "energy_limit";
  
  if (backendType === "") return false;
  
  try {
    const updated = await apiUpgradeBoost(backendType);
    if (updated) {
      await syncBoostersStatus();
      await syncProfileStats();
      return true;
    }
  } catch (e) {
    console.error("Failed to upgrade booster:", e);
  }
  return false;
};

// --- League ---
export const currentLeague = createMemo(() => {
  const b = balance();
  let league = LEAGUES[0];
  for (const l of LEAGUES) {
    if (b >= l.minScore) league = l;
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
  const progress = balance() - current.minScore;
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
    console.error("Failed to sync daily status:", e);
  }
};

export const DAILY_REWARDS = [500, 1000, 2500, 5000, 10000, 15000, 25000];

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
    console.error("Failed to claim daily reward:", e);
  }
  return false;
};

// --- Referral ---
export const [referralCount, setReferralCount] = createSignal(0);
export const REFERRAL_REWARD = 10000;

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
        setEnergy(e => {
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

let pendingTaps = 0;
try {
  const savedPending = localStorage.getItem('airdrop-pending-taps');
  if (savedPending) {
    const parsed = parseInt(savedPending, 10);
    if (!isNaN(parsed) && parsed > 0) {
      pendingTaps = parsed;
    }
  }
} catch (e) {
  console.error("Failed to load pending taps:", e);
}

let syncTimeout: ReturnType<typeof setTimeout> | undefined;

let isSyncing = false;

export const syncPendingTaps = async () => {
  if (pendingTaps <= 0 || isSyncing) return;
  isSyncing = true;
  
  try {
    // Process and send in chunks of max 50 taps to satisfy backend SEC-08 limit
    while (pendingTaps > 0) {
      const tapsToSend = Math.min(pendingTaps, 50);
      try {
        const stats = await addTaps(tapsToSend);
        if (stats) {
          const unsyncedTaps = Math.max(0, pendingTaps - tapsToSend);
          
          setBalance((typeof stats.airdropCoins === 'number' ? stats.airdropCoins : 0) + unsyncedTaps * tapPower());
          if (typeof stats.energy === 'number') {
            setEnergy(Math.max(0, stats.energy - unsyncedTaps));
          }
          setFrgBalance(typeof stats.frgBalance === 'number' ? stats.frgBalance : 0);
          setTotalTaps((typeof stats.totalTaps === 'number' ? stats.totalTaps : 0) + unsyncedTaps);
          
          pendingTaps = unsyncedTaps;
          try {
            if (pendingTaps === 0) {
              localStorage.removeItem('airdrop-pending-taps');
            } else {
              localStorage.setItem('airdrop-pending-taps', pendingTaps.toString());
            }
          } catch (e) {
            console.error("Failed to save pending taps:", e);
          }
        } else {
          break;
        }
      } catch (e) {
        // Optimistic rollback: synchronize local state back to server truth on failure
        await syncProfileStats();
        console.error("Failed to sync taps with server:", e);
        break;
      }
    }
  } finally {
    isSyncing = false;
  }
};

export const recordTaps = (count: number) => {
  if (typeof count !== 'number' || !Number.isInteger(count) || count <= 0) return;
  if (energy() < count) return;
  setEnergy(e => Math.max(0, e - count));
  setBalance(b => b + count * tapPower());
  setTotalTaps(t => t + count);

  pendingTaps += count;
  try {
    localStorage.setItem('airdrop-pending-taps', pendingTaps.toString());
  } catch (e) {
    console.error("Failed to save pending taps:", e);
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
      setBalance((typeof stats.airdropCoins === 'number' ? stats.airdropCoins : 0) + pendingTaps * tapPower());
      setFrgBalance(typeof stats.frgBalance === 'number' ? stats.frgBalance : 0);
      setTotalTaps((typeof stats.totalTaps === 'number' ? stats.totalTaps : 0) + pendingTaps);
      if (typeof stats.energy === 'number') {
        setEnergy(Math.max(0, stats.energy - pendingTaps));
      }
    }
  } catch (e) {
    console.error("Failed to sync profile stats:", e);
  }
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
    console.error("Failed to sync all data sequentially:", e);
  }
};

// Sync to local storage with throttle
let pendingSave: ReturnType<typeof setTimeout> | undefined;

let _disposeAirdropFn: (() => void) | null = null;

export const initStorageSync = () => {
  if (_disposeAirdropFn) return _disposeAirdropFn;

  _disposeAirdropFn = createRoot(dispose => {
    // Energy regen in store root
    const cleanupEnergy = initEnergyRegen();

    // Fetch initial data sequentially to prevent race conditions
    syncAllData();

    getClan().then(res => {
      if (res && res.is_member && res.clan) {
        setUserClan(res.clan as Clan);
      }
    }).catch(e => console.error("Failed to load user clan:", e));

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
        savedAt: Date.now(), // Save exact timestamp
      };

      if (pendingSave) clearTimeout(pendingSave);
      
      pendingSave = setTimeout(() => {
        try {
          localStorage.setItem('airdrop-state', JSON.stringify(state));
        } catch (e) {
          console.error("Failed to save state:", e);
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

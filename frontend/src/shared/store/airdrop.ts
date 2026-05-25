import { createSignal, createMemo, createEffect, createRoot } from 'solid-js';

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

import { Clan } from '@/shared/api/bot-management.js';

const loadState = () => {
  try {
    const data = localStorage.getItem('airdrop-state');
    if (data) return JSON.parse(data);
  } catch (e) {}
  return null;
};
const savedState = loadState() || {};

// --- Core State ---
export const [userClan, setUserClan] = createSignal<Clan | null>(null);
export const [balance, setBalance] = createSignal(0);
export const [totalTaps, setTotalTaps] = createSignal(0);
export const [energy, setEnergy] = createSignal(savedState.energy !== undefined ? Math.min(savedState.energy, 500) : 500);
export const [maxEnergy, setMaxEnergy] = createSignal(savedState.maxEnergy || 500);
export const [tapPower, setTapPower] = createSignal(savedState.tapPower || 1);
export const [energyRecovery, setEnergyRecovery] = createSignal(savedState.energyRecovery || 1);
export const [frgBalance, setFrgBalance] = createSignal(0);

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
    if (backendBoosts) {
      setBoosters(prev => {
        const next = { ...prev };
        for (const b of backendBoosts) {
          if (b.type === "multitap") {
            next.tapPower = { id: 'tapPower', level: b.current_level, maxLevel: 10, baseCost: b.price_frg };
            setTapPower(b.current_level);
          } else if (b.type === "energy_limit") {
            next.energyCap = { id: 'energyCap', level: b.current_level, maxLevel: 10, baseCost: b.price_frg };
            setMaxEnergy(500 + (b.current_level - 1) * 250);
          }
        }
        return next;
      });
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

export const DAILY_REWARDS = [500, 1000, 2500, 5000, 10000, 25000, 50000];

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

// Energy regeneration timer using high-resolution monotonic performance clock
let lastRegenTime = performance.now();

export const initEnergyRegen = () => {
  const timer = setInterval(() => {
    const now = performance.now();
    const elapsed = (now - lastRegenTime) / 1000;
    if (elapsed >= 1.0) {
      const recoveryAmount = Math.floor(elapsed * energyRecovery());
      if (recoveryAmount > 0) {
        setEnergy(e => Math.min(maxEnergy(), e + recoveryAmount));
        lastRegenTime = now;
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
    pendingTaps = parseInt(savedPending, 10) || 0;
  }
} catch (e) {}

let syncTimeout: ReturnType<typeof setTimeout> | undefined;

export const syncPendingTaps = async () => {
  if (pendingTaps <= 0) return;
  const tapsToSend = pendingTaps;
  try {
    const stats = await addTaps(tapsToSend);
    if (stats) {
      setBalance(stats.airdropCoins || 0);
      setFrgBalance(stats.frgBalance || 0);
      setTotalTaps(stats.totalTaps || 0);
      
      pendingTaps = Math.max(0, pendingTaps - tapsToSend);
      if (pendingTaps === 0) {
        localStorage.removeItem('airdrop-pending-taps');
      } else {
        localStorage.setItem('airdrop-pending-taps', pendingTaps.toString());
      }
    }
  } catch (e) {
    console.error("Failed to sync taps with server:", e);
  }
};

export const recordTaps = (count: number) => {
  if (energy() < count) return;
  setEnergy(e => Math.max(0, e - count));
  setBalance(b => b + count * tapPower());
  setTotalTaps(t => t + count);

  pendingTaps += count;
  try {
    localStorage.setItem('airdrop-pending-taps', pendingTaps.toString());
  } catch (e) {}

  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    await syncPendingTaps();
  }, 1500); // 1.5 seconds debounce
};

export const syncProfileStats = async () => {
  try {
    const stats = await getProfileStats();
    if (stats) {
      setBalance(stats.airdropCoins || 0);
      setFrgBalance(stats.frgBalance || 0);
      setTotalTaps(stats.totalTaps || 0);
    }
  } catch (e) {
    console.error("Failed to sync profile stats:", e);
  }
};

// Sync to local storage with throttle
let pendingSave: ReturnType<typeof setTimeout> | undefined;

export const initStorageSync = () => {
  createRoot(() => {
    // Energy regen in store root
    initEnergyRegen();

    // Fetch initial user clan and sync profile stats from server
    syncProfileStats();
    syncDailyRewardStatus();
    syncBoostersStatus();
    syncPendingTaps();

    getClan().then(res => {
      if (res && res.is_member && res.clan) {
        setUserClan(res.clan as any);
      }
    }).catch(e => console.error("Failed to load user clan:", e));

    createEffect(() => {
      // Access only UI signals to persist them securely
      const state = {
        energy: energy(),
        maxEnergy: maxEnergy(),
        tapPower: tapPower(),
        energyRecovery: energyRecovery(),
      };

      if (pendingSave) clearTimeout(pendingSave);
      
      pendingSave = setTimeout(() => {
        localStorage.setItem('airdrop-state', JSON.stringify(state));
        pendingSave = undefined;
      }, 1000); // 1 second debounce/throttle for persistence
    });
  });
};

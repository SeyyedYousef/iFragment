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

const loadState = () => {
  try {
    const data = localStorage.getItem('airdrop-state');
    if (data) return JSON.parse(data);
  } catch (e) {}
  return null;
};
const savedState = loadState() || {};

// --- Core State ---
export const [balance, setBalance] = createSignal(savedState.balance || 0);
export const [totalTaps, setTotalTaps] = createSignal(savedState.totalTaps || 0);
export const [energy, setEnergy] = createSignal(savedState.energy !== undefined ? savedState.energy : 1000);
export const [maxEnergy, setMaxEnergy] = createSignal(savedState.maxEnergy || 1000);
export const [tapPower, setTapPower] = createSignal(savedState.tapPower || 1);
export const [energyRecovery, setEnergyRecovery] = createSignal(savedState.energyRecovery || 3);
export const [frgBalance, setFrgBalance] = createSignal(savedState.frgBalance || 0);

// --- Boosters ---
export interface Booster {
  id: string;
  level: number;
  maxLevel: number;
  baseCost: number;
}

export const [boosters, setBoosters] = createSignal<Record<string, Booster>>(savedState.boosters || {
  tapPower:  { id: 'tapPower',  level: 1,  maxLevel: 20, baseCost: 1000 },
  energyCap: { id: 'energyCap', level: 1,  maxLevel: 20, baseCost: 2000 },
  recovery:  { id: 'recovery',  level: 1,  maxLevel: 20, baseCost: 1500 },
});

export const getBoosterCost = (booster: Booster) =>
  Math.floor(booster.baseCost * Math.pow(1.8, booster.level - 1));

export const upgradeBooster = (id: string) => {
  const b = boosters()[id];
  if (!b || b.level >= b.maxLevel) return false;
  const cost = getBoosterCost(b);
  if (balance() < cost) return false;

  setBalance(v => v - cost);
  setBoosters(prev => ({ ...prev, [id]: { ...b, level: b.level + 1 } }));

  if (id === 'tapPower')  setTapPower(v => v + 1);
  if (id === 'energyCap') setMaxEnergy(v => v + 500);
  if (id === 'recovery')  setEnergyRecovery(v => v + 1);
  return true;
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
export const [streakDay, setStreakDay] = createSignal(savedState.streakDay || 0);
export const [lastCheckIn, setLastCheckIn] = createSignal<string | null>(savedState.lastCheckIn || null);

export const checkedInToday = createMemo(() => {
  const today = new Date().toISOString().split('T')[0];
  return lastCheckIn() === today;
});

export const DAILY_REWARDS = [500, 1000, 2500, 5000, 10000, 25000, 50000];

export const claimDailyReward = () => {
  const today = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().split('T')[0];

  if (lastCheckIn() === today) return false;

  let currentStreak = streakDay();
  if (lastCheckIn() !== yesterday && lastCheckIn() !== null) {
    currentStreak = 0;
  } else if (lastCheckIn() === yesterday) {
    currentStreak++;
  }
  
  if (currentStreak >= 7) {
    currentStreak = 0;
  }

  const reward = DAILY_REWARDS[currentStreak];
  setBalance(v => v + reward);
  setStreakDay(currentStreak);
  setLastCheckIn(today);
  return reward;
};

// --- Referral ---
export const [referralCount, setReferralCount] = createSignal(savedState.referralCount || 3);
export const REFERRAL_REWARD = 10000;

// --- Leaderboard functionality has been moved to LeaderboardView.tsx using TanStack Query ---

// Energy regeneration timer
export const initEnergyRegen = () => {
  const timer = setInterval(() => {
    if (energy() < maxEnergy()) {
      setEnergy(e => Math.min(e + energyRecovery(), maxEnergy()));
    }
  }, 1000);
  return () => clearInterval(timer);
};

// Sync to local storage with throttle
let pendingSave: ReturnType<typeof setTimeout> | undefined;

export const initStorageSync = () => {
  createRoot(() => {
    // Energy regen in store root
    initEnergyRegen();

    createEffect(() => {
      // Access all signals to track them
      const state = {
        balance: balance(),
        totalTaps: totalTaps(),
        energy: energy(),
        maxEnergy: maxEnergy(),
        tapPower: tapPower(),
        energyRecovery: energyRecovery(),
        frgBalance: frgBalance(),
        boosters: boosters(),
        streakDay: streakDay(),
        lastCheckIn: lastCheckIn(),
        referralCount: referralCount()
      };

      if (pendingSave) clearTimeout(pendingSave);
      
      pendingSave = setTimeout(() => {
        localStorage.setItem('airdrop-state', JSON.stringify(state));
        pendingSave = undefined;
      }, 1000); // 1 second debounce/throttle for persistence
    });
  });
};

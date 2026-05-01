import { LeaderEntry } from '@/shared/store/airdrop.js';

export const fetchLeaderboard = async (): Promise<LeaderEntry[]> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  return [
    { rank: 1, name: 'CryptoKing', score: 12_540_000, league: 'Legendary' },
    { rank: 2, name: 'TON_Whale', score: 8_320_000, league: 'Legendary' },
    { rank: 3, name: 'DiamondHands', score: 5_100_000, league: 'Legendary' },
    { rank: 4, name: 'FragMaster', score: 2_800_000, league: 'Diamond' },
    { rank: 5, name: 'NotcoinFan', score: 1_500_000, league: 'Diamond' },
    { rank: 6, name: 'TapGod', score: 980_000, league: 'Platinum' },
    { rank: 7, name: 'MoonShot', score: 650_000, league: 'Platinum' },
    { rank: 8, name: 'GoldRush', score: 320_000, league: 'Gold' },
    { rank: 9, name: 'SilverBullet', score: 150_000, league: 'Silver' },
    { rank: 10, name: 'NewMiner', score: 45_000, league: 'Bronze' },
  ];
};

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
	userId?: number;
}

export interface Booster {
	id: string;
	name: string;
	level: number;
	maxLevel: number;
	basePrice: number;
	priceMultiplier: number;
	effect: number;
	effectUnit: string;
	icon: string;
}

export interface WalletExpirySummary {
	totalCoins: number;
	earliestExpiringCoins: number;
	earliestExpiresAt: string;
	earliestDaysLeft: number;
	expiringSoonAmount: number;
	creditExpiresInDays: number;
}

export interface ReferralFriend {
	telegramId: number;
	username?: string;
	firstName?: string;
	joinedAt: string;
	coinsEarned: number;
	tier: number;
	active: boolean;
}

export interface ReferralHubData {
	referralCode: string;
	totalInvited: number;
	totalEarned: number;
	tier1Earnings: number;
	tier2Earnings: number;
	valuationCredits: number;
	friends: ReferralFriend[];
}

export const LEAGUES: League[] = [
	{ name: 'Bronze', icon: 'looks_3', minScore: 0, color: '#cd7f32' },
	{ name: 'Silver', icon: 'looks_two', minScore: 5_000, color: '#c0c0c0' },
	{ name: 'Gold', icon: 'looks_one', minScore: 25_000, color: '#ffd700' },
	{ name: 'Platinum', icon: 'workspace_premium', minScore: 100_000, color: '#e5e4e2' },
	{ name: 'Diamond', icon: 'diamond', minScore: 500_000, color: '#3390ec' },
	{ name: 'Master', icon: 'auto_awesome', minScore: 2_000_000, color: '#ff6b35' },
	{ name: 'Grandmaster', icon: 'emoji_events', minScore: 10_000_000, color: '#ff1744' },
];

export const CLAN_LEAGUES: League[] = [
	{ name: 'Bronze', icon: 'looks_3', minScore: 0, color: '#cd7f32' },
	{ name: 'Silver', icon: 'looks_two', minScore: 100_000, color: '#c0c0c0' },
	{ name: 'Gold', icon: 'looks_one', minScore: 1_000_000, color: '#ffd700' },
	{ name: 'Platinum', icon: 'workspace_premium', minScore: 10_000_000, color: '#e5e4e2' },
	{ name: 'Diamond', icon: 'diamond', minScore: 50_000_000, color: '#3390ec' },
	{ name: 'Master', icon: 'auto_awesome', minScore: 250_000_000, color: '#ff6b35' },
	{ name: 'Grandmaster', icon: 'emoji_events', minScore: 1_000_000_000, color: '#ff1744' },
];

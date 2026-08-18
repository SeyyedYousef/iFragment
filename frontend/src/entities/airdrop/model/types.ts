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

export const CLAN_LEAGUES: League[] = [
	{ name: 'Wood', icon: 'park', minScore: 0, color: '#8B6F47' },
	{ name: 'Bronze', icon: 'looks_3', minScore: 1_000_000, color: '#cd7f32' },
	{ name: 'Silver', icon: 'looks_two', minScore: 10_000_000, color: '#c0c0c0' },
	{ name: 'Gold', icon: 'looks_one', minScore: 50_000_000, color: '#ffd700' },
	{ name: 'Platinum', icon: 'workspace_premium', minScore: 250_000_000, color: '#e5e4e2' },
	{ name: 'Diamond', icon: 'diamond', minScore: 1_000_000_000, color: '#3390ec' },
	{ name: 'Master', icon: 'auto_awesome', minScore: 5_000_000_000, color: '#ff6b35' },
	{ name: 'Grandmaster', icon: 'emoji_events', minScore: 25_000_000_000, color: '#ff1744' },
];

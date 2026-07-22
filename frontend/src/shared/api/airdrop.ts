import { getLeaderboard } from '@/shared/api/profile.js';
import { LEAGUES, LeaderEntry } from '@/shared/store/airdrop.js';

export const fetchLeaderboard = async (period?: string | unknown): Promise<{
	leaderboard: LeaderEntry[];
	total_miners: number;
}> => {
	try {
		const p = typeof period === 'string' ? period : 'day';
		const response = await getLeaderboard(p);
		if (!response?.leaderboard) return { leaderboard: [], total_miners: 0 };

		const entries = response.leaderboard.map((m) => {
			// Determine league based on score/xp
			let league = LEAGUES[0];
			for (const l of LEAGUES) {
				if (m.xp >= l.minScore) league = l;
			}
			return {
				rank: m.rank,
				name: m.first_name || m.username || `Miner #${m.user_id}`,
				score: m.xp,
				league: league.name,
				level: m.level,
				clanName: m.clan_name,
			};
		});

		return { leaderboard: entries, total_miners: response.total_miners || 0 };
	} catch (e) {
		console.error('Failed to fetch leaderboard:', e);
		return { leaderboard: [], total_miners: 0 };
	}
};

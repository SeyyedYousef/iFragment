import { getLeaderboard } from '@/entities/user/index.js';
import { type LeaderEntry, LEAGUES } from '../model/types.js';

export const fetchLeaderboard = async (
	period?: string | unknown,
	league?: string,
): Promise<{
	leaderboard: LeaderEntry[];
	total_miners: number;
	user_rank?: number;
}> => {
	try {
		const p = typeof period === 'string' ? period : 'day';
		const response = await getLeaderboard(p, league);
		if (!response?.leaderboard) return { leaderboard: [], total_miners: 0, user_rank: 0 };

		const entries = response.leaderboard.map((m) => {
			let userLeague = LEAGUES[0];
			for (const l of LEAGUES) {
				if (m.xp >= l.minScore) userLeague = l;
			}
			return {
				rank: m.rank,
				name: m.first_name || m.username || `Miner #${m.user_id}`,
				score: m.xp,
				league: userLeague.name,
				level: m.level,
				clanName: m.clan_name,
				userId: m.user_id,
			};
		});

		return {
			leaderboard: entries,
			total_miners: response.total_miners || 0,
			user_rank: response.user_rank || 0,
		};
	} catch (e) {
		console.error('Failed to fetch leaderboard:', e);
		return { leaderboard: [], total_miners: 0, user_rank: 0 };
	}
};

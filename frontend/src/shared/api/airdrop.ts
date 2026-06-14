import { getLeaderboard } from '@/shared/api/profile.js';
import { LEAGUES, LeaderEntry } from '@/shared/store/airdrop.js';

export const fetchLeaderboard = async (): Promise<LeaderEntry[]> => {
	try {
		const members = await getLeaderboard();
		if (!members) return [];

		return members.map((m) => {
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
			};
		});
	} catch (e) {
		console.error('Failed to fetch leaderboard:', e);
		return [];
	}
};

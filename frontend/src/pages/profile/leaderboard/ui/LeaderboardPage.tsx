import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { backButton } from '@tma.js/sdk-solid';
import { type Component, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import {
	type Clan,
	getLeaderboard,
	getProfileStats,
	getTopClans,
	type LeaderboardMember,
} from '@/entities/user/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { type LeaderboardEntry, LeaderboardShell } from '@/widgets/leaderboard/index.js';

export const LeaderboardPage: Component = () => {
	const navigate = useNavigate();
	const [activeScope, setActiveScope] = createSignal('global');
	const [activePeriod, setActivePeriod] = createSignal('all');

	const leaderboardQuery = createQuery(() => ({
		queryKey: ['profile', 'leaderboard', activeScope(), activePeriod()],
		queryFn: async () => {
			if (activeScope() === 'clans') {
				const clans = await getTopClans(activePeriod());
				return {
					leaderboard: clans.map((c: Clan) => ({
						rank: c.rank || 1,
						user_id: c.telegram_channel_id,
						first_name: c.chat_title,
						username: c.channel_username,
						level: c.members_count,
						xp: c.total_score || c.members_count * 1500,
					})),
				};
			}
			return getLeaderboard(activePeriod());
		},
		staleTime: 30000,
	}));

	const statsQuery = createQuery(() => ({
		queryKey: ['profile', 'stats'],
		queryFn: getProfileStats,
		staleTime: 15000,
	}));

	const rawLeaderboard = () => leaderboardQuery.data?.leaderboard || [];
	const myStats = () => statsQuery.data || null;

	const formattedEntries = createMemo<LeaderboardEntry[]>(() => {
		const unit = activeScope() === 'clans' ? '🪙' : 'XP';
		return rawLeaderboard().map((m: LeaderboardMember) => ({
			rank: m.rank,
			id: m.user_id,
			name: m.first_name,
			score: m.xp,
			scoreUnit: unit,
			isCurrentUser: activeScope() !== 'clans' && myStats()?.globalRank === m.rank,
		}));
	});

	const currentUserEntry = createMemo<LeaderboardEntry | undefined>(() => {
		const s = myStats();
		if (!s?.globalRank) return undefined;
		return {
			rank: s.globalRank,
			id: 'me',
			name: t('leaderboard.you'),
			score: s.xp,
			scoreUnit: 'XP',
			isCurrentUser: true,
		};
	});

	onMount(() => {
		try {
			backButton.show();
			const off = backButton.onClick(() => {
				try {
					haptic.impact('light');
				} catch {}
				navigate('/profile');
			});
			onCleanup(() => {
				off();
				try {
					backButton.hide();
				} catch {}
			});
		} catch {}
	});

	return (
		<div
			class="min-h-screen bg-[#030303] text-white font-sans flex flex-col relative overflow-x-hidden selection:bg-amber-400/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow (Premium Gaming Theme) */}
			<div class="absolute top-0 left-0 right-0 h-[450px] bg-gradient-to-b from-amber-400/15 via-[#3390ec]/5 to-transparent blur-[90px] pointer-events-none z-0" />

			<div class="flex-1 w-full max-w-md mx-auto relative z-10 flex flex-col pt-2 pb-10">
				<LeaderboardShell
					title={t('leaderboard.title')}
					subtitle={t('leaderboard.subtitle')}
					scopeTabs={[
						{ id: 'global', label: t('leaderboard.scopeGlobal') },
						{ id: 'clans', label: t('leaderboard.scopeClans') },
					]}
					activeScope={activeScope()}
					onScopeChange={(s) => {
						try {
							haptic.selection();
						} catch {}
						setActiveScope(s);
					}}
					periodFilter={[
						{ id: 'all', label: t('leaderboard.periodAll') },
						{ id: 'weekly', label: t('leaderboard.periodWeekly') },
					]}
					activePeriod={activePeriod()}
					onPeriodChange={(p) => {
						try {
							haptic.selection();
						} catch {}
						setActivePeriod(p);
					}}
					entries={formattedEntries()}
					currentUserEntry={currentUserEntry()}
					loading={leaderboardQuery.isLoading || statsQuery.isLoading}
				/>
			</div>
		</div>
	);
};

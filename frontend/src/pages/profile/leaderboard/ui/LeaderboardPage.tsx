import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { getLeaderboard, getProfileStats } from '@/shared/api/profile.js';
import { t } from '@/shared/i18n/index.js';
import { type LeaderboardEntry, LeaderboardShell } from '@/widgets/leaderboard/LeaderboardShell.js';

export const LeaderboardPage: Component = () => {
	const navigate = useNavigate();
	const [activeScope, setActiveScope] = createSignal('global');
	const [activePeriod, setActivePeriod] = createSignal('all');

	const leaderboardQuery = createQuery(() => ({
		queryKey: ['profile', 'leaderboard'],
		queryFn: getLeaderboard,
		staleTime: 60000,
	}));

	const statsQuery = createQuery(() => ({
		queryKey: ['profile', 'stats'],
		queryFn: getProfileStats,
		staleTime: 15000,
	}));

	const rawLeaderboard = () => leaderboardQuery.data?.leaderboard || [];
	const myStats = () => statsQuery.data || null;

	const formattedEntries = createMemo<LeaderboardEntry[]>(() => {
		return rawLeaderboard().map((m) => ({
			rank: m.rank,
			id: m.user_id,
			name: m.first_name,
			score: m.xp,
			scoreUnit: 'XP',
			isCurrentUser: myStats()?.globalRank === m.rank,
		}));
	});

	const currentUserEntry = createMemo<LeaderboardEntry | undefined>(() => {
		const s = myStats();
		if (!s?.globalRank) return undefined;
		return {
			rank: s.globalRank,
			id: 'me',
			name: 'شما',
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
					hapticFeedback.impactOccurred('light');
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
		<div class="theme-play min-h-screen bg-[#08090D] p-5 text-white select-none">
			<LeaderboardShell
				title={t('gamification.globalLeaderboard') || 'جدول برترین‌های جهانی'}
				subtitle={
					t('gamification.leaderboardSubtitle') || '۱۰۰ ماینر و کاربر برتر iFragment در سراسر جهان'
				}
				scopeTabs={[
					{ id: 'global', label: 'جهانی' },
					{ id: 'clans', label: 'کلن‌ها' },
				]}
				activeScope={activeScope()}
				onScopeChange={(s) => setActiveScope(s)}
				periodFilter={[
					{ id: 'all', label: 'کل دوره' },
					{ id: 'weekly', label: 'هفتگی' },
				]}
				activePeriod={activePeriod()}
				onPeriodChange={(p) => setActivePeriod(p)}
				entries={formattedEntries()}
				currentUserEntry={currentUserEntry()}
				loading={leaderboardQuery.isLoading || statsQuery.isLoading}
			/>
		</div>
	);
};

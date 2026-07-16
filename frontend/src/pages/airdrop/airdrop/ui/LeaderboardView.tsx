import { createQuery } from '@tanstack/solid-query';
import { Component, createSignal, For, Show } from 'solid-js';
import { fetchLeaderboard } from '@/shared/api/airdrop.js';
import { getTopClans, getProfileStats } from '@/shared/api/profile.js';
import { LEAGUES } from '@/shared/store/airdrop.js';
import { t } from '@/shared/i18n/index.js';
import { API_CONFIG } from '@/shared/api/config.js';

export const LeaderboardView: Component = () => {
	const [selectedLeagueIndex, setSelectedLeagueIndex] = createSignal(0);
	const [activeTab, setActiveTab] = createSignal<'miners' | 'squads'>('miners');
	const [activeSubTab, setActiveSubTab] = createSignal<'day' | 'week'>('day');

	const leaderboardQuery = createQuery(() => ({
		queryKey: ['leaderboard'],
		queryFn: fetchLeaderboard,
		staleTime: 30_000,
		refetchOnWindowFocus: false,
	}));

	const clansQuery = createQuery(() => ({
		queryKey: ['topClansLeaderboard'],
		queryFn: getTopClans,
		staleTime: 30_000,
		refetchOnWindowFocus: false,
	}));

	const statsQuery = createQuery(() => ({
		queryKey: ['profile-stats'],
		queryFn: getProfileStats,
		staleTime: 30_000,
		refetchOnWindowFocus: false,
	}));

	const currentLeague = () => LEAGUES[selectedLeagueIndex()] || LEAGUES[0];

	const handlePrevLeague = () => {
		setSelectedLeagueIndex(prev => Math.max(0, prev - 1));
	};
	const handleNextLeague = () => {
		setSelectedLeagueIndex(prev => Math.min(LEAGUES.length - 1, prev + 1));
	};

	const filteredMiners = () => {
		const data = leaderboardQuery.data?.leaderboard || [];
		const league = currentLeague().name;
		return data.filter((e) => e.league === league);
	};

	const filteredSquads = () => {
		const data = clansQuery.data || [];
		const minScore = currentLeague().minScore;
		const nextScore = LEAGUES[selectedLeagueIndex() + 1]?.minScore || Infinity;
		return data.filter(c => {
			const score = c.total_score || c.members_count * 1500;
			return score >= minScore && score < nextScore;
		});
	};

	const formatScore = (score: number) => {
		if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(2)}M`;
		if (score >= 1_000) return `${(score / 1_000).toFixed(0)}K`;
		return score.toLocaleString('en-US');
	};

	const progressPercent = () => {
		const currentScore = statsQuery.data?.xp || 0;
		const minScore = currentLeague().minScore;
		const nextScore = LEAGUES[Math.min(LEAGUES.length - 1, selectedLeagueIndex() + 1)].minScore;
		if (nextScore <= minScore) return 100;
		const pct = ((currentScore - minScore) / (nextScore - minScore)) * 100;
		return Math.min(100, Math.max(0, Math.round(pct)));
	};

	const getRankBadgeStyle = (index: number) => {
		if (index === 0) return { bg: 'bg-[#2a220c] text-[#f59e0b] border-[#523e14]', label: '01' };
		if (index === 1) return { bg: 'bg-[#1a202c] text-[#cbd5e1] border-[#334155]', label: '02' };
		if (index === 2) return { bg: 'bg-[#271911] text-[#d97706] border-[#452715]', label: '03' };
		return { bg: 'bg-[#111622] text-[#64748b] border-[#1e293b]', label: index < 9 ? `0${index + 1}` : `${index + 1}` };
	};

	return (
		<div
			class="h-full w-full overflow-y-auto no-scrollbar relative pb-28 select-none font-sans"
			style={{ background: '#090b10', color: '#f8fafc' }}
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Fragment subtle grid background accent */}
			<div 
				class="absolute inset-0 pointer-events-none opacity-[0.03]"
				style={{
					'background-image': `radial-gradient(#ffffff 1px, transparent 1px)`,
					'background-size': '24px 24px'
				}}
			/>

			<div class="relative z-10 flex flex-col gap-4 pt-4 max-w-md mx-auto px-4">

				{/* ═══════ Fragment League Emblem Card ═══════ */}
				<div class="bg-[#111622] border border-[#1e293b] rounded-2xl p-5 flex flex-col items-center relative overflow-hidden shadow-xl">
					
					{/* Top Hairline Accent */}
					<div 
						class="absolute top-0 left-0 right-0 h-[2px] transition-colors duration-500" 
						style={{ background: `linear-gradient(90deg, transparent, ${currentLeague().color}, transparent)` }}
					/>

					{/* League Icon */}
					<div
						class="w-20 h-20 rounded-2xl flex items-center justify-center mb-3 relative z-10 border border-[#1e293b] bg-[#090b10] shadow-inner transition-all duration-300"
					>
						<span
							class="material-symbols-outlined text-[40px] transition-colors duration-500"
							style={{ color: currentLeague().color, 'font-variation-settings': '"FILL" 1' }}
						>
							{currentLeague().icon}
						</span>
					</div>

					{/* Navigation + League Name */}
					<div class="flex items-center justify-between w-full z-10 mb-1">
						<button
							onClick={handlePrevLeague}
							disabled={selectedLeagueIndex() === 0}
							class={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border ${
								selectedLeagueIndex() === 0
									? 'opacity-20 border-transparent cursor-not-allowed'
									: 'bg-[#090b10] border-[#1e293b] text-[#8b94a5] hover:text-white hover:border-[#334155] active:scale-95'
							}`}
						>
							<span class="material-symbols-outlined text-lg">chevron_left</span>
						</button>

						<h2 class="text-white font-bold text-lg uppercase tracking-wider font-mono text-center">
							{currentLeague().name} LEAGUE
						</h2>

						<button
							onClick={handleNextLeague}
							disabled={selectedLeagueIndex() === LEAGUES.length - 1}
							class={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border ${
								selectedLeagueIndex() === LEAGUES.length - 1
									? 'opacity-20 border-transparent cursor-not-allowed'
									: 'bg-[#090b10] border-[#1e293b] text-[#8b94a5] hover:text-white hover:border-[#334155] active:scale-95'
							}`}
						>
							<span class="material-symbols-outlined text-lg">chevron_right</span>
						</button>
					</div>

					{/* Progress Bar Section */}
					<div class="w-full mt-3 z-10">
						<div class="flex items-center justify-between text-xs font-mono text-[#64748b] mb-1.5" dir="ltr">
							<span>{(statsQuery.data?.xp || 0).toLocaleString('en-US')} XP</span>
							<span>{formatScore(LEAGUES[Math.min(LEAGUES.length - 1, selectedLeagueIndex() + 1)].minScore)} XP</span>
						</div>
						<div class="w-full h-2 bg-[#090b10] rounded-full overflow-hidden border border-[#1e293b] relative">
							<div
								class="h-full rounded-full transition-all duration-500 ease-out"
								style={{
									width: `${Math.max(3, progressPercent())}%`,
									background: currentLeague().color,
								}}
							/>
						</div>
					</div>

					{/* Stats Pill */}
					<div class="mt-4 flex items-center justify-between w-full pt-3 border-t border-[#1e293b] text-xs font-medium">
						<span class="text-[#64748b] font-mono uppercase text-[10px]">TOTAL MINERS</span>
						<span class="text-white font-mono font-semibold">
							{formatScore(leaderboardQuery.data?.total_miners || 20043793)} Miners
						</span>
					</div>
				</div>

				{/* ═══════ Main Tabs (Miners / Squads) ═══════ */}
				<div class="bg-[#111622] rounded-xl p-1 flex gap-1 border border-[#1e293b]">
					<button
						onClick={() => setActiveTab('miners')}
						class={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
							activeTab() === 'miners'
								? 'bg-[#00f0ff] text-black shadow-md font-semibold'
								: 'text-[#64748b] hover:text-white'
						}`}
					>
						{t('airdropFinal.leaderboard.miners', { defaultValue: 'MINERS' })}
					</button>
					<button
						onClick={() => setActiveTab('squads')}
						class={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
							activeTab() === 'squads'
								? 'bg-[#00f0ff] text-black shadow-md font-semibold'
								: 'text-[#64748b] hover:text-white'
						}`}
					>
						{t('airdropFinal.leaderboard.squads', { defaultValue: 'SQUADS' })}
					</button>
				</div>

				{/* ═══════ Sub Tabs & Header ═══════ */}
				<div class="flex justify-between items-center px-1 mt-1">
					<span class="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
						{activeTab() === 'miners' ? 'Top Miners' : 'Top Squads'}
					</span>
					<div class="bg-[#111622] p-0.5 rounded-lg border border-[#1e293b] flex gap-1">
						<button
							onClick={() => setActiveSubTab('day')}
							class={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
								activeSubTab() === 'day'
									? 'bg-[#1e293b] text-white font-semibold'
									: 'text-[#64748b] hover:text-white'
							}`}
						>
							Daily
						</button>
						<button
							onClick={() => setActiveSubTab('week')}
							class={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
								activeSubTab() === 'week'
									? 'bg-[#1e293b] text-white font-semibold'
									: 'text-[#64748b] hover:text-white'
							}`}
						>
							Weekly
						</button>
					</div>
				</div>

				{/* ═══════ Leaderboard List ═══════ */}
				<div class="flex flex-col gap-2 min-h-[300px]">

					{/* Miners Tab */}
					<Show when={activeTab() === 'miners'}>
						<Show
							when={!leaderboardQuery.isLoading}
							fallback={
								<div class="flex flex-col items-center justify-center py-16 gap-3">
									<div class="w-6 h-6 border-2 border-[#1e293b] border-t-[#00f0ff] rounded-full animate-spin" />
									<span class="text-xs text-[#64748b] font-medium">Loading Leaderboard...</span>
								</div>
							}
						>
							<For each={filteredMiners()} fallback={
								<div class="bg-[#111622] rounded-xl border border-[#1e293b] p-8 text-center text-[#475569] text-xs font-medium">
									{t('airdropFinal.leaderboard.noMiners', { defaultValue: 'No miners found in this league.' })}
								</div>
							}>
								{(entry, i) => {
									const badge = () => getRankBadgeStyle(i());
									return (
										<div class="flex items-center justify-between p-3 rounded-xl bg-[#111622] border border-[#1e293b] hover:border-[#334155] transition-all">
											<div class="flex items-center gap-3 min-w-0">
												{/* Rank Badge */}
												<div class={`w-7 h-7 rounded-md flex items-center justify-center font-mono font-bold text-xs border shrink-0 ${badge().bg}`}>
													{badge().label}
												</div>

												{/* Avatar */}
												<div class="w-9 h-9 rounded-full bg-[#090b10] border border-[#1e293b] flex items-center justify-center text-xs font-semibold text-white shrink-0">
													{entry.name.slice(0, 2).toUpperCase()}
												</div>

												{/* Name */}
												<span class="text-white font-semibold text-sm truncate max-w-[140px]">
													{entry.name}
												</span>
											</div>

											{/* Score */}
											<div class="shrink-0 font-mono text-xs font-semibold text-[#00f0ff] bg-[#090b10] px-2.5 py-1 rounded-md border border-[#1e293b]">
												{formatScore(entry.score)} XP
											</div>
										</div>
									);
								}}
							</For>
						</Show>
					</Show>

					{/* Squads Tab */}
					<Show when={activeTab() === 'squads'}>
						<Show
							when={!clansQuery.isLoading}
							fallback={
								<div class="flex flex-col items-center justify-center py-16 gap-3">
									<div class="w-6 h-6 border-2 border-[#1e293b] border-t-[#00f0ff] rounded-full animate-spin" />
									<span class="text-xs text-[#64748b] font-medium">Loading Squads...</span>
								</div>
							}
						>
							<For each={filteredSquads()} fallback={
								<div class="bg-[#111622] rounded-xl border border-[#1e293b] p-8 text-center text-[#475569] text-xs font-medium">
									{t('airdropFinal.leaderboard.noSquads', { defaultValue: 'No squads found in this league.' })}
								</div>
							}>
								{(clan, i) => {
									const score = clan.total_score || clan.members_count * 1500;
									const badge = () => getRankBadgeStyle(i());
									return (
										<div class="flex items-center justify-between p-3 rounded-xl bg-[#111622] border border-[#1e293b] hover:border-[#334155] transition-all">
											<div class="flex items-center gap-3 min-w-0">
												{/* Rank Badge */}
												<div class={`w-7 h-7 rounded-md flex items-center justify-center font-mono font-bold text-xs border shrink-0 ${badge().bg}`}>
													{badge().label}
												</div>

												{/* Clan Photo */}
												<div class="w-9 h-9 rounded-lg overflow-hidden border border-[#1e293b] bg-[#090b10] flex items-center justify-center shrink-0">
													{clan.channel_photo ? (
														<img
															src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan.channel_username}`}
															alt={clan.chat_title}
															class="w-full h-full object-cover"
														/>
													) : (
														<span class="material-symbols-outlined text-base text-[#00f0ff]">groups</span>
													)}
												</div>

												{/* Squad Info */}
												<div class="flex flex-col min-w-0">
													<span class="text-white font-semibold text-sm truncate max-w-[130px]">
														{clan.chat_title}
													</span>
													<span class="text-[#64748b] text-[11px] font-mono">
														{clan.members_count.toLocaleString('en-US')} members
													</span>
												</div>
											</div>

											{/* Score */}
											<div class="shrink-0 font-mono text-xs font-semibold text-[#00f0ff] bg-[#090b10] px-2.5 py-1 rounded-md border border-[#1e293b]">
												{formatScore(score)} XP
											</div>
										</div>
									);
								}}
							</For>
						</Show>
					</Show>
				</div>
			</div>
		</div>
	);
};

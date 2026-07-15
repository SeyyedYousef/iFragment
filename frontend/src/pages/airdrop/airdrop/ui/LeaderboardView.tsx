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

	const getRankBadge = (index: number) => {
		if (index === 0) return { bg: 'bg-amber-400/10 text-amber-400 border-amber-400/30', icon: '👑', rankText: '1' };
		if (index === 1) return { bg: 'bg-slate-300/10 text-slate-300 border-slate-300/30', icon: '🥈', rankText: '2' };
		if (index === 2) return { bg: 'bg-amber-700/10 text-amber-600 border-amber-600/30', icon: '🥉', rankText: '3' };
		return { bg: 'bg-white/5 text-white/50 border-white/5', icon: null, rankText: (index + 1).toLocaleString('en-US') };
	};

	return (
		<div 
			class="h-full w-full overflow-y-auto no-scrollbar bg-[#07070a] relative pb-28" 
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Top ambient glow based on league color */}
			<div 
				class="absolute top-0 left-0 right-0 h-[300px] pointer-events-none transition-all duration-700 z-0 opacity-30"
				style={{
					background: `radial-gradient(ellipse at top, ${currentLeague().color} 0%, transparent 70%)`
				}}
			/>

			<div class="relative z-10 flex flex-col pt-3 gap-4">
				{/* Top Stats Capsule */}
				<div class="flex justify-center px-4">
					<div class="bg-white/[0.04] backdrop-blur-md rounded-2xl px-4 py-2.5 flex items-center justify-between w-full max-w-[340px] border border-white/10 shadow-lg">
						<div class="flex items-center gap-2">
							<span class="text-base">🪙</span>
							<span class="text-white font-semibold text-xs tracking-wide">
								{(() => {
									const raw = (t('airdropFinal.leaderboard.totalMiners' as any) as string) || '{count} Fragmenters';
									return raw.replace('{count}', formatScore(leaderboardQuery.data?.total_miners || 20043793));
								})()}
							</span>
						</div>
						<div class="flex items-center gap-1 text-white/50 hover:text-white transition-colors cursor-pointer text-xs font-medium">
							<span>{t('airdropFinal.leaderboard.stats', { defaultValue: 'Stats' })}</span>
							<span class="material-symbols-outlined text-sm">chevron_right</span>
						</div>
					</div>
				</div>

				{/* League Emblem Card presentation (Compact & Premium) */}
				<div class="relative px-6 py-4 mx-4 rounded-3xl bg-white/[0.02] border border-white/5 overflow-hidden flex flex-col items-center shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
					{/* Card Internal Glow */}
					<div 
						class="absolute inset-0 pointer-events-none transition-all duration-700 opacity-20 blur-2xl"
						style={{
							background: `radial-gradient(circle, ${currentLeague().color} 0%, transparent 70%)`
						}}
					/>
					
					{/* League Icon */}
					<div class="relative z-10 w-24 h-24 mb-2 flex items-center justify-center drop-shadow-[0_4px_15px_rgba(0,0,0,0.4)]">
						<span class="text-[75px] leading-none transform hover:scale-105 transition-transform duration-300">🏆</span>
					</div>

					{/* Navigation controls */}
					<div class="flex items-center justify-between w-full z-10">
						<button 
							onClick={handlePrevLeague} 
							disabled={selectedLeagueIndex() === 0}
							class={`w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center transition-all ${
								selectedLeagueIndex() === 0 ? 'opacity-30 cursor-not-allowed' : 'active:scale-95 hover:bg-white/10'
							}`}
						>
							<span class="material-symbols-outlined text-white text-base">chevron_left</span>
						</button>
						<h2 
							class="text-white font-black text-xl tracking-wide uppercase text-center" 
							style={{ textShadow: `0 0 15px ${currentLeague().color}60` }}
						>
							{currentLeague().name} {t('airdropFinal.leaderboard.league', { defaultValue: 'LEAGUE' })}
						</h2>
						<button 
							onClick={handleNextLeague}
							disabled={selectedLeagueIndex() === LEAGUES.length - 1}
							class={`w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center transition-all ${
								selectedLeagueIndex() === LEAGUES.length - 1 ? 'opacity-30 cursor-not-allowed' : 'active:scale-95 hover:bg-white/10'
							}`}
						>
							<span class="material-symbols-outlined text-white text-base">chevron_right</span>
						</button>
					</div>

					{/* Progress Slider */}
					<div class="w-full flex flex-col items-center mt-3.5 z-10">
						<div class="flex items-center justify-between w-full max-w-[220px] text-[11px] font-mono text-white/50 mb-1.5" dir="ltr">
							<span>{(statsQuery.data?.xp || 0).toLocaleString('en-US')}</span>
							<span class="text-white/20">/</span>
							<span>{formatScore(LEAGUES[Math.min(LEAGUES.length - 1, selectedLeagueIndex() + 1)].minScore)}</span>
						</div>
						<div class="w-full max-w-[220px] h-1.5 bg-white/10 rounded-full overflow-hidden">
							<div 
								class="h-full rounded-full transition-all duration-700 ease-out"
								style={{ 
									width: `${progressPercent()}%`, 
									background: currentLeague().color,
									boxShadow: `0 0 8px ${currentLeague().color}`
								}}
							/>
						</div>
					</div>
				</div>

				{/* Tab Selection */}
				<div class="px-4">
					<div class="w-full bg-white/[0.02] rounded-2xl p-1 flex border border-white/5 shadow-inner">
						<button 
							onClick={() => setActiveTab('miners')}
							class={`flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-300 ${
								activeTab() === 'miners' 
									? 'bg-white text-black shadow-lg' 
									: 'text-white/60 hover:text-white'
							}`}
						>
							{t('airdropFinal.leaderboard.miners', { defaultValue: 'MINERS' })}
						</button>
						<button 
							onClick={() => setActiveTab('squads')}
							class={`flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-300 ${
								activeTab() === 'squads' 
									? 'bg-white text-black shadow-lg' 
									: 'text-white/60 hover:text-white'
							}`}
						>
							{t('airdropFinal.leaderboard.squads', { defaultValue: 'SQUADS' })}
						</button>
					</div>
				</div>

				{/* List Section wrapper */}
				<div class="bg-white/[0.01] rounded-t-[32px] pt-4 px-4 min-h-[400px] border-t border-white/5 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] flex flex-col">
					{/* Sub Tabs Selection (Daily / Weekly) */}
					<div class="flex items-center justify-center mb-4">
						<div class="bg-white/[0.03] rounded-full p-1 border border-white/5 flex gap-1 w-full max-w-[240px]">
							<button 
								onClick={() => setActiveSubTab('day')}
								class={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
									activeSubTab() === 'day' 
										? 'bg-white/10 text-white shadow-sm' 
										: 'text-white/40 hover:text-white/70'
								}`}
							>
								{(t('airdropFinal.leaderboard.day' as any) as string) || 'Daily'}
							</button>
							<button 
								onClick={() => setActiveSubTab('week')}
								class={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
									activeSubTab() === 'week' 
										? 'bg-white/10 text-white shadow-sm' 
										: 'text-white/40 hover:text-white/70'
								}`}
							>
								{(t('airdropFinal.leaderboard.week' as any) as string) || 'Weekly'}
							</button>
						</div>
					</div>

					{/* List elements container */}
					<div class="flex-1 w-full space-y-2">
						<Show when={activeTab() === 'miners'}>
							<Show
								when={!leaderboardQuery.isLoading}
								fallback={
									<div class="flex flex-col items-center justify-center py-16 gap-3">
										<div class="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
										<span class="text-xs text-white/40">Loading Miners...</span>
									</div>
								}
							>
								<For each={filteredMiners()} fallback={
									<div class="text-white/40 text-xs text-center py-12">
										{t('airdropFinal.leaderboard.noMiners', { defaultValue: 'No miners found in this league.' })}
									</div>
								}>
									{(entry, i) => {
										const badge = () => getRankBadge(i());
										return (
											<div class="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all duration-150">
												<div class="flex items-center gap-3">
													{/* Rank Badge */}
													<div class={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs border ${badge().bg}`}>
														{badge().icon || badge().rankText}
													</div>

													{/* Avatar placeholder / initials */}
													<div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white font-bold border border-white/5">
														{entry.name.slice(0, 2).toUpperCase()}
													</div>

													{/* User Info */}
													<div class="flex flex-col">
														<span class="text-white font-medium text-sm truncate max-w-[150px]">
															{entry.name}
														</span>
													</div>
												</div>

												{/* Score */}
												<div class="flex items-center gap-1">
													<span class="text-xs">🪙</span>
													<span class="text-white font-bold text-sm font-mono" dir="ltr">
														{formatScore(entry.score)}
													</span>
												</div>
											</div>
										);
									}}
								</For>
							</Show>
						</Show>

						<Show when={activeTab() === 'squads'}>
							<Show
								when={!clansQuery.isLoading}
								fallback={
									<div class="flex flex-col items-center justify-center py-16 gap-3">
										<div class="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
										<span class="text-xs text-white/40">Loading Squads...</span>
									</div>
								}
							>
								<For each={filteredSquads()} fallback={
									<div class="text-white/40 text-xs text-center py-12">
										{t('airdropFinal.leaderboard.noSquads', { defaultValue: 'No squads found in this league.' })}
									</div>
								}>
									{(clan, i) => {
										const score = clan.total_score || clan.members_count * 1500;
										const badge = () => getRankBadge(i());
										return (
											<div class="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all duration-150">
												<div class="flex items-center gap-3">
													{/* Rank Badge */}
													<div class={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs border ${badge().bg}`}>
														{badge().icon || badge().rankText}
													</div>

													{/* Clan Photo / Icon */}
													<div class="w-10 h-10 rounded-xl bg-white/5 overflow-hidden flex items-center justify-center border border-white/5 p-0.5">
														{clan.channel_photo ? (
															<img
																src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan.channel_username}`}
																alt={clan.chat_title}
																class="w-full h-full rounded-[8px] object-cover"
															/>
														) : (
															<span class="text-lg">🛡️</span>
														)}
													</div>

													{/* Squad Info */}
													<div class="flex flex-col">
														<span class="text-white font-medium text-sm truncate max-w-[140px]">
															{clan.chat_title}
														</span>
														<span class="text-white/40 text-[10px]" dir="ltr">
															{clan.members_count.toLocaleString('en-US')} {t('airdropFinal.leaderboard.players', { defaultValue: 'players' })}
														</span>
													</div>
												</div>

												{/* Score */}
												<div class="flex items-center gap-1">
													<span class="text-xs">🪙</span>
													<span class="text-white font-bold text-sm font-mono" dir="ltr">
														{formatScore(score)}
													</span>
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
		</div>
	);
};

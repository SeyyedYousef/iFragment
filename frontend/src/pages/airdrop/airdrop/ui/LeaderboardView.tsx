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
		if (index === 0) return { bg: 'bg-amber-400/20 text-amber-300 border-amber-400/40', icon: '👑', rankText: '1' };
		if (index === 1) return { bg: 'bg-slate-300/20 text-slate-200 border-slate-300/40', icon: '🥈', rankText: '2' };
		if (index === 2) return { bg: 'bg-amber-700/20 text-amber-500 border-amber-600/40', icon: '🥉', rankText: '3' };
		return { bg: 'bg-white/5 text-[#8e8e93] border-white/5', icon: null, rankText: (index + 1).toLocaleString('en-US') };
	};

	return (
		<div 
			class="flex-1 overflow-y-auto no-scrollbar animate-fade-in relative bg-[#090a0f] pb-24" 
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Dynamic Ambient Background Glow */}
			<div 
				class="absolute top-0 left-0 right-0 h-[450px] pointer-events-none transition-all duration-700 z-0 opacity-40"
				style={{
					background: `radial-gradient(circle at 50% 20%, ${currentLeague().color} 0%, transparent 65%)`
				}}
			/>

			<div class="relative z-10 flex flex-col pt-3">
				{/* Top Global Miners Pill */}
				<div class="flex justify-center px-4 mb-4">
					<div class="bg-white/5 backdrop-blur-xl rounded-full px-4 py-2 flex items-center justify-between w-full max-w-[340px] border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
						<div class="flex items-center gap-2">
							<span class="text-base animate-pulse">🪙</span>
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

				{/* League Emblem Presentation */}
				<div class="flex justify-center my-4">
					<div class="relative flex items-center justify-center">
						<div 
							class="absolute inset-0 rounded-full blur-3xl opacity-60 animate-pulse" 
							style={{ background: currentLeague().color }}
						/>
						<div class="relative z-10 w-28 h-28 flex items-center justify-center drop-shadow-[0_10px_25px_rgba(0,0,0,0.5)]">
							<span class="text-[90px] leading-none transform hover:scale-105 transition-transform duration-300">🏆</span>
						</div>
					</div>
				</div>

				{/* League Navigation Carousel */}
				<div class="flex items-center justify-between px-6 mt-1 mb-2">
					<button 
						onClick={handlePrevLeague} 
						disabled={selectedLeagueIndex() === 0}
						class={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center transition-all ${
							selectedLeagueIndex() === 0 ? 'opacity-30 cursor-not-allowed' : 'active:scale-95 hover:bg-white/10 opacity-90'
						}`}
					>
						<span class="material-symbols-outlined text-white text-xl">chevron_left</span>
					</button>

					<div class="flex flex-col items-center">
						<h2 
							class="text-white font-black text-2xl tracking-wide uppercase text-center" 
							style={{ textShadow: `0 0 20px ${currentLeague().color}80` }}
						>
							{currentLeague().name} {t('airdropFinal.leaderboard.league', { defaultValue: 'LEAGUE' })}
						</h2>
					</div>

					<button 
						onClick={handleNextLeague}
						disabled={selectedLeagueIndex() === LEAGUES.length - 1}
						class={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center transition-all ${
							selectedLeagueIndex() === LEAGUES.length - 1 ? 'opacity-30 cursor-not-allowed' : 'active:scale-95 hover:bg-white/10 opacity-90'
						}`}
					>
						<span class="material-symbols-outlined text-white text-xl">chevron_right</span>
					</button>
				</div>

				{/* Animated XP Progress Bar */}
				<div class="flex flex-col items-center px-8 mb-6">
					<div class="flex items-center justify-between w-full max-w-[240px] text-xs font-mono text-white/70 mb-1.5" dir="ltr">
						<span>
							{(statsQuery.data?.xp || 0).toLocaleString('en-US')}
						</span>
						<span class="text-white/40">/</span>
						<span>
							{formatScore(LEAGUES[Math.min(LEAGUES.length - 1, selectedLeagueIndex() + 1)].minScore)}
						</span>
					</div>
					<div class="w-full max-w-[240px] h-2.5 bg-white/10 rounded-full p-0.5 backdrop-blur-sm border border-white/5">
						<div 
							class="h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden"
							style={{ 
								width: `${progressPercent()}%`, 
								background: `linear-gradient(90deg, ${currentLeague().color}, #ffffff)`,
								boxShadow: `0 0 12px ${currentLeague().color}`
							}}
						>
							<div class="absolute inset-0 bg-white/20 animate-pulse" />
						</div>
					</div>
				</div>

				{/* Primary Segmented Tabs (Miners / Squads) */}
				<div class="px-4 mb-3">
					<div class="w-full bg-[#14151f] rounded-2xl p-1.5 flex border border-white/5 shadow-inner">
						<button 
							onClick={() => setActiveTab('miners')}
							class={`flex-1 py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-300 ${
								activeTab() === 'miners' 
									? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 border border-blue-400/30' 
									: 'text-white/60 hover:text-white'
							}`}
						>
							{t('airdropFinal.leaderboard.miners', { defaultValue: 'MINERS' })}
						</button>
						<button 
							onClick={() => setActiveTab('squads')}
							class={`flex-1 py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-300 ${
								activeTab() === 'squads' 
									? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 border border-blue-400/30' 
									: 'text-white/60 hover:text-white'
							}`}
						>
							{t('airdropFinal.leaderboard.squads', { defaultValue: 'SQUADS' })}
						</button>
					</div>
				</div>

				{/* Main Content Area */}
				<div class="bg-[#0f1017] rounded-t-[32px] pt-4 px-4 min-h-[420px] border-t border-white/10 shadow-[0_-10px_35px_rgba(0,0,0,0.6)] flex flex-col">
					
					{/* Sub-tabs Toggle (Day / Week) */}
					<div class="flex items-center justify-center mb-4">
						<div class="bg-[#181924] rounded-full p-1 border border-white/5 flex gap-1 w-full max-w-[260px]">
							<button 
								onClick={() => setActiveSubTab('day')}
								class={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
									activeSubTab() === 'day' 
										? 'bg-white/15 text-white shadow-sm border border-white/10' 
										: 'text-white/40 hover:text-white/70'
								}`}
							>
								{(t('airdropFinal.leaderboard.day' as any) as string) || 'Daily'}
							</button>
							<button 
								onClick={() => setActiveSubTab('week')}
								class={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
									activeSubTab() === 'week' 
										? 'bg-white/15 text-white shadow-sm border border-white/10' 
										: 'text-white/40 hover:text-white/70'
								}`}
							>
								{(t('airdropFinal.leaderboard.week' as any) as string) || 'Weekly'}
							</button>
						</div>
					</div>

					{/* Leaderboard Lists */}
					<div class="flex-1 w-full space-y-2">
						<Show when={activeTab() === 'miners'}>
							<Show
								when={!leaderboardQuery.isLoading}
								fallback={
									<div class="flex flex-col items-center justify-center py-16 gap-3">
										<div class="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
										<span class="text-xs text-white/40 font-medium">Loading Miners...</span>
									</div>
								}
							>
								<For each={filteredMiners()} fallback={
									<div class="text-white/40 text-xs text-center py-12 bg-white/5 rounded-2xl border border-white/5">
										{t('airdropFinal.leaderboard.noMiners', { defaultValue: 'No miners found in this league.' })}
									</div>
								}>
									{(entry, i) => {
										const badge = () => getRankBadge(i());
										return (
											<div 
												class={`flex items-center justify-between p-3 rounded-2xl border transition-all duration-200 ${
													i() < 3 
														? 'bg-gradient-to-r from-white/10 via-white/5 to-transparent border-white/15 shadow-md' 
														: 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06]'
												}`}
											>
												<div class="flex items-center gap-3">
													{/* Rank Badge */}
													<div class={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs border ${badge().bg}`}>
														{badge().icon || badge().rankText}
													</div>

													{/* Avatar Frame */}
													<div class="relative">
														<div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-white font-bold border border-white/10 shadow-sm">
															{entry.name.slice(0, 2).toUpperCase()}
														</div>
													</div>

													{/* User Info */}
													<div class="flex flex-col">
														<span class="text-white font-semibold text-sm truncate max-w-[140px]">
															{entry.name}
														</span>
														<span class="text-white/40 text-[10px]">
															{currentLeague().name} Miner
														</span>
													</div>
												</div>

												{/* Score Badge */}
												<div class="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
													<span class="text-xs">🪙</span>
													<span class="text-white font-black text-xs font-mono" dir="ltr">
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
										<div class="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
										<span class="text-xs text-white/40 font-medium">Loading Squads...</span>
									</div>
								}
							>
								<For each={filteredSquads()} fallback={
									<div class="text-white/40 text-xs text-center py-12 bg-white/5 rounded-2xl border border-white/5">
										{t('airdropFinal.leaderboard.noSquads', { defaultValue: 'No squads found in this league.' })}
									</div>
								}>
									{(clan, i) => {
										const score = clan.total_score || clan.members_count * 1500;
										const badge = () => getRankBadge(i());
										return (
											<div 
												class={`flex items-center justify-between p-3 rounded-2xl border transition-all duration-200 ${
													i() < 3 
														? 'bg-gradient-to-r from-white/10 via-white/5 to-transparent border-white/15 shadow-md' 
														: 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06]'
												}`}
											>
												<div class="flex items-center gap-3">
													{/* Rank Badge */}
													<div class={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs border ${badge().bg}`}>
														{badge().icon || badge().rankText}
													</div>

													{/* Clan Photo / Icon */}
													<div class="w-10 h-10 rounded-xl bg-[#1c1d2b] overflow-hidden flex items-center justify-center border border-white/10 shadow-sm p-0.5">
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
														<span class="text-white font-semibold text-sm truncate max-w-[130px]">
															{clan.chat_title}
														</span>
														<span class="text-white/40 text-[10px]" dir="ltr">
															{clan.members_count.toLocaleString('en-US')} {t('airdropFinal.leaderboard.players', { defaultValue: 'players' })}
														</span>
													</div>
												</div>

												{/* Score Badge */}
												<div class="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
													<span class="text-xs">🪙</span>
													<span class="text-white font-black text-xs font-mono" dir="ltr">
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

			{/* Sticky My Rank Dock at Bottom */}
			<div class="fixed bottom-0 left-0 right-0 p-3 bg-[#0a0b12]/90 backdrop-blur-xl border-t border-white/10 z-30 shadow-[0_-8px_30px_rgba(0,0,0,0.8)]">
				<div class="flex items-center justify-between max-w-md mx-auto px-1">
					<div class="flex items-center gap-3">
						<div class="w-9 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-md border border-blue-400/30">
							#{(statsQuery.data?.globalRank || 999).toLocaleString('en-US')}
						</div>
						<div class="flex flex-col">
							<span class="text-white font-bold text-xs">
								Your Rank Position
							</span>
							<span class="text-white/50 text-[10px]">
								Keep tapping to level up!
							</span>
						</div>
					</div>

					<div class="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
						<span class="text-xs">⚡</span>
						<span class="text-white font-black text-xs font-mono" dir="ltr">
							{(statsQuery.data?.xp || 0).toLocaleString('en-US')}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
};

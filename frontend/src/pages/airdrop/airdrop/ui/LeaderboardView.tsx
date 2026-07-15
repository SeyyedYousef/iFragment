import { createQuery } from '@tanstack/solid-query';
import { Component, createSignal, For, Show } from 'solid-js';
import { fetchLeaderboard } from '@/shared/api/airdrop.js';
import { getTopClans, getProfileStats } from '@/shared/api/profile.js';
import { LEAGUES, CLAN_LEAGUES } from '@/shared/store/airdrop.js';
import { t } from '@/shared/i18n/index.js';
import { API_CONFIG } from '@/shared/api/config.js';

export const LeaderboardView: Component = () => {
	// Defaults to Bronze (index 0) or whatever league we want
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

	const getLeagueColor = (name: string) => LEAGUES.find((l) => l.name === name)?.color || '#8e8e93';

	const currentLeague = () => LEAGUES[selectedLeagueIndex()] || LEAGUES[0];

	const handlePrevLeague = () => {
		setSelectedLeagueIndex(prev => Math.max(0, prev - 1));
	};
	const handleNextLeague = () => {
		setSelectedLeagueIndex(prev => Math.min(LEAGUES.length - 1, prev + 1));
	};

	const filteredMiners = () => {
		const data = leaderboardQuery.data || [];
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

	return (
		<div 
			class="flex-1 overflow-y-auto no-scrollbar animate-fade-in relative" 
			style={{ background: '#000' }}
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Top ambient glow based on league color */}
			<div 
				class="absolute top-0 left-0 right-0 h-[400px] pointer-events-none transition-colors duration-500 z-0"
				style={{
					background: `radial-gradient(ellipse at top, ${currentLeague().color}40 0%, transparent 70%)`
				}}
			/>

			<div class="relative z-10 flex flex-col pt-4">
				{/* Top Stats Capsule */}
				<div class="flex justify-center px-4 mb-2">
					<div class="bg-white/10 backdrop-blur-md rounded-full px-4 py-2 flex items-center justify-between w-full max-w-[320px] shadow-sm border border-white/5">
						<div class="flex items-center gap-1.5">
							<span class="text-[14px]">🪙</span>
							<span class="text-white font-bold text-[13px]">
								{t('airdropFinal.leaderboard.totalMiners', { defaultValue: '20,043,793 Miners' })}
							</span>
						</div>
						<div class="flex items-center gap-0.5 text-white/70">
							<span class="text-[13px] font-medium">{t('airdropFinal.leaderboard.stats', { defaultValue: 'Stats' })}</span>
							<span class="material-symbols-outlined text-[16px]">chevron_right</span>
						</div>
					</div>
				</div>

				{/* Big Trophy */}
				<div class="flex justify-center mt-6 mb-4">
					<div class="relative">
						<div class="absolute inset-0 blur-2xl opacity-50" style={{ background: currentLeague().color }}></div>
						<span class="text-[120px] leading-none drop-shadow-2xl relative z-10">🏆</span>
					</div>
				</div>

				{/* League Slider */}
				<div class="flex items-center justify-center gap-6 mt-2 mb-1 px-4">
					<button 
						onClick={handlePrevLeague} 
						disabled={selectedLeagueIndex() === 0}
						class={`p-2 transition-all ${selectedLeagueIndex() === 0 ? 'opacity-30' : 'active:scale-90 opacity-80 hover:opacity-100'}`}
					>
						<span class="material-symbols-outlined text-white text-[24px]">chevron_left</span>
					</button>

					<h2 class="text-white font-bold text-[28px] tracking-tight min-w-[160px] text-center" style={{ textShadow: `0 2px 10px ${currentLeague().color}40` }}>
						{currentLeague().name} {t('airdropFinal.leaderboard.league', { defaultValue: 'league' })}
					</h2>

					<button 
						onClick={handleNextLeague}
						disabled={selectedLeagueIndex() === LEAGUES.length - 1}
						class={`p-2 transition-all ${selectedLeagueIndex() === LEAGUES.length - 1 ? 'opacity-30' : 'active:scale-90 opacity-80 hover:opacity-100'}`}
					>
						<span class="material-symbols-outlined text-white text-[24px]">chevron_right</span>
					</button>
				</div>

				{/* Progress Text & Bar */}
				<div class="flex flex-col items-center px-8 mb-6">
					<span class="text-white/60 text-[13px] font-medium mb-2 font-mono">
						{(() => {
							const currentScore = statsQuery.data?.xp || 0;
							const maxScore = LEAGUES[Math.min(LEAGUES.length - 1, selectedLeagueIndex() + 1)].minScore;
							return `${currentScore.toLocaleString()} / ${formatScore(maxScore)}`;
						})()}
					</span>
					<div class="w-full max-w-[200px] h-2 bg-white/10 rounded-full overflow-hidden">
						<div 
							class="h-full rounded-full transition-all duration-500"
							style={{ 
								width: '35%', // Mock progress
								background: currentLeague().color,
								boxShadow: `0 0 10px ${currentLeague().color}`
							}}
						/>
					</div>
				</div>

				{/* Main Tabs (Miners / Squads) */}
				<div class="px-4 mb-4">
					<div class="w-full bg-[#1c1c1e] rounded-[18px] p-1 flex">
						<button 
							onClick={() => setActiveTab('miners')}
							class={`flex-1 py-2.5 rounded-[14px] text-[15px] font-bold transition-all ${activeTab() === 'miners' ? 'bg-white text-black shadow-sm' : 'text-[#8e8e93]'}`}
						>
							{t('airdropFinal.leaderboard.miners', { defaultValue: 'Miners' })}
						</button>
						<button 
							onClick={() => setActiveTab('squads')}
							class={`flex-1 py-2.5 rounded-[14px] text-[15px] font-bold transition-all ${activeTab() === 'squads' ? 'bg-white text-black shadow-sm' : 'text-[#8e8e93]'}`}
						>
							{t('airdropFinal.leaderboard.squads', { defaultValue: 'Squads' })}
						</button>
					</div>
				</div>

				{/* Sub Tabs and List Background */}
				<div class="bg-[#141415] rounded-t-[32px] pt-5 px-4 min-h-[400px] pb-20 border-t border-white/5 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] flex flex-col">
					
					{/* Sub Tabs (Day / Week) */}
					<div class="flex gap-6 border-b border-white/10 pb-3 mb-2 px-2">
						<button 
							onClick={() => setActiveSubTab('day')}
							class={`text-[15px] font-bold transition-all relative ${activeSubTab() === 'day' ? 'text-white' : 'text-[#8e8e93]'}`}
						>
							{t('airdropFinal.leaderboard.day', { defaultValue: 'Day' })}
							{activeSubTab() === 'day' && (
								<div class="absolute -bottom-3.5 left-0 right-0 h-1 bg-white rounded-full"></div>
							)}
						</button>
						<button 
							onClick={() => setActiveSubTab('week')}
							class={`text-[15px] font-bold transition-all relative ${activeSubTab() === 'week' ? 'text-white' : 'text-[#8e8e93]'}`}
						>
							{t('airdropFinal.leaderboard.week', { defaultValue: 'Week' })}
							{activeSubTab() === 'week' && (
								<div class="absolute -bottom-3.5 left-0 right-0 h-1 bg-white rounded-full"></div>
							)}
						</button>
					</div>

					{/* List View */}
					<div class="flex-1 w-full pt-2">
						<Show when={activeTab() === 'miners'}>
							{/* MINERS LIST */}
							<Show
								when={!leaderboardQuery.isLoading}
								fallback={
									<div class="flex items-center justify-center py-16">
										<div class="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
									</div>
								}
							>
								<For each={filteredMiners()} fallback={
									<div class="text-[#8e8e93] text-[14px] text-center py-8">{t('airdropFinal.leaderboard.noMiners', { defaultValue: 'No miners found in this league.' })}</div>
								}>
									{(entry, i) => (
										<div class="flex items-center justify-between py-3.5 active:bg-white/5 rounded-xl px-2 transition-colors">
											<div class="flex items-center gap-3">
												<div class="w-6 text-left font-bold text-[#8e8e93] text-[14px]">
													{i() + 1}
												</div>
												{/* Avatar placeholder / initials */}
												<div class="w-10 h-10 rounded-full bg-[#1c1c1e] flex items-center justify-center text-white font-bold border border-white/5">
													{entry.name.slice(0, 2).toUpperCase()}
												</div>

												{/* Name & Rank */}
												<div class="flex flex-col">
													<div class="text-white font-medium text-[16px] truncate max-w-[150px]">{entry.name}</div>
												</div>
											</div>

											{/* Score */}
											<div class="flex items-center gap-4">
												<div class="text-white font-bold text-[15px]">{formatScore(entry.score)}</div>
											</div>
										</div>
									)}
								</For>
							</Show>
						</Show>

						<Show when={activeTab() === 'squads'}>
							{/* SQUADS LIST */}
							<Show
								when={!clansQuery.isLoading}
								fallback={
									<div class="flex items-center justify-center py-16">
										<div class="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
									</div>
								}
							>
								<For each={filteredSquads()} fallback={
									<div class="text-[#8e8e93] text-[14px] text-center py-8">{t('airdropFinal.leaderboard.noSquads', { defaultValue: 'No squads found in this league.' })}</div>
								}>
									{(clan, i) => {
										const score = clan.total_score || clan.members_count * 1500;
										return (
											<div class="flex items-center justify-between py-3.5 active:bg-white/5 rounded-xl px-2 transition-colors">
												<div class="flex items-center gap-3">
													<div class="w-6 text-left font-bold text-[#8e8e93] text-[14px]">
														{i() + 1}
													</div>
													{/* Photo */}
													<div class="w-10 h-10 rounded-xl bg-[#1c1c1e] overflow-hidden flex items-center justify-center border border-white/5 p-0.5">
														{clan.channel_photo ? (
															<img
																src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan.channel_username}`}
																alt={clan.chat_title}
																class="w-full h-full rounded-[10px] object-cover"
															/>
														) : (
															<span class="text-lg">🛡️</span>
														)}
													</div>

													{/* Name */}
													<div class="flex flex-col">
														<div class="text-white font-medium text-[16px] truncate max-w-[140px]">{clan.chat_title}</div>
														<div class="text-[#8e8e93] text-[13px] mt-0.5">{clan.members_count} {t('airdropFinal.leaderboard.players', { defaultValue: 'players' })}</div>
													</div>
												</div>

												{/* Score */}
												<div class="flex items-center gap-4">
													<div class="text-white font-bold text-[15px]">{formatScore(score)}</div>
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

import { createQuery } from '@tanstack/solid-query';
import { Component, createSignal, For, Show } from 'solid-js';
import { fetchLeaderboard } from '@/shared/api/airdrop.js';
import { getProfileStats } from '@/shared/api/profile.js';
import { LEAGUES } from '@/shared/store/airdrop.js';
import { t } from '@/shared/i18n/index.js';

export const LeaderboardView: Component = () => {
	const [selectedLeague, setSelectedLeague] = createSignal<string | null>(null);

	const leaderboardQuery = createQuery(() => ({
		queryKey: ['leaderboard'],
		queryFn: fetchLeaderboard,
		staleTime: 30_000,
		refetchOnWindowFocus: false,
	}));

	const statsQuery = createQuery(() => ({
		queryKey: ['profile-stats'],
		queryFn: getProfileStats,
		staleTime: 30_000,
		refetchOnWindowFocus: false,
	}));

	const userPosition = () => statsQuery.data?.globalRank ?? '?';
	const userScore = () => statsQuery.data?.xp ?? 0;
	const getLeagueColor = (name: string) => LEAGUES.find((l) => l.name === name)?.color || '#8e8e93';

	const filteredLeaderboard = () => {
		const data = leaderboardQuery.data || [];
		const league = selectedLeague();
		if (!league) return data;
		return data.filter((e) => e.league === league);
	};

	return (
		<div 
			class="flex-1 overflow-y-auto no-scrollbar animate-fade-in pb-8" 
			style={{ background: '#000' }}
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* League Filter Pills */}
			<div class="px-4 pt-4 pb-3 overflow-x-auto no-scrollbar">
				<div class="flex gap-2 min-w-max">
					<button
						onClick={() => setSelectedLeague(null)}
						class={`px-4 py-2 rounded-full text-[13px] font-semibold transition-all shrink-0 ${
							selectedLeague() === null
								? 'bg-white text-black'
								: 'bg-[#1c1c1e] text-[#8e8e93] active:bg-white/10'
						}`}
					>
						{t('airdropNew.leaderboard.all')}
					</button>
					<For each={LEAGUES}>
						{(league) => (
							<button
								onClick={() => setSelectedLeague(league.name === selectedLeague() ? null : league.name)}
								class={`px-4 py-2 rounded-full text-[13px] font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
									selectedLeague() === league.name
										? 'text-black'
										: 'bg-[#1c1c1e] text-[#8e8e93] active:bg-white/10'
								}`}
								style={selectedLeague() === league.name ? { background: league.color } : {}}
							>
								<span
									class="material-symbols-outlined text-[16px]"
									style={{
										'font-variation-settings': '"FILL" 1',
										color: selectedLeague() === league.name ? 'inherit' : league.color,
									}}
								>
									{league.icon}
								</span>
								{league.name}
							</button>
						)}
					</For>
				</div>
			</div>

			{/* Your Position (Sticky) */}
			<Show when={!statsQuery.isLoading && !selectedLeague()}>
				<div class="mx-4 mb-3 bg-[#3390ec]/10 border border-[#3390ec]/20 rounded-2xl p-4 flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 rounded-full bg-[#3390ec]/20 flex items-center justify-center text-[#3390ec] font-bold text-[14px]">
							#{typeof userPosition() === 'number' ? userPosition().toLocaleString('en-US') : '?'}
						</div>
						<div>
							<div class="text-[#3390ec] text-[12px] font-semibold uppercase">{t('airdropNew.leaderboard.yourPosition')}</div>
							<div class="text-white font-bold text-[16px] tabular-nums">{userScore().toLocaleString('en-US')} XP</div>
						</div>
					</div>
				</div>
			</Show>

			{/* Leaderboard List */}
			<div class="mx-4">
				<div class="bg-[#1c1c1e] rounded-[24px] overflow-hidden min-h-[200px]">
					<Show
						when={!leaderboardQuery.isLoading}
						fallback={
							<div class="flex items-center justify-center py-16">
								<div class="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
							</div>
						}
					>
						<Show
							when={filteredLeaderboard().length > 0}
							fallback={
								<div class="flex flex-col items-center justify-center py-16 text-[#8e8e93]">
									<span class="material-symbols-outlined text-4xl mb-2 opacity-40">sentiment_dissatisfied</span>
									<span class="text-[14px]">{t('airdropNew.leaderboard.empty')}</span>
								</div>
							}
						>
							<For each={filteredLeaderboard()}>
								{(entry, i) => (
									<div
										class={`flex items-center justify-between px-4 py-3.5 ${
											i() < filteredLeaderboard().length - 1 ? 'border-b border-white/5' : ''
										}`}
									>
										<div class="flex items-center gap-3">
											{/* Rank */}
											<div
												class={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] shrink-0 ${
													entry.rank === 1
														? 'bg-amber-400 text-black'
														: entry.rank === 2
															? 'bg-gray-300 text-black'
															: entry.rank === 3
																? 'bg-[#cd7f32] text-white'
																: 'bg-[#2c2c2e] text-[#8e8e93]'
												}`}
											>
												{entry.rank <= 3 ? (
													<span class="material-symbols-outlined text-[16px]" style={{ 'font-variation-settings': '"FILL" 1' }}>
														emoji_events
													</span>
												) : (
													entry.rank
												)}
											</div>

											{/* Name & League */}
											<div>
												<div class="text-white font-medium text-[15px]">{entry.name}</div>
												<div class="text-[#8e8e93] text-[13px] mt-0.5">{entry.level} {t('boosters.lvl')}</div>
												<div class="flex items-center gap-1.5 mt-0.5">
													<span
														class="material-symbols-outlined text-[12px]"
														style={{ color: getLeagueColor(entry.league), 'font-variation-settings': '"FILL" 1' }}
													>
														{LEAGUES.find((l) => l.name === entry.league)?.icon || 'star'}
													</span>
													<span class="text-[12px] font-medium" style={{ color: getLeagueColor(entry.league) }}>
														{entry.league}
													</span>
												</div>
											</div>
										</div>

										{/* Score */}
										<div class="flex items-center gap-1.5 shrink-0">
											<span
												class="material-symbols-outlined text-amber-400 text-[14px]"
												style={{ 'font-variation-settings': '"FILL" 1' }}
											>
												monetization_on
											</span>
											<span class="text-amber-400 font-bold text-[14px] tabular-nums">
												{entry.score.toLocaleString('en-US')}
											</span>
										</div>
									</div>
								)}
							</For>
						</Show>
					</Show>
				</div>
			</div>
		</div>
	);
};

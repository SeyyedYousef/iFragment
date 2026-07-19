import { createQuery } from '@tanstack/solid-query';
import { Component, createSignal, For, Show } from 'solid-js';
import { fetchLeaderboard } from '@/shared/api/airdrop.js';
import { API_CONFIG } from '@/shared/api/config.js';
import { getProfileStats, getTopClans } from '@/shared/api/profile.js';
import { t } from '@/shared/i18n/index.js';
import { LEAGUES } from '@/shared/store/airdrop.js';

export const LeaderboardView: Component<{ initialTab?: 'miners' | 'squads' }> = (props) => {
	const [selectedLeagueIndex, setSelectedLeagueIndex] = createSignal(0);
	const [activeTab, setActiveTab] = createSignal<'miners' | 'squads'>(props.initialTab || 'miners');
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
		setSelectedLeagueIndex((prev) => Math.max(0, prev - 1));
	};
	const handleNextLeague = () => {
		setSelectedLeagueIndex((prev) => Math.min(LEAGUES.length - 1, prev + 1));
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
		return data.filter((c) => {
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
		if (index === 0)
			return {
				bg: 'bg-amber-400/15 text-amber-400 border-amber-400/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
				rankText: '01',
			};
		if (index === 1)
			return { bg: 'bg-slate-300/15 text-slate-100 border-slate-300/30', rankText: '02' };
		if (index === 2)
			return { bg: 'bg-amber-700/15 text-amber-500 border-amber-600/30', rankText: '03' };
		return {
			bg: 'bg-white/5 text-white/40 border-white/10',
			rankText: index + 1 < 10 ? `0${index + 1}` : `${index + 1}`,
		};
	};

	return (
		<div
			class="h-full w-full overflow-y-auto no-scrollbar relative pb-32 bg-[#08090d] text-white selection:bg-[#0098ea]/30"
			style={{ background: 'radial-gradient(ellipse at 50% 0%, #0c1220 0%, #08090d 100%)' }}
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Ambient top glow */}
			<div
				class="absolute top-0 left-0 right-0 h-[280px] pointer-events-none transition-all duration-700 z-0"
				style={{
					background: `radial-gradient(ellipse at 50% 0%, ${currentLeague().color}18 0%, transparent 65%)`,
				}}
			/>

			<div class="relative z-10 flex flex-col gap-4 pt-4 max-w-md mx-auto">
				{/* ═══════ Fragment Header Banner ═══════ */}
				<div class="mx-4 rounded-2xl border border-white/[0.08] bg-[#10141e]/90 p-5 flex flex-col items-center relative overflow-hidden backdrop-blur-md shadow-2xl">
					{/* League Icon */}
					<div
						class="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 relative z-10 border shadow-inner transition-all duration-300"
						style={{
							background: `linear-gradient(135deg, ${currentLeague().color}20, rgba(255,255,255,0.02))`,
							'border-color': `${currentLeague().color}40`,
							'box-shadow': `0 0 20px ${currentLeague().color}20`,
						}}
					>
						<span
							class="material-symbols-outlined text-[32px]"
							style={{
								color: currentLeague().color,
								'font-variation-settings': '"FILL" 1',
							}}
						>
							{currentLeague().icon}
						</span>
					</div>

					{/* League Switcher Header */}
					<div class="flex items-center justify-between w-full z-10 mb-3 px-1">
						<button
							onClick={handlePrevLeague}
							disabled={selectedLeagueIndex() === 0}
							class={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
								selectedLeagueIndex() === 0
									? 'opacity-20 cursor-not-allowed border border-transparent'
									: 'bg-[#161b28] border border-white/10 active:scale-95 text-white/80 hover:bg-[#1a2130]'
							}`}
						>
							<span class="material-symbols-outlined text-base">chevron_left</span>
						</button>

						<h2 class="text-white font-mono font-black text-sm uppercase tracking-widest text-center">
							{currentLeague().name} LEAGUE
						</h2>

						<button
							onClick={handleNextLeague}
							disabled={selectedLeagueIndex() === LEAGUES.length - 1}
							class={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
								selectedLeagueIndex() === LEAGUES.length - 1
									? 'opacity-20 cursor-not-allowed border border-transparent'
									: 'bg-[#161b28] border border-white/10 active:scale-95 text-white/80 hover:bg-[#1a2130]'
							}`}
						>
							<span class="material-symbols-outlined text-base">chevron_right</span>
						</button>
					</div>

					{/* Score Progress Bar */}
					<div class="w-full max-w-[260px] z-10">
						<div
							class="flex items-center justify-between text-[11px] font-mono mb-1.5 text-white/50"
							dir="ltr"
						>
							<span>{(statsQuery.data?.xp || 0).toLocaleString('en-US')} XP</span>
							<span>
								{formatScore(
									LEAGUES[Math.min(LEAGUES.length - 1, selectedLeagueIndex() + 1)].minScore,
								)}
							</span>
						</div>
						<div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden p-[1px]">
							<div
								class="h-full rounded-full transition-all duration-500 ease-out"
								style={{
									width: `${Math.max(4, progressPercent())}%`,
									background: currentLeague().color,
									'box-shadow': `0 0 10px ${currentLeague().color}`,
								}}
							/>
						</div>
					</div>

					{/* Total Miners Badge */}
					<div class="mt-4 flex items-center z-10">
						<div
							class="flex items-center gap-1.5 text-white/60 text-[11px] font-mono font-bold bg-[#161b28] rounded-full px-3.5 py-1 border border-white/10"
							dir="ltr"
						>
							<span>🪙</span>
							<span>{formatScore(leaderboardQuery.data?.total_miners || 20043793)} Miners</span>
						</div>
					</div>
				</div>

				{/* ═══════ Main Tabs (MINERS / CLANS) ═══════ */}
				<div class="mx-4 bg-[#10141e] rounded-2xl p-1 flex gap-1 border border-white/[0.08]">
					<button
						onClick={() => setActiveTab('miners')}
						class={`flex-1 py-2.5 rounded-xl text-xs font-mono font-black uppercase tracking-wider transition-all ${
							activeTab() === 'miners'
								? 'bg-[#0098ea] text-white shadow-[0_4px_14px_rgba(0,152,234,0.3)]'
								: 'text-white/40 hover:text-white/70'
						}`}
					>
						{t('airdropFinal.leaderboard.miners', { defaultValue: 'MINERS' })}
					</button>
					<button
						onClick={() => setActiveTab('squads')}
						class={`flex-1 py-2.5 rounded-xl text-xs font-mono font-black uppercase tracking-wider transition-all ${
							activeTab() === 'squads'
								? 'bg-[#0098ea] text-white shadow-[0_4px_14px_rgba(0,152,234,0.3)]'
								: 'text-white/40 hover:text-white/70'
						}`}
					>
						{t('airdropFinal.leaderboard.squads', { defaultValue: 'CLANS' })}
					</button>
				</div>

				{/* ═══════ Sub Tabs (Daily / Weekly) ═══════ */}
				<div class="flex justify-center">
					<div class="bg-[#121622] rounded-lg p-0.5 flex gap-0.5 border border-white/10">
						<button
							onClick={() => setActiveSubTab('day')}
							class={`px-4 py-1 rounded-md text-[11px] font-mono font-bold transition-all ${
								activeSubTab() === 'day'
									? 'bg-white/15 text-white'
									: 'text-white/40 hover:text-white/70'
							}`}
						>
							Daily
						</button>
						<button
							onClick={() => setActiveSubTab('week')}
							class={`px-4 py-1 rounded-md text-[11px] font-mono font-bold transition-all ${
								activeSubTab() === 'week'
									? 'bg-white/15 text-white'
									: 'text-white/40 hover:text-white/70'
							}`}
						>
							Weekly
						</button>
					</div>
				</div>

				{/* ═══════ Leaderboard Entries ═══════ */}
				<div class="mx-4 flex flex-col gap-2 min-h-[260px]">
					{/* Miners Tab */}
					<Show when={activeTab() === 'miners'}>
						<Show
							when={!leaderboardQuery.isLoading}
							fallback={
								<div class="flex flex-col items-center justify-center py-14 gap-2">
									<div class="w-6 h-6 border-2 border-white/10 border-t-[#0098ea] rounded-full animate-spin" />
									<span class="text-[11px] font-mono text-white/30">Loading Miners...</span>
								</div>
							}
						>
							<For
								each={filteredMiners()}
								fallback={
									<div class="flex flex-col items-center justify-center py-14 gap-2 text-white/30 text-xs font-medium">
										<span>No miners found in this league.</span>
									</div>
								}
							>
								{(entry, i) => {
									const badge = () => getRankBadge(i());
									return (
										<div class="flex items-center justify-between p-3 rounded-2xl border border-white/[0.07] bg-[#10141e] hover:bg-[#151a28] transition-all">
											<div class="flex items-center gap-3 min-w-0 pr-2">
												{/* Rank Badge */}
												<div
													class={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs border shrink-0 ${badge().bg}`}
												>
													{badge().rankText}
												</div>

												{/* Avatar */}
												<div class="w-9 h-9 rounded-full bg-[#161b28] border border-white/10 flex items-center justify-center text-white font-bold text-xs shrink-0">
													{entry.name.slice(0, 2).toUpperCase()}
												</div>

												{/* Name & Clan */}
												<div class="flex flex-col min-w-0">
													<span class="text-white font-semibold text-sm truncate tracking-tight">
														{entry.name}
													</span>
													<Show when={entry.clanName}>
														<span
															class="text-[#0098ea] text-[11px] font-mono font-bold truncate flex items-center gap-1"
															dir="ltr"
														>
															<span class="material-symbols-outlined text-[12px]">shield</span>@
															{entry.clanName}
														</span>
													</Show>
												</div>
											</div>

											{/* Score */}
											<div
												class="flex items-center gap-1 shrink-0 pl-2 font-mono font-bold text-xs text-white/90 tabular-nums"
												dir="ltr"
											>
												<span>🪙</span>
												<span>{formatScore(entry.score)}</span>
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
								<div class="flex flex-col items-center justify-center py-14 gap-2">
									<div class="w-6 h-6 border-2 border-white/10 border-t-[#0098ea] rounded-full animate-spin" />
									<span class="text-[11px] font-mono text-white/30">Loading Clans...</span>
								</div>
							}
						>
							<For
								each={filteredSquads()}
								fallback={
									<div class="flex flex-col items-center justify-center py-14 gap-2 text-white/30 text-xs font-medium">
										<span>No clans found in this league.</span>
									</div>
								}
							>
								{(clan, i) => {
									const score = clan.total_score || clan.members_count * 1500;
									const badge = () => getRankBadge(i());
									return (
										<div class="flex items-center justify-between p-3 rounded-2xl border border-white/[0.07] bg-[#10141e] hover:bg-[#151a28] transition-all">
											<div class="flex items-center gap-3 min-w-0 pr-2">
												{/* Rank Badge */}
												<div
													class={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs border shrink-0 ${badge().bg}`}
												>
													{badge().rankText}
												</div>

												{/* Clan Photo */}
												<div class="w-9 h-9 rounded-xl overflow-hidden bg-[#161b28] border border-white/10 flex items-center justify-center shrink-0">
													{clan.channel_photo ? (
														<img
															src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan.channel_username}`}
															alt={clan.chat_title}
															class="w-full h-full object-cover"
														/>
													) : (
														<span class="material-symbols-outlined text-white/40 text-base">
															shield
														</span>
													)}
												</div>

												{/* Clan Info */}
												<div class="flex flex-col min-w-0">
													<span class="text-white font-semibold text-sm truncate tracking-tight">
														{clan.chat_title}
													</span>
													<span class="text-white/40 text-[11px] font-mono" dir="ltr">
														@{clan.channel_username} · {clan.members_count.toLocaleString('en-US')}{' '}
														members
													</span>
												</div>
											</div>

											{/* Score */}
											<div
												class="flex items-center gap-1 shrink-0 pl-2 font-mono font-bold text-xs text-white/90 tabular-nums"
												dir="ltr"
											>
												<span>🪙</span>
												<span>{formatScore(score)}</span>
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

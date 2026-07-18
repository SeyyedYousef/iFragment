import { createQuery } from '@tanstack/solid-query';
import { Component, createSignal, For, Show } from 'solid-js';
import { fetchLeaderboard } from '@/shared/api/airdrop.js';
import { getTopClans, getProfileStats } from '@/shared/api/profile.js';
import { LEAGUES } from '@/shared/store/airdrop.js';
import { t } from '@/shared/i18n/index.js';
import { API_CONFIG } from '@/shared/api/config.js';

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
		if (index === 0) return { bg: 'bg-amber-400/15 text-amber-300 border-amber-400/30', rankText: '01' };
		if (index === 1) return { bg: 'bg-slate-300/15 text-slate-200 border-slate-300/30', rankText: '02' };
		if (index === 2) return { bg: 'bg-amber-700/15 text-amber-500 border-amber-600/30', rankText: '03' };
		return { bg: 'bg-white/5 text-white/40 border-white/10', rankText: (index + 1 < 10 ? `0${index + 1}` : `${index + 1}`) };
	};

	const getRowStyle = (index: number) => {
		if (index === 0) return {
			background: 'linear-gradient(135deg, rgba(251,191,36,0.06), rgba(251,191,36,0.01))',
			'border-color': 'rgba(251,191,36,0.2)',
		};
		if (index === 1) return {
			background: 'linear-gradient(135deg, rgba(148,163,184,0.05), rgba(148,163,184,0.01))',
			'border-color': 'rgba(148,163,184,0.15)',
		};
		if (index === 2) return {
			background: 'linear-gradient(135deg, rgba(217,119,6,0.05), rgba(217,119,6,0.01))',
			'border-color': 'rgba(217,119,6,0.15)',
		};
		return {};
	};

	return (
		<div
			class="h-full w-full overflow-y-auto no-scrollbar relative pb-28 bg-[#090a0d] text-white"
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Ambient top glow */}
			<div
				class="absolute top-0 left-0 right-0 h-[300px] pointer-events-none transition-all duration-700 z-0"
				style={{
					background: `radial-gradient(ellipse at 50% 0%, ${currentLeague().color}20 0%, transparent 70%)`,
				}}
			/>

			<div class="relative z-10 flex flex-col gap-4 pt-3">

				{/* ═══════ Fragment Minimal Header ═══════ */}
				<div class="mx-4 rounded-[24px] border border-white/[0.08] bg-[#11131a]/90 p-5 flex flex-col items-center relative overflow-hidden backdrop-blur-md shadow-xl">
					
					{/* League Icon */}
					<div
						class="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 relative z-10 border border-white/10 shadow-inner"
						style={{
							background: `linear-gradient(145deg, ${currentLeague().color}25, rgba(255,255,255,0.02))`,
							'border-color': `${currentLeague().color}40`,
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

					{/* League Switcher */}
					<div class="flex items-center justify-between w-full z-10 mb-2">
						<button
							onClick={handlePrevLeague}
							disabled={selectedLeagueIndex() === 0}
							class={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
								selectedLeagueIndex() === 0
									? 'opacity-20 cursor-not-allowed'
									: 'bg-white/5 border border-white/10 active:scale-95 text-white/80 hover:bg-white/10'
							}`}
						>
							<span class="material-symbols-outlined text-base">chevron_left</span>
						</button>

						<h2 class="text-white font-black text-base uppercase tracking-widest text-center">
							{currentLeague().name} LEAGUE
						</h2>

						<button
							onClick={handleNextLeague}
							disabled={selectedLeagueIndex() === LEAGUES.length - 1}
							class={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
								selectedLeagueIndex() === LEAGUES.length - 1
									? 'opacity-20 cursor-not-allowed'
									: 'bg-white/5 border border-white/10 active:scale-95 text-white/80 hover:bg-white/10'
							}`}
						>
							<span class="material-symbols-outlined text-base">chevron_right</span>
						</button>
					</div>

					{/* Progress Bar */}
					<div class="w-full max-w-[260px] mt-2 z-10">
						<div class="flex items-center justify-between text-[10px] font-mono mb-1.5 text-white/50" dir="ltr">
							<span>{(statsQuery.data?.xp || 0).toLocaleString('en-US')}</span>
							<span>{formatScore(LEAGUES[Math.min(LEAGUES.length - 1, selectedLeagueIndex() + 1)].minScore)}</span>
						</div>
						<div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
							<div
								class="h-full rounded-full transition-all duration-500"
								style={{
									width: `${Math.max(3, progressPercent())}%`,
									background: currentLeague().color,
								}}
							/>
						</div>
					</div>

					{/* Stats pill */}
					<div class="mt-4 flex items-center gap-2 z-10">
						<div class="flex items-center gap-1.5 text-white/60 text-[11px] font-bold bg-white/5 rounded-full px-3.5 py-1 border border-white/10">
							<span>🪙</span>
							<span>
								{formatScore(leaderboardQuery.data?.total_miners || 20043793)} Miners
							</span>
						</div>
					</div>
				</div>

				{/* ═══════ Main Tabs (Miners / Squads) ═══════ */}
				<div class="mx-4 bg-[#11131a] rounded-2xl p-1 flex gap-1 border border-white/10">
					<button
						onClick={() => setActiveTab('miners')}
						class={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
							activeTab() === 'miners'
								? 'bg-white text-black shadow-lg font-black'
								: 'text-white/40 hover:text-white/70'
						}`}
					>
						{t('airdropFinal.leaderboard.miners', { defaultValue: 'MINERS' })}
					</button>
					<button
						onClick={() => setActiveTab('squads')}
						class={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
							activeTab() === 'squads'
								? 'bg-white text-black shadow-lg font-black'
								: 'text-white/40 hover:text-white/70'
						}`}
					>
						{t('airdropFinal.leaderboard.squads', { defaultValue: 'CLANS' })}
					</button>
				</div>

				{/* ═══════ Sub Tabs (Daily / Weekly) ═══════ */}
				<div class="flex justify-center">
					<div class="bg-[#11131a] rounded-full p-1 flex gap-1 border border-white/10">
						<button
							onClick={() => setActiveSubTab('day')}
							class={`px-4 py-1 rounded-full text-[11px] font-bold transition-all ${
								activeSubTab() === 'day'
									? 'bg-white/15 text-white'
									: 'text-white/35 hover:text-white/60'
							}`}
						>
							Daily
						</button>
						<button
							onClick={() => setActiveSubTab('week')}
							class={`px-4 py-1 rounded-full text-[11px] font-bold transition-all ${
								activeSubTab() === 'week'
									? 'bg-white/15 text-white'
									: 'text-white/35 hover:text-white/60'
							}`}
						>
							Weekly
						</button>
					</div>
				</div>

				{/* ═══════ Leaderboard List ═══════ */}
				<div class="mx-4 flex flex-col gap-2 min-h-[300px]">

					{/* Miners Tab */}
					<Show when={activeTab() === 'miners'}>
						<Show
							when={!leaderboardQuery.isLoading}
							fallback={
								<div class="flex flex-col items-center justify-center py-16 gap-3">
									<div class="w-7 h-7 border-2 border-white/15 border-t-cyan-400 rounded-full animate-spin" />
									<span class="text-[12px] text-white/30 font-medium">Loading Miners...</span>
								</div>
							}
						>
							<For each={filteredMiners()} fallback={
								<div class="flex flex-col items-center justify-center py-16 gap-2 text-white/40 text-xs">
									<span>No miners found in this league.</span>
								</div>
							}>
								{(entry, i) => {
									const badge = () => getRankBadge(i());
									return (
										<div
											class="flex items-center justify-between p-3.5 rounded-2xl border border-white/[0.07] bg-[#11131a] hover:bg-white/[0.04] transition-all"
											style={getRowStyle(i())}
										>
											<div class="flex items-center gap-3 min-w-0">
												{/* Rank Badge */}
												<div class={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-black text-xs border shrink-0 ${badge().bg}`}>
													{badge().rankText}
												</div>

												{/* Avatar */}
												<div class="w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white font-bold text-xs shrink-0">
													{entry.name.slice(0, 2).toUpperCase()}
												</div>

												{/* Name & Clan */}
												<div class="flex flex-col min-w-0">
													<span class="text-white font-bold text-[14px] truncate tracking-tight">
														{entry.name}
													</span>
													<Show when={entry.clanName}>
														<span class="text-cyan-400/90 text-[11px] font-semibold truncate flex items-center gap-1" dir="ltr">
															<span class="material-symbols-outlined text-[12px]">shield</span>
															@{entry.clanName}
														</span>
													</Show>
												</div>
											</div>

											{/* Score */}
											<div class="flex items-center gap-1.5 shrink-0 pl-2">
												<span class="text-xs">🪙</span>
												<span class="text-white font-mono font-bold text-[13px] tabular-nums" dir="ltr">
													{formatScore(entry.score)}
												</span>
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
									<div class="w-7 h-7 border-2 border-white/15 border-t-cyan-400 rounded-full animate-spin" />
									<span class="text-[12px] text-white/30 font-medium">Loading Clans...</span>
								</div>
							}
						>
							<For each={filteredSquads()} fallback={
								<div class="flex flex-col items-center justify-center py-16 gap-2 text-white/40 text-xs">
									<span>No clans found in this league.</span>
								</div>
							}>
								{(clan, i) => {
									const score = clan.total_score || clan.members_count * 1500;
									const badge = () => getRankBadge(i());
									return (
										<div
											class="flex items-center justify-between p-3.5 rounded-2xl border border-white/[0.07] bg-[#11131a] hover:bg-white/[0.04] transition-all"
											style={getRowStyle(i())}
										>
											<div class="flex items-center gap-3 min-w-0">
												{/* Rank Badge */}
												<div class={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-black text-xs border shrink-0 ${badge().bg}`}>
													{badge().rankText}
												</div>

												{/* Clan Photo */}
												<div class="w-9 h-9 rounded-xl overflow-hidden bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
													{clan.channel_photo ? (
														<img
															src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan.channel_username}`}
															alt={clan.chat_title}
															class="w-full h-full object-cover"
														/>
													) : (
														<span class="text-sm">🛡️</span>
													)}
												</div>

												{/* Clan Info */}
												<div class="flex flex-col min-w-0">
													<span class="text-white font-bold text-[14px] truncate tracking-tight">
														{clan.chat_title}
													</span>
													<span class="text-white/40 text-[11px] font-medium" dir="ltr">
														@{clan.channel_username} · {clan.members_count.toLocaleString('en-US')} members
													</span>
												</div>
											</div>

											{/* Score */}
											<div class="flex items-center gap-1.5 shrink-0 pl-2">
												<span class="text-xs">🪙</span>
												<span class="text-white font-mono font-bold text-[13px] tabular-nums" dir="ltr">
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
	);
};

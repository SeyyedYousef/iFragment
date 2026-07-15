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

	const getRowStyle = (index: number) => {
		if (index === 0) return {
			background: 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(251,191,36,0.02))',
			'border-color': 'rgba(251,191,36,0.25)',
			'box-shadow': '0 0 24px rgba(251,191,36,0.08)',
		};
		if (index === 1) return {
			background: 'linear-gradient(135deg, rgba(148,163,184,0.08), rgba(148,163,184,0.02))',
			'border-color': 'rgba(148,163,184,0.18)',
		};
		if (index === 2) return {
			background: 'linear-gradient(135deg, rgba(217,119,6,0.08), rgba(217,119,6,0.02))',
			'border-color': 'rgba(217,119,6,0.18)',
		};
		return {};
	};

	return (
		<div
			class="h-full w-full overflow-y-auto no-scrollbar relative pb-28"
			style={{ background: 'linear-gradient(180deg, #0c0c0f 0%, #09090b 100%)' }}
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Keyframes for leaderboard animations */}
			<style>{`
				@keyframes nc-fadeInUp {
					from { opacity: 0; transform: translateY(14px); }
					to { opacity: 1; transform: translateY(0); }
				}
				@keyframes nc-glowRing {
					0%, 100% { opacity: 0.4; transform: scale(1); }
					50% { opacity: 0.8; transform: scale(1.04); }
				}
				@keyframes nc-progressShimmer {
					0% { transform: translateX(-150%); }
					100% { transform: translateX(250%); }
				}
				@keyframes nc-iconFloat {
					0%, 100% { transform: translateY(0); }
					50% { transform: translateY(-4px); }
				}
			`}</style>

			{/* Ambient top glow based on league color */}
			<div
				class="absolute top-0 left-0 right-0 h-[350px] pointer-events-none transition-all duration-700 z-0"
				style={{
					background: `radial-gradient(ellipse at 50% -30%, ${currentLeague().color}30 0%, transparent 65%)`,
					opacity: '0.6',
				}}
			/>

			<div class="relative z-10 flex flex-col gap-4 pt-3">

				{/* ═══════ League Emblem Card ═══════ */}
				<div
					class="mx-4 rounded-[22px] border border-white/[0.07] p-6 flex flex-col items-center relative overflow-hidden"
					style={{
						background: 'rgba(255,255,255,0.025)',
						'box-shadow': `0 8px 40px rgba(0,0,0,0.6), 0 0 80px ${currentLeague().color}08`,
					}}
				>
					{/* Card internal glow */}
					<div
						class="absolute inset-0 pointer-events-none transition-all duration-700"
						style={{
							background: `radial-gradient(circle at 50% 20%, ${currentLeague().color}18 0%, transparent 55%)`,
							filter: 'blur(30px)',
						}}
					/>

					{/* League Icon — Material Icon inside gradient circle */}
					<div
						class="w-[92px] h-[92px] rounded-full flex items-center justify-center mb-4 relative z-10 transition-all duration-500"
						style={{
							background: `linear-gradient(145deg, ${currentLeague().color}35, ${currentLeague().color}0a)`,
							border: `2.5px solid ${currentLeague().color}45`,
							'box-shadow': `0 0 35px ${currentLeague().color}25, inset 0 0 25px ${currentLeague().color}0d`,
							animation: 'nc-iconFloat 4s ease-in-out infinite',
						}}
					>
						<span
							class="material-symbols-outlined text-[42px] transition-colors duration-500"
							style={{
								color: currentLeague().color,
								'font-variation-settings': '"FILL" 1',
								filter: `drop-shadow(0 0 10px ${currentLeague().color}70)`,
							}}
						>
							{currentLeague().icon}
						</span>
						{/* Glow ring pulse */}
						<div
							class="absolute inset-[-6px] rounded-full pointer-events-none"
							style={{
								border: `1.5px solid ${currentLeague().color}18`,
								animation: 'nc-glowRing 3s ease-in-out infinite',
							}}
						/>
					</div>

					{/* Navigation + League Name */}
					<div class="flex items-center justify-between w-full z-10 mb-1">
						<button
							onClick={handlePrevLeague}
							disabled={selectedLeagueIndex() === 0}
							class={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
								selectedLeagueIndex() === 0
									? 'opacity-20 cursor-not-allowed'
									: 'bg-white/[0.06] border border-white/[0.1] active:scale-90 hover:bg-white/[0.1]'
							}`}
						>
							<span class="material-symbols-outlined text-white/80 text-lg">chevron_left</span>
						</button>

						<h2
							class="text-white font-extrabold text-[20px] uppercase tracking-[0.06em] text-center transition-all duration-500"
							style={{ 'text-shadow': `0 0 30px ${currentLeague().color}55, 0 2px 8px rgba(0,0,0,0.5)` }}
						>
							{currentLeague().name} {t('airdropFinal.leaderboard.league', { defaultValue: 'LEAGUE' })}
						</h2>

						<button
							onClick={handleNextLeague}
							disabled={selectedLeagueIndex() === LEAGUES.length - 1}
							class={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
								selectedLeagueIndex() === LEAGUES.length - 1
									? 'opacity-20 cursor-not-allowed'
									: 'bg-white/[0.06] border border-white/[0.1] active:scale-90 hover:bg-white/[0.1]'
							}`}
						>
							<span class="material-symbols-outlined text-white/80 text-lg">chevron_right</span>
						</button>
					</div>

					{/* Progress Bar Section */}
					<div class="w-full max-w-[270px] mt-4 z-10">
						<div class="flex items-center justify-between text-[11px] font-mono mb-2" dir="ltr">
							<span class="text-white/40">{(statsQuery.data?.xp || 0).toLocaleString('en-US')}</span>
							<span class="text-white/15">/</span>
							<span class="text-white/40">{formatScore(LEAGUES[Math.min(LEAGUES.length - 1, selectedLeagueIndex() + 1)].minScore)}</span>
						</div>
						<div class="w-full h-[10px] bg-white/[0.06] rounded-full overflow-hidden relative">
							<div
								class="h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden"
								style={{
									width: `${Math.max(3, progressPercent())}%`,
									background: `linear-gradient(90deg, ${currentLeague().color}80, ${currentLeague().color})`,
									'box-shadow': `0 0 14px ${currentLeague().color}50, 0 0 5px ${currentLeague().color}30`,
								}}
							>
								{/* Shimmer effect on progress */}
								<div
									class="absolute inset-0 w-[40%] pointer-events-none"
									style={{
										background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
										animation: 'nc-progressShimmer 2.5s ease-in-out infinite',
									}}
								/>
							</div>
						</div>
						{/* Percentage label */}
						<div class="text-center mt-1.5">
							<span class="text-[10px] font-semibold text-white/25 tabular-nums">{progressPercent()}%</span>
						</div>
					</div>

					{/* Stats pill */}
					<div class="mt-2 flex items-center gap-2 z-10">
						<div class="flex items-center gap-1.5 text-white/40 text-[11px] font-medium bg-white/[0.04] rounded-full px-3.5 py-1.5 border border-white/[0.06]">
							<span class="text-[13px]">🪙</span>
							<span>
								{(() => {
									const raw = (t('airdropFinal.leaderboard.totalMiners' as any) as string) || '{count} Fragmenters';
									return raw.replace('{count}', formatScore(leaderboardQuery.data?.total_miners || 20043793));
								})()}
							</span>
						</div>
					</div>
				</div>

				{/* ═══════ Main Tabs (Miners / Squads) ═══════ */}
				<div class="mx-4 bg-white/[0.03] rounded-[14px] p-1 flex gap-1 border border-white/[0.06]">
					<button
						onClick={() => setActiveTab('miners')}
						class={`flex-1 py-2.5 rounded-[10px] text-[13px] font-bold uppercase tracking-wider transition-all duration-300 ${
							activeTab() === 'miners'
								? 'text-black'
								: 'text-white/40 hover:text-white/60'
						}`}
						style={activeTab() === 'miners' ? {
							background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
							'box-shadow': '0 4px 18px rgba(245,158,11,0.3)',
						} : {}}
					>
						{t('airdropFinal.leaderboard.miners', { defaultValue: 'MINERS' })}
					</button>
					<button
						onClick={() => setActiveTab('squads')}
						class={`flex-1 py-2.5 rounded-[10px] text-[13px] font-bold uppercase tracking-wider transition-all duration-300 ${
							activeTab() === 'squads'
								? 'text-black'
								: 'text-white/40 hover:text-white/60'
						}`}
						style={activeTab() === 'squads' ? {
							background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
							'box-shadow': '0 4px 18px rgba(245,158,11,0.3)',
						} : {}}
					>
						{t('airdropFinal.leaderboard.squads', { defaultValue: 'SQUADS' })}
					</button>
				</div>

				{/* ═══════ Sub Tabs (Daily / Weekly) ═══════ */}
				<div class="flex justify-center">
					<div class="bg-white/[0.03] rounded-full p-[3px] flex gap-0.5 border border-white/[0.05]">
						<button
							onClick={() => setActiveSubTab('day')}
							class={`px-5 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-300 ${
								activeSubTab() === 'day'
									? 'bg-white/[0.1] text-white shadow-sm'
									: 'text-white/35 hover:text-white/55'
							}`}
						>
							{(t('airdropFinal.leaderboard.day' as any) as string) || 'Daily'}
						</button>
						<button
							onClick={() => setActiveSubTab('week')}
							class={`px-5 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-300 ${
								activeSubTab() === 'week'
									? 'bg-white/[0.1] text-white shadow-sm'
									: 'text-white/35 hover:text-white/55'
							}`}
						>
							{(t('airdropFinal.leaderboard.week' as any) as string) || 'Weekly'}
						</button>
					</div>
				</div>

				{/* ═══════ Leaderboard List ═══════ */}
				<div class="mx-4 flex flex-col gap-2 min-h-[300px]">

					{/* Miners tab content */}
					<Show when={activeTab() === 'miners'}>
						<Show
							when={!leaderboardQuery.isLoading}
							fallback={
								<div class="flex flex-col items-center justify-center py-16 gap-3">
									<div class="w-8 h-8 border-2 border-white/15 border-t-amber-400 rounded-full animate-spin" />
									<span class="text-[12px] text-white/30 font-medium">Loading Miners...</span>
								</div>
							}
						>
							<For each={filteredMiners()} fallback={
								<div class="flex flex-col items-center justify-center py-16 gap-3">
									<span class="text-[28px]">🔍</span>
									<span class="text-white/30 text-[13px] font-medium">
										{t('airdropFinal.leaderboard.noMiners', { defaultValue: 'No miners found in this league.' })}
									</span>
								</div>
							}>
								{(entry, i) => {
									const badge = () => getRankBadge(i());
									const isTop3 = () => i() < 3;
									return (
										<div
											class={`flex items-center justify-between p-3.5 rounded-[16px] border transition-all duration-200 ${
												isTop3()
													? ''
													: 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
											}`}
											style={{
												animation: `nc-fadeInUp 400ms ease ${Math.min(i() * 50, 500)}ms both`,
												...getRowStyle(i()),
											}}
										>
											<div class="flex items-center gap-3">
												{/* Rank Badge */}
												<div class={`w-8 h-8 rounded-[10px] flex items-center justify-center font-bold text-[12px] border shrink-0 ${badge().bg}`}>
													{badge().icon || badge().rankText}
												</div>

												{/* Avatar */}
												<div
													class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[13px] shrink-0"
													style={{
														background: isTop3()
															? `linear-gradient(135deg, ${i() === 0 ? 'rgba(251,191,36,0.15)' : i() === 1 ? 'rgba(148,163,184,0.15)' : 'rgba(217,119,6,0.15)'}, rgba(255,255,255,0.03))`
															: 'rgba(255,255,255,0.05)',
														border: `1.5px solid ${isTop3()
															? (i() === 0 ? 'rgba(251,191,36,0.3)' : i() === 1 ? 'rgba(148,163,184,0.25)' : 'rgba(217,119,6,0.25)')
															: 'rgba(255,255,255,0.06)'
														}`,
													}}
												>
													{entry.name.slice(0, 2).toUpperCase()}
												</div>

												{/* Name */}
												<span class="text-white font-semibold text-[15px] truncate max-w-[120px]">
													{entry.name}
												</span>
											</div>

											{/* Score */}
											<div class="flex items-center gap-1.5 shrink-0">
												<span class="text-[13px]">🪙</span>
												<span class="text-white font-bold text-[14px] tabular-nums" dir="ltr">
													{formatScore(entry.score)}
												</span>
											</div>
										</div>
									);
								}}
							</For>
						</Show>
					</Show>

					{/* Squads tab content */}
					<Show when={activeTab() === 'squads'}>
						<Show
							when={!clansQuery.isLoading}
							fallback={
								<div class="flex flex-col items-center justify-center py-16 gap-3">
									<div class="w-8 h-8 border-2 border-white/15 border-t-amber-400 rounded-full animate-spin" />
									<span class="text-[12px] text-white/30 font-medium">Loading Squads...</span>
								</div>
							}
						>
							<For each={filteredSquads()} fallback={
								<div class="flex flex-col items-center justify-center py-16 gap-3">
									<span class="text-[28px]">🔍</span>
									<span class="text-white/30 text-[13px] font-medium">
										{t('airdropFinal.leaderboard.noSquads', { defaultValue: 'No squads found in this league.' })}
									</span>
								</div>
							}>
								{(clan, i) => {
									const score = clan.total_score || clan.members_count * 1500;
									const badge = () => getRankBadge(i());
									const isTop3 = () => i() < 3;
									return (
										<div
											class={`flex items-center justify-between p-3.5 rounded-[16px] border transition-all duration-200 ${
												isTop3()
													? ''
													: 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
											}`}
											style={{
												animation: `nc-fadeInUp 400ms ease ${Math.min(i() * 50, 500)}ms both`,
												...getRowStyle(i()),
											}}
										>
											<div class="flex items-center gap-3">
												{/* Rank Badge */}
												<div class={`w-8 h-8 rounded-[10px] flex items-center justify-center font-bold text-[12px] border shrink-0 ${badge().bg}`}>
													{badge().icon || badge().rankText}
												</div>

												{/* Clan Photo */}
												<div
													class="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
													style={{
														background: 'rgba(255,255,255,0.04)',
														border: `1.5px solid ${isTop3()
															? (i() === 0 ? 'rgba(251,191,36,0.25)' : i() === 1 ? 'rgba(148,163,184,0.2)' : 'rgba(217,119,6,0.2)')
															: 'rgba(255,255,255,0.06)'
														}`,
														padding: '2px',
													}}
												>
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
												<div class="flex flex-col min-w-0">
													<span class="text-white font-semibold text-[14px] truncate max-w-[120px]">
														{clan.chat_title}
													</span>
													<span class="text-white/30 text-[11px] font-medium" dir="ltr">
														{clan.members_count.toLocaleString('en-US')} {t('airdropFinal.leaderboard.players', { defaultValue: 'players' })}
													</span>
												</div>
											</div>

											{/* Score */}
											<div class="flex items-center gap-1.5 shrink-0">
												<span class="text-[13px]">🪙</span>
												<span class="text-white font-bold text-[14px] tabular-nums" dir="ltr">
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

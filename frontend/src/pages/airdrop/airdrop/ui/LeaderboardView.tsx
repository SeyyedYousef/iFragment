import { createQuery } from '@tanstack/solid-query';
import { openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createSignal, For, Show } from 'solid-js';
import { fetchLeaderboard } from '@/shared/api/airdrop.js';
import { API_CONFIG } from '@/shared/api/config.js';
import { getProfileStats, getTopClans } from '@/shared/api/profile.js';
import { t } from '@/shared/i18n/index.js';
import { LEAGUES, userClan } from '@/shared/store/airdrop.js';

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

	// All clans sorted globally by score (Clash of Clans style)
	const sortedGlobalClans = () => {
		const data = [...(clansQuery.data || [])];
		return data.sort((a, b) => {
			const scoreA = a.total_score || a.members_count * 1500;
			const scoreB = b.total_score || b.members_count * 1500;
			return scoreB - scoreA;
		});
	};

	const top3Clans = () => sortedGlobalClans().slice(0, 3);
	const restClans = () => sortedGlobalClans().slice(3, 100);

	const userClanInfo = () => {
		const myClan = userClan();
		if (!myClan) return null;
		const all = sortedGlobalClans();
		const rankIndex = all.findIndex(
			(c) => c.id === myClan.id || c.channel_username === myClan.channel_username,
		);
		if (rankIndex === -1) return null;
		return {
			clan: all[rankIndex],
			rank: rankIndex + 1,
			inTop100: rankIndex < 100,
		};
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

	const openChannel = (username: string) => {
		const clean = username.replace(/^@+/, '');
		try {
			openTelegramLink(`https://t.me/${clean}`);
		} catch (_) {
			window.open(`https://t.me/${clean}`, '_blank');
		}
	};

	return (
		<div
			class="h-full w-full overflow-y-auto no-scrollbar relative pb-32 bg-[#030303] text-white selection:bg-[#3390ec]/30"
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow (Dynamic color for Miners, Blue for Squads) */}
			<div
				class="absolute top-0 left-0 right-0 h-[350px] pointer-events-none transition-colors duration-1000 ease-in-out z-0 blur-[80px] opacity-40"
				style={{
					background: activeTab() === 'miners' 
						? `radial-gradient(circle at 50% -20%, ${currentLeague().color}, transparent 70%)`
						: `radial-gradient(circle at 50% -20%, #3390ec, transparent 70%)`,
				}}
			/>

			<div class="relative z-10 flex flex-col gap-5 pt-6 max-w-md mx-auto">
				
				{/* ═══════ TOP HEADER AREA ═══════ */}

				{/* 1) Miners League Header */}
				<Show when={activeTab() === 'miners'}>
					<div class="mx-4 rounded-[28px] border border-white/10 bg-[#12141C]/80 p-6 flex flex-col items-center relative overflow-hidden backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
						{/* Background Inner Glow */}
						<div 
							class="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[120px] rounded-full blur-3xl pointer-events-none opacity-20 transition-all duration-700"
							style={{ background: currentLeague().color }}
						/>

						{/* League Icon */}
						<div
							class="w-20 h-20 rounded-[22px] flex items-center justify-center mb-4 relative z-10 border-[1.5px] transition-all duration-500 shadow-[inset_0_2px_10px_rgba(255,255,255,0.1)]"
							style={{
								background: `linear-gradient(135deg, ${currentLeague().color}25, rgba(255,255,255,0.03))`,
								'border-color': `${currentLeague().color}50`,
								'box-shadow': `0 10px 30px ${currentLeague().color}30`,
							}}
						>
							<span
								class="material-symbols-outlined text-[42px] drop-shadow-lg transition-colors duration-500"
								style={{
									color: currentLeague().color,
									'font-variation-settings': '"FILL" 1',
								}}
							>
								{currentLeague().icon}
							</span>
						</div>

						{/* League Switcher Header */}
						<div class="flex items-center justify-between w-full z-10 mb-5 px-1">
							<button
								onClick={handlePrevLeague}
								disabled={selectedLeagueIndex() === 0}
								class={`w-10 h-10 rounded-[14px] flex items-center justify-center transition-all duration-300 ${
									selectedLeagueIndex() === 0
										? 'opacity-20 cursor-not-allowed border border-transparent'
										: 'bg-white/5 border border-white/10 active:scale-95 text-white/80 hover:bg-white/10 hover:shadow-md'
								}`}
							>
								<span class="material-symbols-outlined text-[20px] rtl:-scale-x-100">chevron_left</span>
							</button>

							<h2 class="text-white font-black text-[16px] uppercase tracking-[0.15em] text-center drop-shadow-sm">
								{currentLeague().name}
							</h2>

							<button
								onClick={handleNextLeague}
								disabled={selectedLeagueIndex() === LEAGUES.length - 1}
								class={`w-10 h-10 rounded-[14px] flex items-center justify-center transition-all duration-300 ${
									selectedLeagueIndex() === LEAGUES.length - 1
										? 'opacity-20 cursor-not-allowed border border-transparent'
										: 'bg-white/5 border border-white/10 active:scale-95 text-white/80 hover:bg-white/10 hover:shadow-md'
								}`}
							>
								<span class="material-symbols-outlined text-[20px] rtl:-scale-x-100">chevron_right</span>
							</button>
						</div>

						{/* Score Progress Bar (Premium Design) */}
						<div class="w-full max-w-[280px] z-10">
							<div class="flex items-center justify-between text-[12px] font-mono font-bold mb-2 text-white/60" dir="ltr">
								<span class="text-white/90">{(statsQuery.data?.xp || 0).toLocaleString('en-US')} XP</span>
								<span>{formatScore(LEAGUES[Math.min(LEAGUES.length - 1, selectedLeagueIndex() + 1)].minScore)}</span>
							</div>
							<div class="w-full h-[8px] bg-black/60 rounded-full overflow-hidden border border-white/10 p-[1px] shadow-inner">
								<div
									class="h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden"
									style={{
										width: `${Math.max(4, progressPercent())}%`,
										background: `linear-gradient(90deg, ${currentLeague().color}aa, ${currentLeague().color})`,
										'box-shadow': `0 0 12px ${currentLeague().color}80`,
									}}
								>
									<div class="absolute inset-0 bg-white/20 w-full h-full animate-[spinSlow_2s_linear_infinite]" style={{ transform: 'skewX(-45deg)' }} />
								</div>
							</div>
						</div>

						{/* Total Miners Badge */}
						<div class="mt-5 flex items-center z-10">
							<div class="flex items-center gap-1.5 text-white/70 text-[12px] font-mono font-bold bg-white/5 rounded-full px-4 py-1.5 border border-white/10 shadow-sm" dir="ltr">
								<span class="text-[14px]">🪙</span>
								<span>{formatScore(leaderboardQuery.data?.total_miners || 20043793)} Miners</span>
							</div>
						</div>
					</div>
				</Show>

				{/* 2) TOP 3 CLANS PODIUM (Shown only on Squads tab) */}
				<Show when={activeTab() === 'squads'}>
					<div class="mx-4 pt-2">
						<Show
							when={!clansQuery.isLoading && sortedGlobalClans().length > 0}
							fallback={
								<div class="flex flex-col items-center justify-center py-12">
									<div class="w-8 h-8 border-[3px] border-white/10 border-t-[#3390ec] rounded-full animate-spin" />
									<span class="text-[12px] font-mono font-bold text-white/40 mt-3 tracking-widest">
										LOADING PODIUM...
									</span>
								</div>
							}
						>
							<div class="flex items-end justify-center gap-2.5 pt-6 pb-2">
								{/* 2nd Place (Silver) */}
								<Show when={top3Clans()[1]}>
									{(clan) => {
										const score = clan().total_score || clan().members_count * 1500;
										return (
											<div class="flex flex-col items-center w-[30%] bg-gradient-to-t from-[#12141C] to-[#1a1d29] border border-slate-300/30 rounded-[20px] p-2.5 relative pt-5 hover:border-slate-300/60 transition-all shadow-[0_8px_20px_rgba(0,0,0,0.4)]">
												<div class="w-7 h-7 rounded-full bg-gradient-to-br from-slate-200 to-slate-400 border-[1.5px] border-white text-black font-mono font-black text-[12px] flex items-center justify-center absolute -top-3.5 shadow-[0_4px_10px_rgba(203,213,225,0.4)] z-10">
													2
												</div>
												<div class="w-12 h-12 rounded-[14px] bg-[#08090D] border border-slate-300/40 flex items-center justify-center overflow-hidden mb-2 shrink-0 shadow-inner">
													{clan().channel_photo ? (
														<img src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan().channel_username}`} alt="" class="w-full h-full object-cover" />
													) : (
														<span class="material-symbols-outlined text-slate-300 text-xl">shield</span>
													)}
												</div>
												<span class="text-white font-bold text-[11px] truncate w-full text-center mb-0.5">{clan().chat_title}</span>
												<span class="text-white/40 text-[9px] font-mono mb-2" dir="ltr">{formatScore(clan().members_count)} mem</span>
												<span class="text-slate-200 font-mono font-black text-[11px] mb-2 tabular-nums">🪙 {formatScore(score)}</span>
												<button onClick={() => openChannel(clan().channel_username)} class="w-full py-1.5 rounded-[10px] bg-slate-300/10 hover:bg-slate-300 text-slate-200 hover:text-black text-[10px] font-black flex items-center justify-center gap-1 transition-all active:scale-95 border border-slate-300/20">
													JOIN
												</button>
											</div>
										);
									}}
								</Show>

								{/* 1st Place (Gold - Center & Taller) */}
								<Show when={top3Clans()[0]}>
									{(clan) => {
										const score = clan().total_score || clan().members_count * 1500;
										return (
											<div class="flex flex-col items-center w-[35%] bg-gradient-to-t from-[#12141C] to-[#252011] border-[1.5px] border-amber-400/50 rounded-[24px] p-3 relative pt-6 hover:border-amber-400 transition-all shadow-[0_12px_30px_rgba(245,158,11,0.25)] -mt-6 z-10">
												{/* Glow behind 1st */}
												<div class="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-amber-400/20 rounded-full blur-xl pointer-events-none" />
												
												<div class="w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 border-[1.5px] border-white text-black font-mono font-black text-[13px] flex items-center justify-center absolute -top-4 shadow-[0_4px_12px_rgba(251,191,36,0.6)] z-10">
													👑 1
												</div>
												<div class="w-16 h-16 rounded-[18px] bg-[#08090D] border-[2px] border-amber-400/50 flex items-center justify-center overflow-hidden mb-2.5 shrink-0 shadow-inner">
													{clan().channel_photo ? (
														<img src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan().channel_username}`} alt="" class="w-full h-full object-cover" />
													) : (
														<span class="material-symbols-outlined text-amber-400 text-3xl drop-shadow-md">shield</span>
													)}
												</div>
												<span class="text-white font-black text-[13px] truncate w-full text-center mb-0.5 tracking-tight">{clan().chat_title}</span>
												<span class="text-white/40 text-[10px] font-mono mb-2" dir="ltr">{formatScore(clan().members_count)} members</span>
												<span class="text-amber-400 font-mono font-black text-[12px] mb-3 tabular-nums drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">🪙 {formatScore(score)}</span>
												<button onClick={() => openChannel(clan().channel_username)} class="w-full py-2 rounded-[12px] bg-gradient-to-r from-amber-400 to-amber-500 text-black text-[11px] font-black flex items-center justify-center gap-1 transition-all active:scale-95 shadow-md">
													JOIN
												</button>
											</div>
										);
									}}
								</Show>

								{/* 3rd Place (Bronze) */}
								<Show when={top3Clans()[2]}>
									{(clan) => {
										const score = clan().total_score || clan().members_count * 1500;
										return (
											<div class="flex flex-col items-center w-[30%] bg-gradient-to-t from-[#12141C] to-[#1e1713] border border-orange-500/30 rounded-[20px] p-2.5 relative pt-5 hover:border-orange-500/60 transition-all shadow-[0_8px_20px_rgba(0,0,0,0.4)]">
												<div class="w-7 h-7 rounded-full bg-gradient-to-br from-orange-300 to-orange-600 border-[1.5px] border-white text-black font-mono font-black text-[12px] flex items-center justify-center absolute -top-3.5 shadow-[0_4px_10px_rgba(249,115,22,0.4)] z-10">
													3
												</div>
												<div class="w-12 h-12 rounded-[14px] bg-[#08090D] border border-orange-500/40 flex items-center justify-center overflow-hidden mb-2 shrink-0 shadow-inner">
													{clan().channel_photo ? (
														<img src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan().channel_username}`} alt="" class="w-full h-full object-cover" />
													) : (
														<span class="material-symbols-outlined text-orange-500 text-xl">shield</span>
													)}
												</div>
												<span class="text-white font-bold text-[11px] truncate w-full text-center mb-0.5">{clan().chat_title}</span>
												<span class="text-white/40 text-[9px] font-mono mb-2" dir="ltr">{formatScore(clan().members_count)} mem</span>
												<span class="text-orange-400 font-mono font-black text-[11px] mb-2 tabular-nums">🪙 {formatScore(score)}</span>
												<button onClick={() => openChannel(clan().channel_username)} class="w-full py-1.5 rounded-[10px] bg-orange-500/10 hover:bg-orange-500 text-orange-400 hover:text-black text-[10px] font-black flex items-center justify-center gap-1 transition-all active:scale-95 border border-orange-500/20">
													JOIN
												</button>
											</div>
										);
									}}
								</Show>
							</div>
						</Show>
					</div>
				</Show>

				{/* ═══════ Main Tabs (Pill Design) ═══════ */}
				<div class="mx-4 bg-[#12141C]/60 backdrop-blur-md rounded-[20px] p-1.5 flex gap-1 border border-white/5 shadow-inner relative z-10">
					<button
						onClick={() => setActiveTab('miners')}
						class={`flex-1 h-11 rounded-[16px] text-[13px] font-mono font-black uppercase tracking-wider transition-all duration-300 ${
							activeTab() === 'miners'
								? 'bg-white/15 text-white shadow-[0_2px_10px_rgba(0,0,0,0.2)] border border-white/10'
								: 'text-white/40 hover:text-white/80'
						}`}
					>
						{t('airdropFinal.leaderboard.miners', { defaultValue: 'MINERS' })}
					</button>
					<button
						onClick={() => setActiveTab('squads')}
						class={`flex-1 h-11 rounded-[16px] text-[13px] font-mono font-black uppercase tracking-wider transition-all duration-300 ${
							activeTab() === 'squads'
								? 'bg-white/15 text-white shadow-[0_2px_10px_rgba(0,0,0,0.2)] border border-white/10'
								: 'text-white/40 hover:text-white/80'
						}`}
					>
						{t('airdropFinal.leaderboard.squads', { defaultValue: 'SQUADS' })}
					</button>
				</div>

				{/* ═══════ Sub Tabs (Daily / Weekly) ═══════ */}
				<div class="flex justify-center relative z-10 -mt-2 mb-1">
					<div class="bg-[#12141C]/40 backdrop-blur-sm rounded-[12px] p-1 flex gap-1 border border-white/5">
						<button
							onClick={() => setActiveSubTab('day')}
							class={`px-5 py-1.5 rounded-[8px] text-[11px] font-mono font-bold transition-all duration-200 ${
								activeSubTab() === 'day'
									? 'bg-white/10 text-white shadow-sm border border-white/5'
									: 'text-white/40 hover:text-white/70'
							}`}
						>
							DAILY
						</button>
						<button
							onClick={() => setActiveSubTab('week')}
							class={`px-5 py-1.5 rounded-[8px] text-[11px] font-mono font-bold transition-all duration-200 ${
								activeSubTab() === 'week'
									? 'bg-white/10 text-white shadow-sm border border-white/5'
									: 'text-white/40 hover:text-white/70'
							}`}
						>
							WEEKLY
						</button>
					</div>
				</div>

				{/* ═══════ Leaderboard Entries (Glassmorphic List) ═══════ */}
				<div class="mx-4 flex flex-col gap-2.5 min-h-[300px] relative z-10 pb-4">
					
					{/* ── MINERS TAB LIST ── */}
					<Show when={activeTab() === 'miners'}>
						<Show
							when={!leaderboardQuery.isLoading}
							fallback={
								<div class="flex flex-col items-center justify-center py-16 gap-3">
									<div class="w-8 h-8 border-[3px] border-white/10 border-t-[#3390ec] rounded-full animate-spin" />
									<span class="text-[12px] font-mono font-bold text-white/40 tracking-widest">LOADING MINERS...</span>
								</div>
							}
						>
							<For
								each={filteredMiners()}
								fallback={
									<div class="flex flex-col items-center justify-center py-16 text-white/40 text-[13px] font-medium bg-[#12141C]/40 rounded-[24px] border border-dashed border-white/10">
										<span>No miners found in this league.</span>
									</div>
								}
							>
								{(entry, i) => {
									const isTop1 = i() === 0;
									const isTop2 = i() === 1;
									const isTop3 = i() === 2;
									
									return (
										<div class={`flex items-center justify-between p-3.5 rounded-[22px] bg-[#12141C]/80 backdrop-blur-xl transition-all shadow-sm
											${isTop1 ? 'border border-amber-400/40 bg-gradient-to-r from-amber-400/5 to-transparent' : 
											  isTop2 ? 'border border-slate-300/30 bg-gradient-to-r from-slate-300/5 to-transparent' : 
											  isTop3 ? 'border border-orange-500/30 bg-gradient-to-r from-orange-500/5 to-transparent' : 'border border-white/5 hover:border-white/15 hover:bg-[#151822]'}`
										}>
											<div class="flex items-center gap-3.5 min-w-0 pr-2">
												{/* Rank Badge */}
												<div class={`w-8 h-8 rounded-[12px] flex items-center justify-center font-mono font-black text-[13px] shrink-0
													${isTop1 ? 'bg-amber-400 text-black shadow-[0_0_15px_rgba(251,191,36,0.4)]' : 
													  isTop2 ? 'bg-slate-300 text-black' : 
													  isTop3 ? 'bg-orange-400 text-black' : 'bg-white/5 text-white/50 border border-white/10'}`
												}>
													{i() + 1 < 10 ? `0${i() + 1}` : i() + 1}
												</div>

												{/* Avatar */}
												<div class={`w-10 h-10 rounded-[14px] flex items-center justify-center text-white font-black text-[14px] shrink-0
													${isTop1 ? 'bg-amber-400/10 border border-amber-400/30 text-amber-400' : 
													  isTop2 ? 'bg-slate-300/10 border border-slate-300/30 text-slate-200' : 
													  isTop3 ? 'bg-orange-400/10 border border-orange-400/30 text-orange-400' : 'bg-[#08090D] border border-white/10'}`
												}>
													{entry.name.slice(0, 2).toUpperCase()}
												</div>

												{/* Name & Clan */}
												<div class="flex flex-col min-w-0">
													<span class="text-white font-bold text-[14px] truncate tracking-tight">
														{entry.name}
													</span>
													<Show when={entry.clanName}>
														{(cn) => (
															<span class="text-[#3390ec] text-[11px] font-mono font-bold truncate flex items-center gap-1 mt-0.5 opacity-90" dir="ltr">
																<span class="material-symbols-outlined text-[13px]">shield</span>@
																{cn().replace(/^@+/, '')}
															</span>
														)}
													</Show>
												</div>
											</div>

											{/* Score */}
											<div class={`flex items-center gap-1.5 shrink-0 pl-2 font-mono font-black text-[13px] tabular-nums
												${isTop1 ? 'text-amber-400' : isTop2 ? 'text-slate-200' : isTop3 ? 'text-orange-400' : 'text-white/90'}`} dir="ltr">
												<span class="text-[14px]">🪙</span> <span>{formatScore(entry.score)}</span>
											</div>
										</div>
									);
								}}
							</For>
						</Show>
					</Show>

					{/* ── SQUADS / CLANS TAB LIST (#4 TO #100) ── */}
					<Show when={activeTab() === 'squads'}>
						<Show
							when={!clansQuery.isLoading}
							fallback={
								<div class="flex flex-col items-center justify-center py-16 gap-3">
									<div class="w-8 h-8 border-[3px] border-white/10 border-t-[#3390ec] rounded-full animate-spin" />
									<span class="text-[12px] font-mono font-bold text-white/40 tracking-widest">LOADING SQUADS...</span>
								</div>
							}
						>
							<Show
								when={sortedGlobalClans().length > 0}
								fallback={
									<div class="flex flex-col items-center justify-center py-16 text-white/40 text-[13px] font-medium bg-[#12141C]/40 rounded-[24px] border border-dashed border-white/10">
										<span>No squads registered yet.</span>
									</div>
								}
							>
								{/* ════ CLANS RANK 4 TO 100 ════ */}
								<div class="flex flex-col gap-2.5">
									<For each={restClans()}>
										{(clan, i) => {
											const score = clan.total_score || clan.members_count * 1500;
											const rankNum = i() + 4;
											return (
												<div class="flex items-center justify-between p-3.5 rounded-[22px] bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 hover:bg-[#151822] transition-all group shadow-[0_4px_16px_rgba(0,0,0,0.2)]">
													<div class="flex items-center gap-3.5 min-w-0 pr-2">
														{/* Rank Number */}
														<div class="w-8 h-8 rounded-[12px] bg-white/5 border border-white/10 text-white/50 font-mono font-black text-[13px] flex items-center justify-center shrink-0">
															{rankNum < 10 ? `0${rankNum}` : rankNum}
														</div>

														{/* Clan Avatar */}
														<div class="w-10 h-10 rounded-[14px] overflow-hidden bg-[#08090D] border border-white/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300 shadow-inner">
															{clan.channel_photo ? (
																<img src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan.channel_username}`} alt="" class="w-full h-full object-cover" />
															) : (
																<span class="material-symbols-outlined text-white/40 text-lg">shield</span>
															)}
														</div>

														{/* Clan Info */}
														<div class="flex flex-col min-w-0">
															<span class="text-white font-bold text-[14px] truncate tracking-tight">{clan.chat_title}</span>
															<div class="flex items-center gap-1.5 mt-0.5 opacity-60">
																<span class="text-[11px] font-mono text-[#3390ec]" dir="ltr">@{clan.channel_username.replace(/^@+/, '')}</span>
																<span class="text-[8px] text-white/40">•</span>
																<span class="text-[11px] font-mono" dir="ltr">{formatScore(clan.members_count)} mem</span>
															</div>
														</div>
													</div>

													{/* Score & Join Action */}
													<div class="flex items-center gap-2.5 shrink-0 pl-2">
														<div class="font-mono font-black text-[13px] text-white/90 tabular-nums flex items-center gap-1" dir="ltr">
															<span class="text-[14px]">🪙</span> {formatScore(score)}
														</div>
														<button
															onClick={() => openChannel(clan.channel_username)}
															class="w-9 h-9 rounded-[12px] bg-white/5 hover:bg-[#3390ec] text-white/60 hover:text-white border border-white/10 flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-sm"
														>
															<span class="material-symbols-outlined text-[18px]">open_in_new</span>
														</button>
													</div>
												</div>
											);
										}}
									</For>
								</div>

								{/* ════ USER'S CLAN RANK SEPARATOR & STICKY ROW ════ */}
								<Show when={!userClanInfo()?.inTop100 ? userClanInfo() : undefined}>
									{(info) => (
										<div class="flex flex-col gap-3 mt-5">
											{/* Premium Separator */}
											<div class="flex items-center gap-3 px-2">
												<div class="flex-1 h-[1px] bg-gradient-to-r from-transparent to-amber-400/30" />
												<div class="flex items-center gap-1.5 bg-[#12141C] px-4 py-1.5 rounded-[12px] border border-amber-400/20 shadow-[0_0_12px_rgba(245,158,11,0.1)]">
													<span class="material-symbols-outlined text-amber-400 text-[14px]">military_tech</span>
													<span class="text-[11px] font-mono font-bold text-amber-400 tracking-widest pt-0.5">
														YOUR SQUAD: #{info().rank}
													</span>
												</div>
												<div class="flex-1 h-[1px] bg-gradient-to-l from-transparent to-amber-400/30" />
											</div>

											{/* User Clan Row (Highlighted) */}
											<div class="flex items-center justify-between p-4 rounded-[24px] border-[1.5px] border-amber-400/50 bg-gradient-to-r from-amber-400/10 to-[#12141C] hover:from-amber-400/15 transition-all shadow-[0_8px_32px_rgba(245,158,11,0.15)] relative overflow-hidden">
												{/* Subtle glow inside card */}
												<div class="absolute top-0 left-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
												
												<div class="flex items-center gap-3.5 min-w-0 pr-2 relative z-10">
													<div class="w-9 h-9 rounded-[12px] bg-amber-400 text-black font-mono font-black text-[13px] flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(251,191,36,0.4)]">
														#{info().rank}
													</div>

													<div class="w-11 h-11 rounded-[14px] overflow-hidden bg-[#08090D] border-[1.5px] border-amber-400/40 flex items-center justify-center shrink-0 shadow-inner">
														{info().clan.channel_photo ? (
															<img src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${info().clan.channel_username}`} alt="" class="w-full h-full object-cover" />
														) : (
															<span class="material-symbols-outlined text-amber-400 text-xl">shield</span>
														)}
													</div>

													<div class="flex flex-col min-w-0">
														<span class="text-white font-black text-[15px] truncate tracking-tight">{info().clan.chat_title}</span>
														<div class="flex items-center gap-1.5 mt-0.5 opacity-80">
															<span class="text-[11px] font-mono text-amber-300" dir="ltr">@{info().clan.channel_username.replace(/^@+/, '')}</span>
															<span class="text-[8px] text-white/40">•</span>
															<span class="text-[11px] font-mono text-white/70" dir="ltr">{formatScore(info().clan.members_count)} mem</span>
														</div>
													</div>
												</div>

												<div class="flex items-center gap-3 shrink-0 pl-2 relative z-10">
													<div class="font-mono font-black text-[14px] text-amber-400 tabular-nums flex items-center gap-1 drop-shadow-md" dir="ltr">
														<span class="text-[15px]">🪙</span> {formatScore(info().clan.total_score || info().clan.members_count * 1500)}
													</div>
													<button
														onClick={() => openChannel(info().clan.channel_username)}
														class="w-10 h-10 rounded-[14px] bg-amber-400 text-black flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-md hover:bg-amber-300"
													>
														<span class="material-symbols-outlined text-[20px]">open_in_new</span>
													</button>
												</div>
											</div>
										</div>
									)}
								</Show>
							</Show>
						</Show>
					</Show>
				</div>
			</div>
		</div>
	);
};

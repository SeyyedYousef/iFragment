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
			class="h-full w-full overflow-y-auto no-scrollbar relative pb-32 bg-[#08090d] text-white selection:bg-[#0098ea]/30"
			style={{ background: 'radial-gradient(ellipse at 50% 0%, #0c1220 0%, #08090d 100%)' }}
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Ambient top glow */}
			<div
				class="absolute top-0 left-0 right-0 h-[280px] pointer-events-none transition-all duration-700 z-0"
				style={{
					background: `radial-gradient(ellipse at 50% 0%, ${activeTab() === 'miners' ? currentLeague().color : '#0098ea'}18 0%, transparent 65%)`,
				}}
			/>

			<div class="relative z-10 flex flex-col gap-4 pt-4 max-w-md mx-auto">
				{/* ═══════ TOP HEADER AREA ═══════ */}

				{/* 1) Miners League Header (Shown only on Miners tab) */}
				<Show when={activeTab() === 'miners'}>
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
				</Show>

				{/* 2) TOP 3 CLANS PODIUM ABOVE TAB BUTTONS (Shown only on Squads tab) */}
				<Show when={activeTab() === 'squads'}>
					<div class="mx-4 pt-2">
						<Show
							when={!clansQuery.isLoading && sortedGlobalClans().length > 0}
							fallback={
								<div class="flex flex-col items-center justify-center py-10">
									<div class="w-6 h-6 border-2 border-white/10 border-t-[#0098ea] rounded-full animate-spin" />
									<span class="text-[11px] font-mono text-white/30 mt-2">
										Loading Top Squads...
									</span>
								</div>
							}
						>
							<div class="grid grid-cols-3 gap-2 items-end pt-3">
								{/* 2nd Place */}
								<Show when={top3Clans()[1]}>
									{(clan) => {
										const score = clan().total_score || clan().members_count * 1500;
										return (
											<div class="flex flex-col items-center bg-[#10141e] border border-slate-300/30 rounded-2xl p-2.5 relative pt-4 hover:border-slate-300/60 transition-all group">
												<div class="w-6 h-6 rounded-full bg-slate-300/20 border border-slate-300/40 text-slate-200 font-mono font-black text-[11px] flex items-center justify-center absolute -top-3 shadow-md">
													2
												</div>
												<div class="w-12 h-12 rounded-xl bg-[#161b28] border border-slate-300/30 flex items-center justify-center overflow-hidden mb-2 shrink-0">
													{clan().channel_photo ? (
														<img
															src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan().channel_username}`}
															alt={clan().chat_title}
															class="w-full h-full object-cover"
														/>
													) : (
														<span class="material-symbols-outlined text-slate-300 text-xl">
															shield
														</span>
													)}
												</div>
												<span class="text-white font-bold text-xs truncate max-w-full text-center mb-0.5">
													{clan().chat_title}
												</span>
												<span class="text-white/40 text-[10px] font-mono mb-2" dir="ltr">
													{clan().members_count} members
												</span>
												<span class="text-slate-200 font-mono font-black text-xs mb-2 tabular-nums">
													🪙 {formatScore(score)}
												</span>
												<button
													onClick={() => openChannel(clan().channel_username)}
													class="w-full py-1.5 rounded-lg bg-slate-300/10 hover:bg-[#0098ea] hover:text-white border border-slate-300/20 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
												>
													<span>Join</span>
													<span class="material-symbols-outlined text-[13px]">open_in_new</span>
												</button>
											</div>
										);
									}}
								</Show>

								{/* 1st Place (Center - Gold Highlighted) */}
								<Show when={top3Clans()[0]}>
									{(clan) => {
										const score = clan().total_score || clan().members_count * 1500;
										return (
											<div class="flex flex-col items-center bg-[#10141e] border-2 border-amber-400/50 rounded-2xl p-3 relative pt-5 shadow-[0_0_24px_rgba(245,158,11,0.2)] hover:border-amber-400 transition-all group -mt-2">
												<div class="w-7 h-7 rounded-full bg-amber-400 border border-amber-300 text-black font-mono font-black text-xs flex items-center justify-center absolute -top-3.5 shadow-lg">
													👑 1
												</div>
												<div class="w-14 h-14 rounded-xl bg-[#161b28] border-2 border-amber-400/40 flex items-center justify-center overflow-hidden mb-2 shrink-0">
													{clan().channel_photo ? (
														<img
															src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan().channel_username}`}
															alt={clan().chat_title}
															class="w-full h-full object-cover"
														/>
													) : (
														<span class="material-symbols-outlined text-amber-400 text-2xl">
															shield
														</span>
													)}
												</div>
												<span class="text-white font-black text-xs truncate max-w-full text-center mb-0.5">
													{clan().chat_title}
												</span>
												<span class="text-white/40 text-[10px] font-mono mb-2" dir="ltr">
													{clan().members_count} members
												</span>
												<span class="text-amber-400 font-mono font-black text-xs mb-2 tabular-nums">
													🪙 {formatScore(score)}
												</span>
												<button
													onClick={() => openChannel(clan().channel_username)}
													class="w-full py-1.5 rounded-lg bg-amber-400 text-black font-extrabold text-[11px] flex items-center justify-center gap-1 transition-all active:scale-95 shadow-md"
												>
													<span>Join</span>
													<span class="material-symbols-outlined text-[13px]">open_in_new</span>
												</button>
											</div>
										);
									}}
								</Show>

								{/* 3rd Place */}
								<Show when={top3Clans()[2]}>
									{(clan) => {
										const score = clan().total_score || clan().members_count * 1500;
										return (
											<div class="flex flex-col items-center bg-[#10141e] border border-amber-700/30 rounded-2xl p-2.5 relative pt-4 hover:border-amber-700/60 transition-all group">
												<div class="w-6 h-6 rounded-full bg-amber-700/20 border border-amber-600/40 text-amber-500 font-mono font-black text-[11px] flex items-center justify-center absolute -top-3 shadow-md">
													3
												</div>
												<div class="w-12 h-12 rounded-xl bg-[#161b28] border border-amber-700/30 flex items-center justify-center overflow-hidden mb-2 shrink-0">
													{clan().channel_photo ? (
														<img
															src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan().channel_username}`}
															alt={clan().chat_title}
															class="w-full h-full object-cover"
														/>
													) : (
														<span class="material-symbols-outlined text-amber-600 text-xl">
															shield
														</span>
													)}
												</div>
												<span class="text-white font-bold text-xs truncate max-w-full text-center mb-0.5">
													{clan().chat_title}
												</span>
												<span class="text-white/40 text-[10px] font-mono mb-2" dir="ltr">
													{clan().members_count} members
												</span>
												<span class="text-amber-500 font-mono font-black text-xs mb-2 tabular-nums">
													🪙 {formatScore(score)}
												</span>
												<button
													onClick={() => openChannel(clan().channel_username)}
													class="w-full py-1.5 rounded-lg bg-amber-700/10 hover:bg-[#0098ea] hover:text-white border border-amber-700/20 text-amber-500 text-[11px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
												>
													<span>Join</span>
													<span class="material-symbols-outlined text-[13px]">open_in_new</span>
												</button>
											</div>
										);
									}}
								</Show>
							</div>
						</Show>
					</div>
				</Show>

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

				{/* ═══════ Leaderboard Entries (Below Tab Buttons) ═══════ */}
				<div class="mx-4 flex flex-col gap-3 min-h-[280px]">
					{/* ── MINERS TAB LIST ── */}
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
														{(cn) => (
															<span
																class="text-[#0098ea] text-[11px] font-mono font-bold truncate flex items-center gap-1"
																dir="ltr"
															>
																<span class="material-symbols-outlined text-[12px]">shield</span>@
																{cn().replace(/^@+/, '')}
															</span>
														)}
													</Show>
												</div>
											</div>

											{/* Score */}
											<div
												class="flex items-center gap-1 shrink-0 pl-2 font-mono font-bold text-xs text-white/90 tabular-nums"
												dir="ltr"
											>
												<span>🪙</span> <span>{formatScore(entry.score)}</span>
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
								<div class="flex flex-col items-center justify-center py-14 gap-2">
									<div class="w-6 h-6 border-2 border-white/10 border-t-[#0098ea] rounded-full animate-spin" />
									<span class="text-[11px] font-mono text-white/30">Loading Clans...</span>
								</div>
							}
						>
							<Show
								when={sortedGlobalClans().length > 0}
								fallback={
									<div class="flex flex-col items-center justify-center py-14 gap-2 text-white/30 text-xs font-medium">
										<span>No clans registered yet.</span>
									</div>
								}
							>
								{/* ════ CLANS RANK 4 TO 100 ════ */}
								<div class="flex flex-col gap-2">
									<For each={restClans()}>
										{(clan, i) => {
											const score = clan.total_score || clan.members_count * 1500;
											const rankNum = i() + 4;
											return (
												<div class="flex items-center justify-between p-3 rounded-2xl border border-white/[0.07] bg-[#10141e] hover:bg-[#151a28] transition-all">
													<div class="flex items-center gap-3 min-w-0 pr-2">
														{/* Rank Number */}
														<div class="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white/50 font-mono font-black text-xs flex items-center justify-center shrink-0">
															{rankNum < 10 ? `0${rankNum}` : rankNum}
														</div>

														{/* Clan Avatar */}
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
																@{clan.channel_username.replace(/^@+/, '')} ·{' '}
																{clan.members_count.toLocaleString('en-US')} members
															</span>
														</div>
													</div>

													{/* Score & Join Action */}
													<div class="flex items-center gap-2 shrink-0 pl-2">
														<div
															class="font-mono font-bold text-xs text-white/90 tabular-nums"
															dir="ltr"
														>
															<span>🪙</span> {formatScore(score)}
														</div>
														<button
															onClick={() => openChannel(clan.channel_username)}
															class="w-8 h-8 rounded-xl bg-white/5 hover:bg-[#0098ea] text-white/60 hover:text-white border border-white/10 flex items-center justify-center shrink-0 active:scale-95 transition-all"
															title="Open Telegram Channel"
														>
															<span class="material-symbols-outlined text-[16px]">open_in_new</span>
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
										<div class="flex flex-col gap-2 mt-4">
											{/* Separator Divider */}
											<div class="flex items-center gap-3 my-2">
												<div class="flex-1 h-[1px] bg-white/10" />
												<span class="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-widest bg-[#161b28] px-3.5 py-1 rounded-full border border-amber-400/30">
													Your Clan Rank: #{info().rank}
												</span>
												<div class="flex-1 h-[1px] bg-white/10" />
											</div>

											{/* User Clan Row */}
											<div class="flex items-center justify-between p-3.5 rounded-2xl border-2 border-amber-400/40 bg-amber-400/5 hover:bg-amber-400/10 transition-all shadow-lg">
												<div class="flex items-center gap-3 min-w-0 pr-2">
													<div class="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-400 font-mono font-black text-xs flex items-center justify-center shrink-0">
														#{info().rank}
													</div>

													<div class="w-10 h-10 rounded-xl overflow-hidden bg-[#161b28] border border-amber-400/30 flex items-center justify-center shrink-0">
														{info().clan.channel_photo ? (
															<img
																src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${info().clan.channel_username}`}
																alt={info().clan.chat_title}
																class="w-full h-full object-cover"
															/>
														) : (
															<span class="material-symbols-outlined text-amber-400 text-lg">
																shield
															</span>
														)}
													</div>

													<div class="flex flex-col min-w-0">
														<span class="text-white font-bold text-sm truncate tracking-tight">
															{info().clan.chat_title}
														</span>
														<span class="text-white/50 text-[11px] font-mono" dir="ltr">
															@{info().clan.channel_username.replace(/^@+/, '')} ·{' '}
															{info().clan.members_count.toLocaleString('en-US')} members
														</span>
													</div>
												</div>

												<div class="flex items-center gap-2 shrink-0 pl-2">
													<div
														class="font-mono font-bold text-xs text-amber-400 tabular-nums"
														dir="ltr"
													>
														<span>🪙</span>{' '}
														{formatScore(
															info().clan.total_score || info().clan.members_count * 1500,
														)}
													</div>
													<button
														onClick={() => openChannel(info().clan.channel_username)}
														class="w-8 h-8 rounded-xl bg-amber-400 text-black border border-amber-300 flex items-center justify-center shrink-0 active:scale-95 transition-all font-bold"
														title="Open Telegram Channel"
													>
														<span class="material-symbols-outlined text-[16px]">open_in_new</span>
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

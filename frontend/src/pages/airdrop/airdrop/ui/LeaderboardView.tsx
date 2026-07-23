import { createQuery } from '@tanstack/solid-query';
import { openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createSignal, For, Show } from 'solid-js';
import { fetchLeaderboard } from '@/shared/api/airdrop.js';
import { API_CONFIG } from '@/shared/api/config.js';
import { getProfileStats, getTopClans } from '@/shared/api/profile.js';
import { t } from '@/shared/i18n/index.js';
import { cleanTelegramUsername, formatScore } from '@/shared/lib/formatters.js';
import { LEAGUES, userClan } from '@/shared/store/airdrop.js';

export const LeaderboardView: Component<{ initialTab?: 'miners' | 'squads' }> = (props) => {
	const [selectedLeagueIndex, setSelectedLeagueIndex] = createSignal(0);
	const [activeTab, setActiveTab] = createSignal<'miners' | 'squads'>(props.initialTab || 'miners');
	const [activeSubTab, setActiveSubTab] = createSignal<'day' | 'week'>('day');

	const leaderboardQuery = createQuery(() => ({
		queryKey: ['leaderboard', activeSubTab()],
		queryFn: () => fetchLeaderboard(activeSubTab()),
		staleTime: 30_000,
		refetchOnWindowFocus: false,
	}));

	const clansQuery = createQuery(() => ({
		queryKey: ['topClansLeaderboard', activeSubTab()],
		queryFn: () => getTopClans(activeSubTab()),
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

	const handlePrevLeague = () => setSelectedLeagueIndex((prev) => Math.max(0, prev - 1));
	const handleNextLeague = () => setSelectedLeagueIndex((prev) => Math.min(LEAGUES.length - 1, prev + 1));

	const filteredMiners = () => {
		const data = leaderboardQuery.data?.leaderboard || [];
		const league = currentLeague().name;
		return data.filter((e) => e.league === league);
	};

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
		const rankIndex = all.findIndex((c) => c.id === myClan.id || c.channel_username === myClan.channel_username);
		if (rankIndex === -1) return null;
		return { clan: all[rankIndex], rank: rankIndex + 1, inTop100: rankIndex < 100 };
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
		const clean = cleanTelegramUsername(username);
		try { openTelegramLink(`https://t.me/${clean}`); } 
		catch (_) { window.open(`https://t.me/${clean}`, '_blank'); }
	};

	return (
		<div
			class="h-full w-full overflow-y-auto no-scrollbar relative pb-32 bg-[#030303] text-white selection:bg-[#3390ec]/30"
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow */}
			<div
				class="absolute top-0 left-0 right-0 h-[400px] pointer-events-none transition-colors duration-1000 ease-in-out z-0 blur-[90px] opacity-30"
				style={{
					background: activeTab() === 'miners' 
						? `radial-gradient(circle at 50% -10%, ${currentLeague().color}, transparent 80%)`
						: `radial-gradient(circle at 50% -10%, #f59e0b, transparent 80%)`,
				}}
			/>

			<div class="relative z-10 flex flex-col gap-5 pt-4 max-w-md mx-auto">

				{/* ═══════ TAB SWITCHER (Premium Pill) ═══════ */}
				<div class="mx-4 bg-[#12141C]/80 backdrop-blur-xl rounded-[20px] p-1.5 flex gap-1 border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
					<button
						onClick={() => setActiveTab('miners')}
						class={`flex-1 h-12 rounded-[16px] text-[13px] font-black uppercase tracking-widest transition-all duration-300 ${
							activeTab() === 'miners'
								? 'bg-white/10 text-white shadow-[0_2px_12px_rgba(0,0,0,0.3)] border border-white/5'
								: 'text-white/40 hover:text-white/80'
						}`}
					>
						{t('airdropFinal.leaderboard.miners', { defaultValue: 'MINERS' })}
					</button>
					<button
						onClick={() => setActiveTab('squads')}
						class={`flex-1 h-12 rounded-[16px] text-[13px] font-black uppercase tracking-widest transition-all duration-300 ${
							activeTab() === 'squads'
								? 'bg-white/10 text-white shadow-[0_2px_12px_rgba(0,0,0,0.3)] border border-white/5'
								: 'text-white/40 hover:text-white/80'
						}`}
					>
						{t('airdropFinal.leaderboard.squads', { defaultValue: 'SQUADS' })}
					</button>
				</div>

				{/* ═══════ SUB TABS ═══════ */}
				<div class="flex justify-center -mt-2">
					<div class="bg-[#12141C]/50 backdrop-blur-sm rounded-[14px] p-1 flex gap-1 border border-white/5">
						<button
							onClick={() => setActiveSubTab('day')}
							class={`px-6 py-1.5 rounded-[10px] text-[11px] font-bold tracking-wider transition-all duration-200 ${
								activeSubTab() === 'day' ? 'bg-[#3390ec] text-white shadow-md' : 'text-white/40 hover:text-white/70'
							}`}
						>
							DAILY
						</button>
						<button
							onClick={() => setActiveSubTab('week')}
							class={`px-6 py-1.5 rounded-[10px] text-[11px] font-bold tracking-wider transition-all duration-200 ${
								activeSubTab() === 'week' ? 'bg-[#3390ec] text-white shadow-md' : 'text-white/40 hover:text-white/70'
							}`}
						>
							WEEKLY
						</button>
					</div>
				</div>

				{/* ═══════ MINERS HEADER ═══════ */}
				<Show when={activeTab() === 'miners'}>
					<div class="mx-4 mt-2 rounded-[28px] border border-white/10 bg-gradient-to-b from-[#12141C] to-[#08090D] p-6 flex flex-col items-center relative overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
						
						{/* Dynamic Core Glow */}
						<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full blur-3xl opacity-10 pointer-events-none transition-all duration-700" style={{ background: currentLeague().color }} />

						<div class="flex items-center justify-between w-full relative z-10 mb-4">
							<button onClick={handlePrevLeague} disabled={selectedLeagueIndex() === 0} class={`w-10 h-10 rounded-[14px] flex items-center justify-center transition-all ${selectedLeagueIndex() === 0 ? 'opacity-20' : 'bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10'}`}>
								<span class="material-symbols-outlined rtl:-scale-x-100">chevron_left</span>
							</button>

							<div class="flex flex-col items-center">
								<div class="w-16 h-16 rounded-[20px] flex items-center justify-center mb-2 shadow-inner border border-white/5" style={{ background: `linear-gradient(135deg, ${currentLeague().color}25, rgba(255,255,255,0.02))` }}>
									<span class="material-symbols-outlined text-[36px] drop-shadow-lg transition-colors duration-500" style={{ color: currentLeague().color, 'font-variation-settings': '"FILL" 1' }}>{currentLeague().icon}</span>
								</div>
								<h2 class="text-white font-black text-[16px] uppercase tracking-[0.2em] drop-shadow-sm">{currentLeague().name}</h2>
							</div>

							<button onClick={handleNextLeague} disabled={selectedLeagueIndex() === LEAGUES.length - 1} class={`w-10 h-10 rounded-[14px] flex items-center justify-center transition-all ${selectedLeagueIndex() === LEAGUES.length - 1 ? 'opacity-20' : 'bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10'}`}>
								<span class="material-symbols-outlined rtl:-scale-x-100">chevron_right</span>
							</button>
						</div>

						{/* Premium Progress Bar */}
						<div class="w-full max-w-[260px] relative z-10 mt-2">
							<div class="flex items-center justify-between text-[11px] font-mono font-bold mb-2 text-white/50" dir="ltr">
								<span class="text-white">{(statsQuery.data?.xp || 0).toLocaleString('en-US')} XP</span>
								<span>{formatScore(LEAGUES[Math.min(LEAGUES.length - 1, selectedLeagueIndex() + 1)].minScore)}</span>
							</div>
							<div class="w-full h-[6px] bg-black/80 rounded-full overflow-hidden border border-white/10 shadow-inner">
								<div class="h-full rounded-full transition-all duration-700 ease-out relative" style={{ width: `${Math.max(2, progressPercent())}%`, background: `linear-gradient(90deg, ${currentLeague().color}88, ${currentLeague().color})`, 'box-shadow': `0 0 10px ${currentLeague().color}80` }}>
									<div class="absolute inset-0 bg-white/20 w-full h-full animate-[spinSlow_2s_linear_infinite]" style={{ transform: 'skewX(-45deg)' }} />
								</div>
							</div>
						</div>
					</div>
				</Show>

				{/* ═══════ ESPORTS PODIUM (Squads Tab) ═══════ */}
				<Show when={activeTab() === 'squads'}>
					<div class="mx-4 mt-2">
						<Show
							when={!clansQuery.isLoading && sortedGlobalClans().length > 0}
							fallback={
								<div class="flex flex-col items-center justify-center py-16">
									<div class="w-8 h-8 border-[3px] border-white/10 border-t-amber-400 rounded-full animate-spin" />
									<span class="text-[12px] font-black text-white/40 mt-4 tracking-widest uppercase">Preparing Podium...</span>
								</div>
							}
						>
							{/* LTR FORCED CONTAINER TO KEEP PODIUM ORDER EXACT (2nd - 1st - 3rd) */}
							<div class="flex items-end justify-center gap-2 pt-10 pb-4" dir="ltr">
								
								{/* 🥈 2ND PLACE (SILVER) */}
								<Show when={top3Clans()[1]}>
									{(clan) => {
										const score = clan().total_score || clan().members_count * 1500;
										return (
											<div class="flex flex-col items-center w-[31%] h-[160px] bg-gradient-to-t from-[#12141C] to-[#1a202c] border border-slate-400/30 rounded-t-[24px] rounded-b-[16px] p-2 relative shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
												<div class="relative w-14 h-14 mb-3 mt-[-28px]">
													<div class="w-full h-full rounded-[16px] bg-[#08090D] border-[2px] border-slate-300 flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(203,213,225,0.3)]">
														{clan().channel_photo ? <img src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan().channel_username}`} alt={clan().chat_title || 'Clan Logo'} class="w-full h-full object-cover" /> : <span class="material-symbols-outlined text-slate-300">shield</span>}
													</div>
													{/* Rank Badge */}
													<div class="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-slate-300 text-black font-black text-[11px] px-2.5 py-0.5 rounded-full border-2 border-[#1a202c] shadow-sm">
														2
													</div>
												</div>
												<span class="text-white font-bold text-[12px] truncate w-full text-center mb-0.5 tracking-tight px-1">{clan().chat_title}</span>
												<span class="text-slate-300 font-black text-[12px] mb-auto tabular-nums mt-1">🪙 {formatScore(score)}</span>
												<button onClick={() => openChannel(clan().channel_username)} class="w-full py-1.5 rounded-[10px] bg-white/5 hover:bg-slate-300 text-slate-300 hover:text-black text-[10px] font-black tracking-wider transition-all border border-slate-300/20 active:scale-95">JOIN</button>
											</div>
										);
									}}
								</Show>

								{/* 🥇 1ST PLACE (GOLD) - TALLER & CENTERED */}
								<Show when={top3Clans()[0]}>
									{(clan) => {
										const score = clan().total_score || clan().members_count * 1500;
										return (
											<div class="flex flex-col items-center w-[36%] h-[190px] bg-gradient-to-t from-[#12141C] to-[#2d220b] border-[1.5px] border-amber-400/60 rounded-t-[28px] rounded-b-[20px] p-2.5 relative shadow-[0_0_40px_rgba(245,158,11,0.25)] z-10">
												{/* Glowing Aura Behind Avatar */}
												<div class="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-amber-400/20 blur-xl rounded-full pointer-events-none" />
												
												<div class="relative w-16 h-16 mb-3 mt-[-36px]">
													{/* Perfect Crown Alignment */}
													<div class="absolute -top-6 left-1/2 -translate-x-1/2 text-[26px] drop-shadow-[0_0_10px_rgba(251,191,36,0.8)] z-20" style={{ transform: 'translateX(-50%) rotate(10deg)' }}>👑</div>
													<div class="w-full h-full rounded-[18px] bg-[#08090D] border-[2px] border-amber-400 flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(251,191,36,0.4)] relative z-10">
														{clan().channel_photo ? <img src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan().channel_username}`} alt={clan().chat_title || 'Clan Logo'} class="w-full h-full object-cover" /> : <span class="material-symbols-outlined text-amber-400 text-2xl">shield</span>}
													</div>
													{/* Rank Badge */}
													<div class="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-amber-400 text-black font-black text-[12px] px-3 py-0.5 rounded-full border-[2.5px] border-[#2d220b] shadow-md z-20">
														1
													</div>
												</div>
												<span class="text-white font-black text-[14px] truncate w-full text-center mb-0.5 tracking-tight px-1">{clan().chat_title}</span>
												<span class="text-white/40 text-[9px] font-mono uppercase tracking-widest">{formatScore(clan().members_count)} Mem</span>
												<span class="text-amber-400 font-black text-[14px] mb-auto tabular-nums mt-1 drop-shadow-md">🪙 {formatScore(score)}</span>
												<button onClick={() => openChannel(clan().channel_username)} class="w-full py-2 rounded-[12px] bg-gradient-to-r from-amber-400 to-amber-500 text-black text-[11px] font-black tracking-wider transition-all shadow-[0_4px_12px_rgba(245,158,11,0.3)] active:scale-95">JOIN</button>
											</div>
										);
									}}
								</Show>

								{/* 🥉 3RD PLACE (BRONZE) */}
								<Show when={top3Clans()[2]}>
									{(clan) => {
										const score = clan().total_score || clan().members_count * 1500;
										return (
											<div class="flex flex-col items-center w-[31%] h-[150px] bg-gradient-to-t from-[#12141C] to-[#261811] border border-orange-500/30 rounded-t-[24px] rounded-b-[16px] p-2 relative shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
												<div class="relative w-12 h-12 mb-3 mt-[-24px]">
													<div class="w-full h-full rounded-[14px] bg-[#08090D] border-[2px] border-orange-500 flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(249,115,22,0.3)]">
														{clan().channel_photo ? <img src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan().channel_username}`} alt={clan().chat_title || 'Clan Logo'} class="w-full h-full object-cover" /> : <span class="material-symbols-outlined text-orange-500">shield</span>}
													</div>
													{/* Rank Badge */}
													<div class="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-orange-500 text-black font-black text-[11px] px-2.5 py-0.5 rounded-full border-2 border-[#261811] shadow-sm">
														3
													</div>
												</div>
												<span class="text-white font-bold text-[11px] truncate w-full text-center mb-0.5 tracking-tight px-1">{clan().chat_title}</span>
												<span class="text-orange-400 font-black text-[11px] mb-auto tabular-nums mt-1">🪙 {formatScore(score)}</span>
												<button onClick={() => openChannel(clan().channel_username)} class="w-full py-1.5 rounded-[10px] bg-white/5 hover:bg-orange-500 text-orange-400 hover:text-black text-[10px] font-black tracking-wider transition-all border border-orange-500/20 active:scale-95">JOIN</button>
											</div>
										);
									}}
								</Show>

							</div>
						</Show>
					</div>
				</Show>

				{/* ═══════ LIST CONTAINER (#4 Onwards) ═══════ */}
				<div class="mx-4 flex flex-col gap-2.5 min-h-[300px] relative z-10 pb-4">
					
					{/* MINERS LIST */}
					<Show when={activeTab() === 'miners'}>
						<Show when={!leaderboardQuery.isLoading} fallback={<div class="flex justify-center py-10"><div class="w-8 h-8 border-[3px] border-white/10 border-t-[#3390ec] rounded-full animate-spin" /></div>}>
							<For each={filteredMiners()} fallback={<div class="text-center py-10 text-white/40 text-[13px]">No miners found.</div>}>
								{(entry, i) => {
									const isTop = i() < 3;
									return (
										<div class={`flex items-center justify-between p-3.5 rounded-[20px] bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 transition-all shadow-sm ${isTop ? 'bg-gradient-to-r from-white/5 to-transparent' : ''}`}>
											<div class="flex items-center gap-3.5 min-w-0 pr-2">
												<div class="w-8 h-8 rounded-[12px] bg-white/5 text-white/50 flex items-center justify-center font-mono font-black text-[13px] shrink-0 border border-white/10">
													{i() + 1 < 10 ? `0${i() + 1}` : i() + 1}
												</div>
												<div class="w-10 h-10 rounded-[14px] bg-[#08090D] border border-white/10 flex items-center justify-center text-white font-black text-[14px] shrink-0">
													{entry.name.slice(0, 2).toUpperCase()}
												</div>
												<div class="flex flex-col min-w-0">
													<span class="text-white font-bold text-[14px] truncate">{entry.name}</span>
													<Show when={entry.clanName}>
														{(cn) => <span class="text-[#3390ec] text-[11px] font-mono font-bold truncate mt-0.5" dir="ltr">@{cn().replace(/^@+/, '')}</span>}
													</Show>
												</div>
											</div>
											<div class="shrink-0 pl-2 font-mono font-black text-[13px] text-white/90 tabular-nums flex items-center gap-1" dir="ltr">
												<span class="text-[14px]">🪙</span> {formatScore(entry.score)}
											</div>
										</div>
									);
								}}
							</For>
						</Show>
					</Show>

					{/* SQUADS LIST (#4 to #100) */}
					<Show when={activeTab() === 'squads'}>
						<Show when={!clansQuery.isLoading} fallback={<div class="flex justify-center py-10"><div class="w-8 h-8 border-[3px] border-white/10 border-t-[#3390ec] rounded-full animate-spin" /></div>}>
							<div class="flex flex-col gap-2.5 mt-2">
								<For each={restClans()}>
									{(clan, i) => {
										const score = clan.total_score || clan.members_count * 1500;
										const rankNum = i() + 4;
										return (
											<div class="flex items-center justify-between p-3.5 rounded-[20px] bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 transition-all group shadow-sm">
												<div class="flex items-center gap-3.5 min-w-0 pr-2">
													<div class="w-8 h-8 rounded-[12px] bg-white/5 text-white/50 flex items-center justify-center font-mono font-black text-[13px] shrink-0 border border-white/10">
														{rankNum < 10 ? `0${rankNum}` : rankNum}
													</div>
													<div class="w-10 h-10 rounded-[14px] bg-[#08090D] border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-inner group-hover:scale-105 transition-transform">
														{clan.channel_photo ? <img src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan.channel_username}`} alt={clan.chat_title || 'Clan Logo'} class="w-full h-full object-cover" /> : <span class="material-symbols-outlined text-white/40">shield</span>}
													</div>
													<div class="flex flex-col min-w-0">
														<span class="text-white font-bold text-[14px] truncate">{clan.chat_title}</span>
														<span class="text-[#3390ec] text-[11px] font-mono mt-0.5" dir="ltr">@{cleanTelegramUsername(clan.channel_username)}</span>
													</div>
												</div>
												<div class="flex items-center gap-3 shrink-0 pl-2">
													<div class="font-mono font-black text-[13px] text-white/90 tabular-nums flex items-center gap-1" dir="ltr">
														<span class="text-[14px]">🪙</span> {formatScore(score)}
													</div>
													<button onClick={() => openChannel(clan.channel_username)} class="w-9 h-9 rounded-[12px] bg-white/5 hover:bg-[#3390ec] text-white/60 hover:text-white border border-white/10 flex items-center justify-center shrink-0 active:scale-95 transition-all">
														<span class="material-symbols-outlined text-[18px]">open_in_new</span>
													</button>
												</div>
											</div>
										);
									}}
								</For>
							</div>

							{/* STICKY USER CLAN (If not in Top 100) */}
							<Show when={!userClanInfo()?.inTop100 ? userClanInfo() : undefined}>
								{(info) => (
									<div class="flex flex-col gap-3 mt-6">
										<div class="flex items-center gap-3 px-2">
											<div class="flex-1 h-[1px] bg-gradient-to-r from-transparent to-amber-400/30" />
											<span class="text-[11px] font-mono font-bold text-amber-400 bg-[#12141C] px-4 py-1.5 rounded-[12px] border border-amber-400/20 shadow-sm">
												YOUR SQUAD: #{info().rank}
											</span>
											<div class="flex-1 h-[1px] bg-gradient-to-l from-transparent to-amber-400/30" />
										</div>
										<div class="flex items-center justify-between p-4 rounded-[24px] border-[1.5px] border-amber-400/50 bg-gradient-to-r from-amber-400/10 to-[#12141C] shadow-[0_8px_32px_rgba(245,158,11,0.15)] relative overflow-hidden">
											<div class="flex items-center gap-3.5 min-w-0 pr-2 z-10">
												<div class="w-9 h-9 rounded-[12px] bg-amber-400 text-black font-mono font-black text-[13px] flex items-center justify-center shrink-0 shadow-md">
													#{info().rank}
												</div>
												<div class="w-11 h-11 rounded-[14px] bg-[#08090D] border-[1.5px] border-amber-400/40 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
													{info().clan.channel_photo ? <img src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${info().clan.channel_username}`} alt={info().clan.chat_title || 'Clan Logo'} class="w-full h-full object-cover" /> : <span class="material-symbols-outlined text-amber-400">shield</span>}
												</div>
												<div class="flex flex-col min-w-0">
													<span class="text-white font-black text-[15px] truncate">{info().clan.chat_title}</span>
													<span class="text-amber-300 text-[11px] font-mono mt-0.5" dir="ltr">@{cleanTelegramUsername(info().clan.channel_username)}</span>
												</div>
											</div>
											<div class="flex items-center gap-3 shrink-0 pl-2 z-10">
												<div class="font-mono font-black text-[14px] text-amber-400 tabular-nums flex items-center gap-1 drop-shadow-md" dir="ltr">
													<span class="text-[15px]">🪙</span> {formatScore(info().clan.total_score || info().clan.members_count * 1500)}
												</div>
												<button onClick={() => openChannel(info().clan.channel_username)} class="w-10 h-10 rounded-[14px] bg-amber-400 text-black flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-md">
													<span class="material-symbols-outlined text-[20px]">open_in_new</span>
												</button>
											</div>
										</div>
									</div>
								)}
							</Show>
						</Show>
					</Show>
				</div>
			</div>
		</div>
	);
};

import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { backButton, initData, openTelegramLink } from '@tma.js/sdk-solid';
import { type Component, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import {
	getGroupLeaderboard,
	type GroupLeaderboardEntry,
} from '@/entities/user/index.js';
import { buildAvatarUrl } from '@/shared/api/config.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';

export const LeaderboardPage: Component = () => {
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = createSignal<'messages' | 'boosts'>('messages');
	const [selectedUser, setSelectedUser] = createSignal<GroupLeaderboardEntry | null>(null);
	const [highlightedUserId, setHighlightedUserId] = createSignal<number | null>(null);

	const leaderboardQuery = createQuery(() => ({
		queryKey: ['leaderboard', 'group', activeTab()],
		queryFn: () => getGroupLeaderboard(activeTab()),
		staleTime: 30000,
		refetchInterval: 60000,
	}));

	const data = () => leaderboardQuery.data;
	const top3 = () => data()?.top3 || [];
	const featured = () => data()?.featured || [];
	const items = () => data()?.items || [];
	const restOfList = () => [...featured(), ...items()];
	const myStats = () => data()?.my_stats;
	const currentUser = () => initData.user() as any;

	onMount(() => {
		try {
			backButton.show();
			const off = backButton.onClick(() => {
				try {
					haptic.impact('light');
				} catch {}
				navigate('/');
			});
			onCleanup(() => {
				off();
				try {
					backButton.hide();
				} catch {}
			});
		} catch {}
	});

	const formatScore = (val: number): string => {
		if (val >= 1_000_000) {
			return (val / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
		}
		if (val >= 1_000) {
			return (val / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
		}
		return (val || 0).toLocaleString();
	};

	const unitIcon = () => (activeTab() === 'messages' ? '💬' : '🚀');

	const handleOpenGroup = () => {
		try {
			haptic.impact('medium');
			openTelegramLink('https://t.me/FragmentInvestors');
		} catch {
			window.open('https://t.me/FragmentInvestors', '_blank');
		}
	};

	const handleBoostGroup = () => {
		try {
			haptic.impact('medium');
			openTelegramLink('https://t.me/boost/FragmentInvestors');
		} catch {
			window.open('https://t.me/boost/FragmentInvestors', '_blank');
		}
	};

	const resolveAvatarUrl = (entry?: { photo_url?: string | null; username?: string | null; user_id?: number | null }) => {
		if (!entry) return '';
		const p = entry.photo_url?.trim();
		if (p) {
			return buildAvatarUrl(p);
		}
		const u = entry.username?.replace('@', '').trim();
		if (u) {
			return `https://t.me/i/userpic/320/${u}.jpg`;
		}
		if (entry.user_id) {
			return buildAvatarUrl(`/api/v1/profile/avatar/${entry.user_id}`);
		}
		return '';
	};

	const myAvatarUrl = () => {
		const u = currentUser();
		if (u?.photoUrl || u?.photo_url) {
			return buildAvatarUrl(u.photoUrl || u.photo_url);
		}
		if (u?.username) {
			return `https://t.me/i/userpic/320/${u.username.replace('@', '')}.jpg`;
		}
		if (u?.id) {
			return buildAvatarUrl(`/api/v1/profile/avatar/${u.id}`);
		}
		return '';
	};

	// Jump to user row in the list
	const handleJumpToMyRank = () => {
		const uid = myStats()?.user_id;
		if (!uid) return;
		try {
			haptic.impact('light');
			const el = document.getElementById(`leaderboard-row-${uid}`);
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'center' });
				setHighlightedUserId(uid);
				setTimeout(() => setHighlightedUserId(null), 2500);
			}
		} catch {}
	};

	// Community Boost Level Calculations
	const totalBoosts = () => {
		const all = [...top3(), ...restOfList()];
		return all.reduce((acc, curr) => acc + (curr.score || 0), 0);
	};

	const levelThresholds = [0, 1, 3, 6, 10, 16, 24, 34, 46, 60, 80];
	const currentLevel = () => {
		const count = totalBoosts();
		for (let i = levelThresholds.length - 1; i >= 1; i--) {
			if (count >= levelThresholds[i]) return i;
		}
		return 1;
	};

	const nextLevelThreshold = () => {
		const lvl = currentLevel();
		return levelThresholds[lvl + 1] || levelThresholds[lvl] + 15;
	};

	const boostsNeeded = () => {
		const diff = nextLevelThreshold() - totalBoosts();
		return diff > 0 ? diff : 0;
	};

	const levelProgressPercent = () => {
		const prev = levelThresholds[currentLevel()] || 0;
		const next = nextLevelThreshold();
		const current = totalBoosts();
		const span = next - prev;
		if (span <= 0) return 100;
		const percent = Math.round(((current - prev) / span) * 100);
		return Math.min(Math.max(percent, 10), 100);
	};

	return (
		<div
			class="min-h-screen bg-[#070911] text-white font-sans flex flex-col relative overflow-x-hidden selection:bg-[#2AABEE]/30 pb-36"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Cosmic Lighting (No Purple) */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[360px] bg-gradient-to-b from-[#2AABEE]/18 via-[#0066FF]/6 to-transparent blur-[100px] pointer-events-none z-0" />
			<div class="fixed top-36 right-[-10%] w-[220px] h-[220px] bg-amber-500/8 blur-[90px] pointer-events-none z-0" />

			<div class="w-full max-w-md mx-auto px-4 pt-3 relative z-10 flex flex-col gap-4">
				{/* Top App Bar with Title & Supergroup Link */}
				<header class="flex items-center justify-between py-1">
					<div class="flex items-center gap-2.5">
						<div class="w-9 h-9 rounded-2xl bg-[#2AABEE]/15 border border-[#2AABEE]/30 flex items-center justify-center text-[#2AABEE] shadow-[0_0_20px_rgba(42,171,238,0.25)]">
							<span class="material-symbols-outlined text-[20px]">trophy</span>
						</div>
						<div class="flex flex-col">
							<h1 class="text-[19px] font-black tracking-tight text-white flex items-center gap-1.5 leading-none">
								<span>{t('leaderboard.title')}</span>
								<span class="text-amber-400 text-xs font-black px-1.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20">
									TOP 100
								</span>
							</h1>
							<span class="text-[11px] text-white/45 font-medium mt-1">
								{activeTab() === 'messages'
									? t('leaderboard.subtitleMessages')
									: t('leaderboard.subtitleBoosts')}
							</span>
						</div>
					</div>

					<button
						type="button"
						onClick={handleOpenGroup}
						class="text-[11px] font-black px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#2AABEE] border border-[#2AABEE]/30 backdrop-blur-md transition-all duration-200 flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-sm hover:border-[#2AABEE]/60"
					>
						<span>@FragmentInvestors</span>
						<span class="material-symbols-outlined text-[13px]">open_in_new</span>
					</button>
				</header>

				{/* High-End Segmented Tab Switcher with Tactile Feedback */}
				<div class="w-full bg-[#0D111E]/90 backdrop-blur-xl p-1.5 rounded-2xl flex items-center border border-white/10 shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)]">
					<button
						type="button"
						onClick={() => {
							haptic.selection();
							setActiveTab('messages');
						}}
						class={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
							activeTab() === 'messages'
								? 'bg-gradient-to-r from-white to-slate-100 text-[#07090E] shadow-[0_4px_16px_rgba(255,255,255,0.25)] scale-[1.01]'
								: 'text-white/55 hover:text-white hover:bg-white/[0.04]'
						}`}
					>
						<span class="text-base">💬</span>
						<span>{t('leaderboard.tabMessages')}</span>
					</button>

					<button
						type="button"
						onClick={() => {
							haptic.selection();
							setActiveTab('boosts');
						}}
						class={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
							activeTab() === 'boosts'
								? 'bg-gradient-to-r from-white to-slate-100 text-[#07090E] shadow-[0_4px_16px_rgba(255,255,255,0.25)] scale-[1.01]'
								: 'text-white/55 hover:text-white hover:bg-white/[0.04]'
						}`}
					>
						<span class="text-base">🚀</span>
						<span>{t('leaderboard.tabBoosts')}</span>
					</button>
				</div>

				{/* Feature 3: Community Boost Level Gauge (Exclusive in Boosts Tab) */}
				<Show when={activeTab() === 'boosts'}>
					<div class="w-full rounded-2xl p-4 bg-gradient-to-br from-[#10192E] via-[#0E1527] to-[#0A0E1A] border border-[#2AABEE]/30 shadow-[0_8px_28px_rgba(0,0,0,0.5)] flex flex-col gap-3 relative overflow-hidden group">
						<div class="absolute -top-12 -right-12 w-28 h-28 bg-[#2AABEE]/15 rounded-full blur-2xl pointer-events-none" />

						<div class="flex items-center justify-between relative z-10">
							<div class="flex items-center gap-2.5">
								<div class="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2AABEE] to-[#0066FF] flex items-center justify-center text-lg shadow-md shrink-0">
									🚀
								</div>
								<div class="flex flex-col">
									<span class="text-xs font-black text-white flex items-center gap-1.5">
										<span>{t('leaderboard.groupLevelTitle')}</span>
										<span class="px-2 py-0.5 rounded-full bg-[#2AABEE]/20 border border-[#2AABEE]/40 text-[#2AABEE] text-[10px] font-black">
											{t('leaderboard.level', { level: currentLevel() })}
										</span>
									</span>
									<span class="text-[10px] text-white/55 font-medium mt-0.5">
										{t('leaderboard.boostsRemaining', { count: boostsNeeded(), nextLevel: currentLevel() + 1 })}
									</span>
								</div>
							</div>
							<div class="flex flex-col items-end">
								<span class="text-[11px] font-black text-amber-400 font-mono">
									{totalBoosts()} / {nextLevelThreshold()}
								</span>
								<span class="text-[9px] text-white/40">{t('leaderboard.totalBoostsLabel')}</span>
							</div>
						</div>

						{/* High-Voltage Level Progress Bar */}
						<div class="w-full h-3 rounded-full bg-white/[0.07] border border-white/10 overflow-hidden relative p-0.5">
							<div
								class="h-full rounded-full bg-gradient-to-r from-[#2AABEE] via-[#38BDF8] to-[#00E5FF] shadow-[0_0_12px_rgba(42,171,238,0.7)] transition-all duration-700 ease-out"
								style={{ width: `${levelProgressPercent()}%` }}
							/>
						</div>

						<div class="flex items-center justify-between text-[10px] text-white/50 pt-0.5 border-t border-white/5">
							<span class="truncate">{t('leaderboard.boostPerks')}</span>
							<span class="font-mono text-cyan-400 font-bold shrink-0">{levelProgressPercent()}%</span>
						</div>

						<button
							type="button"
							onClick={handleBoostGroup}
							class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#2AABEE] to-[#0088FF] text-white text-xs font-black flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(42,171,238,0.35)] active:scale-[0.98] transition-all cursor-pointer hover:brightness-110 mt-1"
						>
							<span class="text-sm">⚡</span>
							<span>{t('leaderboard.boostButton')}</span>
							<span class="material-symbols-outlined text-[15px] rtl:rotate-180">arrow_forward</span>
						</button>
					</div>
				</Show>

				<Show when={activeTab() === 'messages'}>
					<div class="w-full rounded-2xl p-3.5 bg-gradient-to-br from-[#10192E]/90 to-[#0A0E1A]/90 border border-white/10 shadow-md flex items-center justify-between gap-3 relative overflow-hidden">
						<div class="flex items-center gap-2.5">
							<div class="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-lg shrink-0">
								💬
							</div>
							<div class="flex flex-col">
								<span class="text-xs font-black text-white">
									{t('leaderboard.messageActionTitle')}
								</span>
								<span class="text-[10px] text-white/55 font-medium mt-0.5">
									{t('leaderboard.messageActionDesc')}
								</span>
							</div>
						</div>
						<button
							type="button"
							onClick={handleOpenGroup}
							class="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-black flex items-center gap-1 active:scale-95 transition-all cursor-pointer shrink-0 border border-white/15"
						>
							<span>{t('leaderboard.joinChatButton')}</span>
							<span class="material-symbols-outlined text-[14px] rtl:rotate-180">arrow_forward</span>
						</button>
					</div>
				</Show>

				{/* Feature 1: Physical 3D Tiered Pedestals Podium Stage */}
				<Show
					when={!leaderboardQuery.isLoading && !leaderboardQuery.isError}
					fallback={
						<Show
							when={!leaderboardQuery.isError}
							fallback={
								<div class="h-44 flex flex-col items-center justify-center gap-3 rounded-3xl bg-[#0D111E]/70 border border-rose-500/25 p-4 text-center">
									<span class="material-symbols-outlined text-rose-400 text-3xl">error_outline</span>
									<span class="text-white/70 text-xs font-bold">{t('leaderboard.loadError')}</span>
									<button
										type="button"
										onClick={() => {
											haptic.impact('light');
											leaderboardQuery.refetch();
										}}
										class="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition active:scale-95 cursor-pointer border border-white/10"
									>
										{t('leaderboard.retry')}
									</button>
								</div>
							}
						>
							{/* Shimmering Skeleton Loader */}
							<div class="flex flex-col gap-4 animate-pulse pt-2">
								<div class="relative pt-6 pb-2 px-1 flex items-end justify-center gap-3">
									<div class="flex-1 flex flex-col items-center max-w-[105px]">
										<div class="w-18 h-18 rounded-full bg-white/5 border border-white/10" />
										<div class="w-full h-20 bg-white/5 rounded-t-xl mt-3" />
									</div>
									<div class="flex-1 flex flex-col items-center max-w-[125px]">
										<div class="w-22 h-22 rounded-full bg-amber-400/10 border border-amber-400/20" />
										<div class="w-full h-28 bg-white/5 rounded-t-xl mt-3" />
									</div>
									<div class="flex-1 flex flex-col items-center max-w-[105px]">
										<div class="w-18 h-18 rounded-full bg-white/5 border border-white/10" />
										<div class="w-full h-14 bg-white/5 rounded-t-xl mt-3" />
									</div>
								</div>
								<div class="w-full h-16 rounded-2xl bg-white/5 border border-white/10" />
								<div class="flex flex-col gap-2">
									<div class="w-full h-14 rounded-2xl bg-white/[0.04] border border-white/5" />
									<div class="w-full h-14 rounded-2xl bg-white/[0.04] border border-white/5" />
								</div>
							</div>
						</Show>
					}
				>
					<Show
						when={top3().length > 0}
						fallback={
							<div class="h-48 flex flex-col items-center justify-center gap-3 rounded-3xl bg-[#0D111E]/60 border border-white/10 p-6 text-center">
								<div class="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl">
									{unitIcon()}
								</div>
								<div class="flex flex-col gap-1">
									<span class="text-white text-sm font-black">
										{activeTab() === 'messages'
											? t('leaderboard.noMessagesYet')
											: t('leaderboard.noBoostsYet')}
									</span>
									<span class="text-white/50 text-xs max-w-xs leading-relaxed">
										{activeTab() === 'messages'
											? t('leaderboard.firstMessagePrompt')
											: t('leaderboard.firstBoostPrompt')}
									</span>
								</div>
							</div>
						}
					>
						{/* Real 3D Olympic Stepped Podium Stage */}
						<div class="relative pt-6 px-1 flex items-end justify-center gap-2.5">
							{/* Rank 2 (Left / Silver 3D Pedestal) */}
							<Show
								when={top3()[1]}
								fallback={
									<div class="flex-1 flex flex-col items-center max-w-[105px] z-10 opacity-40 select-none">
										<div class="relative w-18 h-18 rounded-full border-2 border-dashed border-slate-400/50 flex flex-col items-center justify-center bg-white/[0.02]">
											<span class="text-slate-400 text-base font-black">2</span>
											<span class="text-[8px] font-bold text-slate-400/80 mt-0.5">
												{t('leaderboard.openSpot')}
											</span>
										</div>
										{/* Stepped Silver Block */}
										<div class="w-full h-20 rounded-t-2xl bg-gradient-to-b from-[#1E2433] to-[#0D1117] border-t-2 border-slate-400/40 border-x border-slate-400/20 mt-3 flex flex-col items-center justify-center shadow-lg">
											<span class="text-slate-400/60 font-black text-2xl font-mono">2</span>
											<span class="text-[10px] text-white/30 font-bold">{t('leaderboard.emptySlot')}</span>
										</div>
									</div>
								}
							>
								{(second) => (
									<div
										onClick={() => {
											haptic.impact('light');
											setSelectedUser(second());
										}}
										class="flex-1 flex flex-col items-center max-w-[110px] z-10 group cursor-pointer active:scale-[0.98] transition-transform"
									>
										{/* Avatar */}
										<div class="relative w-18 h-18 rounded-full p-[2.5px] bg-gradient-to-b from-slate-200 via-slate-400 to-slate-600 shadow-[0_8px_24px_rgba(148,163,184,0.35)] transition-transform duration-300 group-hover:scale-105">
											<div class="w-full h-full rounded-full overflow-hidden bg-[#151926] relative flex items-center justify-center border border-white/20">
												<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-400 via-slate-500 to-slate-700 text-white font-black text-xl select-none">
													{(second().first_name || second().username || 'U')[0].toUpperCase()}
												</div>
												<Show when={resolveAvatarUrl(second())}>
													{(src) => (
														<img
															src={src()}
															alt={second().first_name || 'Silver'}
															class="absolute inset-0 w-full h-full object-cover z-10"
															referrerPolicy="no-referrer"
															onError={(e) => {
																const u = second().username?.replace('@', '').trim();
																if (u && !e.currentTarget.src.includes(`/userpic/320/${u}.jpg`)) {
																	e.currentTarget.src = `https://t.me/i/userpic/320/${u}.jpg`;
																} else if (second().user_id && !e.currentTarget.src.includes(`/profile/avatar/${second().user_id}`)) {
																	e.currentTarget.src = buildAvatarUrl(`/api/v1/profile/avatar/${second().user_id}`);
																} else {
																	e.currentTarget.style.display = 'none';
																}
															}}
														/>
													)}
												</Show>
											</div>
											{/* Silver Medal Badge */}
											<div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-gradient-to-b from-slate-100 to-slate-400 text-slate-950 text-xs font-black flex items-center justify-center shadow-lg border-[2px] border-[#070911]">
												2
											</div>
										</div>

										<span class="mt-3 text-xs font-black text-white truncate max-w-full text-center tracking-tight">
											{second().first_name || second().username || t('leaderboard.anonymous')}
										</span>

										{/* Physical Stepped 3D Pedestal Block */}
										<div class="w-full h-22 rounded-t-2xl bg-gradient-to-b from-[#1C2333] via-[#121724] to-[#0A0D15] border-t-2 border-slate-300/50 border-x border-slate-400/20 mt-2 flex flex-col items-center justify-between py-2 shadow-[0_12px_28px_rgba(0,0,0,0.6)] group-hover:border-slate-300 transition-colors">
											<span class="text-xs font-black text-slate-300 flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
												<span>{unitIcon()}</span>
												<span>{formatScore(second().score)}</span>
											</span>
											<span class="text-3xl font-black font-mono text-slate-400/30">2</span>
										</div>
									</div>
								)}
							</Show>

							{/* Rank 1 (Center / Gold 3D Champion Pedestal - Elevated) */}
							<Show when={top3()[0]}>
								{(first) => (
									<div
										onClick={() => {
											haptic.impact('light');
											setSelectedUser(first());
										}}
										class="flex-1 flex flex-col items-center max-w-[126px] z-20 group cursor-pointer active:scale-[0.98] transition-transform"
									>
										{/* Crown Icon */}
										<div class="text-amber-400 text-lg mb-1 filter drop-shadow-[0_2px_12px_rgba(251,191,36,0.9)] animate-bounce">
											👑
										</div>

										{/* Radiant Gold Avatar */}
										<div class="relative w-22 h-22 rounded-full p-[3px] bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 shadow-[0_0_35px_rgba(251,191,36,0.5)] transition-transform duration-300 group-hover:scale-105">
											<div class="w-full h-full rounded-full overflow-hidden bg-[#151926] relative flex items-center justify-center border border-white/20">
												<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 text-slate-950 font-black text-2xl select-none">
													{(first().first_name || first().username || 'U')[0].toUpperCase()}
												</div>
												<Show when={resolveAvatarUrl(first())}>
													{(src) => (
														<img
															src={src()}
															alt={first().first_name || 'Champion'}
															class="absolute inset-0 w-full h-full object-cover z-10"
															referrerPolicy="no-referrer"
															onError={(e) => {
																const u = first().username?.replace('@', '').trim();
																if (u && !e.currentTarget.src.includes(`/userpic/320/${u}.jpg`)) {
																	e.currentTarget.src = `https://t.me/i/userpic/320/${u}.jpg`;
																} else if (first().user_id && !e.currentTarget.src.includes(`/profile/avatar/${first().user_id}`)) {
																	e.currentTarget.src = buildAvatarUrl(`/api/v1/profile/avatar/${first().user_id}`);
																} else {
																	e.currentTarget.style.display = 'none';
																}
															}}
														/>
													)}
												</Show>
											</div>
											{/* Gold Badge */}
											<div class="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-500 text-slate-950 text-xs font-black flex items-center justify-center shadow-[0_4px_12px_rgba(251,191,36,0.7)] border-[2px] border-[#070911]">
												1
											</div>
										</div>

										<span class="mt-3.5 text-[13px] font-black text-white truncate max-w-full text-center tracking-tight">
											{first().first_name || first().username || t('leaderboard.topLeader')}
										</span>

										{/* Physical Stepped 3D Pedestal Block (Tallest Gold Column) */}
										<div class="w-full h-30 rounded-t-2xl bg-gradient-to-b from-[#2B210D] via-[#1A1408] to-[#0A0D15] border-t-2 border-amber-400/60 border-x border-amber-500/30 mt-2 flex flex-col items-center justify-between py-2.5 shadow-[0_16px_36px_rgba(251,191,36,0.2)] group-hover:border-amber-300 transition-colors">
											<span class="text-xs font-black text-amber-300 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 shadow-[0_0_12px_rgba(251,191,36,0.25)]">
												<span>{unitIcon()}</span>
												<span>{formatScore(first().score)}</span>
											</span>
											<span class="text-4xl font-black font-mono text-amber-400/40">1</span>
										</div>
									</div>
								)}
							</Show>

							{/* Rank 3 (Right / Bronze 3D Pedestal) */}
							<Show
								when={top3()[2]}
								fallback={
									<div class="flex-1 flex flex-col items-center max-w-[105px] z-10 opacity-40 select-none">
										<div class="relative w-18 h-18 rounded-full border-2 border-dashed border-amber-700/50 flex flex-col items-center justify-center bg-white/[0.02]">
											<span class="text-amber-500 text-base font-black">3</span>
											<span class="text-[8px] font-bold text-amber-500/80 mt-0.5">
												{t('leaderboard.openSpot')}
											</span>
										</div>
										{/* Stepped Bronze Block */}
										<div class="w-full h-15 rounded-t-2xl bg-gradient-to-b from-[#251A10] to-[#0D1117] border-t-2 border-amber-700/50 border-x border-amber-800/20 mt-3 flex flex-col items-center justify-center shadow-lg">
											<span class="text-amber-600/60 font-black text-2xl font-mono">3</span>
											<span class="text-[10px] text-white/30 font-bold">{t('leaderboard.emptySlot')}</span>
										</div>
									</div>
								}
							>
								{(third) => (
									<div
										onClick={() => {
											haptic.impact('light');
											setSelectedUser(third());
										}}
										class="flex-1 flex flex-col items-center max-w-[110px] z-10 group cursor-pointer active:scale-[0.98] transition-transform"
									>
										{/* Avatar */}
										<div class="relative w-18 h-18 rounded-full p-[2.5px] bg-gradient-to-b from-amber-600 via-amber-700 to-amber-900 shadow-[0_8px_24px_rgba(180,83,9,0.35)] transition-transform duration-300 group-hover:scale-105">
											<div class="w-full h-full rounded-full overflow-hidden bg-[#151926] relative flex items-center justify-center border border-white/20">
												<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-600 to-amber-800 text-white font-black text-xl select-none">
													{(third().first_name || third().username || 'U')[0].toUpperCase()}
												</div>
												<Show when={resolveAvatarUrl(third())}>
													{(src) => (
														<img
															src={src()}
															alt={third().first_name || 'Bronze'}
															class="absolute inset-0 w-full h-full object-cover z-10"
															referrerPolicy="no-referrer"
															onError={(e) => {
																const u = third().username?.replace('@', '').trim();
																if (u && !e.currentTarget.src.includes(`/userpic/320/${u}.jpg`)) {
																	e.currentTarget.src = `https://t.me/i/userpic/320/${u}.jpg`;
																} else if (third().user_id && !e.currentTarget.src.includes(`/profile/avatar/${third().user_id}`)) {
																	e.currentTarget.src = buildAvatarUrl(`/api/v1/profile/avatar/${third().user_id}`);
																} else {
																	e.currentTarget.style.display = 'none';
																}
															}}
														/>
													)}
												</Show>
											</div>
											{/* Bronze Badge */}
											<div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-gradient-to-b from-amber-500 to-amber-800 text-white text-xs font-black flex items-center justify-center shadow-lg border-[2px] border-[#070911]">
												3
											</div>
										</div>

										<span class="mt-3 text-xs font-black text-white truncate max-w-full text-center tracking-tight">
											{third().first_name || third().username || t('leaderboard.anonymous')}
										</span>

										{/* Physical Stepped 3D Pedestal Block */}
										<div class="w-full h-15 rounded-t-2xl bg-gradient-to-b from-[#24170E] via-[#160E08] to-[#0A0D15] border-t-2 border-amber-600/50 border-x border-amber-700/20 mt-2 flex flex-col items-center justify-between py-2 shadow-[0_10px_24px_rgba(0,0,0,0.6)] group-hover:border-amber-500 transition-colors">
											<span class="text-xs font-black text-amber-400 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25">
												<span>{unitIcon()}</span>
												<span>{formatScore(third().score)}</span>
											</span>
											<span class="text-2xl font-black font-mono text-amber-600/40">3</span>
										</div>
									</div>
								)}
							</Show>
						</div>
					</Show>
				</Show>

				{/* Personal Standing Card ("جایگاه شما") */}
				<div class="w-full rounded-2xl bg-gradient-to-r from-[#0F1424] via-[#0E1322] to-[#0A0D18] border border-white/10 p-3.5 flex items-center justify-between shadow-xl">
					<div class="flex items-center gap-3 min-w-0">
						<div class="w-11 h-11 rounded-full p-[2px] bg-gradient-to-b from-[#2AABEE] to-[#0055ff] shrink-0 shadow-md">
							<div class="w-full h-full rounded-full overflow-hidden bg-[#151926] relative flex items-center justify-center">
								<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2AABEE] to-[#0066FF] text-white font-black text-sm select-none">
									{(currentUser()?.first_name || 'U')[0].toUpperCase()}
								</div>
								<Show when={myAvatarUrl()}>
									{(src) => (
										<img
											src={src()}
											alt="Me"
											class="absolute inset-0 w-full h-full object-cover z-10"
											referrerPolicy="no-referrer"
											onError={(e) => {
												e.currentTarget.style.display = 'none';
											}}
										/>
									)}
								</Show>
							</div>
						</div>
						<div class="flex flex-col min-w-0">
							<div class="flex items-center gap-1.5">
								<span class="text-xs font-black text-white truncate max-w-[130px]">
									{currentUser()?.first_name || t('leaderboard.you')}
								</span>
								<span class="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-[#2AABEE]/25 text-[#2AABEE] border border-[#2AABEE]/40">
									{t('leaderboard.you')}
								</span>
							</div>
							<span class="text-[11px] font-bold text-white/50 mt-0.5">
								{(myStats()?.rank ?? 0) > 0
									? t('leaderboard.rankTitle', { rank: myStats()?.rank })
									: t('leaderboard.outOfRank')}
							</span>
						</div>
					</div>

					<div class="flex items-center gap-2 shrink-0">
						{/* Score */}
						<div class="flex flex-col items-end">
							<span class="text-[10px] text-white/45 font-medium">{t('leaderboard.yourScore')}</span>
							<span class="text-xs font-black text-white flex items-center gap-1 font-mono">
								<span>{unitIcon()}</span>
								<span>{formatScore(myStats()?.score || 0)}</span>
							</span>
						</div>
						{/* Credits */}
						<div class="flex flex-col items-end border-r border-white/10 rtl:border-r-0 rtl:border-l pr-2 rtl:pr-0 rtl:pl-2 mr-1 rtl:mr-0 rtl:ml-1">
							<span class="text-[10px] text-white/45 font-medium">{t('leaderboard.credits')}</span>
							<span class="text-xs font-black text-amber-400 flex items-center gap-1 font-mono">
								<span>⭐</span>
								<span>{(myStats()?.credits ?? 0).toLocaleString()}</span>
							</span>
						</div>
					</div>
				</div>

				{/* Section Header: Ranks 4 to 100 */}
				<div class="flex items-center justify-between pt-1 px-1">
					<div class="flex items-center gap-2">
						<span class="w-2 h-2 rounded-full bg-[#2AABEE]" />
						<h2 class="text-xs font-black text-white tracking-tight">
							{t('leaderboard.topHolders')}
						</h2>
					</div>
					<span class="text-[10px] font-bold text-white/45 px-2.5 py-0.5 rounded-full bg-white/[0.05] border border-white/10">
						{activeTab() === 'messages' ? t('leaderboard.messagesUnit') : t('leaderboard.boostsUnit')}
					</span>
				</div>

				{/* Continuous Leaders Feed (Ranks 4 to 100) */}
				<div class="flex flex-col gap-2">
					<For
						each={restOfList()}
						fallback={
							<Show when={!leaderboardQuery.isLoading}>
								<div class="py-10 text-center text-white/40 text-xs rounded-2xl bg-[#0D111E]/40 border border-white/5">
									{restOfList().length === 0 && top3().length <= 3
										? t('leaderboard.moreRanksPlaceholder')
										: t('leaderboard.empty')}
								</div>
							</Show>
						}
					>
						{(entry: GroupLeaderboardEntry) => {
							const isMe = () => myStats()?.user_id === entry.user_id;
							const isHighlighted = () => highlightedUserId() === entry.user_id;
							return (
								<div
									id={`leaderboard-row-${entry.user_id}`}
									onClick={() => {
										haptic.impact('light');
										setSelectedUser(entry);
									}}
									class={`w-full py-2.5 px-3.5 rounded-2xl flex items-center justify-between transition-all duration-300 cursor-pointer active:scale-[0.99] ${
										isHighlighted()
											? 'ring-2 ring-amber-400 bg-amber-500/20 shadow-[0_0_25px_rgba(251,191,36,0.4)] scale-[1.02]'
											: isMe()
												? 'bg-gradient-to-r from-[#2AABEE]/25 to-[#0055ff]/15 border border-[#2AABEE]/60 shadow-[0_4px_20px_rgba(42,171,238,0.25)]'
												: 'bg-[#0D111E]/75 hover:bg-[#0D111E] border border-white/[0.06] hover:border-white/15'
									}`}
								>
									<div class="flex items-center gap-3 min-w-0">
										<div class="w-6 text-center text-xs font-black font-mono shrink-0">
											<span class={entry.rank <= 10 ? 'text-[#2AABEE]' : 'text-white/40'}>
												#{entry.rank}
											</span>
										</div>

										<div class="w-10 h-10 rounded-full overflow-hidden bg-[#151926] shrink-0 border border-white/10 shadow-sm relative flex items-center justify-center">
											<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2AABEE]/30 to-[#0066FF]/30 text-white font-bold text-xs select-none">
												{(entry.first_name || entry.username || 'U')[0].toUpperCase()}
											</div>
											<Show when={resolveAvatarUrl(entry)}>
												{(src) => (
													<img
														src={src()}
														alt={entry.first_name || 'Leader'}
														class="absolute inset-0 w-full h-full object-cover z-10"
														referrerPolicy="no-referrer"
														loading="lazy"
														onError={(e) => {
															const u = entry.username?.replace('@', '').trim();
															if (u && !e.currentTarget.src.includes(`/userpic/320/${u}.jpg`)) {
																e.currentTarget.src = `https://t.me/i/userpic/320/${u}.jpg`;
															} else if (entry.user_id && !e.currentTarget.src.includes(`/profile/avatar/${entry.user_id}`)) {
																e.currentTarget.src = buildAvatarUrl(`/api/v1/profile/avatar/${entry.user_id}`);
															} else {
																e.currentTarget.style.display = 'none';
															}
														}}
													/>
												)}
											</Show>
										</div>

										<div class="flex flex-col min-w-0">
											<div class="flex items-center gap-1.5">
												<span class="text-xs font-black text-white truncate max-w-[150px]">
													{entry.first_name || entry.username || t('leaderboard.anonymous')}
												</span>
												{isMe() && (
													<span class="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-[#2AABEE]/25 text-[#2AABEE] border border-[#2AABEE]/40">
														{t('leaderboard.you')}
													</span>
												)}
											</div>
											<Show when={entry.username}>
												<span class="text-[10px] text-white/40 truncate dir-ltr text-left font-mono">
													@{entry.username}
												</span>
											</Show>
										</div>
									</div>

									<div class="flex items-center gap-1.5 shrink-0 pl-1 rtl:pl-0 rtl:pr-1">
										<span class="text-xs font-black text-white font-mono bg-white/[0.06] px-2.5 py-1 rounded-xl border border-white/[0.08]">
											{formatScore(entry.score)}
										</span>
										<span class="text-xs">{unitIcon()}</span>
									</div>
								</div>
							);
						}}
					</For>
				</div>
			</div>

			{/* Feature 4: Floating "Jump to My Rank" Quick Action */}
			<Show when={(myStats()?.rank ?? 0) > 3 && (myStats()?.rank ?? 0) <= 100}>
				<button
					type="button"
					onClick={handleJumpToMyRank}
					class="fixed left-1/2 -translate-x-1/2 bottom-24 z-[90] px-4 py-2 rounded-full bg-gradient-to-r from-[#2AABEE] to-[#0066FF] text-white text-xs font-black shadow-[0_6px_24px_rgba(42,171,238,0.45)] border border-white/20 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer backdrop-blur-md"
				>
					<span class="material-symbols-outlined text-sm">my_location</span>
					<span>{t('leaderboard.jumpToMyRank', { rank: myStats()?.rank })}</span>
				</button>
			</Show>

			{/* Feature 2: Interactive Telegram Bottom Sheet Profile Modal */}
			<Show when={selectedUser()}>
				{(user) => {
					const rankBadgeText = () => {
						if (user().rank === 1) return t('leaderboard.rankChampion');
						if (user().rank === 2) return t('leaderboard.rankRunnerUp');
						if (user().rank === 3) return t('leaderboard.rankThird');
						return t('leaderboard.rankTitle', { rank: user().rank });
					};

					const rankBorderColor = () => {
						if (user().rank === 1) return 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.4)]';
						if (user().rank === 2) return 'border-slate-300 shadow-[0_0_20px_rgba(148,163,184,0.3)]';
						if (user().rank === 3) return 'border-amber-600 shadow-[0_0_20px_rgba(180,83,9,0.3)]';
						return 'border-[#2AABEE] shadow-[0_0_20px_rgba(42,171,238,0.3)]';
					};

					return (
						<div class="fixed inset-0 z-[120] flex items-end justify-center bg-black/75 backdrop-blur-md animate-fadeIn">
							{/* Backdrop Click Dismiss */}
							<div
								class="absolute inset-0"
								onClick={() => setSelectedUser(null)}
							/>

							{/* Drawer Content */}
							<div
								class="relative w-full max-w-md bg-[#0D111E] border-t border-white/15 rounded-t-[32px] p-6 flex flex-col gap-5 shadow-[0_-12px_40px_rgba(0,0,0,0.85)] z-10 animate-slideUp"
								dir={isRtl() ? 'rtl' : 'ltr'}
							>
								{/* Handle & Close */}
								<div class="flex items-center justify-between pb-1">
									<span class="text-xs font-bold text-white/40 uppercase tracking-wider">
										{t('leaderboard.userSheetTitle')}
									</span>
									<button
										type="button"
										onClick={() => setSelectedUser(null)}
										class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 active:scale-95 transition cursor-pointer"
									>
										<span class="material-symbols-outlined text-lg">close</span>
									</button>
								</div>

								{/* User Hero Banner */}
								<div class="flex items-center gap-4 bg-white/[0.03] p-4 rounded-2xl border border-white/5">
									<div class={`w-16 h-16 rounded-full border-2 ${rankBorderColor()} overflow-hidden bg-[#151926] relative shrink-0`}>
										<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2AABEE] to-[#0066FF] text-white font-black text-xl select-none">
											{(user().first_name || user().username || 'U')[0].toUpperCase()}
										</div>
										<Show when={resolveAvatarUrl(user())}>
											{(src) => (
												<img
													src={src()}
													alt={user().first_name || 'User'}
													class="absolute inset-0 w-full h-full object-cover z-10"
													referrerPolicy="no-referrer"
													onError={(e) => {
														e.currentTarget.style.display = 'none';
													}}
												/>
											)}
										</Show>
									</div>

									<div class="flex flex-col min-w-0">
										<span class="text-base font-black text-white truncate">
											{user().first_name || user().username || t('leaderboard.anonymous')}
										</span>
										<Show when={user().username}>
											<span class="text-xs text-[#2AABEE] font-mono dir-ltr text-left">
												@{user().username}
											</span>
										</Show>
										<span class="inline-flex mt-1 text-[11px] font-bold text-amber-300">
											{rankBadgeText()}
										</span>
									</div>
								</div>

								{/* Stats Cards */}
								<div class="grid grid-cols-2 gap-3">
									<div class="p-3 rounded-xl bg-white/[0.04] border border-white/5 flex flex-col items-center">
										<span class="text-[10px] text-white/50">{t('leaderboard.statsScore')}</span>
										<span class="text-base font-black text-white font-mono mt-0.5 flex items-center gap-1">
											<span>{unitIcon()}</span>
											<span>{formatScore(user().score)}</span>
										</span>
									</div>
									<div class="p-3 rounded-xl bg-white/[0.04] border border-white/5 flex flex-col items-center">
										<span class="text-[10px] text-white/50">{t('leaderboard.statsRank')}</span>
										<span class="text-base font-black text-white font-mono mt-0.5">
											#{user().rank}
										</span>
									</div>
								</div>

								{/* Direct Telegram Action */}
								<Show
									when={user().username}
									fallback={
										<button
											type="button"
											onClick={() => {
												setSelectedUser(null);
												handleOpenGroup();
											}}
											class="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-black flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
										>
											<span class="material-symbols-outlined text-base">forum</span>
											<span>{t('leaderboard.openInGroup')}</span>
										</button>
									}
								>
									<button
										type="button"
										onClick={() => {
											try {
												haptic.impact('medium');
												openTelegramLink(`https://t.me/${user().username}`);
											} catch {
												window.open(`https://t.me/${user().username}`, '_blank');
											}
										}}
										class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#2AABEE] to-[#0088FF] text-white text-xs font-black flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(42,171,238,0.4)] active:scale-95 transition cursor-pointer hover:brightness-110"
									>
										<span class="material-symbols-outlined text-base">send</span>
										<span>{t('leaderboard.sendMessage')}</span>
									</button>
								</Show>
							</div>
						</div>
					);
				}}
			</Show>

			{/* Floating Bottom Navigation Bar */}
			<BottomNav />
		</div>
	);
};

export default LeaderboardPage;

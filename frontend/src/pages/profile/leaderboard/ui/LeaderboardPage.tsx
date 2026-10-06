import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { backButton, openTelegramLink } from '@tma.js/sdk-solid';
import { type Component, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import {
	getGroupLeaderboard,
	type GroupLeaderboardEntry,
} from '@/entities/user/index.js';
import { buildAvatarUrl } from '@/shared/api/config.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export const LeaderboardPage: Component = () => {
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = createSignal<'messages' | 'boosts'>('messages');

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
	const myStats = () => data()?.my_stats;

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
		return val.toLocaleString();
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

	return (
		<div
			class="min-h-screen bg-[#06080F] text-white font-sans flex flex-col relative overflow-x-hidden selection:bg-[#2AABEE]/30 pb-32"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Multi-layered Ambient Aurora & Lighting Grid */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[420px] bg-gradient-to-b from-[#2AABEE]/22 via-[#0055ff]/8 to-transparent blur-[90px] pointer-events-none z-0" />
			<div class="fixed top-40 right-[-10%] w-[260px] h-[260px] bg-amber-500/10 blur-[100px] pointer-events-none z-0" />
			<div class="fixed top-64 left-[-10%] w-[260px] h-[260px] bg-purple-600/8 blur-[100px] pointer-events-none z-0" />

			<div class="w-full max-w-md mx-auto px-4 pt-3 relative z-10 flex flex-col gap-4">
				{/* Top App Bar with Title & Official Telegram Group Badge */}
				<header class="flex items-center justify-between py-1.5">
					<div class="flex items-center gap-2.5">
						<div class="w-8 h-8 rounded-xl bg-[#2AABEE]/15 border border-[#2AABEE]/30 flex items-center justify-center text-[#2AABEE] shadow-[0_0_15px_rgba(42,171,238,0.2)]">
							<span class="material-symbols-outlined text-[19px]">trophy</span>
						</div>
						<div class="flex flex-col">
							<h1 class="text-[19px] font-black tracking-tight text-white flex items-center gap-1.5 leading-none">
								<span>{t('leaderboard.title')}</span>
								<svg class="w-4.5 h-4.5 text-[#2AABEE] shrink-0 drop-shadow-[0_0_8px_rgba(42,171,238,0.5)]" viewBox="0 0 24 24" fill="currentColor">
									<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
								</svg>
							</h1>
							<span class="text-[10px] text-white/40 font-medium mt-0.5">Top 100 Ecosystem Leaders</span>
						</div>
					</div>

					<button
						type="button"
						onClick={handleOpenGroup}
						class="text-[11px] font-bold px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#2AABEE] border border-[#2AABEE]/30 backdrop-blur-md transition-all duration-200 flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-sm hover:border-[#2AABEE]/60"
					>
						<span>@FragmentInvestors</span>
						<span class="material-symbols-outlined text-[13px]">open_in_new</span>
					</button>
				</header>

				{/* High-End Segmented Switcher */}
				<div class="w-full bg-[#0D101C]/90 backdrop-blur-xl p-1 rounded-2xl flex items-center border border-white/10 shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)]">
					<button
						type="button"
						onClick={() => {
							haptic.selection();
							setActiveTab('messages');
						}}
						class={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
							activeTab() === 'messages'
								? 'bg-gradient-to-r from-white to-slate-100 text-[#07090E] shadow-[0_4px_16px_rgba(255,255,255,0.2)] scale-[1.01]'
								: 'text-white/55 hover:text-white hover:bg-white/[0.04]'
						}`}
					>
						<span class="text-sm">💬</span>
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
								? 'bg-gradient-to-r from-white to-slate-100 text-[#07090E] shadow-[0_4px_16px_rgba(255,255,255,0.2)] scale-[1.01]'
								: 'text-white/55 hover:text-white hover:bg-white/[0.04]'
						}`}
					>
						<span class="text-sm">🚀</span>
						<span>{t('leaderboard.tabBoosts')}</span>
					</button>
				</div>

				{/* Top 3 Podium (Elite 3D Pedestal Stage) */}
				<Show
					when={!leaderboardQuery.isLoading && !leaderboardQuery.isError}
					fallback={
						<Show
							when={!leaderboardQuery.isError}
							fallback={
								<div class="h-44 flex flex-col items-center justify-center gap-3 rounded-3xl bg-[#0D101C]/60 border border-rose-500/25 backdrop-blur-sm p-4 text-center">
									<span class="material-symbols-outlined text-rose-400 text-3xl">error_outline</span>
									<span class="text-white/70 text-xs font-semibold">خطا در دریافت جدول رتبه‌بندی</span>
									<button
										type="button"
										onClick={() => leaderboardQuery.refetch()}
										class="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition active:scale-95 cursor-pointer border border-white/10"
									>
										تلاش مجدد
									</button>
								</div>
							}
						>
							<div class="h-56 flex flex-col items-center justify-center gap-3 rounded-3xl bg-[#0D101C]/50 border border-white/5 backdrop-blur-sm">
								<div class="w-7 h-7 rounded-full border-2 border-[#2AABEE] border-t-transparent animate-spin" />
								<span class="text-white/40 text-xs font-medium">{t('leaderboard.loading')}</span>
							</div>
						</Show>
					}
				>
					<Show
						when={top3().length > 0}
						fallback={
							<div class="h-44 flex flex-col items-center justify-center gap-2.5 rounded-3xl bg-[#0D101C]/50 border border-white/5 backdrop-blur-sm p-6 text-center">
								<div class="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">
									{unitIcon()}
								</div>
								<div class="flex flex-col gap-1">
									<span class="text-white text-sm font-bold">
										{activeTab() === 'messages' ? 'هنوز پیامی ثبت نشده است' : 'هنوز بوستی ثبت نشده است'}
									</span>
									<span class="text-white/40 text-xs">
										{activeTab() === 'messages'
											? 'با ارسال اولین پیام در گروه @FragmentInvestors، در این جایگاه قرار بگیرید!'
											: 'با بوست کردن گروه @FragmentInvestors، در جایگاه نخست قرار بگیرید!'}
									</span>
								</div>
							</div>
						}
					>
						<div class="relative pt-6 pb-2 px-1 flex items-end justify-center gap-2.5">
							{/* Rank 2 (Left / Silver Pedestal) */}
							<Show
								when={top3()[1]}
								fallback={
									<div class="flex-1 flex flex-col items-center max-w-[110px] z-10 opacity-30 select-none">
										<div class="relative w-20 h-20 rounded-full border-2 border-dashed border-slate-400/50 flex items-center justify-center bg-white/[0.02]">
											<span class="text-slate-300 text-lg font-bold">2</span>
										</div>
										<span class="mt-3.5 text-xs font-medium text-white/30">خالی</span>
									</div>
								}
							>
								{(second) => (
									<div class="flex-1 flex flex-col items-center max-w-[110px] z-10 group">
										<div class="relative w-20 h-20 rounded-full p-[2.5px] bg-gradient-to-b from-slate-200 via-slate-400 to-slate-600 shadow-[0_6px_20px_rgba(148,163,184,0.25)] transition-transform duration-300 group-hover:scale-105">
											<Show
												when={second().photo_url}
												fallback={
													<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-400 via-slate-500 to-slate-700 text-white font-black text-xl">
														{(second().first_name || second().username || 'U')[0].toUpperCase()}
													</div>
												}
											>
												<img
													src={buildAvatarUrl(second().photo_url || undefined)}
													alt={second().first_name || 'Silver Rank'}
													class="w-full h-full object-cover"
													onError={(e) => {
														e.currentTarget.style.display = 'none';
													}}
												/>
											</Show>
											{/* Silver Badge */}
											<div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-gradient-to-b from-slate-100 to-slate-400 text-slate-950 text-xs font-black flex items-center justify-center shadow-lg border-[2px] border-[#06080F]">
												2
											</div>
										</div>
										<span class="mt-3.5 text-xs font-bold text-white truncate max-w-full text-center tracking-tight">
											{second().first_name || second().username || 'Anonymous'}
										</span>
										<span class="text-[11px] font-black text-slate-300 flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10">
											<span>{unitIcon()}</span>
											<span>{formatScore(second().score)}</span>
										</span>
									</div>
								)}
							</Show>

							{/* Rank 1 (Center / Gold Champion Pedestal - Elevated & Radiant) */}
							<Show when={top3()[0]}>
								{(first) => (
									<div class="flex-1 flex flex-col items-center max-w-[130px] -translate-y-3 z-20 group">
										{/* Floating Crown Icon */}
										<div class="text-amber-400 text-base mb-1 filter drop-shadow-[0_2px_8px_rgba(251,191,36,0.8)] animate-bounce">
											👑
										</div>
										<div class="relative w-24 h-24 rounded-full p-[3px] bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 shadow-[0_0_30px_rgba(251,191,36,0.45)] transition-transform duration-300 group-hover:scale-105">
											<div class="w-full h-full rounded-full overflow-hidden bg-[#151926] flex items-center justify-center border border-white/20">
												<Show
													when={first().photo_url}
													fallback={
														<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 text-slate-950 font-black text-2xl">
															{(first().first_name || first().username || 'U')[0].toUpperCase()}
														</div>
													}
												>
													<img
														src={buildAvatarUrl(first().photo_url || undefined)}
														alt={first().first_name || 'Champion'}
														class="w-full h-full object-cover"
														onError={(e) => {
															e.currentTarget.style.display = 'none';
														}}
													/>
												</Show>
											</div>
											{/* Gold Badge */}
											<div class="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-500 text-slate-950 text-xs font-black flex items-center justify-center shadow-[0_4px_12px_rgba(251,191,36,0.6)] border-[2px] border-[#06080F]">
												1
											</div>
										</div>
										<span class="mt-4 text-[13px] font-black text-white truncate max-w-full text-center tracking-tight">
											{first().first_name || first().username || 'Top Investor'}
										</span>
										<span class="text-xs font-black text-amber-300 flex items-center gap-1 mt-0.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 shadow-[0_0_12px_rgba(251,191,36,0.15)]">
											<span>{unitIcon()}</span>
											<span>{formatScore(first().score)}</span>
										</span>
									</div>
								)}
							</Show>

							{/* Rank 3 (Right / Bronze Pedestal) */}
							<Show
								when={top3()[2]}
								fallback={
									<div class="flex-1 flex flex-col items-center max-w-[110px] z-10 opacity-30 select-none">
										<div class="relative w-20 h-20 rounded-full border-2 border-dashed border-amber-700/50 flex items-center justify-center bg-white/[0.02]">
											<span class="text-amber-500 text-lg font-bold">3</span>
										</div>
										<span class="mt-3.5 text-xs font-medium text-white/30">خالی</span>
									</div>
								}
							>
								{(third) => (
									<div class="flex-1 flex flex-col items-center max-w-[110px] z-10 group">
										<div class="relative w-20 h-20 rounded-full p-[2.5px] bg-gradient-to-b from-amber-600 via-amber-700 to-amber-900 shadow-[0_6px_20px_rgba(180,83,9,0.25)] transition-transform duration-300 group-hover:scale-105">
											<div class="w-full h-full rounded-full overflow-hidden bg-[#151926] flex items-center justify-center border border-white/10">
												<Show
													when={third().photo_url}
													fallback={
														<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-600 to-amber-800 text-white font-black text-xl">
															{(third().first_name || third().username || 'U')[0].toUpperCase()}
														</div>
													}
												>
													<img
														src={buildAvatarUrl(third().photo_url || undefined)}
														alt={third().first_name || 'Bronze Rank'}
														class="w-full h-full object-cover"
														onError={(e) => {
															e.currentTarget.style.display = 'none';
														}}
													/>
												</Show>
											</div>
											{/* Bronze Badge */}
											<div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-gradient-to-b from-amber-500 to-amber-800 text-white text-xs font-black flex items-center justify-center shadow-lg border-[2px] border-[#06080F]">
												3
											</div>
										</div>
										<span class="mt-3.5 text-xs font-bold text-white truncate max-w-full text-center tracking-tight">
											{third().first_name || third().username || 'Anonymous'}
										</span>
										<span class="text-[11px] font-black text-amber-400 flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10">
											<span>{unitIcon()}</span>
											<span>{formatScore(third().score)}</span>
										</span>
									</div>
								)}
							</Show>
						</div>
					</Show>
				</Show>

					{/* Ranks 4 to 7 (Micro Glass Orbit Avatars) */}
					<Show when={featured().length > 0}>
						<div class="grid grid-cols-4 gap-2 pt-2 pb-1 px-1">
							<For each={featured()}>
								{(item) => (
									<div class="flex flex-col items-center p-2 rounded-2xl bg-[#0D101C]/60 border border-white/[0.06] backdrop-blur-md transition-all duration-200 hover:border-white/20 hover:scale-102">
										<div class="relative w-12 h-12 rounded-full p-[1.5px] bg-gradient-to-b from-white/20 to-white/5 shadow-sm">
											<div class="w-full h-full rounded-full overflow-hidden bg-[#151926] flex items-center justify-center">
												<Show
													when={item.photo_url}
													fallback={
														<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2AABEE]/40 to-indigo-600/40 text-white text-xs font-bold">
															{(item.first_name || item.username || 'U')[0].toUpperCase()}
														</div>
													}
												>
													<img
														src={buildAvatarUrl(item.photo_url || undefined)}
														alt={item.first_name || 'User'}
														class="w-full h-full object-cover"
														onError={(e) => {
															e.currentTarget.style.display = 'none';
														}}
													/>
												</Show>
											</div>
											<div class="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 min-w-[18px] h-4.5 rounded-full bg-white text-[#07090E] text-[10px] font-black flex items-center justify-center shadow-md">
												{item.rank}
											</div>
										</div>
										<span class="mt-2 text-[11px] font-bold text-white truncate max-w-full text-center">
											{item.first_name || item.username || 'User'}
										</span>
										<span class="text-[10px] font-semibold text-white/55 flex items-center gap-0.5 mt-0.5">
											<span>{unitIcon()}</span>
											<span>{formatScore(item.score)}</span>
										</span>
									</div>
								)}
							</For>
						</div>
					</Show>

				{/* High-Impact Animated Blue Supergroup Banner */}
				<div
					onClick={handleOpenGroup}
					class="w-full rounded-2xl p-4 bg-gradient-to-r from-[#2AABEE] via-[#1E88E5] to-[#1565C0] text-white shadow-[0_10px_30px_rgba(42,171,238,0.25)] flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all duration-200 border border-white/25 relative overflow-hidden group"
				>
					{/* Shimmer light sweep */}
					<div class="absolute -inset-full bg-gradient-to-r from-transparent via-white/15 to-transparent rotate-45 pointer-events-none group-hover:animate-pulse" />

					<div class="flex flex-col gap-1 relative z-10 min-w-0 pr-2">
						<div class="flex items-center gap-1.5">
							<span class="text-xs font-black uppercase tracking-wider text-white/80 bg-white/20 px-2 py-0.5 rounded-md backdrop-blur-sm">
								Official Chat
							</span>
							<span class="text-[11px] font-medium text-white/90 truncate">
								{t('leaderboard.groupBannerDesc')}
							</span>
						</div>
						<span class="text-[15px] font-black flex items-center gap-1.5 leading-snug">
							<span>{t('leaderboard.groupBannerTitle')}</span>
							<span class="material-symbols-outlined text-[17px] group-hover:translate-x-1 transition-transform rtl:group-hover:-translate-x-1">
								arrow_forward
							</span>
						</span>
					</div>

					<div class="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-2xl shrink-0 shadow-inner group-hover:scale-105 transition-transform">
						💬
					</div>
				</div>

				{/* User Personal Stats HUD (Modern Glass Cards with Neon Accents) */}
				<div class="grid grid-cols-2 gap-3">
					{/* Left / Credits Balance */}
					<div class="bg-[#0D101C]/80 backdrop-blur-xl rounded-2xl p-3.5 border border-white/10 flex flex-col items-center justify-center shadow-lg relative overflow-hidden group">
						<div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400/50 via-amber-300 to-amber-500/50 opacity-60" />
						<div class="flex items-center gap-1.5 text-amber-400 font-black text-xl font-mono tracking-tight drop-shadow-[0_2px_8px_rgba(251,191,36,0.3)]">
							<span class="text-base">⭐</span>
							<span>{(myStats()?.credits ?? 0).toLocaleString()}</span>
						</div>
						<span class="text-[11px] font-bold text-white/55 mt-1 text-center">
							{t('leaderboard.yourCredits')}
						</span>
					</div>

					{/* Right / Rank */}
					<div class="bg-[#0D101C]/80 backdrop-blur-xl rounded-2xl p-3.5 border border-white/10 flex flex-col items-center justify-center shadow-lg relative overflow-hidden group">
						<div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2AABEE]/50 via-[#2AABEE] to-[#2AABEE]/50 opacity-60" />
						<div class="flex items-center gap-1.5 text-[#2AABEE] font-black text-xl font-mono tracking-tight drop-shadow-[0_2px_8px_rgba(42,171,238,0.3)]">
							<span class="material-symbols-outlined text-[19px]">equalizer</span>
							<span>{myStats()?.rank_str || '100k+'}</span>
						</div>
						<span class="text-[11px] font-bold text-white/55 mt-1 text-center">
							{t('leaderboard.yourRank')}
						</span>
					</div>
				</div>

				{/* Section Header: Top 100 Leaderboard */}
				<div class="flex items-center justify-between pt-2 px-1">
					<div class="flex items-center gap-2">
						<span class="w-2 h-2 rounded-full bg-[#2AABEE] animate-ping" />
						<h2 class="text-sm font-black text-white tracking-tight">
							{t('leaderboard.topHolders')}
						</h2>
					</div>
					<span class="text-[11px] font-bold text-white/45 px-2.5 py-0.5 rounded-full bg-white/[0.05] border border-white/10">
						{activeTab() === 'messages' ? t('leaderboard.messagesUnit') : t('leaderboard.boostsUnit')}
					</span>
				</div>

				{/* Top 100 Ranked List (Rank 8 to 100 with Glassmorphism Rows) */}
				<div class="flex flex-col gap-2">
					<For
						each={items()}
						fallback={
							top3().length === 0 && (
								<div class="py-12 text-center text-white/40 text-xs rounded-2xl bg-[#0D101C]/40 border border-white/5">
									{t('leaderboard.empty')}
								</div>
							)
						}
					>
						{(entry: GroupLeaderboardEntry) => {
							const isMe = () => myStats()?.user_id === entry.user_id;
							return (
								<div
									class={`w-full py-3 px-3.5 rounded-2xl flex items-center justify-between transition-all duration-200 ${
										isMe()
											? 'bg-gradient-to-r from-[#2AABEE]/25 to-[#0055ff]/15 border border-[#2AABEE]/50 shadow-[0_4px_20px_rgba(42,171,238,0.2)] scale-[1.01]'
											: 'bg-[#0D101C]/70 hover:bg-[#0D101C] border border-white/[0.06] hover:border-white/15'
									}`}
								>
									<div class="flex items-center gap-3 min-w-0">
										<div class="w-6 text-center text-xs font-black font-mono shrink-0">
											<span class={entry.rank <= 10 ? 'text-[#2AABEE]' : 'text-white/40'}>
												{entry.rank}
											</span>
										</div>

										<div class="w-10 h-10 rounded-full overflow-hidden bg-[#151926] shrink-0 border border-white/10 shadow-sm">
											<Show
												when={entry.photo_url}
												fallback={
													<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2AABEE]/30 to-[#10b981]/30 text-white font-bold text-xs">
														{(entry.first_name || entry.username || 'U')[0].toUpperCase()}
													</div>
												}
											>
												<img
													src={buildAvatarUrl(entry.photo_url || undefined)}
													alt={entry.first_name || 'Leader'}
													class="w-full h-full object-cover"
													onError={(e) => {
														e.currentTarget.style.display = 'none';
													}}
												/>
											</Show>
										</div>

										<div class="flex flex-col min-w-0">
											<div class="flex items-center gap-1.5">
												<span class="text-xs font-black text-white truncate max-w-[150px]">
													{entry.first_name || entry.username || 'Investor'}
												</span>
												{isMe() && (
													<span class="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-[#2AABEE]/25 text-[#2AABEE] border border-[#2AABEE]/40">
														{t('leaderboard.you') || 'شما'}
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

									<div class="flex items-center gap-1.5 shrink-0 pl-1">
										<span class="text-xs font-black text-white font-mono bg-white/[0.06] px-2 py-1 rounded-xl border border-white/[0.08]">
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
		</div>
	);
};
export default LeaderboardPage;

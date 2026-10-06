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
			class="min-h-screen bg-[#07090E] text-white font-sans flex flex-col relative overflow-x-hidden selection:bg-[#3390ec]/30 pb-28"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Gradient Glows (Major Aesthetic) */}
			<div class="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-72 bg-gradient-to-b from-[#3390ec]/20 via-[#0077ff]/5 to-transparent blur-3xl pointer-events-none z-0" />

			<div class="w-full max-w-md mx-auto px-4 pt-3 relative z-10 flex flex-col gap-4">
				{/* Top App Bar with Title & Verified Badge */}
				<header class="flex items-center justify-between py-1">
					<div class="flex items-center gap-2">
						<h1 class="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
							<span>{t('leaderboard.title')}</span>
							<svg class="w-5 h-5 text-[#2AABEE] shrink-0" viewBox="0 0 24 24" fill="currentColor">
								<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
							</svg>
						</h1>
					</div>

					<button
						type="button"
						onClick={handleOpenGroup}
						class="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/15 text-[#2AABEE] border border-[#2AABEE]/30 transition-all flex items-center gap-1 cursor-pointer"
					>
						<span>@FragmentInvestors</span>
						<span class="material-symbols-outlined text-[14px]">open_in_new</span>
					</button>
				</header>

				{/* Major Style Segmented Switcher */}
				<div class="w-full bg-[#131622] p-1 rounded-2xl flex items-center border border-white/10 shadow-inner">
					<button
						type="button"
						onClick={() => {
							haptic.selection();
							setActiveTab('messages');
						}}
						class={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
							activeTab() === 'messages'
								? 'bg-white text-black shadow-md font-black scale-100'
								: 'text-white/60 hover:text-white'
						}`}
					>
						<span>💬</span>
						<span>{t('leaderboard.tabMessages')}</span>
					</button>

					<button
						type="button"
						onClick={() => {
							haptic.selection();
							setActiveTab('boosts');
						}}
						class={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
							activeTab() === 'boosts'
								? 'bg-white text-black shadow-md font-black scale-100'
								: 'text-white/60 hover:text-white'
						}`}
					>
						<span>🚀</span>
						<span>{t('leaderboard.tabBoosts')}</span>
					</button>
				</div>

				{/* Top 3 Podium (Major Style) */}
				<Show
					when={!leaderboardQuery.isLoading && top3().length > 0}
					fallback={
						<div class="h-48 flex items-center justify-center text-white/40 text-xs">
							{t('leaderboard.loading')}
						</div>
					}
				>
					<div class="relative pt-4 pb-2 px-2 flex items-end justify-center gap-3">
						{/* Rank 2 (Left / Silver) */}
						<Show when={top3()[1]}>
							{(second) => (
								<div class="flex-1 flex flex-col items-center max-w-[105px]">
									<div class="relative w-18 h-18 rounded-full p-0.5 bg-gradient-to-b from-slate-300 to-slate-500 shadow-lg">
										<div class="w-full h-full rounded-full overflow-hidden bg-[#1E2333] flex items-center justify-center">
											<Show
												when={second().photo_url}
												fallback={
													<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-400 to-slate-600 text-white font-black text-lg">
														{(second().first_name || second().username || 'U')[0].toUpperCase()}
													</div>
												}
											>
												<img
													src={buildAvatarUrl(second().photo_url)}
													alt={second().first_name}
													class="w-full h-full object-cover"
													onError={(e) => {
														e.currentTarget.style.display = 'none';
													}}
												/>
											</Show>
										</div>
										<div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900 text-xs font-black flex items-center justify-center shadow-md border-2 border-[#07090E]">
											2
										</div>
									</div>
									<span class="mt-3 text-xs font-bold text-white truncate max-w-full text-center">
										{second().first_name || second().username || 'Anonymous'}
									</span>
									<span class="text-[11px] font-extrabold text-slate-300 flex items-center gap-1 mt-0.5">
										<span>{unitIcon()}</span>
										<span>{formatScore(second().score)}</span>
									</span>
								</div>
							)}
						</Show>

						{/* Rank 1 (Center / Gold - Taller & Larger) */}
						<Show when={top3()[0]}>
							{(first) => (
								<div class="flex-1 flex flex-col items-center max-w-[125px] -translate-y-2">
									<div class="relative w-22 h-22 rounded-full p-1 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 shadow-[0_0_24px_rgba(251,191,36,0.35)]">
										<div class="w-full h-full rounded-full overflow-hidden bg-[#1E2333] flex items-center justify-center">
											<Show
												when={first().photo_url}
												fallback={
													<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-2xl">
														{(first().first_name || first().username || 'U')[0].toUpperCase()}
													</div>
												}
											>
												<img
													src={buildAvatarUrl(first().photo_url)}
													alt={first().first_name}
													class="w-full h-full object-cover"
													onError={(e) => {
														e.currentTarget.style.display = 'none';
													}}
												/>
											</Show>
										</div>
										<div class="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 text-xs font-black flex items-center justify-center shadow-lg border-2 border-[#07090E]">
											1
										</div>
									</div>
									<span class="mt-3.5 text-sm font-black text-white truncate max-w-full text-center">
										{first().first_name || first().username || 'Top Investor'}
									</span>
									<span class="text-xs font-black text-amber-300 flex items-center gap-1 mt-0.5">
										<span>{unitIcon()}</span>
										<span>{formatScore(first().score)}</span>
									</span>
								</div>
							)}
						</Show>

						{/* Rank 3 (Right / Bronze) */}
						<Show when={top3()[2]}>
							{(third) => (
								<div class="flex-1 flex flex-col items-center max-w-[105px]">
									<div class="relative w-18 h-18 rounded-full p-0.5 bg-gradient-to-b from-amber-600 to-amber-800 shadow-lg">
										<div class="w-full h-full rounded-full overflow-hidden bg-[#1E2333] flex items-center justify-center">
											<Show
												when={third().photo_url}
												fallback={
													<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-600 to-amber-800 text-white font-black text-lg">
														{(third().first_name || third().username || 'U')[0].toUpperCase()}
													</div>
												}
											>
												<img
													src={buildAvatarUrl(third().photo_url)}
													alt={third().first_name}
													class="w-full h-full object-cover"
													onError={(e) => {
														e.currentTarget.style.display = 'none';
													}}
												/>
											</Show>
										</div>
										<div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 text-white text-xs font-black flex items-center justify-center shadow-md border-2 border-[#07090E]">
											3
										</div>
									</div>
									<span class="mt-3 text-xs font-bold text-white truncate max-w-full text-center">
										{third().first_name || third().username || 'Anonymous'}
									</span>
									<span class="text-[11px] font-extrabold text-amber-400 flex items-center gap-1 mt-0.5">
										<span>{unitIcon()}</span>
										<span>{formatScore(third().score)}</span>
									</span>
								</div>
							)}
						</Show>
					</div>

					{/* Ranks 4 to 7 (Micro-Circle Row from screenshot) */}
					<Show when={featured().length > 0}>
						<div class="grid grid-cols-4 gap-2 pt-1 pb-2 px-1">
							<For each={featured()}>
								{(item) => (
									<div class="flex flex-col items-center">
										<div class="relative w-13 h-13 rounded-full p-0.5 bg-white/10 border border-white/15">
											<div class="w-full h-full rounded-full overflow-hidden bg-[#1E2333] flex items-center justify-center">
												<Show
													when={item.photo_url}
													fallback={
														<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500/50 to-indigo-600/50 text-white text-xs font-bold">
															{(item.first_name || item.username || 'U')[0].toUpperCase()}
														</div>
													}
												>
													<img
														src={buildAvatarUrl(item.photo_url)}
														alt={item.first_name}
														class="w-full h-full object-cover"
														onError={(e) => {
															e.currentTarget.style.display = 'none';
														}}
													/>
												</Show>
											</div>
											<div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4.5 h-4.5 rounded-full bg-white text-black text-[10px] font-black flex items-center justify-center shadow-sm">
												{item.rank}
											</div>
										</div>
										<span class="mt-2 text-[11px] font-bold text-white truncate max-w-full text-center">
											{item.first_name || item.username || 'User'}
										</span>
										<span class="text-[10px] font-medium text-white/60 flex items-center gap-0.5">
											<span>{unitIcon()}</span>
											<span>{formatScore(item.score)}</span>
										</span>
									</div>
								)}
							</For>
						</div>
					</Show>
				</Show>

				{/* Major Style Blue Promo Banner */}
				<div
					onClick={handleOpenGroup}
					class="w-full rounded-2xl p-3.5 bg-gradient-to-r from-[#2AABEE] to-[#1E88E5] text-white shadow-lg shadow-[#2AABEE]/20 flex items-center justify-between cursor-pointer active:scale-98 transition-all border border-white/20"
				>
					<div class="flex flex-col gap-0.5">
						<span class="text-[11px] font-bold text-white/90">
							{t('leaderboard.groupBannerDesc')}
						</span>
						<span class="text-sm font-black flex items-center gap-1">
							<span>{t('leaderboard.groupBannerTitle')}</span>
							<span class="material-symbols-outlined text-[16px]">arrow_forward</span>
						</span>
					</div>

					<div class="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shrink-0">
						💬
					</div>
				</div>

				{/* User Personal Stats Card (Two Rounded Pills Side-by-Side) */}
				<div class="grid grid-cols-2 gap-3">
					{/* Left / Credits Balance */}
					<div class="bg-[#131622] rounded-2xl p-3 border border-white/10 flex flex-col items-center justify-center shadow-sm">
						<div class="flex items-center gap-1.5 text-amber-400 font-black text-lg">
							<span>⭐</span>
							<span>{myStats()?.credits ?? 0}</span>
						</div>
						<span class="text-[11px] font-medium text-white/60 mt-0.5">
							{t('leaderboard.yourCredits')}
						</span>
					</div>

					{/* Right / Rank */}
					<div class="bg-[#131622] rounded-2xl p-3 border border-white/10 flex flex-col items-center justify-center shadow-sm">
						<div class="flex items-center gap-1.5 text-[#2AABEE] font-black text-lg">
							<span class="material-symbols-outlined text-[18px]">bar_chart</span>
							<span>{myStats()?.rank_str || '100k+'}</span>
						</div>
						<span class="text-[11px] font-medium text-white/60 mt-0.5">
							{t('leaderboard.yourRank')}
						</span>
					</div>
				</div>

				{/* Section Header: Top Holders */}
				<div class="flex items-center justify-between pt-2">
					<h2 class="text-sm font-black text-[#2AABEE] tracking-tight">
						{t('leaderboard.topHolders')}
					</h2>
					<span class="text-[11px] font-medium text-white/40">
						{activeTab() === 'messages' ? t('leaderboard.messagesUnit') : t('leaderboard.boostsUnit')}
					</span>
				</div>

				{/* Top 100 Ranked List (Rank 8 to 100) */}
				<div class="flex flex-col gap-2">
					<For
						each={items()}
						fallback={
							top3().length === 0 && (
								<div class="py-10 text-center text-white/40 text-xs">
									{t('leaderboard.empty')}
								</div>
							)
						}
					>
						{(entry: GroupLeaderboardEntry) => {
							const isMe = () => myStats()?.user_id === entry.user_id;
							return (
								<div
									class={`w-full py-2.5 px-3.5 rounded-2xl flex items-center justify-between transition-all ${
										isMe()
											? 'bg-[#3390ec]/20 border border-[#3390ec]/40'
											: 'bg-[#131622]/80 hover:bg-[#131622] border border-white/5'
									}`}
								>
									<div class="flex items-center gap-3 min-w-0">
										<span class="w-6 text-center text-xs font-black text-white/40 shrink-0">
											{entry.rank}
										</span>

										<div class="w-9 h-9 rounded-full overflow-hidden bg-[#1E2333] shrink-0 border border-white/10">
											<Show
												when={entry.photo_url}
												fallback={
													<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#3390ec]/30 to-[#10b981]/30 text-white font-bold text-xs">
														{(entry.first_name || entry.username || 'U')[0].toUpperCase()}
													</div>
												}
											>
												<img
													src={buildAvatarUrl(entry.photo_url)}
													alt={entry.first_name}
													class="w-full h-full object-cover"
													onError={(e) => {
														e.currentTarget.style.display = 'none';
													}}
												/>
											</Show>
										</div>

										<div class="flex flex-col min-w-0">
											<span class="text-xs font-bold text-white truncate max-w-[160px]">
												{entry.first_name || entry.username || 'Investor'}
												{isMe() && <span class="text-[#2AABEE] text-[10px] ml-1">({t('leaderboard.you') || 'شما'})</span>}
											</span>
											<Show when={entry.username}>
												<span class="text-[10px] text-white/40 truncate dir-ltr text-left">
													@{entry.username}
												</span>
											</Show>
										</div>
									</div>

									<div class="flex items-center gap-1.5 shrink-0 pl-1">
										<span class="text-xs font-extrabold text-white">
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

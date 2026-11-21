import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { backButton, initData, openTelegramLink } from '@tma.js/sdk-solid';
import { type Component, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { type GroupLeaderboardEntry, getGroupLeaderboard } from '@/entities/user/index.js';
import { buildAvatarUrl } from '@/shared/api/config.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { TonIcon } from '@/shared/ui/fragment/FragmentPrimitives.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';

export const LeaderboardPage: Component = () => {
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = createSignal<'messages' | 'boosts'>('messages');
	const [selectedUser, setSelectedUser] = createSignal<GroupLeaderboardEntry | null>(null);
	const [highlightedUserId, setHighlightedUserId] = createSignal<number | null>(null);

	const currentUser = () => initData.user() as any;

	const leaderboardQuery = createQuery(() => ({
		queryKey: ['leaderboard', 'group', activeTab(), currentUser()?.id],
		queryFn: () => getGroupLeaderboard(activeTab(), currentUser()?.id),
		staleTime: 60000,
		refetchInterval: 120000,
	}));

	const data = () => leaderboardQuery.data;
	const top3 = () => data()?.top3 || [];
	const featured = () => data()?.featured || [];
	const items = () => data()?.items || [];
	const allRanked = () => [...top3(), ...featured(), ...items()];
	const myStats = () => data()?.my_stats;

	const myResolvedRank = () => {
		const uid = currentUser()?.id;
		if (uid) {
			const idx = allRanked().findIndex((e) => Number(e.user_id) === Number(uid));
			if (idx !== -1) return allRanked()[idx].rank || idx + 1;
		}
		return myStats()?.rank || 0;
	};

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
		if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
		if (val >= 1_000) return `${(val / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
		return (val || 0).toLocaleString('en-US');
	};

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

	const resolveAvatarUrl = (entry?: {
		photo_url?: string | null;
		username?: string | null;
		user_id?: number | null;
	}) => {
		if (!entry) return '';
		const p = entry.photo_url?.trim();
		if (p) return buildAvatarUrl(p);
		if (entry.user_id) return buildAvatarUrl(`/api/v1/profile/avatar/${entry.user_id}`);
		const u = entry.username?.replace('@', '').trim();
		if (u) return `https://t.me/i/userpic/320/${u}.jpg`;
		return '';
	};

	const handleAvatarError = (
		e: Event & { currentTarget: HTMLImageElement },
		entry?: { user_id?: number | null; username?: string | null },
	) => {
		if (!entry) {
			e.currentTarget.style.display = 'none';
			return;
		}
		const current = e.currentTarget.src;
		const avatarApi = entry.user_id
			? buildAvatarUrl(`/api/v1/profile/avatar/${entry.user_id}`)
			: '';
		const u = entry.username?.replace('@', '').trim();
		const telegramCdn = u ? `https://t.me/i/userpic/320/${u}.jpg` : '';

		if (avatarApi && !current.includes(`/profile/avatar/${entry.user_id}`)) {
			e.currentTarget.src = avatarApi;
		} else if (telegramCdn && !current.includes(`/userpic/320/${u}.jpg`)) {
			e.currentTarget.src = telegramCdn;
		} else {
			e.currentTarget.style.display = 'none';
		}
	};

	const handleJumpToMyRank = () => {
		const uid = currentUser()?.id || myStats()?.user_id;
		if (!uid) return;
		try {
			haptic.impact('light');
			const el = document.getElementById(`leaderboard-row-${uid}`);
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'center' });
				setHighlightedUserId(Number(uid));
				setTimeout(() => setHighlightedUserId(null), 2500);
			}
		} catch {}
	};

	return (
		<div
			class="frag-canvas min-h-screen text-white font-frag-sans flex flex-col relative overflow-x-clip pb-36"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Authentic Fragment.com Sticky Top Header (.tm-header) */}
			<header class="frag-header sticky top-0 z-40 w-full h-[52px] px-4 flex items-center justify-between gap-3">
				<button
					type="button"
					onClick={() => navigate('/')}
					class="flex items-center gap-2 text-white hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
				>
					<TonIcon size={20} color="#4db2ff" />
					<span class="text-[15px] font-bold tracking-[0.04em]" dir="ltr">
						FRAGMENT
					</span>
				</button>

				<button
					type="button"
					onClick={activeTab() === 'boosts' ? handleBoostGroup : handleOpenGroup}
					class="h-8 px-3 rounded-[6px] frag-btn-primary text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer"
				>
					<span>{activeTab() === 'boosts' ? 'Boost Group' : '@FragmentInvestors'}</span>
					<span class="material-symbols-outlined text-[14px]">north_east</span>
				</button>
			</header>

			<div class="w-full max-w-[520px] mx-auto px-4 pt-5 relative z-10 flex flex-col gap-4">
				{/* Title & My Rank Strip */}
				<div class="flex items-center justify-between gap-3 flex-wrap">
					<div>
						<div class="flex items-center gap-2">
							<h1 class="text-[20px] sm:text-[22px] font-bold tracking-[-0.015em] text-white">
								{t('leaderboard.title')}
							</h1>
							<span class="px-2 py-0.5 rounded-[4px] bg-[#ff9953]/10 text-[#ff9953] text-[11px] font-semibold">
								{t('leaderboard.top100')}
							</span>
						</div>
						<p class="text-[12.5px] text-[#8794a1] mt-0.5">
							{activeTab() === 'messages'
								? t('leaderboard.subtitleMessages')
								: t('leaderboard.subtitleBoosts')}
						</p>
					</div>

					<Show when={myResolvedRank() > 0}>
						<button
							type="button"
							onClick={handleJumpToMyRank}
							class="px-3 py-1.5 rounded-[8px] bg-[#212a33] hover:bg-[#293440] text-[12px] font-semibold text-[#4db2ff] flex items-center gap-1.5 cursor-pointer"
						>
							<span>Your Rank: #{myResolvedRank()}</span>
						</button>
					</Show>
				</div>

				{/* 2-Tab Fragment Horizontal Bar (Messages | Boosts) */}
				<div class="flex items-center border-b border-[#293440] gap-6 px-1">
					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							setActiveTab('messages');
						}}
						class={`relative pb-2.5 text-[13.5px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
							activeTab() === 'messages' ? 'text-white' : 'text-[#8c9aa9] hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-[16px]">chat_bubble</span>
						<span>{t('leaderboard.tabMessages')}</span>
						<Show when={activeTab() === 'messages'}>
							<span class="absolute inset-x-0 bottom-0 h-[3px] bg-[#248bda] rounded-t-[3px]" />
						</Show>
					</button>

					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							setActiveTab('boosts');
						}}
						class={`relative pb-2.5 text-[13.5px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
							activeTab() === 'boosts' ? 'text-white' : 'text-[#8c9aa9] hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-[16px]">rocket_launch</span>
						<span>{t('leaderboard.tabBoosts')}</span>
						<Show when={activeTab() === 'boosts'}>
							<span class="absolute inset-x-0 bottom-0 h-[3px] bg-[#248bda] rounded-t-[3px]" />
						</Show>
					</button>
				</div>

				{/* Loading / Error / Table */}
				<Show
					when={!leaderboardQuery.isLoading && !leaderboardQuery.isError}
					fallback={
						<Show
							when={!leaderboardQuery.isError}
							fallback={
								<div class="frag-card p-6 text-center flex flex-col items-center gap-3">
									<span class="material-symbols-outlined text-[#ff5863] text-[28px]">
										error_outline
									</span>
									<span class="text-[#8794a1] text-[13px]">{t('leaderboard.loadError')}</span>
									<button
										type="button"
										onClick={() => leaderboardQuery.refetch()}
										class="frag-btn-secondary h-9 px-4 text-[12.5px] font-semibold"
									>
										{t('leaderboard.retry')}
									</button>
								</div>
							}
						>
							<div class="space-y-2">
								<div class="h-14 rounded-[8px] bg-[#212a33] animate-pulse" />
								<div class="h-14 rounded-[8px] bg-[#212a33] animate-pulse" />
								<div class="h-14 rounded-[8px] bg-[#212a33] animate-pulse" />
							</div>
						</Show>
					}
				>
					<Show
						when={allRanked().length > 0}
						fallback={
							<div class="frag-card p-8 text-center flex flex-col items-center gap-2.5">
								<span class="material-symbols-outlined text-[28px] text-[#4db2ff]">
									{activeTab() === 'messages' ? 'chat_bubble' : 'rocket_launch'}
								</span>
								<p class="text-[13px] text-[#8794a1]">{t('leaderboard.emptyState')}</p>
							</div>
						}
					>
						{/* Authentic Fragment.com Data Table (.tm-table) */}
						<div class="frag-table-container">
							<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
								<span class="col-span-2">Rank</span>
								<span class="col-span-7">Member</span>
								<span class="col-span-3 text-end">
									{activeTab() === 'messages' ? 'Messages' : 'Boosts'}
								</span>
							</div>

							<For each={allRanked()}>
								{(entry, idx) => {
									const rank = () => entry.rank || idx() + 1;
									const isMe = () =>
										Boolean(
											currentUser()?.id && Number(entry.user_id) === Number(currentUser()?.id),
										);
									const isHighlighted = () => Number(entry.user_id) === highlightedUserId();
									const score = () => entry.score || 0;

									return (
										<button
											type="button"
											id={`leaderboard-row-${entry.user_id}`}
											onClick={() => setSelectedUser(entry)}
											class={`frag-table-row w-full grid grid-cols-12 items-center px-3.5 py-2.5 text-start cursor-pointer ${
												isMe() || isHighlighted() ? 'bg-[#293440]' : ''
											}`}
										>
											<div class="col-span-2 flex items-center">
												<span
													class={`font-mono text-[13px] font-semibold px-1.5 py-0.5 rounded-[4px] ${
														rank() === 1
															? 'bg-[#ff9953]/15 text-[#ff9953]'
															: rank() === 2
																? 'bg-[#a5b8cc]/15 text-[#a5b8cc]'
																: rank() === 3
																	? 'bg-[#ff9953]/10 text-[#ff9953]'
																	: 'text-[#8c9aa9]'
													}`}
												>
													#{rank()}
												</span>
											</div>

											<div class="col-span-7 flex items-center gap-2.5 min-w-0 pr-2">
												<div class="w-8 h-8 rounded-full bg-[#242e38] overflow-hidden flex items-center justify-center shrink-0 text-[12px] font-semibold text-[#4db2ff]">
													<Show
														when={resolveAvatarUrl(entry)}
														fallback={
															<span>
																{(entry.first_name || entry.username || 'U')[0]?.toUpperCase()}
															</span>
														}
													>
														<img
															src={resolveAvatarUrl(entry)}
															alt={entry.first_name || 'User'}
															class="w-full h-full object-cover"
															loading="lazy"
															referrerPolicy="no-referrer"
															onError={(e) => handleAvatarError(e, entry)}
														/>
													</Show>
												</div>
												<div class="flex flex-col min-w-0">
													<div class="flex items-center gap-1.5">
														<span class="text-[13.5px] font-semibold text-white truncate">
															{entry.first_name || entry.username || 'Member'}
														</span>
														<Show when={isMe()}>
															<span class="px-1.5 py-0.2 rounded-[4px] bg-[#4db2ff]/10 text-[#4db2ff] text-[10px] font-semibold">
																You
															</span>
														</Show>
													</div>
													<Show when={entry.username}>
														<span class="text-[11.5px] text-[#4db2ff] font-mono truncate" dir="ltr">
															@{entry.username?.replace(/^@/, '')}
														</span>
													</Show>
												</div>
											</div>

											<div class="col-span-3 text-end font-mono text-[13.5px] font-semibold text-white tabular-nums">
												{formatScore(score())}
											</div>
										</button>
									);
								}}
							</For>
						</div>
					</Show>
				</Show>
			</div>

			{/* Member Profile Quick Modal */}
			<Show when={selectedUser()}>
				{(u) => (
					<div
						class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
						onClick={() => setSelectedUser(null)}
					>
						<div
							class="bg-[#212a33] w-full max-w-sm rounded-[12px] p-5 flex flex-col items-center text-center gap-3"
							onClick={(e) => e.stopPropagation()}
						>
							<div class="w-16 h-16 rounded-full bg-[#242e38] overflow-hidden flex items-center justify-center text-[20px] font-bold text-[#4db2ff]">
								<Show
									when={resolveAvatarUrl(u())}
									fallback={
										<span>{(u().first_name || u().username || 'U')[0]?.toUpperCase()}</span>
									}
								>
									<img
										src={resolveAvatarUrl(u())}
										alt={u().first_name || 'User'}
										class="w-full h-full object-cover"
										onError={(e) => handleAvatarError(e, u())}
									/>
								</Show>
							</div>
							<div>
								<h3 class="text-[17px] font-bold text-white">
									{u().first_name || u().username || 'Member'}
								</h3>
								<Show when={u().username}>
									<p class="text-[13px] text-[#4db2ff] font-mono mt-0.5" dir="ltr">
										@{u().username?.replace(/^@/, '')}
									</p>
								</Show>
							</div>
							<div class="w-full bg-[#242e38] rounded-[8px] p-3 grid grid-cols-2 gap-2 text-center">
								<div>
									<span class="text-[11px] text-[#8c9aa9] block">Rank</span>
									<span class="text-[15px] font-bold text-white font-mono">#{u().rank || '—'}</span>
								</div>
								<div>
									<span class="text-[11px] text-[#8c9aa9] block">
										{activeTab() === 'messages' ? 'Messages' : 'Boosts'}
									</span>
									<span class="text-[15px] font-bold text-[#5aec8c] font-mono">
										{formatScore(u().score || 0)}
									</span>
								</div>
							</div>
							<button
								type="button"
								onClick={() => setSelectedUser(null)}
								class="frag-btn-primary w-full h-10 rounded-[8px] text-[13px] font-semibold cursor-pointer"
							>
								{t('common.close')}
							</button>
						</div>
					</div>
				)}
			</Show>

			<BottomNav />
		</div>
	);
};

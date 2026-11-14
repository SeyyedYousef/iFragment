import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { apiClient as api } from '@/shared/api/axios.js';
import { isRtl, locale, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { FragHandle, FragNftTile, TonAmount } from '@/shared/ui/fragment/FragmentPrimitives.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';
import { UsernameCollectionChart } from './UsernameCollectionChart.js';

interface CollectionStats {
	stat_date: string;
	items_count: string;
	owners_count: string;
	floor_price: string;
	buy_now_floor_ton?: number;
	auction_floor_ton?: number;
	total_volume: string;
	volume_30d_ton?: number;
	sales_30d_count?: number;
	avg_handles_per_owner?: number;
	active_auctions_count?: number;
	listed_for_sale_count?: number;
	source?: string;
	is_stale?: boolean;
}

interface CollectionAuction {
	item_name: string;
	price: string;
	price_ton?: number;
	status: string;
	auction_type?: string;
	ends_at?: string;
	time_left?: string;
	char_length?: number;
	tx_hash?: string;
	timestamp?: string;
	verified?: boolean;
}

interface FXRateInfo {
	ton_usd: number;
	source: string;
	observed_at: string;
	is_stale: boolean;
}

interface SourceHealth {
	name: string;
	status: string;
	observed_at: string;
}

interface LengthTierMetric {
	tier_name: string;
	length_bucket: string;
	theoretical_supply?: string;
	primary_min_bid_ton?: number;
	floor_price_ton: number;
	median_sale_30d_ton: number;
	volume_30d_ton: number;
	sales_count_30d: number;
	sell_through_pct: number;
}

interface UndervaluedAuctionItem {
	username: string;
	current_bid_ton: number;
	estimated_fair_ton: number;
	discount_pct: number;
	length: number;
	auction_type?: string;
	ends_at?: string;
	time_left?: string;
	signal: string;
	status: string;
}

interface CollectionData {
	collection_address?: string;
	stats: CollectionStats | null;
	length_tier_matrix?: LengthTierMetric[];
	undervalued_auctions?: UndervaluedAuctionItem[];
	auctions: CollectionAuction[];
	ending_soon_auctions?: CollectionAuction[];
	floor_listings?: CollectionAuction[];
	top_sales: CollectionAuction[];
	recent_activity: CollectionAuction[];
	fx?: FXRateInfo;
	sources?: SourceHealth[];
	ton_usd_rate?: number;
	status?: string;
}

interface LeaderboardItem {
	rank: number;
	handle: string;
	priceTon: number;
	priceUsd?: number;
	date: string;
	auctionType?: string;
	category: 'short' | 'crypto' | 'brand' | 'other';
	verified: boolean;
	txHash?: string;
}

type MainTab = 'overview' | 'market' | 'leaderboard';
type MarketStreamMode = 'top_bids' | 'ending_soon' | 'buy_now_floor';
type HallMode = 'all_time' | 'recent_sold';

export const CollectionInfoPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();

	const [quickHandle, setQuickHandle] = createSignal('');

	const [activeTab, setActiveTab] = createSignal<MainTab>('overview');
	const [marketStream, setMarketStream] = createSignal<MarketStreamMode>('top_bids');
	const [marketSearch, setMarketSearch] = createSignal('');
	const [marketLenFilter, setMarketLenFilter] = createSignal<'all' | '4' | '5' | '6+'>('all');

	const [hallMode, setHallMode] = createSignal<HallMode>('all_time');
	const [leaderboardFilter, setLeaderboardFilter] = createSignal<
		'all' | 'short' | 'crypto' | 'brand'
	>('all');

	const usernameQuery = createQuery(() => ({
		queryKey: ['usernameCollectionStats'],
		queryFn: async () => {
			const { data } = await api.get<CollectionData>('/usernames/collection/stats');
			return data;
		},
		staleTime: 2 * 60 * 1000,
	}));

	const tonUsdRate = createMemo<number | undefined>(() => {
		return usernameQuery.data?.fx?.ton_usd ?? usernameQuery.data?.ton_usd_rate;
	});

	const localizedTierName = (bucket: string, fallback: string) => {
		if (bucket === '4') return t('usernameCollectionPage.tier4Name');
		if (bucket === '5') return t('usernameCollectionPage.tier5Name');
		if (bucket === '6') return t('usernameCollectionPage.tier6Name');
		if (bucket === '7+') return t('usernameCollectionPage.tier7Name');
		return fallback;
	};

	const localizedStatus = (st?: string) => {
		if (!st) return t('usernameCollectionPage.statusActive');
		const low = st.toLowerCase();
		if (low.includes('ending')) return t('usernameCollectionPage.statusEndingSoon');
		if (low.includes('sale')) return t('usernameCollectionPage.statusForSale');
		if (low.includes('sold') || low.includes('confirmed'))
			return t('usernameCollectionPage.statusSold');
		return st;
	};

	const localizedTimeLeft = (raw?: string) => {
		if (!raw || locale() === 'en') return raw || '';
		return raw
			.replace(/0 seconds/gi, t('usernameCollectionPage.timeClosing'))
			.replace(/days?/gi, t('usernameCollectionPage.timeDays'))
			.replace(/hours?/gi, t('usernameCollectionPage.timeHours'))
			.replace(/minutes?/gi, t('usernameCollectionPage.timeMinutes'))
			.replace(/seconds?/gi, t('usernameCollectionPage.timeSeconds'));
	};

	const activeMarketItems = createMemo<CollectionAuction[]>(() => {
		const d = usernameQuery.data;
		if (!d) return [];
		let base: CollectionAuction[] = [];
		if (marketStream() === 'ending_soon') {
			base = d.ending_soon_auctions || d.auctions || [];
		} else if (marketStream() === 'buy_now_floor') {
			base = d.floor_listings || [];
		} else {
			base = d.auctions || [];
		}

		const q = marketSearch().trim().toLowerCase().replace(/^@/, '');
		const lf = marketLenFilter();

		return base.filter((item) => {
			const clean = item.item_name.replace(/^@/, '').toLowerCase();
			if (q && !clean.includes(q)) return false;
			const cLen = item.char_length || clean.length;
			if (lf === '4' && cLen > 4) return false;
			if (lf === '5' && cLen !== 5) return false;
			if (lf === '6+' && cLen < 6) return false;
			return true;
		});
	});

	const filteredLeaderboard = createMemo<LeaderboardItem[]>(() => {
		const sourceList =
			hallMode() === 'recent_sold'
				? usernameQuery.data?.recent_activity || []
				: usernameQuery.data?.top_sales || [];
		if (sourceList.length === 0) return [];
		const rate = tonUsdRate();

		return sourceList
			.map((item, idx) => {
				const cleanName = item.item_name.replace('@', '');
				const priceNum = item.price_ton || parseFloat(item.price.replace(/[^0-9.]/g, '')) || 0;
				let category: 'short' | 'crypto' | 'brand' | 'other' = 'other';
				if (cleanName.length <= 4) category = 'short';
				else if (/crypto|ton|btc|eth|sol|gram|coin|wallet|dex|nft|pay|bank/i.test(cleanName))
					category = 'crypto';
				else category = 'brand';

				return {
					rank: idx + 1,
					handle: cleanName,
					priceTon: priceNum,
					priceUsd: rate && rate > 0 ? priceNum * rate : undefined,
					date: item.time_left || item.ends_at || localizedStatus(item.status),
					auctionType: item.auction_type,
					category: category,
					verified: Boolean(item.tx_hash || item.verified),
					txHash: item.tx_hash,
				};
			})
			.filter((item) => {
				const filter = leaderboardFilter();
				if (filter === 'all') return true;
				return item.category === filter;
			});
	});

	const openValuation = (handle: string) => {
		try {
			haptic.impact('light');
		} catch {}
		const clean = handle.trim().replace(/^@/, '');
		if (!clean) return;
		navigate(`/username/report?u=${encodeURIComponent(clean)}`);
	};

	const fmtCompactTon = (val?: number) => {
		if (val === undefined || val === null || val <= 0) return '—';
		if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M TON`;
		if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K TON`;
		return `${val.toLocaleString()} TON`;
	};

	return (
		<div
			class="min-h-screen frag-canvas text-white font-frag-sans selection:bg-[#2990FF]/30 flex flex-col relative pb-36 overflow-x-hidden"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			<div class="w-full max-w-[540px] mx-auto px-4 flex flex-col relative z-10 flex-1">
				{/* ═══════ HEADER — Fragment collection identity ═══════ */}
				<div class="flex flex-col pt-5 pb-1">
					<div class="flex items-center gap-3.5">
						<div class="w-14 h-14 rounded-[14px] shrink-0 bg-gradient-to-b from-[#3a9bff] to-[#1f6fd1] flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_18px_rgba(41,144,255,0.25)]">
							<span class="text-white text-[30px] font-semibold leading-none -mt-0.5">@</span>
						</div>
						<div class="flex flex-col min-w-0 gap-1">
							<div class="flex items-center gap-1.5">
								<h1 class="text-[22px] font-semibold tracking-[-0.025em] text-white leading-tight truncate">
									{t('action.username.collection_stats_title') || 'Telegram Usernames'}
								</h1>
								<span class="material-symbols-outlined filled-icon text-[18px] text-[#2990FF] shrink-0">
									verified
								</span>
							</div>
							<div class="flex items-center gap-1.5 flex-wrap" dir="ltr">
								<a
									href="https://tonviewer.com/EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi"
									target="_blank"
									rel="noreferrer"
									class="frag-link-chip"
								>
									{'EQCA14o1…zwnPi'}
								</a>
								<span class="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[6px] text-[11px] text-[#4cd964] bg-[#4cd964]/10 border border-[#4cd964]/20">
									<span class="w-1.5 h-1.5 rounded-full bg-[#4cd964] animate-pulse" />
									{t('usernameCollectionPage.liveOnChainBadge')}
								</span>
							</div>
						</div>
					</div>
					<p class="text-[13px] text-[#8c9ba5] leading-relaxed mt-3">
						{t('action.username.collection_stats_subtitle') ||
							'Audited TON TeleMint & Fragment liquidity, live auctions & verified records.'}
					</p>

					{/* Quick handle jump — Fragment.com style */}
					<div class="w-full mt-3.5 flex items-center gap-2">
						<div class="relative flex-1 flex items-center" dir="ltr">
							<span class="material-symbols-outlined absolute left-3 text-[17px] text-[#60707c] pointer-events-none">
								search
							</span>
							<span class="absolute left-9 text-[14px] font-medium text-[#2990FF] pointer-events-none select-none">
								@
							</span>
							<input
								type="text"
								value={quickHandle()}
								onInput={(e) =>
									setQuickHandle(e.currentTarget.value.replace(/^@/, '').toLowerCase().trim())
								}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && quickHandle().length >= 4) openValuation(quickHandle());
								}}
								placeholder={t('usernameCollectionPage.searchInputPlaceholder')}
								class="w-full h-10 bg-[#141a22] border border-white/[0.08] focus:border-[#2990FF]/70 rounded-[10px] pl-[54px] pr-3 text-white text-[13px] font-medium placeholder:text-[#60707c] focus:outline-none focus:ring-2 focus:ring-[#2990FF]/15 transition-all"
								autocomplete="off"
								autocapitalize="off"
								spellcheck={false}
							/>
						</div>
						<Show when={quickHandle().length >= 4}>
							<button
								type="button"
								onClick={() => openValuation(quickHandle())}
								class="h-10 px-3.5 rounded-[10px] bg-[#2990FF] hover:bg-[#3d9bff] text-white text-[13px] font-semibold shrink-0 transition-colors"
							>
								{t('usernameCollectionPage.appraiseBtn')}
							</button>
						</Show>
					</div>

					{/* Underline tabs */}
					<div class="grid grid-cols-3 mt-4 border-b border-white/[0.07]">
						{(
							[
								{ id: 'overview', label: t('usernameCollectionPage.tabOverview') },
								{ id: 'market', label: t('usernameCollectionPage.tabMarket') },
								{ id: 'leaderboard', label: t('usernameCollectionPage.tabHall') },
							] as const
						).map((tab) => (
							<button
								type="button"
								onClick={() => {
									try {
										haptic.selection();
									} catch {}
									setActiveTab(tab.id);
								}}
								class={`relative h-11 text-[13px] font-medium truncate px-1 transition-colors ${
									activeTab() === tab.id ? 'text-white' : 'text-[#8c9ba5] hover:text-white'
								}`}
							>
								{tab.label}
								<span
									class={`absolute bottom-[-1px] left-1/2 -translate-x-1/2 h-[2px] rounded-full bg-[#2990FF] transition-all duration-200 ${
										activeTab() === tab.id ? 'w-[60%] opacity-100' : 'w-0 opacity-0'
									}`}
								/>
							</button>
						))}
					</div>
				</div>

				{/* ═══════ LOADING STATE ═══════ */}
				<Show when={usernameQuery.isLoading}>
					<div class="flex flex-col items-center justify-center h-[40vh]">
						<div class="w-12 h-12 border-[3px] border-white/[0.08] border-t-[#2990FF] rounded-full animate-spin mb-4" />
						<span class="text-[12px] font-mono font-bold text-[#8c9ba5] animate-pulse">
							{t('collectionInfo.syncingOnChain')}
						</span>
					</div>
				</Show>

				{/* ═══════════════════════════════════════════════════════════════════
				    TAB 1: OVERVIEW (REAL MACRO KPIs, CHART, LENGTH TIERS & ALPHA RADAR)
				    ═══════════════════════════════════════════════════════════════════ */}
				<Show when={activeTab() === 'overview' && !usernameQuery.isLoading}>
					<div class="flex flex-col gap-4 mt-3">
						{/* Collection stats — one Fragment card, hairline-divided cells */}
						<div class="frag-card grid grid-cols-2 overflow-hidden">
							<div class="p-3.5 flex flex-col gap-2 border-b border-e border-white/[0.06] min-w-0">
								<span class="text-[12px] text-[#8c9ba5]">
									{t('usernameCollectionPage.buyNowFloor')}
								</span>
								<TonAmount
									size="lg"
									value={(
										usernameQuery.data?.stats?.buy_now_floor_ton ||
										parseFloat(
											usernameQuery.data?.stats?.floor_price?.replace(/[^0-9.]/g, '') || '6',
										)
									).toLocaleString()}
									usd={
										tonUsdRate() && tonUsdRate()! > 0
											? (
													(usernameQuery.data?.stats?.buy_now_floor_ton ||
														parseFloat(
															usernameQuery.data?.stats?.floor_price?.replace(/[^0-9.]/g, '') ||
																'6',
														)) * tonUsdRate()!
												).toFixed(1)
											: null
									}
								/>
								<span class="text-[11px] text-[#60707c] flex items-center gap-1 mt-auto">
									{t('usernameCollectionPage.auctionFloor')}
									<span class="font-mono text-[#ffb340] tabular-nums" dir="ltr">
										{usernameQuery.data?.stats?.auction_floor_ton || 2}
									</span>
								</span>
							</div>

							<div class="p-3.5 flex flex-col gap-2 border-b border-white/[0.06] min-w-0">
								<span class="text-[12px] text-[#8c9ba5]">{t('collectionInfo.totalVolume')}</span>
								<TonAmount
									size="lg"
									value={
										usernameQuery.data?.stats?.total_volume?.replace('TON', '').trim() || '124.0M'
									}
								/>
								<span class="text-[11px] text-[#60707c] flex items-center gap-1 mt-auto">
									{t('usernameCollectionPage.vol30d')}
									<span class="font-mono text-white/80 tabular-nums" dir="ltr">
										{fmtCompactTon(usernameQuery.data?.stats?.volume_30d_ton)}
									</span>
								</span>
							</div>

							<div class="p-3.5 flex flex-col gap-2 border-e border-white/[0.06] min-w-0">
								<span class="text-[12px] text-[#8c9ba5]">{t('collectionInfo.mintedHandles')}</span>
								<span
									class="text-[20px] font-mono font-semibold text-white tabular-nums tracking-[-0.02em] leading-none"
									dir="ltr"
								>
									{usernameQuery.data?.stats?.items_count || '582.8K'}
								</span>
								<span class="text-[11px] text-[#60707c] flex items-center gap-1 mt-auto">
									{t('usernameCollectionPage.sales30d')}
									<span class="font-mono text-white/80 tabular-nums">
										{(usernameQuery.data?.stats?.sales_30d_count || 0).toLocaleString()}
									</span>
								</span>
							</div>

							<div class="p-3.5 flex flex-col gap-2 min-w-0">
								<span class="text-[12px] text-[#8c9ba5]">{t('collectionInfo.totalOwners')}</span>
								<span
									class="text-[20px] font-mono font-semibold text-white tabular-nums tracking-[-0.02em] leading-none"
									dir="ltr"
								>
									{usernameQuery.data?.stats?.owners_count || '164.6K'}
								</span>
								<span class="text-[11px] text-[#60707c] flex items-center gap-1 mt-auto">
									{t('usernameCollectionPage.avgPerOwner')}
									<span class="font-mono text-white/80 tabular-nums" dir="ltr">
										{usernameQuery.data?.stats?.avg_handles_per_owner || 3.54}×
									</span>
								</span>
							</div>
						</div>

						{/* INTERACTIVE FLOOR / MEDIAN / VOLUME HISTORY CHART */}
						<UsernameCollectionChart
							currentFloorTon={
								usernameQuery.data?.stats?.buy_now_floor_ton ||
								(usernameQuery.data?.stats?.floor_price
									? parseFloat(usernameQuery.data.stats.floor_price.replace(/[^0-9.]/g, '') || '6')
									: undefined)
							}
							totalVolumeTon={usernameQuery.data?.stats?.total_volume}
							tonUsdRate={tonUsdRate()}
						/>

						{/* Length tiers — order-book style table */}
						<Show when={(usernameQuery.data?.length_tier_matrix?.length ?? 0) > 0}>
							<div class="flex flex-col gap-2">
								<div class="flex items-baseline justify-between px-0.5">
									<h3 class="text-[14px] font-semibold text-white tracking-[-0.01em]">
										{t('usernameCollectionPage.tierMatrixTitle')}
									</h3>
									<span class="text-[12px] text-[#60707c]">
										{t('usernameCollectionPage.tierMatrixBadge')}
									</span>
								</div>
								<div class="frag-table-container">
									<div class="frag-table-header grid grid-cols-[1.3fr_1fr_1fr] gap-2 px-3.5 py-2">
										<span>{t('usernameCollectionPage.tierCol')}</span>
										<span class="text-end">{t('usernameCollectionPage.floor30dLabel')}</span>
										<span class="text-end">{t('usernameCollectionPage.median30dLabel')}</span>
									</div>
									<For each={usernameQuery.data?.length_tier_matrix || []}>
										{(tier) => (
											<div class="frag-table-row grid grid-cols-[1.3fr_1fr_1fr] gap-2 items-center px-3.5 py-3">
												<div class="flex flex-col gap-1.5 min-w-0">
													<span class="text-[13px] font-medium text-white truncate">
														{localizedTierName(tier.length_bucket, tier.tier_name)}
													</span>
													<div class="flex items-center gap-2" dir="ltr">
														<div class="flex-1 h-[3px] rounded-full bg-white/[0.07] overflow-hidden">
															<div
																class="h-full rounded-full bg-[#2990FF]"
																style={{ width: `${Math.min(100, tier.sell_through_pct)}%` }}
															/>
														</div>
														<span class="text-[11px] font-mono text-[#8c9ba5] tabular-nums shrink-0">
															{tier.sell_through_pct}%
														</span>
													</div>
													<Show when={tier.primary_min_bid_ton || tier.sales_count_30d > 0}>
														<span class="text-[11px] text-[#60707c] truncate" dir="ltr">
															<Show when={tier.primary_min_bid_ton}>
																{t('usernameCollectionPage.primaryMinBid')}{' '}
																{tier.primary_min_bid_ton}
															</Show>
															<Show when={tier.primary_min_bid_ton && tier.sales_count_30d > 0}>
																{' '}
																·{' '}
															</Show>
															<Show when={tier.sales_count_30d > 0}>
																{tier.sales_count_30d} {t('usernameCollectionPage.sales30dShort')}
															</Show>
														</span>
													</Show>
												</div>
												<div class="flex justify-end">
													<TonAmount size="sm" value={tier.floor_price_ton.toLocaleString()} />
												</div>
												<div class="flex justify-end">
													<TonAmount
														size="sm"
														tone="positive"
														value={tier.median_sale_30d_ton.toLocaleString()}
													/>
												</div>
											</div>
										)}
									</For>
								</div>
							</div>
						</Show>

						{/* AVM v8.0 undervalued auctions */}
						<Show when={(usernameQuery.data?.undervalued_auctions?.length ?? 0) > 0}>
							<div class="flex flex-col gap-2">
								<div class="flex items-baseline justify-between px-0.5">
									<h3 class="text-[14px] font-semibold text-white tracking-[-0.01em]">
										{t('usernameCollectionPage.undervaluedTitle')}
									</h3>
									<span class="text-[12px] text-[#4cd964]">
										{t('usernameCollectionPage.liveAlphaBadge')}
									</span>
								</div>
								<div class="frag-table-container">
									<For each={(usernameQuery.data?.undervalued_auctions || []).slice(0, 6)}>
										{(item) => {
											const h = item.username.replace('@', '');
											return (
												<button
													type="button"
													onClick={() => openValuation(item.username)}
													class="frag-table-row w-full flex items-center justify-between gap-3 px-3.5 py-3 text-start"
												>
													<div class="flex items-center gap-3 min-w-0">
														<FragNftTile
															handle={h}
															class="w-10 h-10 shrink-0"
															rounded="rounded-[8px]"
														/>
														<div class="flex flex-col min-w-0 gap-1">
															<div class="flex items-center gap-1.5 min-w-0">
																<FragHandle handle={h} size="sm" />
																<span
																	class="text-[11px] font-mono text-[#4cd964] tabular-nums shrink-0"
																	dir="ltr"
																>
																	−{item.discount_pct}%
																</span>
															</div>
															<span class="text-[11px] text-[#8c9ba5] truncate">
																{t('usernameCollectionPage.fairValue')}{' '}
																<span class="font-mono text-white/80" dir="ltr">
																	{item.estimated_fair_ton.toLocaleString()}
																</span>
																<Show when={item.auction_type}>
																	{' · '}
																	{item.auction_type === 'Primary Mint'
																		? t('usernameCollectionPage.primaryMintBadge')
																		: t('usernameCollectionPage.resaleBadge')}
																</Show>
															</span>
														</div>
													</div>
													<div class="flex flex-col items-end gap-1 shrink-0">
														<TonAmount size="md" value={item.current_bid_ton.toLocaleString()} />
														<Show
															when={item.time_left}
															fallback={
																<span class="text-[11px] text-[#60707c]">
																	{t('usernameCollectionPage.currentBid')}
																</span>
															}
														>
															<span class="text-[11px] font-mono text-[#ffb340] tabular-nums">
																{localizedTimeLeft(item.time_left)}
															</span>
														</Show>
													</div>
												</button>
											);
										}}
									</For>
								</div>
							</div>
						</Show>
					</div>
				</Show>

				{/* ═══════════════════════════════════════════════════════════════════
				    TAB 2: LIVE AUCTIONS, SNIPER COUNTDOWN & BUY-NOW FLOOR
				    ═══════════════════════════════════════════════════════════════════ */}
				<Show when={activeTab() === 'market' && !usernameQuery.isLoading}>
					<div class="flex flex-col gap-3.5 mt-3">
						{/* Stream Sub-Mode Switcher */}
						<div class="grid grid-cols-3 gap-1 bg-[#141a22] p-1 rounded-[10px] border border-white/[0.06]">
							<button
								type="button"
								onClick={() => {
									setMarketStream('top_bids');
									try {
										haptic.selection();
									} catch {}
								}}
								class={`py-2 px-2 rounded-[7px] text-[12px] font-medium transition-all flex items-center justify-center gap-1 ${
									marketStream() === 'top_bids'
										? 'bg-[#232d3a] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
										: 'text-[#8c9ba5] hover:text-white'
								}`}
							>
								<span class="material-symbols-outlined text-[14px]">local_fire_department</span>
								<span class="truncate">{t('usernameCollectionPage.topBidsStream')}</span>
							</button>

							<button
								type="button"
								onClick={() => {
									setMarketStream('ending_soon');
									try {
										haptic.selection();
									} catch {}
								}}
								class={`py-2 px-2 rounded-[7px] text-[12px] font-medium transition-all flex items-center justify-center gap-1 ${
									marketStream() === 'ending_soon'
										? 'bg-[#232d3a] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
										: 'text-[#8c9ba5] hover:text-white'
								}`}
							>
								<span class="material-symbols-outlined text-[14px]">timer</span>
								<span class="truncate">{t('usernameCollectionPage.endingSoonStream')}</span>
							</button>

							<button
								type="button"
								onClick={() => {
									setMarketStream('buy_now_floor');
									try {
										haptic.selection();
									} catch {}
								}}
								class={`py-2 px-2 rounded-[7px] text-[12px] font-medium transition-all flex items-center justify-center gap-1 ${
									marketStream() === 'buy_now_floor'
										? 'bg-[#232d3a] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
										: 'text-[#8c9ba5] hover:text-white'
								}`}
							>
								<span class="material-symbols-outlined text-[14px]">sell</span>
								<span class="truncate">{t('usernameCollectionPage.floorListingsStream')}</span>
							</button>
						</div>

						{/* Search & Length Filter Bar */}
						<div class="flex flex-col sm:flex-row sm:items-center gap-2">
							<div class="flex-1 relative flex items-center" dir="ltr">
								<span class="material-symbols-outlined absolute left-3 text-[16px] text-[#60707c] pointer-events-none">
									search
								</span>
								<input
									type="text"
									value={marketSearch()}
									onInput={(e) => setMarketSearch(e.currentTarget.value)}
									placeholder={t('usernameCollectionPage.searchHandlesPlaceholder')}
									class="w-full h-9 bg-[#141a22] border border-white/[0.08] focus:border-[#2990FF]/70 rounded-[9px] pl-9 pr-3 text-[12px] text-white placeholder:text-[#60707c] focus:outline-none font-frag-sans"
									dir="ltr"
								/>
							</div>

							<div class="grid grid-cols-4 sm:flex items-center gap-1 bg-[#141a22] border border-white/[0.06] rounded-[9px] p-1 font-mono text-[11px]">
								{(
									[
										{ id: 'all', label: t('usernameCollectionPage.lenAll') },
										{ id: '4', label: t('usernameCollectionPage.len4') },
										{ id: '5', label: t('usernameCollectionPage.len5') },
										{ id: '6+', label: t('usernameCollectionPage.len6Plus') },
									] as const
								).map((lf) => (
									<button
										type="button"
										onClick={() => setMarketLenFilter(lf.id)}
										class={`px-2.5 py-1 rounded-[6px] font-medium transition-colors ${
											marketLenFilter() === lf.id
												? 'bg-[#232d3a] text-white'
												: 'text-[#8c9ba5] hover:text-white'
										}`}
									>
										{lf.label}
									</button>
								))}
							</div>
						</div>

						{/* Live Stream List */}
						<div class="frag-table-container">
							<div class="frag-table-header flex items-center justify-between px-3.5 py-2">
								<span>{t('usernameCollectionPage.usernameCol')}</span>
								<span>{t('usernameCollectionPage.priceBidCol')}</span>
							</div>
							<Show
								when={activeMarketItems().length > 0}
								fallback={
									<div class="p-8 text-center text-[#8c9ba5] text-xs font-mono">
										{t('usernameCollectionPage.noMatchingHandles')}
									</div>
								}
							>
								<For each={activeMarketItems()}>
									{(auc) => {
										const rate = tonUsdRate() || 0;
										const pTon =
											auc.price_ton || parseFloat(auc.price.replace(/[^0-9.]/g, '')) || 0;
										const h = auc.item_name.replace('@', '');
										return (
											<button
												type="button"
												onClick={() => openValuation(auc.item_name)}
												class="frag-table-row w-full flex items-center justify-between gap-3 px-3.5 py-3 text-start"
											>
												<div class="flex items-center gap-3 min-w-0">
													<FragNftTile
														handle={h}
														class="w-10 h-10 shrink-0"
														rounded="rounded-[8px]"
													/>
													<div class="flex flex-col min-w-0 gap-1">
														<FragHandle handle={h} size="sm" />
														<div class="flex items-center gap-1.5 text-[11px] text-[#8c9ba5] min-w-0">
															<span class="font-mono tabular-nums text-[#60707c] shrink-0">
																{auc.char_length || h.length}
																{t('usernameCollectionPage.charUnitShort')}
															</span>
															<span class="text-white/15">·</span>
															<Show
																when={auc.time_left}
																fallback={
																	<span class="truncate">{localizedStatus(auc.status)}</span>
																}
															>
																<span class="font-mono text-[#ffb340] tabular-nums truncate">
																	{localizedTimeLeft(auc.time_left)}
																</span>
															</Show>
															<Show when={auc.auction_type}>
																<span class="text-white/15">·</span>
																<span class="truncate">
																	{auc.auction_type === 'Primary Mint'
																		? t('usernameCollectionPage.primaryMintBadge')
																		: auc.auction_type === 'Fixed Price'
																			? t('usernameCollectionPage.fixedPriceBadge')
																			: t('usernameCollectionPage.resaleBadge')}
																</span>
															</Show>
														</div>
													</div>
												</div>
												<TonAmount
													size="md"
													class="items-end shrink-0"
													value={pTon > 0 ? pTon.toLocaleString() : auc.price}
													usd={
														rate > 0 && pTon > 0 ? Math.round(pTon * rate).toLocaleString() : null
													}
												/>
											</button>
										);
									}}
								</For>
							</Show>
						</div>
					</div>
				</Show>

				{/* ═══════════════════════════════════════════════════════════════════
				    TAB 3: HALL OF FAME (ALL-TIME RECORDS) & REAL-TIME SOLD TAPE
				    ═══════════════════════════════════════════════════════════════════ */}
				<Show when={activeTab() === 'leaderboard' && !usernameQuery.isLoading}>
					<div class="flex flex-col gap-3.5 mt-3">
						{/* Mode Switcher: All-Time Hall of Fame vs Live Sold Tape */}
						<div class="grid grid-cols-2 gap-1 bg-[#141a22] p-1 rounded-[10px] border border-white/[0.06]">
							<button
								type="button"
								onClick={() => {
									setHallMode('all_time');
									try {
										haptic.selection();
									} catch {}
								}}
								class={`py-2 rounded-[7px] text-[12px] font-medium transition-all flex items-center justify-center gap-1.5 ${
									hallMode() === 'all_time'
										? 'bg-[#232d3a] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
										: 'text-[#8c9ba5] hover:text-white'
								}`}
							>
								<span class="material-symbols-outlined text-[15px]">trophy</span>
								<span>{t('usernameCollectionPage.allTimeRecordsTab')}</span>
							</button>

							<button
								type="button"
								onClick={() => {
									setHallMode('recent_sold');
									try {
										haptic.selection();
									} catch {}
								}}
								class={`py-2 rounded-[7px] text-[12px] font-medium transition-all flex items-center justify-center gap-1.5 ${
									hallMode() === 'recent_sold'
										? 'bg-[#232d3a] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
										: 'text-[#8c9ba5] hover:text-white'
								}`}
							>
								<span class="material-symbols-outlined text-[15px]">bolt</span>
								<span>{t('usernameCollectionPage.recentSoldTapeTab')}</span>
							</button>
						</div>

						{/* Category Filter Chips (4-Language Localized) */}
						<div class="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
							<For
								each={[
									{ id: 'all', label: t('usernameCollectionPage.filterAll') },
									{ id: 'short', label: t('usernameCollectionPage.filterShort') },
									{ id: 'crypto', label: t('usernameCollectionPage.filterCrypto') },
									{ id: 'brand', label: t('usernameCollectionPage.filterBrand') },
								]}
							>
								{(chip) => (
									<button
										type="button"
										onClick={() => {
											try {
												haptic.selection();
											} catch {}
											setLeaderboardFilter(chip.id as 'all' | 'short' | 'crypto' | 'brand');
										}}
										class={`px-3.5 py-1.5 rounded-[8px] text-[11px] font-semibold whitespace-nowrap transition-all border ${
											leaderboardFilter() === chip.id
												? 'bg-[#232d3a] text-white border-white/[0.14]'
												: 'bg-[#1b232d] text-white/60 border-white/[0.08] hover:border-white/20'
										}`}
									>
										{chip.label}
									</button>
								)}
							</For>
						</div>

						{/* Records List */}
						<div class="frag-table-container">
							<div class="frag-table-header flex items-center justify-between px-3.5 py-2">
								<span>{t('usernameCollectionPage.rankUsernameCol')}</span>
								<span>{t('usernameCollectionPage.salePriceCol')}</span>
							</div>
							<Show
								when={filteredLeaderboard().length > 0}
								fallback={
									<div class="p-8 text-center text-[#8c9ba5] text-xs">
										{t('collectionInfo.noLeaderboardData') ||
											t('usernameCollectionPage.noMatchingHandles')}
									</div>
								}
							>
								<For each={filteredLeaderboard()}>
									{(item) => (
										<button
											type="button"
											onClick={() => openValuation(item.handle)}
											class="frag-table-row w-full flex items-center justify-between gap-3 px-3.5 py-3 text-start"
										>
											<div class="flex items-center gap-3 min-w-0">
												<span
													class={`w-6 text-center font-mono text-[12px] tabular-nums shrink-0 ${
														item.rank === 1
															? 'text-[#ffcc4d] font-semibold'
															: item.rank === 2
																? 'text-[#c9d3da] font-semibold'
																: item.rank === 3
																	? 'text-[#d9925b] font-semibold'
																	: 'text-[#60707c]'
													}`}
												>
													{item.rank}
												</span>
												<FragNftTile
													handle={item.handle}
													class="w-10 h-10 shrink-0"
													rounded="rounded-[8px]"
												/>
												<div class="flex flex-col min-w-0 gap-1">
													<div class="flex items-center gap-1 min-w-0">
														<FragHandle handle={item.handle} size="sm" />
														<Show when={item.verified}>
															<span
																class="material-symbols-outlined filled-icon text-[#2990FF] text-[14px] shrink-0"
																title={t('usernameCollectionPage.settledBadge')}
															>
																verified
															</span>
														</Show>
													</div>
													<span class="text-[11px] text-[#60707c] font-mono truncate">
														{item.date}
														<Show when={item.auctionType}>
															{' · '}
															{item.auctionType === 'Primary Mint'
																? t('usernameCollectionPage.primaryMintBadge')
																: item.auctionType === 'Secondary Resale'
																	? t('usernameCollectionPage.resaleBadge')
																	: t('usernameCollectionPage.settledBadge')}
														</Show>
													</span>
												</div>
											</div>
											<TonAmount
												size="md"
												class="items-end shrink-0"
												value={item.priceTon.toLocaleString()}
												usd={
													item.priceUsd && item.priceUsd > 0
														? Math.round(item.priceUsd).toLocaleString()
														: null
												}
											/>
										</button>
									)}
								</For>
							</Show>
						</div>
					</div>
				</Show>
			</div>
			<BottomNav />
		</div>
	);
};

import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { apiClient as api } from '@/shared/api/axios.js';
import { isRtl, locale, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import {
	FragHandle,
	FragStatusPill,
	normalizeFragStatus,
	TonAmount,
	TonIcon,
} from '@/shared/ui/fragment/FragmentPrimitives.js';
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
	verified?: boolean;
}

interface LengthTierMetric {
	tier_name: string;
	length_bucket: string;
	primary_min_bid_ton?: number;
	floor_price_ton: number;
	median_sale_30d_ton: number;
	volume_30d_ton: number;
	sales_count_30d: number;
}

interface UndervaluedAuctionItem {
	username: string;
	current_bid_ton: number;
	estimated_fair_ton: number;
	discount_pct: number;
	length: number;
	time_left?: string;
	status: string;
}

interface MarketPulseSignal {
	status?: string;
	value?: string;
	delta?: number;
	desc?: string;
}

interface MarketPulseMetrics {
	demand?: MarketPulseSignal;
	supply_pressure?: MarketPulseSignal;
	liquidity?: MarketPulseSignal;
	price_momentum?: MarketPulseSignal;
	volume_7d_ton?: number;
	median_sale_7d_ton?: number;
	p90_sale_7d_ton?: number;
	short_4_5_share_pct?: number;
	market_regime?: string;
}

interface SemanticCategoryMetric {
	category_key?: string;
	category_id?: string;
	category_name?: string;
	category_name_en?: string;
	category_name_fa?: string;
	volume_ton?: number;
	sales_count?: number;
	floor_ton?: number;
	median_ton?: number;
	share_pct?: number;
	top_sale_ton?: number;
	sample_handles?: string[];
}

interface WhalePortfolioSummary {
	rank?: number;
	wallet_address?: string;
	owner_address?: string;
	alias?: string;
	role_label?: string;
	handles_count?: number;
	handles_owned?: number;
	total_ton_deployed?: number;
	portfolio_value_ton?: number;
	sample_handles?: string[];
	top_handles?: string[];
	last_active_iso?: string;
}

interface OnChainEvent {
	event_id?: string;
	tx_hash?: string;
	lt?: string | number;
	time_iso?: string;
	action_type?: string;
	opcode?: string;
	opcode_hex?: string;
	opcode_label?: string;
	opcode_name?: string;
	username?: string;
	nft_address?: string;
	actor_address?: string;
	amount_ton?: number;
	code_hash?: string;
	data_hash?: string;
	cell_boc_preview?: string;
}

interface LiveTVMSnapshot {
	username?: string;
	nft_address?: string;
	bidder_address?: string;
	current_bid_ton?: number;
	min_next_bid_ton?: number;
	initial_min_bid_ton?: number;
	min_bid_step_pct?: number;
	is_primary_mint?: boolean;
	code_hash?: string;
	data_hash?: string;
	code_hash_hex?: string;
	data_hash_hex?: string;
	balance_ton?: number;
	last_tx_lt?: string;
	state_status?: string;
	full_domain?: string;
	workchain_id?: number;
	raw_state_boc_hex?: string;
	raw_config_boc_hex?: string;
}

interface CollectionData {
	collection_address?: string;
	stats: CollectionStats | null;
	market_pulse?: MarketPulseMetrics;
	length_tier_matrix?: LengthTierMetric[];
	semantic_categories?: SemanticCategoryMetric[];
	undervalued_auctions?: UndervaluedAuctionItem[];
	whale_tracker?: WhalePortfolioSummary[];
	on_chain_feed?: OnChainEvent[];
	live_tvm_snapshot?: LiveTVMSnapshot;
	auctions: CollectionAuction[];
	ending_soon_auctions?: CollectionAuction[];
	floor_listings?: CollectionAuction[];
	top_sales: CollectionAuction[];
	recent_activity: CollectionAuction[];
	fx?: { ton_usd: number };
	ton_usd_rate?: number;
}

type MainTab = 'market' | 'overview' | 'leaderboard' | 'onchain';
type MarketStreamMode = 'top_bids' | 'ending_soon' | 'buy_now_floor' | 'recent_sold';
type MarketSortOrder = 'price_desc' | 'price_asc' | 'ending_soon';

export const CollectionInfoPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();

	const [quickHandle, setQuickHandle] = createSignal('');
	const [activeTab, setActiveTab] = createSignal<MainTab>('market');
	const [marketStream, setMarketStream] = createSignal<MarketStreamMode>('top_bids');
	const [marketSort, setMarketSort] = createSignal<MarketSortOrder>('price_desc');
	const [marketSearch, setMarketSearch] = createSignal('');
	const [marketLenFilter, setMarketLenFilter] = createSignal<'all' | '4' | '5' | '6+'>('all');

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

	const localizedTimeLeft = (raw?: string) => {
		if (!raw || locale() === 'en') return raw || '';
		return raw
			.replace(/0 seconds/gi, t('usernameCollectionPage.timeClosing'))
			.replace(/days?/gi, t('usernameCollectionPage.timeDays'))
			.replace(/hours?/gi, t('usernameCollectionPage.timeHours'))
			.replace(/minutes?/gi, t('usernameCollectionPage.timeMinutes'))
			.replace(/seconds?/gi, t('usernameCollectionPage.timeSeconds'));
	};

	const parsePriceNum = (item: CollectionAuction) =>
		item.price_ton || parseFloat((item.price || '').replace(/[^0-9.]/g, '')) || 0;

	const activeMarketItems = createMemo<CollectionAuction[]>(() => {
		const d = usernameQuery.data;
		if (!d) return [];
		let base: CollectionAuction[] = [];
		if (marketStream() === 'ending_soon') {
			base = d.ending_soon_auctions || d.auctions || [];
		} else if (marketStream() === 'buy_now_floor') {
			base = d.floor_listings || [];
		} else if (marketStream() === 'recent_sold') {
			base = d.recent_activity || d.top_sales || [];
		} else {
			base = d.auctions || [];
		}

		const q = marketSearch().trim().toLowerCase().replace(/^@/, '');
		const lf = marketLenFilter();

		const filtered = base.filter((item) => {
			const clean = item.item_name.replace(/^@/, '').toLowerCase();
			if (q && !clean.includes(q)) return false;
			const cLen = item.char_length || clean.length;
			if (lf === '4' && cLen > 4) return false;
			if (lf === '5' && cLen !== 5) return false;
			if (lf === '6+' && cLen < 6) return false;
			return true;
		});

		const sortMode = marketSort();
		return [...filtered].sort((a, b) => {
			const pa = parsePriceNum(a);
			const pb = parsePriceNum(b);
			if (sortMode === 'price_asc') return pa - pb;
			if (sortMode === 'price_desc') return pb - pa;
			return 0;
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

	const fmtUsd = (tonVal?: number) => {
		const r = tonUsdRate();
		const n = Number(tonVal ?? 0);
		if (!r || r <= 0 || !Number.isFinite(n) || n <= 0) return null;
		return Math.round(n * r).toLocaleString('en-US');
	};

	const safeNum = (v: unknown): number => {
		const n = Number(v ?? 0);
		return Number.isFinite(n) ? n : 0;
	};

	const fmtInt = (v: unknown) => Math.round(safeNum(v)).toLocaleString('en-US');
	const fmtDec = (v: unknown, maxFrac = 1) =>
		safeNum(v).toLocaleString('en-US', { maximumFractionDigits: maxFrac });
	const fmtFixed = (v: unknown, digits = 1) => safeNum(v).toFixed(digits);

	return (
		<div
			class="min-h-screen frag-canvas text-white font-frag-sans flex flex-col relative pb-32 overflow-x-hidden"
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

				<form
					onSubmit={(e) => {
						e.preventDefault();
						if (quickHandle().trim().length >= 4) openValuation(quickHandle());
					}}
					class="flex-1 max-w-[300px] h-8 bg-[#242e38] hover:bg-[#293440] focus-within:bg-[#293440] rounded-[6px] px-2.5 flex items-center gap-1.5 transition-colors"
					dir="ltr"
				>
					<span class="material-symbols-outlined text-[16px] text-[#8a98a6]">search</span>
					<input
						type="text"
						value={quickHandle()}
						onInput={(e) => setQuickHandle(e.currentTarget.value.replace(/^@/, '').toLowerCase())}
						placeholder="Enter a Telegram username..."
						class="flex-1 min-w-0 bg-transparent text-[12.5px] font-medium text-white placeholder:text-[#8a98a6] focus:outline-none"
					/>
				</form>

				<a
					href="https://fragment.com"
					target="_blank"
					rel="noreferrer"
					class="h-8 px-2.5 rounded-[6px] bg-[#293440] hover:bg-[#384553] text-white text-[12px] font-semibold flex items-center gap-1 shrink-0 transition-colors"
				>
					<span class="hidden xs:inline">fragment.com</span>
					<span class="material-symbols-outlined text-[14px] text-[#4db2ff]">north_east</span>
				</a>
			</header>

			<div class="w-full max-w-[540px] mx-auto px-4 pt-5 flex flex-col gap-4 relative z-10 flex-1">
				{/* Title & Collection Summary Strip */}
				<div class="flex items-center justify-between gap-2 flex-wrap">
					<div>
						<h1 class="text-[20px] sm:text-[22px] font-bold text-white tracking-[-0.015em]">
							{t('action.username.collection_stats_title') || 'Telegram Usernames'}
						</h1>
						<p class="text-[12.5px] text-[#8794a1] mt-0.5">
							{t('action.username.collection_stats_subtitle') ||
								'Buy, valuate and inspect verified Telegram usernames on TON.'}
						</p>
					</div>
					<a
						href="https://tonviewer.com/EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi"
						target="_blank"
						rel="noreferrer"
						class="frag-link-chip"
						dir="ltr"
					>
						EQCA14o1…zwnPi
					</a>
				</div>

				{/* 4-Column Compact Fragment Stats Strip (#212a33) */}
				<Show when={usernameQuery.data?.stats}>
					{(st) => (
						<div class="frag-table-container grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#1a2026]">
							<div class="p-3">
								<span class="text-[11.5px] font-semibold text-[#8c9aa9] block">Floor Price</span>
								<div class="mt-1">
									<TonAmount
										value={(
											st().buy_now_floor_ton ||
											st().auction_floor_ton ||
											parseFloat((st().floor_price || '10').replace(/[^0-9.]/g, '')) ||
											10
										).toLocaleString('en-US')}
										size="sm"
									/>
								</div>
							</div>
							<div class="p-3">
								<span class="text-[11.5px] font-semibold text-[#8c9aa9] block">Total Volume</span>
								<span
									class="text-[14px] font-semibold text-white tabular-nums mt-1 block"
									dir="ltr"
								>
									{st().total_volume || '—'}
								</span>
							</div>
							<div class="p-3">
								<span class="text-[11.5px] font-semibold text-[#8c9aa9] block">Minted Names</span>
								<span
									class="text-[14px] font-semibold text-white tabular-nums mt-1 block"
									dir="ltr"
								>
									{st().items_count || '—'}
								</span>
							</div>
							<div class="p-3">
								<span class="text-[11.5px] font-semibold text-[#8c9aa9] block">Holders</span>
								<span
									class="text-[14px] font-semibold text-white tabular-nums mt-1 block"
									dir="ltr"
								>
									{st().owners_count || '—'}
								</span>
							</div>
						</div>
					)}
				</Show>

				{/* 4-Tab Fragment Section Bar */}
				<div class="flex items-center border-b border-[#293440] gap-4 px-1 overflow-x-auto no-scrollbar">
					<For
						each={
							[
								{ id: 'market', label: 'Top Auctions' },
								{ id: 'overview', label: 'Analytics & Tiers' },
								{ id: 'leaderboard', label: 'Top Sales & Whales' },
								{ id: 'onchain', label: 'TVM On-Chain' },
							] as const
						}
					>
						{(tab) => {
							const active = () => activeTab() === tab.id;
							return (
								<button
									type="button"
									onClick={() => {
										try {
											haptic.selection();
										} catch {}
										setActiveTab(tab.id);
									}}
									class={`relative pb-2.5 text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
										active() ? 'text-white' : 'text-[#8c9aa9] hover:text-white'
									}`}
								>
									<span>{tab.label}</span>
									<Show when={active()}>
										<span class="absolute inset-x-0 bottom-0 h-[3px] bg-[#248bda] rounded-t-[3px]" />
									</Show>
								</button>
							);
						}}
					</For>
				</div>

				{/* Loading State */}
				<Show when={usernameQuery.isLoading}>
					<div class="space-y-2">
						<div class="h-14 rounded-[8px] bg-[#212a33] animate-pulse" />
						<div class="h-14 rounded-[8px] bg-[#212a33] animate-pulse" />
						<div class="h-14 rounded-[8px] bg-[#212a33] animate-pulse" />
					</div>
				</Show>

				{/* TAB 1: TOP AUCTIONS & LIVE LISTINGS (Exact Fragment.com .tm-table) */}
				<Show when={!usernameQuery.isLoading && activeTab() === 'market'}>
					<div class="space-y-3">
						{/* Status Filter Pills (On auction | Ending soon | For sale | Sold) */}
						<div class="flex items-center justify-between gap-2 flex-wrap">
							<div class="flex items-center gap-1.5 flex-wrap">
								<For
									each={
										[
											{ id: 'top_bids', label: 'On auction' },
											{ id: 'ending_soon', label: 'Ending soon' },
											{ id: 'buy_now_floor', label: 'For sale' },
											{ id: 'recent_sold', label: 'Sold' },
										] as const
									}
								>
									{(mode) => (
										<button
											type="button"
											onClick={() => {
												setMarketStream(mode.id);
												if (mode.id === 'ending_soon') setMarketSort('ending_soon');
											}}
											class={`px-2.5 py-1.5 rounded-[6px] text-[12px] font-semibold transition-colors cursor-pointer ${
												marketStream() === mode.id
													? 'bg-[#248bda] text-white'
													: 'bg-[#242e38] hover:bg-[#293440] text-[#8c9aa9] hover:text-white'
											}`}
										>
											{mode.label}
										</button>
									)}
								</For>
							</div>

							<div class="flex items-center gap-1">
								<For each={['all', '4', '5', '6+'] as const}>
									{(len) => (
										<button
											type="button"
											onClick={() => setMarketLenFilter(len)}
											class={`px-2 py-1 rounded-[6px] text-[11.5px] font-mono font-semibold transition-colors cursor-pointer ${
												marketLenFilter() === len
													? 'bg-[#293440] text-white'
													: 'bg-[#212a33] text-[#8c9aa9] hover:text-white'
											}`}
										>
											{len === 'all' ? 'All' : `${len}ch`}
										</button>
									)}
								</For>
							</div>
						</div>

						{/* Inline Filter Input + Fragment Sort Dropdown */}
						<div class="flex items-center gap-2">
							<div
								class="flex-1 bg-[#242e38] rounded-[8px] px-3 py-2 flex items-center gap-2"
								dir="ltr"
							>
								<span class="material-symbols-outlined text-[17px] text-[#8a98a6]">
									filter_list
								</span>
								<input
									type="text"
									value={marketSearch()}
									onInput={(e) => setMarketSearch(e.currentTarget.value)}
									placeholder="Filter visible listings..."
									class="flex-1 bg-transparent text-[13px] text-white placeholder:text-[#8a98a6] focus:outline-none"
								/>
								<Show when={marketSearch()}>
									<button
										type="button"
										onClick={() => setMarketSearch('')}
										class="text-[#8c9aa9] hover:text-white"
									>
										<span class="material-symbols-outlined text-[15px]">close</span>
									</button>
								</Show>
							</div>

							<select
								value={marketSort()}
								onChange={(e) => setMarketSort(e.currentTarget.value as MarketSortOrder)}
								class="h-[36px] rounded-[8px] bg-[#242e38] border border-[#2f3b47] px-2.5 text-[12px] font-semibold text-white focus:outline-none cursor-pointer"
							>
								<option value="price_desc">Price high to low</option>
								<option value="price_asc">Price low to high</option>
								<option value="ending_soon">Ending soon</option>
							</select>
						</div>

						{/* Authentic Fragment.com 3-Column Table with Dynamic Column Headers per Status Filter */}
						<div class="frag-table-container">
							<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
								<span class="col-span-5">Username</span>
								<span class="col-span-4">
									{marketStream() === 'buy_now_floor'
										? 'Sale price'
										: marketStream() === 'recent_sold'
											? 'Sold price'
											: 'Minimum bid'}
								</span>
								<span class="col-span-3 text-end">
									{marketStream() === 'buy_now_floor'
										? 'Status'
										: marketStream() === 'recent_sold'
											? 'Status / Date'
											: 'Auction ends in'}
								</span>
							</div>

							<Show
								when={activeMarketItems().length > 0}
								fallback={
									<div class="p-8 text-center text-[13px] text-[#8c9aa9]">
										No listings match the current filter.
									</div>
								}
							>
								<For each={activeMarketItems()}>
									{(item) => {
										const handle = () => item.item_name.replace(/^@/, '');
										const priceTon = () => parsePriceNum(item);
										return (
											<button
												type="button"
												onClick={() => openValuation(handle())}
												class="frag-table-row w-full grid grid-cols-12 items-center px-3.5 py-2.5 text-start cursor-pointer"
											>
												<div class="col-span-5 min-w-0 pr-2">
													<FragHandle handle={handle()} size="sm" subline />
												</div>
												<div class="col-span-4">
													<TonAmount
														value={priceTon().toLocaleString('en-US', {
															maximumFractionDigits: 0,
														})}
														usd={fmtUsd(priceTon())}
														size="sm"
													/>
												</div>
												<div class="col-span-3 flex flex-col items-end justify-center text-end min-w-0">
													<Show
														when={
															marketStream() === 'buy_now_floor' || marketStream() === 'recent_sold'
														}
														fallback={
															<>
																<span class="text-[12px] font-medium text-white truncate max-w-full">
																	{localizedTimeLeft(item.time_left) || item.status || 'Active'}
																</span>
																<Show when={item.ends_at}>
																	<span class="text-[11px] text-[#8c9aa9] truncate max-w-full mt-0.5">
																		{item.ends_at}
																	</span>
																</Show>
															</>
														}
													>
														<FragStatusPill
															status={normalizeFragStatus(
																marketStream() === 'buy_now_floor' ? 'for_sale' : 'sold',
															)}
															label={marketStream() === 'buy_now_floor' ? 'For sale' : 'Sold'}
														/>
														<Show when={item.time_left || item.ends_at}>
															<span class="text-[10.5px] text-[#8c9aa9] truncate max-w-full mt-0.5">
																{item.time_left || item.ends_at}
															</span>
														</Show>
													</Show>
												</div>
											</button>
										);
									}}
								</For>
							</Show>
						</div>
					</div>
				</Show>

				{/* TAB 2: ANALYTICS, 7D PULSE, CHART, LENGTH TIERS & SEMANTIC CATEGORIES */}
				<Show when={!usernameQuery.isLoading && activeTab() === 'overview'}>
					<div class="space-y-4">
						{/* Quantitative Market Pulse Strip */}
						<Show when={usernameQuery.data?.market_pulse}>
							{(mp) => {
								const hasSignals = () =>
									Boolean(
										mp().demand?.value ||
											mp().supply_pressure?.value ||
											mp().liquidity?.value ||
											mp().price_momentum?.value,
									);
								return (
									<div class="frag-section-card p-3.5 space-y-2.5">
										<div class="flex items-center justify-between gap-2">
											<span class="text-[13px] font-bold text-white">
												Quantitative Market Pulse
											</span>
											<span class="px-2 py-0.5 rounded-[4px] bg-[#248bda]/15 text-[#4db2ff] text-[10.5px] font-mono font-bold uppercase">
												{mp().market_regime || mp().price_momentum?.status || 'LIVE'}
											</span>
										</div>
										<Show
											when={hasSignals()}
											fallback={
												<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-start" dir="ltr">
													<div class="bg-[#1a2026] rounded-[6px] p-2.5">
														<span class="text-[10.5px] text-[#8c9aa9] block">7D Volume</span>
														<TonAmount value={fmtInt(mp().volume_7d_ton)} size="sm" />
													</div>
													<div class="bg-[#1a2026] rounded-[6px] p-2.5">
														<span class="text-[10.5px] text-[#8c9aa9] block">7D Median Sale</span>
														<TonAmount value={fmtInt(mp().median_sale_7d_ton)} size="sm" />
													</div>
													<div class="bg-[#1a2026] rounded-[6px] p-2.5">
														<span class="text-[10.5px] text-[#8c9aa9] block">P90 Whale Sale</span>
														<TonAmount value={fmtInt(mp().p90_sale_7d_ton)} size="sm" />
													</div>
													<div class="bg-[#1a2026] rounded-[6px] p-2.5">
														<span class="text-[10.5px] text-[#8c9aa9] block">4–5ch Share</span>
														<span class="text-[13.5px] font-bold text-white font-mono">
															{fmtFixed(mp().short_4_5_share_pct, 1)}%
														</span>
													</div>
												</div>
											}
										>
											<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-start" dir="ltr">
												<For
													each={[
														{ label: 'Demand', sig: mp().demand },
														{ label: 'Supply', sig: mp().supply_pressure },
														{ label: 'Liquidity', sig: mp().liquidity },
														{ label: 'Momentum', sig: mp().price_momentum },
													]}
												>
													{(cell) => (
														<div class="bg-[#1a2026] rounded-[6px] p-2.5">
															<span class="text-[10.5px] text-[#8c9aa9] block">{cell.label}</span>
															<span class="text-[13px] font-bold text-white font-mono block mt-0.5 truncate">
																{cell.sig?.value || '—'}
															</span>
															<Show when={cell.sig?.status}>
																<span class="text-[10px] font-semibold text-[#4db2ff] uppercase block mt-0.5 truncate">
																	{cell.sig?.status}
																</span>
															</Show>
														</div>
													)}
												</For>
											</div>
										</Show>
									</div>
								);
							}}
						</Show>

						<UsernameCollectionChart tonUsdRate={tonUsdRate()} />

						{/* Length Tier Matrix Table */}
						<Show when={(usernameQuery.data?.length_tier_matrix?.length || 0) > 0}>
							<div>
								<h3 class="text-[15px] font-semibold text-white mb-2 px-0.5">
									Length Tier Floor Matrix
								</h3>
								<div class="frag-table-container">
									<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
										<span class="col-span-5">Length Tier</span>
										<span class="col-span-4">Floor Price</span>
										<span class="col-span-3 text-end">30d Sales</span>
									</div>
									<For each={usernameQuery.data?.length_tier_matrix || []}>
										{(tier) => (
											<div class="frag-table-row grid grid-cols-12 items-center px-3.5 py-2.5 text-[13px]">
												<div class="col-span-5 min-w-0 pr-2">
													<span class="font-semibold text-white block truncate">
														{tier.length_bucket || '—'} chars
													</span>
													<span class="text-[11px] text-[#8c9aa9] truncate block" dir="ltr">
														Mint min: {fmtInt(tier.primary_min_bid_ton || 10)} TON
													</span>
												</div>
												<div class="col-span-4">
													<TonAmount
														value={fmtDec(tier.floor_price_ton)}
														usd={fmtUsd(tier.floor_price_ton)}
														size="sm"
													/>
												</div>
												<div
													class="col-span-3 text-end font-mono text-[12.5px] text-white"
													dir="ltr"
												>
													{fmtInt(tier.sales_count_30d)}
												</div>
											</div>
										)}
									</For>
								</div>
							</div>
						</Show>

						{/* Semantic Category Valuation Matrix */}
						<Show when={(usernameQuery.data?.semantic_categories?.length || 0) > 0}>
							<div>
								<h3 class="text-[15px] font-semibold text-white mb-2 px-0.5">
									Semantic Category Valuation Matrix
								</h3>
								<div class="frag-table-container">
									<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
										<span class="col-span-5">Category</span>
										<span class="col-span-4">Floor / Median</span>
										<span class="col-span-3 text-end">Volume</span>
									</div>
									<For each={usernameQuery.data?.semantic_categories || []}>
										{(cat) => {
											const catTitle = () =>
												(isRtl() ? cat.category_name_fa : cat.category_name_en) ||
												cat.category_name ||
												cat.category_key ||
												'—';
											const rightTon = () => cat.volume_ton ?? cat.top_sale_ton ?? 0;
											return (
												<div class="frag-table-row grid grid-cols-12 items-center px-3.5 py-2.5 text-[12.5px]">
													<div class="col-span-5 min-w-0 pr-2">
														<span class="font-semibold text-white block truncate">
															{catTitle()}
														</span>
														<Show
															when={(cat.sample_handles?.length || 0) > 0}
															fallback={
																<span
																	class="text-[10.5px] font-mono text-[#8c9aa9] block mt-0.5"
																	dir="ltr"
																>
																	{fmtInt(cat.sales_count)} sales · {fmtFixed(cat.share_pct, 1)}%
																</span>
															}
														>
															<div class="flex items-center gap-1 flex-wrap mt-1" dir="ltr">
																<For each={(cat.sample_handles || []).slice(0, 3)}>
																	{(h) => (
																		<button
																			type="button"
																			onClick={() => openValuation(h)}
																			class="text-[10.5px] font-mono text-[#4db2ff] hover:underline cursor-pointer"
																		>
																			@{String(h || '').replace(/^@/, '')}
																		</button>
																	)}
																</For>
															</div>
														</Show>
													</div>
													<div class="col-span-4">
														<TonAmount value={fmtDec(cat.floor_ton)} size="sm" />
														<span class="text-[10.5px] text-[#8c9aa9] block mt-0.5" dir="ltr">
															Med: {fmtDec(cat.median_ton)} TON
														</span>
													</div>
													<div class="col-span-3 flex justify-end">
														<TonAmount value={fmtInt(rightTon())} size="sm" tone="positive" />
													</div>
												</div>
											);
										}}
									</For>
								</div>
							</div>
						</Show>

						{/* Undervalued Auctions Table */}
						<Show when={(usernameQuery.data?.undervalued_auctions?.length || 0) > 0}>
							<div>
								<h3 class="text-[15px] font-semibold text-white mb-2 px-0.5">
									Undervalued Active Auctions
								</h3>
								<div class="frag-table-container">
									<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
										<span class="col-span-5">Username</span>
										<span class="col-span-4">Current Bid</span>
										<span class="col-span-3 text-end">Fair Value</span>
									</div>
									<For each={usernameQuery.data?.undervalued_auctions || []}>
										{(uv) => (
											<button
												type="button"
												onClick={() => openValuation(uv.username || '')}
												class="frag-table-row w-full grid grid-cols-12 items-center px-3.5 py-2.5 text-start cursor-pointer"
											>
												<div class="col-span-5 min-w-0 pr-2">
													<FragHandle
														handle={String(uv.username || '').replace(/^@/, '')}
														size="sm"
													/>
													<span class="text-[11px] text-[#5aec8c] font-semibold block" dir="ltr">
														-{Math.round(safeNum(uv.discount_pct))}% below fair
													</span>
												</div>
												<div class="col-span-4">
													<TonAmount value={fmtDec(uv.current_bid_ton)} size="sm" />
												</div>
												<div class="col-span-3 flex justify-end">
													<TonAmount
														value={fmtDec(uv.estimated_fair_ton)}
														size="sm"
														tone="positive"
													/>
												</div>
											</button>
										)}
									</For>
								</div>
							</div>
						</Show>
					</div>
				</Show>

				{/* TAB 3: TOP SALES LEADERBOARD & WHALE TRACKER */}
				<Show when={!usernameQuery.isLoading && activeTab() === 'leaderboard'}>
					<div class="space-y-4">
						<div class="frag-table-container">
							<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
								<span class="col-span-6">Username</span>
								<span class="col-span-3">Sold Price</span>
								<span class="col-span-3 text-end">Status</span>
							</div>
							<Show
								when={(usernameQuery.data?.top_sales?.length || 0) > 0}
								fallback={
									<div class="p-8 text-center text-[13px] text-[#8c9aa9]">
										No top sales available.
									</div>
								}
							>
								<For each={usernameQuery.data?.top_sales || []}>
									{(sale, idx) => {
										const handle = () => sale.item_name.replace(/^@/, '');
										const priceTon = () => parsePriceNum(sale);
										return (
											<button
												type="button"
												onClick={() => openValuation(handle())}
												class="frag-table-row w-full grid grid-cols-12 items-center px-3.5 py-2.5 text-start cursor-pointer"
											>
												<div class="col-span-6 flex items-center gap-2.5 min-w-0 pr-2">
													<span class="w-5 text-[12px] font-mono text-[#8c9aa9] shrink-0">
														#{idx() + 1}
													</span>
													<FragHandle handle={handle()} size="sm" subline />
												</div>
												<div class="col-span-3">
													<TonAmount
														value={priceTon().toLocaleString('en-US', {
															maximumFractionDigits: 0,
														})}
														usd={fmtUsd(priceTon())}
														size="sm"
													/>
												</div>
												<div class="col-span-3 flex justify-end">
													<FragStatusPill status={normalizeFragStatus('sold')} label="Sold" />
												</div>
											</button>
										);
									}}
								</For>
							</Show>
						</div>

						{/* Whale Portfolio Tracker */}
						<Show when={(usernameQuery.data?.whale_tracker?.length || 0) > 0}>
							<div>
								<h3 class="text-[15px] font-semibold text-white mb-2 px-0.5">
									Sovereign Whale Portfolios
								</h3>
								<div class="frag-table-container">
									<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
										<span class="col-span-6">Whale / Top Handles</span>
										<span class="col-span-3">Holdings</span>
										<span class="col-span-3 text-end">Est. Value</span>
									</div>
									<For each={usernameQuery.data?.whale_tracker || []}>
										{(w, idx) => {
											const displayAlias = () => {
												if (w.alias) return w.alias;
												const addr = w.wallet_address || w.owner_address || '';
												if (addr.length > 12) return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
												return w.role_label || addr || 'TON Whale';
											};
											const handles = () => w.sample_handles || w.top_handles || [];
											const count = () => w.handles_count ?? w.handles_owned ?? 0;
											const valTon = () => w.total_ton_deployed ?? w.portfolio_value_ton ?? 0;
											return (
												<div class="frag-table-row grid grid-cols-12 items-center px-3.5 py-2.5 text-[12.5px]">
													<div class="col-span-6 min-w-0 pr-2">
														<div class="flex items-center gap-1.5" dir="ltr">
															<span class="text-[11px] font-mono text-[#4db2ff]">
																#{w.rank || idx() + 1}
															</span>
															<span class="font-semibold text-white truncate">
																{displayAlias()}
															</span>
														</div>
														<div class="flex items-center gap-1 flex-wrap mt-1" dir="ltr">
															<For each={handles().slice(0, 3)}>
																{(h) => (
																	<button
																		type="button"
																		onClick={() => openValuation(h)}
																		class="text-[10.5px] font-mono text-[#4db2ff] hover:underline cursor-pointer"
																	>
																		@{String(h || '').replace(/^@/, '')}
																	</button>
																)}
															</For>
														</div>
													</div>
													<div class="col-span-3 font-mono text-white" dir="ltr">
														{fmtInt(count())} names
													</div>
													<div class="col-span-3 flex justify-end">
														<TonAmount value={fmtInt(valTon())} size="sm" />
													</div>
												</div>
											);
										}}
									</For>
								</div>
							</div>
						</Show>
					</div>
				</Show>

				{/* TAB 4: TON TVM ON-CHAIN & TELEMINT OPCODE FORENSICS */}
				<Show when={!usernameQuery.isLoading && activeTab() === 'onchain'}>
					<div class="space-y-4">
						{/* Live TVM Collection Contract State Snapshot */}
						<Show when={usernameQuery.data?.live_tvm_snapshot}>
							{(snap) => (
								<div class="frag-section-card p-3.5 space-y-2.5" dir="ltr">
									<div class="flex items-center justify-between gap-2">
										<div class="min-w-0">
											<span class="text-[13px] font-bold text-white block">
												TON TVM Contract Snapshot
											</span>
											<span class="text-[11px] text-[#8c9aa9] font-mono block truncate">
												{snap().full_domain ||
													(snap().username ? `@${snap().username}` : 'TeleMint TEP-62')}{' '}
												•{' '}
												{snap().nft_address
													? `${snap().nft_address!.slice(0, 12)}...`
													: `WC ${snap().workchain_id ?? 0}`}
											</span>
										</div>
										<span class="px-2 py-0.5 rounded-[4px] bg-[#5aec8c]/15 text-[#5aec8c] text-[10.5px] font-mono font-bold uppercase shrink-0">
											{snap().state_status || (snap().is_primary_mint ? 'PRIMARY' : 'ACTIVE')}
										</span>
									</div>

									<div class="grid grid-cols-2 gap-2 text-[11.5px]">
										<div class="bg-[#1a2026] rounded-[6px] p-2">
											<span class="text-[#8c9aa9] block text-[10px]">
												{snap().current_bid_ton ? 'Current Bid' : 'Contract Balance'}
											</span>
											<span class="font-mono text-white font-semibold">
												{snap().current_bid_ton
													? `${fmtDec(snap().current_bid_ton)} TON`
													: `${fmtFixed(snap().balance_ton, 4)} TON`}
											</span>
										</div>
										<div class="bg-[#1a2026] rounded-[6px] p-2">
											<span class="text-[#8c9aa9] block text-[10px]">
												{snap().min_next_bid_ton ? 'Min Next Bid' : 'Last Logical Time (LT)'}
											</span>
											<span class="font-mono text-white font-semibold">
												{snap().min_next_bid_ton
													? `${fmtDec(snap().min_next_bid_ton)} TON`
													: snap().last_tx_lt || '—'}
											</span>
										</div>
										<div class="bg-[#1a2026] rounded-[6px] p-2">
											<span class="text-[#8c9aa9] block text-[10px]">TVM Code Hash (SHA-256)</span>
											<span class="font-mono text-[#4db2ff] truncate block">
												{snap().code_hash || snap().code_hash_hex || '—'}
											</span>
										</div>
										<div class="bg-[#1a2026] rounded-[6px] p-2">
											<span class="text-[#8c9aa9] block text-[10px]">TVM Data Hash (SHA-256)</span>
											<span class="font-mono text-[#4db2ff] truncate block">
												{snap().data_hash || snap().data_hash_hex || '—'}
											</span>
										</div>
									</div>

									<Show when={snap().raw_state_boc_hex}>
										<div class="bg-[#1a2026] rounded-[6px] p-2.5">
											<span class="text-[10px] text-[#8c9aa9] block mb-1">
												AccountState TVM Bag-of-Cells (0xb5ee9c72) Hex
											</span>
											<code class="text-[10.5px] font-mono text-[#5aec8c] break-all block max-h-20 overflow-y-auto">
												{snap().raw_state_boc_hex}
											</code>
										</div>
									</Show>
								</div>
							)}
						</Show>

						{/* On-Chain TeleMint & TEP-62 Event Stream */}
						<Show when={(usernameQuery.data?.on_chain_feed?.length || 0) > 0}>
							<div>
								<h3 class="text-[15px] font-semibold text-white mb-2 px-0.5">
									Live TeleMint & TEP-62 Opcode Stream
								</h3>
								<div class="frag-table-container" dir="ltr">
									<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
										<span class="col-span-5">Handle / Opcode</span>
										<span class="col-span-4">Action / LT</span>
										<span class="col-span-3 text-end">Amount</span>
									</div>
									<For each={usernameQuery.data?.on_chain_feed || []}>
										{(ev) => (
											<button
												type="button"
												onClick={() => openValuation(ev.username || '')}
												class="frag-table-row w-full grid grid-cols-12 items-center px-3.5 py-2.5 text-start cursor-pointer"
											>
												<div class="col-span-5 min-w-0 pr-2">
													<span class="text-[12.5px] font-semibold text-white block truncate">
														@{String(ev.username || 'unknown').replace(/^@/, '')}
													</span>
													<span class="text-[10.5px] font-mono text-[#4db2ff] block truncate">
														{ev.opcode || ev.opcode_hex || '0x0'} •{' '}
														{ev.opcode_label || ev.opcode_name || ev.action_type || 'TX'}
													</span>
												</div>
												<div class="col-span-4 min-w-0 pr-2">
													<code class="text-[10px] font-mono text-[#8c9aa9] block truncate">
														{ev.cell_boc_preview || ev.actor_address || ev.nft_address || '—'}
													</code>
													<span class="text-[10px] font-mono text-[#5aec8c] block truncate">
														LT {ev.lt ?? '—'}
													</span>
												</div>
												<div class="col-span-3 flex justify-end">
													<TonAmount value={fmtInt(ev.amount_ton)} size="sm" />
												</div>
											</button>
										)}
									</For>
								</div>
							</div>
						</Show>
					</div>
				</Show>
			</div>

			<BottomNav />
		</div>
	);
};

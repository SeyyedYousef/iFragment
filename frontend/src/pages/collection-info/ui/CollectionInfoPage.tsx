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
	fx?: { ton_usd: number };
	ton_usd_rate?: number;
}

type MainTab = 'market' | 'overview' | 'leaderboard';
type MarketStreamMode = 'top_bids' | 'ending_soon' | 'buy_now_floor';

export const CollectionInfoPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();

	const [quickHandle, setQuickHandle] = createSignal('');
	const [activeTab, setActiveTab] = createSignal<MainTab>('market');
	const [marketStream, setMarketStream] = createSignal<MarketStreamMode>('top_bids');
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

	const openValuation = (handle: string) => {
		try {
			haptic.impact('light');
		} catch {}
		const clean = handle.trim().replace(/^@/, '');
		if (!clean) return;
		navigate(`/username/report?u=${encodeURIComponent(clean)}`);
	};

	const parsePriceNum = (item: CollectionAuction) =>
		item.price_ton || parseFloat((item.price || '').replace(/[^0-9.]/g, '')) || 0;

	const fmtUsd = (tonVal: number) => {
		const r = tonUsdRate();
		if (!r || r <= 0 || tonVal <= 0) return null;
		return Math.round(tonVal * r).toLocaleString('en-US');
	};

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
										).toLocaleString()}
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

				{/* 3-Tab Fragment Section Bar */}
				<div class="flex items-center border-b border-[#293440] gap-5 px-1">
					<For
						each={
							[
								{ id: 'market', label: 'Top Auctions' },
								{ id: 'overview', label: 'Analytics & Tiers' },
								{ id: 'leaderboard', label: 'Top Sales' },
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
									class={`relative pb-2.5 text-[13.5px] font-semibold transition-colors cursor-pointer ${
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
						{/* Filter & Sort Controls Row */}
						<div class="flex items-center justify-between gap-2 flex-wrap">
							<div class="flex items-center gap-1.5">
								<For
									each={
										[
											{ id: 'top_bids', label: 'On auction' },
											{ id: 'ending_soon', label: 'Ending soon' },
											{ id: 'buy_now_floor', label: 'For sale' },
										] as const
									}
								>
									{(mode) => (
										<button
											type="button"
											onClick={() => setMarketStream(mode.id)}
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

						{/* Inline Filter Input */}
						<div class="bg-[#242e38] rounded-[8px] px-3 py-2 flex items-center gap-2" dir="ltr">
							<span class="material-symbols-outlined text-[17px] text-[#8a98a6]">filter_list</span>
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

						{/* Authentic Fragment.com 3-Column Table: Username | Minimum bid | Auction ends in */}
						<div class="frag-table-container">
							<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
								<span class="col-span-5">Username</span>
								<span class="col-span-4">Minimum bid</span>
								<span class="col-span-3 text-end">Auction ends in</span>
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
													<span class="text-[12px] font-medium text-white truncate max-w-full">
														{localizedTimeLeft(item.time_left) || item.status || 'Active'}
													</span>
													<Show when={item.ends_at}>
														<span class="text-[11px] text-[#8c9aa9] truncate max-w-full mt-0.5">
															{item.ends_at}
														</span>
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

				{/* TAB 2: ANALYTICS, CHART & LENGTH TIER MATRIX */}
				<Show when={!usernameQuery.isLoading && activeTab() === 'overview'}>
					<div class="space-y-4">
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
														{tier.length_bucket} chars
													</span>
													<span class="text-[11px] text-[#8c9aa9] truncate block">
														Mint min: {tier.primary_min_bid_ton || 10} TON
													</span>
												</div>
												<div class="col-span-4">
													<TonAmount
														value={tier.floor_price_ton.toLocaleString()}
														usd={fmtUsd(tier.floor_price_ton)}
														size="sm"
													/>
												</div>
												<div class="col-span-3 text-end font-mono text-[12.5px] text-white">
													{tier.sales_count_30d.toLocaleString()}
												</div>
											</div>
										)}
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
												onClick={() => openValuation(uv.username)}
												class="frag-table-row w-full grid grid-cols-12 items-center px-3.5 py-2.5 text-start cursor-pointer"
											>
												<div class="col-span-5 min-w-0 pr-2">
													<FragHandle handle={uv.username.replace(/^@/, '')} size="sm" />
													<span class="text-[11px] text-[#5aec8c] font-semibold block">
														-{Math.round(uv.discount_pct)}% below fair
													</span>
												</div>
												<div class="col-span-4">
													<TonAmount value={uv.current_bid_ton.toLocaleString()} size="sm" />
												</div>
												<div class="col-span-3 flex justify-end">
													<TonAmount
														value={uv.estimated_fair_ton.toLocaleString()}
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

				{/* TAB 3: TOP SALES LEADERBOARD */}
				<Show when={!usernameQuery.isLoading && activeTab() === 'leaderboard'}>
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
				</Show>
			</div>

			<BottomNav />
		</div>
	);
};

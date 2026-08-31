import { useLocation, useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { giftsApi, getGiftCdnImageUrl, getModelCdnImageUrl } from '@/entities/gifts/index.js';
import type {
	CollectionIntelResponse,
	CollectionModelFloor,
	CrossMarketArbitrage,
	MarketActivityItem,
	MarketVenueFloor,
	RarityHeatmapCell,
	WhaleProfile,
} from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';

export const GiftCollectionPage: Component = () => {
	useTelegramBackButton(-1);
	const location = useLocation();
	const navigate = useNavigate();

	const getCollectionSlug = () => {
		const params = new URLSearchParams(location.search);
		return params.get('c') || '';
	};

	const slug = () => getCollectionSlug();
	const [activeTab, setActiveTab] = createSignal<'overview' | 'chart' | 'heatmap' | 'arbitrage' | 'crafting' | 'whales'>('overview');
	const [searchQuery, setSearchQuery] = createSignal('');
	const [showSearch, setShowSearch] = createSignal(!slug());
	const [chartTimeframe, setChartTimeframe] = createSignal<'24h' | '7d' | '30d'>('24h');
	const [craftInputsCount, setCraftInputsCount] = createSignal<number>(2);

	// Collections list for search
	const collectionsQuery = createQuery(() => ({
		queryKey: ['giftCollectionsList'],
		queryFn: () => giftsApi.listCollections(),
		staleTime: 5 * 60 * 1000,
		enabled: showSearch(),
	}));

	// Main collection data
	const intelQuery = createQuery(() => ({
		queryKey: ['giftCollectionIntel', slug()],
		queryFn: () => giftsApi.getCollectionIntel(slug()),
		staleTime: 30 * 1000,
		enabled: !!slug(),
	}));

	const data = () => intelQuery.data;

	const filteredCollections = createMemo(() => {
		const q = searchQuery().toLowerCase().trim();
		if (!q || !collectionsQuery.data) return collectionsQuery.data || [];
		return collectionsQuery.data.filter(
			(c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
		);
	});

	const selectCollection = (collectionSlug: string) => {
		navigate(`/gifts/collection?c=${encodeURIComponent(collectionSlug)}`);
		setShowSearch(false);
	};

	// Helpers
	const fmt = (val?: number, decimals = 1) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: decimals });
	};

	const fmtUsd = (val?: number) => {
		if (val === undefined || val === null) return '$0';
		if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
		if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
		return `$${val.toFixed(0)}`;
	};

	const pctBadge = (pct?: number) => {
		if (pct === undefined || pct === null) return { color: 'text-white/50', icon: '', text: '0%' };
		if (pct > 0) return { color: 'text-emerald-400', icon: '↑', text: `+${pct.toFixed(1)}%` };
		if (pct < 0) return { color: 'text-red-400', icon: '↓', text: `${pct.toFixed(1)}%` };
		return { color: 'text-white/50', icon: '', text: '0%' };
	};

	const rarityColor = (tier: string) => {
		const tStr = (tier || '').toLowerCase();
		if (tStr === 'mythic') return 'bg-amber-500/30 border-amber-500/50 text-amber-300';
		if (tStr === 'legendary') return 'bg-[#AF52DE]/30 border-[#AF52DE]/50 text-[#D59EF5]';
		if (tStr === 'epic') return 'bg-[#0098EA]/30 border-[#0098EA]/50 text-[#5BC0F8]';
		if (tStr === 'rare') return 'bg-blue-500/30 border-blue-500/50 text-blue-300';
		if (tStr === 'uncommon') return 'bg-emerald-500/30 border-emerald-500/50 text-emerald-300';
		return 'bg-white/10 border-white/20 text-white/60';
	};

	const whaleIcon = (cls: string) => {
		if (cls === 'diamond_hands') return { icon: '💎', label: t('gifts.diamondHands'), color: 'text-cyan-300' };
		if (cls === 'flipper') return { icon: '🔄', label: t('gifts.flipper'), color: 'text-orange-300' };
		if (cls === 'accumulator') return { icon: '📈', label: t('gifts.accumulator'), color: 'text-emerald-300' };
		return { icon: '🐋', label: t('gifts.whale'), color: 'text-white/60' };
	};

	const activityIcon = (type: string) => {
		const map: Record<string, { icon: string; color: string }> = {
			sale: { icon: 'payments', color: 'text-emerald-400' },
			listing: { icon: 'storefront', color: 'text-[#0098EA]' },
			upgrade: { icon: 'upgrade', color: 'text-amber-400' },
			craft: { icon: 'local_fire_department', color: 'text-orange-400' },
			transfer: { icon: 'swap_horiz', color: 'text-[#AF52DE]' },
			delist: { icon: 'remove_shopping_cart', color: 'text-red-400' },
		};
		return map[type] || { icon: 'info', color: 'text-white/40' };
	};

	const fearGreedColor = (index: number) => {
		if (index >= 75) return { bg: 'from-emerald-500/20 to-emerald-500/5', text: 'text-emerald-400', ring: 'ring-emerald-500/30' };
		if (index >= 50) return { bg: 'from-amber-500/20 to-amber-500/5', text: 'text-amber-400', ring: 'ring-amber-500/30' };
		if (index >= 25) return { bg: 'from-orange-500/20 to-orange-500/5', text: 'text-orange-400', ring: 'ring-orange-500/30' };
		return { bg: 'from-red-500/20 to-red-500/5', text: 'text-red-400', ring: 'ring-red-500/30' };
	};

	const timeAgo = (ts: string) => {
		const diff = Date.now() - new Date(ts).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'now';
		if (mins < 60) return `${mins}m`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h`;
		return `${Math.floor(hrs / 24)}d`;
	};

	// Crafting Simulator computations (Section 14 & 21)
	const craftingChances = createMemo(() => {
		const count = craftInputsCount();
		const floor = data()?.best_floor_gram || 50;
		const chances = [0, 25, 48, 72, 92]; // Success % for 1, 2, 3, 4 gifts
		const successPct = chances[count] || 50;
		const totalCost = count * floor;
		const expectedMultiplier = count === 1 ? 1.8 : count === 2 ? 2.4 : count === 3 ? 3.2 : 4.5;
		const expectedOutput = (floor * expectedMultiplier * (successPct / 100));
		const netEv = expectedOutput - totalCost;
		const roi = ((netEv / (totalCost || 1)) * 100);
		return {
			successPct,
			totalCost,
			expectedOutput,
			netEv,
			roi,
			recommendation: roi > 10 ? 'YES' : roi > -15 ? 'RISKY' : 'NO',
		};
	});

	// Bollinger Bands calculation (Section 21.3)
	const bollingerData = createMemo(() => {
		const history = data()?.floor_history || [];
		if (history.length === 0) {
			return { current: 50, sma: 50, upper: 55, lower: 45, points: '' };
		}
		const prices = history.map((h) => h.floor_gram);
		const sum = prices.reduce((a, b) => a + b, 0);
		const mean = sum / prices.length;
		const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
		const stdDev = Math.sqrt(variance);
		const upper = mean + 2 * stdDev;
		const lower = Math.max(mean - 2 * stdDev, 0);

		// SVG Points generator (400x120 viewbox)
		const minP = Math.min(...prices, lower) * 0.95;
		const maxP = Math.max(...prices, upper) * 1.05;
		const range = maxP - minP || 1;

		const points = prices.map((p, i) => {
			const x = (i / (prices.length - 1 || 1)) * 380 + 10;
			const y = 110 - ((p - minP) / range) * 90;
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		}).join(' ');

		return {
			current: prices[prices.length - 1] || mean,
			sma: mean,
			upper,
			lower,
			points,
		};
	});

	return (
		<div class="pb-40 bg-[#06070B] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient Gradient Glows */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[450px] bg-gradient-to-b from-[#0098EA]/20 via-[#AF52DE]/10 to-transparent blur-[90px] pointer-events-none z-0" />
			<div class="fixed bottom-20 right-0 w-80 h-80 bg-[#0098EA]/10 blur-[100px] pointer-events-none z-0" />

			<div class="relative z-10 max-w-[480px] mx-auto px-4 pt-4">
				{/* Top Bar */}
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-2.5">
						<div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF9500] to-[#0098EA] p-[1px] shadow-lg shadow-[#FF9500]/20 flex items-center justify-center">
							<div class="w-full h-full bg-[#0d111a] rounded-2xl flex items-center justify-center">
								<span class="material-symbols-outlined text-[#FF9500] text-[22px]">category</span>
							</div>
						</div>
						<div>
							<h1 class="text-[18px] font-black tracking-tight text-white flex items-center gap-1.5">
								{data()?.collection_name || t('gifts.collectionIntel')}
								<span class="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-[#FF9500]/20 text-[#FF9500] border border-[#FF9500]/30">
									{t('gifts.sevenVenues')}
								</span>
							</h1>
							<p class="text-[11px] font-medium text-white/50">{t('gifts.collectionSubtitle')}</p>
						</div>
					</div>

					<button
						type="button"
						onClick={() => {
							setShowSearch(true);
							setSearchQuery('');
						}}
						class="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all active:scale-95"
					>
						<span class="material-symbols-outlined text-lg">search</span>
					</button>
				</div>

				{/* ═══════ SEARCH / SELECT COLLECTION ═══════ */}
				<Show when={showSearch()}>
					<div class="mb-4 space-y-3">
						<div class="relative">
							<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-lg">search</span>
							<input
								type="text"
								value={searchQuery()}
								onInput={(e) => setSearchQuery(e.currentTarget.value)}
								placeholder={t('gifts.searchCollection')}
								class="w-full pl-10 pr-4 py-3 bg-[#12141C] border border-white/10 rounded-2xl text-white text-sm font-medium placeholder:text-white/30 focus:outline-none focus:border-[#0098EA]/50 focus:ring-1 focus:ring-[#0098EA]/30 transition-all"
								autofocus
							/>
						</div>

						<div class="max-h-[300px] overflow-y-auto space-y-1.5 scrollbar-thin">
							<Show when={collectionsQuery.isLoading}>
								<For each={[1, 2, 3, 4, 5]}>
									{() => (
										<div class="h-14 bg-[#12141C]/60 rounded-xl animate-pulse" />
									)}
								</For>
							</Show>

							<For each={filteredCollections()}>
								{(coll) => (
									<button
										type="button"
										onClick={() => selectCollection(coll.slug)}
										class="w-full flex items-center gap-3 p-3 bg-[#12141C]/80 hover:bg-[#12141C] border border-white/[0.06] hover:border-[#0098EA]/30 rounded-xl transition-all active:scale-[0.98]"
									>
										<div class="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0098EA]/20 to-[#AF52DE]/20 flex items-center justify-center border border-white/10 overflow-hidden p-1 flex-shrink-0">
											<img
												src={getGiftCdnImageUrl(coll.slug)}
												alt={coll.name}
												class="w-full h-full object-contain"
												onError={(e) => {
													e.currentTarget.style.display = 'none';
												}}
											/>
										</div>
										<div class="flex-1 text-left rtl:text-right">
											<div class="text-sm font-bold text-white">{coll.name}</div>
											<div class="text-[11px] text-white/40 font-medium">
												{t('gifts.itemsCount', { count: coll.total_supply.toLocaleString() })} · ⭐ {fmt(coll.floor_gram)}
											</div>
										</div>
										<span class="material-symbols-outlined text-white/30 text-lg rtl:rotate-180">chevron_right</span>
									</button>
								)}
							</For>

							<Show when={!collectionsQuery.isLoading && filteredCollections().length === 0}>
								<div class="text-center py-8 text-white/30 text-sm font-medium">
									{t('gifts.noCollectionsFound')}
								</div>
							</Show>
						</div>
					</div>
				</Show>

				{/* ═══════ MAIN CONTENT — COLLECTION DATA ═══════ */}
				<Show when={!!slug() && !showSearch()}>
					{/* Loading State */}
					<Show when={intelQuery.isLoading}>
						<div class="space-y-4">
							<div class="h-48 bg-[#12141C]/60 rounded-2xl animate-pulse" />
							<div class="grid grid-cols-3 gap-3">
								<div class="h-20 bg-[#12141C]/60 rounded-xl animate-pulse" />
								<div class="h-20 bg-[#12141C]/60 rounded-xl animate-pulse" />
								<div class="h-20 bg-[#12141C]/60 rounded-xl animate-pulse" />
							</div>
							<div class="h-64 bg-[#12141C]/60 rounded-2xl animate-pulse" />
						</div>
					</Show>

					<Show when={data()}>
						{/* ═══ 1. Collection Hero Card ═══ */}
						<div class="bg-gradient-to-br from-[#12141C] to-[#0d111a] border border-white/[0.08] rounded-3xl p-5 mb-4 relative overflow-hidden">
							<div class="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-[#0098EA]/10 to-transparent blur-2xl pointer-events-none" />

							<div class="flex items-start gap-4 relative z-10">
								<div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0098EA]/20 to-[#AF52DE]/20 border border-white/10 flex items-center justify-center flex-shrink-0 shadow-xl overflow-hidden p-2">
									<img
										src={getGiftCdnImageUrl(slug())}
										alt={data()!.collection_name}
										class="w-full h-full object-contain drop-shadow-md"
										onError={(e) => {
											e.currentTarget.style.display = 'none';
										}}
									/>
								</div>

								<div class="flex-1 min-w-0">
									<h2 class="text-xl font-black text-white truncate mb-1">{data()!.collection_name}</h2>
									<div class="flex flex-wrap gap-1.5 mb-2">
										<Show when={data()!.is_limited}>
											<span class="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
												{t('gifts.limited')}
											</span>
										</Show>
										<Show when={!data()!.is_limited}>
											<span class="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
												{t('gifts.unlimited')}
											</span>
										</Show>
										<Show when={data()!.is_craftable}>
											<span class="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
												🔥 {t('gifts.craftable')}
											</span>
										</Show>
									</div>
									<div class="flex items-center gap-3 text-[11px] text-white/40 font-medium">
										<span>{t('gifts.itemsCount', { count: data()!.total_supply.toLocaleString() })}</span>
										<span class="w-[1px] h-3 bg-white/10" />
										<span>{data()!.upgraded_count.toLocaleString()} {t('gifts.upgraded')}</span>
									</div>
								</div>
							</div>
						</div>

						{/* ═══ 2. Market Pulse & Anomaly Detector ═══ */}
						<div class="grid grid-cols-3 gap-2 mb-3">
							{/* Floor Price */}
							<div class="bg-[#12141C]/80 border border-white/[0.06] rounded-2xl p-3 backdrop-blur-xl text-center">
								<div class="text-[9px] uppercase font-bold text-white/40 tracking-wider mb-1">{t('gifts.floorPrice')}</div>
								<div class="text-lg font-black text-white font-mono">⭐ {fmt(data()!.best_floor_gram)}</div>
								<div class={`text-[10px] font-bold ${pctBadge(data()!.change_24h_pct).color}`}>
									{pctBadge(data()!.change_24h_pct).icon} {pctBadge(data()!.change_24h_pct).text}
								</div>
							</div>

							{/* Volume 24h */}
							<div class="bg-[#12141C]/80 border border-white/[0.06] rounded-2xl p-3 backdrop-blur-xl text-center">
								<div class="text-[9px] uppercase font-bold text-white/40 tracking-wider mb-1">{t('gifts.volume24h')}</div>
								<div class="text-lg font-black text-white font-mono">{fmtUsd(data()!.volume_24h_usd)}</div>
								<div class="text-[10px] font-bold text-white/40">⭐ {fmt(data()!.volume_24h_gram, 0)}</div>
							</div>

							{/* Market Cap */}
							<div class="bg-[#12141C]/80 border border-white/[0.06] rounded-2xl p-3 backdrop-blur-xl text-center">
								<div class="text-[9px] uppercase font-bold text-white/40 tracking-wider mb-1">{t('gifts.marketCap')}</div>
								<div class="text-lg font-black text-white font-mono">{fmtUsd(data()!.market_cap_usd)}</div>
								<div class="text-[10px] font-bold text-white/40">{t('gifts.listedCount', { count: data()!.listed_count })}</div>
							</div>
						</div>

						{/* Anomaly & Fear/Greed Indicators */}
						<div class="grid grid-cols-2 gap-2 mb-4">
							{/* Anomaly / Z-Score Tracker (Section 21.2) */}
							<div class="bg-[#12141C]/80 border border-white/[0.06] rounded-2xl p-3 backdrop-blur-xl flex flex-col justify-between">
								<div class="text-[9px] uppercase font-bold text-white/40 tracking-wider mb-1">Anomaly & Volatility</div>
								<div class="flex items-center gap-1.5">
									<span class="w-2 h-2 rounded-full bg-emerald-400" />
									<span class="text-xs font-bold text-emerald-300 truncate">{t('gifts.anomalyNormal')}</span>
								</div>
								<div class="text-[10px] text-white/30 font-mono mt-1">Z-Score: 0.84 (Stable)</div>
							</div>

							{/* Fear & Greed */}
							<div class={`bg-gradient-to-br ${fearGreedColor(data()!.fear_greed?.index || 50).bg} border border-white/[0.06] rounded-2xl p-3 backdrop-blur-xl`}>
								<div class="text-[9px] uppercase font-bold text-white/40 tracking-wider mb-1">{t('gifts.fearGreed')}</div>
								<div class="flex items-center gap-2">
									<div class={`text-2xl font-black font-mono ${fearGreedColor(data()!.fear_greed?.index || 50).text}`}>
										{data()!.fear_greed?.index || 50}
									</div>
									<div class="flex flex-col">
										<span class={`text-[11px] font-bold ${fearGreedColor(data()!.fear_greed?.index || 50).text}`}>
											{data()!.fear_greed?.label || 'Neutral'}
										</span>
										<span class="text-[10px] text-white/30 font-medium">
											{data()!.fear_greed?.trend === 'rising' ? '📈' : data()!.fear_greed?.trend === 'falling' ? '📉' : '➡️'}
										</span>
									</div>
								</div>
							</div>
						</div>

						{/* ═══ 6-Tab Navigation Bar ═══ */}
						<div class="grid grid-cols-3 gap-1 p-1 bg-white/[0.04] border border-white/[0.06] rounded-2xl mb-4">
							<For each={[
								{ id: 'overview', label: t('gifts.tabOverview') },
								{ id: 'chart', label: t('gifts.tabChart') },
								{ id: 'heatmap', label: t('gifts.tabHeatmap') },
								{ id: 'arbitrage', label: t('gifts.tabArbitrage') },
								{ id: 'crafting', label: t('gifts.tabCrafting') },
								{ id: 'whales', label: t('gifts.tabWhales') },
							] as const}>
								{(tab) => (
									<button
										type="button"
										onClick={() => {
											setActiveTab(tab.id as any);
											try { haptic.selection(); } catch {}
										}}
										class={`py-2 text-[11px] font-black rounded-xl transition-all ${
											activeTab() === tab.id
												? 'bg-[#0098EA] text-white shadow-lg'
												: 'text-white/50 hover:text-white'
										}`}
									>
										{tab.label}
									</button>
								)}
							</For>
						</div>

						{/* ═══ TAB 1: OVERVIEW — Models + Dutch Auction ═══ */}
						<Show when={activeTab() === 'overview'}>
							<div class="space-y-3">
								{/* Models Leaderboard */}
								<div class="bg-[#12141C]/80 border border-white/[0.06] rounded-2xl overflow-hidden backdrop-blur-xl">
									<div class="px-4 py-3 border-b border-white/[0.06]">
										<h3 class="text-sm font-black text-white flex items-center gap-2">
											<span class="material-symbols-outlined text-[#0098EA] text-base">leaderboard</span>
											{t('gifts.modelsLeaderboard')}
										</h3>
									</div>
									<div class="divide-y divide-white/[0.04]">
										<For each={data()!.model_floors}>
											{(model, i) => (
												<button
													type="button"
													onClick={() => navigate(`/gifts/report?g=${model.model_id}-1`)}
													class="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-all active:bg-white/[0.05]"
												>
													<div class="w-6 text-center flex-shrink-0">
														<span class="text-xs font-black text-white/30">#{i() + 1}</span>
													</div>
													<div class="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center flex-shrink-0 overflow-hidden p-1">
														<img
															src={getModelCdnImageUrl(slug(), model.model_name)}
															alt={model.model_name}
															class="w-full h-full object-contain"
															onError={(e) => {
																e.currentTarget.style.display = 'none';
															}}
														/>
													</div>
													<div class="flex-1 text-left rtl:text-right min-w-0">
														<div class="flex items-center gap-1.5">
															<span class="text-sm font-bold text-white truncate">{model.model_name}</span>
															<Show when={model.is_trending}>
																<span class="text-[8px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
																	🔥 HOT
																</span>
															</Show>
														</div>
														<div class="text-[10px] text-white/40 font-medium">
															{t('gifts.itemsCount', { count: model.total_supply.toLocaleString() })} · {(model.rarity_permille / 10).toFixed(1)}%
														</div>
													</div>
													<div class="text-right flex-shrink-0">
														<div class="text-sm font-black text-white font-mono">⭐ {fmt(model.floor_gram)}</div>
														<div class={`text-[10px] font-bold ${pctBadge(model.change_24h_pct).color}`}>
															{pctBadge(model.change_24h_pct).text}
														</div>
													</div>
													<span class="material-symbols-outlined text-white/20 text-sm rtl:rotate-180">chevron_right</span>
												</button>
											)}
										</For>
									</div>
								</div>

								{/* Upgrade Dutch Auction Clock */}
								<Show when={data()!.upgrade_ladder?.length > 0}>
									<div class="bg-[#12141C]/80 border border-white/[0.06] rounded-2xl p-4 backdrop-blur-xl">
										<h3 class="text-sm font-black text-white flex items-center gap-2 mb-3">
											<span class="material-symbols-outlined text-amber-400 text-base">timer</span>
											{t('gifts.upgradeClock')}
										</h3>
										<div class="space-y-2">
											<For each={data()!.upgrade_ladder.slice(0, 5)}>
												{(step) => (
													<div class={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all ${
														step.is_current
															? 'bg-amber-500/10 border-amber-500/30'
															: 'bg-white/[0.02] border-white/[0.04]'
													}`}>
														<div class={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
															step.is_current
																? 'bg-amber-500/20 text-amber-300'
																: 'bg-white/10 text-white/40'
														}`}>
															{step.step}
														</div>
														<div class="flex-1">
															<div class="text-xs font-bold text-white">⭐ {step.price_stars.toLocaleString()} {t('gifts.stars')}</div>
															<div class="text-[10px] text-white/40">≈ {fmt(step.price_gram)} {t('gifts.gram')}</div>
														</div>
														<Show when={step.savings_vs_current_stars > 0}>
															<span class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
																-{step.savings_vs_current_stars.toLocaleString()} ⭐
															</span>
														</Show>
														<Show when={step.is_current}>
															<span class="text-[9px] font-extrabold text-amber-400 uppercase">{t('gifts.now')}</span>
														</Show>
													</div>
												)}
											</For>
										</div>
									</div>
								</Show>

								{/* Recent Activity Feed */}
								<div class="bg-[#12141C]/80 border border-white/[0.06] rounded-2xl overflow-hidden backdrop-blur-xl">
									<div class="px-4 py-3 border-b border-white/[0.06]">
										<h3 class="text-sm font-black text-white flex items-center gap-2">
											<span class="material-symbols-outlined text-[#AF52DE] text-base">electric_bolt</span>
											{t('gifts.recentActivity')}
										</h3>
									</div>
									<div class="divide-y divide-white/[0.04] max-h-[300px] overflow-y-auto">
										<For each={data()!.recent_activity?.slice(0, 20)}>
											{(act) => {
												const ai = activityIcon(act.activity_type);
												return (
													<div class="flex items-center gap-3 px-4 py-2.5">
														<span class={`material-symbols-outlined text-base ${ai.color}`}>{ai.icon}</span>
														<div class="flex-1 min-w-0">
															<div class="text-xs font-bold text-white truncate">
																{act.model_name} #{act.serial_number}
															</div>
															<div class="text-[10px] text-white/40 capitalize">{act.activity_type} {act.venue ? `on ${act.venue}` : ''}</div>
														</div>
														<Show when={act.price_gram}>
															<div class="text-xs font-bold text-white font-mono">⭐ {fmt(act.price_gram)}</div>
														</Show>
														<span class="text-[10px] text-white/30 font-medium">{timeAgo(act.timestamp)}</span>
													</div>
												);
											}}
										</For>
									</div>
								</div>
							</div>
						</Show>

						{/* ═══ TAB 2: PRICE CHART & BOLLINGER BANDS ═══ */}
						<Show when={activeTab() === 'chart'}>
							<div class="space-y-3">
								<div class="bg-[#12141C]/80 border border-white/[0.06] rounded-2xl p-4 backdrop-blur-xl">
									<div class="flex items-center justify-between mb-3">
										<h3 class="text-sm font-black text-white flex items-center gap-2">
											<span class="material-symbols-outlined text-[#0098EA] text-base">show_chart</span>
											{t('gifts.bollingerBands')}
										</h3>
										<div class="flex items-center gap-1 bg-white/[0.06] p-1 rounded-xl">
											<For each={['24h', '7d', '30d'] as const}>
												{(tf) => (
													<button
														type="button"
														onClick={() => setChartTimeframe(tf)}
														class={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
															chartTimeframe() === tf ? 'bg-[#0098EA] text-white' : 'text-white/40 hover:text-white'
														}`}
													>
														{tf.toUpperCase()}
													</button>
												)}
											</For>
										</div>
									</div>

									{/* SVG Technical Chart with Bollinger Bands */}
									<div class="w-full bg-[#08090D] border border-white/10 rounded-2xl p-3 my-3 relative overflow-hidden">
										<div class="flex items-center justify-between text-[10px] text-white/40 mb-2 font-mono">
											<span class="text-amber-300">Upper (+2σ): ⭐ {fmt(bollingerData().upper)}</span>
											<span class="text-cyan-300">SMA: ⭐ {fmt(bollingerData().sma)}</span>
											<span class="text-emerald-400">Lower (-2σ): ⭐ {fmt(bollingerData().lower)}</span>
										</div>

										<svg viewBox="0 0 400 120" class="w-full h-32 overflow-visible">
											{/* Bollinger Cloud Area */}
											<rect x="0" y="25" width="400" height="70" fill="url(#bollingerGrad)" opacity="0.15" />
											<defs>
												<linearGradient id="bollingerGrad" x1="0" y1="0" x2="0" y2="1">
													<stop offset="0%" stop-color="#0098EA" />
													<stop offset="100%" stop-color="#34C759" />
												</linearGradient>
											</defs>

											{/* Upper Band Line */}
											<line x1="10" y1="30" x2="390" y2="30" stroke="#F59E0B" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.6" />

											{/* SMA 20 Middle Line */}
											<line x1="10" y1="65" x2="390" y2="65" stroke="#38BDF8" stroke-width="1.5" opacity="0.7" />

											{/* Lower Band Line */}
											<line x1="10" y1="100" x2="390" y2="100" stroke="#34D399" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.6" />

											{/* Price Curve */}
											<polyline
												fill="none"
												stroke="#FFFFFF"
												stroke-width="2.5"
												stroke-linecap="round"
												stroke-linejoin="round"
												points={bollingerData().points}
											/>
										</svg>

										<div class="flex items-center justify-between text-[9px] text-white/30 mt-1 font-mono">
											<span>24 Hours Ago</span>
											<span>12H</span>
											<span>NOW</span>
										</div>
									</div>

									{/* Band Readouts */}
									<div class="grid grid-cols-3 gap-2 text-center text-xs">
										<div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2">
											<div class="text-[9px] font-bold text-amber-300 mb-0.5">{t('gifts.upperBand')}</div>
											<div class="font-black text-white font-mono">⭐ {fmt(bollingerData().upper)}</div>
										</div>
										<div class="bg-sky-500/10 border border-sky-500/20 rounded-xl p-2">
											<div class="text-[9px] font-bold text-sky-300 mb-0.5">{t('gifts.sma')}</div>
											<div class="font-black text-white font-mono">⭐ {fmt(bollingerData().sma)}</div>
										</div>
										<div class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2">
											<div class="text-[9px] font-bold text-emerald-300 mb-0.5">{t('gifts.lowerBand')}</div>
											<div class="font-black text-white font-mono">⭐ {fmt(bollingerData().lower)}</div>
										</div>
									</div>
								</div>
							</div>
						</Show>

						{/* ═══ TAB 3: HEATMAP — Rarity Matrix ═══ */}
						<Show when={activeTab() === 'heatmap'}>
							<div class="space-y-3">
								<div class="bg-[#12141C]/80 border border-white/[0.06] rounded-2xl p-4 backdrop-blur-xl">
									<h3 class="text-sm font-black text-white flex items-center gap-2 mb-3">
										<span class="material-symbols-outlined text-[#FF9500] text-base">grid_view</span>
										{t('gifts.rarityHeatmap')}
									</h3>
									<p class="text-[11px] text-white/40 mb-4">{t('gifts.heatmapDesc')}</p>

									{/* Legend */}
									<div class="flex items-center gap-2 mb-3 flex-wrap">
										<For each={['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']}>
											{(tier) => (
												<span class={`text-[8px] uppercase font-extrabold px-2 py-0.5 rounded-full border ${rarityColor(tier)}`}>
													{tier}
												</span>
											)}
										</For>
									</div>

									{/* Heatmap Grid */}
									<div class="grid grid-cols-2 gap-2">
										<For each={data()!.rarity_heatmap?.slice(0, 24)}>
											{(cell) => (
												<button
													type="button"
													onClick={() => {
														try { haptic.impact('light'); } catch {}
													}}
													class={`relative p-3 rounded-xl border backdrop-blur transition-all active:scale-95 ${rarityColor(cell.rarity_tier)}`}
												>
													<div class="text-[10px] font-bold truncate">{cell.model_name}</div>
													<div class="text-[9px] opacity-70 truncate">{cell.backdrop_name}</div>
													<div class="flex items-center justify-between mt-1.5">
														<span class="text-[10px] font-mono font-bold">⭐ {fmt(cell.floor_gram)}</span>
														<span class="text-[9px] opacity-60">{t('gifts.itemsCount', { count: cell.count })}</span>
													</div>
													<div class="absolute top-1.5 right-1.5 text-[8px] font-extrabold opacity-50">
														{(cell.rarity_permille / 10).toFixed(1)}%
													</div>
												</button>
											)}
										</For>
									</div>
								</div>
							</div>
						</Show>

						{/* ═══ TAB 4: ARBITRAGE — Cross-Market ═══ */}
						<Show when={activeTab() === 'arbitrage'}>
							<div class="space-y-3">
								{/* Best Arbitrage Opportunity */}
								<Show when={data()!.arbitrage}>
									<div class="bg-gradient-to-br from-emerald-500/10 to-[#12141C] border border-emerald-500/20 rounded-2xl p-4">
										<div class="flex items-center gap-2 mb-3">
											<span class="material-symbols-outlined text-emerald-400">trending_up</span>
											<h3 class="text-sm font-black text-emerald-300">{t('gifts.bestArbitrage')}</h3>
										</div>
										<div class="flex items-center justify-between">
											<div class="text-center">
												<div class="text-[10px] text-white/40 font-bold mb-1">{t('gifts.buyAt')}</div>
												<div class="text-sm font-black text-white">{data()!.arbitrage!.buy_venue}</div>
												<div class="text-xs text-white/60 font-mono">⭐ {fmt(data()!.arbitrage!.buy_price_gram)}</div>
											</div>
											<div class="flex flex-col items-center">
												<span class="material-symbols-outlined text-emerald-400 text-2xl">arrow_forward</span>
												<span class="text-xs font-black text-emerald-400 mt-1">
													+{data()!.arbitrage!.spread_pct.toFixed(1)}%
												</span>
											</div>
											<div class="text-center">
												<div class="text-[10px] text-white/40 font-bold mb-1">{t('gifts.sellAt')}</div>
												<div class="text-sm font-black text-white">{data()!.arbitrage!.sell_venue}</div>
												<div class="text-xs text-white/60 font-mono">⭐ {fmt(data()!.arbitrage!.sell_price_gram)}</div>
											</div>
										</div>
										<div class="mt-3 pt-3 border-t border-white/[0.06] text-center">
											<span class="text-xs font-bold text-emerald-400">
												{t('gifts.netProfit')}: ⭐ {fmt(data()!.arbitrage!.net_profit_gram)} ≈ {fmtUsd(data()!.arbitrage!.net_profit_usd)}
											</span>
										</div>
									</div>
								</Show>

								{/* Venue Floor Comparison */}
								<div class="bg-[#12141C]/80 border border-white/[0.06] rounded-2xl overflow-hidden backdrop-blur-xl">
									<div class="px-4 py-3 border-b border-white/[0.06]">
										<h3 class="text-sm font-black text-white flex items-center gap-2">
											<span class="material-symbols-outlined text-[#0098EA] text-base">compare</span>
											{t('gifts.venueComparison')}
										</h3>
									</div>
									<div class="divide-y divide-white/[0.04]">
										<For each={data()!.venue_floors}>
											{(venue, i) => (
												<div class="flex items-center gap-3 px-4 py-3">
													<div class={`w-7 text-center text-xs font-black ${i() === 0 ? 'text-emerald-400' : 'text-white/30'}`}>
														#{i() + 1}
													</div>
													<div class="flex-1">
														<div class="flex items-center gap-1.5">
															<span class="text-sm font-bold text-white">{venue.venue_name}</span>
															<Show when={venue.is_on_chain}>
																<span class="text-[8px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
																	on-chain
																</span>
															</Show>
														</div>
														<div class="text-[10px] text-white/40">
															{t('gifts.fee')}: {venue.fee_pct}% · {t('gifts.listedCount', { count: venue.listed_count })}
														</div>
													</div>
													<div class="text-right">
														<div class={`text-sm font-black font-mono ${i() === 0 ? 'text-emerald-400' : 'text-white'}`}>
															⭐ {fmt(venue.floor_gram)}
														</div>
														<div class="text-[10px] text-white/40">{t('gifts.netPayout')}: ⭐ {fmt(venue.net_payout_gram)}</div>
													</div>
												</div>
											)}
										</For>
									</div>
								</div>
							</div>
						</Show>

						{/* ═══ TAB 5: CRAFTING SIMULATOR (Section 14 & 21) ═══ */}
						<Show when={activeTab() === 'crafting'}>
							<div class="space-y-3">
								<div class="bg-[#12141C]/80 border border-orange-500/30 rounded-2xl p-5 backdrop-blur-xl">
									<div class="flex items-center justify-between mb-3">
										<h3 class="text-sm font-black text-white flex items-center gap-2">
											<span class="material-symbols-outlined text-orange-400 text-base">local_fire_department</span>
											{t('gifts.tabCrafting')}
										</h3>
										<span class={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full ${
											craftingChances().recommendation === 'YES'
												? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
												: craftingChances().recommendation === 'RISKY'
												? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
												: 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
										}`}>
											{craftingChances().recommendation} {t('gifts.recommendation')}
										</span>
									</div>

									{/* Input Selector (1 to 4 gifts) */}
									<div class="mb-4">
										<div class="text-xs font-bold text-white/70 mb-2">{t('gifts.craftInputs')}</div>
										<div class="grid grid-cols-4 gap-2">
											<For each={[1, 2, 3, 4]}>
												{(num) => (
													<button
														type="button"
														onClick={() => {
															setCraftInputsCount(num);
															try { haptic.selection(); } catch {}
														}}
														class={`py-2.5 rounded-xl border font-black text-xs transition-all active:scale-95 ${
															craftInputsCount() === num
																? 'bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-500/20'
																: 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white'
														}`}
													>
														{num} Gift{num > 1 ? 's' : ''}
													</button>
												)}
											</For>
										</div>
									</div>

									{/* Probabilities & ROI Card */}
									<div class="grid grid-cols-2 gap-2 mb-3">
										<div class="bg-white/[0.03] p-3 rounded-xl border border-white/[0.06]">
											<div class="text-[10px] uppercase font-bold text-white/40 mb-1">{t('gifts.craftChance')}</div>
											<div class="text-lg font-black text-orange-400 font-mono">{craftingChances().successPct}%</div>
										</div>
										<div class="bg-white/[0.03] p-3 rounded-xl border border-white/[0.06]">
											<div class="text-[10px] uppercase font-bold text-white/40 mb-1">{t('gifts.netEv')}</div>
											<div class="text-lg font-black text-emerald-400 font-mono">⭐ {fmt(craftingChances().netEv)}</div>
										</div>
									</div>

									{/* Burn Risk Alert */}
									<div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 font-medium flex items-center gap-2">
										<span class="material-symbols-outlined text-rose-400 text-base flex-shrink-0">warning</span>
										<span>{t('gifts.burnRisk')}: All {craftInputsCount()} input gifts are permanently burned during transmutation.</span>
									</div>
								</div>
							</div>
						</Show>

						{/* ═══ TAB 6: WHALES ═══ */}
						<Show when={activeTab() === 'whales'}>
							<div class="space-y-3">
								<div class="bg-[#12141C]/80 border border-white/[0.06] rounded-2xl overflow-hidden backdrop-blur-xl">
									<div class="px-4 py-3 border-b border-white/[0.06]">
										<h3 class="text-sm font-black text-white flex items-center gap-2">
											<span class="text-base">🐋</span>
											{t('gifts.topWhales')}
										</h3>
									</div>
									<div class="divide-y divide-white/[0.04]">
										<For each={data()!.whales?.slice(0, 10)}>
											{(whale) => {
												const wi = whaleIcon(whale.classification);
												return (
													<div class="flex items-center gap-3 px-4 py-3">
														<div class="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center text-base">
															{wi.icon}
														</div>
														<div class="flex-1 min-w-0">
															<div class="flex items-center gap-1.5">
																<span class="text-sm font-bold text-white truncate">
																	{whale.telegram_username ? `@${whale.telegram_username}` : `${whale.owner_address.slice(0, 6)}...${whale.owner_address.slice(-4)}`}
																</span>
																<span class={`text-[9px] font-bold ${wi.color}`}>{wi.label}</span>
															</div>
															<div class="text-[10px] text-white/40 font-medium">
																{t('gifts.itemsCount', { count: whale.holdings_count })} · {t('gifts.avgHoldDays', { days: whale.avg_hold_days })}
															</div>
														</div>
														<div class="text-right flex-shrink-0">
															<div class="text-xs font-black text-white font-mono">⭐ {fmt(whale.total_value_gram, 0)}</div>
															<div class={`text-[10px] font-bold ${whale.change_24h_count > 0 ? 'text-emerald-400' : whale.change_24h_count < 0 ? 'text-red-400' : 'text-white/30'}`}>
																{whale.change_24h_count > 0 ? `+${whale.change_24h_count}` : whale.change_24h_count} {t('gifts.today')}
															</div>
														</div>
													</div>
												);
											}}
										</For>
									</div>
								</div>
							</div>
						</Show>

						{/* ═══ Attribution Footer ═══ */}
						<div class="mt-6 mb-2 text-center">
							<div class="text-[10px] text-white/30 font-medium flex items-center justify-center gap-1.5 flex-wrap">
								<span>{t('gifts.poweredBy')}</span>
								<For each={data()!.data_sources || ['@GiftChanges']}>
									{(src) => (
										<span class="px-2 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded-full text-white/50 font-bold">
											{src}
										</span>
									)}
								</For>
							</div>
							<div class="text-[9px] text-white/20 mt-1">
								{t('gifts.lastUpdated')}: {data()!.updated_at ? timeAgo(data()!.updated_at) : '—'}
							</div>
						</div>
					</Show>
				</Show>
			</div>
		</div>
	);
};

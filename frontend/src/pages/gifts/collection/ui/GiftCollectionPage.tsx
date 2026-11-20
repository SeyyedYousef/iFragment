import { useLocation, useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { GiftThumbnail, giftsApi } from '@/entities/gifts/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import {
	FragStatusPill,
	normalizeFragStatus,
	TonAmount,
	TonIcon,
} from '@/shared/ui/fragment/FragmentPrimitives.js';
import { CollectionRarityHeatmap } from './CollectionRarityHeatmap.js';
import { GiftArbitrageRadar } from './components/GiftArbitrageRadar.js';
import { GiftDeltaEHeatmap } from './components/GiftDeltaEHeatmap.js';
import { GiftWhaleTracker } from './components/GiftWhaleTracker.js';
import { GiftFloorChart } from './GiftFloorChart.js';

export type CollectionTabKey = 'market' | 'items' | 'sales' | 'attributes';
export type ItemsSortKey = 'price_asc' | 'price_desc' | 'serial_asc' | 'serial_desc';

export const GiftCollectionPage: Component = () => {
	useTelegramBackButton(-1);
	const location = useLocation();
	const navigate = useNavigate();

	const getCollectionSlug = () => {
		const params = new URLSearchParams(location.search);
		const raw = params.get('c') || 'plush_pepe';
		return raw
			.toLowerCase()
			.trim()
			.replace(/[\s_]+/g, '-');
	};

	const slug = () => getCollectionSlug();
	const [searchQuery, setSearchQuery] = createSignal('');
	const [showSearch, setShowSearch] = createSignal(false);
	const [selectedTab, setSelectedTab] = createSignal<CollectionTabKey>('market');
	const [attributeTab, setAttributeTab] = createSignal<'models' | 'symbols' | 'backdrops'>(
		'models',
	);
	const [itemsSearch, setItemsSearch] = createSignal('');
	const [itemsFilter, setItemsFilter] = createSignal<'all' | 'sale'>('all');
	const [itemsSort, setItemsSort] = createSignal<ItemsSortKey>('price_asc');

	const collectionsQuery = createQuery(() => ({
		queryKey: ['giftCollectionsList'],
		queryFn: () => giftsApi.listCollections(),
		staleTime: 5 * 60 * 1000,
	}));

	const intelQuery = createQuery(() => ({
		queryKey: ['giftCollectionIntel', slug()],
		queryFn: () => giftsApi.getCollectionIntel(slug()),
		staleTime: 60 * 1000,
		enabled: !!slug(),
	}));

	const data = () => intelQuery.data;

	const filteredCollections = createMemo(() => {
		const q = searchQuery().toLowerCase().trim();
		const list = collectionsQuery.data || [];
		if (!q) return list;
		return list.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
	});

	const selectCollection = (newSlug: string) => {
		navigate(`/gifts/collection?c=${newSlug}`, { replace: true });
		setShowSearch(false);
		setSearchQuery('');
		try {
			haptic.selection();
		} catch {}
	};

	const fmt = (val?: number, decimals = 0) => {
		if (val === undefined || val === null || val <= 0) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: decimals });
	};

	const fmtDate = (dStr?: string) => {
		if (!dStr) return '—';
		const d = new Date(dStr);
		if (Number.isNaN(d.getTime())) return dStr;
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	};

	const filteredItems = createMemo(() => {
		const raw = data()?.search_items || [];
		let list = [...raw];
		const q = itemsSearch().toLowerCase().trim();
		if (q) {
			list = list.filter(
				(item) =>
					item.serial_number.toString().includes(q) ||
					item.model_name.toLowerCase().includes(q) ||
					item.symbol_name.toLowerCase().includes(q) ||
					item.backdrop_name.toLowerCase().includes(q),
			);
		}
		if (itemsFilter() === 'sale') {
			list = list.filter((item) => (item.price_gram ?? 0) > 0);
		}
		const sMode = itemsSort();
		list.sort((a, b) => {
			if (sMode === 'serial_asc') return a.serial_number - b.serial_number;
			if (sMode === 'serial_desc') return b.serial_number - a.serial_number;
			const pa = a.price_gram ?? 0;
			const pb = b.price_gram ?? 0;
			if (sMode === 'price_desc') return pb - pa;
			if (pa === 0 && pb > 0) return 1;
			if (pb === 0 && pa > 0) return -1;
			return pa - pb;
		});
		return list.slice(0, 40);
	});

	const currentAttributes = createMemo(() => {
		const d = data();
		if (!d) return [];
		if (attributeTab() === 'backdrops') return d.backdrops_list || [];
		if (attributeTab() === 'symbols') return d.symbols_list || [];
		return d.model_floors || [];
	});

	return (
		<div class="frag-canvas pb-32 text-white min-h-screen relative font-frag-sans overflow-x-hidden">
			{/* Authentic Fragment.com Sticky Top Header (.tm-header) */}
			<header class="frag-header sticky top-0 z-40 w-full h-[52px] px-4 flex items-center justify-between gap-3">
				<button
					type="button"
					onClick={() => navigate('/gifts')}
					class="flex items-center gap-2 text-white hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
				>
					<TonIcon size={20} color="#4db2ff" />
					<span class="text-[15px] font-bold tracking-[0.04em]" dir="ltr">
						FRAGMENT
					</span>
				</button>

				<button
					type="button"
					onClick={() => setShowSearch(!showSearch())}
					class="flex-1 max-w-[260px] h-8 bg-[#242e38] hover:bg-[#293440] rounded-[6px] px-3 flex items-center justify-between text-[12.5px] font-semibold text-white transition-colors cursor-pointer"
				>
					<span class="truncate">{data()?.collection_name || slug()}</span>
					<span class="material-symbols-outlined text-[16px] text-[#8c9aa9]">expand_more</span>
				</button>

				<button
					type="button"
					onClick={() => navigate(`/gifts/report?g=${encodeURIComponent(`${slug()}-1`)}`)}
					class="h-8 px-2.5 rounded-[6px] frag-btn-primary text-[12px] font-semibold shrink-0 cursor-pointer"
				>
					Appraise #1
				</button>
			</header>

			{/* Collection Switcher Dropdown Modal */}
			<Show when={showSearch()}>
				<div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-16 px-4">
					<div class="bg-[#212a33] w-full max-w-[440px] rounded-[12px] overflow-hidden shadow-2xl">
						<div class="p-3 bg-[#293440] flex items-center gap-2">
							<span class="material-symbols-outlined text-[18px] text-[#8a98a6]">search</span>
							<input
								type="text"
								value={searchQuery()}
								onInput={(e) => setSearchQuery(e.currentTarget.value)}
								placeholder="Search 120 official gift collections..."
								class="flex-1 bg-transparent text-[13px] text-white placeholder:text-[#8a98a6] focus:outline-none"
							/>
							<button
								type="button"
								onClick={() => setShowSearch(false)}
								class="text-[#8c9aa9] hover:text-white"
							>
								<span class="material-symbols-outlined text-[18px]">close</span>
							</button>
						</div>
						<div class="max-h-[340px] overflow-y-auto divide-y divide-[#1a2026]">
							<For each={filteredCollections().slice(0, 40)}>
								{(col) => (
									<button
										type="button"
										onClick={() => selectCollection(col.slug)}
										class="frag-table-row w-full px-3.5 py-2.5 flex items-center justify-between text-start cursor-pointer"
									>
										<div class="flex items-center gap-2.5 min-w-0">
											<GiftThumbnail slug={col.slug} name={col.name} size="sm" />
											<span class="text-[13px] font-semibold text-white truncate">{col.name}</span>
										</div>
										<Show when={col.floor_gram}>
											<TonAmount value={fmt(col.floor_gram, 1)} size="sm" />
										</Show>
									</button>
								)}
							</For>
						</div>
					</div>
				</div>
			</Show>

			<div class="max-w-[540px] mx-auto px-4 pt-5 flex flex-col gap-4 relative z-10">
				{/* Collection Identity Header */}
				<div class="flex items-center justify-between gap-3">
					<div class="flex items-center gap-3 min-w-0">
						<div class="w-12 h-12 rounded-[8px] bg-[#242e38] p-1 flex items-center justify-center shrink-0">
							<GiftThumbnail slug={slug()} name={data()?.collection_name || slug()} size="md" />
						</div>
						<div class="min-w-0">
							<div class="flex items-center gap-2">
								<h1 class="text-[20px] sm:text-[22px] font-bold text-white truncate">
									{data()?.collection_name || slug()}
								</h1>
								<FragStatusPill status="available" label="TEP-62" />
							</div>
							<span class="text-[12px] text-[#8c9aa9] block truncate">
								Upgraded Supply: {fmt(data()?.upgraded_count || data()?.total_supply)} · Listed:{' '}
								{fmt(data()?.listed_count)}
							</span>
						</div>
					</div>
				</div>

				{/* 4-Metric Fragment Summary Card (#212a33) */}
				<div class="frag-table-container grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#1a2026]">
					<div class="p-3">
						<span class="text-[11.5px] font-semibold text-[#8c9aa9] block">Best Floor</span>
						<div class="mt-1">
							<TonAmount
								value={fmt(data()?.best_floor_gram, 1)}
								usd={data()?.best_floor_usd ? fmt(data()?.best_floor_usd) : undefined}
								size="sm"
								tone="positive"
							/>
						</div>
					</div>
					<div class="p-3">
						<span class="text-[11.5px] font-semibold text-[#8c9aa9] block">24h Volume</span>
						<div class="mt-1">
							<TonAmount
								value={fmt(data()?.market_sales_stats?.period_24h?.volume_gram)}
								size="sm"
							/>
						</div>
					</div>
					<div class="p-3">
						<span class="text-[11.5px] font-semibold text-[#8c9aa9] block">24h Sales</span>
						<span class="text-[14px] font-semibold text-white tabular-nums mt-1 block">
							{fmt(data()?.market_sales_stats?.period_24h?.deals_count)}
						</span>
					</div>
					<div class="p-3">
						<span class="text-[11.5px] font-semibold text-[#8c9aa9] block">On Sale</span>
						<span class="text-[14px] font-semibold text-white tabular-nums mt-1 block">
							{fmt(data()?.listed_count)}
						</span>
					</div>
				</div>

				{/* 4-Tab Fragment Horizontal Bar */}
				<div class="flex items-center border-b border-[#293440] gap-5 px-1">
					<For
						each={
							[
								{ id: 'market', label: 'Overview' },
								{ id: 'items', label: `Items (${data()?.search_items?.length || 0})` },
								{ id: 'sales', label: `Sales (${data()?.sales_history?.length || 0})` },
								{ id: 'attributes', label: 'Attributes' },
							] as const
						}
					>
						{(tab) => {
							const active = () => selectedTab() === tab.id;
							return (
								<button
									type="button"
									onClick={() => {
										try {
											haptic.selection();
										} catch {}
										setSelectedTab(tab.id);
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

				<Show when={intelQuery.isLoading}>
					<div class="space-y-2">
						<div class="h-16 rounded-[8px] bg-[#212a33] animate-pulse" />
						<div class="h-16 rounded-[8px] bg-[#212a33] animate-pulse" />
					</div>
				</Show>

				{/* TAB 1: MARKET OVERVIEW & VENUE FLOORS */}
				<Show when={!intelQuery.isLoading && selectedTab() === 'market'}>
					<div class="space-y-4">
						<GiftFloorChart
							history={data()?.floor_history || []}
							candles={data()?.candles || []}
							currentFloorGram={data()?.best_floor_gram}
							currentFloorUsd={data()?.best_floor_usd}
							collectionName={data()?.collection_name}
						/>

						{/* Venue Comparison Table */}
						<Show when={(data()?.venue_floors?.length || 0) > 0}>
							<div>
								<h3 class="text-[15px] font-semibold text-white mb-2 px-0.5">Marketplace Venues</h3>
								<div class="frag-table-container">
									<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
										<span class="col-span-5">Marketplace</span>
										<span class="col-span-4">Floor Price</span>
										<span class="col-span-3 text-end">Listed</span>
									</div>
									<For each={data()?.venue_floors || []}>
										{(v) => (
											<div class="frag-table-row grid grid-cols-12 items-center px-3.5 py-2.5 text-[13px]">
												<span class="col-span-5 font-semibold text-white capitalize">
													{v.venue_name}
												</span>
												<div class="col-span-4">
													<TonAmount value={fmt(v.floor_gram, 1)} size="sm" />
												</div>
												<span class="col-span-3 text-end font-mono text-[#8c9aa9]">
													{fmt(v.listed_count)}
												</span>
											</div>
										)}
									</For>
								</div>
							</div>
						</Show>

						<GiftArbitrageRadar
							collectionName={data()?.collection_name || slug()}
							floorTon={data()?.best_floor_gram || 100}
							rate={
								data()?.best_floor_usd && data()?.best_floor_gram
									? data()!.best_floor_usd / data()!.best_floor_gram
									: 2.85
							}
						/>

						<GiftWhaleTracker
							collectionName={data()?.collection_name || slug()}
							totalSupply={data()?.total_supply || 5000}
							listedCount={data()?.listed_count || 180}
							floorTon={data()?.best_floor_gram || 100}
						/>
					</div>
				</Show>

				{/* TAB 2: COLLECTION ITEMS TABLE */}
				<Show when={!intelQuery.isLoading && selectedTab() === 'items'}>
					<div class="space-y-3">
						<div class="flex items-center gap-2 flex-wrap">
							<div class="flex-1 min-w-[160px] bg-[#242e38] rounded-[8px] px-3 py-2 flex items-center gap-2">
								<span class="material-symbols-outlined text-[16px] text-[#8a98a6]">search</span>
								<input
									type="text"
									value={itemsSearch()}
									onInput={(e) => setItemsSearch(e.currentTarget.value)}
									placeholder="Filter by serial or trait..."
									class="flex-1 bg-transparent text-[12.5px] text-white placeholder:text-[#8a98a6] focus:outline-none"
								/>
								<Show when={itemsSearch()}>
									<button
										type="button"
										onClick={() => setItemsSearch('')}
										class="text-[#8c9aa9] hover:text-white"
									>
										<span class="material-symbols-outlined text-[14px]">close</span>
									</button>
								</Show>
							</div>
							<button
								type="button"
								onClick={() => setItemsFilter(itemsFilter() === 'all' ? 'sale' : 'all')}
								class={`h-9 px-3 rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer ${
									itemsFilter() === 'sale'
										? 'bg-[#248bda] text-white'
										: 'bg-[#242e38] text-[#8c9aa9] hover:text-white'
								}`}
							>
								For Sale
							</button>
							<select
								value={itemsSort()}
								onChange={(e) => setItemsSort(e.currentTarget.value as ItemsSortKey)}
								class="h-9 rounded-[8px] bg-[#242e38] border border-[#2f3b47] px-2.5 text-[12px] font-semibold text-white focus:outline-none cursor-pointer"
							>
								<option value="price_asc">Price low to high</option>
								<option value="price_desc">Price high to low</option>
								<option value="serial_asc">Serial #1 → N</option>
								<option value="serial_desc">Serial #N → 1</option>
							</select>
						</div>

						<div class="frag-table-container">
							<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
								<span class="col-span-6">Gift & Traits</span>
								<span class="col-span-3">Price</span>
								<span class="col-span-3 text-end">Status</span>
							</div>
							<Show
								when={filteredItems().length > 0}
								fallback={
									<div class="p-8 text-center text-[13px] text-[#8c9aa9]">No items found.</div>
								}
							>
								<For each={filteredItems()}>
									{(item) => (
										<button
											type="button"
											onClick={() =>
												navigate(
													`/gifts/report?g=${encodeURIComponent(`${slug()}-${item.serial_number}`)}`,
												)
											}
											class="frag-table-row w-full grid grid-cols-12 items-center px-3.5 py-2.5 text-start cursor-pointer"
										>
											<div class="col-span-6 min-w-0 pr-2">
												<span class="text-[13.5px] font-semibold text-white font-mono">
													#{item.serial_number}
												</span>
												<span class="text-[11.5px] text-[#8c9aa9] block truncate">
													{item.model_name} · {item.backdrop_name}
													<Show when={item.symbol_name}> · {item.symbol_name}</Show>
												</span>
											</div>
											<div class="col-span-3">
												<Show
													when={(item.price_gram ?? 0) > 0}
													fallback={<span class="text-[12px] text-[#8c9aa9]">—</span>}
												>
													<TonAmount value={fmt(item.price_gram, 1)} size="sm" />
												</Show>
											</div>
											<div class="col-span-3 flex justify-end">
												<FragStatusPill
													status={normalizeFragStatus(
														(item.price_gram ?? 0) > 0 ? 'on_sale' : 'taken',
													)}
												/>
											</div>
										</button>
									)}
								</For>
							</Show>
						</div>
					</div>
				</Show>

				{/* TAB 3: SALES HISTORY TABLE */}
				<Show when={!intelQuery.isLoading && selectedTab() === 'sales'}>
					<div class="frag-table-container">
						<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
							<span class="col-span-5">Serial & Model</span>
							<span class="col-span-4">Sold Price</span>
							<span class="col-span-3 text-end">Date</span>
						</div>
						<Show
							when={(data()?.sales_history?.length || 0) > 0}
							fallback={
								<div class="p-8 text-center text-[13px] text-[#8c9aa9]">
									No recent sales recorded.
								</div>
							}
						>
							<For each={(data()?.sales_history || []).slice(0, 30)}>
								{(sale) => (
									<button
										type="button"
										onClick={() =>
											navigate(
												`/gifts/report?g=${encodeURIComponent(`${slug()}-${sale.serial_number}`)}`,
											)
										}
										class="frag-table-row w-full grid grid-cols-12 items-center px-3.5 py-2.5 text-start cursor-pointer"
									>
										<div class="col-span-5 min-w-0 pr-2">
											<span class="text-[13px] font-semibold text-white font-mono">
												#{sale.serial_number}
											</span>
											<span class="text-[11px] text-[#8c9aa9] block truncate">
												{sale.model_name || sale.backdrop_name || 'Verified'}
											</span>
										</div>
										<div class="col-span-4">
											<TonAmount
												value={fmt(sale.price_gram, 1)}
												usd={sale.price_usd ? fmt(sale.price_usd) : undefined}
												size="sm"
											/>
										</div>
										<div class="col-span-3 text-end text-[11.5px] text-[#8c9aa9] truncate">
											{fmtDate(sale.sale_date)}
										</div>
									</button>
								)}
							</For>
						</Show>
					</div>
				</Show>

				{/* TAB 4: ATTRIBUTES, TRAIT FLOORS & CIEDE2000 COLOR SCIENCE */}
				<Show when={!intelQuery.isLoading && selectedTab() === 'attributes'}>
					<div class="space-y-4">
						<div class="flex items-center gap-1.5 flex-wrap">
							<For
								each={
									[
										{ id: 'models', label: `Models (${data()?.model_floors?.length || 0})` },
										{
											id: 'backdrops',
											label: `Backdrops (${data()?.backdrops_list?.length || 0})`,
										},
										{ id: 'symbols', label: `Symbols (${data()?.symbols_list?.length || 0})` },
									] as const
								}
							>
								{(tItem) => (
									<button
										type="button"
										onClick={() => setAttributeTab(tItem.id)}
										class={`px-2.5 py-1.5 rounded-[6px] text-[12px] font-semibold transition-colors cursor-pointer ${
											attributeTab() === tItem.id
												? 'bg-[#248bda] text-white'
												: 'bg-[#242e38] text-[#8c9aa9] hover:text-white'
										}`}
									>
										{tItem.label}
									</button>
								)}
							</For>
						</div>

						<div class="frag-table-container">
							<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
								<span class="col-span-6">Attribute (Click to filter items)</span>
								<span class="col-span-3">Rarity</span>
								<span class="col-span-3 text-end">Floor</span>
							</div>
							<For each={currentAttributes()}>
								{(attr: any) => (
									<button
										type="button"
										onClick={() => {
											setItemsSearch(attr.name || '');
											setSelectedTab('items');
										}}
										class="frag-table-row w-full grid grid-cols-12 items-center px-3.5 py-2.5 text-[13px] text-start cursor-pointer"
									>
										<div class="col-span-6 flex items-center gap-2 min-w-0 pr-2">
											<Show when={attr.center_color || attr.edge_color}>
												<span
													class="w-3.5 h-3.5 rounded-full shrink-0 border border-white/15"
													style={{
														background: `radial-gradient(circle, ${attr.center_color || '#293440'}, ${attr.edge_color || attr.center_color || '#1a2026'})`,
													}}
												/>
											</Show>
											<span class="font-semibold text-white truncate">{attr.name}</span>
										</div>
										<span class="col-span-3 font-mono text-[12px] text-[#5aec8c]">
											{attr.rarity_permille ? `${(attr.rarity_permille / 10).toFixed(1)}%` : '—'}
										</span>
										<div class="col-span-3 flex justify-end">
											<Show
												when={attr.floor_gram}
												fallback={<span class="text-[12px] text-[#8c9aa9]">—</span>}
											>
												<TonAmount value={fmt(attr.floor_gram, 1)} size="sm" />
											</Show>
										</div>
									</button>
								)}
							</For>
						</div>

						<GiftDeltaEHeatmap
							collectionName={data()?.collection_name || slug()}
							backdrops={data()?.backdrops_list}
							models={data()?.model_floors}
							floorTon={data()?.best_floor_gram || 100}
						/>

						<Show when={(data()?.rarity_heatmap?.length || 0) > 0}>
							<CollectionRarityHeatmap
								cells={data()?.rarity_heatmap || []}
								collectionSlug={slug()}
								collectionName={data()?.collection_name || slug()}
								bestFloorGram={data()?.best_floor_gram || 100}
							/>
						</Show>
					</div>
				</Show>
			</div>
		</div>
	);
};

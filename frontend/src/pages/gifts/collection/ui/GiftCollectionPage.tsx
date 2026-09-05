import { useLocation, useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { GiftThumbnail, giftsApi } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';

export type CollectionTabKey =
	| 'market'
	| 'sales'
	| 'items'
	| 'attributes'
	| 'venues'
	| 'heatmap';

export const GiftCollectionPage: Component = () => {
	useTelegramBackButton(-1);
	const location = useLocation();
	const navigate = useNavigate();

	const getCollectionSlug = () => {
		const params = new URLSearchParams(location.search);
		return params.get('c') || 'plush_pepe';
	};

	const slug = () => getCollectionSlug();
	const [searchQuery, setSearchQuery] = createSignal('');
	const [showSearch, setShowSearch] = createSignal(false);
	const [selectedTab, setSelectedTab] = createSignal<CollectionTabKey>('market');
	const [copiedContract, setCopiedContract] = createSignal(false);
	const [heatmapTierFilter, setHeatmapTierFilter] = createSignal<string>('all');

	// Extended state for 5 capabilities
	const [marketTimeframe, setMarketTimeframe] = createSignal<'24h' | '7d' | '30d'>('24h');
	const [attributeTab, setAttributeTab] = createSignal<'models' | 'symbols' | 'backdrops'>('models');

	// Sales tab state
	const [salesSort, setSalesSort] = createSignal<'date' | 'price' | 'number'>('date');
	const [salesSortDir, setSalesSortDir] = createSignal<'asc' | 'desc'>('desc');
	const [salesPage, setSalesPage] = createSignal(1);
	const salesPageSize = 10;

	// Items tab state
	const [itemsSearch, setItemsSearch] = createSignal('');
	const [itemsFilter, setItemsFilter] = createSignal<'all' | 'sale'>('all');
	const [itemsSort, setItemsSort] = createSignal<'number' | 'rarity' | 'price'>('number');
	const [itemsSortDir, setItemsSortDir] = createSignal<'asc' | 'desc'>('asc');
	const [itemsPage, setItemsPage] = createSignal(1);
	const itemsPageSize = 10;

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

	const copyContract = (addr?: string) => {
		if (!addr) return;
		try {
			navigator.clipboard.writeText(addr);
			setCopiedContract(true);
			haptic.notify('success');
			setTimeout(() => setCopiedContract(false), 2000);
		} catch {}
	};

	const fmt = (val?: number, decimals = 2) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: decimals });
	};

	const fmtUsd = (val?: number) => {
		if (val === undefined || val === null) return '$0';
		if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
		if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
		return `$${val.toFixed(0)}`;
	};

	const fmtDate = (dStr?: string) => {
		if (!dStr) return '';
		const d = new Date(dStr);
		if (isNaN(d.getTime())) return dStr;
		const y = d.getUTCFullYear();
		const m = String(d.getUTCMonth() + 1).padStart(2, '0');
		const day = String(d.getUTCDate()).padStart(2, '0');
		const h = String(d.getUTCHours()).padStart(2, '0');
		const min = String(d.getUTCMinutes()).padStart(2, '0');
		return `${y}-${m}-${day} ${h}:${min}`;
	};

	const rarityTierBadge = (permille: number) => {
		if (permille <= 1)
			return { label: 'Mythic', bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
		if (permille <= 5)
			return { label: 'Legendary', bg: 'bg-[#0098EA]/20 text-[#0098EA] border-[#0098EA]/35' };
		if (permille <= 20)
			return { label: 'Epic', bg: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
		if (permille <= 50)
			return { label: 'Rare', bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
		if (permille <= 150)
			return { label: 'Uncommon', bg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' };
		return { label: 'Common', bg: 'bg-white/5 text-white/50 border-white/10' };
	};

	const rarityTierBadgeByName = (tier: string) => {
		const tStr = (tier || '').toLowerCase();
		if (tStr === 'mythic')
			return { label: 'Mythic', bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
		if (tStr === 'legendary')
			return { label: 'Legendary', bg: 'bg-[#AF52DE]/20 text-[#AF52DE] border-[#AF52DE]/35' };
		if (tStr === 'epic') return { label: 'Epic', bg: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
		if (tStr === 'rare')
			return { label: 'Rare', bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
		if (tStr === 'uncommon')
			return { label: 'Uncommon', bg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' };
		return { label: 'Common', bg: 'bg-white/5 text-white/50 border-white/10' };
	};

	const filteredHeatmap = createMemo(() => {
		const list = data()?.rarity_heatmap || [];
		const f = heatmapTierFilter().toLowerCase();
		if (f === 'all') return list;
		return list.filter((c) => (c.rarity_tier || '').toLowerCase() === f);
	});

	// Sales analytics period data
	const currentMarketPeriod = createMemo(() => {
		const stats = data()?.market_sales_stats;
		if (!stats) return undefined;
		const tf = marketTimeframe();
		if (tf === '7d') return stats.period_7d;
		if (tf === '30d') return stats.period_30d;
		return stats.period_24h;
	});

	// Exchange rate memo
	const exchangeRate = createMemo(() => {
		const firstSale = (data()?.sales_history || [])[0];
		if (firstSale && firstSale.exchange_rate > 0) return firstSale.exchange_rate;
		const floorGram = data()?.best_floor_gram || 0;
		const floorUsd = data()?.best_floor_usd || 0;
		if (floorGram > 0 && floorUsd > 0) {
			return +(floorUsd / floorGram).toFixed(2);
		}
		return 3.0;
	});

	// Sales sorting & pagination
	const sortedSales = createMemo(() => {
		const raw = data()?.sales_history || [];
		const sorted = [...raw];
		const sort = salesSort();
		const dir = salesSortDir() === 'asc' ? 1 : -1;

		sorted.sort((a, b) => {
			if (sort === 'price') {
				return (a.price_gram - b.price_gram) * dir;
			}
			if (sort === 'number') {
				return (a.serial_number - b.serial_number) * dir;
			}
			const dateA = new Date(a.sale_date).getTime();
			const dateB = new Date(b.sale_date).getTime();
			return (dateA - dateB) * dir;
		});
		return sorted;
	});

	const totalSalesPages = createMemo(() => Math.max(1, Math.ceil(sortedSales().length / salesPageSize)));

	const paginatedSales = createMemo(() => {
		const all = sortedSales();
		const start = (salesPage() - 1) * salesPageSize;
		return all.slice(start, start + salesPageSize);
	});

	const toggleSalesSort = (type: 'date' | 'price' | 'number') => {
		if (salesSort() === type) {
			setSalesSortDir(salesSortDir() === 'asc' ? 'desc' : 'asc');
		} else {
			setSalesSort(type);
			setSalesSortDir(type === 'date' ? 'desc' : 'asc');
		}
		setSalesPage(1);
		try {
			haptic.selection();
		} catch {}
	};

	// Items explorer filtering, sorting & pagination
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
			list = list.filter((item) => item.is_on_sale);
		}
		const sort = itemsSort();
		const dir = itemsSortDir() === 'asc' ? 1 : -1;
		list.sort((a, b) => {
			if (sort === 'price') {
				return ((a.price_gram || 0) - (b.price_gram || 0)) * dir;
			}
			if (sort === 'rarity') {
				return (a.rarity_score - b.rarity_score) * dir;
			}
			return (a.serial_number - b.serial_number) * dir;
		});
		return list;
	});

	const totalItemsPages = createMemo(() => Math.max(1, Math.ceil(filteredItems().length / itemsPageSize)));

	const paginatedItems = createMemo(() => {
		const all = filteredItems();
		const start = (itemsPage() - 1) * itemsPageSize;
		return all.slice(start, start + itemsPageSize);
	});

	const toggleItemsSort = (type: 'number' | 'rarity' | 'price') => {
		if (itemsSort() === type) {
			setItemsSortDir(itemsSortDir() === 'asc' ? 'desc' : 'asc');
		} else {
			setItemsSort(type);
			setItemsSortDir('asc');
		}
		setItemsPage(1);
		try {
			haptic.selection();
		} catch {}
	};

	return (
		<div class="pb-36 bg-[#030303] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[380px] bg-gradient-to-b from-[#0098EA]/15 via-transparent to-transparent blur-[100px] pointer-events-none z-0" />

			<div class="relative z-10 max-w-[480px] mx-auto px-4 pt-4">
				{/* ═══ Header ═══ */}
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-3">
						<button
							type="button"
							onClick={() => navigate(-1)}
							class="w-10 h-10 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-95"
						>
							<span class="material-symbols-outlined text-xl rtl:rotate-180">arrow_back</span>
						</button>
						<div>
							<h1 class="text-base font-black tracking-tight text-white flex items-center gap-2">
								<span>{data()?.collection_name || t('gifts.giftCollection')}</span>
								<span class="text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-[#0098EA]/15 text-[#0098EA] border border-[#0098EA]/30">
									TEP-62
								</span>
							</h1>
							<p class="text-[11px] font-medium text-white/40">{t('gifts.collectionSubtitle')}</p>
						</div>
					</div>

					<button
						type="button"
						onClick={() => {
							setShowSearch(!showSearch());
							setSearchQuery('');
							try {
								haptic.impact('light');
							} catch {}
						}}
						class="w-10 h-10 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-95"
					>
						<span class="material-symbols-outlined text-lg">
							{showSearch() ? 'close' : 'search'}
						</span>
					</button>
				</div>

				{/* ═══ Quick Switch Collection Dropdown ═══ */}
				<Show when={showSearch()}>
					<div class="mb-5 bg-[#12141C] border border-white/10 rounded-3xl p-4 shadow-2xl space-y-3">
						<div class="relative">
							<span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-lg">
								search
							</span>
							<input
								type="text"
								value={searchQuery()}
								onInput={(e) => setSearchQuery(e.currentTarget.value)}
								placeholder={t('gifts.searchPlaceholder')}
								class="w-full pl-11 pr-4 py-3 bg-white/[0.04] border border-white/10 rounded-2xl text-white text-xs font-medium placeholder:text-white/30 focus:outline-none focus:border-[#0098EA]/50 transition-all"
								autofocus
							/>
						</div>

						<div class="max-h-[260px] overflow-y-auto space-y-1.5 scrollbar-thin">
							<For each={filteredCollections()}>
								{(coll) => (
									<button
										type="button"
										onClick={() => selectCollection(coll.slug)}
										class={`w-full flex items-center gap-3 p-2.5 rounded-2xl border transition-all active:scale-[0.98] ${
											slug() === coll.slug
												? 'bg-[#0098EA]/15 border-[#0098EA]/40 text-white'
												: 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.04] text-white/80'
										}`}
									>
										<GiftThumbnail
											slug={coll.slug}
											name={coll.name}
											size="sm"
											class="w-9 h-9 rounded-xl"
										/>
										<div class="flex-1 text-left rtl:text-right min-w-0">
											<div class="text-xs font-bold truncate text-white">{coll.name}</div>
											<div class="text-[10px] text-white/40 font-medium">
												{t('gifts.supplyPrefix')} {coll.total_supply.toLocaleString()} ·{' '}
												{fmt(coll.floor_gram)} TON
											</div>
										</div>
										<span class="material-symbols-outlined text-white/30 text-base rtl:rotate-180">
											chevron_right
										</span>
									</button>
								)}
							</For>
						</div>
					</div>
				</Show>

				{/* ═══ Loading Skeleton ═══ */}
				<Show when={intelQuery.isLoading}>
					<div class="space-y-4">
						<div class="h-44 bg-[#12141C]/60 rounded-3xl animate-pulse" />
						<div class="grid grid-cols-3 gap-2.5">
							<div class="h-20 bg-[#12141C]/60 rounded-2xl animate-pulse" />
							<div class="h-20 bg-[#12141C]/60 rounded-2xl animate-pulse" />
							<div class="h-20 bg-[#12141C]/60 rounded-2xl animate-pulse" />
						</div>
						<div class="h-64 bg-[#12141C]/60 rounded-3xl animate-pulse" />
					</div>
				</Show>

				<Show when={data() && !intelQuery.isLoading}>
					{/* ═══ Collection Profile Card ═══ */}
					<div class="bg-gradient-to-br from-[#12141C] to-[#0A0D14] border border-white/[0.08] rounded-3xl p-5 mb-3.5 shadow-xl relative overflow-hidden space-y-4">
						<div class="flex items-center gap-4">
							<div class="relative w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.08] p-2 flex items-center justify-center shrink-0 shadow-lg">
								<GiftThumbnail
									slug={slug()}
									name={data()!.collection_name}
									size="lg"
									class="w-full h-full object-contain"
								/>
							</div>

							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<h2 class="text-lg font-black text-white truncate">{data()!.collection_name}</h2>
								</div>
								<div class="flex flex-wrap gap-1.5 mb-2">
									<Show when={data()!.is_limited}>
										<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
											{t('gifts.limited')}
										</span>
									</Show>
									<Show when={!data()!.is_limited}>
										<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
											{t('gifts.standard')}
										</span>
									</Show>
									<Show when={data()!.is_craftable}>
										<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25">
											{t('gifts.craftable')}
										</span>
									</Show>
								</div>
								<div class="text-[11px] text-white/50 flex items-center gap-2 font-medium">
									<span>
										{t('gifts.totalSupplyLabel')}{' '}
										<strong class="text-white">{data()!.total_supply.toLocaleString()}</strong>
									</span>
									<span class="w-[1px] h-3 bg-white/10" />
									<span class="text-emerald-400 font-bold">
										{t('gifts.onChainUpgrades', { count: data()!.upgraded_count.toLocaleString() })}
									</span>
								</div>
							</div>
						</div>

						<div class="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.06] text-xs">
							<div class="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-2.5 text-center">
								<span class="text-[9px] text-white/40 uppercase block font-bold mb-0.5">
									{t('gifts.uniqueModels')}
								</span>
								<span class="font-mono font-black text-white text-sm">
									{data()!.total_models || data()!.model_floors.length}
								</span>
							</div>
							<div class="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-2.5 text-center">
								<span class="text-[9px] text-white/40 uppercase block font-bold mb-0.5">
									{t('gifts.backdrops')}
								</span>
								<span class="font-mono font-black text-sky-400 text-sm">
									{data()!.total_backdrops || 60}
								</span>
							</div>
							<div class="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-2.5 text-center">
								<span class="text-[9px] text-white/40 uppercase block font-bold mb-0.5">
									{t('gifts.symbolsPatterns')}
								</span>
								<span class="font-mono font-black text-amber-400 text-sm">
									{data()!.total_symbols || 200}
								</span>
							</div>
						</div>

						<div class="bg-black/40 border border-white/[0.06] rounded-2xl p-3 flex items-center justify-between text-xs">
							<div class="min-w-0 flex-1 pr-2 rtl:pr-0 rtl:pl-2">
								<span class="text-[9px] uppercase font-bold text-white/40 block">
									{t('gifts.contractId')}
								</span>
								<span class="font-mono text-white/70 text-[11px] block truncate mt-0.5">
									{data()!.contract_address || t('gifts.contractNotRegistered')}
								</span>
							</div>
							<Show when={data()!.contract_address}>
								<div class="flex items-center gap-1.5 shrink-0">
									<button
										type="button"
										onClick={() => copyContract(data()!.contract_address)}
										class="px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-[10px] font-bold flex items-center gap-1 transition-all"
									>
										<span class="material-symbols-outlined text-xs">
											{copiedContract() ? 'check' : 'content_copy'}
										</span>
										<span>{copiedContract() ? t('gifts.copied') : t('gifts.copy')}</span>
									</button>
									<a
										href={`https://tonviewer.com/${data()!.contract_address}`}
										target="_blank"
										rel="noopener noreferrer"
										class="px-2.5 py-1.5 rounded-xl bg-[#0098EA]/15 hover:bg-[#0098EA]/25 text-[#0098EA] border border-[#0098EA]/30 text-[10px] font-bold flex items-center gap-1 transition-all"
									>
										<span>TonViewer</span>
										<span class="material-symbols-outlined text-xs">open_in_new</span>
									</a>
								</div>
							</Show>
						</div>
					</div>

					{/* ═══ Stats Overview ═══ */}
					<div class="grid grid-cols-3 gap-2.5 mb-3.5">
						<div class="bg-[#12141C]/90 border border-white/[0.06] rounded-2xl p-3 text-center">
							<span class="text-[9px] uppercase font-bold text-white/40 block mb-1">
								{t('gifts.floorPrice')}
							</span>
							<div class="text-base font-black text-white font-mono">
								{fmt(data()!.best_floor_gram)} TON
							</div>
							<span class="text-[10px] text-white/40 font-mono block mt-0.5">
								{fmtUsd(data()!.best_floor_usd)}
							</span>
						</div>

						<div class="bg-[#12141C]/90 border border-white/[0.06] rounded-2xl p-3 text-center">
							<span class="text-[9px] uppercase font-bold text-white/40 block mb-1">
								{t('gifts.volume24h')}
							</span>
							<div class="text-base font-black text-white font-mono">
								{fmtUsd(data()!.volume_24h_usd)}
							</div>
							<span class="text-[10px] text-white/40 font-mono block mt-0.5">
								{fmt(data()!.volume_24h_gram, 0)} TON
							</span>
						</div>

						<div class="bg-[#12141C]/90 border border-white/[0.06] rounded-2xl p-3 text-center">
							<span class="text-[9px] uppercase font-bold text-white/40 block mb-1">
								{t('gifts.marketCap')}
							</span>
							<div class="text-base font-black text-white font-mono">
								{fmtUsd(data()!.market_cap_usd)}
							</div>
							<span class="text-[10px] text-emerald-400 font-bold block mt-0.5">
								{t('gifts.activeItemsCount', { count: data()!.listed_count })}
							</span>
						</div>
					</div>

					{/* ═══ Capability 1: Hero Floor Listing Card (Screenshot 1) ═══ */}
					<Show when={data()?.floor_item}>
						{(() => {
							const fi = data()!.floor_item!;
							return (
								<div class="bg-gradient-to-br from-[#131824] via-[#0E131E] to-[#0A0D14] border border-[#0098EA]/30 rounded-3xl p-4 mb-4 shadow-xl relative overflow-hidden">
									<div class="absolute -right-8 -top-8 w-28 h-28 bg-[#0098EA]/20 rounded-full blur-2xl pointer-events-none" />

									<div class="flex items-center justify-between pb-2.5 mb-3 border-b border-white/[0.08]">
										<div class="flex items-center gap-2">
											<span class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
												{t('gifts.floorItemCard')}
											</span>
											<span class="text-xs font-black text-white">#{fi.serial_number}</span>
										</div>
										<span class="text-[10px] font-semibold text-white/60 bg-white/[0.04] px-2.5 py-0.5 rounded-lg border border-white/[0.06]">
											{fi.venue_name}
										</span>
									</div>

									<div class="flex items-center gap-3.5 mb-3.5">
										<div class="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.08] p-1.5 flex items-center justify-center shrink-0 shadow-md">
											<GiftThumbnail
												slug={slug()}
												name={fi.model_name}
												model={fi.model_name}
												size="md"
												class="w-full h-full object-contain"
											/>
										</div>

										<div class="flex-1 min-w-0 space-y-1">
											<div class="text-sm font-black text-white truncate">{fi.model_name}</div>
											<div class="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
												<span class="flex items-center gap-1">
													<span class="text-white/40">{t('gifts.symbols')}:</span>
													<strong class="text-white font-medium">{fi.symbol_name}</strong>
												</span>
												<span class="w-[1px] h-2.5 bg-white/15" />
												<span class="flex items-center gap-1">
													<span class="text-white/40">{t('gifts.backdrops')}:</span>
													<Show when={fi.center_hex}>
														<span
															class="w-2.5 h-2.5 rounded-full border border-black/40 inline-block"
															style={{ 'background-color': fi.center_hex }}
														/>
													</Show>
													<strong class="text-white font-medium">{fi.backdrop_name}</strong>
												</span>
											</div>
										</div>

										<div class="text-right rtl:text-left shrink-0">
											<div class="text-base font-black text-white font-mono">{fmt(fi.price_gram)} TON</div>
											<div class="text-[11px] text-white/40 font-mono font-medium">{fmtUsd(fi.price_usd)}</div>
										</div>
									</div>

									<div class="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
										<a
											href={fi.buy_url || `https://tonnel.network`}
											target="_blank"
											rel="noopener noreferrer"
											onClick={() => {
												try {
													haptic.impact('medium');
												} catch {}
											}}
											class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#0098EA] to-[#0081C8] hover:brightness-110 text-white font-black text-xs text-center shadow-lg shadow-[#0098EA]/25 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
										>
											<span>{t('gifts.buyNow')}</span>
											<span class="material-symbols-outlined text-sm">open_in_new</span>
										</a>
										<button
											type="button"
											onClick={() => {
												navigate(`/gifts/report?g=${slug()}-${fi.serial_number}`);
												try {
													haptic.impact('light');
												} catch {}
											}}
											class="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10 text-white font-bold text-xs border border-white/10 transition-all active:scale-[0.98] flex items-center justify-center gap-1"
										>
											<span>{t('gifts.viewInCollection')}</span>
											<span class="material-symbols-outlined text-sm rtl:rotate-180">arrow_forward</span>
										</button>
									</div>
								</div>
							);
						})()}
					</Show>

					{/* ═══ Main Tab Bar Navigation ═══ */}
					<div class="flex items-center gap-1.5 p-1 bg-[#12141C]/80 border border-white/[0.06] rounded-2xl mb-4 overflow-x-auto scrollbar-none">
						<button
							type="button"
							onClick={() => {
								setSelectedTab('market');
								try {
									haptic.impact('light');
								} catch {}
							}}
							class={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all whitespace-nowrap text-center ${
								selectedTab() === 'market'
									? 'bg-[#0098EA] text-white shadow-lg shadow-[#0098EA]/30'
									: 'text-white/50 hover:text-white hover:bg-white/[0.03]'
							}`}
						>
							{t('gifts.tabMarket')}
						</button>

						<button
							type="button"
							onClick={() => {
								setSelectedTab('sales');
								try {
									haptic.impact('light');
								} catch {}
							}}
							class={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all whitespace-nowrap text-center ${
								selectedTab() === 'sales'
									? 'bg-[#0098EA] text-white shadow-lg shadow-[#0098EA]/30'
									: 'text-white/50 hover:text-white hover:bg-white/[0.03]'
							}`}
						>
							{t('gifts.tabSales')}
						</button>

						<button
							type="button"
							onClick={() => {
								setSelectedTab('items');
								try {
									haptic.impact('light');
								} catch {}
							}}
							class={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all whitespace-nowrap text-center ${
								selectedTab() === 'items'
									? 'bg-[#0098EA] text-white shadow-lg shadow-[#0098EA]/30'
									: 'text-white/50 hover:text-white hover:bg-white/[0.03]'
							}`}
						>
							{t('gifts.tabItems')}
						</button>

						<button
							type="button"
							onClick={() => {
								setSelectedTab('attributes');
								try {
									haptic.impact('light');
								} catch {}
							}}
							class={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all whitespace-nowrap text-center ${
								selectedTab() === 'attributes'
									? 'bg-[#0098EA] text-white shadow-lg shadow-[#0098EA]/30'
									: 'text-white/50 hover:text-white hover:bg-white/[0.03]'
							}`}
						>
							{t('gifts.tabAttributes')}
						</button>

						<button
							type="button"
							onClick={() => {
								setSelectedTab('venues');
								try {
									haptic.impact('light');
								} catch {}
							}}
							class={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all whitespace-nowrap text-center ${
								selectedTab() === 'venues'
									? 'bg-[#0098EA] text-white shadow-lg shadow-[#0098EA]/30'
									: 'text-white/50 hover:text-white hover:bg-white/[0.03]'
							}`}
						>
							{t('gifts.tabVenues')}
						</button>

						<button
							type="button"
							onClick={() => {
								setSelectedTab('heatmap');
								try {
									haptic.impact('light');
								} catch {}
							}}
							class={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all whitespace-nowrap text-center ${
								selectedTab() === 'heatmap'
									? 'bg-[#0098EA] text-white shadow-lg shadow-[#0098EA]/30'
									: 'text-white/50 hover:text-white hover:bg-white/[0.03]'
							}`}
						>
							{t('gifts.tabHeatmap')}
						</button>
					</div>

					{/* ═══════════════════════════════════════════════════════════ */}
					{/* TAB 1: MARKET (Screenshot 2)                                */}
					{/* ═══════════════════════════════════════════════════════════ */}
					<Show when={selectedTab() === 'market'}>
						<div class="space-y-4 mb-4">
							{/* Section 1: Top 10 by Floor */}
							<div class="bg-[#12141C]/90 border border-white/[0.06] rounded-3xl p-4 shadow-xl space-y-3">
								<div class="flex items-center justify-between pb-2 border-b border-white/[0.06]">
									<h3 class="text-xs font-black text-white flex items-center gap-1.5">
										<span class="material-symbols-outlined text-[#0098EA] text-base">format_list_numbered</span>
										<span>{t('gifts.top10ByFloor')}</span>
									</h3>
									<span class="text-[10px] text-white/40 font-mono font-medium">
										{data()?.top_floor_items?.length || 0} / 10
									</span>
								</div>

								<div class="divide-y divide-white/[0.04]">
									<For each={data()?.top_floor_items || []}>
										{(item, idx) => (
											<div class="flex items-center gap-3 py-2.5 text-xs hover:bg-white/[0.02] rounded-xl px-1.5 transition-colors">
												<span class="w-5 text-center font-mono font-bold text-white/40 text-[11px] shrink-0">
													#{idx() + 1}
												</span>
												<div class="flex-1 min-w-0">
													<div class="flex items-center gap-2">
														<span class="font-bold text-white truncate">
															#{item.serial_number} {item.model_name}
														</span>
														<span class="text-[9px] px-1.5 py-0.2 rounded bg-white/[0.05] text-white/60 shrink-0 font-medium">
															{item.venue_name}
														</span>
													</div>
													<div class="text-[10px] text-white/40 flex items-center gap-2 mt-0.5 truncate">
														<span>{item.symbol_name}</span>
														<span class="w-[1px] h-2 bg-white/10" />
														<span class="flex items-center gap-1">
															<Show when={item.center_hex}>
																<span
																	class="w-2 h-2 rounded-full inline-block"
																	style={{ 'background-color': item.center_hex }}
																/>
															</Show>
															<span>{item.backdrop_name}</span>
														</span>
													</div>
												</div>

												<div class="text-right rtl:text-left shrink-0">
													<div class="font-mono font-black text-white text-xs">
														{fmt(item.price_gram)} TON
													</div>
													<span class="text-[10px] text-white/40 font-mono">
														{fmtUsd(item.price_usd)}
													</span>
												</div>

												<Show when={item.buy_url}>
													<a
														href={item.buy_url}
														target="_blank"
														rel="noopener noreferrer"
														class="px-2.5 py-1 rounded-lg bg-[#0098EA]/15 hover:bg-[#0098EA]/25 text-[#0098EA] border border-[#0098EA]/30 text-[10px] font-black shrink-0 transition-all active:scale-95"
													>
														{t('gifts.buyNow')}
													</a>
												</Show>
											</div>
										)}
									</For>
								</div>
							</div>

							{/* Section 2: Sales Analytics (Timeframe 24h / 7d / 30d) */}
							<div class="bg-[#12141C]/90 border border-white/[0.06] rounded-3xl p-4 shadow-xl space-y-3">
								<div class="flex items-center justify-between pb-2 border-b border-white/[0.06]">
									<h3 class="text-xs font-black text-white flex items-center gap-1.5">
										<span class="material-symbols-outlined text-emerald-400 text-base">monitoring</span>
										<span>{t('gifts.salesAnalytics')}</span>
									</h3>

									<div class="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded-xl border border-white/[0.06]">
										<For each={['24h', '7d', '30d'] as const}>
											{(tf) => (
												<button
													type="button"
													onClick={() => {
														setMarketTimeframe(tf);
														try {
															haptic.selection();
														} catch {}
													}}
													class={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
														marketTimeframe() === tf
															? 'bg-[#0098EA] text-white shadow'
															: 'text-white/50 hover:text-white'
													}`}
												>
													{tf === '24h'
														? t('gifts.timeframe24h')
														: tf === '7d'
														? t('gifts.timeframe7d')
														: t('gifts.timeframe30d')}
												</button>
											)}
										</For>
									</div>
								</div>

								<Show when={currentMarketPeriod()}>
									{(() => {
										const p = currentMarketPeriod()!;
										return (
											<div class="space-y-3">
												<div class="grid grid-cols-2 gap-2 text-center">
													<div class="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-2.5">
														<span class="text-[9px] uppercase font-bold text-white/40 block mb-0.5">
															{t('gifts.volume24h')}
														</span>
														<div class="text-sm font-black text-white font-mono">
															{fmt(p.volume_gram)} TON
														</div>
														<span class="text-[10px] text-white/40 font-mono">
															{fmtUsd(p.volume_usd)}
														</span>
													</div>
													<div class="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-2.5">
														<span class="text-[9px] uppercase font-bold text-white/40 block mb-0.5">
															{t('gifts.deals')}
														</span>
														<div class="text-sm font-black text-emerald-400 font-mono">
															{p.deals_count}
														</div>
														<span class="text-[10px] text-white/40">
															{t('gifts.activeItemsCount', { count: p.deals_count })}
														</span>
													</div>
												</div>

												<div class="grid grid-cols-3 gap-2 text-center text-xs">
													<div class="bg-white/[0.02] border border-white/[0.05] rounded-xl p-2">
														<span class="text-[9px] text-white/40 block mb-0.5 font-bold">
															{t('gifts.minPrice')}
														</span>
														<span class="font-mono font-bold text-white">
															{fmt(p.min_gram)} TON
														</span>
													</div>
													<div class="bg-white/[0.02] border border-white/[0.05] rounded-xl p-2">
														<span class="text-[9px] text-white/40 block mb-0.5 font-bold">
															{t('gifts.avgPrice')}
														</span>
														<span class="font-mono font-bold text-[#0098EA]">
															{fmt(p.avg_gram)} TON
														</span>
													</div>
													<div class="bg-white/[0.02] border border-white/[0.05] rounded-xl p-2">
														<span class="text-[9px] text-white/40 block mb-0.5 font-bold">
															{t('gifts.maxPrice')}
														</span>
														<span class="font-mono font-bold text-amber-400">
															{fmt(p.max_gram)} TON
														</span>
													</div>
												</div>

												{/* By Source Breakdown */}
												<Show when={p.by_source && p.by_source.length > 0}>
													<div class="pt-2 border-t border-white/[0.05]">
														<span class="text-[10px] font-bold text-white/50 block mb-1.5 uppercase tracking-wider">
															{t('gifts.bySource')}
														</span>
														<div class="space-y-1.5">
															<For each={p.by_source}>
																{(src) => (
																	<div class="flex items-center justify-between text-xs bg-white/[0.015] p-2 rounded-xl border border-white/[0.03]">
																		<span class="font-bold text-white">{src.venue_name}</span>
																		<div class="text-right rtl:text-left text-[11px] font-mono">
																			<span class="text-white font-bold">{src.deals_count} {t('gifts.deals')}</span>
																			<span class="text-white/40 mx-1.5">·</span>
																			<span class="text-sky-400">{fmt(src.volume_gram)} TON</span>
																		</div>
																	</div>
																)}
															</For>
														</div>
													</div>
												</Show>
											</div>
										);
									})()}
								</Show>
							</div>

							{/* Section 3: On Sale Now */}
							<Show when={data()?.on_sale_stats}>
								<div class="bg-[#12141C]/90 border border-white/[0.06] rounded-3xl p-4 shadow-xl space-y-3">
									<div class="flex items-center justify-between pb-2 border-b border-white/[0.06]">
										<h3 class="text-xs font-black text-white flex items-center gap-1.5">
											<span class="material-symbols-outlined text-amber-400 text-base">shopping_cart</span>
											<span>{t('gifts.onSaleNow')}</span>
										</h3>
										<span class="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
											{fmt(data()!.on_sale_stats!.floor_gram)} TON
										</span>
									</div>

									<div class="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-2xl p-3 text-xs">
										<div>
											<span class="text-[10px] text-white/40 uppercase block font-bold">
												{t('gifts.listed')}
											</span>
											<span class="text-sm font-black text-white font-mono mt-0.5 block">
												{data()!.on_sale_stats!.total_count.toLocaleString()} /{' '}
												{data()!.total_supply.toLocaleString()}
											</span>
										</div>
										<div class="text-right rtl:text-left font-mono">
											<span class="text-[10px] text-white/40 block">
												{(
													(data()!.on_sale_stats!.total_count /
														Math.max(1, data()!.total_supply)) *
													100
												).toFixed(2)}
												%
											</span>
											<span class="text-xs font-black text-white block mt-0.5">
												{fmtUsd(data()!.on_sale_stats!.floor_usd)}
											</span>
										</div>
									</div>

									<div class="space-y-1.5">
										<span class="text-[10px] font-bold text-white/50 block uppercase tracking-wider mb-1">
											{t('gifts.byMarketplace')}
										</span>
										<For each={data()!.on_sale_stats!.by_marketplace}>
											{(mp) => (
												<div class="flex items-center justify-between text-xs bg-white/[0.015] p-2.5 rounded-xl border border-white/[0.03]">
													<div class="flex items-center gap-2">
														<div class="w-6 h-6 rounded-lg bg-white/[0.05] flex items-center justify-center font-bold text-[10px]">
															{mp.venue_name.slice(0, 2).toUpperCase()}
														</div>
														<div>
															<span class="font-bold text-white block">{mp.venue_name}</span>
															<span class="text-[9px] text-white/40 font-mono">
																{mp.count} {t('gifts.onSale')}
															</span>
														</div>
													</div>
													<div class="text-right rtl:text-left font-mono">
														<span class="font-bold text-white text-xs block">
															{fmt(mp.floor_gram)} TON
														</span>
														<span class="text-[10px] text-white/40 block">
															{fmtUsd(mp.floor_usd)}
														</span>
													</div>
												</div>
											)}
										</For>
									</div>
								</div>
							</Show>
						</div>
					</Show>

					{/* ═══════════════════════════════════════════════════════════ */}
					{/* TAB 2: SALES (Screenshot 3)                                 */}
					{/* ═══════════════════════════════════════════════════════════ */}
					<Show when={selectedTab() === 'sales'}>
						<div class="bg-[#12141C]/90 border border-white/[0.06] rounded-3xl p-4 shadow-xl mb-4 space-y-3">
							<div class="flex items-center justify-between pb-2 border-b border-white/[0.06]">
								<div>
									<h3 class="text-xs font-black text-white flex items-center gap-1.5">
										<span class="material-symbols-outlined text-[#0098EA] text-base">history</span>
										<span>{t('gifts.salesHistory')}</span>
									</h3>
									<span class="text-[9px] text-white/40">UTC time zone</span>
								</div>

								<div class="px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/[0.06] text-right rtl:text-left font-mono text-[10px]">
									<span class="text-white/40">{t('gifts.rateTonUsd')}: </span>
									<strong class="text-white">1 TON = ${exchangeRate()}</strong>
								</div>
							</div>

							{/* Sort Controls */}
							<div class="flex items-center gap-2 pb-1 overflow-x-auto scrollbar-none text-xs">
								<button
									type="button"
									onClick={() => toggleSalesSort('date')}
									class={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all ${
										salesSort() === 'date'
											? 'bg-[#0098EA] text-white shadow'
											: 'bg-white/[0.03] text-white/60 hover:text-white border border-white/5'
									}`}
								>
									<span>{t('gifts.sortByDate')}</span>
									<Show when={salesSort() === 'date'}>
										<span class="material-symbols-outlined text-xs">
											{salesSortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward'}
										</span>
									</Show>
								</button>

								<button
									type="button"
									onClick={() => toggleSalesSort('price')}
									class={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all ${
										salesSort() === 'price'
											? 'bg-[#0098EA] text-white shadow'
											: 'bg-white/[0.03] text-white/60 hover:text-white border border-white/5'
									}`}
								>
									<span>{t('gifts.sortByPrice')}</span>
									<Show when={salesSort() === 'price'}>
										<span class="material-symbols-outlined text-xs">
											{salesSortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward'}
										</span>
									</Show>
								</button>

								<button
									type="button"
									onClick={() => toggleSalesSort('number')}
									class={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all ${
										salesSort() === 'number'
											? 'bg-[#0098EA] text-white shadow'
											: 'bg-white/[0.03] text-white/60 hover:text-white border border-white/5'
									}`}
								>
									<span>{t('gifts.sortByNumber')}</span>
									<Show when={salesSort() === 'number'}>
										<span class="material-symbols-outlined text-xs">
											{salesSortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward'}
										</span>
									</Show>
								</button>
							</div>

							{/* Sales items list */}
							<div class="divide-y divide-white/[0.04]">
								<For each={paginatedSales()}>
									{(sale) => (
										<button
											type="button"
											onClick={() => {
												navigate(`/gifts/report?g=${slug()}-${sale.serial_number}`);
												try {
													haptic.impact('light');
												} catch {}
											}}
											class="w-full text-left rtl:text-right py-3 hover:bg-white/[0.02] rounded-xl px-2 transition-colors active:scale-[0.99] flex items-center justify-between gap-3 text-xs"
										>
											<div class="min-w-0 flex-1">
												<div class="text-[10px] text-white/40 font-mono mb-0.5">
													{fmtDate(sale.sale_date)}
												</div>
												<div class="font-bold text-white text-xs truncate">
													#{sale.serial_number} {sale.model_name}
												</div>
												<div class="text-[10px] text-white/50 flex items-center gap-2 mt-0.5 truncate">
													<span>{sale.symbol_name}</span>
													<span class="w-[1px] h-2 bg-white/10" />
													<span class="flex items-center gap-1">
														<Show when={sale.center_hex}>
															<span
																class="w-2 h-2 rounded-full inline-block"
																style={{ 'background-color': sale.center_hex }}
															/>
														</Show>
														<span>{sale.backdrop_name}</span>
													</span>
												</div>
											</div>

											<div class="text-right rtl:text-left shrink-0">
												<div class="font-mono font-black text-white text-xs">
													{fmt(sale.price_gram)} TON
												</div>
												<div class="text-[10px] text-white/40 font-mono">
													{fmtUsd(sale.price_usd)}
												</div>
												<span class="text-[9px] px-1.5 py-0.2 rounded bg-white/[0.05] text-white/60 inline-block mt-0.5">
													{sale.venue_name}
												</span>
											</div>
										</button>
									)}
								</For>
							</div>

							{/* Pagination Controls */}
							<div class="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs">
								<button
									type="button"
									disabled={salesPage() <= 1}
									onClick={() => {
										setSalesPage((p) => Math.max(1, p - 1));
										try {
											haptic.selection();
										} catch {}
									}}
									class="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none text-white font-bold transition-all"
								>
									<span class="material-symbols-outlined text-xs rtl:rotate-180">arrow_back</span>
								</button>

								<span class="font-mono text-white/50 text-[11px]">
									{salesPage()} / {totalSalesPages()}
								</span>

								<button
									type="button"
									disabled={salesPage() >= totalSalesPages()}
									onClick={() => {
										setSalesPage((p) => Math.min(totalSalesPages(), p + 1));
										try {
											haptic.selection();
										} catch {}
									}}
									class="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none text-white font-bold transition-all"
								>
									<span class="material-symbols-outlined text-xs rtl:rotate-180">arrow_forward</span>
								</button>
							</div>
						</div>
					</Show>

					{/* ═══════════════════════════════════════════════════════════ */}
					{/* TAB 3: ITEMS EXPLORER (Screenshot 4)                        */}
					{/* ═══════════════════════════════════════════════════════════ */}
					<Show when={selectedTab() === 'items'}>
						<div class="bg-[#12141C]/90 border border-white/[0.06] rounded-3xl p-4 shadow-xl mb-4 space-y-3">
							<div class="flex items-center justify-between pb-2 border-b border-white/[0.06]">
								<h3 class="text-xs font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[#0098EA] text-base">explore</span>
									<span>{t('gifts.itemsExplorer')}</span>
								</h3>
								<span class="text-[10px] text-white/40 font-mono">
									{t('gifts.foundResults', { count: filteredItems().length })}
								</span>
							</div>

							{/* Search input */}
							<div class="relative">
								<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-base">
									search
								</span>
								<input
									type="text"
									value={itemsSearch()}
									onInput={(e) => {
										setItemsSearch(e.currentTarget.value);
										setItemsPage(1);
									}}
									placeholder={t('gifts.searchPlaceholder')}
									class="w-full pl-9 pr-8 py-2 bg-white/[0.04] border border-white/10 rounded-xl text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-[#0098EA]/50"
								/>
								<Show when={itemsSearch()}>
									<button
										type="button"
										onClick={() => {
											setItemsSearch('');
											setItemsPage(1);
										}}
										class="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
									>
										<span class="material-symbols-outlined text-sm">close</span>
									</button>
								</Show>
							</div>

							{/* Filter and Sort Chips */}
							<div class="flex flex-wrap items-center justify-between gap-2 pb-1">
								<div class="flex items-center gap-1 bg-white/[0.03] p-0.5 rounded-xl border border-white/[0.05]">
									<button
										type="button"
										onClick={() => {
											setItemsFilter('all');
											setItemsPage(1);
											try {
												haptic.selection();
											} catch {}
										}}
										class={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
											itemsFilter() === 'all'
												? 'bg-[#0098EA] text-white'
												: 'text-white/50 hover:text-white'
										}`}
									>
										{t('common.all') || 'All'}
									</button>
									<button
										type="button"
										onClick={() => {
											setItemsFilter('sale');
											setItemsPage(1);
											try {
												haptic.selection();
											} catch {}
										}}
										class={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
											itemsFilter() === 'sale'
												? 'bg-[#0098EA] text-white'
												: 'text-white/50 hover:text-white'
										}`}
									>
										{t('gifts.onSale')}
									</button>
								</div>

								<div class="flex items-center gap-1 text-[10px]">
									<button
										type="button"
										onClick={() => toggleItemsSort('number')}
										class={`px-2 py-1 rounded-lg font-bold flex items-center gap-0.5 ${
											itemsSort() === 'number'
												? 'bg-white/15 text-white'
												: 'text-white/40 hover:text-white'
										}`}
									>
										<span>{t('gifts.sortByNumber')}</span>
										<Show when={itemsSort() === 'number'}>
											<span class="material-symbols-outlined text-[10px]">
												{itemsSortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward'}
											</span>
										</Show>
									</button>

									<button
										type="button"
										onClick={() => toggleItemsSort('rarity')}
										class={`px-2 py-1 rounded-lg font-bold flex items-center gap-0.5 ${
											itemsSort() === 'rarity'
												? 'bg-white/15 text-white'
												: 'text-white/40 hover:text-white'
										}`}
									>
										<span>{t('gifts.sortByRarity')}</span>
										<Show when={itemsSort() === 'rarity'}>
											<span class="material-symbols-outlined text-[10px]">
												{itemsSortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward'}
											</span>
										</Show>
									</button>

									<button
										type="button"
										onClick={() => toggleItemsSort('price')}
										class={`px-2 py-1 rounded-lg font-bold flex items-center gap-0.5 ${
											itemsSort() === 'price'
												? 'bg-white/15 text-white'
												: 'text-white/40 hover:text-white'
										}`}
									>
										<span>{t('gifts.sortByPrice')}</span>
										<Show when={itemsSort() === 'price'}>
											<span class="material-symbols-outlined text-[10px]">
												{itemsSortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward'}
											</span>
										</Show>
									</button>
								</div>
							</div>

							{/* Items list */}
							<div class="space-y-2">
								<For each={paginatedItems()}>
									{(item) => (
										<div class="bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] rounded-2xl p-3 flex items-center justify-between gap-3 text-xs transition-colors">
											<div class="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.06] p-1 flex items-center justify-center shrink-0">
												<GiftThumbnail
													slug={slug()}
													name={item.model_name}
													model={item.model_name}
													size="sm"
													class="w-full h-full object-contain"
												/>
											</div>

											<div class="flex-1 min-w-0">
												<div class="flex items-center gap-2">
													<span class="font-bold text-white truncate">
														#{item.serial_number} {item.model_name}
													</span>
													<Show when={item.is_on_sale}>
														<span class="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-bold">
															{t('gifts.onSale')}
														</span>
													</Show>
													<Show when={!item.is_on_sale}>
														<span class="text-[9px] px-1.5 py-0.2 rounded bg-white/[0.04] text-white/40 font-medium">
															{t('gifts.notForSale')}
														</span>
													</Show>
												</div>

												<div class="text-[10px] text-white/40 flex items-center gap-2 mt-1 truncate">
													<span>{item.symbol_name}</span>
													<span class="w-[1px] h-2 bg-white/10" />
													<span class="flex items-center gap-1">
														<Show when={item.center_hex}>
															<span
																class="w-2 h-2 rounded-full inline-block"
																style={{ 'background-color': item.center_hex }}
															/>
														</Show>
														<span>{item.backdrop_name}</span>
													</span>
												</div>
											</div>

											<div class="text-right rtl:text-left shrink-0">
												<Show when={item.is_on_sale && item.price_gram}>
													<div class="font-mono font-black text-white text-xs">
														{fmt(item.price_gram)} TON
													</div>
													<div class="text-[10px] text-white/40 font-mono">
														{fmtUsd(item.price_usd)}
													</div>
													<button
														type="button"
														onClick={() => {
															navigate(`/gifts/report?g=${slug()}-${item.serial_number}`);
															try {
																haptic.impact('light');
															} catch {}
														}}
														class="mt-1 px-2.5 py-0.5 rounded bg-[#0098EA] text-white font-bold text-[9px] transition-all active:scale-95"
													>
														{t('gifts.buyNow')}
													</button>
												</Show>
												<Show when={!item.is_on_sale}>
													<button
														type="button"
														onClick={() => {
															navigate(`/gifts/report?g=${slug()}-${item.serial_number}`);
															try {
																haptic.impact('light');
															} catch {}
														}}
														class="px-2.5 py-1 rounded-xl bg-white/[0.05] hover:bg-white/10 text-white/70 text-[10px] font-bold border border-white/10 transition-all"
													>
														<span class="material-symbols-outlined text-xs rtl:rotate-180">
															arrow_forward
														</span>
													</button>
												</Show>
											</div>
										</div>
									)}
								</For>
							</div>

							{/* Pagination */}
							<div class="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs">
								<button
									type="button"
									disabled={itemsPage() <= 1}
									onClick={() => {
										setItemsPage((p) => Math.max(1, p - 1));
										try {
											haptic.selection();
										} catch {}
									}}
									class="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none text-white font-bold transition-all"
								>
									<span class="material-symbols-outlined text-xs rtl:rotate-180">arrow_back</span>
								</button>

								<span class="font-mono text-white/50 text-[11px]">
									{itemsPage()} / {totalItemsPages()}
								</span>

								<button
									type="button"
									disabled={itemsPage() >= totalItemsPages()}
									onClick={() => {
										setItemsPage((p) => Math.min(totalItemsPages(), p + 1));
										try {
											haptic.selection();
										} catch {}
									}}
									class="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none text-white font-bold transition-all"
								>
									<span class="material-symbols-outlined text-xs rtl:rotate-180">arrow_forward</span>
								</button>
							</div>
						</div>
					</Show>

					{/* ═══════════════════════════════════════════════════════════ */}
					{/* TAB 4: ATTRIBUTES (Screenshot 5: Models/Symbols/Backdrops)  */}
					{/* ═══════════════════════════════════════════════════════════ */}
					<Show when={selectedTab() === 'attributes'}>
						<div class="bg-[#12141C]/90 border border-white/[0.06] rounded-3xl p-4 shadow-xl mb-4 space-y-3">
							<div class="flex items-center justify-between pb-2 border-b border-white/[0.06]">
								<h3 class="text-xs font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[#0098EA] text-base">dna</span>
									<span>{t('gifts.tabAttributes')}</span>
								</h3>

								{/* Sub-selector for Models / Symbols / Backdrops */}
								<div class="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded-xl border border-white/[0.06]">
									<button
										type="button"
										onClick={() => {
											setAttributeTab('models');
											try {
												haptic.selection();
											} catch {}
										}}
										class={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
											attributeTab() === 'models'
												? 'bg-[#0098EA] text-white shadow'
												: 'text-white/50 hover:text-white'
										}`}
									>
										{t('gifts.models')} ({data()!.model_floors.length})
									</button>

									<button
										type="button"
										onClick={() => {
											setAttributeTab('symbols');
											try {
												haptic.selection();
											} catch {}
										}}
										class={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
											attributeTab() === 'symbols'
												? 'bg-[#0098EA] text-white shadow'
												: 'text-white/50 hover:text-white'
										}`}
									>
										{t('gifts.symbols')} ({data()!.symbols_list?.length || 0})
									</button>

									<button
										type="button"
										onClick={() => {
											setAttributeTab('backdrops');
											try {
												haptic.selection();
											} catch {}
										}}
										class={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
											attributeTab() === 'backdrops'
												? 'bg-[#0098EA] text-white shadow'
												: 'text-white/50 hover:text-white'
										}`}
									>
										{t('gifts.backdrops')} ({data()!.backdrops_list?.length || 0})
									</button>
								</div>
							</div>

							{/* 1. Models List */}
							<Show when={attributeTab() === 'models'}>
								<div class="divide-y divide-white/[0.04]">
									<For each={data()!.model_floors}>
										{(model, i) => {
											const tier = rarityTierBadge(model.rarity_permille);
											return (
												<button
													type="button"
													onClick={() => {
														navigate(`/gifts/report?g=${slug()}-${i() + 1}`);
														try {
															haptic.impact('light');
														} catch {}
													}}
													class="w-full flex items-center gap-3 py-3 hover:bg-white/[0.03] rounded-2xl px-2 transition-all active:scale-[0.99] text-left rtl:text-right"
												>
													<span class="text-xs font-mono font-bold text-white/30 w-5 shrink-0 text-center">
														#{i() + 1}
													</span>

													<div class="w-11 h-11 rounded-2xl bg-white/[0.03] border border-white/[0.08] p-1 flex items-center justify-center shrink-0">
														<GiftThumbnail
															slug={slug()}
															name={model.model_name}
															model={model.model_name}
															size="sm"
															class="w-full h-full object-contain"
														/>
													</div>

													<div class="flex-1 min-w-0">
														<div class="flex items-center gap-1.5">
															<span class="text-xs font-bold text-white truncate">
																{model.model_name}
															</span>
															<Show when={model.custom_emoji_id}>
																<span
																	class="text-[9px] px-1.5 py-0.5 rounded-md bg-[#0098EA]/15 text-[#0098EA] border border-[#0098EA]/30 font-mono shrink-0"
																	title={`TG Custom Emoji ID: ${model.custom_emoji_id}`}
																>
																	TG Emoji
																</span>
															</Show>
														</div>
														<div class="text-[10px] text-white/40 flex items-center gap-2 mt-0.5">
															<span>
																{t('gifts.supplyPrefix')} {model.total_supply.toLocaleString()}
															</span>
															<span class="w-[1px] h-2.5 bg-white/10" />
															<span>
																{t('gifts.rarityPrefix')} {(model.rarity_permille / 10).toFixed(1)}%
															</span>
														</div>
													</div>

													<div class="text-right rtl:text-left shrink-0">
														<div class="text-xs font-black text-white font-mono">
															{fmt(model.floor_gram)} TON
														</div>
														<span
															class={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border inline-block mt-0.5 ${tier.bg}`}
														>
															{tier.label}
														</span>
													</div>
												</button>
											);
										}}
									</For>
								</div>
							</Show>

							{/* 2. Symbols List */}
							<Show when={attributeTab() === 'symbols'}>
								<div class="space-y-2">
									<For each={data()!.symbols_list || []}>
										{(sym, i) => (
											<div class="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-3 flex items-center justify-between text-xs">
												<div class="flex items-center gap-3">
													<span class="text-xs font-mono font-bold text-white/30 w-5 shrink-0 text-center">
														#{i() + 1}
													</span>
													<div>
														<span class="font-bold text-white block">{sym.name}</span>
														<span class="text-[10px] text-white/40">
															{t('gifts.supplyPrefix')} {sym.total_supply.toLocaleString()}
														</span>
													</div>
												</div>
												<span class="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
													{(sym.rarity_permille / 10).toFixed(1)}%
												</span>
											</div>
										)}
									</For>
								</div>
							</Show>

							{/* 3. Backdrops List */}
							<Show when={attributeTab() === 'backdrops'}>
								<div class="grid grid-cols-1 gap-2">
									<For each={data()!.backdrops_list || []}>
										{(bd) => (
											<div class="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-3 flex items-center justify-between">
												<div class="flex items-center gap-3">
													<div class="flex items-center -space-x-1.5 rtl:space-x-reverse">
														<div
															class="w-5 h-5 rounded-full border border-black/40 shadow-sm"
															style={{ 'background-color': bd.center_hex }}
															title="Center"
														/>
														<div
															class="w-5 h-5 rounded-full border border-black/40 shadow-sm"
															style={{ 'background-color': bd.edge_hex }}
															title="Edge"
														/>
														<div
															class="w-5 h-5 rounded-full border border-black/40 shadow-sm"
															style={{ 'background-color': bd.pattern_hex }}
															title="Pattern"
														/>
														<div
															class="w-5 h-5 rounded-full border border-black/40 shadow-sm"
															style={{ 'background-color': bd.text_hex }}
															title="Text"
														/>
													</div>
													<div>
														<span class="text-xs font-bold text-white block">{bd.name}</span>
														<span class="text-[9px] font-mono text-white/40 block">
															{bd.center_hex} · {bd.edge_hex}
														</span>
													</div>
												</div>
												<span class="text-[10px] font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-lg border border-sky-500/20">
													{(bd.rarity_permille / 10).toFixed(1)}%
												</span>
											</div>
										)}
									</For>
								</div>
							</Show>
						</div>
					</Show>

					{/* ═══════════════════════════════════════════════════════════ */}
					{/* TAB 5: VENUES (Existing)                                    */}
					{/* ═══════════════════════════════════════════════════════════ */}
					<Show when={selectedTab() === 'venues'}>
						<div class="bg-[#12141C]/80 border border-white/[0.06] rounded-3xl p-4 shadow-xl mb-4 space-y-3">
							<div class="flex items-center justify-between pb-2 border-b border-white/[0.06]">
								<h3 class="text-xs font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[#0098EA] text-base">storefront</span>
									<span>{t('gifts.venueFloorTitle')}</span>
								</h3>
							</div>

							<div class="space-y-2">
								<For each={data()!.venue_floors}>
									{(venue) => (
										<div class="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-3 flex items-center justify-between text-xs">
											<div class="flex items-center gap-2.5">
												<div class="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center font-bold text-white text-xs">
													{venue.venue_name.slice(0, 2).toUpperCase()}
												</div>
												<div>
													<div class="flex items-center gap-1.5">
														<span class="font-bold text-white">{venue.venue_name}</span>
														<Show when={venue.is_on_chain}>
															<span class="text-[8px] font-bold px-1 rounded bg-sky-500/15 text-sky-300">
																On-Chain
															</span>
														</Show>
													</div>
													<span class="text-[10px] text-white/40">
														{t('gifts.venueFeePrefix')} {venue.fee_pct}%
													</span>
												</div>
											</div>

											<div class="text-right rtl:text-left">
												<div class="font-black text-white font-mono">
													{fmt(venue.floor_gram)} TON
												</div>
												<span class="text-[10px] text-emerald-400 font-mono font-medium block">
													{t('gifts.netPayoutPrefix')} {fmt(venue.net_payout_gram)} TON
												</span>
											</div>
										</div>
									)}
								</For>
							</div>
						</div>
					</Show>

					{/* ═══════════════════════════════════════════════════════════ */}
					{/* TAB 6: HEATMAP (Existing)                                   */}
					{/* ═══════════════════════════════════════════════════════════ */}
					<Show when={selectedTab() === 'heatmap'}>
						<div class="bg-[#12141C]/80 border border-white/[0.06] rounded-3xl p-4 shadow-xl mb-4 space-y-3">
							<div class="flex items-center justify-between pb-2 border-b border-white/[0.06]">
								<h3 class="text-xs font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[#0098EA] text-base">heat_pump</span>
									<span>{t('gifts.rarityHeatmapTitle')}</span>
								</h3>
								<span class="text-[10px] text-white/40 font-mono">
									{filteredHeatmap().length} {t('gifts.combosFound') || 'ترکیب'}
								</span>
							</div>

							{/* Tier filter chips */}
							<div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
								<For each={['all', 'Mythic', 'Legendary', 'Epic', 'Rare', 'Common']}>
									{(tier) => (
										<button
											type="button"
											onClick={() => {
												setHeatmapTierFilter(tier);
												try {
													haptic.selection();
												} catch {}
											}}
											class={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all shrink-0 ${
												heatmapTierFilter().toLowerCase() === tier.toLowerCase()
													? 'bg-[#0098EA] text-white shadow'
													: 'bg-white/[0.03] text-white/50 hover:text-white border border-white/5'
											}`}
										>
											{tier === 'all' ? t('common.all') || 'همه' : tier}
										</button>
									)}
								</For>
							</div>

							<div class="space-y-2">
								<For each={filteredHeatmap().slice(0, 30)}>
									{(cell) => {
										const tierBadge = rarityTierBadgeByName(cell.rarity_tier);
										return (
											<button
												type="button"
												onClick={() => {
													navigate(`/gifts/report?g=${slug()}-1`);
													try {
														haptic.impact('light');
													} catch {}
												}}
												class="w-full bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] rounded-2xl p-3 flex items-center justify-between text-xs transition-all active:scale-[0.99] text-left rtl:text-right"
											>
												<div class="min-w-0 flex-1 pr-2 rtl:pr-0 rtl:pl-2">
													<span class="font-bold text-white block truncate">{cell.model_name}</span>
													<span class="text-[10px] text-white/40 block mt-0.5">
														{t('gifts.backdropPrefix')} {cell.backdrop_name}
													</span>
												</div>

												<div class="text-right rtl:text-left shrink-0">
													<span class="font-mono font-black text-white block">
														{fmt(cell.floor_gram)} TON
													</span>
													<span
														class={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded border inline-block mt-0.5 ${tierBadge.bg}`}
													>
														{cell.rarity_tier}
													</span>
												</div>
											</button>
										);
									}}
								</For>
							</div>
						</div>
					</Show>

					{/* ═══ Dutch Upgrade Auction Clock ═══ */}
					<Show when={data()!.upgrade_ladder && data()!.upgrade_ladder.length > 0}>
						<div class="bg-gradient-to-br from-[#12141C] to-[#0D111A] border border-white/[0.06] rounded-3xl p-4 shadow-xl mb-4 space-y-3">
							<div class="flex items-center justify-between">
								<h3 class="text-xs font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-amber-400 text-base">timer</span>
									<span>{t('gifts.dutchAuctionTitle')}</span>
								</h3>
								<span class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
									{t('gifts.staircasePriceReduction')}
								</span>
							</div>

							<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
								<For each={data()!.upgrade_ladder.slice(0, 4)}>
									{(step) => (
										<div
											class={`p-2.5 rounded-2xl border text-center transition-all ${
												step.is_current
													? 'bg-[#0098EA]/15 border-[#0098EA]/40 text-white'
													: 'bg-white/[0.02] border-white/[0.05] text-white/70'
											}`}
										>
											<span class="text-[9px] text-white/40 block font-bold">
												{t('gifts.stepPrefix', { step: step.step })}
											</span>
											<span class="font-black text-white font-mono text-xs block mt-0.5">
												{step.price_stars.toLocaleString()} Stars
											</span>
											<span class="text-[10px] text-white/40 font-mono block">
												(≈ {fmt(step.price_gram)} TON)
											</span>
										</div>
									)}
								</For>
							</div>
						</div>
					</Show>

					{/* ═══ Footer & Official Attribution ═══ */}
					<div class="mt-6 text-center text-[10px] text-white/30 font-medium space-y-1.5 pb-4">
						<div class="flex items-center justify-center gap-2">
							<span>{t('gifts.poweredBy')}</span>
							<span>·</span>
							<span class="px-2 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded-full text-white/50 font-bold">
								{t('gifts.thanksTo')}
							</span>
						</div>
						<p class="text-white/20">{t('gifts.officialAttribution')}</p>
					</div>
				</Show>
			</div>
		</div>
	);
};

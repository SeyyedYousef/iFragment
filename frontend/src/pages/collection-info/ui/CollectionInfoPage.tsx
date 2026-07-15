import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { backButton } from '@tma.js/sdk-solid';
import { Component, createMemo, For, Show } from 'solid-js';
import { apiClient as api } from '@/shared/api/axios.js';
import { t } from '@/shared/i18n/index.js';

interface CollectionStats {
	stat_date: string;
	items_count: string;
	owners_count: string;
	floor_price: string;
	total_volume: string;
}

interface CollectionCategory {
	category_name: string;
	volume: string;
}

interface CollectionAuction {
	item_name: string;
	price: string;
	status: string;
}

interface CollectionData {
	stats: CollectionStats | null;
	categories: CollectionCategory[];
	auctions: CollectionAuction[];
	top_sales: CollectionAuction[];
	recent_activity: CollectionAuction[];
	fear_greed_index: number;
	fear_greed_label: string;
	status?: string;
}

export const CollectionInfoPage: Component = () => {
	const navigate = useNavigate();

	// Setup TMA back button
	backButton.show();
	backButton.onClick(() => {
		navigate(-1);
	});

	const query = createQuery(() => ({
		queryKey: ['collectionStats'],
		queryFn: async () => {
			const { data } = await api.get<CollectionData>('/collection/stats');
			return data;
		},
		staleTime: 5 * 60 * 1000,
	}));

	// Robust parsing for volume strings like "100k TON", "1.2M TON"
	const parseVolume = (volStr: string): number => {
		if (!volStr) return 0;
		const cleaned = volStr.toUpperCase().replace(/[^\d.KMB]/g, '');
		let multiplier = 1;
		if (cleaned.includes('K')) multiplier = 1_000;
		if (cleaned.includes('M')) multiplier = 1_000_000;
		if (cleaned.includes('B')) multiplier = 1_000_000_000;
		const val = parseFloat(cleaned.replace(/[KMB]/g, ''));
		return Number.isNaN(val) ? 0 : val * multiplier;
	};

	const getMaxVolume = (categories: CollectionCategory[]): number => {
		let max = 0;
		for (const cat of categories) {
			const val = parseVolume(cat.volume);
			if (val > max) max = val;
		}
		return max || 1;
	};

	// Calculate dynamic values safely
	const calculateMarketCap = (items: string, floor: string): string => {
		const itemsNum = parseVolume(items);
		const floorNum = parseVolume(floor);
		if (itemsNum > 0 && floorNum > 0) {
			const cap = itemsNum * floorNum;
			if (cap > 1000000) return `${(cap / 1000000).toFixed(1)}M TON`;
			if (cap > 1000) return `${(cap / 1000).toFixed(1)}K TON`;
			return `${cap.toString()} TON`;
		}
		return '---';
	};

	const highestSale = createMemo(() => {
		const data = query.data;
		if (!data?.top_sales || data.top_sales.length === 0) return null;
		let maxVal = 0;
		let maxStr = '';
		for (const sale of data.top_sales) {
			const val = parseVolume(sale.price);
			if (val > maxVal) {
				maxVal = val;
				maxStr = sale.price;
			}
		}
		return maxVal > 0 ? { priceVal: maxVal, priceStr: maxStr } : null;
	});

	const volumeCapContrast = createMemo(() => {
		const data = query.data;
		if (!data?.stats) return null;
		const volVal = parseVolume(data.stats.total_volume || '0');
		const itemsNum = parseVolume(data.stats.items_count || '0');
		const floorNum = parseVolume(data.stats.floor_price || '0');
		const capVal = itemsNum * floorNum;
		if (volVal > 0 && capVal > 0) {
			if (volVal >= capVal) {
				return {
					ratioStr: `${(volVal / capVal).toFixed(1)}x`,
					label: 'Volume to Cap',
				};
			}
			return {
				ratioStr: `${((volVal / capVal) * 100).toFixed(0)}%`,
				label: 'Cap Traded',
			};
		}
		return null;
	});

	const fearGreedNotice = createMemo(() => {
		const idx = query.data?.fear_greed_index ?? 78;
		if (idx < 30) {
			return {
				index: idx,
				title: 'Opportunity Zone (Extreme Fear)',
				desc: "Market is fearful. Don't miss out on heavily discounted floor prices before the next recovery.",
				icon: 'trending_up',
				color: '#10b981',
				badgeClass: 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20',
				noticeClass: 'border-[#10b981]/20 bg-[#10b981]/5 text-[#10b981]',
			};
		}
		if (idx < 50) {
			return {
				index: idx,
				title: 'Strategic Buy Zone (Fear)',
				desc: 'Lower market activity presents a window for strategic selection before the next volume surge.',
				icon: 'shopping_cart',
				color: '#06b6d4',
				badgeClass: 'bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20',
				noticeClass: 'border-[#06b6d4]/20 bg-[#06b6d4]/5 text-[#06b6d4]',
			};
		}
		if (idx < 75) {
			return {
				index: idx,
				title: 'Caution Zone (Greed)',
				desc: 'Market is heating up. Exercise caution as buying pressure rises; focus on high-utility assets.',
				icon: 'warning',
				color: '#f97316',
				badgeClass: 'bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20',
				noticeClass: 'border-[#f97316]/20 bg-[#f97316]/5 text-[#f97316]',
			};
		}
		return {
			index: idx,
			title: 'Correction Risk Warning (Extreme Greed)',
			desc: 'Extreme Greed! Protect capital from buying at the top. FOMO risk is high; sudden corrections may occur.',
			icon: 'error',
			color: '#ef4444',
			badgeClass: 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20',
			noticeClass: 'border-[#ef4444]/20 bg-[#ef4444]/5 text-[#ef4444]',
		};
	});

	return (
		<div class="min-h-screen bg-[#080808] flex flex-col p-5 text-[#e0e0e0] font-sans pb-28 relative">
			{/* Subtle premium background glow */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[300px] bg-[#0098ea]/5 blur-[120px] rounded-[100%] pointer-events-none z-0" />

			<Show when={query.isLoading}>
				<div class="flex flex-col items-center justify-center h-[70vh] relative z-10">
					<div class="w-10 h-10 border-2 border-white/10 border-t-[#0098ea] rounded-full animate-spin mb-4" />
					<p class="text-white/40 text-sm font-medium tracking-wide">
						{t('action.loading' as any, { defaultValue: 'Loading data...' })}
					</p>
				</div>
			</Show>

			<Show when={query.isError}>
				<div class="flex flex-col items-center justify-center h-48 bg-[#151516] rounded-2xl border border-red-500/20 p-6 text-center relative z-10 mt-10 mx-2">
					<span class="material-symbols-outlined text-red-400 text-3xl mb-3">error</span>
					<p class="text-[#e0e0e0] font-semibold text-sm mb-1">
						{t('action.username.failedToLoad' as any, {
							defaultValue: 'Failed to load market data',
						})}
					</p>
					<p class="text-xs text-[#8e8e93]">Please try again later.</p>
				</div>
			</Show>

			<Show when={query.isSuccess && query.data?.status === 'pending'}>
				<div class="flex flex-col items-center justify-center h-48 bg-[#151516] rounded-2xl border border-white/5 p-6 text-center relative z-10 mt-10 mx-2">
					<span class="material-symbols-outlined text-[#8e8e93] text-3xl mb-3 animate-pulse">
						hourglass_empty
					</span>
					<p class="text-[#e0e0e0] font-semibold text-sm">
						{t('action.username.collectionPending')}
					</p>
				</div>
			</Show>

			<Show when={query.isSuccess && query.data?.stats}>
				<div class="relative z-10 space-y-6">
					{/* Premium Typographic Hero */}
					<div class="pt-6 pb-4">
						<div class="inline-block px-3 py-1 bg-[#1a1a1c] border border-white/10 rounded-full text-xs font-mono text-[#8e8e93] mb-4">
							TON TELEGRAM USERNAMES
						</div>
						<h1 class="text-4xl font-extrabold tracking-tight text-white mb-2 leading-tight">
							{t('action.username.title')}
						</h1>
						<p class="text-sm text-[#8e8e93] leading-relaxed max-w-[90%]">
							{t('action.username.collection_stats_subtitle')}
						</p>
					</div>

					{/* Scarcity & Fear/Greed Widget (Premium Fragment Style) */}
					<div class="flex flex-col bg-[#111112] border border-white/5 rounded-2xl p-5 relative overflow-hidden shadow-2xl space-y-4">
						<div class="flex items-center justify-between">
							<div class="flex flex-col">
								<span class="text-xs font-medium text-[#8e8e93] mb-1">
									{t('action.username.fearGreed')}
								</span>
								<div class="flex items-center space-x-2">
									<span class="text-3xl font-black text-white">{fearGreedNotice().index}</span>
									<span
										class={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${fearGreedNotice().badgeClass}`}
									>
										{query.data?.fear_greed_label ?? 'Greed'}
									</span>
								</div>
							</div>
							<div class="w-16 h-16 relative">
								{/* Simple circular gauge representation */}
								<svg viewBox="0 0 36 36" class="w-full h-full transform -rotate-90">
									<path
										class="text-white/5"
										d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
										fill="none"
										stroke="currentColor"
										stroke-width="3"
									/>
									<path
										style={{ color: fearGreedNotice().color }}
										stroke-dasharray={`${fearGreedNotice().index * 0.8}, 100`}
										d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
										fill="none"
										stroke="currentColor"
										stroke-width="3"
										stroke-linecap="round"
									/>
								</svg>
							</div>
						</div>

						{/* Loss Aversion warning notice */}
						<div
							class={`flex items-start space-x-2.5 p-3 rounded-xl border ${fearGreedNotice().noticeClass}`}
						>
							<span class="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
								{fearGreedNotice().icon}
							</span>
							<div class="flex flex-col">
								<span class="text-[11px] font-bold">
									{t(`action.username.fg.${fearGreedNotice().icon}` as any, {
										defaultValue: fearGreedNotice().title,
									})}
								</span>
								<span class="text-[10px] text-[#8e8e93] leading-relaxed mt-0.5">
									{t(`action.username.fg.desc.${fearGreedNotice().icon}` as any, {
										defaultValue: fearGreedNotice().desc,
									})}
								</span>
							</div>
						</div>
					</div>

					{/* Main Stats Grid */}
					<div class="grid grid-cols-2 gap-3">
						{/* Floor Price */}
						<div
							class="bg-[#111112] border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-colors flex flex-col justify-between"
							role="button"
							tabindex="0"
						>
							<div>
								<span class="text-[10px] text-[#8e8e93] uppercase tracking-wider font-semibold block mb-1">
									{t('action.username.floorPrice')}
								</span>
								<div class="flex items-end space-x-1">
									<span class="text-xl font-bold text-white">
										{query.data?.stats?.floor_price?.replace('TON', '').trim()}
									</span>
									<span class="text-xs text-[#0098ea] font-bold mb-0.5">TON</span>
								</div>
							</div>
							<Show when={highestSale()}>
								{(highest) => {
									const floorVal = parseVolume(query.data?.stats?.floor_price || '0');
									const discountPct =
										floorVal > 0 && highest().priceVal > floorVal
											? (1 - floorVal / highest().priceVal) * 100
											: 0;
									return (
										<Show when={discountPct > 0}>
											<div class="mt-2 pt-2 border-t border-white/5">
												<div class="flex items-center justify-between text-[9px] text-[#8e8e93]">
													<span>vs Top Sale</span>
													<span class="text-emerald-400 font-bold">
														-{discountPct.toFixed(discountPct > 99 ? 1 : 0)}%
													</span>
												</div>
												<div class="text-[8px] text-white/40 mt-0.5 text-right font-mono">
													Top: {highest().priceStr.replace('TON', '').trim()} TON
												</div>
											</div>
										</Show>
									);
								}}
							</Show>
						</div>

						{/* Total Volume */}
						<div
							class="bg-[#111112] border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-colors flex flex-col justify-between"
							role="button"
							tabindex="0"
						>
							<div>
								<span class="text-[10px] text-[#8e8e93] uppercase tracking-wider font-semibold block mb-1">
									{t('action.username.totalVolume')}
								</span>
								<div class="flex items-end space-x-1">
									<span class="text-xl font-bold text-white">
										{query.data?.stats?.total_volume?.replace('TON', '').trim()}
									</span>
									<span class="text-xs text-[#0098ea] font-bold mb-0.5">TON</span>
								</div>
							</div>
							<Show when={volumeCapContrast()}>
								{(contrast) => (
									<div class="mt-2 pt-2 border-t border-white/5">
										<div class="flex items-center justify-between text-[9px] text-[#8e8e93]">
											<span>{contrast().label}</span>
											<span class="text-cyan-400 font-bold">{contrast().ratioStr}</span>
										</div>
										<div class="text-[8px] text-white/40 mt-0.5 text-right font-mono">
											Cap:{' '}
											{calculateMarketCap(
												query.data?.stats?.items_count || '0',
												query.data?.stats?.floor_price || '0',
											)}
										</div>
									</div>
								)}
							</Show>
						</div>

						{/* Total Supply */}
						<div
							class="bg-[#111112] border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-colors"
							role="button"
							tabindex="0"
						>
							<span class="text-[10px] text-[#8e8e93] uppercase tracking-wider font-semibold block mb-1">
								{t('action.username.totalSupply')}
							</span>
							<span class="text-xl font-bold text-white">{query.data?.stats?.items_count}</span>
						</div>

						{/* Owners */}
						<div
							class="bg-[#111112] border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-colors"
							role="button"
							tabindex="0"
						>
							<span class="text-[10px] text-[#8e8e93] uppercase tracking-wider font-semibold block mb-1">
								{t('action.username.holders')}
							</span>
							<span class="text-xl font-bold text-white">{query.data?.stats?.owners_count}</span>
						</div>
					</div>

					{/* Derived Stat: Market Cap */}
					<div
						class="bg-gradient-to-br from-[#18181b] to-[#111113] border border-white/5 rounded-2xl p-5 flex items-center justify-between"
						role="button"
						tabindex="0"
					>
						<div>
							<span class="text-[11px] text-[#8e8e93] uppercase tracking-wider font-semibold flex items-center mb-1">
								<span class="material-symbols-outlined text-[14px] mr-1">monitoring</span>
								{t('action.username.marketCap')}
							</span>
							<span class="text-2xl font-black text-white">
								{calculateMarketCap(
									query.data?.stats?.items_count || '0',
									query.data?.stats?.floor_price || '0',
								)}
							</span>
						</div>
						<div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
							<span class="material-symbols-outlined text-[#0098ea]">diamond</span>
						</div>
					</div>

					{/* Derived Stat: Token/Holder Distribution */}
					<div class="bg-[#111112] border border-white/5 rounded-2xl p-5">
						<h3 class="text-xs font-semibold tracking-wider text-[#8e8e93] uppercase mb-4">
							{t('action.username.holdersDistribution')}
						</h3>
						{/* Visual Mock of Distribution */}
						<div class="space-y-3">
							<div class="flex items-center justify-between text-sm">
								<span class="text-[#e0e0e0] text-sm">1 Item</span>
								<span class="font-mono text-[#8e8e93] text-sm">72%</span>
							</div>
							<div class="w-full bg-[#1c1c1e] h-1.5 rounded-full overflow-hidden">
								<div class="bg-[#0098ea] h-full w-[72%]" />
							</div>

							<div class="flex items-center justify-between text-sm pt-1">
								<span class="text-[#e0e0e0] text-sm">2-5 Items</span>
								<span class="font-mono text-[#8e8e93] text-sm">18%</span>
							</div>
							<div class="w-full bg-[#1c1c1e] h-1.5 rounded-full overflow-hidden">
								<div class="bg-[#0098ea]/70 h-full w-[18%]" />
							</div>

							<div class="flex items-center justify-between text-sm pt-1">
								<span class="text-[#e0e0e0] text-sm">Whales (50+)</span>
								<span class="font-mono text-[#8e8e93] text-sm">2%</span>
							</div>
							<div class="w-full bg-[#1c1c1e] h-1.5 rounded-full overflow-hidden">
								<div class="bg-white/20 h-full w-[2%]" />
							</div>
						</div>
					</div>

					{/* Top Categories */}
					<Show when={(query.data?.categories?.length ?? 0) > 0}>
						<div>
							<h3 class="text-xs font-semibold tracking-wider text-[#8e8e93] uppercase mb-3">
								{t('action.username.topCategories')}
							</h3>
							<div class="grid grid-cols-1 gap-2">
								{(() => {
									const maxVol = getMaxVolume(query.data?.categories || []);
									return (
										<For each={query.data?.categories.slice(0, 4)}>
											{(cat) => {
												const pct = `${Math.min(100, (parseVolume(cat.volume) / maxVol) * 100)}%`;
												return (
													<div
														class="bg-[#111112] border border-white/5 rounded-xl p-3 flex flex-col justify-center relative overflow-hidden group hover:bg-[#1a1a1c] transition-colors"
														role="button"
														tabindex="0"
													>
														<div class="flex items-center justify-between mb-2 relative z-10">
															<span class="text-sm font-medium text-white">
																{cat.category_name}
															</span>
															<span class="text-xs font-mono text-[#0098ea]">{cat.volume}</span>
														</div>
														<div class="w-full bg-[#1c1c1e] h-1 rounded-full overflow-hidden relative z-10">
															<div
																class="bg-[#303033] h-full rounded-full group-hover:bg-[#505055] transition-all"
																style={{ width: pct }}
															/>
														</div>
													</div>
												);
											}}
										</For>
									);
								})()}
							</div>
						</div>
					</Show>

					{/* Active Auctions & Recent Activity */}
					<Show
						when={
							(query.data?.auctions?.length ?? 0) > 0 || (query.data?.top_sales?.length ?? 0) > 0
						}
					>
						<div>
							<h3 class="text-xs font-semibold tracking-wider text-[#8e8e93] uppercase mb-3">
								{t('action.username.topAuctions')}
							</h3>
							<div class="bg-[#111112] border border-white/5 rounded-2xl overflow-hidden">
								<For each={(query.data?.auctions || []).slice(0, 5)}>
									{(auc, index) => (
										<div
											class={`flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors cursor-pointer ${index() !== 0 ? 'border-t border-white/5' : ''}`}
											role="button"
											tabindex="0"
										>
											<div class="flex items-center space-x-3">
												<div class="w-10 h-10 rounded-full bg-[#1c1c1e] flex items-center justify-center text-[#e0e0e0] font-mono text-xs border border-white/5">
													{auc.item_name.substring(1, 3).toUpperCase()}
												</div>
												<div class="flex flex-col">
													<span class="font-mono text-sm font-semibold text-white">
														{auc.item_name}
													</span>
													<span class="text-[10px] text-[#8e8e93] mt-0.5 flex items-center">
														<span class="w-1.5 h-1.5 rounded-full bg-[#0098ea] mr-1.5 animate-pulse" />
														{auc.status === 'Active' ? t('action.username.active') : auc.status}
													</span>
												</div>
											</div>
											<div class="text-right">
												<span class="block text-sm font-bold text-white">{auc.price}</span>
												<span class="block text-[10px] text-[#8e8e93]">TON</span>
											</div>
										</div>
									)}
								</For>
							</div>
						</div>
					</Show>
				</div>
			</Show>
		</div>
	);
};

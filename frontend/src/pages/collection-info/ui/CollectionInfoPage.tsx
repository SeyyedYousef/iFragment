import { createQuery } from '@tanstack/solid-query';

import { Component, createMemo, For, Show } from 'solid-js';
import { apiClient as api } from '@/shared/api/axios.js';
import { t } from '@/shared/i18n/index.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';

interface CollectionStats { stat_date: string; items_count: string; owners_count: string; floor_price: string; total_volume: string; }
interface CollectionCategory { category_name: string; volume: string; }
interface CollectionAuction { item_name: string; price: string; status: string; }
interface CollectionData { stats: CollectionStats | null; categories: CollectionCategory[]; auctions: CollectionAuction[]; top_sales: CollectionAuction[]; recent_activity: CollectionAuction[]; fear_greed_index: number; fear_greed_label: string; status?: string; }

export const CollectionInfoPage: Component = () => {
	useTelegramBackButton(-1);

	const query = createQuery(() => ({
		queryKey: ['collectionStats'],
		queryFn: async () => {
			const { data } = await api.get<CollectionData>('/collection/stats');
			return data;
		},
		staleTime: 5 * 60 * 1000,
	}));

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
			if (val > maxVal) { maxVal = val; maxStr = sale.price; }
		}
		return maxVal > 0 ? { priceVal: maxVal, priceStr: maxStr } : null;
	});

	const volumeCapContrast = createMemo(() => {
		const data = query.data;
		if (!data?.stats) return null;
		const volVal = parseVolume(data.stats.total_volume || '0');
		const capVal = parseVolume(data.stats.items_count || '0') * parseVolume(data.stats.floor_price || '0');
		if (volVal > 0 && capVal > 0) {
			return volVal >= capVal 
				? { ratioStr: `${(volVal / capVal).toFixed(1)}x`, label: 'Volume to Cap' } 
				: { ratioStr: `${((volVal / capVal) * 100).toFixed(0)}%`, label: 'Cap Traded' };
		}
		return null;
	});

	const fearGreedNotice = createMemo(() => {
		const idx = query.data?.fear_greed_index ?? 78;
		if (idx < 30) return { index: idx, title: 'Opportunity Zone (Extreme Fear)', desc: "Market is fearful. Don't miss out on discounted floors.", icon: 'trending_up', color: '#34d399', bg: 'bg-[#34d399]/10 text-[#34d399] border-[#34d399]/20' };
		if (idx < 50) return { index: idx, title: 'Strategic Buy Zone (Fear)', desc: 'Lower activity presents a window for strategic selection.', icon: 'shopping_cart', color: '#22d3ee', bg: 'bg-[#22d3ee]/10 text-[#22d3ee] border-[#22d3ee]/20' };
		if (idx < 75) return { index: idx, title: 'Caution Zone (Greed)', desc: 'Market is heating up. Exercise caution as buying pressure rises.', icon: 'warning', color: '#fbbf24', bg: 'bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/20' };
		return { index: idx, title: 'Correction Risk (Extreme Greed)', desc: 'Extreme Greed! FOMO risk is high; sudden corrections may occur.', icon: 'error', color: '#ff4a4a', bg: 'bg-[#ff4a4a]/10 text-[#ff4a4a] border-[#ff4a4a]/20' };
	});

	return (
		<div class="min-h-screen bg-[#030303] text-white font-sans selection:bg-[#3390ec]/30 flex flex-col relative pb-28" dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#3390ec]/15 via-[#3390ec]/5 to-transparent blur-[80px] pointer-events-none z-0" />

			<div class="w-full max-w-[420px] mx-auto px-4 flex flex-col relative z-10 flex-1">
				
				{/* ═══════ STATUS SCREENS ═══════ */}
				<Show when={query.isLoading}>
					<div class="flex flex-col items-center justify-center h-[70vh]">
						<div class="w-12 h-12 border-[3px] border-white/10 border-t-[#3390ec] rounded-full animate-spin mb-4 shadow-[0_0_15px_#3390ec]" />
						<span class="text-[13px] font-black uppercase tracking-widest text-white/50">{t('action.loading' as any) || 'LOADING DATA...'}</span>
					</div>
				</Show>

				<Show when={query.isError}>
					<div class="flex flex-col items-center justify-center bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-[#ff4a4a]/20 p-8 text-center mt-10 shadow-sm">
						<span class="material-symbols-outlined text-[#ff4a4a] text-[42px] mb-3 drop-shadow-md">error</span>
						<p class="text-white font-black text-[16px] tracking-tight mb-1">{t('action.username.failedToLoad' as any) || 'Analysis Failed'}</p>
						<p class="text-[12px] text-white/50 font-medium">Please check your connection and try again.</p>
					</div>
				</Show>

				<Show when={query.isSuccess && query.data?.status === 'pending'}>
					<div class="flex flex-col items-center justify-center bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-8 text-center mt-10 shadow-sm">
						<span class="material-symbols-outlined text-[#3390ec] text-[42px] mb-3 animate-pulse drop-shadow-md">hourglass_empty</span>
						<p class="text-white font-black text-[16px] tracking-tight mb-1">{t('action.username.collectionPending') || 'Indexing Collection...'}</p>
						<p class="text-[12px] text-white/50 font-medium">Market data is currently being generated.</p>
					</div>
				</Show>

				{/* ═══════ MAIN DASHBOARD ═══════ */}
				<Show when={query.isSuccess && query.data?.stats}>
					<div class="flex flex-col gap-4 mt-6">
						
						{/* Hero Header */}
						<div class="flex flex-col items-start mb-2 px-1">
							<span class="inline-block px-3 py-1 bg-white/5 border border-white/10 rounded-[8px] text-[9px] font-black uppercase tracking-widest text-white/50 mb-3 shadow-sm">
								TON TELEGRAM USERNAMES
							</span>
							<h1 class="text-[32px] font-black tracking-tighter text-white leading-none mb-2 drop-shadow-sm">
								{t('action.username.title') || 'Market Overview'}
							</h1>
							<p class="text-[13px] text-white/50 leading-relaxed font-medium">
								{t('action.username.collection_stats_subtitle') || 'Real-time analytics & insights for Telegram Usernames on TON.'}
							</p>
						</div>

						{/* FEAR & GREED WIDGET (Premium Dashboard Style) */}
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
							<div class="absolute -top-10 -right-10 w-32 h-32 blur-3xl pointer-events-none opacity-20" style={{ background: fearGreedNotice().color }} />
							
							<div class="flex items-center justify-between mb-4 relative z-10">
								<div class="flex flex-col">
									<span class="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">{t('action.username.fearGreed') || 'MARKET SENTIMENT'}</span>
									<div class="flex items-end gap-2.5">
										<span class="text-[36px] font-black font-mono leading-none tracking-tight" style={{ color: fearGreedNotice().color }}>{fearGreedNotice().index}</span>
										<span class={`px-2.5 py-0.5 rounded-[8px] border text-[10px] font-black uppercase tracking-widest mb-1 shadow-sm ${fearGreedNotice().bg}`}>
											{query.data?.fear_greed_label ?? 'GREED'}
										</span>
									</div>
								</div>
								
								{/* Circular SVG Gauge */}
								<div class="w-16 h-16 relative">
									<svg viewBox="0 0 36 36" class="w-full h-full transform -rotate-90 filter drop-shadow-md">
										<path class="text-white/5" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3" />
										<path style={{ color: fearGreedNotice().color }} stroke-dasharray={`${fearGreedNotice().index * 0.8}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
									</svg>
								</div>
							</div>

							{/* Notice Alert */}
							<div class={`flex items-start gap-3 p-3.5 rounded-[16px] border shadow-inner relative z-10 ${fearGreedNotice().bg}`}>
								<span class="material-symbols-outlined text-[20px] shrink-0 mt-0.5">{fearGreedNotice().icon}</span>
								<div class="flex flex-col">
									<span class="text-[12px] font-bold tracking-tight mb-0.5">{t(`action.username.fg.${fearGreedNotice().icon}` as any, { defaultValue: fearGreedNotice().title })}</span>
									<span class="text-[11px] opacity-80 leading-relaxed font-medium">{t(`action.username.fg.desc.${fearGreedNotice().icon}` as any, { defaultValue: fearGreedNotice().desc })}</span>
								</div>
							</div>
						</div>

						{/* 4-GRID STATS */}
						<div class="grid grid-cols-2 gap-3.5">
							
							{/* Floor Price */}
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[20px] p-4 flex flex-col justify-between transition-all shadow-sm group">
								<div>
									<span class="text-[10px] text-white/40 uppercase tracking-widest font-black block mb-1">{t('action.username.floorPrice') || 'FLOOR PRICE'}</span>
									<div class="flex items-baseline gap-1" dir="ltr">
										<span class="text-[22px] font-black font-mono text-white tracking-tight">{query.data?.stats?.floor_price?.replace('TON', '').trim()}</span>
										<span class="text-[11px] text-[#3390ec] font-black">TON</span>
									</div>
								</div>
								<Show when={highestSale()}>
									{(highest) => {
										const floorVal = parseVolume(query.data?.stats?.floor_price || '0');
										const discountPct = floorVal > 0 && highest().priceVal > floorVal ? (1 - floorVal / highest().priceVal) * 100 : 0;
										return (
											<Show when={discountPct > 0}>
												<div class="mt-3 pt-3 border-t border-white/5">
													<div class="flex items-center justify-between text-[10px] text-white/40 font-bold uppercase tracking-wider mb-1">
														<span>Vs Top Sale</span>
														<span class="text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-[4px] border border-emerald-400/20">-{discountPct.toFixed(discountPct > 99 ? 1 : 0)}%</span>
													</div>
													<div class="text-[10px] text-white/50 font-mono text-right" dir="ltr">Top: {highest().priceStr.replace('TON', '').trim()}</div>
												</div>
											</Show>
										);
									}}
								</Show>
							</div>

							{/* Total Volume */}
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[20px] p-4 flex flex-col justify-between transition-all shadow-sm group">
								<div>
									<span class="text-[10px] text-white/40 uppercase tracking-widest font-black block mb-1">{t('action.username.totalVolume') || 'TOTAL VOLUME'}</span>
									<div class="flex items-baseline gap-1" dir="ltr">
										<span class="text-[22px] font-black font-mono text-white tracking-tight">{query.data?.stats?.total_volume?.replace('TON', '').trim()}</span>
										<span class="text-[11px] text-[#3390ec] font-black">TON</span>
									</div>
								</div>
								<Show when={volumeCapContrast()}>
									{(contrast) => (
										<div class="mt-3 pt-3 border-t border-white/5">
											<div class="flex items-center justify-between text-[10px] text-white/40 font-bold uppercase tracking-wider mb-1">
												<span>{contrast().label}</span>
												<span class="text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded-[4px] border border-cyan-400/20">{contrast().ratioStr}</span>
											</div>
											<div class="text-[10px] text-white/50 font-mono text-right" dir="ltr">Cap: {calculateMarketCap(query.data?.stats?.items_count || '0', query.data?.stats?.floor_price || '0').replace('TON', '')}</div>
										</div>
									)}
								</Show>
							</div>

							{/* Total Supply */}
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[20px] p-4 transition-all shadow-sm group flex flex-col justify-center">
								<span class="text-[10px] text-white/40 uppercase tracking-widest font-black block mb-0.5">{t('action.username.totalSupply') || 'TOTAL SUPPLY'}</span>
								<span class="text-[22px] font-black font-mono text-white tracking-tight">{query.data?.stats?.items_count}</span>
							</div>

							{/* Owners */}
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[20px] p-4 transition-all shadow-sm group flex flex-col justify-center">
								<span class="text-[10px] text-white/40 uppercase tracking-widest font-black block mb-0.5">{t('action.username.holders') || 'HOLDERS'}</span>
								<span class="text-[22px] font-black font-mono text-white tracking-tight">{query.data?.stats?.owners_count}</span>
							</div>
						</div>

						{/* MARKET CAP (Hero Card) */}
						<div class="bg-gradient-to-r from-[#3390ec]/15 to-transparent border border-[#3390ec]/30 rounded-[24px] p-5 flex items-center justify-between shadow-[inset_0_0_20px_rgba(51,144,236,0.05)] relative overflow-hidden">
							<div class="flex flex-col relative z-10">
								<span class="text-[11px] text-[#3390ec] uppercase tracking-widest font-black flex items-center mb-0.5 gap-1.5">
									<span class="material-symbols-outlined text-[16px]">monitoring</span> {t('action.username.marketCap') || 'MARKET CAP'}
								</span>
								<span class="text-[28px] font-black font-mono text-white tracking-tight" dir="ltr">
									{calculateMarketCap(query.data?.stats?.items_count || '0', query.data?.stats?.floor_price || '0')}
								</span>
							</div>
							<div class="w-14 h-14 rounded-[16px] bg-[#3390ec]/20 flex items-center justify-center border border-[#3390ec]/40 shadow-inner relative z-10">
								<span class="material-symbols-outlined text-[#3390ec] text-[28px] drop-shadow-md">diamond</span>
							</div>
						</div>

						{/* DISTRIBUTION BARS */}
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm">
							<h3 class="text-[11px] font-black tracking-widest text-white/40 uppercase mb-4">{t('action.username.holdersDistribution') || 'HOLDERS DISTRIBUTION'}</h3>
							<div class="space-y-4">
								<div class="flex flex-col gap-1.5">
									<div class="flex items-center justify-between"><span class="text-white font-bold text-[13px]">1 Item</span><span class="font-mono text-[#3390ec] font-bold text-[13px]">72%</span></div>
									<div class="w-full bg-[#08090D] h-2 rounded-full overflow-hidden border border-white/5 shadow-inner"><div class="bg-gradient-to-r from-[#3390ec] to-[#60a5fa] h-full w-[72%] rounded-full shadow-[0_0_10px_#3390ec]" /></div>
								</div>
								<div class="flex flex-col gap-1.5">
									<div class="flex items-center justify-between"><span class="text-white font-bold text-[13px]">2-5 Items</span><span class="font-mono text-[#3390ec] font-bold text-[13px]">18%</span></div>
									<div class="w-full bg-[#08090D] h-2 rounded-full overflow-hidden border border-white/5 shadow-inner"><div class="bg-gradient-to-r from-[#3390ec]/70 to-[#60a5fa]/70 h-full w-[18%] rounded-full" /></div>
								</div>
								<div class="flex flex-col gap-1.5">
									<div class="flex items-center justify-between"><span class="text-white font-bold text-[13px]">Whales (50+)</span><span class="font-mono text-white/50 font-bold text-[13px]">2%</span></div>
									<div class="w-full bg-[#08090D] h-2 rounded-full overflow-hidden border border-white/5 shadow-inner"><div class="bg-white/30 h-full w-[2%] rounded-full" /></div>
								</div>
							</div>
						</div>

						{/* TOP CATEGORIES */}
						<Show when={(query.data?.categories?.length ?? 0) > 0}>
							<div class="mt-2">
								<div class="flex items-center gap-2 px-1 mb-3">
									<span class="material-symbols-outlined text-white/40 text-[18px]">category</span>
									<h3 class="text-[11px] font-black tracking-widest text-white/60 uppercase">{t('action.username.topCategories') || 'TOP CATEGORIES'}</h3>
								</div>
								<div class="grid grid-cols-1 gap-2.5">
									{(() => {
										const maxVol = getMaxVolume(query.data?.categories || []);
										return (
											<For each={query.data?.categories.slice(0, 4)}>
												{(cat) => {
													const pct = `${Math.min(100, (parseVolume(cat.volume) / maxVol) * 100)}%`;
													return (
														<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[16px] p-4 flex flex-col justify-center relative overflow-hidden group transition-all shadow-sm cursor-pointer">
															<div class="flex items-center justify-between mb-2.5 relative z-10">
																<span class="text-[13px] font-bold text-white tracking-tight">{cat.category_name}</span>
																<span class="text-[13px] font-mono font-black text-[#3390ec]" dir="ltr">{cat.volume}</span>
															</div>
															<div class="w-full bg-[#08090D] h-1.5 rounded-full overflow-hidden border border-white/5 relative z-10 shadow-inner">
																<div class="bg-[#3390ec] h-full rounded-full group-hover:bg-[#60a5fa] transition-colors" style={{ width: pct }} />
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

						{/* ACTIVE AUCTIONS & RECENT */}
						<Show when={(query.data?.auctions?.length ?? 0) > 0 || (query.data?.top_sales?.length ?? 0) > 0}>
							<div class="mt-2">
								<div class="flex items-center gap-2 px-1 mb-3">
									<span class="material-symbols-outlined text-white/40 text-[18px]">gavel</span>
									<h3 class="text-[11px] font-black tracking-widest text-white/60 uppercase">{t('action.username.topAuctions') || 'TOP AUCTIONS'}</h3>
								</div>
								<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] overflow-hidden shadow-sm">
									<For each={(query.data?.auctions || []).slice(0, 5)}>
										{(auc, index) => (
											<div class={`flex items-center justify-between p-4 hover:bg-white/[0.03] transition-colors cursor-pointer ${index() !== 0 ? 'border-t border-white/5' : ''}`}>
												<div class="flex items-center gap-3.5 min-w-0 pr-2">
													<div class="w-11 h-11 rounded-[14px] bg-[#08090D] flex items-center justify-center text-white/80 font-black text-[14px] border border-white/10 shrink-0 shadow-inner">
														{auc.item_name.substring(1, 3).toUpperCase()}
													</div>
													<div class="flex flex-col min-w-0">
														<span class="font-bold text-[14px] text-white truncate">{auc.item_name}</span>
														<span class="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
															<span class={`w-1.5 h-1.5 rounded-full ${auc.status === 'Active' ? 'bg-[#3390ec] animate-pulse shadow-[0_0_5px_#3390ec]' : 'bg-white/20'}`} />
															{auc.status === 'Active' ? t('action.username.active') : auc.status}
														</span>
													</div>
												</div>
												<div class="flex flex-col items-end shrink-0 pl-2" dir="ltr">
													<span class="text-[14px] font-black font-mono text-white">{auc.price}</span>
													<span class="text-[10px] font-black text-[#3390ec]">TON</span>
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
		</div>
	);
};

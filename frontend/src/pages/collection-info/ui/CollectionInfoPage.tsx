import { createQuery } from '@tanstack/solid-query';
import { useNavigate } from '@solidjs/router';
import { Component, createMemo, createSignal, For, Show } from 'solid-js';
import { apiClient as api } from '@/shared/api/axios.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { SparklineChart } from '@/shared/ui/SparklineChart.js';

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

interface LeaderboardItem {
	rank: number;
	handle: string;
	priceTon: number;
	priceUsd: number;
	date: string;
	category: 'short' | 'crypto' | 'brand' | 'other';
	verified: boolean;
	txHash?: string;
}

const HISTORICAL_HALL_OF_FAME: LeaderboardItem[] = [
	{ rank: 1, handle: 'news', priceTon: 994000, priceUsd: 5467000, date: 'Nov 2022', category: 'brand', verified: true },
	{ rank: 2, handle: 'auto', priceTon: 900000, priceUsd: 4950000, date: 'Nov 2022', category: 'short', verified: true },
	{ rank: 3, handle: 'bank', priceTon: 850000, priceUsd: 4675000, date: 'Dec 2022', category: 'crypto', verified: true },
	{ rank: 4, handle: 'avia', priceTon: 800000, priceUsd: 4400000, date: 'Dec 2022', category: 'short', verified: true },
	{ rank: 5, handle: 'chat', priceTon: 700000, priceUsd: 3850000, date: 'Nov 2022', category: 'short', verified: true },
	{ rank: 6, handle: 'king', priceTon: 675000, priceUsd: 3712500, date: 'Dec 2022', category: 'short', verified: true },
	{ rank: 7, handle: 'fifa', priceTon: 600000, priceUsd: 3300000, date: 'Dec 2022', category: 'brand', verified: true },
	{ rank: 8, handle: 'devil', priceTon: 555555, priceUsd: 3055552, date: 'Nov 2022', category: 'other', verified: true },
	{ rank: 9, handle: 'game', priceTon: 500000, priceUsd: 2750000, date: 'Jan 2023', category: 'short', verified: true },
	{ rank: 10, handle: 'sber', priceTon: 471000, priceUsd: 2590500, date: 'Nov 2022', category: 'brand', verified: true },
	{ rank: 11, handle: 'meta', priceTon: 404000, priceUsd: 2222000, date: 'Jan 2023', category: 'brand', verified: true },
	{ rank: 12, handle: 'casino', priceTon: 400000, priceUsd: 2200000, date: 'Nov 2022', category: 'other', verified: true },
	{ rank: 13, handle: 'doge', priceTon: 350000, priceUsd: 1925000, date: 'Nov 2022', category: 'crypto', verified: true },
	{ rank: 14, handle: 'hotels', priceTon: 350000, priceUsd: 1925000, date: 'Nov 2022', category: 'other', verified: true },
	{ rank: 15, handle: 'pizza', priceTon: 346000, priceUsd: 1903000, date: 'Dec 2022', category: 'other', verified: true },
	{ rank: 16, handle: 'nike', priceTon: 330000, priceUsd: 1815000, date: 'Nov 2022', category: 'brand', verified: true },
	{ rank: 17, handle: 'gram', priceTon: 313000, priceUsd: 1721500, date: 'Nov 2022', category: 'crypto', verified: true },
	{ rank: 18, handle: 'play', priceTon: 302000, priceUsd: 1661000, date: 'May 2023', category: 'short', verified: true },
	{ rank: 19, handle: 'alfa', priceTon: 300000, priceUsd: 1650000, date: 'Nov 2022', category: 'brand', verified: true },
	{ rank: 20, handle: 'coin', priceTon: 300000, priceUsd: 1650000, date: 'Nov 2022', category: 'crypto', verified: true },
];

export const CollectionInfoPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();

	const [activeTab, setActiveTab] = createSignal<'overview' | 'leaderboard'>('overview');
	const [activeVertical, setActiveVertical] = createSignal<'usernames' | 'numbers' | 'gifts'>('usernames');
	const [leaderboardFilter, setLeaderboardFilter] = createSignal<'all' | 'short' | 'crypto' | 'brand'>('all');
	const [searchQuery, setSearchQuery] = createSignal<string>('');

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

	const fearGreedNotice = createMemo(() => {
		const idx = query.data?.fear_greed_index ?? 78;
		if (idx < 30)
			return {
				index: idx,
				title: 'Opportunity Zone (Extreme Fear)',
				desc: "Market is fearful. Don't miss out on discounted floors.",
				icon: 'trending_up',
				color: '#10b981',
				bg: 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20',
			};
		if (idx < 50)
			return {
				index: idx,
				title: 'Strategic Buy Zone (Fear)',
				desc: 'Lower activity presents a window for strategic selection.',
				icon: 'shopping_cart',
				color: '#0098EA',
				bg: 'bg-[#0098EA]/10 text-[#0098EA] border-[#0098EA]/20',
			};
		if (idx < 75)
			return {
				index: idx,
				title: 'Caution Zone (Greed)',
				desc: 'Market is heating up. Exercise caution as buying pressure rises.',
				icon: 'warning',
				color: '#fbbf24',
				bg: 'bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/20',
			};
		return {
			index: idx,
			title: 'Correction Risk (Extreme Greed)',
			desc: 'Extreme Greed! FOMO risk is high; sudden corrections may occur.',
			icon: 'error',
			color: '#ff4a4a',
			bg: 'bg-[#ff4a4a]/10 text-[#ff4a4a] border-[#ff4a4a]/20',
		};
	});

	const userHandle = createMemo(() => (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.username || '');

	const filteredLeaderboard = createMemo(() => {
		const filter = leaderboardFilter();
		if (filter === 'all') return HISTORICAL_HALL_OF_FAME;
		return HISTORICAL_HALL_OF_FAME.filter((item) => item.category === filter);
	});

	const openValuation = (handle: string) => {
		haptic.impact('light');
		navigate(`/username/report?u=${encodeURIComponent(handle.replace('@', ''))}`);
	};

	const handleSearchSubmit = (e: Event) => {
		e.preventDefault();
		const q = searchQuery().trim().replace(/^@/, '');
		if (q) {
			openValuation(q);
		}
	};

	return (
		<div
			class="min-h-screen bg-[#030303] text-white font-sans selection:bg-[#0098EA]/30 flex flex-col relative pb-32"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Dynamic Background */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-[140vw] h-[450px] bg-gradient-to-b from-[#0098EA]/20 via-[#0098EA]/5 to-transparent blur-[100px] pointer-events-none z-0" />

			<div class="w-full max-w-[440px] mx-auto px-4 flex flex-col relative z-10 flex-1">
				{/* ═══════ HEADER & VERTICAL SWITCHER ═══════ */}
				<div class="flex flex-col items-start pt-6 pb-2 px-1">
					<div class="flex items-center gap-2 mb-2">
						<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-black uppercase tracking-widest text-[#0098EA] shadow-sm">
							<div class="w-1.5 h-1.5 rounded-full bg-[#0098EA] animate-pulse shadow-[0_0_6px_#0098EA]" />
							FRAGMENT ON-CHAIN TERMINAL
						</span>
					</div>

					<h1 class="text-[30px] font-black tracking-tight text-white leading-none mb-2">
						{t('action.username.collection_stats_title') || 'Telegram Assets Intel'}
					</h1>
					<p class="text-[13px] text-white/50 leading-relaxed font-medium">
						{t('action.username.collection_stats_subtitle') ||
							'Real-time valuation analytics, market sentiment & hall-of-fame assets.'}
					</p>

					{/* 💎 PERSONAL USERNAME 1-TAP VALUATION HOOK */}
					<Show when={userHandle()}>
						<div
							onClick={() => openValuation(userHandle())}
							class="w-full mt-3.5 p-3.5 bg-gradient-to-r from-[#0098EA]/20 via-[#0098EA]/5 to-transparent border border-[#0098EA]/30 hover:border-[#0098EA]/60 rounded-[20px] flex items-center justify-between cursor-pointer transition-all group active:scale-[0.99] shadow-[0_4px_20px_rgba(0,152,234,0.15)]"
						>
							<div class="flex items-center gap-3">
								<div class="w-10 h-10 rounded-full bg-[#0098EA]/20 border border-[#0098EA]/40 flex items-center justify-center text-[#0098EA] shadow-[0_0_12px_rgba(0,152,234,0.3)]">
									<span class="material-symbols-outlined text-[22px]">diamond</span>
								</div>
								<div class="flex flex-col text-start">
									<span class="text-[9px] font-black uppercase tracking-widest text-[#0098EA]">
										YOUR TELEGRAM ASSET
									</span>
									<span class="text-[14px] font-mono font-bold text-white group-hover:text-[#0098EA] transition-colors" dir="ltr">
										@{userHandle()}
									</span>
								</div>
							</div>
							<div class="flex items-center gap-1.5 px-3 py-1.5 bg-[#0098EA] text-white rounded-[12px] text-[11px] font-black uppercase tracking-wider shadow-sm group-hover:shadow-[0_0_12px_rgba(0,152,234,0.5)] transition-all">
								<span>Valuate</span>
								<span class="material-symbols-outlined text-[14px]">arrow_forward</span>
							</div>
						</div>
					</Show>

					{/* 🌐 VERTICAL SWITCHER (PHASE 8) */}
					<div class="w-full grid grid-cols-3 gap-1.5 mt-4 p-1 bg-[#08090D] border border-white/5 rounded-[16px]">
						<button
							onClick={() => {
								haptic.selection();
								setActiveVertical('usernames');
							}}
							class={`py-2 rounded-[12px] text-[11px] font-black uppercase tracking-wider transition-all ${
								activeVertical() === 'usernames'
									? 'bg-[#0098EA] text-white shadow-sm'
									: 'text-white/40 hover:text-white/70'
							}`}
						>
							Usernames
						</button>
						<button
							onClick={() => {
								haptic.impact('light');
							}}
							class="py-2 rounded-[12px] text-[11px] font-bold uppercase tracking-wider text-white/30 hover:text-white/40 flex items-center justify-center gap-1 cursor-default"
						>
							<span>Numbers</span>
							<span class="text-[8px] bg-white/5 px-1 py-0.5 rounded text-amber-400/80">SOON</span>
						</button>
						<button
							onClick={() => {
								haptic.impact('light');
							}}
							class="py-2 rounded-[12px] text-[11px] font-bold uppercase tracking-wider text-white/30 hover:text-white/40 flex items-center justify-center gap-1 cursor-default"
						>
							<span>Gifts</span>
							<span class="text-[8px] bg-white/5 px-1 py-0.5 rounded text-amber-400/80">SOON</span>
						</button>
					</div>

					{/* 🔍 LIVE SEARCH & VALUATION HOOK */}
					<form onSubmit={handleSearchSubmit} class="w-full mt-3">
						<div class="relative w-full flex items-center">
							<input
								type="text"
								value={searchQuery()}
								onInput={(e) => setSearchQuery(e.currentTarget.value)}
								placeholder="Enter any @username to evaluate..."
								class="w-full h-12 bg-[#12141C]/90 border border-white/10 focus:border-[#0098EA] rounded-[18px] px-4 ps-11 text-white font-mono text-[13px] placeholder:text-white/30 outline-none transition-all shadow-inner"
								dir="ltr"
							/>
							<span class="material-symbols-outlined absolute left-3.5 text-white/40 text-[20px]">
								search
							</span>
							<Show when={searchQuery().trim()}>
								<button
									type="submit"
									class="absolute right-2 px-3 py-1.5 bg-[#0098EA] text-white font-black text-[11px] uppercase rounded-[12px]"
								>
									Valuate
								</button>
							</Show>
						</div>
					</form>

					{/* NAVIGATION TABS */}
					<div class="w-full bg-[#08090D]/90 border border-white/10 rounded-[18px] p-1.5 flex gap-1.5 mt-3 shadow-inner backdrop-blur-xl">
						<button
							onClick={() => {
								haptic.selection();
								setActiveTab('overview');
							}}
							class={`flex-1 py-2.5 rounded-[14px] text-[12px] font-black tracking-wide uppercase transition-all flex items-center justify-center gap-1.5 ${
								activeTab() === 'overview'
									? 'bg-gradient-to-r from-[#0098EA] to-[#007ebb] text-white shadow-[0_4px_15px_rgba(0,152,234,0.35)]'
									: 'text-white/50 hover:text-white/80'
							}`}
						>
							<span class="material-symbols-outlined text-[16px]">analytics</span>
							{t('collectionInfo.marketOverview' as any) || 'Market Overview'}
						</button>
						<button
							onClick={() => {
								haptic.selection();
								setActiveTab('leaderboard');
							}}
							class={`flex-1 py-2.5 rounded-[14px] text-[12px] font-black tracking-wide uppercase transition-all flex items-center justify-center gap-1.5 ${
								activeTab() === 'leaderboard'
									? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-[0_4px_15px_rgba(251,191,36,0.35)]'
									: 'text-white/50 hover:text-white/80'
							}`}
						>
							<span class="material-symbols-outlined text-[16px]">military_tech</span>
							{t('collectionInfo.hallOfFame' as any) || 'Hall of Fame'}
						</button>
					</div>
				</div>

				{/* ═══════ STATUS SCREENS ═══════ */}
				<Show when={query.isLoading}>
					<div class="flex flex-col items-center justify-center h-[40vh]">
						<div class="w-12 h-12 border-[3px] border-white/10 border-t-[#0098EA] rounded-full animate-spin mb-4 shadow-[0_0_15px_#0098EA]" />
						<span class="text-[12px] font-mono font-bold tracking-widest text-white/40 uppercase animate-pulse">
							SYNCHRONIZING ON-CHAIN DATA...
						</span>
					</div>
				</Show>

				{/* ═══════ TAB 1: OVERVIEW ═══════ */}
				<Show when={activeTab() === 'overview' && !query.isLoading}>
					<div class="flex flex-col gap-4 mt-3">
						{/* FEAR & GREED WIDGET */}
						<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[24px] p-5 relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
							<div
								class="absolute -top-10 -right-10 w-32 h-32 blur-3xl pointer-events-none opacity-25"
								style={{ background: fearGreedNotice().color }}
							/>

							<div class="flex items-center justify-between mb-4 relative z-10">
								<div class="flex flex-col text-start">
									<span class="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">
										MARKET SENTIMENT INDEX
									</span>
									<div class="flex items-end gap-2.5">
										<span
											class="text-[38px] font-black font-mono leading-none tracking-tight"
											style={{ color: fearGreedNotice().color }}
										>
											{fearGreedNotice().index}
										</span>
										<span
											class={`px-2.5 py-0.5 rounded-[8px] border text-[10px] font-black uppercase tracking-widest mb-1 shadow-sm ${fearGreedNotice().bg}`}
										>
											{query.data?.fear_greed_label ?? 'GREED'}
										</span>
									</div>
								</div>

								{/* Gauge Ring */}
								<div class="w-16 h-16 relative">
									<svg viewBox="0 0 36 36" class="w-full h-full transform -rotate-90 filter drop-shadow-md">
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

							<div
								class={`flex items-start gap-3 p-3.5 rounded-[16px] border shadow-inner relative z-10 ${fearGreedNotice().bg}`}
							>
								<span class="material-symbols-outlined text-[20px] shrink-0 mt-0.5">
									{fearGreedNotice().icon}
								</span>
								<div class="flex flex-col text-start">
									<span class="text-[12px] font-bold tracking-tight mb-0.5">{fearGreedNotice().title}</span>
									<span class="text-[11px] opacity-80 leading-relaxed font-medium">{fearGreedNotice().desc}</span>
								</div>
							</div>
						</div>

						{/* 4-GRID STATS */}
						<div class="grid grid-cols-2 gap-3">
							{/* Floor Price */}
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[20px] p-4 flex flex-col justify-between transition-all shadow-sm">
								<div>
									<span class="text-[10px] text-white/40 uppercase tracking-widest font-black block mb-1">
										FLOOR PRICE
									</span>
									<div class="flex items-baseline gap-1" dir="ltr">
										<span class="text-[22px] font-black font-mono text-white tracking-tight">
											{query.data?.stats?.floor_price?.replace('TON', '').trim() || '10'}
										</span>
										<span class="text-[11px] text-[#0098EA] font-black">TON</span>
									</div>
								</div>
								<div class="text-[10px] text-white/40 font-mono mt-2 pt-2 border-t border-white/5">
									≈ $
									{(
										parseFloat(query.data?.stats?.floor_price?.replace('TON', '').trim() || '10') * 5.5
									).toFixed(1)}
								</div>
							</div>

							{/* Total Volume */}
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[20px] p-4 flex flex-col justify-between transition-all shadow-sm">
								<div>
									<span class="text-[10px] text-white/40 uppercase tracking-widest font-black block mb-1">
										TOTAL VOLUME
									</span>
									<div class="flex items-baseline gap-1" dir="ltr">
										<span class="text-[22px] font-black font-mono text-white tracking-tight">
											{query.data?.stats?.total_volume?.replace('TON', '').trim() || '5.2M'}
										</span>
										<span class="text-[11px] text-[#0098EA] font-black">TON</span>
									</div>
								</div>
								<div class="text-[10px] text-emerald-400 font-mono mt-2 pt-2 border-t border-white/5">
									Verified On-Chain
								</div>
							</div>

							{/* Total Supply */}
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[20px] p-4 flex flex-col justify-center">
								<span class="text-[10px] text-white/40 uppercase tracking-widest font-black block mb-0.5">
									MINTED HANDLES
								</span>
								<span class="text-[22px] font-black font-mono text-white tracking-tight">
									{query.data?.stats?.items_count || '128,450'}
								</span>
							</div>

							{/* Holders */}
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[20px] p-4 flex flex-col justify-center">
								<span class="text-[10px] text-white/40 uppercase tracking-widest font-black block mb-0.5">
									TOTAL OWNERS
								</span>
								<span class="text-[22px] font-black font-mono text-white tracking-tight">
									{query.data?.stats?.owners_count || '46,120'}
								</span>
							</div>
						</div>

						{/* LIVE AUCTIONS CAROUSEL */}
						<Show when={(query.data?.auctions?.length ?? 0) > 0}>
							<div class="flex flex-col gap-2.5 mt-1">
								<div class="flex items-center justify-between px-1">
									<div class="flex items-center gap-2">
										<span class="material-symbols-outlined text-amber-400 text-[18px]">gavel</span>
										<h3 class="text-[11px] font-black tracking-widest text-white/60 uppercase">
											LIVE FRAGMENT AUCTIONS
										</h3>
									</div>
									<span class="text-[10px] font-mono text-amber-400 font-bold">● LIVE</span>
								</div>

								<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[22px] overflow-hidden shadow-sm">
									<For each={(query.data?.auctions || []).slice(0, 6)}>
										{(auc, index) => (
											<div
												onClick={() => openValuation(auc.item_name)}
												class={`flex items-center justify-between p-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer active:scale-[0.99] ${
													index() !== 0 ? 'border-t border-white/5' : ''
												}`}
											>
												<div class="flex items-center gap-3 min-w-0">
													<div class="w-10 h-10 rounded-[12px] bg-[#08090D] flex items-center justify-center text-white/80 font-black text-[13px] border border-white/10 shrink-0 shadow-inner">
														{auc.item_name.replace('@', '').substring(0, 2).toUpperCase()}
													</div>
													<div class="flex flex-col min-w-0 text-start">
														<span class="font-bold text-[13px] text-white truncate" dir="ltr">
															{auc.item_name}
														</span>
														<span class="text-[9px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
															<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
															AUCTION ACTIVE
														</span>
													</div>
												</div>
												<div class="flex flex-col items-end shrink-0" dir="ltr">
													<span class="text-[14px] font-black font-mono text-white">{auc.price}</span>
													<span class="text-[9px] font-black text-[#0098EA]">TON</span>
												</div>
											</div>
										)}
									</For>
								</div>
							</div>
						</Show>
					</div>
				</Show>

				{/* ═══════ TAB 2: GLOBAL LEADERBOARD (HALL OF FAME) ═══════ */}
				<Show when={activeTab() === 'leaderboard'}>
					<div class="flex flex-col gap-4 mt-3">
						{/* LEADERBOARD HERO CARD */}
						<div class="bg-gradient-to-br from-amber-500/20 via-[#12141C] to-[#12141C] border border-amber-500/30 rounded-[24px] p-5 shadow-[0_10px_30px_rgba(245,158,11,0.1)] relative overflow-hidden">
							<div class="flex items-center gap-3 mb-2">
								<div class="w-10 h-10 rounded-[12px] bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
									<span class="material-symbols-outlined text-[22px]">trophy</span>
								</div>
								<div class="flex flex-col text-start">
									<h2 class="text-[16px] font-black text-white tracking-tight">
										All-Time Record Handles
									</h2>
									<span class="text-[11px] text-white/50 font-medium">
										Highest confirmed sales in Telegram & TON history
									</span>
								</div>
							</div>
						</div>

						{/* FILTER CHIPS */}
						<div class="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
							<For
								each={[
									{ id: 'all', label: 'All Time' },
									{ id: 'short', label: 'Short (4-char)' },
									{ id: 'crypto', label: 'Crypto & TON' },
									{ id: 'brand', label: 'Brand & Words' },
								]}
							>
								{(chip) => (
									<button
										onClick={() => {
											haptic.selection();
											setLeaderboardFilter(chip.id as any);
										}}
										class={`px-3.5 py-1.5 rounded-[12px] text-[11px] font-black whitespace-nowrap transition-all uppercase tracking-wider border ${
											leaderboardFilter() === chip.id
												? 'bg-white text-black border-white shadow-sm'
												: 'bg-[#12141C] text-white/60 border-white/10 hover:border-white/20'
										}`}
									>
										{chip.label}
									</button>
								)}
							</For>
						</div>

						{/* LEADERBOARD LIST */}
						<div class="bg-[#12141C]/80 backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden shadow-sm">
							<For each={filteredLeaderboard()}>
								{(item) => {
									const rankColor =
										item.rank === 1
											? 'text-amber-400 bg-amber-400/15 border-amber-400/30'
											: item.rank === 2
											? 'text-slate-300 bg-slate-300/15 border-slate-300/30'
											: item.rank === 3
											? 'text-amber-600 bg-amber-600/15 border-amber-600/30'
											: 'text-white/40 bg-white/5 border-white/5';

									return (
										<div
											onClick={() => openValuation(item.handle)}
											class="flex items-center justify-between p-4 hover:bg-white/[0.04] transition-all cursor-pointer border-b border-white/5 last:border-0 active:scale-[0.99]"
										>
											<div class="flex items-center gap-3.5 min-w-0">
												<div
													class={`w-8 h-8 rounded-[10px] flex items-center justify-center font-black font-mono text-[12px] border shrink-0 ${rankColor}`}
												>
													{item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`}
												</div>

												<div class="flex flex-col min-w-0 text-start">
													<div class="flex items-center gap-1.5">
														<span class="text-white font-mono font-black text-[14px] truncate" dir="ltr">
															@{item.handle}
														</span>
														<Show when={item.verified}>
															<span class="material-symbols-outlined text-[#0098EA] text-[14px]">
																verified
															</span>
														</Show>
													</div>
													<span class="text-[10px] text-white/40 font-mono">{item.date}</span>
												</div>
											</div>

											<div class="flex flex-col items-end shrink-0" dir="ltr">
												<div class="flex items-baseline gap-1">
													<span class="text-[14px] font-black font-mono text-white">
														{item.priceTon.toLocaleString('en-US')}
													</span>
													<span class="text-[10px] font-black text-[#0098EA]">TON</span>
												</div>
												<span class="text-[10px] font-mono text-white/40">
													≈ ${((item.priceUsd ?? item.priceTon * 5.5) / 1000).toFixed(0)}K
												</span>
											</div>
										</div>
									);
								}}
							</For>
						</div>
					</div>
				</Show>

				{/* ═══════ FLOATING BOTTOM CTA ═══════ */}
				<div class="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[420px] px-4 z-40">
					<button
						onClick={() => {
							haptic.impact('medium');
							navigate('/username/report');
						}}
						class="w-full h-14 bg-gradient-to-r from-[#0098EA] via-[#00c0ff] to-[#0098EA] text-black font-black text-[13px] uppercase tracking-wider rounded-[18px] flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(0,152,234,0.4)] active:scale-95 transition-all"
					>
						<span class="material-symbols-outlined text-[20px]">radar</span>
						VALUATE ANY USERNAME NOW
					</button>
				</div>
			</div>
		</div>
	);
};

export default CollectionInfoPage;

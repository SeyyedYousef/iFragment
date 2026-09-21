import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { apiClient as api } from '@/shared/api/axios.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { UsernameCollectionChart } from './UsernameCollectionChart.js';

interface CollectionStats {
	stat_date: string;
	items_count: string;
	owners_count: string;
	floor_price: string;
	total_volume: string;
	source?: string;
	is_stale?: boolean;
}

interface CollectionCategory {
	category_name: string;
	volume: string;
}

interface CollectionAuction {
	item_name: string;
	price: string;
	status: string;
	tx_hash?: string;
	timestamp?: string;
	verified?: boolean;
}

interface MarketPulseSignal {
	status: string;
	value: string;
	delta?: number;
	desc: string;
}

interface MarketPulse {
	demand: MarketPulseSignal;
	supply_pressure: MarketPulseSignal;
	liquidity: MarketPulseSignal;
	price_momentum: MarketPulseSignal;
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

interface CollectionData {
	collection_address?: string;
	stats: CollectionStats | null;
	market_pulse?: MarketPulse;
	categories: CollectionCategory[];
	auctions: CollectionAuction[];
	top_sales: CollectionAuction[];
	recent_activity: CollectionAuction[];
	fx?: FXRateInfo;
	sources?: SourceHealth[];
	fear_greed_index?: number;
	fear_greed_label?: string;
	ton_usd_rate?: number;
	status?: string;
}

interface LeaderboardItem {
	rank: number;
	handle: string;
	priceTon: number;
	priceUsd?: number;
	date: string;
	category: 'short' | 'crypto' | 'brand' | 'other';
	verified: boolean;
	txHash?: string;
}

const TELEMINT_COLLECTION_ADDR = 'EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi';

export const CollectionInfoPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();

	const [activeTab, setActiveTab] = createSignal<'overview' | 'leaderboard'>('overview');
	const [leaderboardFilter, setLeaderboardFilter] = createSignal<
		'all' | 'short' | 'crypto' | 'brand'
	>('all');
	const [copied, setCopied] = createSignal(false);

	// Usernames Collection Query calling standard API route
	const usernameQuery = createQuery(() => ({
		queryKey: ['usernameCollectionStats'],
		queryFn: async () => {
			const { data } = await api.get<CollectionData>('/usernames/collection/stats');
			return data;
		},
		staleTime: 5 * 60 * 1000,
	}));

	const tonUsdRate = createMemo<number | undefined>(() => {
		return usernameQuery.data?.fx?.ton_usd ?? usernameQuery.data?.ton_usd_rate;
	});

	const copyContract = () => {
		try {
			navigator.clipboard.writeText(TELEMINT_COLLECTION_ADDR);
			haptic.notify('success');
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {}
	};

	const filteredLeaderboard = createMemo<LeaderboardItem[]>(() => {
		const topSales = usernameQuery.data?.top_sales || [];
		if (topSales.length === 0) return [];
		const rate = tonUsdRate();

		return topSales
			.map((item, idx) => {
				const cleanName = item.item_name.replace('@', '');
				const priceNum = parseFloat(item.price.replace(/[^0-9.]/g, '')) || 0;
				let category: 'short' | 'crypto' | 'brand' | 'other' = 'other';
				if (cleanName.length <= 4) category = 'short';
				else if (/crypto|ton|btc|eth|sol|gram|coin/i.test(cleanName)) category = 'crypto';
				else category = 'brand';

				return {
					rank: idx + 1,
					handle: cleanName,
					priceTon: priceNum,
					priceUsd: rate && rate > 0 ? priceNum * rate : undefined,
					date: item.status || 'Confirmed Sale',
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
		navigate(`/username/report?u=${encodeURIComponent(handle.replace('@', ''))}`);
	};

	return (
		<div
			class="min-h-screen bg-[#06070B] text-white font-sans selection:bg-[#0098EA]/30 flex flex-col relative pb-36"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Dynamic Background */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[450px] bg-gradient-to-b from-[#0098EA]/20 via-[#AF52DE]/10 to-transparent blur-[100px] pointer-events-none z-0" />

			<div class="w-full max-w-[480px] mx-auto px-4 flex flex-col relative z-10 flex-1">
				{/* ═══════ HEADER ═══════ */}
				<div class="flex flex-col items-start pt-6 pb-2 px-1">
					<div class="flex items-center justify-between w-full mb-2">
						<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-black uppercase tracking-widest text-[#0098EA] shadow-sm">
							<div class="w-1.5 h-1.5 rounded-full bg-[#0098EA] animate-pulse shadow-[0_0_6px_#0098EA]" />
							{t('collectionInfo.fragmentTerminal') || 'TeleMint Market Terminal'}
						</span>

						{/* Live Sources Indicator */}
						<div class="flex items-center gap-2">
							<span class="text-[9px] font-mono text-emerald-400 font-bold flex items-center gap-1">
								<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
								ON-CHAIN VERIFIED
							</span>
						</div>
					</div>

					<h1 class="text-[28px] font-black tracking-tight text-white leading-none mb-2">
						{t('action.username.collection_stats_title') || 'Telegram Usernames'}
					</h1>
					<p class="text-[12px] text-white/50 leading-relaxed font-medium">
						{t('action.username.collection_stats_subtitle') ||
							'Audited TeleMint contract statistics, market pulse & verified hall-of-fame records.'}
					</p>

					{/* Contract Address & Data Provenance Header */}
					<div class="w-full mt-3.5 p-3 rounded-[16px] bg-[#12141C]/80 border border-white/10 flex items-center justify-between gap-2 text-[11px] font-mono backdrop-blur-xl">
						<div class="flex items-center gap-2 min-w-0">
							<span class="material-symbols-outlined text-[#0098EA] text-[16px] shrink-0">
								token
							</span>
							<div class="flex flex-col min-w-0 text-start">
								<span class="text-[9px] uppercase tracking-wider text-white/40 font-bold">
									{t('collectionInfo.contractAddress') || 'TeleMint Collection'}
								</span>
								<span class="text-white/80 font-bold truncate text-[10px]" dir="ltr">
									{TELEMINT_COLLECTION_ADDR.substring(0, 10)}...
									{TELEMINT_COLLECTION_ADDR.substring(TELEMINT_COLLECTION_ADDR.length - 8)}
								</span>
							</div>
						</div>

						<div class="flex items-center gap-1.5 shrink-0">
							<button
								type="button"
								onClick={copyContract}
								class="px-2.5 py-1 rounded-[8px] bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-[10px] font-black tracking-wide uppercase transition-colors"
							>
								{copied()
									? t('collectionInfo.copied') || 'Copied!'
									: t('collectionInfo.copyAddress') || 'Copy'}
							</button>
							<a
								href={`https://tonscan.org/address/${TELEMINT_COLLECTION_ADDR}`}
								target="_blank"
								rel="noreferrer"
								class="px-2.5 py-1 rounded-[8px] bg-[#0098EA]/10 hover:bg-[#0098EA]/20 border border-[#0098EA]/20 text-[#0098EA] text-[10px] font-black tracking-wide uppercase transition-colors flex items-center gap-1"
							>
								<span>{t('collectionInfo.viewOnExplorer') || 'Explorer'}</span>
								<span class="material-symbols-outlined text-[12px]">open_in_new</span>
							</a>
						</div>
					</div>

					{/* NAVIGATION TABS */}
					<div class="w-full bg-[#12141C]/90 border border-white/10 rounded-[18px] p-1.5 flex gap-1.5 mt-4 shadow-inner backdrop-blur-xl">
						<button
							type="button"
							onClick={() => {
								try {
									haptic.selection();
								} catch {}
								setActiveTab('overview');
							}}
							class={`flex-1 py-2.5 rounded-[14px] text-[12px] font-black tracking-wide uppercase transition-all flex items-center justify-center gap-1.5 ${
								activeTab() === 'overview'
									? 'bg-gradient-to-r from-[#0098EA] to-[#007ebb] text-white shadow-lg'
									: 'text-white/50 hover:text-white/80'
							}`}
						>
							<span class="material-symbols-outlined text-[16px]">analytics</span>
							<span>{t('collectionInfo.marketOverview')}</span>
						</button>
						<button
							type="button"
							onClick={() => {
								try {
									haptic.selection();
								} catch {}
								setActiveTab('leaderboard');
							}}
							class={`flex-1 py-2.5 rounded-[14px] text-[12px] font-black tracking-wide uppercase transition-all flex items-center justify-center gap-1.5 ${
								activeTab() === 'leaderboard'
									? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-lg'
									: 'text-white/50 hover:text-white/80'
							}`}
						>
							<span class="material-symbols-outlined text-[16px]">military_tech</span>
							<span>{t('collectionInfo.hallOfFame')}</span>
						</button>
					</div>
				</div>

				{/* ═══════ STATUS SCREENS ═══════ */}
				<Show when={usernameQuery.isLoading}>
					<div class="flex flex-col items-center justify-center h-[35vh]">
						<div class="w-12 h-12 border-[3px] border-white/10 border-t-[#0098EA] rounded-full animate-spin mb-4 shadow-[0_0_15px_#0098EA]" />
						<span class="text-[12px] font-mono font-bold tracking-widest text-white/40 uppercase animate-pulse">
							{t('collectionInfo.syncingOnChain')}
						</span>
					</div>
				</Show>

				{/* ═══════ TAB 1: OVERVIEW ═══════ */}
				<Show when={activeTab() === 'overview' && !usernameQuery.isLoading}>
					<div class="flex flex-col gap-4 mt-3">
						{/* MARKET PULSE TERMINAL (4 SIGNALS) */}
						<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[24px] p-5 shadow-xl">
							<div class="flex items-center justify-between mb-3.5">
								<div class="flex items-center gap-2">
									<span class="material-symbols-outlined text-[#0098EA] text-[20px]">
										monitoring
									</span>
									<span class="text-[13px] font-black uppercase tracking-wider text-white">
										{t('collectionInfo.marketPulse') || 'Market Pulse'}
									</span>
								</div>
								<span class="px-2 py-0.5 rounded-[6px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold uppercase">
									Calculated On-Chain
								</span>
							</div>

							{/* 4 Multi-Axis Financial Signals */}
							<div class="grid grid-cols-2 gap-2.5">
								{/* Demand */}
								<div class="p-3 rounded-[16px] bg-white/[0.03] border border-white/5 flex flex-col text-start">
									<span class="text-[9px] uppercase tracking-wider text-white/40 font-black mb-1">
										{t('collectionInfo.demandSignal') || 'Demand (Sales & Buyers)'}
									</span>
									<div class="flex items-baseline gap-1.5 mb-1">
										<span class="text-[16px] font-black font-mono text-emerald-400">
											{usernameQuery.data?.market_pulse?.demand?.value || 'Steady'}
										</span>
										<Show when={usernameQuery.data?.market_pulse?.demand?.delta}>
											<span class="text-[10px] font-mono text-emerald-400 font-bold">
												+{usernameQuery.data?.market_pulse?.demand?.delta}%
											</span>
										</Show>
									</div>
									<span class="text-[10px] text-white/50 leading-tight">
										{usernameQuery.data?.market_pulse?.demand?.desc ||
											'Turnover and verified bidding activity'}
									</span>
								</div>

								{/* Supply Pressure */}
								<div class="p-3 rounded-[16px] bg-white/[0.03] border border-white/5 flex flex-col text-start">
									<span class="text-[9px] uppercase tracking-wider text-white/40 font-black mb-1">
										{t('collectionInfo.supplySignal') || 'Supply Pressure'}
									</span>
									<div class="flex items-baseline gap-1.5 mb-1">
										<span class="text-[16px] font-black font-mono text-sky-400">
											{usernameQuery.data?.market_pulse?.supply_pressure?.value || 'Controlled'}
										</span>
										<Show when={usernameQuery.data?.market_pulse?.supply_pressure?.delta}>
											<span class="text-[10px] font-mono text-sky-400 font-bold">
												{usernameQuery.data?.market_pulse?.supply_pressure?.delta}%
											</span>
										</Show>
									</div>
									<span class="text-[10px] text-white/50 leading-tight">
										{usernameQuery.data?.market_pulse?.supply_pressure?.desc ||
											'Listings vs circulating TeleMint ratio'}
									</span>
								</div>

								{/* Liquidity */}
								<div class="p-3 rounded-[16px] bg-white/[0.03] border border-white/5 flex flex-col text-start">
									<span class="text-[9px] uppercase tracking-wider text-white/40 font-black mb-1">
										{t('collectionInfo.liquiditySignal') || 'Liquidity & Velocity'}
									</span>
									<div class="flex items-baseline gap-1.5 mb-1">
										<span class="text-[16px] font-black font-mono text-amber-400">
											{usernameQuery.data?.market_pulse?.liquidity?.value || 'High'}
										</span>
										<Show when={usernameQuery.data?.market_pulse?.liquidity?.delta}>
											<span class="text-[10px] font-mono text-amber-400 font-bold">
												+{usernameQuery.data?.market_pulse?.liquidity?.delta}%
											</span>
										</Show>
									</div>
									<span class="text-[10px] text-white/50 leading-tight">
										{usernameQuery.data?.market_pulse?.liquidity?.desc ||
											'Time-to-settlement for competitive ask floors'}
									</span>
								</div>

								{/* Price Momentum */}
								<div class="p-3 rounded-[16px] bg-white/[0.03] border border-white/5 flex flex-col text-start">
									<span class="text-[9px] uppercase tracking-wider text-white/40 font-black mb-1">
										{t('collectionInfo.momentumSignal') || 'Price Momentum'}
									</span>
									<div class="flex items-baseline gap-1.5 mb-1">
										<span class="text-[16px] font-black font-mono text-emerald-400">
											{usernameQuery.data?.market_pulse?.price_momentum?.value || 'Bullish'}
										</span>
										<Show when={usernameQuery.data?.market_pulse?.price_momentum?.delta}>
											<span class="text-[10px] font-mono text-emerald-400 font-bold">
												+{usernameQuery.data?.market_pulse?.price_momentum?.delta}%
											</span>
										</Show>
									</div>
									<span class="text-[10px] text-white/50 leading-tight">
										{usernameQuery.data?.market_pulse?.price_momentum?.desc ||
											'7D median settlement floor trajectory'}
									</span>
								</div>
							</div>
						</div>

						{/* ═══════ USERNAMES STATS OVERVIEW ═══════ */}
						<div class="grid grid-cols-2 gap-3">
							{/* Floor Price */}
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[20px] p-4 flex flex-col justify-between transition-all shadow-sm">
								<div>
									<span class="text-[10px] text-white/40 uppercase tracking-widest font-black block mb-1">
										{t('collectionInfo.floorPrice')}
									</span>
									<Show
										when={usernameQuery.data?.stats?.floor_price}
										fallback={
											<span class="text-[12px] text-white/40 font-mono italic">
												{t('collectionInfo.dataUnavailable')}
											</span>
										}
									>
										<div class="flex items-baseline gap-1" dir="ltr">
											<span class="text-[22px] font-black font-mono text-white tracking-tight">
												{usernameQuery.data?.stats?.floor_price?.replace('TON', '').trim()}
											</span>
											<span class="text-[11px] text-[#0098EA] font-black">
												{t('common.ton')}
											</span>
										</div>
									</Show>
								</div>
								<div class="text-[10px] text-white/40 font-mono mt-2 pt-2 border-t border-white/5">
									{tonUsdRate() &&
									tonUsdRate()! > 0 &&
									usernameQuery.data?.stats?.floor_price
										? `≈ $${(
												parseFloat(
													usernameQuery.data.stats.floor_price.replace(/[^0-9.]/g, '') ||
														'0',
												) * tonUsdRate()!
											).toFixed(2)}`
										: 'Rate unavailable'}
								</div>
							</div>

							{/* Total Volume */}
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[20px] p-4 flex flex-col justify-between transition-all shadow-sm">
								<div>
									<span class="text-[10px] text-white/40 uppercase tracking-widest font-black block mb-1">
										{t('collectionInfo.totalVolume')}
									</span>
									<Show
										when={usernameQuery.data?.stats?.total_volume}
										fallback={
											<span class="text-[12px] text-white/40 font-mono italic">
												{t('collectionInfo.dataUnavailable')}
											</span>
										}
									>
										<div class="flex items-baseline gap-1" dir="ltr">
											<span class="text-[22px] font-black font-mono text-white tracking-tight">
												{usernameQuery.data?.stats?.total_volume?.replace('TON', '').trim()}
											</span>
											<span class="text-[11px] text-[#0098EA] font-black">
												{t('common.ton')}
											</span>
										</div>
									</Show>
								</div>
								<div class="text-[10px] text-emerald-400 font-mono mt-2 pt-2 border-t border-white/5 flex items-center gap-1">
									<span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
									{usernameQuery.data?.stats?.source || t('collectionInfo.verifiedOnChain')}
								</div>
							</div>

							{/* Total Supply */}
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[20px] p-4 flex flex-col justify-center">
								<span class="text-[10px] text-white/40 uppercase tracking-widest font-black block mb-0.5">
									{t('collectionInfo.mintedHandles')}
								</span>
								<Show
									when={usernameQuery.data?.stats?.items_count}
									fallback={
										<span class="text-[12px] text-white/40 font-mono italic">
											{t('collectionInfo.dataUnavailable')}
										</span>
									}
								>
									<span class="text-[22px] font-black font-mono text-white tracking-tight">
										{usernameQuery.data?.stats?.items_count}
									</span>
								</Show>
							</div>

							{/* Holders */}
							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[20px] p-4 flex flex-col justify-center">
								<span class="text-[10px] text-white/40 uppercase tracking-widest font-black block mb-0.5">
									{t('collectionInfo.totalOwners')}
								</span>
								<Show
									when={usernameQuery.data?.stats?.owners_count}
									fallback={
										<span class="text-[12px] text-white/40 font-mono italic">
											{t('collectionInfo.dataUnavailable')}
										</span>
									}
								>
									<span class="text-[22px] font-black font-mono text-white tracking-tight">
										{usernameQuery.data?.stats?.owners_count}
									</span>
								</Show>
							</div>
						</div>

						{/* ═══════ ON-CHAIN FLOOR & VOLUME HISTORY CHART ═══════ */}
						<UsernameCollectionChart
							currentFloorTon={
								usernameQuery.data?.stats?.floor_price
									? parseFloat(
											usernameQuery.data.stats.floor_price.replace(/[^0-9.]/g, '') || '0',
										)
									: undefined
							}
							totalVolumeTon={usernameQuery.data?.stats?.total_volume}
							tonUsdRate={tonUsdRate()}
						/>

						{/* Live Fragment Auctions */}
						<Show when={(usernameQuery.data?.auctions?.length ?? 0) > 0}>
							<div class="flex flex-col gap-2.5 mt-1">
								<div class="flex items-center justify-between px-1">
									<div class="flex items-center gap-2">
										<span class="material-symbols-outlined text-amber-400 text-[18px]">gavel</span>
										<h3 class="text-[11px] font-black tracking-widest text-white/60 uppercase">
											{t('collectionInfo.liveFragmentAuctions')}
										</h3>
									</div>
									<span class="text-[10px] font-mono text-amber-400 font-bold">{'● LIVE'}</span>
								</div>

								<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[22px] overflow-hidden shadow-sm">
									<For each={(usernameQuery.data?.auctions || []).slice(0, 6)}>
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
															{t('collectionInfo.auctionActive')}
														</span>
													</div>
												</div>
												<div class="flex flex-col items-end shrink-0" dir="ltr">
													<span class="text-[14px] font-black font-mono text-white">
														{auc.price}
													</span>
													<span class="text-[9px] font-black text-[#0098EA]">
														{t('common.ton')}
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

				{/* ═══════ TAB 2: GLOBAL LEADERBOARD (HALL OF FAME) ═══════ */}
				<Show when={activeTab() === 'leaderboard'}>
					<div class="flex flex-col gap-4 mt-3">
						{/* LEADERBOARD HERO CARD */}
						<div class="bg-gradient-to-br from-amber-500/20 via-[#12141C] to-[#12141C] border border-amber-500/30 rounded-[24px] p-5 shadow-xl relative overflow-hidden">
							<div class="flex items-center gap-3 mb-2">
								<div class="w-10 h-10 rounded-[12px] bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
									<span class="material-symbols-outlined text-[22px]">trophy</span>
								</div>
								<div class="flex flex-col text-start">
									<h2 class="text-[16px] font-black text-white tracking-tight">
										{t('collectionInfo.allTimeRecordHandles')}
									</h2>
									<span class="text-[11px] text-white/50 font-medium">
										{t('collectionInfo.highestConfirmedSales')}
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
										type="button"
										onClick={() => {
											try {
												haptic.selection();
											} catch {}
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
							<Show
								when={filteredLeaderboard().length > 0}
								fallback={
									<div class="p-8 text-center text-white/40 text-xs">
										<span class="material-symbols-outlined text-3xl mb-2 text-white/20 block">
											folder_off
										</span>
										{t('collectionInfo.noLeaderboardData') ||
											'No confirmed sales records available yet.'}
									</div>
								}
							>
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
														{item.rank === 1
															? '🥇'
															: item.rank === 2
																? '🥈'
																: item.rank === 3
																	? '🥉'
																	: `#${item.rank}`}
													</div>

													<div class="flex flex-col min-w-0 text-start">
														<div class="flex items-center gap-1.5">
															<span
																class="text-white font-mono font-black text-[14px] truncate"
																dir="ltr"
															>
																@{item.handle}
															</span>
															<Show when={item.verified}>
																<Show
																	when={item.txHash}
																	fallback={
																		<span
																			class="material-symbols-outlined text-[#0098EA] text-[14px]"
																			title="Verified On-Chain Sale"
																		>
																			verified
																		</span>
																	}
																>
																	<a
																		href={`https://tonscan.org/tx/${item.txHash}`}
																		target="_blank"
																		rel="noopener noreferrer"
																		onClick={(e) => e.stopPropagation()}
																		class="inline-flex items-center text-[#0098EA] hover:text-[#00B0FF] transition-colors"
																		title={`View TX: ${item.txHash}`}
																	>
																		<span class="material-symbols-outlined text-[14px]">
																			verified
																		</span>
																	</a>
																</Show>
															</Show>
														</div>
														<span class="text-[10px] text-white/40 font-mono">{item.date}</span>
													</div>
												</div>

												<div class="flex flex-col items-end shrink-0" dir="ltr">
													<div class="flex items-baseline gap-1">
														<span class="text-white font-mono font-black text-[14px]">
															{item.priceTon.toLocaleString()}
														</span>
														<span class="text-[9px] font-black text-[#0098EA]">
															{t('common.ton')}
														</span>
													</div>
													<Show when={item.priceUsd && item.priceUsd > 0}>
														<span class="text-[10px] text-white/40 font-mono">
															≈ ${Math.round(item.priceUsd!).toLocaleString()}
														</span>
													</Show>
												</div>
											</div>
										);
									}}
								</For>
							</Show>
						</div>
					</div>
				</Show>
			</div>
		</div>
	);
};

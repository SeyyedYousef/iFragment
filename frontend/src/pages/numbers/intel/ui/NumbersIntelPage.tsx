import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import { numbersApi } from '@/entities/numbers/index.js';
import type { WalletPortfolioResult } from '@/entities/numbers/model/types.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';

export const NumbersIntelPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();

	const [percentileMode, setPercentileMode] = createSignal<'p50' | 'p68' | 'p85'>('p68');
	const [activeTab, setActiveTab] = createSignal<'overview' | 'deals' | 'clubs' | 'portfolio' | 'hall_of_fame' | 'auctions'>(
		'overview',
	);

	// Portfolio scanner state
	const [portfolioAddress, setPortfolioAddress] = createSignal<string>('');
	const [isScanning, setIsScanning] = createSignal<boolean>(false);
	const [portfolioResult, setPortfolioResult] = createSignal<WalletPortfolioResult | null>(null);
	const [portfolioError, setPortfolioError] = createSignal<string | null>(null);

	const intelQuery = createQuery(() => ({
		queryKey: ['numbersIntel'],
		queryFn: () => numbersApi.getIntel(),
		staleTime: 60 * 1000,
	}));

	const activityQuery = createQuery(() => ({
		queryKey: ['numbersActivity'],
		queryFn: () => numbersApi.getActivity(),
		staleTime: 30 * 1000,
		refetchInterval: 15 * 1000,
	}));

	const dealsQuery = createQuery(() => ({
		queryKey: ['numbersDeals'],
		queryFn: () => numbersApi.getDeals(),
		staleTime: 45 * 1000,
	}));

	const clubsQuery = createQuery(() => ({
		queryKey: ['numbersClubs'],
		queryFn: () => numbersApi.getClubs(),
		staleTime: 120 * 1000,
	}));

	const intel = () => intelQuery.data;
	const activities = () => activityQuery.data || [];
	const deals = () => dealsQuery.data || [];
	const clubs = () => clubsQuery.data || [];

	const formatTon = (val?: number) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	const formatUsd = (val?: number) => {
		if (val === undefined || val === null) return '$0';
		return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	};

	const handleScanPortfolio = async (addr?: string) => {
		const target = addr || portfolioAddress().trim();
		if (!target) {
			setPortfolioError(t('numbers.portfolioSub'));
			return;
		}
		try {
			haptic.impact('medium');
		} catch {}
		setIsScanning(true);
		setPortfolioError(null);
		try {
			const res = await numbersApi.scanPortfolio(target);
			setPortfolioResult(res);
		} catch (err: any) {
			setPortfolioError(err?.message || 'Failed to scan wallet');
		} finally {
			setIsScanning(false);
		}
	};

	const chartPoints = () => {
		const list = intel()?.percentile_chart || [];
		if (list.length === 0) {
			const floor = intel()?.floor_price_ton || 2100;
			return [
				{ date: '1', p50: floor, p68: floor * 1.45, p85: floor * 2.8 },
				{ date: '2', p50: floor * 1.02, p68: floor * 1.48, p85: floor * 2.85 },
				{ date: '3', p50: floor * 1.01, p68: floor * 1.46, p85: floor * 2.82 },
				{ date: '4', p50: floor * 1.04, p68: floor * 1.50, p85: floor * 2.90 },
				{ date: '5', p50: floor * 1.03, p68: floor * 1.49, p85: floor * 2.88 },
				{ date: '6', p50: floor * 1.06, p68: floor * 1.53, p85: floor * 2.95 },
				{ date: '7', p50: floor * 1.08, p68: floor * 1.55, p85: floor * 3.00 },
			];
		}
		return list;
	};

	const chartSVGData = () => {
		const points = chartPoints();
		const mode = percentileMode();
		const values = points.map((p) => (mode === 'p50' ? p.p50 : mode === 'p85' ? p.p85 : p.p68));
		const min = Math.min(...values) * 0.95;
		const max = Math.max(...values) * 1.05;
		const range = max - min || 1;

		const coords = values.map((val, idx) => {
			const x = 15 + (idx * (320 - 30)) / Math.max(1, values.length - 1);
			const y = 105 - ((val - min) / range) * 80;
			return { x, y, val };
		});

		let pathD = `M ${coords[0].x} ${coords[0].y}`;
		for (let i = 1; i < coords.length; i++) {
			pathD += ` L ${coords[i].x} ${coords[i].y}`;
		}
		const areaD = `${pathD} L ${coords[coords.length - 1].x} 115 L ${coords[0].x} 115 Z`;

		return { coords, pathD, areaD, currentVal: values[values.length - 1] };
	};

	return (
		<div class="pb-40 bg-[#06070B] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient Gradient Glows */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-[#0098EA]/20 via-[#AF52DE]/10 to-transparent blur-[90px] pointer-events-none z-0" />
			<div class="fixed bottom-20 right-0 w-80 h-80 bg-emerald-500/10 blur-[100px] pointer-events-none z-0" />

			<div class="relative z-10 max-w-[480px] mx-auto px-4 pt-3">
				{/* Live Activity Ticker (Top Bar) */}
				<Show when={activities().length > 0}>
					<div class="mb-3 bg-black/40 backdrop-blur-md border border-white/[0.08] rounded-xl px-3 py-1.5 flex items-center justify-between overflow-hidden">
						<div class="flex items-center gap-2 shrink-0">
							<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
							<span class="text-[10px] font-extrabold uppercase text-white/50 tracking-wider">
								{t('numbers.liveActivityTitle')}
							</span>
						</div>
						<div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 max-w-[260px]">
							<For each={activities().slice(0, 4)}>
								{(act) => (
									<button
										type="button"
										onClick={() => {
											try {
												haptic.selection();
											} catch {}
											navigate(`/numbers/report?n=${encodeURIComponent(act.number)}`);
										}}
										class="shrink-0 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 rounded-lg px-2 py-0.5 text-[10px] font-mono flex items-center gap-1.5 transition-all"
									>
										<span class="text-white font-bold">{act.display_number}</span>
										<span class="text-emerald-400 font-extrabold">{formatTon(act.sale_price_ton)} TON</span>
									</button>
								)}
							</For>
						</div>
					</div>
				</Show>

				{/* Top Navigation Bar */}
				<div class="flex items-center justify-between mb-3.5">
					<div class="flex items-center gap-2.5">
						<div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0098EA] to-[#00c6ff] p-[1px] shadow-lg shadow-[#0098EA]/20 flex items-center justify-center">
							<div class="w-full h-full bg-[#0d111a] rounded-2xl flex items-center justify-center">
								<span class="material-symbols-outlined text-[#0098EA] text-[22px]">tag</span>
							</div>
						</div>
						<div>
							<h1 class="text-[18px] font-black tracking-tight text-white flex items-center gap-1.5">
								{t('numbers.intelTitle')}
								<span class="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
									+888
								</span>
							</h1>
							<p class="text-[11px] font-medium text-white/50">{t('numbers.intelSubtitle')}</p>
						</div>
					</div>

					<button
						type="button"
						onClick={() => {
							try {
								haptic.impact('light');
							} catch {}
							navigate('/numbers/mask');
						}}
						class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-bold text-white/80 transition-all active:scale-95"
					>
						<span class="material-symbols-outlined text-sm text-[#0098EA]">tune</span>
						<span>{t('numbers.maskBuilder')}</span>
					</button>
				</div>

				{/* Supply Frozen Super Badge */}
				<div class="w-full bg-gradient-to-r from-amber-500/15 via-emerald-500/15 to-[#0098EA]/15 border border-emerald-500/30 rounded-2xl p-3 mb-3.5 backdrop-blur-xl shadow-lg flex items-center justify-between">
					<div class="flex items-center gap-2.5">
						<div class="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
							<span class="material-symbols-outlined text-base">lock</span>
						</div>
						<div>
							<div class="text-[12px] font-black text-white flex items-center gap-1.5">
								{t('numbers.closedSupply')}
								<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
							</div>
							<div class="text-[10px] text-white/60 font-medium">{t('numbers.frozenDesc')}</div>
						</div>
					</div>
					<div class="text-right rtl:text-left">
						<div class="text-[13px] font-black text-emerald-400 font-mono">100%</div>
						<div class="text-[9px] font-bold text-white/40 uppercase">{t('numbers.minted')}</div>
					</div>
				</div>

				{/* Scrollable Sub-Tabs: Overview | Deals | Clubs | Portfolio | Top Sales | Auctions */}
				<div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-white/[0.04] p-1.5 rounded-2xl border border-white/[0.06] mb-4">
					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							setActiveTab('overview');
						}}
						class={`shrink-0 px-3 py-2 text-xs font-black rounded-xl transition-all ${
							activeTab() === 'overview'
								? 'bg-[#0098EA] text-white shadow-lg'
								: 'text-white/50 hover:text-white'
						}`}
					>
						{t('numbers.tabOverview')}
					</button>
					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							setActiveTab('deals');
						}}
						class={`shrink-0 px-3 py-2 text-xs font-black rounded-xl transition-all ${
							activeTab() === 'deals'
								? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-lg'
								: 'text-white/50 hover:text-white'
						}`}
					>
						{t('numbers.tabDeals')}
					</button>
					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							setActiveTab('clubs');
						}}
						class={`shrink-0 px-3 py-2 text-xs font-black rounded-xl transition-all ${
							activeTab() === 'clubs'
								? 'bg-[#AF52DE] text-white shadow-lg'
								: 'text-white/50 hover:text-white'
						}`}
					>
						{t('numbers.tabClubs')}
					</button>
					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							setActiveTab('portfolio');
						}}
						class={`shrink-0 px-3 py-2 text-xs font-black rounded-xl transition-all ${
							activeTab() === 'portfolio'
								? 'bg-emerald-500 text-white shadow-lg'
								: 'text-white/50 hover:text-white'
						}`}
					>
						{t('numbers.tabPortfolio')}
					</button>
					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							setActiveTab('hall_of_fame');
						}}
						class={`shrink-0 px-3 py-2 text-xs font-black rounded-xl transition-all ${
							activeTab() === 'hall_of_fame'
								? 'bg-[#0098EA] text-white shadow-lg'
								: 'text-white/50 hover:text-white'
						}`}
					>
						🏆 {t('numbers.tabHallOfFame')}
					</button>
					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							setActiveTab('auctions');
						}}
						class={`shrink-0 px-3 py-2 text-xs font-black rounded-xl transition-all ${
							activeTab() === 'auctions'
								? 'bg-[#0098EA] text-white shadow-lg'
								: 'text-white/50 hover:text-white'
						}`}
					>
						⚡ {t('numbers.tabAuctions')}
					</button>
				</div>

				{/* Tab Content: Overview */}
				<Show when={activeTab() === 'overview'}>
					{/* Market Metrics Grid */}
					<div class="grid grid-cols-2 gap-2.5 mb-4">
						{/* Floor Price Card */}
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3.5 relative overflow-hidden shadow-lg">
							<div class="text-[10px] uppercase font-bold text-white/40 mb-1 flex items-center justify-between">
								<span>{t('numbers.floorPrice')}</span>
								<span class="material-symbols-outlined text-xs text-[#0098EA]">trending_up</span>
							</div>
							<div class="text-xl font-black text-white font-mono tracking-tight flex items-baseline gap-1">
								{formatTon(intel()?.floor_price_ton || 2100)}
								<span class="text-xs font-bold text-[#0098EA]">{t('common.ton')}</span>
							</div>
							<div class="text-[11px] font-semibold text-white/40 mt-0.5 font-mono">
								≈ {formatUsd(intel()?.floor_price_usd || 11550)}
							</div>
						</div>

						{/* Total Volume Card */}
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3.5 relative overflow-hidden shadow-lg">
							<div class="text-[10px] uppercase font-bold text-white/40 mb-1 flex items-center justify-between">
								<span>{t('numbers.totalVolume')}</span>
								<span class="material-symbols-outlined text-xs text-emerald-400">bar_chart</span>
							</div>
							<div class="text-xl font-black text-white font-mono tracking-tight flex items-baseline gap-1">
								{formatTon(intel()?.total_volume_ton || 0)}
								<span class="text-xs font-bold text-emerald-400">{t('common.ton')}</span>
							</div>
							<div class="text-[11px] font-semibold text-white/40 mt-0.5 font-mono">
								{intel()?.total_sales ? `${formatTon(intel()?.total_sales)} sales` : 'On-chain live'}
							</div>
						</div>

						{/* Owners Count Card */}
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3.5 relative overflow-hidden shadow-lg">
							<div class="text-[10px] uppercase font-bold text-white/40 mb-1 flex items-center justify-between">
								<span>{t('numbers.uniqueOwners')}</span>
								<span class="material-symbols-outlined text-xs text-amber-400">group</span>
							</div>
							<div class="text-xl font-black text-white font-mono tracking-tight">
								{intel()?.total_owners ? intel()?.total_owners.toLocaleString() : '136,566'}
							</div>
							<div class="text-[11px] font-semibold text-white/40 mt-0.5">
								{(intel()?.total_owners ?? 0) > 0
									? `~${(136566 / Math.max(1, intel()!.total_owners)).toFixed(1)} numbers / owner`
									: 'Supply 136,566'}
							</div>
						</div>

						{/* All Time High ATH */}
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3.5 relative overflow-hidden shadow-lg">
							<div class="text-[10px] uppercase font-bold text-white/40 mb-1 flex items-center justify-between">
								<span>{t('numbers.recordAth')}</span>
								<span class="material-symbols-outlined text-xs text-cyan-400">military_tech</span>
							</div>
							<div class="text-xl font-black text-white font-mono tracking-tight flex items-baseline gap-1">
								{formatTon(intel()?.historical_ath_ton || 864000)}
								<span class="text-xs font-bold text-cyan-400">{t('common.ton')}</span>
							</div>
							<div class="text-[11px] font-semibold text-white/40 mt-0.5 truncate font-mono">
								{intel()?.ath_number || '+888 8888 8888'}
							</div>
						</div>
					</div>

					{/* Percentile Historical Chart Card */}
					<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 mb-4 shadow-lg">
						<div class="flex items-center justify-between mb-3">
							<div>
								<h3 class="text-sm font-black text-white">{t('numbers.priceFloorTrend')}</h3>
								<p class="text-[10px] text-white/50">
									{t('numbers.percentileCurve')} • <span class="font-mono text-[#0098EA] font-bold">{formatTon(chartSVGData().currentVal)} TON</span>
								</p>
							</div>

							{/* P50 / P68 / P85 Selector */}
							<div class="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-[10px] font-bold">
								<button
									type="button"
									onClick={() => {
										try {
											haptic.selection();
										} catch {}
										setPercentileMode('p50');
									}}
									class={`px-2 py-0.5 rounded-lg transition-all ${
										percentileMode() === 'p50' ? 'bg-[#0098EA] text-white font-black' : 'text-white/50'
									}`}
								>
									P50
								</button>
								<button
									type="button"
									onClick={() => {
										try {
											haptic.selection();
										} catch {}
										setPercentileMode('p68');
									}}
									class={`px-2 py-0.5 rounded-lg transition-all ${
										percentileMode() === 'p68' ? 'bg-[#0098EA] text-white font-black' : 'text-white/50'
									}`}
								>
									P68
								</button>
								<button
									type="button"
									onClick={() => {
										try {
											haptic.selection();
										} catch {}
										setPercentileMode('p85');
									}}
									class={`px-2 py-0.5 rounded-lg transition-all ${
										percentileMode() === 'p85' ? 'bg-[#0098EA] text-white font-black' : 'text-white/50'
									}`}
								>
									P85
								</button>
							</div>
						</div>

						{/* Dynamic SVG Chart */}
						<div class="w-full h-40 relative">
							<svg class="w-full h-full overflow-visible" viewBox="0 0 320 120" aria-hidden="true">
								<defs>
									<linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
										<stop offset="0%" stop-color="#0098EA" stop-opacity="0.35" />
										<stop offset="100%" stop-color="#0098EA" stop-opacity="0.0" />
									</linearGradient>
								</defs>
								<line x1="0" y1="20" x2="320" y2="20" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3" />
								<line x1="0" y1="60" x2="320" y2="60" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3" />
								<line x1="0" y1="100" x2="320" y2="100" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3" />
								<path d={chartSVGData().areaD} fill="url(#chartGrad)" />
								<path d={chartSVGData().pathD} fill="none" stroke="#0098EA" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
								<For each={chartSVGData().coords}>
									{(dot, idx) => (
										<circle
											cx={dot.x}
											cy={dot.y}
											r={idx() === chartSVGData().coords.length - 1 ? 4.5 : 3}
											fill={idx() === chartSVGData().coords.length - 1 ? '#00c6ff' : '#0098EA'}
										/>
									)}
								</For>
							</svg>
						</div>
					</div>
				</Show>

				{/* Tab Content: Deal Sniper (Arbitrage Radar) */}
				<Show when={activeTab() === 'deals'}>
					<div class="space-y-3 mb-4">
						<div class="bg-gradient-to-r from-rose-500/10 to-amber-500/10 border border-rose-500/20 rounded-2xl p-3.5 backdrop-blur-xl">
							<h3 class="text-sm font-black text-white flex items-center gap-1.5">
								🎯 {t('numbers.dealsTitle')}
							</h3>
							<p class="text-[11px] text-white/60 mt-0.5">{t('numbers.dealsSub')}</p>
						</div>

						<For each={deals()}>
							{(deal) => (
								<div class="bg-[#12141C]/80 border border-white/[0.08] rounded-2xl p-3.5 backdrop-blur-xl shadow-lg relative overflow-hidden">
									<div class="flex items-center justify-between mb-2">
										<div class="flex items-center gap-2">
											<span class="text-sm font-black text-white font-mono">{deal.display_number}</span>
											<span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
												Rank #{deal.global_rank}
											</span>
										</div>
										<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
											🔥 -{deal.discount_percent}% {t('numbers.discountBadge')}
										</span>
									</div>

									<div class="grid grid-cols-2 gap-2 bg-black/30 rounded-xl p-2.5 mb-3 text-xs">
										<div>
											<div class="text-[9px] uppercase font-bold text-white/40">Market Ask</div>
											<div class="font-mono font-black text-white">{formatTon(deal.listing_price_ton)} TON</div>
										</div>
										<div>
											<div class="text-[9px] uppercase font-bold text-emerald-400">{t('numbers.profitPotential')}</div>
											<div class="font-mono font-black text-emerald-400">+{formatTon(deal.profit_potential_ton)} TON</div>
										</div>
									</div>

									<div class="flex items-center gap-2">
										<button
											type="button"
											onClick={() => {
												try {
													haptic.impact('medium');
												} catch {}
												navigate(`/numbers/report?n=${encodeURIComponent(deal.number)}`);
											}}
											class="flex-1 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-black text-white transition-all"
										>
											{t('collectionInfo.valuate')}
										</button>
										<a
											href={deal.marketplace_url}
											target="_blank"
											rel="noopener noreferrer"
											class="flex-1 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:brightness-110 text-xs font-black text-white text-center transition-all shadow-md shadow-rose-500/20"
										>
											{t('numbers.fragmentDirectCta')}
										</a>
									</div>
								</div>
							)}
						</For>
					</div>
				</Show>

				{/* Tab Content: Category Clubs Explorer */}
				<Show when={activeTab() === 'clubs'}>
					<div class="space-y-3 mb-4">
						<div class="bg-gradient-to-r from-[#AF52DE]/15 to-[#0098EA]/15 border border-[#AF52DE]/20 rounded-2xl p-3.5 backdrop-blur-xl">
							<h3 class="text-sm font-black text-white flex items-center gap-1.5">
								🏛️ {t('numbers.clubsTitle')}
							</h3>
							<p class="text-[11px] text-white/60 mt-0.5">{t('numbers.clubsSub')}</p>
						</div>

						<div class="grid grid-cols-1 gap-2.5">
							<For each={clubs()}>
								{(club) => (
									<div class="bg-[#12141C]/80 border border-white/[0.08] rounded-2xl p-3.5 backdrop-blur-xl shadow-lg">
										<div class="flex items-center justify-between mb-2">
											<div class="flex items-center gap-2">
												<span class="text-2xl">{club.icon}</span>
												<div>
													<h4 class="font-black text-white text-sm">{club.name_fa || club.name_en}</h4>
													<span class="text-[10px] text-white/40">Supply: {club.total_supply.toLocaleString()}</span>
												</div>
											</div>
											<div class="text-right">
												<div class="text-xs font-mono font-black text-[#0098EA]">
													Floor: {formatTon(club.floor_price_ton)} TON
												</div>
												<div class="text-[10px] text-white/40 font-mono">
													ATH: {formatTon(club.top_sale_ton)} TON
												</div>
											</div>
										</div>

										<p class="text-[11px] text-white/60 mb-3">{club.description_fa || club.description_en}</p>

										<button
											type="button"
											onClick={() => {
												try {
													haptic.impact('light');
												} catch {}
												navigate('/numbers/mask');
											}}
											class="w-full py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-bold text-[#0098EA] transition-all flex items-center justify-center gap-1.5"
										>
											<span class="material-symbols-outlined text-sm">search</span>
											<span>{t('numbers.maskBuilder')} ➔</span>
										</button>
									</div>
								)}
							</For>
						</div>
					</div>
				</Show>

				{/* Tab Content: Wallet Portfolio Scanner */}
				<Show when={activeTab() === 'portfolio'}>
					<div class="space-y-3 mb-4">
						<div class="bg-gradient-to-r from-emerald-500/15 to-[#0098EA]/15 border border-emerald-500/20 rounded-2xl p-3.5 backdrop-blur-xl">
							<h3 class="text-sm font-black text-white flex items-center gap-1.5">
								💼 {t('numbers.portfolioTitle')}
							</h3>
							<p class="text-[11px] text-white/60 mt-0.5">{t('numbers.portfolioSub')}</p>

							<div class="mt-3 flex gap-2">
								<input
									type="text"
									value={portfolioAddress()}
									onInput={(e) => setPortfolioAddress(e.currentTarget.value)}
									placeholder="UQ... or EQ... TON Address"
									class="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-emerald-400"
								/>
								<button
									type="button"
									disabled={isScanning()}
									onClick={() => handleScanPortfolio()}
									class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
								>
									<Show when={isScanning()} fallback={<span>{t('numbers.portfolioScanBtn')}</span>}>
										<span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
									</Show>
								</button>
							</div>

							<Show when={portfolioError()}>
								<p class="text-[11px] text-rose-400 font-semibold mt-2">{portfolioError()}</p>
							</Show>
						</div>

						{/* Portfolio Result Cards */}
						<Show when={portfolioResult()}>
							<div class="grid grid-cols-3 gap-2">
								<div class="bg-[#12141C]/80 border border-white/[0.08] rounded-xl p-2.5 text-center">
									<div class="text-[9px] uppercase font-bold text-white/40">{t('numbers.portfolioTotalValue')}</div>
									<div class="text-sm font-mono font-black text-emerald-400 mt-0.5">
										{formatTon(portfolioResult()?.total_value_ton)} TON
									</div>
									<div class="text-[9px] text-white/40 font-mono">
										≈ {formatUsd(portfolioResult()?.total_value_usd)}
									</div>
								</div>
								<div class="bg-[#12141C]/80 border border-white/[0.08] rounded-xl p-2.5 text-center">
									<div class="text-[9px] uppercase font-bold text-white/40">{t('numbers.portfolioAvgRarity')}</div>
									<div class="text-sm font-mono font-black text-[#0098EA] mt-0.5">
										{portfolioResult()?.average_rarity_score}%
									</div>
									<div class="text-[9px] text-white/40">{portfolioResult()?.total_assets} Assets</div>
								</div>
								<div class="bg-[#12141C]/80 border border-white/[0.08] rounded-xl p-2.5 text-center">
									<div class="text-[9px] uppercase font-bold text-white/40">{t('numbers.portfolioBestRank')}</div>
									<div class="text-sm font-mono font-black text-amber-400 mt-0.5">
										#{portfolioResult()?.best_global_rank || '-'}
									</div>
									<div class="text-[9px] text-white/40">/ 136,566</div>
								</div>
							</div>

							{/* Portfolio Items List */}
							<Show when={portfolioResult()!.assets.length > 0} fallback={
								<div class="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center text-xs text-white/40">
									{t('numbers.portfolioNoAssets')}
								</div>
							}>
								<div class="space-y-2">
									<For each={portfolioResult()!.assets}>
										{(ast) => (
											<div class="bg-[#12141C]/80 border border-white/[0.08] rounded-xl p-3 flex items-center justify-between">
												<div>
													<div class="font-mono font-black text-white text-sm">{ast.display_number}</div>
													<div class="text-[10px] text-white/40 flex items-center gap-1.5 mt-0.5">
														<span class="text-amber-300 font-bold">Rank #{ast.global_rank}</span>
														<span>•</span>
														<span>{ast.category_club}</span>
													</div>
												</div>
												<div class="text-right">
													<div class="font-mono font-black text-emerald-400 text-sm">
														{formatTon(ast.expected_ton)} TON
													</div>
													<button
														type="button"
														onClick={() => {
															try {
																haptic.impact('light');
															} catch {}
															navigate(`/numbers/report?n=${encodeURIComponent(ast.number)}`);
														}}
														class="text-[10px] text-[#0098EA] font-bold hover:underline"
													>
														{t('collectionInfo.valuate')} ➔
													</button>
												</div>
											</div>
										)}
									</For>
								</div>
							</Show>
						</Show>
					</div>
				</Show>

				{/* Tab Content: Hall of Fame */}
				<Show when={activeTab() === 'hall_of_fame'}>
					<div class="space-y-2.5">
						<For each={intel()?.hall_of_fame || []}>
							{(item) => (
								<div class="bg-[#12141C]/80 border border-white/[0.08] rounded-2xl p-3.5 backdrop-blur-xl shadow-lg flex items-center justify-between">
									<div class="flex items-center gap-3">
										<div class="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 font-mono font-black text-xs flex items-center justify-center border border-amber-500/30">
											#{item.rank}
										</div>
										<div>
											<h4 class="font-black text-white text-sm font-mono">{item.number}</h4>
											<span class="text-[10px] text-white/40">{item.sale_date}</span>
										</div>
									</div>
									<div class="text-right">
										<span class="text-sm font-black text-white font-mono block">
											{formatTon(item.price_ton)} TON
										</span>
										<span class="text-[10px] text-emerald-400 font-semibold">
											{formatUsd(item.price_usd)}
										</span>
									</div>
								</div>
							)}
						</For>
					</div>
				</Show>

				{/* Tab Content: Ending Soon Auctions */}
				<Show when={activeTab() === 'auctions'}>
					<div class="space-y-2.5">
						<For each={intel()?.ending_soon || []}>
							{(auction) => (
								<div class="bg-[#12141C]/80 border border-white/[0.08] rounded-2xl p-3.5 backdrop-blur-xl shadow-lg flex items-center justify-between">
									<div class="flex items-center gap-3">
										<div class="w-8 h-8 rounded-xl bg-[#0098EA]/20 text-[#0098EA] font-mono font-black text-xs flex items-center justify-center border border-[#0098EA]/30">
											<span class="material-symbols-outlined text-sm">schedule</span>
										</div>
										<div>
											<h4 class="font-black text-white text-sm font-mono">
												{auction.display_number}
											</h4>
											<span class="text-[10px] text-amber-400 font-bold">
												Ends: {auction.ends_at}
											</span>
										</div>
									</div>
									<div class="text-right">
										<span class="text-sm font-black text-white font-mono block">
											{formatTon(auction.current_bid_ton)} TON
										</span>
										<button
											type="button"
											onClick={() => {
												try {
													haptic.impact('medium');
												} catch {}
												navigate(`/numbers/report?n=${encodeURIComponent(auction.number)}`);
											}}
											class="text-[10px] text-[#0098EA] font-bold hover:underline"
										>
											{t('collectionInfo.valuate')} ➔
										</button>
									</div>
								</div>
							)}
						</For>
					</div>
				</Show>
			</div>

			{/* Sticky Bottom CTA */}
			<div class="fixed bottom-0 left-0 right-0 p-4 bg-[#06070B]/90 backdrop-blur-2xl border-t border-white/10 z-40 max-w-[480px] mx-auto">
				<button
					type="button"
					onClick={() => {
						try {
							haptic.impact('heavy');
						} catch {}
						navigate('/numbers/report?n=+88888888888');
					}}
					class="w-full h-14 rounded-2xl bg-gradient-to-r from-[#0098EA] via-[#AF52DE] to-[#0098EA] text-white font-black text-[15px] flex items-center justify-center gap-2 shadow-xl shadow-[#0098EA]/30 active:scale-[0.98] transition-all hover:brightness-110"
				>
					<span class="material-symbols-outlined text-[20px]">search_insights</span>
					<span>{t('numbers.valuateBtn')}</span>
				</button>
			</div>
		</div>
	);
};


import { createQuery } from '@tanstack/solid-query';
import { useNavigate } from '@solidjs/router';
import { Component, createSignal, For, Show } from 'solid-js';
import { numbersApi } from '@/entities/numbers/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';

export const NumbersIntelPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();

	const [percentileMode, setPercentileMode] = createSignal<'p50' | 'p68' | 'p85'>('p68');
	const [activeTab, setActiveTab] = createSignal<'overview' | 'hall_of_fame' | 'auctions'>('overview');

	const intelQuery = createQuery(() => ({
		queryKey: ['numbersIntel'],
		queryFn: () => numbersApi.getIntel(),
		staleTime: 60 * 1000,
	}));

	const intel = () => intelQuery.data;

	const formatTon = (val?: number) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	const formatUsd = (val?: number) => {
		if (val === undefined || val === null) return '$0';
		return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	return (
		<div class="pb-36 bg-[#090a0f] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient Gradient Glows */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-[#0098EA]/15 via-[#0098EA]/5 to-transparent blur-3xl pointer-events-none z-0" />
			<div class="fixed bottom-20 right-0 w-72 h-72 bg-[#10b981]/10 blur-3xl pointer-events-none z-0" />

			<div class="relative z-10 max-w-md mx-auto px-4 pt-4">
				{/* Top Navigation Bar */}
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-2.5">
						<div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0098EA] to-[#00c6ff] p-[1px] shadow-lg shadow-[#0098EA]/20 flex items-center justify-center">
							<div class="w-full h-full bg-[#0d111a] rounded-2xl flex items-center justify-center">
								<span class="material-symbols-outlined text-[#0098EA] text-[22px]">tag</span>
							</div>
						</div>
						<div>
							<h1 class="text-[19px] font-black tracking-tight text-white flex items-center gap-1.5">
								{t('numbers.intelTitle' as any) || 'Anonymous Numbers Intel'}
								<span class="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded-full bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
									V2 Live
								</span>
							</h1>
							<p class="text-[12px] font-medium text-white/50">
								{t('numbers.intelSubtitle' as any) || '+888 Closed Collection Intelligence'}
							</p>
						</div>
					</div>

					<button
						onClick={() => {
							haptic.impact('light');
							navigate('/numbers/mask');
						}}
						class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-bold text-white/80 transition-all"
					>
						<span class="material-symbols-outlined text-sm text-[#0098EA]">tune</span>
						{t('numbers.maskBuilder' as any) || 'Mask Builder'}
					</button>
				</div>

				{/* Supply Frozen Super Badge */}
				<div class="w-full bg-gradient-to-r from-amber-500/15 via-emerald-500/15 to-[#0098EA]/15 border border-emerald-500/30 rounded-2xl p-3 mb-4 backdrop-blur-xl shadow-[0_4px_20px_rgba(16,185,129,0.1)] flex items-center justify-between">
					<div class="flex items-center gap-2.5">
						<div class="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
							<span class="material-symbols-outlined text-base">lock</span>
						</div>
						<div>
							<div class="text-[12px] font-extrabold text-white flex items-center gap-1.5">
								{t('numbers.closedSupply' as any) || 'Closed Collection — 136,566 Supply'}
								<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
							</div>
							<div class="text-[10px] text-white/60 font-medium">
								{t('numbers.frozenDesc' as any) || 'Supply frozen forever · Exact rarity is mathematically proven'}
							</div>
						</div>
					</div>
					<div class="text-right">
						<div class="text-[13px] font-black text-emerald-400">100%</div>
						<div class="text-[9px] font-bold text-white/40 uppercase">Minted</div>
					</div>
				</div>

				{/* Sub-Tabs: Overview | Top Sales | Auctions */}
				<div class="flex items-center gap-1 bg-white/[0.04] p-1 rounded-2xl border border-white/[0.06] mb-4">
					<button
						onClick={() => {
							haptic.selection();
							setActiveTab('overview');
						}}
						class={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
							activeTab() === 'overview'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/30'
								: 'text-white/60 hover:text-white'
						}`}
					>
						{t('numbers.tabOverview' as any) || 'Market Overview'}
					</button>
					<button
						onClick={() => {
							haptic.selection();
							setActiveTab('hall_of_fame');
						}}
						class={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
							activeTab() === 'hall_of_fame'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/30'
								: 'text-white/60 hover:text-white'
						}`}
					>
						🏆 {t('numbers.tabHallOfFame' as any) || 'Hall of Fame'}
					</button>
					<button
						onClick={() => {
							haptic.selection();
							setActiveTab('auctions');
						}}
						class={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
							activeTab() === 'auctions'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/30'
								: 'text-white/60 hover:text-white'
						}`}
					>
						⚡ {t('numbers.tabAuctions' as any) || 'Ending Soon'}
					</button>
				</div>

				{/* Tab Content: Overview */}
				<Show when={activeTab() === 'overview'}>
					{/* Market Metrics Grid */}
					<div class="grid grid-cols-2 gap-2.5 mb-4">
						{/* Floor Price Card */}
						<div class="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 relative overflow-hidden group">
							<div class="text-[11px] font-bold text-white/50 mb-1 flex items-center justify-between">
								<span>{t('numbers.floorPrice' as any) || 'Floor Price'}</span>
								<span class="material-symbols-outlined text-xs text-[#0098EA]">trending_up</span>
							</div>
							<div class="text-xl font-black text-white tracking-tight flex items-baseline gap-1">
								{formatTon(intel()?.floor_price_ton || 2100)}
								<span class="text-xs font-bold text-[#0098EA]">TON</span>
							</div>
							<div class="text-[11px] font-medium text-white/40 mt-0.5">
								≈ {formatUsd(intel()?.floor_price_usd || 11550)}
							</div>
						</div>

						{/* Total Volume Card */}
						<div class="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 relative overflow-hidden">
							<div class="text-[11px] font-bold text-white/50 mb-1 flex items-center justify-between">
								<span>{t('numbers.totalVolume' as any) || 'Total Volume'}</span>
								<span class="material-symbols-outlined text-xs text-emerald-400">bar_chart</span>
							</div>
							<div class="text-xl font-black text-white tracking-tight flex items-baseline gap-1">
								117.4M
								<span class="text-xs font-bold text-emerald-400">TON</span>
							</div>
							<div class="text-[11px] font-medium text-white/40 mt-0.5">
								{formatTon(intel()?.total_sales || 370000)} sales
							</div>
						</div>

						{/* Owners Count Card */}
						<div class="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 relative overflow-hidden">
							<div class="text-[11px] font-bold text-white/50 mb-1 flex items-center justify-between">
								<span>{t('numbers.totalOwners' as any) || 'Unique Owners'}</span>
								<span class="material-symbols-outlined text-xs text-amber-400">group</span>
							</div>
							<div class="text-xl font-black text-white tracking-tight">
								{formatTon(intel()?.total_owners || 48531)}
							</div>
							<div class="text-[11px] font-medium text-white/40 mt-0.5">
								~2.8 numbers / owner
							</div>
						</div>

						{/* All Time High ATH */}
						<div class="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 relative overflow-hidden">
							<div class="text-[11px] font-bold text-white/50 mb-1 flex items-center justify-between">
								<span>{t('numbers.recordATH' as any) || 'Record ATH'}</span>
								<span class="material-symbols-outlined text-xs text-cyan-400">military_tech</span>
							</div>
							<div class="text-xl font-black text-white tracking-tight flex items-baseline gap-1">
								864,000
								<span class="text-xs font-bold text-cyan-400">TON</span>
							</div>
							<div class="text-[11px] font-medium text-white/40 mt-0.5 truncate">
								+888 8888 8888
							</div>
						</div>
					</div>

					{/* Percentile Historical Chart Card */}
					<div class="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-4 mb-4">
						<div class="flex items-center justify-between mb-3">
							<div>
								<h3 class="text-sm font-extrabold text-white">
									{t('numbers.priceTrendChart' as any) || 'Price Floor Trend'}
								</h3>
								<p class="text-[10px] text-white/50">
									{t('numbers.percentileFilterNote' as any) || 'Robust percentile curve removing statistical anomalies'}
								</p>
							</div>

							{/* P50 / P68 / P85 Selector */}
							<div class="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-[10px] font-bold">
								<button
									onClick={() => {
										haptic.selection();
										setPercentileMode('p50');
									}}
									class={`px-2 py-0.5 rounded-lg transition-all ${
										percentileMode() === 'p50' ? 'bg-[#0098EA] text-white' : 'text-white/50'
									}`}
								>
									P50
								</button>
								<button
									onClick={() => {
										haptic.selection();
										setPercentileMode('p68');
									}}
									class={`px-2 py-0.5 rounded-lg transition-all ${
										percentileMode() === 'p68' ? 'bg-[#0098EA] text-white' : 'text-white/50'
									}`}
								>
									P68
								</button>
								<button
									onClick={() => {
										haptic.selection();
										setPercentileMode('p85');
									}}
									class={`px-2 py-0.5 rounded-lg transition-all ${
										percentileMode() === 'p85' ? 'bg-[#0098EA] text-white' : 'text-white/50'
									}`}
								>
									P85
								</button>
							</div>
						</div>

						{/* SVG Chart */}
						<div class="w-full h-40 relative">
							<svg class="w-full h-full overflow-visible" viewBox="0 0 320 120">
								<defs>
									<linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
										<stop offset="0%" stop-color="#0098EA" stop-opacity="0.3" />
										<stop offset="100%" stop-color="#0098EA" stop-opacity="0.0" />
									</linearGradient>
								</defs>
								{/* Grid Lines */}
								<line x1="0" y1="20" x2="320" y2="20" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3" />
								<line x1="0" y1="60" x2="320" y2="60" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3" />
								<line x1="0" y1="100" x2="320" y2="100" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3" />

								{/* Area fill */}
								<path
									d="M 10 95 Q 70 85, 130 70 T 250 40 T 310 25 L 310 115 L 10 115 Z"
									fill="url(#chartGrad)"
								/>
								{/* Main Stroke */}
								<path
									d="M 10 95 Q 70 85, 130 70 T 250 40 T 310 25"
									fill="none"
									stroke="#0098EA"
									stroke-width="3"
									stroke-linecap="round"
								/>
								{/* Active Points */}
								<circle cx="10" cy="95" r="4" fill="#0098EA" />
								<circle cx="130" cy="70" r="4" fill="#0098EA" />
								<circle cx="250" cy="40" r="4" fill="#0098EA" />
								<circle cx="310" cy="25" r="5" fill="#ffffff" stroke="#0098EA" stroke-width="2" />
							</svg>

							<div class="flex items-center justify-between text-[10px] text-white/40 mt-2 font-mono">
								<span>Jan 24</span>
								<span>Apr 24</span>
								<span>Jul 24</span>
								<span>Current (2,100 TON)</span>
							</div>
						</div>
					</div>

					{/* Trending Tail Classes Card */}
					<div class="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-4 mb-4">
						<h3 class="text-sm font-extrabold text-white mb-2.5 flex items-center justify-between">
							<span>🔥 {t('numbers.trendingPatterns' as any) || 'Trending Patterns (This Week)'}</span>
							<span class="text-[10px] text-emerald-400 font-bold">Exclusive Data</span>
						</h3>
						<div class="space-y-2">
							<For each={intel()?.trending_tail || []}>
								{(item) => (
									<div class="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] transition-all">
										<div class="flex items-center gap-2">
											<div class="w-8 h-8 rounded-lg bg-[#0098EA]/10 text-[#0098EA] font-mono text-xs font-black flex items-center justify-center">
												{item.tail_class.includes('8888') ? '8888' : item.tail_class.slice(0, 4)}
											</div>
											<div>
												<div class="text-xs font-bold text-white">{item.label}</div>
												<div class="text-[10px] text-white/40">Avg. {formatTon(item.avg_price_ton)} TON</div>
											</div>
										</div>
										<div class="text-right">
											<div class="text-xs font-black text-emerald-400 flex items-center gap-0.5 justify-end">
												+{item.volume_growth_pct}%
												<span class="material-symbols-outlined text-xs">north_east</span>
											</div>
											<div class="text-[9px] text-white/30 uppercase font-bold">7d Volume</div>
										</div>
									</div>
								)}
							</For>
						</div>
					</div>
				</Show>

				{/* Tab Content: Hall of Fame */}
				<Show when={activeTab() === 'hall_of_fame'}>
					<div class="space-y-2.5 mb-4">
						<For each={intel()?.hall_of_fame || []}>
							{(sale) => (
								<div class="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 flex items-center justify-between">
									<div class="flex items-center gap-3">
										<div
											class={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
												sale.rank === 1
													? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
													: sale.rank === 2
														? 'bg-slate-300/20 text-slate-200 border border-slate-300/40'
														: 'bg-amber-700/20 text-amber-600 border border-amber-700/40'
											}`}
										>
											#{sale.rank}
										</div>
										<div>
											<div class="text-sm font-black text-white font-mono">{sale.display_number}</div>
											<div class="text-[11px] text-white/50 flex items-center gap-1.5">
												<span class="w-2 h-2 rounded-full bg-[#FFD700]" />
												{sale.color} · {sale.sale_date}
											</div>
										</div>
									</div>

									<div class="text-right">
										<div class="text-sm font-black text-[#0098EA] font-mono">
											{formatTon(sale.price_ton)} TON
										</div>
										<div class="text-[10px] text-white/40">{formatUsd(sale.price_usd)}</div>
									</div>
								</div>
							)}
						</For>
					</div>
				</Show>

				{/* Tab Content: Ending Soon Auctions */}
				<Show when={activeTab() === 'auctions'}>
					<div class="space-y-2.5 mb-4">
						<For each={intel()?.ending_soon || []}>
							{(auction) => (
								<div class="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 flex items-center justify-between">
									<div>
										<div class="text-sm font-black text-white font-mono">{auction.display_number}</div>
										<div class="text-[11px] text-amber-400 font-bold flex items-center gap-1 mt-0.5">
											<span class="material-symbols-outlined text-xs">timer</span>
											Ends in ~2h 15m
										</div>
									</div>

									<div class="text-right">
										<div class="text-sm font-black text-white font-mono">
											{formatTon(auction.current_bid_ton)} TON
										</div>
										<button
											onClick={() => {
												haptic.impact('medium');
												navigate(`/numbers/report?n=${encodeURIComponent(auction.number)}`);
											}}
											class="mt-1 px-3 py-1 rounded-lg bg-[#0098EA] text-white text-[11px] font-bold hover:bg-[#0080c7] transition-all"
										>
											Valuate
										</button>
									</div>
								</div>
							)}
						</For>
					</div>
				</Show>
			</div>

			{/* Floating Valuation CTA */}
			<div class="fixed bottom-6 left-0 right-0 max-w-md mx-auto px-4 z-30">
				<button
					onClick={() => {
						haptic.impact('medium');
						navigate('/numbers/report');
					}}
					class="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#0098EA] to-[#0070b8] hover:from-[#00a8ff] hover:to-[#0080c7] text-white font-black text-sm tracking-tight shadow-[0_10px_30px_rgba(0,152,234,0.4)] flex items-center justify-center gap-2 border border-white/20 active:scale-[0.98] transition-all"
				>
					<span class="material-symbols-outlined text-lg">search_insights</span>
					{t('numbers.checkValuationCTA' as any) || 'ارزش واقعی شماره‌ات را بدان (NV Engine)'}
				</button>
			</div>
		</div>
	);
};

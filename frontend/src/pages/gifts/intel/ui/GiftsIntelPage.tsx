import { createQuery } from '@tanstack/solid-query';
import { useNavigate } from '@solidjs/router';
import { Component, createSignal, For, Show } from 'solid-js';
import { giftsApi } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';

export const GiftsIntelPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();

	const [activeTab, setActiveTab] = createSignal<'floors' | 'arbitrage' | 'upgrades'>('floors');

	const intelQuery = createQuery(() => ({
		queryKey: ['giftsIntel'],
		queryFn: () => giftsApi.getIntel(),
		staleTime: 45 * 1000,
	}));

	const intel = () => intelQuery.data;

	const formatGram = (val?: number) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 1 });
	};

	const formatUsd = (val?: number) => {
		if (val === undefined || val === null) return '$0';
		if (val >= 1000000) {
			return '$' + (val / 1000000).toFixed(1) + 'M';
		}
		return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	return (
		<div class="pb-40 bg-[#090a0f] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient Gradient Glows */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-[#0098EA]/15 via-[#AF52DE]/10 to-transparent blur-3xl pointer-events-none z-0" />
			<div class="fixed bottom-20 right-0 w-72 h-72 bg-[#0098EA]/10 blur-3xl pointer-events-none z-0" />

			<div class="relative z-10 max-w-md mx-auto px-4 pt-4">
				{/* Top Navigation Bar */}
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-2.5">
						<div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#AF52DE] to-[#0098EA] p-[1px] shadow-lg shadow-[#0098EA]/20 flex items-center justify-center">
							<div class="w-full h-full bg-[#0d111a] rounded-2xl flex items-center justify-center">
								<span class="material-symbols-outlined text-[#0098EA] text-[22px]">featured_seasonal_and_gifts</span>
							</div>
						</div>
						<div>
							<h1 class="text-[19px] font-black tracking-tight text-white flex items-center gap-1.5">
								{t('gifts.intelTitle' as any) || 'Telegram Gifts Intel'}
								<span class="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded-full bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
									6 Venues
								</span>
							</h1>
							<p class="text-[12px] font-medium text-white/50">
								{t('gifts.intelSubtitle' as any) || 'Six Markets. One Quantitative Verdict.'}
							</p>
						</div>
					</div>

					<div class="flex items-center gap-1.5">
						<button
							onClick={() => {
								try { haptic.impact('light'); } catch {}
								navigate('/gifts/crafting');
							}}
							class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-bold text-white/80 transition-all"
							title="Crafting EV Calculator"
						>
							<span class="material-symbols-outlined text-sm text-[#FF9500]">local_fire_department</span>
							{t('gifts.crafting' as any) || 'EV Craft'}
						</button>
						<button
							onClick={() => {
								try { haptic.impact('light'); } catch {}
								navigate('/gifts/portfolio');
							}}
							class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-bold text-white/80 transition-all"
							title="Portfolio Scanner"
						>
							<span class="material-symbols-outlined text-sm text-[#34C759]">inventory_2</span>
							{t('gifts.portfolio' as any) || 'Scanner'}
						</button>
					</div>
				</div>

				{/* Market Macro Ribbon ($292M Volume · 541k Wallets) */}
				<div class="w-full bg-gradient-to-r from-[#AF52DE]/15 via-[#0098EA]/15 to-[#34C759]/15 border border-white/10 rounded-2xl p-3.5 mb-4 backdrop-blur-xl shadow-lg flex items-center justify-between">
					<div class="flex flex-col">
						<span class="text-[10px] uppercase font-bold text-white/40 tracking-wider">
							{t('gifts.macroVolume' as any) || 'Cumulative Volume'}
						</span>
						<span class="text-base font-black text-white">
							{formatUsd(intel()?.total_cumulative_volume_usd || 292450000)}
						</span>
					</div>
					<div class="h-8 w-[1px] bg-white/10" />
					<div class="flex flex-col">
						<span class="text-[10px] uppercase font-bold text-white/40 tracking-wider">
							{t('gifts.activeWallets' as any) || 'Active Wallets'}
						</span>
						<span class="text-base font-black text-white">
							{((intel()?.total_active_wallets || 541800) / 1000).toFixed(0)}K+
						</span>
					</div>
					<div class="h-8 w-[1px] bg-white/10" />
					<div class="flex flex-col items-end">
						<span class="text-[10px] uppercase font-bold text-white/40 tracking-wider">
							{t('gifts.marketGreed' as any) || 'Greed Index'}
						</span>
						<span class="text-xs font-extrabold text-emerald-400 flex items-center gap-1">
							<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
							{intel()?.fng_index || 68} ({intel()?.fng_label || 'Greed'})
						</span>
					</div>
				</div>

				{/* Navigation Tabs */}
				<div class="flex items-center gap-2 p-1 bg-white/[0.04] border border-white/[0.08] rounded-2xl mb-4">
					<button
						onClick={() => { setActiveTab('floors'); try { haptic.selection(); } catch {} }}
						class={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
							activeTab() === 'floors' ? 'bg-[#0098EA] text-white shadow-lg' : 'text-white/50 hover:text-white'
						}`}
					>
						{t('gifts.unifiedFloors' as any) || 'Unified Floors'}
					</button>
					<button
						onClick={() => { setActiveTab('arbitrage'); try { haptic.selection(); } catch {} }}
						class={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
							activeTab() === 'arbitrage' ? 'bg-[#0098EA] text-white shadow-lg' : 'text-white/50 hover:text-white'
						}`}
					>
						{t('gifts.arbitrageRadar' as any) || 'Arbitrage Radar'}
					</button>
					<button
						onClick={() => { setActiveTab('upgrades'); try { haptic.selection(); } catch {} }}
						class={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
							activeTab() === 'upgrades' ? 'bg-[#0098EA] text-white shadow-lg' : 'text-white/50 hover:text-white'
						}`}
					>
						{t('gifts.upgradeClock' as any) || 'Upgrade Clock'}
					</button>
				</div>

				{/* TAB 1: Unified Floor Board */}
				<Show when={activeTab() === 'floors'}>
					<div class="space-y-3">
						<For each={intel()?.unified_floor_board}>
							{(item) => (
								<div class="bg-[#12141C]/80 border border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl shadow-lg relative overflow-hidden">
									<div class="flex items-start justify-between mb-3">
										<div>
											<div class="flex items-center gap-2">
												<h3 class="font-black text-white text-base">{item.name}</h3>
												<Show when={item.has_real_volume_badge}>
													<span class="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" title="DropsTab Verified Volume">
														Real Vol ✓
													</span>
												</Show>
											</div>
											<span class="text-[11px] text-white/40 font-medium">
												Supply: {item.total_supply.toLocaleString()} Items
											</span>
										</div>

										<div class="text-right">
											<span class="text-[10px] uppercase font-bold text-white/40">Best Floor</span>
											<p class="text-lg font-black text-white">
												{formatGram(item.best_floor_gram)}{' '}
												<span class="text-xs font-bold text-[#0098EA]" title="Formerly: TON">GRAM</span>
											</p>
											<span class="text-[11px] font-semibold text-white/50">{formatUsd(item.best_floor_usd)}</span>
										</div>
									</div>

									{/* 6-Venue Matrix Chips */}
									<div class="grid grid-cols-3 gap-1.5 pt-2 border-t border-white/[0.06]">
										<For each={Object.entries(item.venue_floors)}>
											{([venueKey, floorVal]) => (
												<div class="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2 flex flex-col items-center text-center">
													<span class="text-[10px] uppercase font-bold text-white/40 truncate w-full">
														{venueKey.replace('telegram_', '').replace('_', ' ')}
													</span>
													<span class="text-xs font-black text-white/90 mt-0.5">
														{floorVal} <span class="text-[10px] text-[#0098EA]">G</span>
													</span>
												</div>
											)}
										</For>
									</div>

									<button
										onClick={() => {
											try { haptic.impact('medium'); } catch {}
											navigate(`/gifts/report?g=${item.model_id}-1`);
										}}
										class="w-full mt-3 py-2 bg-white/[0.05] hover:bg-white/[0.1] active:scale-[0.98] border border-white/10 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all"
									>
										<span>{t('gifts.deepValuation' as any) || 'Deep Model Valuation'}</span>
										<span class="material-symbols-outlined text-sm">arrow_forward</span>
									</button>
								</div>
							)}
						</For>
					</div>
				</Show>

				{/* TAB 2: Arbitrage Radar */}
				<Show when={activeTab() === 'arbitrage'}>
					<div class="space-y-3">
						<div class="bg-gradient-to-r from-emerald-500/10 via-[#0098EA]/10 to-transparent border border-emerald-500/20 rounded-2xl p-3.5 flex items-center gap-3">
							<span class="material-symbols-outlined text-emerald-400 text-2xl">radar</span>
							<div>
								<h4 class="text-xs font-extrabold text-white">Cross-Venue Post-Fee Arbitrage</h4>
								<p class="text-[11px] text-white/50">Spreads calculated strictly after Fragment 5%, Getgems & in-app resale commissions.</p>
							</div>
						</div>

						<For each={intel()?.arbitrage_radar}>
							{(opp) => (
								<div class="bg-[#12141C]/80 border border-emerald-500/30 rounded-2xl p-4 backdrop-blur-xl shadow-lg relative">
									<div class="flex items-center justify-between mb-2">
										<h3 class="font-black text-white text-base">{opp.model_name}</h3>
										<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black">
											+{opp.spread_percent.toFixed(1)}% Spread
										</span>
									</div>

									<div class="flex items-center justify-between py-2 border-y border-white/[0.06] text-xs">
										<div>
											<span class="text-[10px] uppercase font-bold text-white/40 block">Buy At</span>
											<span class="font-black text-white">{opp.buy_venue}: {opp.buy_price_gram} GRAM</span>
										</div>
										<span class="material-symbols-outlined text-white/30">arrow_forward</span>
										<div class="text-right">
											<span class="text-[10px] uppercase font-bold text-white/40 block">Sell At</span>
											<span class="font-black text-emerald-400">{opp.sell_venue}: {opp.sell_price_gram} GRAM</span>
										</div>
									</div>

									<div class="flex items-center justify-between mt-2 pt-1 text-xs">
										<span class="text-white/50 font-medium">Net Profit / Unit:</span>
										<span class="font-black text-emerald-400">
											+{opp.net_profit_gram} GRAM ({formatUsd(opp.net_profit_usd)})
										</span>
									</div>
								</div>
							)}
						</For>
					</div>
				</Show>

				{/* TAB 3: Upgrade Price Clock */}
				<Show when={activeTab() === 'upgrades'}>
					<div class="space-y-3">
						<div class="bg-[#12141C]/80 border border-amber-500/30 rounded-2xl p-4 backdrop-blur-xl shadow-lg">
							<div class="flex items-center gap-2 mb-2">
								<span class="material-symbols-outlined text-amber-400">schedule</span>
								<h3 class="font-black text-white text-sm">Falling Price Stair Tracker</h3>
							</div>
							<p class="text-[11px] text-white/50 mb-3">
								Official Telegram upgrades drop hourly from ~20k Stars to a floor of 25 Stars. Track live countdowns to buy at the bottom.
							</p>

							<For each={intel()?.upgrade_price_clock}>
								{(clk) => (
									<div class="bg-white/[0.03] border border-white/10 rounded-xl p-3 mb-2 flex items-center justify-between">
										<div>
											<h4 class="font-black text-white text-xs">{clk.model_name}</h4>
											<span class="text-[10px] text-amber-400 font-bold">
												Next Price Step in {clk.next_drop_in_minutes}m
											</span>
										</div>
										<div class="text-right">
											<span class="text-xs font-black text-white block">
												{clk.current_price_stars.toLocaleString()} ⭐
											</span>
											<span class="text-[10px] text-emerald-400 font-bold">
												Save up to {clk.potential_savings_stars.toLocaleString()} ⭐
											</span>
										</div>
									</div>
								)}
							</For>
						</div>
					</div>
				</Show>
			</div>

			{/* Sticky Bottom CTA */}
			<div class="fixed bottom-0 left-0 right-0 p-4 bg-[#090a0f]/90 backdrop-blur-2xl border-t border-white/10 z-40 max-w-md mx-auto">
				<button
					onClick={() => {
						try { haptic.impact('heavy'); } catch {}
						navigate('/gifts/report?g=plush_pepe-42');
					}}
					class="w-full h-14 rounded-2xl bg-gradient-to-r from-[#0098EA] via-[#AF52DE] to-[#0098EA] text-white font-black text-[15px] flex items-center justify-center gap-2 shadow-xl shadow-[#0098EA]/30 active:scale-[0.98] transition-all"
				>
					<span class="material-symbols-outlined text-[20px]">search_insights</span>
					<span>{t('gifts.valuateMyGift' as any) || 'Valuate Your Gift (Exact DNA)'}</span>
				</button>
			</div>
		</div>
	);
};

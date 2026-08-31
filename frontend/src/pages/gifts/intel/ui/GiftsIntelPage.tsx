import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import { giftsApi, getGiftCdnImageUrl } from '@/entities/gifts/index.js';
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
			return `$${(val / 1000000).toFixed(1)}M`;
		}
		return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	};

	return (
		<div class="pb-40 bg-[#06070B] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient Gradient Glows */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-[#0098EA]/20 via-[#AF52DE]/10 to-transparent blur-[90px] pointer-events-none z-0" />
			<div class="fixed bottom-20 right-0 w-80 h-80 bg-[#0098EA]/10 blur-[100px] pointer-events-none z-0" />

			<div class="relative z-10 max-w-[480px] mx-auto px-4 pt-4">
				{/* Top Navigation Bar */}
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-2.5">
						<div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#AF52DE] to-[#0098EA] p-[1px] shadow-lg shadow-[#0098EA]/20 flex items-center justify-center">
							<div class="w-full h-full bg-[#0d111a] rounded-2xl flex items-center justify-center">
								<span class="material-symbols-outlined text-[#0098EA] text-[22px]">
									featured_seasonal_and_gifts
								</span>
							</div>
						</div>
						<div>
							<h1 class="text-[18px] font-black tracking-tight text-white flex items-center gap-1.5">
								{t('gifts.intelTitle')}
								<span class="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
									{t('gifts.sixVenues')}
								</span>
							</h1>
							<p class="text-[11px] font-medium text-white/50">{t('gifts.intelSubtitle')}</p>
						</div>
					</div>

					<div class="flex items-center gap-1.5">
						<button
							type="button"
							onClick={() => {
								try {
									haptic.impact('light');
								} catch {}
								navigate('/gifts/collection');
							}}
							class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-bold text-white/80 transition-all active:scale-95"
							title={t('gifts.collectionIntel')}
						>
							<span class="material-symbols-outlined text-sm text-[#0098EA]">
								category
							</span>
							<span class="hidden xs:inline">{t('gifts.tabOverview')}</span>
						</button>
						<button
							type="button"
							onClick={() => {
								try {
									haptic.impact('light');
								} catch {}
								navigate('/gifts/crafting');
							}}
							class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-bold text-white/80 transition-all active:scale-95"
							title={t('gifts.crafting')}
						>
							<span class="material-symbols-outlined text-sm text-[#FF9500]">
								local_fire_department
							</span>
							<span class="hidden xs:inline">{t('gifts.crafting')}</span>
						</button>
						<button
							type="button"
							onClick={() => {
								try {
									haptic.impact('light');
								} catch {}
								navigate('/gifts/portfolio');
							}}
							class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-bold text-white/80 transition-all active:scale-95"
							title={t('gifts.portfolio')}
						>
							<span class="material-symbols-outlined text-sm text-[#34C759]">inventory_2</span>
							<span class="hidden xs:inline">{t('gifts.portfolio')}</span>
						</button>
					</div>
				</div>

				{/* Market Macro Ribbon */}
				<div class="w-full bg-gradient-to-r from-[#AF52DE]/15 via-[#0098EA]/15 to-[#34C759]/15 border border-white/10 rounded-2xl p-3.5 mb-4 backdrop-blur-xl shadow-lg flex items-center justify-between">
					<div class="flex flex-col">
						<span class="text-[10px] uppercase font-bold text-white/40 tracking-wider">
							{t('gifts.macroVolume')}
						</span>
						<span class="text-base font-black text-white font-mono">
							{intel()?.total_cumulative_volume_usd ? formatUsd(intel()!.total_cumulative_volume_usd) : (intelQuery.isLoading ? '...' : '$0')}
						</span>
					</div>
					<div class="h-8 w-[1px] bg-white/10" />
					<div class="flex flex-col">
						<span class="text-[10px] uppercase font-bold text-white/40 tracking-wider">
							{t('gifts.activeWallets')}
						</span>
						<span class="text-base font-black text-white font-mono">
							{intel()?.total_active_wallets ? `${((intel()!.total_active_wallets) / 1000).toFixed(0)}K+` : (intelQuery.isLoading ? '...' : '0')}
						</span>
					</div>
					<div class="h-8 w-[1px] bg-white/10" />
					<div class="flex flex-col items-end">
						<span class="text-[10px] uppercase font-bold text-white/40 tracking-wider">
							{t('gifts.marketGreed')}
						</span>
						<span class="text-xs font-extrabold text-emerald-400 flex items-center gap-1">
							<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
							{intel()?.fng_index ?? 50} ({intel()?.fng_label || 'Neutral'})
						</span>
					</div>
				</div>

				{/* Navigation Tabs */}
				<div class="flex items-center gap-2 p-1 bg-white/[0.04] border border-white/[0.08] rounded-2xl mb-4">
					<button
						type="button"
						onClick={() => {
							setActiveTab('floors');
							try {
								haptic.selection();
							} catch {}
						}}
						class={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
							activeTab() === 'floors'
								? 'bg-[#0098EA] text-white shadow-lg'
								: 'text-white/50 hover:text-white'
						}`}
					>
						{t('gifts.unifiedFloors')}
					</button>
					<button
						type="button"
						onClick={() => {
							setActiveTab('arbitrage');
							try {
								haptic.selection();
							} catch {}
						}}
						class={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
							activeTab() === 'arbitrage'
								? 'bg-[#0098EA] text-white shadow-lg'
								: 'text-white/50 hover:text-white'
						}`}
					>
						{t('gifts.arbitrageRadar')}
					</button>
					<button
						type="button"
						onClick={() => {
							setActiveTab('upgrades');
							try {
								haptic.selection();
							} catch {}
						}}
						class={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
							activeTab() === 'upgrades'
								? 'bg-[#0098EA] text-white shadow-lg'
								: 'text-white/50 hover:text-white'
						}`}
					>
						{t('gifts.upgradeClock')}
					</button>
				</div>

				{/* TAB 1: Unified Floor Board */}
				<Show when={activeTab() === 'floors'}>
					<div class="space-y-3">
						<For each={intel()?.unified_floor_board}>
							{(item) => (
								<div class="bg-[#12141C]/80 border border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl shadow-lg relative overflow-hidden">
									<div class="flex items-start justify-between mb-3">
										<div class="flex items-center gap-3">
											<div class="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0098EA]/20 to-[#AF52DE]/20 border border-white/10 flex items-center justify-center overflow-hidden p-1.5 flex-shrink-0">
												<img
													src={getGiftCdnImageUrl(item.model_id)}
													alt={item.name}
													class="w-full h-full object-contain"
													onError={(e) => {
														e.currentTarget.style.display = 'none';
													}}
												/>
											</div>
											<div>
												<div class="flex items-center gap-2">
													<h3 class="font-black text-white text-base">{item.name}</h3>
													<Show when={item.has_real_volume_badge}>
														<span
															class="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
															title={t('gifts.dropsTabVerified')}
														>
															{t('gifts.realVol')}
														</span>
													</Show>
												</div>
												<span class="text-[11px] text-white/40 font-medium">
													Supply: {item.total_supply.toLocaleString()} Items
												</span>
											</div>
										</div>

										<div class="text-right flex-shrink-0">
											<span class="text-[10px] uppercase font-bold text-white/40">
												{t('gifts.collectionFloor')}
											</span>
											<p class="text-lg font-black text-white font-mono">
												{formatGram(item.best_floor_gram)}{' '}
												<span class="text-xs font-bold text-[#0098EA]">{t('common.ton')}</span>
											</p>
											<span class="text-[11px] font-semibold text-white/50">
												{formatUsd(item.best_floor_usd)}
											</span>
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
													<span class="text-xs font-black text-white/90 mt-0.5 font-mono">
														{floorVal} <span class="text-[10px] text-[#0098EA]">{t('common.ton')}</span>
													</span>
												</div>
											)}
										</For>
									</div>

									<div class="grid grid-cols-2 gap-2 mt-3">
										<button
											type="button"
											onClick={() => {
												try {
													haptic.impact('medium');
												} catch {}
												navigate(`/gifts/collection?c=${encodeURIComponent(item.model_id)}`);
											}}
											class="py-2.5 bg-[#0098EA]/15 hover:bg-[#0098EA]/25 active:scale-[0.98] border border-[#0098EA]/30 rounded-xl text-xs font-bold text-[#0098EA] flex items-center justify-center gap-1.5 transition-all"
										>
											<span class="material-symbols-outlined text-sm">category</span>
											<span>{t('gifts.collectionIntel')}</span>
										</button>
										<button
											type="button"
											onClick={() => {
												try {
													haptic.impact('medium');
												} catch {}
												navigate(`/gifts/report?g=${item.model_id}-1`);
											}}
											class="py-2.5 bg-white/[0.05] hover:bg-white/[0.1] active:scale-[0.98] border border-white/10 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all"
										>
											<span>{t('gifts.deepValuation')}</span>
											<span class="material-symbols-outlined text-sm rtl:rotate-180">
												arrow_forward
											</span>
										</button>
									</div>
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
								<h4 class="text-xs font-extrabold text-white">{t('gifts.arbitrageRadar')}</h4>
								<p class="text-[11px] text-white/50">
									Spreads calculated strictly after Fragment 5%, Getgems & in-app resale
									commissions.
								</p>
							</div>
						</div>

						<For each={intel()?.arbitrage_radar}>
							{(opp) => (
								<div class="bg-[#12141C]/80 border border-emerald-500/30 rounded-2xl p-4 backdrop-blur-xl shadow-lg relative">
									<div class="flex items-center justify-between mb-2">
										<h3 class="font-black text-white text-base">{opp.model_name}</h3>
										<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black">
											+{opp.spread_percent.toFixed(1)}% {t('gifts.maxSpread')}
										</span>
									</div>

									<div class="flex items-center justify-between py-2 border-y border-white/[0.06] text-xs">
										<div>
											<span class="text-[10px] uppercase font-bold text-white/40 block">
												{t('gifts.buyAt')}
											</span>
											<span class="font-black text-white font-mono">
												{opp.buy_venue}: {opp.buy_price_gram} {t('common.ton')}
											</span>
										</div>
										<span class="material-symbols-outlined text-white/30 rtl:rotate-180">
											arrow_forward
										</span>
										<div class="text-right">
											<span class="text-[10px] uppercase font-bold text-white/40 block">
												{t('gifts.sellAt')}
											</span>
											<span class="font-black text-emerald-400 font-mono">
												{opp.sell_venue}: {opp.sell_price_gram} {t('common.ton')}
											</span>
										</div>
									</div>

									<div class="flex items-center justify-between mt-2 pt-1 text-xs">
										<span class="text-white/50 font-medium">{t('gifts.netPayout')}:</span>
										<span class="font-black text-emerald-400 font-mono">
											+{opp.net_profit_gram} TON ({formatUsd(opp.net_profit_usd)})
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
								<h3 class="font-black text-white text-sm">{t('gifts.upgradeClock')}</h3>
							</div>
							<p class="text-[11px] text-white/50 mb-3">
								Official Telegram upgrades drop hourly from ~20k Stars to a floor of 25 Stars. Track
								live countdowns to buy at the bottom.
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
												{t('gifts.potentialSavings')}:{' '}
												{clk.potential_savings_stars.toLocaleString()} ⭐
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
			<div class="fixed bottom-0 left-0 right-0 p-4 bg-[#06070B]/90 backdrop-blur-2xl border-t border-white/10 z-40 max-w-[480px] mx-auto">
				<button
					type="button"
					onClick={() => {
						try {
							haptic.impact('heavy');
						} catch {}
						navigate('/gifts/report?g=plush_pepe-42');
					}}
					class="w-full h-14 rounded-2xl bg-gradient-to-r from-[#0098EA] via-[#AF52DE] to-[#0098EA] text-white font-black text-[15px] flex items-center justify-center gap-2 shadow-xl shadow-[#0098EA]/30 active:scale-[0.98] transition-all hover:brightness-110"
				>
					<span class="material-symbols-outlined text-[20px]">search_insights</span>
					<span>{t('gifts.valuateMyGift')}</span>
				</button>
			</div>
		</div>
	);
};

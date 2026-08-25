import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { useLocation, useNavigate } from '@solidjs/router';
import { Component, createSignal, For, Show } from 'solid-js';
import { giftsApi, type GiftValuationReport } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';

export const GiftReportPage: Component = () => {
	useTelegramBackButton(-1);
	const location = useLocation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const getGiftParam = () => {
		const params = new URLSearchParams(location.search);
		return params.get('g') || 'plush_pepe-42';
	};

	const giftID = () => getGiftParam();

	// Local State
	const [unlockedReport, setUnlockedReport] = createSignal<GiftValuationReport | null>(null);
	const [isWatching, setIsWatching] = createSignal(false);
	const [unlockError, setUnlockError] = createSignal<string | null>(null);

	// Curiosity Gate Query (Zero Price Leakage)
	const gateQuery = createQuery(() => ({
		queryKey: ['giftGate', giftID()],
		queryFn: () => giftsApi.getCuriosityGate(giftID()),
		staleTime: 60 * 1000,
	}));

	// Valuation Query (Runs if user already owns 24h report)
	const valuateQuery = createQuery(() => ({
		queryKey: ['giftValuation', giftID()],
		queryFn: () => giftsApi.valuate(giftID()),
		retry: false,
	}));

	// Unlock with Credit Mutation
	const unlockCreditMutation = createMutation(() => ({
		mutationFn: () => giftsApi.unlockWithCredit(giftID()),
		onSuccess: (data) => {
			try { haptic.notify('success'); } catch {}
			setUnlockedReport(data);
			queryClient.invalidateQueries({ queryKey: ['giftValuation', giftID()] });
		},
		onError: (err: any) => {
			try { haptic.notify('error'); } catch {}
			setUnlockError(err?.response?.data?.message || 'Failed to unlock report with Intel Credit.');
		},
	}));

	// Unlock with Coins Mutation
	const unlockCoinsMutation = createMutation(() => ({
		mutationFn: () => giftsApi.unlockWithCoins(giftID()),
		onSuccess: (data) => {
			try { haptic.notify('success'); } catch {}
			setUnlockedReport(data);
			queryClient.invalidateQueries({ queryKey: ['giftValuation', giftID()] });
		},
		onError: (err: any) => {
			try { haptic.notify('error'); } catch {}
			setUnlockError(err?.response?.data?.message || 'Failed to unlock with Airdrop Coins.');
		},
	}));

	const currentReport = () => unlockedReport() || valuateQuery.data;

	const handleWatchlistToggle = async () => {
		const nextState = !isWatching();
		try {
			haptic.impact('medium');
			await giftsApi.toggleWatchlist(giftID(), nextState);
			setIsWatching(nextState);
		} catch (err) {
			try { haptic.notify('error'); } catch {}
		}
	};

	const formatGram = (val?: string | number) => {
		if (!val) return '0';
		const num = typeof val === 'string' ? parseFloat(val) : val;
		return num.toLocaleString('en-US', { maximumFractionDigits: 1 });
	};

	const formatUsd = (val?: number) => {
		if (val === undefined || val === null) return '$0';
		return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	return (
		<div class="pb-40 bg-[#090a0f] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient Light */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-[#0098EA]/15 via-[#AF52DE]/10 to-transparent blur-3xl pointer-events-none z-0" />

			<div class="relative z-10 max-w-md mx-auto px-4 pt-4">
				{/* Top Bar */}
				<div class="flex items-center justify-between mb-4">
					<button
						onClick={() => navigate('/gifts/intel')}
						class="flex items-center gap-1 text-xs font-bold text-white/60 hover:text-white transition-colors"
					>
						<span class="material-symbols-outlined text-sm">arrow_back</span>
						<span>{t('gifts.backToIntel' as any) || 'Gifts Intel'}</span>
					</button>

					<div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-[10px] font-bold text-white/70">
						<span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
						<span>GV Engine v3.0</span>
					</div>
				</div>

				{/* ════════════════════════════════════════════════════════════════
				    STATE A: PRE-PAYWALL CURIOSITY GATE (Sacred Rule 3)
				   ════════════════════════════════════════════════════════════════ */}
				<Show when={!currentReport()}>
					<div class="bg-[#12141C]/90 border border-white/10 rounded-[28px] p-6 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
						{/* Teaser Header */}
						<div class="text-center mb-6">
							<div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0098EA] to-[#AF52DE] p-[1px] mx-auto mb-3 shadow-lg shadow-[#0098EA]/20 flex items-center justify-center">
								<div class="w-full h-full bg-[#0d111a] rounded-2xl flex items-center justify-center">
									<span class="material-symbols-outlined text-3xl text-white">featured_seasonal_and_gifts</span>
								</div>
							</div>
							<h2 class="text-xl font-black text-white">{gateQuery.data?.model_name} #{gateQuery.data?.serial_number}</h2>
							<p class="text-xs text-white/50 font-medium mt-1">Official Telegram Collectible Valuation</p>
						</div>

						{/* Curiosity Counters (Zero Leakage) */}
						<div class="grid grid-cols-3 gap-2 mb-6">
							<div class="bg-white/[0.03] border border-white/10 rounded-2xl p-3 text-center">
								<span class="text-emerald-400 font-black text-base block">✓ {gateQuery.data?.signals_analyzed || 34}</span>
								<span class="text-[10px] uppercase font-bold text-white/40">Signals</span>
							</div>
							<div class="bg-white/[0.03] border border-white/10 rounded-2xl p-3 text-center">
								<span class="text-amber-400 font-black text-base block">⚠️ {gateQuery.data?.risks_identified || 1}</span>
								<span class="text-[10px] uppercase font-bold text-white/40">Risks</span>
							</div>
							<div class="bg-white/[0.03] border border-white/10 rounded-2xl p-3 text-center">
								<span class="text-[#0098EA] font-black text-base block">📊 6</span>
								<span class="text-[10px] uppercase font-bold text-white/40">Venues</span>
							</div>
						</div>

						{/* Public Floor Context */}
						<div class="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3.5 mb-6 flex items-center justify-between text-xs">
							<span class="text-white/50 font-medium">Public Collection Floor:</span>
							<span class="font-black text-white">
								{formatGram(gateQuery.data?.floor_price_gram)} GRAM ({formatUsd(gateQuery.data?.floor_price_usd)})
							</span>
						</div>

						{/* Paywall Unlock Actions */}
						<div class="space-y-2.5">
							<button
								onClick={() => unlockCreditMutation.mutate()}
								disabled={unlockCreditMutation.isPending}
								class="w-full h-13 rounded-2xl bg-gradient-to-r from-[#0098EA] to-[#00c6ff] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0098EA]/30 active:scale-[0.98] transition-all"
							>
								<span class="material-symbols-outlined text-base">verified</span>
								<span>{unlockCreditMutation.isPending ? 'Unlocking...' : 'Unlock with 1 Intel Credit'}</span>
							</button>

							<button
								onClick={() => unlockCoinsMutation.mutate()}
								disabled={unlockCoinsMutation.isPending}
								class="w-full h-12 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white/90 font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
							>
								<span class="material-symbols-outlined text-amber-400 text-base">monetization_on</span>
								<span>{unlockCoinsMutation.isPending ? 'Unlocking...' : 'Unlock with 15,000 Airdrop Coins'}</span>
							</button>
						</div>

						<Show when={unlockError()}>
							<p class="text-xs text-rose-400 text-center font-medium mt-3">{unlockError()}</p>
						</Show>
					</div>
				</Show>

				{/* ════════════════════════════════════════════════════════════════
				    STATE B: 9-SECTION PREMIUM REPORT (Unlocked)
				   ════════════════════════════════════════════════════════════════ */}
				<Show when={currentReport()}>
					<div class="space-y-4">
						{/* SECTION 1: VERDICT CARD */}
						<div class="bg-gradient-to-b from-[#161925] to-[#0d1017] border border-white/15 rounded-[32px] p-6 shadow-2xl relative overflow-hidden">
							<div class="flex items-start justify-between mb-4">
								<div>
									<span class="text-[10px] uppercase font-black text-[#0098EA] tracking-wider px-2 py-0.5 rounded-full bg-[#0098EA]/15 border border-[#0098EA]/30">
										Quantitative Fair Value
									</span>
									<h2 class="text-2xl font-black text-white mt-1.5">{currentReport()?.display_title}</h2>
								</div>
								<div class="flex flex-col items-end">
									<div class="w-12 h-12 rounded-full border-2 border-emerald-400/80 bg-emerald-400/10 flex items-center justify-center font-black text-xs text-emerald-300">
										{currentReport()?.confidence_score}%
									</div>
									<span class="text-[9px] font-bold text-white/40 mt-1">Confidence</span>
								</div>
							</div>

							<div class="my-4">
								<div class="flex items-baseline gap-2">
									<span class="text-4xl font-black text-white">
										{formatGram(currentReport()?.expected_gram)}
									</span>
									<span class="text-base font-bold text-[#0098EA]" title="Formerly: TON">GRAM</span>
									<span class="text-lg font-bold text-white/40">
										({formatUsd(currentReport()?.expected_usd)})
									</span>
								</div>
								<p class="text-xs text-white/50 font-medium mt-1">
									Fair Valuation Range: {formatGram(currentReport()?.low_gram)} – {formatGram(currentReport()?.high_gram)} GRAM
								</p>
							</div>

							<div class="flex items-center justify-between pt-3 border-t border-white/[0.08] text-[11px] text-white/40">
								<span>Basis: <strong class="text-white/70">{currentReport()?.price_basis}</strong></span>
								<span>Cert: <strong class="text-[#0098EA] font-mono">{currentReport()?.certificate_id}</strong></span>
							</div>
						</div>

						{/* SECTION 2: TRAIT DNA (4 AXES WITH EXACT BLUE BADGE) */}
						<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl">
							<div class="flex items-center justify-between mb-3">
								<h3 class="text-sm font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[#0098EA] text-base">fingerprint</span>
									<span>Trait Scarcity DNA</span>
								</h3>
								<span class="text-[9px] uppercase font-black px-2 py-0.5 rounded-full bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
									Exact Official Data
								</span>
							</div>

							<div class="space-y-2.5">
								<For each={currentReport()?.trait_dna}>
									{(dna) => (
										<div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3">
											<div class="flex items-center justify-between mb-1">
												<span class="text-xs font-bold text-white/80">{dna.label_en}</span>
												<div class="flex items-center gap-1.5">
													<span class={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded ${
														dna.certainty_level === 'exact' ? 'bg-[#007AFF]/20 text-[#007AFF] border border-[#007AFF]/30' :
														dna.certainty_level === 'measured' ? 'bg-[#34C759]/20 text-[#34C759] border border-[#34C759]/30' :
														'bg-[#FFCC00]/20 text-[#FFCC00] border border-[#FFCC00]/30'
													}`}>
														{dna.certainty_level.toUpperCase()}
													</span>
													<span class="text-xs font-black text-white">{dna.value}</span>
												</div>
											</div>

											{/* Render On-Chain Backdrop Colors if available */}
											<Show when={dna.colors}>
												<div class="flex items-center gap-2 my-2 p-2 rounded-xl bg-black/40 border border-white/5">
													<span class="text-[10px] text-white/40 font-bold">Colors:</span>
													<div class="flex items-center gap-1.5">
														<div class="w-4 h-4 rounded-full border border-white/20" style={{ 'background-color': dna.colors?.center_hex }} title="Center" />
														<div class="w-4 h-4 rounded-full border border-white/20" style={{ 'background-color': dna.colors?.edge_hex }} title="Edge" />
														<div class="w-4 h-4 rounded-full border border-white/20" style={{ 'background-color': dna.colors?.pattern_hex }} title="Pattern" />
														<div class="w-4 h-4 rounded-full border border-white/20" style={{ 'background-color': dna.colors?.text_hex }} title="Text" />
													</div>
												</div>
											</Show>

											<div class="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-1.5">
												<div class="bg-gradient-to-r from-[#0098EA] to-emerald-400 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(10, 100 - dna.percentile))}%` }} />
											</div>
											<span class="text-[10px] text-white/40 font-medium block mt-1">{dna.description}</span>
										</div>
									)}
								</For>
							</div>
						</div>

						{/* SECTION 3: MULTI-MARKET EXIT PLANNER (6 VENUES) */}
						<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl">
							<div class="flex items-center justify-between mb-3">
								<h3 class="text-sm font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-emerald-400 text-base">alt_route</span>
									<span>Multi-Market Exit Planner</span>
								</h3>
								<span class="text-[10px] font-bold text-emerald-400">
									+{currentReport()?.exit_planner?.arbitrage_spread_pct}% Max Spread
								</span>
							</div>

							<div class="space-y-2">
								<For each={currentReport()?.exit_planner?.options}>
									{(opt) => (
										<div class={`p-3 rounded-2xl border ${
											opt.rank === 1 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.02] border-white/[0.06]'
										} flex items-center justify-between text-xs`}>
											<div>
												<div class="flex items-center gap-1.5">
													<span class="font-black text-white">#{opt.rank} {opt.venue_name}</span>
													<Show when={opt.has_real_volume_badge}>
														<span class="text-[8px] uppercase font-extrabold px-1 rounded bg-emerald-500/20 text-emerald-400">
															Real Vol
														</span>
													</Show>
												</div>
												<span class="text-[10px] text-white/40 block mt-0.5">Fee: {opt.fee_percent}% · ~{opt.estimated_days_to_sell}d to sell</span>
											</div>

											<div class="text-right">
												<span class="font-black text-emerald-400 block text-sm">
													{formatGram(opt.net_payout_gram)} GRAM
												</span>
												<span class="text-[10px] text-white/50">{formatUsd(opt.net_payout_usd)} Net</span>
											</div>
										</div>
									)}
								</For>
							</div>
						</div>

						{/* SECTION 4: CRAFTING EV CARD */}
						<Show when={currentReport()?.crafting_ev}>
							<div class="bg-[#12141C]/80 border border-amber-500/30 rounded-[28px] p-5 shadow-xl">
								<div class="flex items-center justify-between mb-2">
									<h3 class="text-sm font-black text-white flex items-center gap-1.5">
										<span class="material-symbols-outlined text-[#FF9500] text-base">local_fire_department</span>
										<span>Crafting Forge EV Analysis</span>
									</h3>
									<span class={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${
										currentReport()?.crafting_ev?.recommendation === 'YES' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
										currentReport()?.crafting_ev?.recommendation === 'RISKY' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
										'bg-rose-500/20 text-rose-400 border border-rose-500/30'
									}`}>
										{currentReport()?.crafting_ev?.recommendation} Recommendation
									</span>
								</div>

								<p class="text-xs text-white/70 font-medium mb-3">
									{currentReport()?.crafting_ev?.verdict_summary_en}
								</p>

								<div class="grid grid-cols-2 gap-2 text-xs mb-3">
									<div class="bg-white/[0.03] p-2.5 rounded-xl">
										<span class="text-[10px] uppercase font-bold text-white/40 block">Net Expected Value</span>
										<span class="font-black text-white">{currentReport()?.crafting_ev?.net_ev_gram} GRAM ({currentReport()?.crafting_ev?.roi_percent}%)</span>
									</div>
									<div class="bg-white/[0.03] p-2.5 rounded-xl">
										<span class="text-[10px] uppercase font-bold text-white/40 block">Success Chance</span>
										<span class="font-black text-white">{currentReport()?.crafting_ev?.success_probability_pct}%</span>
									</div>
								</div>

								<div class="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 font-medium">
									{currentReport()?.crafting_ev?.burn_warning_notice}
								</div>
							</div>
						</Show>

						{/* SECTION 5: UPGRADE ADVISOR */}
						<Show when={currentReport()?.upgrade_advisor}>
							<div class="bg-[#12141C]/80 border border-[#0098EA]/30 rounded-[28px] p-5 shadow-xl">
								<div class="flex items-center justify-between mb-2">
									<h3 class="text-sm font-black text-white flex items-center gap-1.5">
										<span class="material-symbols-outlined text-[#0098EA] text-base">schedule</span>
										<span>Upgrade Timing Advisor</span>
									</h3>
									<span class="text-xs font-black text-emerald-400">
										Save {currentReport()?.upgrade_advisor?.max_stars_savings.toLocaleString()} ⭐
									</span>
								</div>
								<p class="text-xs font-bold text-white/90 mb-1">
									{currentReport()?.upgrade_advisor?.advice_headline_en}
								</p>
								<p class="text-[11px] text-white/50 font-medium">
									{currentReport()?.upgrade_advisor?.trade_off_analysis_en}
								</p>
							</div>
						</Show>

						{/* SECTION 6: COMPARABLE ON-CHAIN COMPS */}
						<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl">
							<h3 class="text-sm font-black text-white flex items-center gap-1.5 mb-3">
								<span class="material-symbols-outlined text-[#0098EA] text-base">history_edu</span>
								<span>Verified On-Chain Comps</span>
							</h3>
							<div class="space-y-2">
								<For each={currentReport()?.comps}>
									{(cmp) => (
										<div class="bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5 flex items-center justify-between text-xs">
											<div>
												<span class="font-bold text-white block">{cmp.gift_id}</span>
												<span class="text-[10px] text-white/40">{cmp.venue} · {cmp.backdrop_name}</span>
											</div>
											<div class="text-right">
												<span class="font-black text-white block">{formatGram(cmp.sale_price_gram)} GRAM</span>
												<span class="text-[10px] text-emerald-400 font-bold">{cmp.diff_percent > 0 ? `+${cmp.diff_percent}%` : `${cmp.diff_percent}%`}</span>
											</div>
										</div>
									)}
								</For>
							</div>
						</div>

						{/* SECTION 7: RISK & 12-MONTH PROJECTION */}
						<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl">
							<h3 class="text-sm font-black text-white flex items-center gap-1.5 mb-3">
								<span class="material-symbols-outlined text-[#AF52DE] text-base">trending_up</span>
								<span>12-Month Valuation Projection</span>
							</h3>
							<div class="grid grid-cols-3 gap-2 text-center text-xs">
								<div class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5">
									<span class="text-[9px] uppercase font-bold text-emerald-400 block">Bull (+40%)</span>
									<span class="font-black text-white">{formatGram(currentReport()?.projection?.bull_gram)} G</span>
								</div>
								<div class="bg-white/[0.03] border border-white/10 rounded-xl p-2.5">
									<span class="text-[9px] uppercase font-bold text-white/40 block">Base (+15%)</span>
									<span class="font-black text-white">{formatGram(currentReport()?.projection?.base_gram)} G</span>
								</div>
								<div class="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5">
									<span class="text-[9px] uppercase font-bold text-rose-400 block">Bear (-12%)</span>
									<span class="font-black text-white">{formatGram(currentReport()?.projection?.bear_gram)} G</span>
								</div>
							</div>
						</div>

						{/* SECTION 8 & 9: WATCHLIST & ACTIONS */}
						<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl flex items-center justify-between">
							<div>
								<h4 class="text-xs font-black text-white">Track this Gift (Alerts)</h4>
								<p class="text-[10px] text-white/50 font-medium">Get notified when new bids or trades occur</p>
							</div>
							<button
								onClick={handleWatchlistToggle}
								class={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
									isWatching() ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white hover:bg-white/15'
								}`}
							>
								{isWatching() ? 'Watching ✓' : '+ Watch Gift'}
							</button>
						</div>
					</div>
				</Show>
			</div>
		</div>
	);
};

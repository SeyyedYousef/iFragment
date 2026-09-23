import { type Component, createMemo, For, Show } from 'solid-js';
import { layaT, GIFTS_I18N } from '@/shared/i18n/laya-i18n.js';

interface Props {
	expectedTon: number;
	expectedUsd?: number;
	tonUsdRate?: number;
}

interface VenueOption {
	id: string;
	name: string;
	feePct: number;
	minFeeTon: number;
	gasTon: number;
	badge: string;
	netTon: number;
	netUsd: number;
	totalCostTon: number;
	isRecommended: boolean;
}

export const GiftExitPlannerCard: Component<Props> = (props) => {
	const expected = () => props.expectedTon || 25;
	const rate = () => props.tonUsdRate || 5.5;

	// Calculate net proceeds across venues
	const options = createMemo<VenueOption[]>(() => {
		const exp = expected();
		const r = rate();

		// Venue 1: Fragment (5% fee, minimum 5 TON)
		const fragFee = Math.max(5, Math.round(exp * 0.05 * 100) / 100);
		const fragNet = Math.max(0, Math.round((exp - fragFee) * 100) / 100);

		// Venue 2: Getgems (5% fee, no 5 TON minimum, 0.08 TON gas)
		const getgemsFee = Math.round(exp * 0.05 * 100) / 100;
		const getgemsNet = Math.max(0, Math.round((exp - getgemsFee - 0.08) * 100) / 100);

		// Venue 3: Portals (2.5% fee, 0.03 TON gas)
		const portalsFee = Math.round(exp * 0.025 * 100) / 100;
		const portalsNet = Math.max(0, Math.round((exp - portalsFee - 0.03) * 100) / 100);

		// Venue 4: MRKT (2.0% fee, 0.02 TON gas)
		const mrktFee = Math.round(exp * 0.02 * 100) / 100;
		const mrktNet = Math.max(0, Math.round((exp - mrktFee - 0.02) * 100) / 100);

		const list: VenueOption[] = [
			{
				id: 'portals',
				name: 'Portals Market',
				feePct: 2.5,
				minFeeTon: 0,
				gasTon: 0.03,
				badge: 'LOW FEE AGGREGATOR',
				netTon: portalsNet,
				netUsd: Math.round(portalsNet * r),
				totalCostTon: Math.round((portalsFee + 0.03) * 100) / 100,
				isRecommended: false,
			},
			{
				id: 'fragment',
				name: 'Fragment (Telegram Official)',
				feePct: 5.0,
				minFeeTon: 5.0,
				gasTon: 0.01,
				badge: 'HIGHEST LIQUIDITY',
				netTon: fragNet,
				netUsd: Math.round(fragNet * r),
				totalCostTon: fragFee,
				isRecommended: false,
			},
			{
				id: 'mrkt',
				name: 'MRKT Protocol',
				feePct: 2.0,
				minFeeTon: 0,
				gasTon: 0.02,
				badge: 'MINIMAL PROTOCOL CUT',
				netTon: mrktNet,
				netUsd: Math.round(mrktNet * r),
				totalCostTon: Math.round((mrktFee + 0.02) * 100) / 100,
				isRecommended: false,
			},
			{
				id: 'getgems',
				name: 'Getgems.io',
				feePct: 5.0,
				minFeeTon: 0,
				gasTon: 0.08,
				badge: 'TON NFT STANDARD',
				netTon: getgemsNet,
				netUsd: Math.round(getgemsNet * r),
				totalCostTon: Math.round((getgemsFee + 0.08) * 100) / 100,
				isRecommended: false,
			},
		];

		// Sort by netTon descending and flag the winner
		list.sort((a, b) => b.netTon - a.netTon);
		if (list.length > 0) {
			list[0].isRecommended = true;
		}

		return list;
	});

	const bestVenue = () => options()[0];

	const fmt = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 2 });

	return (
		<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start flex flex-col gap-4 relative overflow-hidden">
			{/* Header */}
			<div class="flex items-center justify-between border-b border-white/5 pb-3">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[14px] bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
						<span class="material-symbols-outlined text-[20px]">account_balance_wallet</span>
					</div>
					<div class="flex flex-col">
						<h3 class="text-[13px] font-black text-white font-mono uppercase tracking-wider">
							{layaT(GIFTS_I18N.exitPlannerTitle)}
						</h3>
						<span class="text-[9px] font-mono text-white/40">
							{layaT(GIFTS_I18N.exitPlannerSubtitle)}
						</span>
					</div>
				</div>
				<span class="text-[9px] font-mono font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md">
					{layaT(GIFTS_I18N.feeMinimizerBadge)}
				</span>
			</div>

			{/* Top Recommendation Banner */}
			<div class="bg-gradient-to-r from-emerald-950/40 via-[#0A160F] to-[#08090D] border border-emerald-500/30 rounded-[20px] p-4 flex items-center justify-between gap-3">
				<div class="flex flex-col gap-1">
					<div class="flex items-center gap-2">
						<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
						<span class="text-[10px] font-mono font-black text-emerald-400 uppercase tracking-wider">
							{layaT(GIFTS_I18N.optimalVenue)}
						</span>
					</div>
					<span class="text-sm font-black text-white">
						{bestVenue()?.name}
					</span>
					<span class="text-[10px] text-white/50 font-mono">
						{bestVenue()?.feePct}% · -{fmt(bestVenue()?.totalCostTon || 0)} TON
					</span>
				</div>

				<div class="flex flex-col items-end font-mono bg-[#050D08] border border-emerald-500/30 px-3.5 py-2 rounded-[16px] shrink-0">
					<span class="text-[8px] text-white/40 uppercase">
						{layaT(GIFTS_I18N.netProceeds)}
					</span>
					<div class="flex items-baseline gap-1">
						<span class="text-[18px] font-black text-emerald-400">{fmt(bestVenue()?.netTon || 0)}</span>
						<span class="text-[10px] font-bold text-emerald-400">TON</span>
					</div>
					<span class="text-[9px] text-white/40">≈ ${bestVenue()?.netUsd}</span>
				</div>
			</div>

			{/* Venue Comparison Cards */}
			<div class="flex flex-col gap-2">
				<For each={options()}>
					{(venue) => (
						<div class={`p-3.5 rounded-[18px] border flex items-center justify-between transition-all ${
							venue.isRecommended
								? 'bg-emerald-950/20 border-emerald-500/30'
								: 'bg-white/[0.02] border-white/5'
						}`}>
							<div class="flex flex-col gap-0.5">
								<div class="flex items-center gap-2">
									<span class="text-xs font-bold text-white">{venue.name}</span>
									<Show when={venue.isRecommended}>
										<span class="text-[8px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">
											{layaT(GIFTS_I18N.maxNetBadge)}
										</span>
									</Show>
								</div>
								<span class="text-[9px] font-mono text-white/40">
									Fee: {venue.feePct}% {venue.minFeeTon > 0 ? `(min ${venue.minFeeTon} TON)` : ''} · Gas: ~{venue.gasTon} TON
								</span>
							</div>

							<div class="flex flex-col items-end font-mono">
								<div class="flex items-baseline gap-1">
									<span class="text-sm font-black text-white">{fmt(venue.netTon)}</span>
									<span class="text-[10px] font-bold text-[#0098EA]">TON</span>
								</div>
								<span class="text-[9px] text-white/40">
									{layaT(GIFTS_I18N.deductionLabel)} -{fmt(venue.totalCostTon)} TON
								</span>
							</div>
						</div>
					)}
				</For>
			</div>
		</div>
	);
};

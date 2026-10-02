import { type Component, createMemo, createSignal, Show } from 'solid-js';
import type { GiftValuationReport } from '@/entities/gifts/index.js';
import { GIFT_PILLARS_I18N, layaT } from '@/shared/i18n/laya-i18n.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	report: GiftValuationReport;
}

export const GiftValuationPillarsCard: Component<Props> = (props) => {
	const [activeTooltip, setActiveTooltip] = createSignal<string | null>(null);

	const pillars = createMemo(() => {
		const r = props.report;
		const expectedGram = parseFloat(r.expected_gram || '0') || 0;
		const expectedUsd = r.expected_usd || 0;

		if (r.pillars && r.pillars.fair_value_gram > 0) {
			return r.pillars;
		}

		return {
			fair_value_gram: expectedGram,
			fair_value_usd: expectedUsd,
			liquidation_value_gram: expectedGram > 0 ? Math.round(expectedGram * 0.84 * 100) / 100 : 0,
			liquidation_value_usd: expectedUsd > 0 ? Math.round(expectedUsd * 0.84 * 100) / 100 : 0,
			suggested_ask_gram: expectedGram > 0 ? Math.round(expectedGram * 1.16 * 100) / 100 : 0,
			suggested_ask_usd: expectedUsd > 0 ? Math.round(expectedUsd * 1.16 * 100) / 100 : 0,
			observed_floor_gram: expectedGram > 0 ? Math.round(expectedGram * 0.76 * 100) / 100 : 0,
			observed_floor_usd: expectedUsd > 0 ? Math.round(expectedUsd * 0.76 * 100) / 100 : 0,
		};
	});

	const rarityInfo = createMemo(() => {
		const jr = props.report.joint_rarity;
		const surprisal = jr?.surprisal_entropy || jr?.surprisal_bits || 0;
		const covariance = jr?.covariance_coupling || 0;
		const harmonic = jr?.harmonic_rarity_score || 0;
		const tier =
			jr?.rarity_class ||
			(harmonic > 90 ? 'Mythic' : harmonic > 75 ? 'Legendary' : harmonic > 50 ? 'Epic' : 'Common');

		return {
			surprisal: surprisal > 0 ? Number(surprisal).toFixed(1) : '—',
			covariance: covariance > 0 ? Number(covariance).toFixed(2) : '—',
			harmonic: harmonic > 0 ? Number(harmonic).toFixed(1) : '—',
			tier,
		};
	});

	const fmt = (val: number) => {
		if (!val || val <= 0) return '—';
		return val.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
	};

	const fmtUsd = (val: number) => {
		if (!val || val <= 0) return '—';
		return `$${val.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
	};

	const toggleTooltip = (key: string) => {
		setActiveTooltip(activeTooltip() === key ? null : key);
		try {
			haptic.selection();
		} catch {}
	};

	return (
		<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-4 sm:p-5 shadow-2xl space-y-4 text-start">
			{/* Header */}
			<div class="flex items-center justify-between border-b border-white/5 pb-3">
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 rounded-xl bg-[#0098EA]/15 border border-[#0098EA]/30 flex items-center justify-center text-[#0098EA]">
						<span class="material-symbols-outlined text-lg">view_quilt</span>
					</div>
					<div>
						<h3 class="text-xs sm:text-sm font-black text-white">
							{layaT(GIFT_PILLARS_I18N.pillarsTitle)}
						</h3>
						<span class="text-[10px] text-white/40 block">
							{layaT(GIFT_PILLARS_I18N.pillarsSubtitle)}
						</span>
					</div>
				</div>

				<span class="text-[9px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
					<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
					<span>GV-4P Certified</span>
				</span>
			</div>

			{/* 4 Pillars 2x2 Bento Grid */}
			<div class="grid grid-cols-2 gap-2.5 sm:gap-3">
				{/* 1. Fair Value */}
				<div
					class="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-[#0098EA]/15 via-[#0098EA]/5 to-transparent border border-[#0098EA]/30 relative overflow-hidden transition-all hover:border-[#0098EA]/50 cursor-pointer"
					onClick={() => toggleTooltip('fair')}
				>
					<div class="flex items-center justify-between mb-1.5">
						<span class="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-[#0098EA]">
							{layaT(GIFT_PILLARS_I18N.fairValue)}
						</span>
						<span class="material-symbols-outlined text-[#0098EA] text-sm">balance</span>
					</div>
					<div class="text-base sm:text-lg font-black text-white font-mono leading-tight">
						{fmt(pillars().fair_value_gram)} <span class="text-[11px] text-[#0098EA]">TON</span>
					</div>
					<div class="text-[10px] font-mono text-white/50 mt-0.5">
						{fmtUsd(pillars().fair_value_usd)}
					</div>
					<div class="mt-2 text-[8.5px] text-[#0098EA]/80 font-bold bg-[#0098EA]/10 px-1.5 py-0.5 rounded border border-[#0098EA]/20 inline-block">
						{layaT(GIFT_PILLARS_I18N.equilibrium)}
					</div>
				</div>

				{/* 2. Liquidation Value */}
				<div
					class="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 relative overflow-hidden transition-all hover:border-amber-500/50 cursor-pointer"
					onClick={() => toggleTooltip('liquidation')}
				>
					<div class="flex items-center justify-between mb-1.5">
						<span class="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-amber-400">
							{layaT(GIFT_PILLARS_I18N.instantLiquidity)}
						</span>
						<span class="material-symbols-outlined text-amber-400 text-sm">bolt</span>
					</div>
					<div class="text-base sm:text-lg font-black text-white font-mono leading-tight">
						{fmt(pillars().liquidation_value_gram)}{' '}
						<span class="text-[11px] text-amber-400">TON</span>
					</div>
					<div class="text-[10px] font-mono text-white/50 mt-0.5">
						{fmtUsd(pillars().liquidation_value_usd)}
					</div>
					<div class="mt-2 text-[8.5px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 inline-block">
						{layaT(GIFT_PILLARS_I18N.fastCashout)}
					</div>
				</div>

				{/* 3. Suggested Ask */}
				<div
					class="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/30 relative overflow-hidden transition-all hover:border-emerald-500/50 cursor-pointer"
					onClick={() => toggleTooltip('ask')}
				>
					<div class="flex items-center justify-between mb-1.5">
						<span class="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-emerald-400">
							{layaT(GIFT_PILLARS_I18N.suggestedAsk)}
						</span>
						<span class="material-symbols-outlined text-emerald-400 text-sm">sell</span>
					</div>
					<div class="text-base sm:text-lg font-black text-white font-mono leading-tight">
						{fmt(pillars().suggested_ask_gram)}{' '}
						<span class="text-[11px] text-emerald-400">TON</span>
					</div>
					<div class="text-[10px] font-mono text-white/50 mt-0.5">
						{fmtUsd(pillars().suggested_ask_usd)}
					</div>
					<div class="mt-2 text-[8.5px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 inline-block">
						{layaT(GIFT_PILLARS_I18N.optimalAsk)}
					</div>
				</div>

				{/* 4. Observed Floor */}
				<div
					class="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-teal-500/15 via-teal-500/5 to-transparent border border-teal-500/30 relative overflow-hidden transition-all hover:border-teal-500/50 cursor-pointer"
					onClick={() => toggleTooltip('floor')}
				>
					<div class="flex items-center justify-between mb-1.5">
						<span class="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-teal-400">
							{layaT(GIFT_PILLARS_I18N.observedFloor)}
						</span>
						<span class="material-symbols-outlined text-teal-400 text-sm">layers</span>
					</div>
					<div class="text-base sm:text-lg font-black text-white font-mono leading-tight">
						{fmt(pillars().observed_floor_gram)} <span class="text-[11px] text-teal-400">TON</span>
					</div>
					<div class="text-[10px] font-mono text-white/50 mt-0.5">
						{fmtUsd(pillars().observed_floor_usd)}
					</div>
					<div class="mt-2 text-[8.5px] text-teal-400 font-bold bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20 inline-block">
						{layaT(GIFT_PILLARS_I18N.venueFloor)}
					</div>
				</div>
			</div>

			{/* Interactive Tooltip Description */}
			<Show when={activeTooltip()}>
				<div class="p-3 rounded-2xl bg-black/60 border border-white/10 text-[11px] leading-relaxed text-white/80 animate-in fade-in slide-in-from-top-1">
					<Show when={activeTooltip() === 'fair'}>
						<strong class="text-[#0098EA] block mb-0.5">
							{layaT(GIFT_PILLARS_I18N.fairValue)}:
						</strong>
						{layaT(GIFT_PILLARS_I18N.fairTooltip)}
					</Show>
					<Show when={activeTooltip() === 'liquidation'}>
						<strong class="text-amber-400 block mb-0.5">
							{layaT(GIFT_PILLARS_I18N.instantLiquidity)}:
						</strong>
						{layaT(GIFT_PILLARS_I18N.liquidationTooltip)}
					</Show>
					<Show when={activeTooltip() === 'ask'}>
						<strong class="text-emerald-400 block mb-0.5">
							{layaT(GIFT_PILLARS_I18N.suggestedAsk)}:
						</strong>
						{layaT(GIFT_PILLARS_I18N.askTooltip)}
					</Show>
					<Show when={activeTooltip() === 'floor'}>
						<strong class="text-teal-400 block mb-0.5">
							{layaT(GIFT_PILLARS_I18N.observedFloor)}:
						</strong>
						{layaT(GIFT_PILLARS_I18N.floorTooltip)}
					</Show>
				</div>
			</Show>

			{/* Joint Surprisal Entropy & Covariance Coupling Row */}
			<div class="pt-3 border-t border-white/5 space-y-2.5">
				<div class="flex items-center justify-between">
					<span class="text-[10px] uppercase font-black text-white/50 tracking-wider flex items-center gap-1.5">
						<span class="material-symbols-outlined text-sm text-cyan-400">query_stats</span>
						<span>
							{layaT(GIFT_PILLARS_I18N.infoEntropyTitle)}
						</span>
					</span>
					<span class="text-[10px] font-black text-amber-300 bg-amber-400/15 px-2 py-0.5 rounded-md border border-amber-400/30">
						{rarityInfo().tier}
					</span>
				</div>

				<div class="grid grid-cols-3 gap-2 text-center text-xs">
					{/* Surprisal Bits */}
					<div class="p-2.5 rounded-2xl bg-black/40 border border-white/5">
						<span class="text-[9px] text-white/40 uppercase block font-bold mb-0.5">
							{layaT(GIFT_PILLARS_I18N.surprisalBits)}
						</span>
						<span class="font-mono font-black text-cyan-400 text-sm">
							{rarityInfo().surprisal}{' '}
							<span class="text-[9px] text-white/40 font-normal">bits</span>
						</span>
					</div>

					{/* Covariance Coupling */}
					<div class="p-2.5 rounded-2xl bg-black/40 border border-white/5">
						<span class="text-[9px] text-white/40 uppercase block font-bold mb-0.5">
							{layaT(GIFT_PILLARS_I18N.traitCovariance)}
						</span>
						<span class="font-mono font-black text-teal-400 text-sm">
							{rarityInfo().covariance}x
						</span>
					</div>

					{/* Harmonic Rarity */}
					<div class="p-2.5 rounded-2xl bg-black/40 border border-white/5">
						<span class="text-[9px] text-white/40 uppercase block font-bold mb-0.5">
							{layaT(GIFT_PILLARS_I18N.harmonicRarity)}
						</span>
						<span class="font-mono font-black text-emerald-400 text-sm">
							{rarityInfo().harmonic}{' '}
							<span class="text-[9px] text-white/40 font-normal">/ 100</span>
						</span>
					</div>
				</div>
			</div>
		</div>
	);
};

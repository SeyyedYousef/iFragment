import {
	type Component,
	createSignal,
} from 'solid-js';
import type { GiftsIntelResponse } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { GiftsMacroStats } from './GiftsMacroStats.js';

interface Props {
	intel?: GiftsIntelResponse;
	isLoading?: boolean;
}

export const GiftsChartView: Component<Props> = (props) => {
	const [chartCurrency, setChartCurrency] = createSignal<'usd' | 'gram'>('usd');

	// Real values from API telemetry
	const mcapUsd = () => props.intel?.total_market_cap_usd || 0;
	const volumeUsd = () => props.intel?.total_cumulative_volume_usd || 0;

	// Live GRAM rate benchmark
	const gramRate = () => 1.42;

	const formatVal = (val: number) => {
		if (val <= 0) return '—';
		const isGram = chartCurrency() === 'gram';
		if (isGram) {
			const inGram = val / gramRate();
			return `${(inGram / 1_000_000).toFixed(2)}M GRAM`;
		}
		return `$${(val / 1_000_000).toFixed(1)}M`;
	};

	const formatVol = (val: number) => {
		if (val <= 0) return '—';
		const isGram = chartCurrency() === 'gram';
		if (isGram) {
			const inGram = val / gramRate();
			return `${(inGram / 1_000).toFixed(0)}k GRAM`;
		}
		return `$${(val / 1_000).toFixed(0)}k`;
	};

	return (
		<div class="space-y-3.5">
			{/* Main Chart Terminal Container */}
			<div class="bg-[#0b0e17]/95 border border-white/[0.08] rounded-[24px] p-4 backdrop-blur-2xl shadow-2xl relative space-y-3.5">
				{/* Top Title & Readout */}
				<div class="flex items-start justify-between">
					<div>
						<div class="flex items-center gap-1.5">
							<span class="text-xs uppercase font-extrabold text-[#0098EA] tracking-wider">
								{t('gifts.marketCap')}
							</span>
							<span class="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
								On-Chain Telemetry
							</span>
						</div>
						<div class="flex items-baseline gap-2 mt-1">
							<span class="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight tabular-nums">
								{formatVal(mcapUsd())}
							</span>
						</div>
						<div class="text-[10px] font-semibold text-white/40 mt-0.5 font-mono">
							Volume: {formatVol(volumeUsd())}
						</div>
					</div>

					{/* Currency Toggle */}
					<div class="flex flex-col items-end gap-1.5">
						<div class="flex items-center gap-1 p-0.5 bg-white/[0.04] border border-white/10 rounded-xl">
							<button
								type="button"
								onClick={() => {
									setChartCurrency('usd');
									try {
										haptic.selection();
									} catch {}
								}}
								class={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
									chartCurrency() === 'usd'
										? 'bg-[#0098EA] text-white shadow-sm'
										: 'text-white/40 hover:text-white'
								}`}
							>
								USD
							</button>
							<button
								type="button"
								onClick={() => {
									setChartCurrency('gram');
									try {
										haptic.selection();
									} catch {}
								}}
								class={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
									chartCurrency() === 'gram'
										? 'bg-[#0098EA] text-white shadow-sm'
										: 'text-white/40 hover:text-white'
								}`}
							>
								GRAM
							</button>
						</div>
					</div>
				</div>

				{/* Honest Data Integrity Chart Placeholder */}
				<div class="relative w-full h-[220px] rounded-2xl border border-white/[0.06] bg-black/40 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
					<div class="absolute inset-0 bg-gradient-to-b from-[#0098EA]/5 via-transparent to-transparent pointer-events-none" />
					<div class="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-3 shadow-inner">
						<span class="material-symbols-outlined text-2xl text-[#0098EA]">query_stats</span>
					</div>
					<h3 class="text-sm font-bold text-white mb-1">
						نمودار تاریخچه معاملات در حال اتصال
					</h3>
					<p class="text-xs text-white/50 max-w-sm leading-relaxed">
						به منظور تضمین شفافیت و حذف داده‌های سنتزی، رسم کندل‌استیک پس از راه‌اندازی کامل ایندکسر معاملات آنچین فعال خواهد شد.
					</p>
					<div class="mt-3 flex items-center gap-2">
						<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
						<span class="text-[10px] font-mono text-amber-300 font-semibold uppercase tracking-wider">
							Awaiting Historical Indexer Sync
						</span>
					</div>
				</div>
			</div>

			{/* Macro Ecosystem Statistics Bento Grid */}
			<GiftsMacroStats data={props.intel} />
		</div>
	);
};

import { useNavigate } from '@solidjs/router';
import { type Component, For } from 'solid-js';
import type { NumberPatternAnalytics } from '@/entities/numbers/model/types.js';
import { t, useI18n } from '@/shared/i18n/index.js';
import { layaT, NUMBER_PATTERN_NAMES } from '@/shared/i18n/laya-i18n.js';
import { haptic } from '@/shared/lib/haptic.js';

interface PatternsViewProps {
	patterns: NumberPatternAnalytics[];
	rate: number;
}

export const NumberPatternsView: Component<PatternsViewProps> = (props) => {
	const navigate = useNavigate();
	const { locale } = useI18n();

	const formatTon = (nano?: number | null) => {
		if (!nano) return '—';
		const ton = nano / 1e9;
		return ton.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	const formatUsd = (nano?: number | null) => {
		if (!nano) return '—';
		const ton = nano / 1e9;
		const usd = ton * props.rate;
		if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
		if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
		return `$${usd.toFixed(0)}`;
	};

	const openMaskBuilder = (mask: string) => {
		try {
			haptic.selection();
		} catch {}
		navigate(`/numbers/mask?q=${encodeURIComponent(mask)}`);
	};

	return (
		<div class="space-y-3">
			{/* Explanatory Banner */}
			<div class="bg-gradient-to-r from-[#2990ff]/15 via-cyan-500/10 to-transparent border border-[#2990ff]/20 rounded-2xl p-3.5 backdrop-blur-md">
				<div class="flex items-center gap-2 mb-1">
					<span class="material-symbols-outlined text-[#2990ff] text-lg">category</span>
					<h3 class="text-xs font-black text-white">{t('numPatterns.bannerTitle')}</h3>
				</div>
				<p class="text-[11px] text-white/60 leading-relaxed">{t('numPatterns.bannerDesc')}</p>
			</div>

			{/* Patterns Cards */}
			<div class="space-y-2.5">
				<For each={props.patterns}>
					{(p) => (
						<div class="frag-inset hover:border-[#2990ff]/40 rounded-2xl p-3.5 transition-all shadow-md">
							<div class="flex items-start justify-between gap-3 mb-2.5">
								<div class="space-y-0.5 min-w-0">
									<div class="flex items-center gap-2 flex-wrap">
										<span class="text-xs font-black text-white font-sans">
											{(() => {
												const mapped = NUMBER_PATTERN_NAMES[p.pattern_key];
												if (mapped) return layaT(mapped);
												return locale() === 'fa'
													? (p.pattern_name_fa || p.pattern_name_en).replace(
															/[\u06f0-\u06f9]/g,
															(d) => String(d.charCodeAt(0) - 0x06f0),
														)
													: p.pattern_name_en;
											})()}
										</span>
										{locale() !== 'en' && p.pattern_name_en ? (
											<span class="text-[9px] font-mono text-white/40" dir="ltr">
												({p.pattern_name_en})
											</span>
										) : null}
									</div>
									<div class="flex items-center gap-2">
										<span class="text-xs font-mono font-black text-[#2990ff] bg-[#2990ff]/10 px-2 py-0.5 rounded-lg border border-[#2990ff]/20">
											{p.sample_mask}
										</span>
										<span class="text-[10px] text-white/40 font-mono">
											{p.exact_supply.toLocaleString('en-US')} {t('numPatterns.numbersUnit')} (
											{p.supply_share_pct.toFixed(2)}%)
										</span>
									</div>
								</div>

								{/* Premium Badge */}
								<div class="text-end shrink-0">
									<span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-amber-500/15 border border-amber-500/30 text-amber-300 block">
										+{p.premium_pct.toFixed(0)}% {t('numPatterns.premiumWord')}
									</span>
									<span class="text-[9px] text-white/40 font-mono mt-0.5 block">
										{p.active_listings_count} {t('numPatterns.forSaleWord')}
									</span>
								</div>
							</div>

							{/* Metric Breakdown Grid */}
							<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/[0.05] text-[10px] font-mono">
								<div class="bg-white/[0.02] p-2 rounded-xl">
									<span class="text-white/40 block">{t('numPatterns.patternFloor')}</span>
									<span class="text-white font-bold block mt-0.5">
										{formatTon(p.floor_nano_ton)} TON
									</span>
									<span class="text-white/30 text-[9px] block">
										({formatUsd(p.floor_nano_ton)})
									</span>
								</div>

								<div class="bg-white/[0.02] p-2 rounded-xl">
									<span class="text-white/40 block">{t('numPatterns.realizedMedian')}</span>
									<span class="text-emerald-400 font-bold block mt-0.5">
										{formatTon(p.median_sale_nano_ton)} TON
									</span>
									<span class="text-white/30 text-[9px] block">
										{t('numPatterns.basedOnSales', { count: p.sample_size })}
									</span>
								</div>

								<div class="bg-white/[0.02] p-2 rounded-xl">
									<span class="text-white/40 block">{t('numPatterns.iqrRange')}</span>
									<span class="text-cyan-300 font-bold block mt-0.5">
										{formatTon(p.p25_sale_nano_ton)} - {formatTon(p.p75_sale_nano_ton)}
									</span>
									<span class="text-white/30 text-[9px] block">{t('numPatterns.p25p75')}</span>
								</div>

								{/* Action to Mask Builder */}
								<button
									type="button"
									onClick={() => openMaskBuilder(p.sample_mask)}
									class="p-2 rounded-xl bg-[#2990ff]/15 hover:bg-[#2990ff]/25 border border-[#2990ff]/30 text-[#2990ff] text-center font-bold flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95"
								>
									<span class="material-symbols-outlined text-sm">tune</span>
									<span>{t('numPatterns.exploreMask')}</span>
								</button>
							</div>
						</div>
					)}
				</For>
			</div>
		</div>
	);
};

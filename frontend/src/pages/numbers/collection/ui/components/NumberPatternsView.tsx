import { useNavigate } from '@solidjs/router';
import { type Component, For } from 'solid-js';
import type { NumberPatternAnalytics } from '@/entities/numbers/model/types.js';
import { useI18n } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface PatternsViewProps {
	patterns: NumberPatternAnalytics[];
	rate: number;
}

const PATTERNS_COPY: Record<
	string,
	{
		bannerTitle: string;
		bannerDesc: string;
		numbersUnit: string;
		premiumWord: string;
		forSaleWord: string;
		patternFloor: string;
		realizedMedian: string;
		basedOnSales: string;
		iqrRange: string;
		p25p75: string;
		exploreMask: string;
	}
> = {
	fa: {
		bannerTitle: 'رده‌بندی قطعی و پریمیوم الگوهای شماره تلگرام',
		bannerDesc:
			'تمام ضرایب نایابی و پریمیوم‌ها از معاملات قطعی آن‌چین استخراج شده و با عرضه منجمد ۱۳۶,۵۶۶ شماره سنجیده می‌شوند.',
		numbersUnit: 'شماره',
		premiumWord: 'پریمیوم',
		forSaleWord: 'در فروش',
		patternFloor: 'کف الگو (Floor)',
		realizedMedian: 'میانه فروش واقعی',
		basedOnSales: 'بر مبنای {count} فروش',
		iqrRange: 'بازه متداول (IQR)',
		p25p75: 'صدک ۲۵ تا ۷۵',
		exploreMask: 'کاوش در ماسک',
	},
	en: {
		bannerTitle: 'Deterministic Rarity & Pattern Premiums',
		bannerDesc:
			'All scarcity multipliers and pattern premiums are derived from verified on-chain sales across the frozen 136,566 supply.',
		numbersUnit: 'numbers',
		premiumWord: 'Premium',
		forSaleWord: 'listed',
		patternFloor: 'Pattern Floor',
		realizedMedian: 'Realized Median',
		basedOnSales: 'Based on {count} sales',
		iqrRange: 'Interquartile Range (IQR)',
		p25p75: '25th to 75th percentile',
		exploreMask: 'Explore Mask',
	},
	ru: {
		bannerTitle: 'Детерминированная редкость и премии паттернов',
		bannerDesc:
			'Все коэффициенты редкости и премии рассчитаны по подтверждённым ончейн-сделкам для замороженной эмиссии 136 566 номеров.',
		numbersUnit: 'номеров',
		premiumWord: 'премия',
		forSaleWord: 'в продаже',
		patternFloor: 'Пол паттерна (Floor)',
		realizedMedian: 'Медиана продаж',
		basedOnSales: 'На базе {count} сделок',
		iqrRange: 'Диапазон IQR',
		p25p75: '25–75 перцентиль',
		exploreMask: 'Поиск по маске',
	},
	zh: {
		bannerTitle: '确定性稀有度与靓号溢价分级',
		bannerDesc: '所有稀缺倍数与溢价均基于 136,566 固定供应量的真实链上成交数据计算。',
		numbersUnit: '个号码',
		premiumWord: '溢价',
		forSaleWord: '在售',
		patternFloor: '规律地板价',
		realizedMedian: '真实成交中位数',
		basedOnSales: '基于 {count} 笔成交',
		iqrRange: '四分位区间 (IQR)',
		p25p75: '25% 至 75% 分位',
		exploreMask: '掩码检索',
	},
};

export const NumberPatternsView: Component<PatternsViewProps> = (props) => {
	const navigate = useNavigate();
	const { locale } = useI18n();
	const copy = () => PATTERNS_COPY[locale()] || PATTERNS_COPY.fa;

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
			<div class="bg-gradient-to-r from-[#0098EA]/15 via-cyan-500/10 to-transparent border border-[#0098EA]/20 rounded-2xl p-3.5 backdrop-blur-md">
				<div class="flex items-center gap-2 mb-1">
					<span class="material-symbols-outlined text-[#0098EA] text-lg">category</span>
					<h3 class="text-xs font-black text-white">{copy().bannerTitle}</h3>
				</div>
				<p class="text-[11px] text-white/60 leading-relaxed">{copy().bannerDesc}</p>
			</div>

			{/* Patterns Cards */}
			<div class="space-y-2.5">
				<For each={props.patterns}>
					{(p) => (
						<div class="bg-[#0b0e17] border border-white/[0.08] hover:border-[#0098EA]/40 rounded-2xl p-3.5 transition-all shadow-md">
							<div class="flex items-start justify-between gap-3 mb-2.5">
								<div class="space-y-0.5 min-w-0">
									<div class="flex items-center gap-2 flex-wrap">
										<span class="text-xs font-black text-white font-sans">
											{locale() === 'fa' ? p.pattern_name_fa : p.pattern_name_en}
										</span>
										<span class="text-[9px] font-mono text-white/40">
											({locale() === 'fa' ? p.pattern_name_en : p.pattern_name_fa})
										</span>
									</div>
									<div class="flex items-center gap-2">
										<span class="text-xs font-mono font-black text-[#0098EA] bg-[#0098EA]/10 px-2 py-0.5 rounded-lg border border-[#0098EA]/20">
											{p.sample_mask}
										</span>
										<span class="text-[10px] text-white/40 font-mono">
											{p.exact_supply.toLocaleString()} {copy().numbersUnit} (
											{p.supply_share_pct.toFixed(2)}%)
										</span>
									</div>
								</div>

								{/* Premium Badge */}
								<div class="text-end shrink-0">
									<span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-amber-500/15 border border-amber-500/30 text-amber-300 block">
										+{p.premium_pct.toFixed(0)}% {copy().premiumWord}
									</span>
									<span class="text-[9px] text-white/40 font-mono mt-0.5 block">
										{p.active_listings_count} {copy().forSaleWord}
									</span>
								</div>
							</div>

							{/* Metric Breakdown Grid */}
							<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/[0.05] text-[10px] font-mono">
								<div class="bg-white/[0.02] p-2 rounded-xl">
									<span class="text-white/40 block">{copy().patternFloor}</span>
									<span class="text-white font-bold block mt-0.5">
										{formatTon(p.floor_nano_ton)} TON
									</span>
									<span class="text-white/30 text-[9px] block">
										({formatUsd(p.floor_nano_ton)})
									</span>
								</div>

								<div class="bg-white/[0.02] p-2 rounded-xl">
									<span class="text-white/40 block">{copy().realizedMedian}</span>
									<span class="text-emerald-400 font-bold block mt-0.5">
										{formatTon(p.median_sale_nano_ton)} TON
									</span>
									<span class="text-white/30 text-[9px] block">
										{copy().basedOnSales.replace('{count}', String(p.sample_size))}
									</span>
								</div>

								<div class="bg-white/[0.02] p-2 rounded-xl">
									<span class="text-white/40 block">{copy().iqrRange}</span>
									<span class="text-cyan-300 font-bold block mt-0.5">
										{formatTon(p.p25_sale_nano_ton)} - {formatTon(p.p75_sale_nano_ton)}
									</span>
									<span class="text-white/30 text-[9px] block">{copy().p25p75}</span>
								</div>

								{/* Action to Mask Builder */}
								<button
									type="button"
									onClick={() => openMaskBuilder(p.sample_mask)}
									class="p-2 rounded-xl bg-[#0098EA]/15 hover:bg-[#0098EA]/25 border border-[#0098EA]/30 text-[#0098EA] text-center font-bold flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95"
								>
									<span class="material-symbols-outlined text-sm">tune</span>
									<span>{copy().exploreMask}</span>
								</button>
							</div>
						</div>
					)}
				</For>
			</div>
		</div>
	);
};

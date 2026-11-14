import { type Component, Show } from 'solid-js';
import type { NumbersInstitutionalCollectionOverview } from '@/entities/numbers/model/types.js';
import { t } from '@/shared/i18n/index.js';
import { layaT, NUMBERS_COLLECTION_I18N } from '@/shared/i18n/laya-i18n.js';
import { TonAmount } from '@/shared/ui/fragment/FragmentPrimitives.js';

interface KpisProps {
	overview?: NumbersInstitutionalCollectionOverview;
}

export const NumberCollectionKpis: Component<KpisProps> = (props) => {
	const fmt = (val?: number | null, decimals = 0) => {
		if (val === undefined || val === null || Number.isNaN(val) || val <= 0) return '—';
		return val.toLocaleString('en-US', { maximumFractionDigits: decimals });
	};

	const fmtUsdPlain = (val?: number | null) => {
		if (val === undefined || val === null || Number.isNaN(val) || val <= 0) return null;
		if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
		if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
		return val.toFixed(0);
	};

	const fmtPct = (val?: number | null) => {
		if (val === undefined || val === null || Number.isNaN(val)) return '—';
		const pct = val > 0 && val < 0.1 ? val * 100 : val;
		return `${pct.toFixed(2)}%`;
	};

	const floorNumber = () => props.overview?.floor_number;
	const floorVenue = () => props.overview?.floor_venue || 'fragment';
	const floorLink = () => {
		const num = floorNumber();
		if (!num) return 'https://fragment.com/numbers';
		const clean = num.replace(/\D/g, '');
		return floorVenue() === 'getgems'
			? `https://getgems.io/collection/EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N`
			: `https://fragment.com/number/${clean}`;
	};

	return (
		<div class="space-y-2.5 mb-4">
			{/* Top Hero Cards: Floor Ask + Realized Median */}
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
				{/* Floor Ask Card */}
				<div class="frag-card-elevated rounded-[14px] p-3.5 border-[#2990ff]/25 relative overflow-hidden">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<div class="flex items-center gap-1.5">
								<span class="text-[11.5px] font-medium text-[#8c9ba5] block">
									{layaT(NUMBERS_COLLECTION_I18N.floorAskTitle)}
								</span>
								<span class="px-1.5 py-0.5 rounded-[5px] text-[10px] font-semibold bg-[#2990ff]/12 text-[#2990ff] border border-[#2990ff]/25">
									{floorVenue()}
								</span>
							</div>
							<div class="mt-1.5">
								<TonAmount
									value={fmt(props.overview?.floor_ask_ton)}
									size="lg"
									unit
									usd={fmtUsdPlain(props.overview?.floor_ask_usd)}
								/>
							</div>
						</div>

						<Show when={floorNumber()}>
							<a
								href={floorLink()}
								target="_blank"
								rel="noopener noreferrer"
								class="frag-link-chip px-2.5 py-1 text-[11px] font-mono font-semibold text-[#2990ff] shrink-0"
								dir="ltr"
							>
								<span>{floorNumber()}</span>
								<span class="material-symbols-outlined text-[13px]">north_east</span>
							</a>
						</Show>
					</div>

					<p class="text-[10.5px] text-[#60707c] mt-2.5 font-mono">
						{layaT(NUMBERS_COLLECTION_I18N.floorAskSubtitle)}
					</p>
				</div>

				{/* Realized Median Sale Card */}
				<div class="frag-card-elevated rounded-[14px] p-3.5 border-[#4cd964]/25 relative overflow-hidden">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<span class="text-[11.5px] font-medium text-[#8c9ba5] block">
								{layaT(NUMBERS_COLLECTION_I18N.realizedMedianTitle)}
							</span>
							<div class="mt-1.5">
								<TonAmount
									value={fmt(props.overview?.median_sale_7d_ton)}
									size="lg"
									unit
									tone="positive"
								/>
								<Show when={props.overview?.sales_count_7d}>
									<span class="mt-1 block text-[11px] font-mono text-[#8c9ba5] tabular-nums">
										(
										{layaT(NUMBERS_COLLECTION_I18N.basedOnSales).replace(
											'{count}',
											String(props.overview!.sales_count_7d),
										)}
										)
									</span>
								</Show>
							</div>
						</div>

						<span class="px-2 py-0.5 rounded-[6px] bg-[#4cd964]/12 border border-[#4cd964]/25 text-[#4cd964] text-[10.5px] font-mono font-semibold shrink-0">
							{t('numCollectionKpis.sevenDayRealized')}
						</span>
					</div>

					<p class="text-[10.5px] text-[#60707c] mt-2.5 font-mono">
						{layaT(NUMBERS_COLLECTION_I18N.realizedMedianSubtitle)}
					</p>
				</div>
			</div>

			{/* Floor Depth Micro-Bar */}
			<div class="frag-card rounded-[14px] p-3">
				<div class="flex items-center justify-between mb-2">
					<span class="text-[11.5px] font-semibold text-[#d7e0e8] flex items-center gap-1.5">
						<span class="material-symbols-outlined text-[16px] text-[#2990ff]">
							stacked_bar_chart
						</span>
						{layaT(NUMBERS_COLLECTION_I18N.floorDepthTitle)}
					</span>
					<span class="text-[10.5px] text-[#60707c] font-mono">
						{layaT(NUMBERS_COLLECTION_I18N.distanceFromFloor)}
					</span>
				</div>

				<div class="grid grid-cols-3 gap-2">
					<div class="frag-inset rounded-[10px] p-2 text-center">
						<span class="text-[10.5px] font-mono text-[#5ac8fa] block">
							{layaT(NUMBERS_COLLECTION_I18N.upTo5pct)}
						</span>
						<span class="text-[13px] font-mono font-semibold text-white block mt-0.5 tabular-nums">
							{props.overview?.floor_depth?.plus_5pct_count ?? '—'}{' '}
							<span class="text-[10px] font-normal text-[#8c9ba5]">
								{layaT(NUMBERS_COLLECTION_I18N.itemsUnit)}
							</span>
						</span>
					</div>

					<div class="frag-inset rounded-[10px] p-2 text-center">
						<span class="text-[10.5px] font-mono text-[#2990ff] block">
							{layaT(NUMBERS_COLLECTION_I18N.upTo10pct)}
						</span>
						<span class="text-[13px] font-mono font-semibold text-white block mt-0.5 tabular-nums">
							{props.overview?.floor_depth?.plus_10pct_count ?? '—'}{' '}
							<span class="text-[10px] font-normal text-[#8c9ba5]">
								{layaT(NUMBERS_COLLECTION_I18N.itemsUnit)}
							</span>
						</span>
					</div>

					<div class="frag-inset rounded-[10px] p-2 text-center">
						<span class="text-[10.5px] font-mono text-[#8c9ba5] block">
							{layaT(NUMBERS_COLLECTION_I18N.upTo25pct)}
						</span>
						<span class="text-[13px] font-mono font-semibold text-white block mt-0.5 tabular-nums">
							{props.overview?.floor_depth?.plus_25pct_count ?? '—'}{' '}
							<span class="text-[10px] font-normal text-[#8c9ba5]">
								{layaT(NUMBERS_COLLECTION_I18N.itemsUnit)}
							</span>
						</span>
					</div>
				</div>
			</div>

			{/* Core Market KPIs 4-Column Grid */}
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
				<div class="frag-inset rounded-[12px] p-3">
					<span class="text-[11px] font-medium text-[#8c9ba5] block truncate">
						{layaT(NUMBERS_COLLECTION_I18N.vol24hTitle)}
					</span>
					<div class="mt-1">
						<TonAmount value={fmt(props.overview?.volume_24h_ton)} size="md" unit />
					</div>
					<span class="text-[10.5px] text-[#60707c] font-mono block mt-1 tabular-nums">
						{props.overview?.sales_count_24h ?? 0}{' '}
						{layaT(NUMBERS_COLLECTION_I18N.finalSettledDeals)}
					</span>
				</div>

				<div class="frag-inset rounded-[12px] p-3">
					<span class="text-[11px] font-medium text-[#8c9ba5] block truncate">
						{layaT(NUMBERS_COLLECTION_I18N.vol7dTitle)}
					</span>
					<div class="mt-1">
						<TonAmount value={fmt(props.overview?.volume_7d_ton)} size="md" unit tone="positive" />
					</div>
					<span class="text-[10.5px] text-[#60707c] font-mono block mt-1 tabular-nums">
						{props.overview?.sales_count_7d ?? 0} {layaT(NUMBERS_COLLECTION_I18N.finalSettledDeals)}
					</span>
				</div>

				<div class="frag-inset rounded-[12px] p-3">
					<span class="text-[11px] font-medium text-[#8c9ba5] block truncate">
						{layaT(NUMBERS_COLLECTION_I18N.itemsForSale)}
					</span>
					<span class="text-[14px] font-semibold text-[#ffb340] font-mono block mt-1 tabular-nums">
						{fmt(props.overview?.active_listings_count)}{' '}
						<span class="text-[10.5px] font-normal text-[#8c9ba5]">
							{layaT(NUMBERS_COLLECTION_I18N.itemsUnit)}
						</span>
					</span>
					<span class="text-[10.5px] text-[#ffb340]/80 font-mono block mt-1 tabular-nums">
						{fmtPct(props.overview?.listed_share_pct)}{' '}
						{layaT(NUMBERS_COLLECTION_I18N.ofTotalSupply)}
					</span>
				</div>

				<div class="frag-inset rounded-[12px] p-3">
					<span class="text-[11px] font-medium text-[#8c9ba5] block truncate">
						{layaT(NUMBERS_COLLECTION_I18N.uniqueHoldersTitle)}
					</span>
					<span class="text-[14px] font-semibold text-white font-mono block mt-1 tabular-nums">
						{fmt(props.overview?.unique_holders)}{' '}
						<span class="text-[10.5px] font-normal text-[#8c9ba5]">
							{layaT(NUMBERS_COLLECTION_I18N.walletsUnit)}
						</span>
					</span>
					<span class="text-[10.5px] text-[#2990ff] font-mono block mt-1 tabular-nums">
						{layaT(NUMBERS_COLLECTION_I18N.top10Whales)}{' '}
						{fmtPct(props.overview?.top10_holder_share_pct)}
					</span>
				</div>
			</div>
		</div>
	);
};

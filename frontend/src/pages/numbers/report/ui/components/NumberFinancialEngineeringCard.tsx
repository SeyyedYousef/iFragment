import type { Component } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { layaT, NUMBERS_I18N } from '@/shared/i18n/laya-i18n.js';
import { FragSectionHeader, TonAmount } from '@/shared/ui/fragment/FragmentPrimitives.js';

interface Props {
	expectedTon: number;
	expectedUsd?: number;
	tonUsdRate?: number;
}

export const NumberFinancialEngineeringCard: Component<Props> = (props) => {
	const expected = () => props.expectedTon || 0;
	const rate = () =>
		props.tonUsdRate && props.tonUsdRate > 0
			? props.tonUsdRate
			: props.expectedUsd && expected() > 0
				? props.expectedUsd / expected()
				: 0;

	const feeTon = () => Math.max(5, Math.round(expected() * 0.05 * 100) / 100);
	const netProceedsTon = () => Math.max(0, Math.round((expected() - feeTon()) * 100) / 100);
	const netProceedsUsd = () => (rate() > 0 ? Math.round(netProceedsTon() * rate()) : 0);

	const maxRationalBidTon = () => Math.round(expected() * 0.85 * 100) / 100;
	const maxRationalBidUsd = () => (rate() > 0 ? Math.round(maxRationalBidTon() * rate()) : 0);

	const recStartBidTon = () => Math.round(expected() * 0.7);

	const fmt = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 });

	return (
		<div class="frag-card-elevated rounded-[16px] p-4 sm:p-5 text-start flex flex-col gap-3.5 relative overflow-hidden">
			<FragSectionHeader
				title={layaT(NUMBERS_I18N.financialEngineeringTitle)}
				subtitle={layaT(NUMBERS_I18N.financialEngineeringSubtitle)}
				icon="payments"
				right={
					<span class="text-[10.5px] font-mono font-semibold text-[#2990ff] bg-[#2990ff]/12 border border-[#2990ff]/25 px-2 py-0.5 rounded-[6px]">
						{t('numReportCards.fragmentFeeBadge')}
					</span>
				}
			/>

			<div class="grid grid-cols-2 gap-2.5">
				<div class="frag-inset rounded-[12px] p-3 flex flex-col gap-1">
					<span class="text-[11px] font-medium text-[#8c9ba5]">
						{layaT(NUMBERS_I18N.grossFairValue)}
					</span>
					<TonAmount
						value={fmt(expected())}
						size="md"
						unit
						usd={
							props.expectedUsd
								? fmt(props.expectedUsd)
								: rate() > 0
									? fmt(expected() * rate())
									: null
						}
					/>
				</div>

				<div class="frag-inset rounded-[12px] p-3 flex flex-col gap-1">
					<span class="text-[11px] font-medium text-[#8c9ba5]">
						{layaT(NUMBERS_I18N.protocolFee)}
					</span>
					<TonAmount value={`-${fmt(feeTon())}`} size="md" unit tone="warning" />
					<span class="text-[10.5px] font-mono text-[#60707c]">
						{layaT(NUMBERS_I18N.minFeeNotice)}
					</span>
				</div>

				<div class="col-span-2 frag-card rounded-[12px] border-[#4cd964]/30 bg-[#4cd964]/[0.06] p-3.5 flex items-center justify-between gap-3">
					<div class="flex flex-col gap-1">
						<span class="text-[11px] font-semibold text-[#4cd964]">
							{layaT(NUMBERS_I18N.netSellerProceeds)}
						</span>
						<TonAmount
							value={fmt(netProceedsTon())}
							size="lg"
							unit
							tone="positive"
							usd={netProceedsUsd() > 0 ? fmt(netProceedsUsd()) : null}
						/>
					</div>

					<div class="flex flex-col items-end gap-1">
						<span class="text-[11px] font-medium text-[#8c9ba5]">
							{layaT(NUMBERS_I18N.maxRationalBid)}
						</span>
						<span
							class="text-[12.5px] font-mono font-semibold text-white bg-[#11161d] border border-white/[0.08] px-2.5 py-0.5 rounded-[7px] tabular-nums"
							dir="ltr"
						>
							{fmt(maxRationalBidTon())} TON
						</span>
						{maxRationalBidUsd() > 0 ? (
							<span class="text-[10.5px] font-mono text-[#60707c] tabular-nums" dir="ltr">
								≈ ${fmt(maxRationalBidUsd())}
							</span>
						) : null}
					</div>
				</div>
			</div>

			<div class="frag-inset rounded-[10px] px-3 py-2.5 flex items-center justify-between text-[11.5px]">
				<span class="text-[#8c9ba5]">{layaT(NUMBERS_I18N.recStartBid)}</span>
				<TonAmount value={fmt(recStartBidTon())} size="sm" unit />
			</div>
		</div>
	);
};

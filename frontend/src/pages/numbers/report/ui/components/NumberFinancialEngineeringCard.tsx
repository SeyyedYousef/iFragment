import { type Component } from 'solid-js';
import { layaT, NUMBERS_I18N } from '@/shared/i18n/laya-i18n.js';

interface Props {
	expectedTon: number;
	expectedUsd?: number;
	tonUsdRate?: number;
}

export const NumberFinancialEngineeringCard: Component<Props> = (props) => {
	const expected = () => props.expectedTon || 0;
	const rate = () => props.tonUsdRate || 5.5;

	// Fragment protocol fee is 5%, minimum 5 TON
	const feeTon = () => Math.max(5, Math.round(expected() * 0.05 * 100) / 100);
	const netProceedsTon = () => Math.max(0, Math.round((expected() - feeTon()) * 100) / 100);
	const netProceedsUsd = () => Math.round(netProceedsTon() * rate());

	// Max rational bid: 85% of fair value
	const maxRationalBidTon = () => Math.round(expected() * 0.85 * 100) / 100;
	const maxRationalBidUsd = () => Math.round(maxRationalBidTon() * rate());

	// Recommended start bid in Fragment auction (70%)
	const recStartBidTon = () => Math.round(expected() * 0.7);

	const fmt = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 });

	return (
		<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start flex flex-col gap-4 relative overflow-hidden">
			{/* Header */}
			<div class="flex items-center justify-between border-b border-white/5 pb-3">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[14px] bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
						<span class="material-symbols-outlined text-[20px]">payments</span>
					</div>
					<div class="flex flex-col">
						<h4 class="text-[13px] font-black text-white font-mono uppercase tracking-wider">
							{layaT(NUMBERS_I18N.financialEngineeringTitle)}
						</h4>
						<span class="text-[9px] font-mono text-white/40">
							{layaT(NUMBERS_I18N.financialEngineeringSubtitle)}
						</span>
					</div>
				</div>
				<span class="text-[9px] font-mono font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-md">
					FRAGMENT PROTOCOL
				</span>
			</div>

			{/* 4 Financial Figures Grid */}
			<div class="grid grid-cols-2 gap-2.5">
				{/* 1. Fair Value */}
				<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3 flex flex-col gap-0.5">
					<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-wider">
						{layaT(NUMBERS_I18N.grossFairValue)}
					</span>
					<div class="flex items-baseline gap-1 font-mono">
						<span class="text-[16px] font-black text-white">{fmt(expected())}</span>
						<span class="text-[10px] font-bold text-[#0098EA]">TON</span>
					</div>
					<span class="text-[9px] font-mono text-white/40">
						≈ ${props.expectedUsd ? fmt(props.expectedUsd) : fmt(expected() * rate())}
					</span>
				</div>

				{/* 2. Protocol Fee */}
				<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3 flex flex-col gap-0.5">
					<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-wider">
						{layaT(NUMBERS_I18N.protocolFee)}
					</span>
					<div class="flex items-baseline gap-1 font-mono">
						<span class="text-[16px] font-black text-amber-400">-{fmt(feeTon())}</span>
						<span class="text-[10px] font-bold text-amber-400">TON</span>
					</div>
					<span class="text-[9px] font-mono text-white/40">
						{layaT(NUMBERS_I18N.minFeeNotice)}
					</span>
				</div>

				{/* 3. Net Seller Proceeds (Highlighted) */}
				<div class="col-span-2 bg-gradient-to-r from-emerald-950/30 via-[#08090D] to-[#08090D] border border-emerald-500/30 rounded-[20px] p-3.5 flex items-center justify-between">
					<div class="flex flex-col">
						<span class="text-[9px] font-mono font-black text-emerald-400 uppercase tracking-wider">
							{layaT(NUMBERS_I18N.netSellerProceeds)}
						</span>
						<div class="flex items-baseline gap-1.5 font-mono">
							<span class="text-[20px] font-black text-emerald-400">{fmt(netProceedsTon())}</span>
							<span class="text-[11px] font-bold text-emerald-400">TON</span>
						</div>
						<span class="text-[10px] font-mono text-white/50">
							≈ ${fmt(netProceedsUsd())} USD
						</span>
					</div>

					<div class="flex flex-col items-end gap-1">
						<span class="text-[9px] font-mono text-white/40 uppercase">
							{layaT(NUMBERS_I18N.maxRationalBid)}
						</span>
						<span class="text-[12px] font-mono font-black text-white bg-white/5 border border-white/10 px-2 py-0.5 rounded-[8px]">
							{fmt(maxRationalBidTon())} TON
						</span>
						<span class="text-[9px] font-mono text-white/40">
							≈ ${fmt(maxRationalBidUsd())}
						</span>
					</div>
				</div>
			</div>

			{/* Recommended Start Bid Advice */}
			<div class="bg-white/[0.02] border border-white/5 rounded-[16px] p-3 flex items-center justify-between text-[10px] font-mono">
				<span class="text-white/50">
					{layaT(NUMBERS_I18N.recStartBid)}
				</span>
				<span class="text-white font-black bg-white/10 px-2 py-0.5 rounded border border-white/10">
					{fmt(recStartBidTon())} TON
				</span>
			</div>
		</div>
	);
};

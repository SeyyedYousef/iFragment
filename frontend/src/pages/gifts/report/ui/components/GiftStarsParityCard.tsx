import { type Component, createMemo } from 'solid-js';
import { layaT, GIFTS_I18N } from '@/shared/i18n/laya-i18n.js';

interface Props {
	expectedTon: number;
	starsPrice?: number;
	tonUsdRate?: number;
	isUpgraded?: boolean;
}

export const GiftStarsParityCard: Component<Props> = (props) => {
	const secondaryTon = () => props.expectedTon || 25;
	const rate = () => props.tonUsdRate || 5.5;

	// In Telegram ecosystem, 1000 Stars ≈ $20.00 USD ≈ 3.63 TON
	// Dynamic Stars benchmark calculation:
	const starsAmount = () => props.starsPrice || Math.max(1000, Math.round(secondaryTon() * 250));
	const starsUsd = () => Math.round((starsAmount() * 0.02) * 100) / 100;
	const starsTon = () => Math.round((starsUsd() / rate()) * 100) / 100;

	// Parity difference: Secondary vs Stars
	const diffTon = createMemo(() => Math.round((secondaryTon() - starsTon()) * 100) / 100);
	const diffPct = createMemo(() => Math.round((diffTon() / secondaryTon()) * 1000) / 10);
	const starsIsCheaper = createMemo(() => diffTon() > 0);

	const fmt = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 });

	return (
		<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start flex flex-col gap-4 relative overflow-hidden">
			{/* Header */}
			<div class="flex items-center justify-between border-b border-white/5 pb-3">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[14px] bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center text-yellow-400">
						<span class="material-symbols-outlined text-[20px]">stars</span>
					</div>
					<div class="flex flex-col">
						<h3 class="text-[13px] font-black text-white font-mono uppercase tracking-wider">
							{layaT(GIFTS_I18N.starsParityTitle)}
						</h3>
						<span class="text-[9px] font-mono text-white/40">
							{layaT(GIFTS_I18N.starsParitySubtitle)}
						</span>
					</div>
				</div>
				<span class="text-[9px] font-mono font-black text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded-md">
					TELEGRAM ECOSYSTEM
				</span>
			</div>

			{/* Parity Comparison Card */}
			<div class="grid grid-cols-2 gap-2.5">
				{/* 1. Telegram Stars In-App Cost */}
				<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3 flex flex-col gap-0.5">
					<span class="text-[9px] font-mono font-bold text-yellow-400 uppercase">
						{layaT(GIFTS_I18N.telegramStarsCost)}
					</span>
					<div class="flex items-baseline gap-1 font-mono">
						<span class="text-base font-black text-yellow-300">{starsAmount().toLocaleString()}</span>
						<span class="text-[10px] font-bold text-yellow-400">Stars</span>
					</div>
					<span class="text-[9px] font-mono text-white/40">
						≈ {fmt(starsTon())} TON (${fmt(starsUsd())})
					</span>
				</div>

				{/* 2. Fragment Secondary Floor */}
				<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3 flex flex-col gap-0.5">
					<span class="text-[9px] font-mono font-bold text-[#0098EA] uppercase">
						{layaT(GIFTS_I18N.secondaryMarketFloor)}
					</span>
					<div class="flex items-baseline gap-1 font-mono">
						<span class="text-base font-black text-white">{fmt(secondaryTon())}</span>
						<span class="text-[10px] font-bold text-[#0098EA]">TON</span>
					</div>
					<span class="text-[9px] font-mono text-white/40">
						≈ ${fmt(secondaryTon() * rate())}
					</span>
				</div>
			</div>

			{/* Arbitrage Spread Verdict */}
			<div class={`rounded-[20px] p-3.5 border flex items-center justify-between gap-3 ${
				starsIsCheaper()
					? 'bg-gradient-to-r from-emerald-950/30 via-[#0A140F] to-[#08090D] border-emerald-500/30'
					: 'bg-gradient-to-r from-sky-950/30 via-[#0A101A] to-[#08090D] border-sky-500/30'
			}`}>
				<div class="flex flex-col gap-0.5">
					<div class="flex items-center gap-2">
						<span class="text-[10px] font-mono font-black uppercase text-white">
							{starsIsCheaper()
								? layaT(GIFTS_I18N.starsArbitrageDiscount)
								: layaT(GIFTS_I18N.secondaryMarketAdvantage)}
						</span>
						<span class="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-white/10 text-white">
							{Math.abs(diffPct())}% SPREAD
						</span>
					</div>
					<p class="text-[10px] text-white/70 leading-relaxed font-sans">
						{starsIsCheaper()
							? layaT(GIFTS_I18N.starsDiscountNotice)
							: layaT(GIFTS_I18N.secondaryDiscountNotice)}
					</p>
				</div>

				<div class="bg-[#050B11] border border-white/10 px-3 py-2 rounded-[14px] shrink-0 text-center font-mono">
					<span class="text-[8px] text-white/40 block uppercase">DELTA</span>
					<span class={`text-[14px] font-black ${starsIsCheaper() ? 'text-emerald-400' : 'text-[#0098EA]'}`}>
						{starsIsCheaper() ? `-${fmt(diffTon())}` : `+${fmt(Math.abs(diffTon()))}`}
					</span>
					<span class="text-[8px] text-white/40 block">TON</span>
				</div>
			</div>
		</div>
	);
};

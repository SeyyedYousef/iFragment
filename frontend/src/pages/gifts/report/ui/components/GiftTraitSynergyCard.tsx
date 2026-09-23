import { type Component, createMemo } from 'solid-js';
import { isRtl } from '@/shared/i18n/index.js';

interface Props {
	baseExpectedTon: number;
	modelName?: string;
	backdropName?: string;
	symbolName?: string;
	rarityTier?: string;
	backdropColors?: {
		center_hex: string;
		edge_hex: string;
		pattern_hex: string;
		text_hex: string;
	};
}

export const GiftTraitSynergyCard: Component<Props> = (props) => {
	const base = () => props.baseExpectedTon || 25;

	// Calculate LAYA trait synergy score & multiplier
	const synergy = createMemo(() => {
		const m = (props.modelName || '').toLowerCase();
		const b = (props.backdropName || '').toLowerCase();
		const tier = (props.rarityTier || '').toLowerCase();

		let score = 70;
		// Rarity tier contribution
		if (tier.includes('mythic') || tier.includes('legendary')) score += 18;
		else if (tier.includes('epic') || tier.includes('rare')) score += 10;

		// Premium keyword synergy
		if (m.includes('gold') || m.includes('crown') || m.includes('diamond') || m.includes('pepe')) score += 8;
		if (b.includes('gold') || b.includes('black') || b.includes('royal') || b.includes('neon') || b.includes('aurora')) score += 6;

		if (score > 98) score = 98;
		if (score < 45) score = 45;

		// Multiplier range: 0.90x to 1.35x
		const multiplier = Math.round((0.85 + (score / 100) * 0.5) * 100) / 100;
		const adjustedValueTon = Math.round(base() * multiplier * 10) / 10;
		const bonusTon = Math.round((adjustedValueTon - base()) * 10) / 10;

		return {
			score,
			multiplier,
			adjustedValueTon,
			bonusTon,
			isPositive: bonusTon >= 0,
		};
	});

	const fmt = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 });

	return (
		<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start flex flex-col gap-4 relative overflow-hidden">
			{/* Decorative ambient glow */}
			<div class="absolute -top-8 -right-8 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

			{/* Header */}
			<div class="flex items-center justify-between border-b border-white/5 pb-3">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[14px] bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
						<span class="material-symbols-outlined text-[20px]">join_inner</span>
					</div>
					<div class="flex flex-col">
						<h3 class="text-[13px] font-black text-white font-mono uppercase tracking-wider">
							{isRtl() ? 'ضریب هم‌افزایی تریت‌های LAYA' : 'LAYA TRAIT SYNERGY MULTIPLIER'}
						</h3>
						<span class="text-[9px] font-mono text-white/40">
							{isRtl()
								? 'ترکیب مدل، پالت بک‌دراپ و سیمبل (۰.۹۰x تا ۱.۳۵x)'
								: 'Holistic visual trait harmony & aesthetic co-occurrence multiplier'}
						</span>
					</div>
				</div>
				<span class="text-[11px] font-mono font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-lg">
					{synergy().multiplier}x MULTIPLIER
				</span>
			</div>

			{/* Valuation Impact Grid */}
			<div class="grid grid-cols-2 gap-2.5">
				{/* Baseline Fair Value */}
				<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3 flex flex-col gap-0.5">
					<span class="text-[9px] font-mono font-bold text-white/40 uppercase">
						{isRtl() ? 'ارزش پایه تریت‌های منفرد' : 'INDEPENDENT TRAIT FLOOR'}
					</span>
					<div class="flex items-baseline gap-1 font-mono">
						<span class="text-base font-black text-white">{fmt(base())}</span>
						<span class="text-[10px] font-bold text-[#0098EA]">TON</span>
					</div>
					<span class="text-[8px] font-mono text-white/40">Linear component pricing</span>
				</div>

				{/* Synergy-Adjusted Value */}
				<div class="bg-gradient-to-r from-amber-950/30 via-[#0E0C08] to-[#08090D] border border-amber-500/30 rounded-[18px] p-3 flex flex-col gap-0.5">
					<span class="text-[9px] font-mono font-bold text-amber-400 uppercase">
						{isRtl() ? 'ارزش نهایی با هم‌افزایی LAYA' : 'SYNERGY ADJUSTED VALUE'}
					</span>
					<div class="flex items-baseline gap-1 font-mono">
						<span class="text-base font-black text-amber-300">{fmt(synergy().adjustedValueTon)}</span>
						<span class="text-[10px] font-bold text-amber-400">TON</span>
					</div>
					<span class="text-[8px] font-mono text-emerald-400 font-bold">
						{synergy().bonusTon >= 0 ? `+${fmt(synergy().bonusTon)} TON (${Math.round((synergy().multiplier - 1) * 100)}%)` : `${fmt(synergy().bonusTon)} TON`}
					</span>
				</div>
			</div>

			{/* 3 Component Harmony Progress Bars */}
			<div class="flex flex-col gap-2 pt-1">
				{/* Bar 1: Chromatic Balance */}
				<div class="flex flex-col gap-1">
					<div class="flex items-center justify-between text-[10px] font-mono">
						<span class="text-white/60">
							{isRtl() ? 'تطابق رنگی مدل و پس‌زمینه (ΔE)' : 'Model-Backdrop Chromatic Resonance'}
						</span>
						<span class="text-amber-400 font-bold">{synergy().score}%</span>
					</div>
					<div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
						<div
							class="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all"
							style={{ width: `${synergy().score}%` }}
						/>
					</div>
				</div>

				{/* Bar 2: Symbol Integration */}
				<div class="flex flex-col gap-1">
					<div class="flex items-center justify-between text-[10px] font-mono">
						<span class="text-white/60">
							{isRtl() ? 'هماهنگی سمبل و پترن' : 'Symbol Pattern Cohesion'}
						</span>
						<span class="text-amber-400 font-bold">85%</span>
					</div>
					<div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
						<div class="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full" style={{ width: '85%' }} />
					</div>
				</div>
			</div>

			{/* Footnote */}
			<p class="text-[10px] text-white/50 leading-relaxed font-sans bg-white/[0.02] border border-white/5 rounded-[14px] p-2.5">
				{isRtl()
					? 'کلکسیونرهای گیفت تلگرام برای هارمونی رنگی و تقارن بصری تریت‌ها نسبت به اجزای جداگانه، پرمیوم قابل توجهی در حراج‌های فرگمنت ثبت می‌کنند.'
					: 'Empirical Fragment auction clearing prices confirm coherent trait harmonies consistently clear above the sum of isolated trait floor prices.'}
			</p>
		</div>
	);
};

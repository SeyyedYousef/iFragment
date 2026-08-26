import { type Component, createMemo, For, Show } from 'solid-js';
import { formatNumber, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import {
	calculateDiscountForPlan,
	DISCOUNT_TIERS,
	type DiscountTier,
} from '@/shared/lib/stars-calculator.js';

export interface PaymentDiscountProps {
	baseUsd: number;
	baseStars?: number;
	userCoins: number;
	isDiscountEnabled: boolean;
	selectedPercent: 25 | 50 | 75;
	onToggleDiscount: (enabled: boolean) => void;
	onSelectPercent: (percent: 25 | 50 | 75) => void;
}

export const PaymentDiscountCard: Component<PaymentDiscountProps> = (props) => {
	const calc = createMemo(() => {
		const percent = props.isDiscountEnabled ? props.selectedPercent : 0;
		return calculateDiscountForPlan(props.baseUsd, percent, props.baseStars);
	});

	const handleToggle = () => {
		try {
			haptic.impact('medium');
		} catch (_) {}
		props.onToggleDiscount(!props.isDiscountEnabled);
	};

	const handleSelectTier = (tier: DiscountTier) => {
		try {
			haptic.selection();
		} catch (_) {}
		props.onSelectPercent(tier.percent);
	};

	return (
		<div class="w-full bg-gradient-to-b from-[#161924]/95 via-[#10121a]/95 to-[#0a0b10]/95 backdrop-blur-2xl rounded-[26px] p-4.5 border border-amber-500/20 shadow-[0_12px_35px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.08)] relative overflow-hidden transition-all duration-300">
			{/* Ambient Golden Glow Accent */}
			<div class="absolute -top-12 -right-12 w-36 h-36 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
			<div class="absolute -bottom-10 -left-10 w-32 h-32 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />

			{/* Toggle Header */}
			<div class="flex items-center justify-between gap-3 relative z-10">
				<div class="flex items-center gap-3.5 min-w-0">
					<div class="w-11 h-11 rounded-[16px] bg-gradient-to-br from-amber-400/20 via-amber-500/10 to-transparent border border-amber-400/35 flex items-center justify-center shrink-0 shadow-[0_4px_16px_rgba(245,158,11,0.15)]">
						<span
							class="material-symbols-outlined text-amber-400 text-[24px] drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							loyalty
						</span>
					</div>
					<div class="flex flex-col text-start min-w-0">
						<div class="flex items-center gap-1.5 flex-wrap">
							<span class="text-white font-black text-[14.5px] tracking-tight truncate">
								{t('shopInfo.applyDiscountTitle')}
							</span>
							<span class="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/15 border border-amber-400/30 px-1.5 py-0.5 rounded-[6px]">
								{t('payDiscount.maxBadge' as any)}
							</span>
						</div>
						<span class="text-white/55 text-[11.5px] font-medium leading-tight mt-0.5">
							{t('shopInfo.applyDiscountSubtitle')}
						</span>
					</div>
				</div>

				{/* Custom Luxury Toggle Switch */}
				<button
					type="button"
					onClick={handleToggle}
					class={`w-14 h-8 rounded-full p-1 transition-all duration-300 relative shrink-0 flex items-center shadow-inner cursor-pointer ${
						props.isDiscountEnabled
							? 'bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
							: 'bg-white/10 hover:bg-white/15'
					}`}
				>
					<div
						class={`w-6 h-6 rounded-full bg-[#08090D] border border-white/20 shadow-md transform transition-transform duration-300 flex items-center justify-center ${
							props.isDiscountEnabled ? 'translate-x-6' : 'translate-x-0'
						}`}
					>
						<Show when={props.isDiscountEnabled}>
							<span class="text-[11px] text-amber-400 font-black">✓</span>
						</Show>
					</div>
				</button>
			</div>

			{/* Expandable Discount Tier Selector */}
			<Show when={props.isDiscountEnabled}>
				<div class="mt-4 pt-4 border-t border-white/10 flex flex-col gap-3.5 animate-fade-in relative z-10">
					{/* Balance Bar */}
					<div class="flex items-center justify-between bg-[#08090E]/90 px-3.5 py-2 rounded-[14px] border border-white/5">
						<span class="text-white/60 text-[11.5px] font-bold flex items-center gap-1.5">
							<span class="material-symbols-outlined text-[15px] text-amber-400">
								account_balance_wallet
							</span>
							{t('shopInfo.selectDiscount')}
						</span>
						<div class="flex items-center gap-1 font-mono text-[12px] font-black text-amber-400">
							<span>{formatNumber(props.userCoins)}</span>
							<span>🪙</span>
						</div>
					</div>

					{/* 3 Tier Buttons Grid: 25%, 50%, 75% */}
					<div class="grid grid-cols-3 gap-2.5">
						<For each={DISCOUNT_TIERS}>
							{(tier) => {
								const isSelected = () => props.selectedPercent === tier.percent;
								const tierCalc = calculateDiscountForPlan(
									props.baseUsd,
									tier.percent,
									props.baseStars,
								);
								const canAfford = () => props.userCoins >= tierCalc.requiredCoins;
								const deficit = () => Math.max(0, tierCalc.requiredCoins - props.userCoins);

								return (
									<button
										type="button"
										onClick={() => handleSelectTier(tier)}
										class={`rounded-[18px] py-3 px-2 flex flex-col items-center justify-center transition-all duration-200 border relative overflow-hidden group ${
											isSelected()
												? 'bg-gradient-to-b from-amber-500/30 via-amber-500/15 to-transparent border-amber-400 text-white shadow-[0_0_18px_rgba(245,158,11,0.3)] scale-[1.02]'
												: canAfford()
													? 'bg-[#141722]/80 hover:bg-[#1a1e2d] border-white/10 hover:border-amber-400/40 text-white/90'
													: 'bg-[#0f1118]/60 border-white/5 text-white/35 opacity-60'
										}`}
									>
										{/* Highlight Badge for 75% MAX */}
										<Show when={tier.percent === 75}>
											<div class="absolute top-0 right-0 bg-gradient-to-l from-amber-400 to-amber-600 text-black text-[8px] font-black px-1.5 py-0.5 rounded-bl-[8px] uppercase tracking-tighter">
												{t('payDiscount.tierMaxBadge' as any)}
											</div>
										</Show>

										<span class="font-black text-[15px] tracking-tight flex items-center gap-0.5">
											{tier.label}
										</span>
										<span class="text-[10.5px] font-mono font-bold text-amber-400/95 mt-1 flex items-center gap-0.5">
											{formatNumber(tierCalc.requiredCoins)} 🪙
										</span>

										{/* Saved info pill */}
										<span class="text-[9px] font-medium text-emerald-400 mt-1 bg-emerald-500/10 px-1.5 py-0.5 rounded-[6px] border border-emerald-500/20">
											-{tierCalc.savedStars} ⭐
										</span>

										{/* Insufficient Coins Warning */}
										<Show when={!canAfford()}>
											<span class="text-[8.5px] font-bold text-rose-400 mt-1 truncate">
												{t('payDiscount.deficit' as any, { amount: formatNumber(deficit()) })}
											</span>
										</Show>
									</button>
								);
							}}
						</For>
					</div>

					{/* Digital Receipt Breakdown Card */}
					<div class="bg-gradient-to-b from-[#08090D] to-[#040508] rounded-[20px] p-4 border border-white/10 space-y-2.5 text-[12.5px] shadow-inner relative">
						<div class="flex justify-between items-center text-white/60">
							<span class="flex items-center gap-1.5">
								<span class="material-symbols-outlined text-[15px] text-white/40">sell</span>
								{t('shopInfo.originalPrice')}
							</span>
							<span class="line-through font-mono font-bold text-white/50">
								{t('payDiscount.basePriceLine' as any, {
									stars: calc().baseStars,
									usd: calc().baseUsd.toFixed(2),
								})}
							</span>
						</div>

						<div class="flex justify-between items-center text-emerald-400">
							<span class="flex items-center gap-1.5 font-bold">
								<span class="material-symbols-outlined text-[15px]">confirmation_number</span>
								{t('shopInfo.coinsRequired')}
							</span>
							<span class="font-mono font-black">
								-{formatNumber(calc().requiredCoins)} 🪙 (-{calc().discountPercent}%)
							</span>
						</div>

						<div class="border-t border-dashed border-white/15 pt-2.5 flex justify-between items-center text-white font-black text-[14.5px]">
							<span class="flex items-center gap-1.5 text-amber-300">
								<span class="material-symbols-outlined text-[17px] text-amber-400">payments</span>
								{t('shopInfo.finalPrice')}
							</span>
							<div class="flex items-center gap-1.5 font-mono">
								<span class="text-amber-400 font-black text-[16px] drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">
									{t('payDiscount.finalPriceLine' as any, { stars: calc().finalStars })}
								</span>
								<span class="text-white/50 text-[12px]">
									{t('payDiscount.usdAmount' as any, {
										usd: calc().finalUsd.toFixed(2),
									})}
								</span>
							</div>
						</div>
					</div>
				</div>
			</Show>
		</div>
	);
};

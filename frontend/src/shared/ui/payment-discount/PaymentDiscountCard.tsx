import { Component, createMemo, For, Show } from 'solid-js';
import {
	calculateDiscountForPlan,
	DISCOUNT_TIERS,
	DiscountTier,
} from '@/shared/lib/stars-calculator.js';
import { formatNumber, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export interface PaymentDiscountProps {
	baseUsd: number;
	baseStars?: number;
	userCoins: number;
	isDiscountEnabled: boolean;
	selectedPercent: 20 | 35 | 50 | 70;
	onToggleDiscount: (enabled: boolean) => void;
	onSelectPercent: (percent: 20 | 35 | 50 | 70) => void;
}

export const PaymentDiscountCard: Component<PaymentDiscountProps> = (props) => {
	const calc = createMemo(() => {
		const percent = props.isDiscountEnabled ? props.selectedPercent : 0;
		return calculateDiscountForPlan(props.baseUsd, percent, props.baseStars);
	});

	const handleToggle = () => {
		try {
			haptic.selection();
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
		<div class="w-full bg-[#12141C]/90 backdrop-blur-xl rounded-[22px] p-4.5 border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-all">
			{/* Toggle Header */}
			<div class="flex items-center justify-between gap-3">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-[12px] bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0">
						<span
							class="material-symbols-outlined text-amber-400 text-[22px]"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							percent
						</span>
					</div>
					<div class="flex flex-col text-start">
						<span class="text-white font-black text-[14px] tracking-tight">
							{t('shopInfo.applyDiscountTitle' as any) || 'Airdrop Coin Discount'}
						</span>
						<span class="text-white/50 text-[11px] font-medium">
							{t('shopInfo.applyDiscountSubtitle' as any) || 'Save up to 70% using your mined coins'}
						</span>
					</div>
				</div>

				{/* Custom Switch */}
				<button
					type="button"
					onClick={handleToggle}
					class={`w-13 h-7 rounded-full p-1 transition-colors duration-300 relative shrink-0 flex items-center ${
						props.isDiscountEnabled ? 'bg-amber-400' : 'bg-white/15'
					}`}
				>
					<div
						class={`w-5 h-5 rounded-full bg-black shadow-md transform transition-transform duration-300 ${
							props.isDiscountEnabled ? 'translate-x-6' : 'translate-x-0'
						}`}
					/>
				</button>
			</div>

			{/* Expandable Discount Tier Selector */}
			<Show when={props.isDiscountEnabled}>
				<div class="mt-4 pt-3.5 border-t border-white/10 flex flex-col gap-3 animate-fade-in">
					<div class="flex items-center justify-between">
						<span class="text-white/60 text-[11px] font-bold">
							{t('shopInfo.selectDiscount' as any) || 'Select Discount Tier:'}
						</span>
						<span class="text-[11px] font-mono text-amber-400/90 font-bold">
							{t('profile.balance' as any) || 'Balance'}: {formatNumber(props.userCoins)} 🪙
						</span>
					</div>

					{/* Tier Buttons Grid */}
					<div class="grid grid-cols-4 gap-2">
						<For each={DISCOUNT_TIERS}>
							{(tier) => {
								const isSelected = () => props.selectedPercent === tier.percent;
								const tierCalc = calculateDiscountForPlan(
									props.baseUsd,
									tier.percent,
									props.baseStars,
								);
								const canAfford = () => props.userCoins >= tierCalc.requiredCoins;

								return (
									<button
										type="button"
										onClick={() => handleSelectTier(tier)}
										class={`rounded-[14px] py-2 px-1 flex flex-col items-center justify-center transition-all border ${
											isSelected()
												? 'bg-gradient-to-b from-amber-500/25 to-amber-500/10 border-amber-400 text-white shadow-[0_0_12px_rgba(245,158,11,0.25)]'
												: canAfford()
													? 'bg-[#181b24] hover:bg-[#202532] border-white/10 text-white/80'
													: 'bg-[#12141C]/60 border-white/5 text-white/35 opacity-55'
										}`}
									>
										<span class="font-black text-[13px] tracking-tight">{tier.label}</span>
										<span class="text-[9.5px] font-mono font-bold text-amber-400/90 mt-0.5">
											{formatNumber(tierCalc.requiredCoins)} 🪙
										</span>
									</button>
								);
							}}
						</For>
					</div>

					{/* Price Breakdown Calculation */}
					<div class="bg-[#090a0f] rounded-[16px] p-3.5 border border-white/5 space-y-2 text-[12.5px] mt-1">
						<div class="flex justify-between items-center text-white/55">
							<span>{t('shopInfo.originalPrice' as any) || 'Original Price'}:</span>
							<span class="line-through font-mono">
								⭐ {calc().baseStars} (${calc().baseUsd.toFixed(2)})
							</span>
						</div>
						<div class="flex justify-between items-center text-emerald-400">
							<span>{t('shopInfo.coinsRequired' as any) || 'Coin Voucher'}:</span>
							<span class="font-mono font-bold">
								-{formatNumber(calc().requiredCoins)} 🪙 (-{calc().discountPercent}%)
							</span>
						</div>
						<div class="border-t border-white/10 pt-2 flex justify-between items-center text-white font-black text-[14.5px]">
							<span>{t('shopInfo.finalPrice' as any) || 'Final Payable'}:</span>
							<div class="flex items-center gap-1.5 font-mono">
								<span class="text-amber-400">⭐ {calc().finalStars} Stars</span>
								<span class="text-white/40 text-[12px]">(${calc().finalUsd.toFixed(2)})</span>
							</div>
						</div>
					</div>
				</div>
			</Show>
		</div>
	);
};

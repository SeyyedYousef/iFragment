import { Component, createSignal, For, Show } from 'solid-js';
import { balance } from '@/entities/airdrop/index.js';
import { formatNumber, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/index.js';
import {
	calculateDiscountForPlan,
	DISCOUNT_TIERS,
} from '@/shared/lib/stars-calculator.js';

interface ShopProduct {
	id: string;
	titleKey: string;
	descKey: string;
	icon: string;
	iconColor: string;
	baseStars: number;
	baseUsd: number;
	targetRoute?: string;
}

const PRODUCTS: ShopProduct[] = [
	{
		id: 'group_mgmt',
		titleKey: 'shopInfo.groupMgmt',
		descKey: 'shopInfo.groupMgmtDesc',
		icon: 'shield_person',
		iconColor: 'text-blue-400',
		baseStars: 150,
		baseUsd: 1.99,
		targetRoute: '/group',
	},
	{
		id: 'channel_mgmt',
		titleKey: 'shopInfo.channelMgmt',
		descKey: 'shopInfo.channelMgmtDesc',
		icon: 'podcasts',
		iconColor: 'text-cyan-400',
		baseStars: 150,
		baseUsd: 1.99,
		targetRoute: '/channel',
	},
	{
		id: 'valuation_quota',
		titleKey: 'shopInfo.usernameAnalytics',
		descKey: 'shopInfo.usernameAnalyticsDesc',
		icon: 'analytics',
		iconColor: 'text-amber-400',
		baseStars: 100,
		baseUsd: 1.29,
		targetRoute: '/valuation',
	},
];

export const ShopView: Component = () => {
	const [selectedDiscounts, setSelectedDiscounts] = createSignal<Record<string, 20 | 35 | 50 | 70>>({
		group_mgmt: 50,
		channel_mgmt: 50,
		valuation_quota: 50,
	});

	const [activeModalProduct, setActiveModalProduct] = createSignal<ShopProduct | null>(null);

	const handleDiscountChange = (productId: string, percent: 20 | 35 | 50 | 70) => {
		try {
			haptic.selection();
		} catch (_) {}
		setSelectedDiscounts((prev) => ({ ...prev, [productId]: percent }));
	};

	const handleInitiatePurchase = (product: ShopProduct) => {
		const discount = selectedDiscounts()[product.id] || 50;
		const calc = calculateDiscountForPlan(product.baseUsd, discount, product.baseStars);

		if (balance() < calc.requiredCoins) {
			try {
				haptic.notify('error');
			} catch (_) {}
			showToast(
				`${t('shopInfo.insufficientCoins' as any) || 'Not enough coins'} (${formatNumber(balance())} / ${formatNumber(calc.requiredCoins)})`,
				'error',
			);
			return;
		}

		try {
			haptic.impact('medium');
		} catch (_) {}
		setActiveModalProduct(product);
	};

	const handleConfirmCheckout = (product: ShopProduct) => {
		const discount = selectedDiscounts()[product.id] || 50;
		const calc = calculateDiscountForPlan(product.baseUsd, discount, product.baseStars);

		try {
			haptic.notify('success');
		} catch (_) {}
		showToast(
			`⭐ ${calc.finalStars} Telegram Stars + ${formatNumber(calc.requiredCoins)} Coins applied for ${t(product.titleKey as any)}!`,
			'success',
		);
		setActiveModalProduct(null);

		if (product.targetRoute) {
			setTimeout(() => {
				window.location.href = product.targetRoute!;
			}, 600);
		}
	};

	return (
		<div
			class="w-full h-full overflow-y-auto px-4 pt-5 pb-28 animate-fade-in no-scrollbar bg-[#030303] text-white relative flex flex-col min-h-0"
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Ambient Gradient Glow */}
			<div class="absolute top-0 left-0 right-0 h-[280px] bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent blur-[80px] pointer-events-none z-0" />

			<div class="max-w-md mx-auto w-full relative z-10 flex flex-col flex-1">
				{/* ═══════ HEADER ═══════ */}
				<div class="flex flex-col items-center mb-5 text-center shrink-0">
					<div class="w-16 h-16 bg-gradient-to-br from-[#1c1608] to-[#08090D] rounded-[22px] border-[1.5px] border-amber-500/30 flex items-center justify-center shadow-[inset_0_2px_12px_rgba(255,255,255,0.05),0_10px_25px_rgba(245,158,11,0.2)] mb-3 relative overflow-hidden">
						<div class="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-8 bg-amber-400/25 blur-md rounded-full pointer-events-none" />
						<span
							class="material-symbols-outlined text-[34px] text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							storefront
						</span>
					</div>
					<h2 class="text-[20px] font-black text-white tracking-tight drop-shadow-md mb-1">
						{t('shopInfo.title' as any) || 'Discount & Services Shop'}
					</h2>
					<p class="text-white/60 text-[12px] leading-relaxed font-medium max-w-[320px]">
						{t('shopInfo.desc' as any) ||
							'Your mined coins act as 25%, 50%, and 75% discount vouchers for premium bot tools.'}
					</p>
				</div>

				{/* ═══════ USER BALANCE & EXPIRY BADGE ═══════ */}
				<div class="bg-[#12141C]/90 backdrop-blur-xl border border-white/10 rounded-[20px] p-3.5 mb-5 flex items-center justify-between shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
					<div class="flex items-center gap-2.5">
						<div class="w-10 h-10 rounded-[12px] bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
							<span
								class="material-symbols-outlined text-amber-400 text-[22px]"
								style={{ 'font-variation-settings': '"FILL" 1' }}
							>
								monetization_on
							</span>
						</div>
						<div class="flex flex-col text-start">
							<span class="text-white/50 text-[10px] uppercase font-black tracking-wider">
								{t('profile.balance' as any) || 'Available Coins'}
							</span>
							<span class="text-amber-400 font-black text-[18px] tabular-nums leading-none">
								{formatNumber(balance())}
							</span>
						</div>
					</div>

					<div class="flex items-center gap-1.5 bg-[#1a1e2b] px-3 py-1.5 rounded-[12px] border border-white/5 text-end">
						<span class="material-symbols-outlined text-amber-400/80 text-[16px]">schedule</span>
						<span class="text-[11px] font-bold text-white/80">
							{t('shopInfo.validityDays' as any) || '15 Days Expiry'}
						</span>
					</div>
				</div>

				{/* ═══════ PRODUCTS LIST ═══════ */}
				<div class="space-y-4 mb-6">
					<For each={PRODUCTS}>
						{(product) => {
							const currentDiscount = () => selectedDiscounts()[product.id] || 50;
							const calc = () =>
								calculateDiscountForPlan(
									product.baseUsd,
									currentDiscount(),
									product.baseStars,
								);
							const hasEnoughCoins = () => balance() >= calc().requiredCoins;

							return (
								<div class="group bg-[#12141C]/85 backdrop-blur-xl border border-white/10 hover:border-white/20 rounded-[24px] p-4.5 flex flex-col gap-3.5 shadow-[0_8px_25px_rgba(0,0,0,0.3)] transition-all duration-300">
									{/* Product Header */}
									<div class="flex items-start gap-3">
										<div class="w-12 h-12 rounded-[16px] bg-[#1a1e2b] border border-white/10 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
											<span
												class={`material-symbols-outlined text-[28px] ${product.iconColor} drop-shadow-md`}
												style={{ 'font-variation-settings': '"FILL" 1' }}
											>
												{product.icon}
											</span>
										</div>
										<div class="flex-1 text-start">
											<div class="flex items-center justify-between gap-2">
												<h3 class="text-white font-black text-[15px] tracking-tight">
													{t(product.titleKey as any)}
												</h3>
												<div class="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-[8px] border border-white/5 shrink-0">
													<span class="text-white/40 text-[11px] line-through font-mono">
														⭐ {product.baseStars} (${product.baseUsd.toFixed(2)})
													</span>
												</div>
											</div>
											<p class="text-white/55 text-[12px] leading-relaxed font-medium mt-0.5">
												{t(product.descKey as any)}
											</p>
										</div>
									</div>

									{/* Discount Tier Selector Buttons */}
									<div class="flex flex-col gap-1.5 pt-1 border-t border-white/5">
										<span class="text-white/50 text-[11px] font-bold text-start">
											{t('shopInfo.selectDiscount' as any) || 'Select Coin Discount:'}
										</span>
										<div class="grid grid-cols-4 gap-2">
											<For each={DISCOUNT_TIERS}>
												{(opt) => {
													const isSelected = () => currentDiscount() === opt.percent;
													const tierCalc = calculateDiscountForPlan(
														product.baseUsd,
														opt.percent,
														product.baseStars,
													);
													const canAfford = () => balance() >= tierCalc.requiredCoins;

													return (
														<button
															type="button"
															onClick={() => handleDiscountChange(product.id, opt.percent)}
															class={`rounded-[14px] py-2 px-1 flex flex-col items-center justify-center transition-all duration-200 border ${
																isSelected()
																	? 'bg-gradient-to-b from-amber-500/25 to-amber-500/10 border-amber-400 text-white shadow-[0_0_12px_rgba(245,158,11,0.2)]'
																	: canAfford()
																		? 'bg-[#181b24] hover:bg-[#202532] border-white/10 text-white/80'
																		: 'bg-[#12141C]/60 border-white/5 text-white/40 opacity-60'
															}`}
														>
															<span class="font-black text-[13px] tracking-tight">
																{opt.label}
															</span>
															<span class="text-[9.5px] font-mono font-semibold text-amber-400/90 mt-0.5">
																{formatNumber(tierCalc.requiredCoins)} 🪙
															</span>
														</button>
													);
												}}
											</For>
										</div>
									</div>

									{/* Action Row */}
									<div class="flex items-center justify-between gap-3 pt-2">
										<div class="flex flex-col text-start">
											<span class="text-white/40 text-[10px] uppercase font-bold tracking-wider">
												{t('shopInfo.finalPrice' as any) || 'You Pay'}
											</span>
											<div class="flex items-center gap-1.5">
												<span class="text-amber-400 font-black text-[17px] leading-none">
													⭐ {calc().finalStars} Stars
												</span>
												<span class="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-[6px] border border-emerald-500/20">
													-{currentDiscount()}%
												</span>
											</div>
										</div>

										<button
											type="button"
											onClick={() => handleInitiatePurchase(product)}
											disabled={!hasEnoughCoins()}
											class={`h-11 px-4 rounded-[14px] font-black text-[12.5px] uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 shadow-md ${
												hasEnoughCoins()
													? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black active:scale-95 shadow-[0_4px_16px_rgba(245,158,11,0.3)]'
													: 'bg-white/10 text-white/40 cursor-not-allowed border border-white/5'
											}`}
										>
											<span class="material-symbols-outlined text-[18px]">shopping_bag</span>
											<span>
												{hasEnoughCoins()
													? t('shopInfo.applyDiscount' as any) || 'Apply & Buy'
													: t('shopInfo.insufficientCoins' as any) || 'Need More Coins'}
											</span>
										</button>
									</div>
								</div>
							);
						}}
					</For>
				</div>

				{/* ═══════ TRANSPARENCY DISCLAIMER (HUD Style) ═══════ */}
				<div class="relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 border border-amber-500/20 rounded-[20px] p-4 flex items-start gap-3 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)] mx-0.5 mb-6 shrink-0 text-start">
					<span class="material-symbols-outlined text-amber-400 text-[20px] shrink-0 mt-0.5">
						info
					</span>
					<p class="text-amber-300/90 text-[12px] font-medium leading-relaxed">
						{t('shopInfo.comingSoon' as any) ||
							'Mined coins are internal utility credits with a 15-day validity, used strictly for up to 70% discounts on bot services and hold no direct crypto value.'}
					</p>
				</div>
			</div>

			{/* ═══════ CONFIRMATION MODAL ═══════ */}
			<Show when={activeModalProduct()}>
				{(prod) => {
					const discount = () => selectedDiscounts()[prod().id] || 50;
					const calc = () =>
						calculateDiscountForPlan(
							prod().baseUsd,
							discount(),
							prod().baseStars,
						);

					return (
						<div
							class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
							dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
						>
							<div class="bg-[#12141C] w-full max-w-sm rounded-[28px] p-6 flex flex-col items-center shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/10 relative overflow-hidden animate-slide-up text-center">
								<div class="w-16 h-16 rounded-[20px] bg-[#1a1e2b] border border-amber-500/30 flex items-center justify-center mb-4">
									<span class={`material-symbols-outlined text-[32px] ${prod().iconColor}`}>
										{prod().icon}
									</span>
								</div>

								<h3 class="text-[18px] font-black text-white mb-1 tracking-tight">
									{t(prod().titleKey as any)}
								</h3>
								<p class="text-white/60 text-[12px] font-medium mb-5 px-2">
									{t('shopInfo.selectDiscount' as any) || 'Confirm discounted purchase:'}
								</p>

								{/* Price Breakdown */}
								<div class="w-full bg-[#090a0f] rounded-[18px] p-4 border border-white/5 space-y-2.5 mb-5 text-[13px]">
									<div class="flex justify-between items-center text-white/60">
										<span>{t('shopInfo.originalPrice' as any) || 'Original Price'}:</span>
										<span class="line-through font-mono">⭐ {calc().baseStars} Stars (${calc().baseUsd.toFixed(2)})</span>
									</div>
									<div class="flex justify-between items-center text-emerald-400">
										<span>{t('shopInfo.coinsRequired' as any) || 'Coin Voucher'}:</span>
										<span class="font-mono font-bold">-{formatNumber(calc().requiredCoins)} 🪙 (-{calc().discountPercent}%)</span>
									</div>
									<div class="border-t border-white/10 pt-2 flex justify-between items-center text-white font-black text-[15px]">
										<span>{t('shopInfo.finalPrice' as any) || 'Final Payment'}:</span>
										<span class="text-amber-400 font-mono">⭐ {calc().finalStars} Stars (${calc().finalUsd.toFixed(2)})</span>
									</div>
								</div>

								{/* Action Buttons */}
								<div class="flex gap-2.5 w-full">
									<button
										type="button"
										onClick={() => setActiveModalProduct(null)}
										class="flex-1 h-12 rounded-[14px] bg-white/10 hover:bg-white/15 text-white font-bold text-[13px] active:scale-95 transition-all"
									>
										{t('common.cancel' as any) || 'Cancel'}
									</button>
									<button
										type="button"
										onClick={() => handleConfirmCheckout(prod())}
										class="flex-1 h-12 rounded-[14px] bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black text-[13px] uppercase tracking-wider active:scale-95 transition-all shadow-[0_4px_16px_rgba(245,158,11,0.3)]"
									>
										{t('common.confirm' as any) || 'Pay & Activate'}
									</button>
								</div>
							</div>
						</div>
					);
				}}
			</Show>
		</div>
	);
};

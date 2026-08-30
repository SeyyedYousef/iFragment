import { openTelegramLink } from '@tma.js/sdk-solid';
import { type Component, createSignal, For, Show } from 'solid-js';
import { balance } from '@/entities/airdrop/index.js';
import { valuationApi } from '@/entities/username/index.js';
import { formatNumber, isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/index.js';

interface IntelPack {
	id: string;
	titleKey: string;
	descKey: string;
	badgeKey: string;
	icon: string;
	iconColor: string;
	credits: number;
	stars: number;
	isPopular?: boolean;
	isPro?: boolean;
}

const INTEL_PACKS: IntelPack[] = [
	{
		id: 'pack_starter_3',
		titleKey: 'economy.pack_starter_title',
		descKey: 'economy.pack_starter_desc',
		badgeKey: 'economy.pack_starter_badge',
		icon: 'radar',
		iconColor: 'text-[#0098EA]',
		credits: 3,
		stars: 100,
	},
	{
		id: 'pack_value_10',
		titleKey: 'economy.pack_value_title',
		descKey: 'economy.pack_value_desc',
		badgeKey: 'economy.pack_value_badge',
		icon: 'analytics',
		iconColor: 'text-emerald-400',
		credits: 10,
		stars: 250,
		isPopular: true,
	},
	{
		id: 'pro',
		titleKey: 'economy.pro_subscription_title',
		descKey: 'economy.pro_subscription_desc',
		badgeKey: 'pro',
		icon: 'workspace_premium',
		iconColor: 'text-amber-400',
		credits: 90,
		stars: 249,
		isPro: true,
	},
];

export const ShopView: Component = () => {
	const [activeModalPack, setActiveModalPack] = createSignal<IntelPack | null>(null);
	const [isProcessing, setIsProcessing] = createSignal<boolean>(false);

	const handleSelectPack = (pack: IntelPack) => {
		haptic.impact('medium');
		setActiveModalPack(pack);
	};

	const handleCheckoutPack = async (pack: IntelPack) => {
		if (isProcessing()) return;
		setIsProcessing(true);
		try {
			const res = await valuationApi.createStarsInvoice('bundle', pack.id);
			if (res?.invoice_link) {
				const tg = (window as any).Telegram?.WebApp;
				if (tg?.openInvoice) {
					tg.openInvoice(res.invoice_link, (status: string) => {
						if (status === 'paid') {
							haptic.notify('success');
							showToast(t('valuation.processingProActivation') || 'Payment confirmed!', 'success');
							setActiveModalPack(null);
						} else if (status === 'cancelled') {
							showToast(t('valuation.payment_cancelled') || 'Payment cancelled.', 'info');
						}
					});
				} else {
					openTelegramLink(res.invoice_link);
					setActiveModalPack(null);
				}
			}
		} catch (err: any) {
			showToast(err?.message || 'Invoice creation failed', 'error');
			haptic.notify('error');
		} finally {
			setIsProcessing(false);
		}
	};

	return (
		<div
			class="w-full max-w-full h-full overflow-y-auto overflow-x-hidden px-4 pt-5 pb-28 animate-fade-in no-scrollbar bg-[#030303] text-white relative flex flex-col min-h-0"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Gradient Glow - Contained in overflow-hidden wrapper */}
			<div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
				<div class="absolute top-0 left-0 right-0 h-[300px] bg-gradient-to-b from-[#0098EA]/15 via-amber-500/5 to-transparent blur-[80px]" />
			</div>

			<div class="max-w-md mx-auto w-full relative z-10 flex flex-col flex-1 gap-5">
				{/* ═══════ HEADER ═══════ */}
				<div class="flex flex-col items-center text-center shrink-0">
					<div class="w-16 h-16 bg-gradient-to-br from-[#12141C] to-[#08090D] rounded-[22px] border-[1.5px] border-[#0098EA]/30 flex items-center justify-center shadow-[inset_0_2px_12px_rgba(255,255,255,0.05),0_10px_25px_rgba(0,152,234,0.2)] mb-3 relative overflow-hidden">
						<div class="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-8 bg-[#0098EA]/25 blur-md rounded-full pointer-events-none" />
						<span
							class="material-symbols-outlined text-[34px] text-[#0098EA] drop-shadow-[0_0_12px_rgba(0,152,234,0.6)]"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							storefront
						</span>
					</div>
					<h2 class="text-[20px] font-black text-white tracking-tight drop-shadow-md mb-1">
						{t('economy.credits_balance') || 'iFragment Intel Store'}
					</h2>
					<p class="text-white/60 text-[12px] leading-relaxed font-medium max-w-[320px]">
						{t('economy.coins_disclaimer') ||
							'Acquire Intel Credits to unlock institutional-grade valuations, on-chain arbitrage radar, and live telemetry.'}
					</p>
				</div>

				{/* ═══════ USER BALANCE & EXPIRY BADGE ═══════ */}
				<div class="bg-[#12141C]/90 backdrop-blur-xl border border-white/10 rounded-[24px] p-4 flex items-center justify-between shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
					<div class="flex items-center gap-3">
						<div class="w-11 h-11 rounded-[14px] bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
							<span
								class="material-symbols-outlined text-amber-400 text-[24px]"
								style={{ 'font-variation-settings': '"FILL" 1' }}
							>
								monetization_on
							</span>
						</div>
						<div class="flex flex-col text-start">
							<span class="text-white/50 text-[10px] uppercase font-black tracking-wider">
								{t('profile.balance' as any) || 'Available Coins'}
							</span>
							<span class="text-amber-400 font-black text-[20px] font-mono tabular-nums leading-none">
								{formatNumber(balance())}
							</span>
						</div>
					</div>

					<div class="flex items-center gap-1.5 bg-[#1a1e2b] px-3 py-1.5 rounded-[12px] border border-white/5 text-end">
						<span class="material-symbols-outlined text-amber-400/80 text-[16px]">schedule</span>
						<span class="text-[11px] font-bold text-white/80">{t('shop.expiry30Days')}</span>
					</div>
				</div>

				{/* ═══════ INTEL CREDITS PACKS (STARS) ═══════ */}
				<div class="flex flex-col gap-3.5">
					<div class="flex items-center justify-between px-1">
						<span class="text-white/50 text-[11px] font-black uppercase tracking-widest">
							INTEL PACKS (TELEGRAM STARS)
						</span>
						<span class="text-amber-400 text-[10px] font-black uppercase tracking-wider">
							{t('shop.noKyc')}
						</span>
					</div>

					<For each={INTEL_PACKS}>
						{(pack) => (
							<div
								class={`bg-[#12141C]/85 backdrop-blur-xl border rounded-[26px] p-5 flex flex-col gap-4 shadow-[0_8px_25px_rgba(0,0,0,0.3)] transition-all duration-300 relative overflow-hidden ${
									pack.isPopular
										? 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
										: pack.isPro
											? 'border-amber-400/40 shadow-[0_0_20px_rgba(251,191,36,0.15)]'
											: 'border-white/10'
								}`}
							>
								{/* Popular / Pro Badge */}
								<Show when={pack.isPopular || pack.isPro}>
									<div
										class={`absolute top-0 right-0 px-3 py-1 font-mono font-black text-[9px] uppercase tracking-widest rounded-bl-[14px] ${
											pack.isPopular ? 'bg-emerald-500 text-black' : 'bg-amber-400 text-black'
										}`}
									>
										{pack.isPopular ? 'BEST VALUE (-25%)' : '👑 2X EARN MULTIPLIER'}
									</div>
								</Show>

								<div class="flex items-start gap-3.5">
									<div
										class={`w-12 h-12 rounded-[16px] bg-[#1a1e2b] border border-white/10 flex items-center justify-center shrink-0 shadow-inner`}
									>
										<span
											class={`material-symbols-outlined text-[28px] ${pack.iconColor} drop-shadow-md`}
											style={{ 'font-variation-settings': '"FILL" 1' }}
										>
											{pack.icon}
										</span>
									</div>

									<div class="flex-1 text-start min-w-0">
										<h3 class="text-white font-black text-[15px] tracking-tight truncate">
											{t(pack.titleKey as any) || pack.titleKey}
										</h3>
										<p class="text-white/55 text-[12px] leading-relaxed font-medium mt-0.5">
											{t(pack.descKey as any) || pack.descKey}
										</p>
									</div>
								</div>

								{/* Price & Action Row */}
								<div class="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
									<div class="flex flex-col text-start">
										<span class="text-white/40 text-[10px] uppercase font-bold tracking-wider">
											{t('shop.price')}
										</span>
										<div class="flex items-center gap-1.5">
											<span class="text-amber-400 font-black text-[18px] leading-none font-mono">
												⭐ {pack.stars} Stars
											</span>
											<span class="text-white/40 text-[11px] font-mono">
												({(pack.stars / pack.credits).toFixed(1)} ⭐/rep)
											</span>
										</div>
									</div>

									<button
										type="button"
										onClick={() => handleSelectPack(pack)}
										class="h-11 px-5 rounded-[16px] font-black text-[12.5px] uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black active:scale-95 shadow-[0_4px_16px_rgba(245,158,11,0.3)]"
									>
										<span class="material-symbols-outlined text-[18px]">shopping_bag</span>
										<span>{t('shop.buyPack')}</span>
									</button>
								</div>
							</div>
						)}
					</For>
				</div>

				{/* ═══════ COIN UTILITY GUIDE & EXPIRY ═══════ */}
				<div class="bg-gradient-to-br from-[#12141C] to-[#08090D] border border-white/10 rounded-[26px] p-5 flex flex-col gap-3 text-start">
					<div class="flex items-center gap-2 text-amber-400">
						<span class="material-symbols-outlined text-[20px]">lightbulb</span>
						<h4 class="text-white font-black text-[13px] uppercase tracking-wider">
							{t('shop.howEconomyWorks')}
						</h4>
					</div>

					<div class="flex flex-col gap-2.5 text-[12px] text-white/70">
						<div class="flex items-start gap-2">
							<span class="text-[#0098EA] font-bold">1.</span>
							<span>
								<strong>{t('shop.mineAndRefer')}</strong> Earn coins daily through mining, referral ladder, and
								community tasks.
							</span>
						</div>
						<div class="flex items-start gap-2">
							<span class="text-emerald-400 font-bold">2.</span>
							<span>
								<strong>{t('shop.spendOnReports')}</strong> Unlock full AVM valuation reports (15,000 coins,
								or 7,500 coins for your first report).
							</span>
						</div>
						<div class="flex items-start gap-2">
							<span class="text-amber-400 font-bold">3.</span>
							<span>
								<strong>{t('shop.expiryDesc')}</strong> Spend active coins within 30 days before they expire
								to keep the economy fluid.
							</span>
						</div>
					</div>
				</div>

				{/* ═══════ TRANSPARENCY DISCLAIMER (HUD Style) ═══════ */}
				<div class="relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 border border-amber-500/20 rounded-[20px] p-4 flex items-start gap-3 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)] mx-0.5 shrink-0 text-start">
					<span class="material-symbols-outlined text-amber-400 text-[20px] shrink-0 mt-0.5">
						info
					</span>
					<p class="text-amber-300/90 text-[11.5px] font-medium leading-relaxed">
						{t('economy.coins_disclaimer') ||
							'Coins are internal in-app points, not listed on exchanges, non-transferable, and possess zero cash value.'}
					</p>
				</div>
			</div>

			{/* ═══════ CONFIRMATION MODAL ═══════ */}
			<Show when={activeModalPack()}>
				{(pack) => (
					<div
						class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
						dir={isRtl() ? 'rtl' : 'ltr'}
					>
						<div class="bg-[#12141C] w-full max-w-sm rounded-[28px] p-6 flex flex-col items-center shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/10 relative overflow-hidden animate-slide-up text-center">
							<div class="w-16 h-16 rounded-[20px] bg-[#1a1e2b] border border-amber-500/30 flex items-center justify-center mb-4">
								<span class={`material-symbols-outlined text-[32px] ${pack().iconColor}`}>
									{pack().icon}
								</span>
							</div>

							<h3 class="text-[18px] font-black text-white mb-1 tracking-tight">
								{t(pack().titleKey as any) || pack().titleKey}
							</h3>
							<p class="text-white/60 text-[12px] font-medium mb-5 px-2">
								{t(pack().descKey as any) || pack().descKey}
							</p>

							{/* Price Breakdown */}
							<div class="w-full bg-[#090a0f] rounded-[18px] p-4 border border-white/5 space-y-2.5 mb-5 text-[13px]">
								<div class="flex justify-between items-center text-white/60">
									<span>{t('shop.creditsProvided')}</span>
									<span class="font-mono font-bold text-white">{pack().credits} Reports</span>
								</div>
								<div class="border-t border-white/10 pt-2 flex justify-between items-center text-white font-black text-[15px]">
									<span>{t('shop.totalPrice')}</span>
									<span class="text-amber-400 font-mono">⭐ {pack().stars} Stars</span>
								</div>
							</div>

							{/* Action Buttons */}
							<div class="flex gap-2.5 w-full">
								<button
									type="button"
									onClick={() => setActiveModalPack(null)}
									class="flex-1 h-12 rounded-[14px] bg-white/10 hover:bg-white/15 text-white font-bold text-[13px] active:scale-95 transition-all"
								>
									{t('common.cancel' as any) || 'Cancel'}
								</button>
								<button
									type="button"
									onClick={() => handleCheckoutPack(pack())}
									disabled={isProcessing()}
									class="flex-1 h-12 rounded-[14px] bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black text-[13px] uppercase tracking-wider active:scale-95 transition-all shadow-[0_4px_16px_rgba(245,158,11,0.3)] disabled:opacity-50 flex items-center justify-center gap-1.5"
								>
									<Show
										when={isProcessing()}
										fallback={<span>{t('common.confirm' as any) || 'Confirm & Pay'}</span>}
									>
										<div class="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
									</Show>
								</button>
							</div>
						</div>
					</div>
				)}
			</Show>
		</div>
	);
};

export default ShopView;

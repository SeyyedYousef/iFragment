import { type Component, createSignal, For, Show } from 'solid-js';
import { creditsApi, type CreditPack } from '@/entities/intel/api/creditsApi.js';
import { formatNumber, isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/index.js';
import { useWallet } from '@/widgets/paywall/useWallet.js';

type ShopTab = 'stars' | 'exchange';

const tg = () =>
	typeof window !== 'undefined'
		? (window as unknown as { Telegram?: { WebApp?: { openInvoice?: (l: string, callback?: (status: string) => void) => void } } }).Telegram?.WebApp
		: undefined;

export const ShopView: Component = () => {
	const wallet = useWallet();
	const [activeTab, setActiveTab] = createSignal<ShopTab>('stars');
	const [pendingPackId, setPendingPackId] = createSignal<string | null>(null);
	const [isExchanging, setIsExchanging] = createSignal<boolean>(false);
	const [exchangeSuccess, setExchangeSuccess] = createSignal<boolean>(false);

	let pollTimer: ReturnType<typeof setInterval> | undefined;

	const startBalancePolling = (baseline: number) => {
		clearInterval(pollTimer);
		let tries = 0;
		pollTimer = setInterval(() => {
			wallet.refetch();
			tries += 1;
			if ((wallet.balance() !== null && wallet.balance()! > baseline) || tries > 30) {
				clearInterval(pollTimer);
				setPendingPackId(null);
				if (wallet.balance() !== null && wallet.balance()! > baseline) {
					try {
						haptic.notify('success');
					} catch {}
					showToast(t('shop.convertSuccess') || 'Payment confirmed! Credits added.', 'success');
				}
			}
		}, 2000);
	};

	const handleBuyPack = async (pack: CreditPack) => {
		try {
			haptic.impact('medium');
		} catch {}
		setPendingPackId(pack.id);
		try {
			const res = await creditsApi.purchaseCredits('stars', pack.id);
			if (res.invoice_link) {
				const baseline = wallet.balance() ?? 0;
				const webApp = tg();
				if (webApp?.openInvoice) {
					webApp.openInvoice(res.invoice_link, (status: string) => {
						if (status === 'paid') {
							haptic.notify('success');
							showToast(t('shop.convertSuccess') || 'Payment confirmed!', 'success');
							wallet.refetch();
							setPendingPackId(null);
						} else if (status === 'cancelled') {
							setPendingPackId(null);
							showToast(t('valuation.payment_cancelled') || 'Payment cancelled.', 'info');
						} else {
							startBalancePolling(baseline);
						}
					});
				} else {
					window.open(res.invoice_link, '_blank');
					startBalancePolling(baseline);
				}
			} else {
				setPendingPackId(null);
				wallet.refetch();
			}
		} catch (err: any) {
			setPendingPackId(null);
			showToast(err?.message || 'Invoice creation failed', 'error');
			try {
				haptic.notify('error');
			} catch {}
		}
	};

	const handleExchangeCoins = async () => {
		const coins = wallet.coins() ?? 0;
		const cost = wallet.config()?.coins_per_credit || 50000;
		if (coins < cost) {
			showToast(
				t('shop.coinsNeededMore', { count: formatNumber(cost - coins) }) ||
					`You need ${formatNumber(cost - coins)} more coins to exchange for 1 credit`,
				'info',
			);
			return;
		}

		try {
			haptic.impact('heavy');
		} catch {}
		setIsExchanging(true);
		setExchangeSuccess(false);

		try {
			await creditsApi.exchangeCoins();
			setIsExchanging(false);
			setExchangeSuccess(true);
			wallet.refetch();
			try {
				haptic.notify('success');
			} catch {}
			showToast(
				t('shop.convertSuccess') || 'Exchange successful! 1 Intel Credit added to your balance.',
				'success',
			);
			setTimeout(() => setExchangeSuccess(false), 3000);
		} catch (err: any) {
			setIsExchanging(false);
			showToast(err?.message || 'Exchange failed', 'error');
			try {
				haptic.notify('error');
			} catch {}
		}
	};

	const coinsCost = () => wallet.config()?.coins_per_credit || 50000;
	const userCoins = () => wallet.coins() ?? 0;
	const userCredits = () => wallet.balance() ?? 0;
	const coinProgress = () => {
		const cost = coinsCost();
		if (cost <= 0) return 0;
		return Math.min(1, userCoins() / cost);
	};

	const packsList = () => {
		const fromConfig = wallet.config()?.packs;
		if (fromConfig && fromConfig.length > 0) return fromConfig;
		return [
			{ id: 'c1', credits: 1, bonus_credits: 0, stars_price: 100 },
			{ id: 'c3p1', credits: 3, bonus_credits: 1, stars_price: 250, popular: true },
			{ id: 'c10p3', credits: 10, bonus_credits: 3, stars_price: 800, best_value: true },
		];
	};

	return (
		<div
			class="w-full max-w-full h-full overflow-y-auto overflow-x-hidden px-4 pt-3 pb-28 animate-fade-in no-scrollbar bg-[#030303] text-white relative flex flex-col min-h-0"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Glowing Lighting */}
			<div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
				<div class="absolute -top-10 left-1/2 -translate-x-1/2 w-[340px] h-[220px] bg-gradient-to-b from-[#0098EA]/20 via-amber-500/10 to-transparent blur-[70px]" />
			</div>

			<div class="max-w-md mx-auto w-full relative z-10 flex flex-col flex-1 gap-4">
				{/* ═══════ 1. HEADER ═══════ */}
				<div class="flex flex-col items-center text-center shrink-0 pt-1">
					<div class="w-14 h-14 bg-gradient-to-br from-[#1c2233] to-[#0d1017] rounded-[20px] border border-amber-400/30 flex items-center justify-center shadow-[inset_0_2px_10px_rgba(255,255,255,0.08),0_8px_25px_rgba(245,158,11,0.2)] mb-2 relative overflow-hidden">
						<span class="text-[28px] drop-shadow-[0_2px_8px_rgba(245,158,11,0.5)]">💎</span>
					</div>
					<h2 class="text-[20px] font-black text-white tracking-tight drop-shadow-md mb-0.5">
						{t('shop.title') || 'فروشگاه کریدت و هوش بازار'}
					</h2>
					<p class="text-white/60 text-[12px] leading-relaxed font-medium max-w-[320px]">
						{t('shop.subtitle') || 'واحد مرجع پرداخت در کل اکوسیستم iFragment'}
					</p>
				</div>

				{/* ═══════ 2. DUAL WALLET BALANCE CARD ═══════ */}
				<div class="grid grid-cols-2 gap-3">
					{/* Credit Balance Card */}
					<div class="bg-gradient-to-br from-[#121622] to-[#0a0d14] border border-[#0098EA]/30 rounded-[22px] p-3.5 flex flex-col justify-between shadow-[0_6px_20px_rgba(0,0,0,0.4)] relative overflow-hidden">
						<div class="absolute -right-4 -bottom-4 w-16 h-16 bg-[#0098EA]/10 rounded-full blur-xl pointer-events-none" />
						<div class="flex items-center justify-between mb-2">
							<span class="text-[10px] font-black uppercase tracking-wider text-[#0098EA]">
								{t('shop.creditsBalance') || 'کریدت شما'}
							</span>
							<span class="text-[16px]">💎</span>
						</div>
						<div class="flex items-baseline gap-1">
							<span class="text-[24px] font-black font-mono text-white tracking-tight">
								{userCredits()}
							</span>
							<span class="text-[11px] font-bold text-white/50">{t('paywall.credit_unit')}</span>
						</div>
					</div>

					{/* Airdrop Coins Card */}
					<div class="bg-gradient-to-br from-[#1a1712] to-[#0e0c08] border border-amber-500/30 rounded-[22px] p-3.5 flex flex-col justify-between shadow-[0_6px_20px_rgba(0,0,0,0.4)] relative overflow-hidden">
						<div class="absolute -right-4 -bottom-4 w-16 h-16 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
						<div class="flex items-center justify-between mb-2">
							<span class="text-[10px] font-black uppercase tracking-wider text-amber-400">
								{t('shop.coinsBalance') || 'سکه‌های ایردراپ'}
							</span>
							<span class="text-[16px]">🪙</span>
						</div>
						<div class="flex items-baseline gap-1">
							<span class="text-[20px] font-black font-mono text-amber-400 tracking-tight truncate">
								{formatNumber(userCoins())}
							</span>
						</div>
					</div>
				</div>

				{/* ═══════ 3. SEGMENTED TABS ═══════ */}
				<div class="flex gap-1.5 rounded-[18px] border border-white/10 bg-[#0a0d14] p-1 shadow-inner">
					<button
						type="button"
						onClick={() => {
							haptic.selection();
							setActiveTab('stars');
						}}
						class={`flex-1 rounded-[14px] py-2.5 text-[12.5px] font-black transition-all duration-200 flex items-center justify-center gap-1.5 ${
							activeTab() === 'stars'
								? 'bg-gradient-to-r from-amber-500/20 to-amber-400/10 border border-amber-400/40 text-amber-300 shadow-sm'
								: 'text-white/60 hover:text-white'
						}`}
					>
						<span>⭐</span>
						<span>{t('shop.tabStars') || 'خرید با ستاره تلگرام'}</span>
					</button>
					<button
						type="button"
						onClick={() => {
							haptic.selection();
							setActiveTab('exchange');
						}}
						class={`flex-1 rounded-[14px] py-2.5 text-[12.5px] font-black transition-all duration-200 flex items-center justify-center gap-1.5 ${
							activeTab() === 'exchange'
								? 'bg-gradient-to-r from-emerald-500/20 to-emerald-400/10 border border-emerald-400/40 text-emerald-300 shadow-sm'
								: 'text-white/60 hover:text-white'
						}`}
					>
						<span>🪙</span>
						<span>{t('shop.tabCoins') || 'تبدیل سکه ایردراپ'}</span>
					</button>
				</div>

				{/* ═══════ 4. TAB CONTENT: STARS PACKS ═══════ */}
				<Show when={activeTab() === 'stars'}>
					<div class="flex flex-col gap-3">
						<div class="flex items-center justify-between px-1">
							<span class="text-white/50 text-[11px] font-black uppercase tracking-widest">
								{t('shop.intelPacksStars') || 'پک‌های کریدت (TELEGRAM STARS)'}
							</span>
							<span class="text-amber-400 text-[10px] font-black uppercase tracking-wider">
								{t('shop.noKyc') || 'بدون احراز هویت · آنی'}
							</span>
						</div>

						<For each={packsList()}>
							{(pack) => {
								const total = pack.credits + pack.bonus_credits;
								const unitPrice = (pack.stars_price / total).toFixed(1);
								const isPending = () => pendingPackId() === pack.id;

								return (
									<div
										class={`bg-[#12141C]/90 backdrop-blur-xl border rounded-[24px] p-4.5 flex flex-col gap-3 shadow-[0_8px_25px_rgba(0,0,0,0.3)] transition-all duration-200 relative overflow-hidden ${
											pack.best_value
												? 'border-emerald-500/50 bg-gradient-to-br from-[#121e1a] to-[#0c1412]'
												: pack.popular
													? 'border-amber-400/50 bg-gradient-to-br from-[#1c1810] to-[#0e0c08]'
													: 'border-white/10 hover:border-white/20'
										}`}
									>
										{/* Badges */}
										<Show when={pack.best_value || pack.popular}>
											<div
												class={`absolute top-0 px-3 py-1 font-mono font-black text-[9px] uppercase tracking-widest ${
													isRtl() ? 'left-0 rounded-br-[12px]' : 'right-0 rounded-bl-[12px]'
												} ${pack.best_value ? 'bg-emerald-400 text-black shadow-[0_2px_10px_rgba(52,211,153,0.4)]' : 'bg-amber-400 text-black shadow-[0_2px_10px_rgba(251,191,36,0.4)]'}`}
											>
												{pack.best_value
													? t('paywall.pack_best_value') || 'BEST VALUE'
													: t('paywall.pack_popular') || 'POPULAR'}
											</div>
										</Show>

										<div class="flex items-center justify-between gap-3">
											<div class="flex items-center gap-3">
												<div class="w-12 h-12 rounded-[16px] bg-gradient-to-br from-amber-400/20 to-amber-500/5 border border-amber-400/30 flex items-center justify-center shrink-0 text-[24px]">
													⭐
												</div>
												<div class="flex flex-col text-start">
													<div class="flex items-center gap-1.5">
														<span class="text-[17px] font-black text-white font-mono">
															{total}
														</span>
														<span class="text-[13px] font-black text-white/80">
															{t('paywall.credit_unit')}
														</span>
														<Show when={pack.bonus_credits > 0}>
															<span class="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[9.5px] font-black text-emerald-300">
																{t('shop.bonusGift', { count: pack.bonus_credits }) || `+${pack.bonus_credits}`}
															</span>
														</Show>
													</div>
													<div class="flex items-center gap-1 text-[11px] font-medium text-white/50 mt-0.5" dir="ltr">
														<span>(⭐ {unitPrice} / credit)</span>
													</div>
												</div>
											</div>

											<button
												type="button"
												disabled={isPending()}
												onClick={() => handleBuyPack(pack)}
												class="h-11 px-4.5 rounded-[16px] font-black text-[13px] transition-all duration-200 flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black active:scale-95 shadow-[0_4px_16px_rgba(245,158,11,0.3)] disabled:opacity-60"
											>
												<Show
													when={!isPending()}
													fallback={
														<div class="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
													}
												>
													<span class="font-mono font-black">{pack.stars_price}</span>
													<span>⭐</span>
												</Show>
											</button>
										</div>
									</div>
								);
							}}
						</For>
					</div>
				</Show>

				{/* ═══════ 5. TAB CONTENT: COIN EXCHANGE ═══════ */}
				<Show when={activeTab() === 'exchange'}>
					<div class="flex flex-col gap-3.5">
						<div class="bg-gradient-to-br from-[#121c17] to-[#09110d] border border-emerald-500/30 rounded-[24px] p-5 flex flex-col gap-4 shadow-[0_8px_25px_rgba(0,0,0,0.4)]">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-3">
									<div class="w-12 h-12 rounded-[16px] bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-[24px]">
										🪙
									</div>
									<div class="flex flex-col text-start">
										<h3 class="text-[15px] font-black text-white">
											{t('shop.coinExchangeTitle') || 'تبدیل سکه ایردراپ به کریدت'}
										</h3>
										<span class="text-[12px] font-medium text-emerald-300/80">
											{t('shop.coinExchangeRate') || 'هر ۵۰,۰۰۰ سکه = ۱ کریدت'}
										</span>
									</div>
								</div>
								<div class="flex items-center gap-1 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full text-[11px] font-black text-emerald-300">
									<span>۱ 💎</span>
								</div>
							</div>

							{/* Progress Bar */}
							<div class="flex flex-col gap-1.5">
								<div class="flex justify-between text-[11px] font-bold text-white/70">
									<span>{t('shop.coinProgressLabel') || 'پیشرفت به سمت ۱ کریدت بعدی:'}</span>
									<span class="font-mono text-emerald-400">{Math.round(coinProgress() * 100)}%</span>
								</div>
								<div class="h-2.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5 p-0.5">
									<div
										class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-[#00ff88] transition-all duration-500 shadow-[0_0_12px_rgba(0,255,136,0.5)]"
										style={{ width: `${Math.round(coinProgress() * 100)}%` }}
									/>
								</div>
								<div class="flex justify-between text-[10px] font-mono text-white/40 mt-0.5">
									<span>{formatNumber(userCoins())} {t('airdrop.coins') || 'Coins'}</span>
									<span>{formatNumber(coinsCost())} {t('airdrop.coins') || 'Coins'}</span>
								</div>
							</div>

							{/* Convert Action Button */}
							<button
								type="button"
								disabled={isExchanging() || userCoins() < coinsCost()}
								onClick={handleExchangeCoins}
								class="w-full h-13 rounded-[16px] font-black text-[13.5px] transition-all duration-200 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 hover:from-emerald-300 hover:to-emerald-400 text-black active:scale-[0.98] shadow-[0_6px_20px_rgba(16,185,129,0.3)] disabled:opacity-40 disabled:pointer-events-none"
							>
								<Show
									when={!isExchanging()}
									fallback={
										<div class="flex items-center gap-2">
											<div class="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
											<span>{t('shop.converting') || 'در حال تبدیل...'}</span>
										</div>
									}
								>
									<Show
										when={!exchangeSuccess()}
										fallback={
											<div class="flex items-center gap-1.5 text-black font-black">
												<span>✓</span>
												<span>{t('shop.convertSuccess') || 'تبدیل انجام شد!'}</span>
											</div>
										}
									>
										<span class="text-[18px]">⚡</span>
										<span>{t('shop.convertBtn') || 'تبدیل ۵۰,۰۰۰ سکه به ۱ کریدت'}</span>
									</Show>
								</Show>
							</button>

							<Show when={userCoins() < coinsCost()}>
								<p class="text-[11px] text-center text-white/50 leading-relaxed font-medium">
									💡{' '}
									{t('shop.coinsNeededMore', {
										count: formatNumber(coinsCost() - userCoins()),
									}) ||
										`با ماینینگ روزانه و انجام تسک‌ها ${formatNumber(coinsCost() - userCoins())} سکه دیگر جمع‌آوری کنید.`}
								</p>
							</Show>
						</div>
					</div>
				</Show>

				{/* ═══════ 6. UTILITY GUIDE (WHAT CAN YOU DO WITH CREDITS?) ═══════ */}
				<div class="bg-gradient-to-br from-[#12141C] to-[#08090D] border border-white/10 rounded-[26px] p-5 flex flex-col gap-3.5 text-start shadow-md">
					<div class="flex items-center gap-2 text-amber-400">
						<span class="material-symbols-outlined text-[20px]">verified</span>
						<h4 class="text-white font-black text-[13.5px] uppercase tracking-wider">
							{t('shop.howEconomyWorks') || 'کاربردهای کریدت در کل اکوسیستم'}
						</h4>
					</div>

					<div class="flex flex-col gap-3 text-[12px] text-white/80">
						{/* Item 1 */}
						<div class="flex items-start gap-3 bg-white/[0.03] p-3 rounded-[16px] border border-white/5">
							<div class="w-8 h-8 rounded-[10px] bg-[#0098EA]/15 border border-[#0098EA]/30 flex items-center justify-center shrink-0 text-[#0098EA] font-black text-[13px]">
								۱
							</div>
							<div class="flex flex-col">
								<span class="font-bold text-white text-[12.5px]">
									{t('shop.utility1Title') || 'تحلیل عمیق هوش مصنوعی'}
								</span>
								<span class="text-white/60 text-[11px] mt-0.5 leading-relaxed">
									{t('shop.utility1Desc') ||
										'ارزش‌گذاری نام‌های کاربری، شماره‌های کلکسیونی و گیفت‌های تلگرام (۱ کریدت برای هر تحلیل)'}
								</span>
							</div>
						</div>

						{/* Item 2 */}
						<div class="flex items-start gap-3 bg-white/[0.03] p-3 rounded-[16px] border border-white/5">
							<div class="w-8 h-8 rounded-[10px] bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center shrink-0 text-emerald-300 font-black text-[13px]">
								۳
							</div>
							<div class="flex flex-col">
								<span class="font-bold text-white text-[12.5px]">
									{t('shop.utility2Title') || 'مدیریت حرفه‌ای گروه و کانال'}
								</span>
								<span class="text-white/60 text-[11px] mt-0.5 leading-relaxed">
									{t('shop.utility2Desc') ||
										'دستیار هوشمند، ضداسپم، زمان‌بندی پست و آمار پیشرفته (۳ کریدت برای هر ماه)'}
								</span>
							</div>
						</div>

						{/* Item 3 */}
						<div class="flex items-start gap-3 bg-white/[0.03] p-3 rounded-[16px] border border-white/5">
							<div class="w-8 h-8 rounded-[10px] bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0 text-amber-300 font-black text-[13px]">
								⚡
							</div>
							<div class="flex flex-col">
								<span class="font-bold text-white text-[12.5px]">
									{t('shop.utility3Title') || 'هوش بازار و رادار آربیتراژ'}
								</span>
								<span class="text-white/60 text-[11px] mt-0.5 leading-relaxed">
									{t('shop.utility3Desc') ||
										'سیگنال‌های خرید آنی و تحلیل آن‌چین فرگمنت بدون تاخیر'}
								</span>
							</div>
						</div>
					</div>
				</div>

				{/* ═══════ 7. TRANSPARENCY DISCLAIMER (HUD Style) ═══════ */}
				<div class="relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 border border-amber-500/20 rounded-[20px] p-4 flex items-start gap-3 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)] shrink-0 text-start">
					<span class="material-symbols-outlined text-amber-400 text-[20px] shrink-0 mt-0.5">
						info
					</span>
					<p class="text-amber-300/90 text-[11px] font-medium leading-relaxed">
						{t('economy.coins_disclaimer') ||
							'سکه‌ها امتیاز داخلی اپلیکیشن هستند، در صرافی‌ها لیست نمی‌شوند، غیرقابل انتقال بوده و ارزش نقدی ندارند.'}
					</p>
				</div>
			</div>
		</div>
	);
};

export default ShopView;

import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { marketplaceApi, PurchaseOption } from '@/shared/api/bot-management.js';
import { t } from '@/shared/i18n/index.js';
import { openInvoice } from '@/shared/lib/telegram-native.js';
import { balance, frgBalance, syncProfileStats } from '@/shared/store/airdrop.js';

export const MarketplacePage: Component = () => {
	const [activeTab, setActiveTab] = createSignal<'buy' | 'convert'>('buy');
	const [options, setOptions] = createSignal<PurchaseOption[]>([]);
	const [optionsLoading, setOptionsLoading] = createSignal(true);
	const [loadingOptionId, setLoadingOptionId] = createSignal<string | null>(null);

	// Conversion state
	const [convertAmount, setConvertAmount] = createSignal<string>('');
	const [convertLoading, setConvertLoading] = createSignal(false);
	const [convertError, setConvertError] = createSignal('');
	const [convertSuccess, setConvertSuccess] = createSignal('');

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => window.history.back());
		onCleanup(() => {
			off();
			backButton.hide();
		});

		// Fetch purchase options
		marketplaceApi
			.getOptions()
			.then((res) => {
				setOptions(res || []);
			})
			.catch((err) => {
				console.error('Failed to load options:', err);
			})
			.finally(() => {
				setOptionsLoading(false);
			});
	});

	const handleBuyWithStars = async (opt: PurchaseOption) => {
		if (loadingOptionId()) return;
		setLoadingOptionId(opt.id);
		try {
			try {
				hapticFeedback.impactOccurred('medium');
			} catch (_) {}

			// 1. Create invoice link on backend
			const res = await marketplaceApi.createStarsInvoice(opt.id);
			if (!res?.invoice_link) {
				throw new Error('Failed to generate invoice link');
			}

			// 2. Open invoice native popup
			const status = await openInvoice(res.invoice_link);
			if (status === 'paid') {
				try {
					hapticFeedback.notificationOccurred('success');
				} catch (_) {}
				// Sync balance
				await syncProfileStats();
			} else {
				try {
					hapticFeedback.notificationOccurred('warning');
				} catch (_) {}
			}
		} catch (e: any) {
			console.error(e);
			try {
				hapticFeedback.notificationOccurred('error');
			} catch (_) {}
		} finally {
			setLoadingOptionId(null);
		}
	};

	const calculatedFRG = () => {
		const amt = parseFloat(convertAmount());
		if (Number.isNaN(amt) || amt <= 0) return 0;
		// Rate: 100,000 airdrop coins = 1 FRG (4 decimal precision)
		return Math.floor((amt / 100000.0) * 10000) / 10000;
	};

	const handleConvert = async (e: Event) => {
		e.preventDefault();
		const coinsVal = parseFloat(convertAmount());
		if (Number.isNaN(coinsVal) || coinsVal < 100000) {
			setConvertError(t('marketplace.insufficientAirdrop') || 'حداقل مقدار تبدیل ۱۰۰,۰۰۰ سکه است');
			return;
		}

		if (coinsVal > balance()) {
			setConvertError(t('marketplace.insufficientAirdrop') || 'موجودی سکه ایردراپ شما کافی نیست');
			return;
		}

		setConvertLoading(true);
		setConvertError('');
		setConvertSuccess('');

		try {
			try {
				hapticFeedback.impactOccurred('heavy');
			} catch (_) {}
			await marketplaceApi.convertAirdropCoins(coinsVal);
			setConvertSuccess('تبدیل با موفقیت انجام شد!');
			setConvertAmount('');
			try {
				hapticFeedback.notificationOccurred('success');
			} catch (_) {}
			await syncProfileStats();
		} catch (err: any) {
			setConvertError(err.message || 'خطایی رخ داد، لطفاً دوباره تلاش کنید.');
			try {
				hapticFeedback.notificationOccurred('error');
			} catch (_) {}
		} finally {
			setConvertLoading(false);
		}
	};

	const setPercentAmount = (pct: number) => {
		try {
			hapticFeedback.impactOccurred('light');
		} catch (_) {}
		const total = balance();
		const amt = Math.floor(total * pct);
		// Align to nearest integer
		setConvertAmount(amt > 0 ? amt.toString() : '');
	};

	return (
		<div
			class="flex flex-col bg-[#0f1014] relative overflow-hidden"
			style={{ 'min-height': 'var(--tg-viewport-stable-height, 100vh)' }}
		>
			{/* Premium Ambient Light */}
			<div
				class="absolute top-0 left-1/2 -translate-x-1/2 w-[350px] h-[350px] rounded-full pointer-events-none filter blur-[80px]"
				style={{ background: 'radial-gradient(circle, rgba(51,144,236,0.15) 0%, transparent 70%)' }}
			></div>

			{/* Header Info */}
			<div class="px-5 pt-6 pb-4 z-10 flex flex-col items-center">
				<span
					class="material-symbols-outlined text-amber-400 text-5xl mb-2 animate-bounce"
					style={{ 'font-variation-settings': '"FILL" 1' }}
				>
					storefront
				</span>
				<h1 class="text-white text-2xl font-black tracking-tight">
					{t('marketplace.title') || 'بازارچه سکه'}
				</h1>
				<p class="text-[#8e8e93] text-xs font-semibold mt-1 text-center">
					{t('marketplace.subtitle') || 'خرید و تبدیل سکه FRG'}
				</p>
			</div>

			{/* Balance Card */}
			<div class="px-4 mb-6 z-10">
				<div class="bg-gradient-to-br from-[#1c1c1e] to-[#121214] border border-white/[0.05] rounded-3xl p-5 shadow-2xl relative overflow-hidden flex items-center justify-between">
					<div class="absolute inset-0 bg-gradient-to-tr from-[#3390ec]/5 via-transparent to-transparent pointer-events-none"></div>
					<div>
						<div class="text-[#8e8e93] text-[10px] font-black uppercase tracking-widest">
							{t('marketplace.balance') || 'موجودی سکه (FRG)'}
						</div>
						<div class="text-white text-3xl font-black mt-1.5 flex items-baseline gap-1 font-mono">
							{frgBalance().toLocaleString('en-US')}
							<span class="text-amber-400 text-xs font-bold font-sans">FRG</span>
						</div>
						<div class="text-red-400 font-bold text-[10px] flex items-center gap-1 mt-2.5 bg-red-500/5 px-2 py-1 rounded-lg border border-red-500/10">
							<span
								class="material-symbols-outlined text-[10px]"
								style={{ 'font-variation-settings': '"FILL" 1' }}
							>
								monetization_on
							</span>
							<span>{balance().toLocaleString('en-US')} Airdrop Coins</span>
						</div>
					</div>
					<div class="w-14 h-14 rounded-2xl bg-amber-400/5 border border-amber-400/20 flex items-center justify-center shadow-inner">
						<span
							class="material-symbols-outlined text-amber-400 text-3xl"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							toll
						</span>
					</div>
				</div>
			</div>

			{/* Premium Glass Tabs */}
			<div class="px-4 mb-6 z-10">
				<div class="flex bg-[#1c1c1e]/60 backdrop-blur-md border border-white/[0.04] p-1 rounded-2xl">
					<button
						onClick={() => {
							try {
								hapticFeedback.selectionChanged();
							} catch (_) {}
							setActiveTab('buy');
						}}
						class={`flex-1 py-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
							activeTab() === 'buy'
								? 'bg-[#3390ec] text-white shadow-[0_4px_15px_rgba(51,144,236,0.3)]'
								: 'text-[#8e8e93] hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-sm">stars</span>
						{t('marketplace.buyTokens') || 'خرید سکه'}
					</button>
					<button
						onClick={() => {
							try {
								hapticFeedback.selectionChanged();
							} catch (_) {}
							setActiveTab('convert');
						}}
						class={`flex-1 py-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
							activeTab() === 'convert'
								? 'bg-[#3390ec] text-white shadow-[0_4px_15px_rgba(51,144,236,0.3)]'
								: 'text-[#8e8e93] hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-sm">published_with_changes</span>
						{t('marketplace.convertAirdrop') || 'تبدیل ایردراپ'}
					</button>
				</div>
			</div>

			{/* Tab Panels */}
			<div class="flex-1 px-4 pb-12 z-10">
				<Show when={activeTab() === 'buy'}>
					<Show
						when={!optionsLoading()}
						fallback={
							<div class="flex items-center justify-center py-16">
								<div class="w-8 h-8 border-3 border-[#3390ec] border-t-transparent rounded-full animate-spin"></div>
							</div>
						}
					>
						<div class="grid grid-cols-2 gap-3.5">
							<For each={options()}>
								{(opt) => (
									<div
										class={`bg-[#1c1c1e]/80 backdrop-blur-lg border rounded-3xl p-4 flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
											opt.popular
												? 'border-amber-400/40 shadow-[0_4px_20px_rgba(251,191,36,0.1)]'
												: 'border-white/[0.04]'
										}`}
									>
										{opt.popular && (
											<div class="absolute top-0 right-0 bg-gradient-to-l from-amber-400 to-amber-500 text-black text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-lg flex items-center gap-0.5">
												<span
													class="material-symbols-outlined text-[10px]"
													style={{ 'font-variation-settings': '"FILL" 1' }}
												>
													local_fire_department
												</span>
												POPULAR
											</div>
										)}

										<div>
											{/* Token Count */}
											<div class="text-white text-2xl font-black flex items-baseline gap-0.5 font-mono mt-1">
												{opt.frg_amount}
												<span class="text-amber-400 text-[10px] font-black font-sans ml-0.5">
													FRG
												</span>
											</div>

											{/* Discount Tag */}
											<Show when={opt.discount}>
												<span class="inline-block bg-[#34c759]/10 text-[#34c759] border border-[#34c759]/20 text-[9px] font-bold px-2 py-0.5 rounded-lg mt-2">
													SAVE {opt.discount}
												</span>
											</Show>
										</div>

										{/* Action Button */}
										<div class="mt-6">
											<button
												onClick={() => handleBuyWithStars(opt)}
												disabled={loadingOptionId() !== null}
												class={`w-full py-3 rounded-2xl font-black text-xs transition-all active:scale-[0.96] flex items-center justify-center gap-1 shadow-lg ${
													loadingOptionId() === opt.id
														? 'bg-[#2c2c2e] text-[#555]'
														: opt.popular
															? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black hover:opacity-90'
															: 'bg-[#3390ec] text-white hover:bg-[#3390ec]/90'
												}`}
											>
												{loadingOptionId() === opt.id ? (
													<span class="material-symbols-outlined text-sm animate-spin">
														progress_activity
													</span>
												) : (
													<>
														<span
															class="material-symbols-outlined text-sm"
															style={{ 'font-variation-settings': '"FILL" 1' }}
														>
															stars
														</span>
														<span>{opt.price.toLocaleString('en-US')} Stars</span>
													</>
												)}
											</button>
										</div>
									</div>
								)}
							</For>
						</div>
					</Show>
				</Show>

				<Show when={activeTab() === 'convert'}>
					<div class="bg-[#1c1c1e]/80 backdrop-blur-lg border border-white/[0.04] rounded-3xl p-5">
						<div class="text-center mb-5">
							<span class="text-[#8e8e93] text-xs font-semibold leading-relaxed">
								{t('marketplace.exchangeRate') || 'نرخ تبدیل: ۱۰۰,۰۰۰ سکه ایردراپ = ۱ سکه FRG'}
							</span>
						</div>

						<form onSubmit={handleConvert} class="flex flex-col gap-5">
							<div>
								<label class="block text-[#8e8e93] text-xs font-bold mb-2.5 px-1">
									سکه جهت تبدیل:
								</label>
								<div class="relative">
									<input
										type="number"
										value={convertAmount()}
										onInput={(e) => setConvertAmount(e.target.value)}
										placeholder="حداقل ۱۰۰,۰۰۰"
										class="w-full bg-[#2c2c2e]/60 text-white font-mono font-bold text-sm py-4 pl-4 pr-16 rounded-2xl border border-white/[0.04] focus:border-[#3390ec]/40 focus:outline-none placeholder:text-[#555]"
									/>
									<div class="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
										<span
											class="material-symbols-outlined text-amber-400 text-lg"
											style={{ 'font-variation-settings': '"FILL" 1' }}
										>
											monetization_on
										</span>
										<span class="text-[#8e8e93] text-xs font-bold">Coins</span>
									</div>
								</div>

								{/* Quick actions percent */}
								<div class="flex gap-2 mt-3">
									<button
										type="button"
										onClick={() => setPercentAmount(0.25)}
										class="flex-1 bg-[#2c2c2e]/40 hover:bg-[#2c2c2e]/80 border border-white/[0.02] text-[#8e8e93] hover:text-white font-bold py-2 rounded-xl text-[10px] transition-colors"
									>
										25%
									</button>
									<button
										type="button"
										onClick={() => setPercentAmount(0.5)}
										class="flex-1 bg-[#2c2c2e]/40 hover:bg-[#2c2c2e]/80 border border-white/[0.02] text-[#8e8e93] hover:text-white font-bold py-2 rounded-xl text-[10px] transition-colors"
									>
										50%
									</button>
									<button
										type="button"
										onClick={() => setPercentAmount(0.75)}
										class="flex-1 bg-[#2c2c2e]/40 hover:bg-[#2c2c2e]/80 border border-white/[0.02] text-[#8e8e93] hover:text-white font-bold py-2 rounded-xl text-[10px] transition-colors"
									>
										75%
									</button>
									<button
										type="button"
										onClick={() => setPercentAmount(1.0)}
										class="flex-1 bg-[#2c2c2e]/40 hover:bg-[#2c2c2e]/80 border border-white/[0.02] text-[#8e8e93] hover:text-white font-bold py-2 rounded-xl text-[10px] transition-colors"
									>
										MAX
									</button>
								</div>
							</div>

							{/* Conversion Preview */}
							<Show when={calculatedFRG() > 0}>
								<div class="bg-[#3390ec]/5 border border-[#3390ec]/20 rounded-2xl p-4 flex items-center justify-between animate-fade-in">
									<div>
										<div class="text-[#8e8e93] text-[9px] font-black uppercase tracking-wider">
											سکه دریافتی:
										</div>
										<div class="text-white text-2xl font-black mt-1 font-mono">
											{calculatedFRG().toLocaleString('en-US')}
											<span class="text-amber-400 text-xs font-bold font-sans ml-1">FRG</span>
										</div>
									</div>
									<span class="material-symbols-outlined text-[#3390ec] text-2xl">trending_up</span>
								</div>
							</Show>

							{/* Status messages */}
							<Show when={convertError()}>
								<div class="text-red-500 text-xs font-bold text-center bg-red-500/5 py-3 rounded-xl border border-red-500/10">
									{convertError()}
								</div>
							</Show>
							<Show when={convertSuccess()}>
								<div class="text-[#34c759] text-xs font-bold text-center bg-[#34c759]/5 py-3 rounded-xl border border-[#34c759]/10">
									{convertSuccess()}
								</div>
							</Show>

							<button
								type="submit"
								disabled={
									convertLoading() || !convertAmount() || parseFloat(convertAmount()) < 100000
								}
								class={`w-full py-4 rounded-2xl font-black text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-1.5 shadow-[0_4px_20px_rgba(51,144,236,0.3)] ${
									convertLoading() || !convertAmount() || parseFloat(convertAmount()) < 100000
										? 'bg-[#2c2c2e] text-[#555] shadow-none'
										: 'bg-[#3390ec] text-white hover:bg-[#3390ec]/90'
								}`}
							>
								{convertLoading() ? (
									<span class="material-symbols-outlined text-base animate-spin">
										progress_activity
									</span>
								) : (
									<>
										<span class="material-symbols-outlined text-lg">swap_horizontal_circle</span>
										<span>{t('marketplace.convertBtn') || 'تبدیل به سکه اصلی'}</span>
									</>
								)}
							</button>
						</form>
					</div>
				</Show>
			</div>
		</div>
	);
};

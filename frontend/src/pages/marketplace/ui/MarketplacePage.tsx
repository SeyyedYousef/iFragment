import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { marketplaceApi, PurchaseOption } from '@/shared/api/bot-management.js';
import { t } from '@/shared/i18n/index.js';
import { openInvoice } from '@/shared/lib/telegram-native.js';
import { balance, frgBalance, syncProfileStats } from '@/shared/store/airdrop.js';

export const MarketplacePage: Component = () => {
	const [activeTab, setActiveTab] = createSignal<'buy' | 'convert'>('buy');
	const [options, setOptions] = createSignal<PurchaseOption[]>([]);
	const [optionsLoading, setOptionsLoading] = createSignal(true);
	const [loadingOptionId, setLoadingOptionId] = createSignal<string | null>(null);

	const [convertAmount, setConvertAmount] = createSignal<string>('');
	const [convertLoading, setConvertLoading] = createSignal(false);
	const [convertError, setConvertError] = createSignal('');
	const [convertSuccess, setConvertSuccess] = createSignal('');
	const [isUserEdited, setIsUserEdited] = createSignal(false);

	createEffect(() => {
		const bal = balance();
		if (!isUserEdited()) {
			if (bal >= 100000) {
				const maxMultiple = Math.floor(bal / 100000) * 100000;
				setConvertAmount(maxMultiple.toString());
			} else {
				setConvertAmount('100000');
			}
		}
	});

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} window.history.back(); });
		onCleanup(() => { off(); backButton.hide(); });

		marketplaceApi.getOptions().then((res: PurchaseOption[]) => {
			const mapped = (res || []).map((opt: PurchaseOption) => ({ ...opt, price: opt.price ?? opt.amount_stars ?? 0, frg_amount: opt.frg_amount ?? opt.amount_coins ?? 0 }));
			setOptions(mapped.sort((a, b) => b.price - a.price));
		}).catch((err) => console.error('Failed to load options:', err)).finally(() => setOptionsLoading(false));
	});

	const handleBuyWithStars = async (opt: PurchaseOption) => {
		if (loadingOptionId()) return;
		setLoadingOptionId(opt.id);
		try {
			try { hapticFeedback.impactOccurred('medium'); } catch (_) {}
			const res = await marketplaceApi.createStarsInvoice(opt.id);
			if (!res?.invoice_link) throw new Error('Failed to generate invoice link');

			const status = await openInvoice(res.invoice_link);
			if (status === 'paid') {
				try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
				await syncProfileStats();
			} else {
				try { hapticFeedback.notificationOccurred('warning'); } catch (_) {}
			}
		} catch (e: any) {
			console.error(e);
			try { hapticFeedback.notificationOccurred('error'); } catch (_) {}
		} finally {
			setLoadingOptionId(null);
		}
	};

	const calculatedFRG = () => {
		const amt = parseFloat(convertAmount());
		if (Number.isNaN(amt) || amt <= 0) return 0;
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

		setConvertLoading(true); setConvertError(''); setConvertSuccess('');
		try {
			try { hapticFeedback.impactOccurred('heavy'); } catch (_) {}
			await marketplaceApi.convertAirdropCoins(coinsVal);
			setConvertSuccess('تبدیل با موفقیت انجام شد!');
			setIsUserEdited(false); setConvertAmount('');
			try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
			await syncProfileStats();
		} catch (err: any) {
			setConvertError(err.message || 'خطایی رخ داد، لطفاً دوباره تلاش کنید.');
			try { hapticFeedback.notificationOccurred('error'); } catch (_) {}
		} finally {
			setConvertLoading(false);
		}
	};

	const setPercentAmount = (pct: number) => {
		try { hapticFeedback.impactOccurred('light'); } catch (_) {}
		setIsUserEdited(true);
		const amt = Math.floor(balance() * pct);
		setConvertAmount(amt > 0 ? amt.toString() : '');
	};

	return (
		<div class="flex flex-col bg-[#030303] relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30" style={{ 'min-height': 'var(--tg-viewport-stable-height, 100vh)' }} dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#3390ec]/15 via-amber-500/5 to-transparent blur-[80px] pointer-events-none z-0" />

			<div class="w-full max-w-[420px] mx-auto flex flex-col relative z-10">
				
				{/* ═══════ HEADER ═══════ */}
				<div class="px-5 pt-8 pb-5 flex flex-col items-center text-center">
					<div class="w-20 h-20 bg-gradient-to-br from-[#1c1608] to-[#08090D] rounded-[24px] border-[1.5px] border-amber-500/30 flex items-center justify-center mb-4 shadow-[inset_0_2px_12px_rgba(255,255,255,0.05),0_10px_30px_rgba(245,158,11,0.15)] relative overflow-hidden">
						<div class="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-10 bg-amber-400/20 blur-xl rounded-full" />
						<span class="material-symbols-outlined text-[42px] text-amber-400 drop-shadow-md">storefront</span>
					</div>
					<h1 class="text-[26px] font-black tracking-tight text-white mb-1.5 drop-shadow-sm">
						{t('marketplace.title') || 'بازارچه سکه'}
					</h1>
					<p class="text-white/50 text-[13px] font-medium tracking-wide">
						{t('marketplace.subtitle') || 'خرید و تبدیل سکه FRG'}
					</p>
				</div>

				{/* ═══════ BALANCE DASHBOARD CARD ═══════ */}
				<div class="px-4 mb-6">
					<div class="bg-gradient-to-br from-[#12141C] to-[#08090D] border border-white/10 rounded-[28px] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.5)] relative overflow-hidden flex items-center justify-between">
						<div class="absolute -right-10 -top-10 w-32 h-32 bg-amber-400/10 blur-3xl rounded-full pointer-events-none" />
						<div class="absolute -left-10 -bottom-10 w-32 h-32 bg-[#3390ec]/10 blur-3xl rounded-full pointer-events-none" />
						
						<div class="relative z-10 flex flex-col">
							<span class="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1.5">
								{t('marketplace.balance') || 'موجودی سکه (FRG)'}
							</span>
							<div class="text-white text-[32px] font-black flex items-baseline gap-1.5 font-mono drop-shadow-md" dir="ltr">
								{frgBalance().toLocaleString('en-US')}
								<span class="text-amber-400 text-[13px] font-black font-sans">FRG</span>
							</div>
							<div class="flex items-center gap-1.5 mt-3 bg-white/5 border border-white/10 px-3 py-1.5 rounded-[10px] shadow-sm w-fit" dir="ltr">
								<span class="material-symbols-outlined text-[14px] text-[#3390ec]">monetization_on</span>
								<span class="text-white/80 font-mono font-bold text-[11px] pt-0.5">{balance().toLocaleString('en-US')} Airdrop Coins</span>
							</div>
						</div>
						
						<div class="w-16 h-16 rounded-[20px] bg-gradient-to-br from-amber-400/20 to-amber-400/5 border border-amber-400/30 flex items-center justify-center shadow-inner relative z-10">
							<span class="material-symbols-outlined text-amber-400 text-[36px] drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">toll</span>
						</div>
					</div>
				</div>

				{/* ═══════ GLASS TABS ═══════ */}
				<div class="px-4 mb-6">
					<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[20px] p-1.5 flex gap-1 border border-white/5 shadow-inner">
						<button
							onClick={() => { try { hapticFeedback.selectionChanged(); } catch (_) {} setActiveTab('buy'); }}
							class={`flex-1 h-12 rounded-[16px] text-[13px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 ${
								activeTab() === 'buy' ? 'bg-white/10 text-white shadow-[0_2px_12px_rgba(0,0,0,0.3)] border border-white/5' : 'text-white/40 hover:text-white/80'
							}`}
						>
							<span class="material-symbols-outlined text-[18px]">stars</span> {t('marketplace.buyTokens') || 'خرید سکه'}
						</button>
						<button
							onClick={() => { try { hapticFeedback.selectionChanged(); } catch (_) {} setActiveTab('convert'); }}
							class={`flex-1 h-12 rounded-[16px] text-[13px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 ${
								activeTab() === 'convert' ? 'bg-white/10 text-white shadow-[0_2px_12px_rgba(0,0,0,0.3)] border border-white/5' : 'text-white/40 hover:text-white/80'
							}`}
						>
							<span class="material-symbols-outlined text-[18px]">swap_horiz</span> {t('marketplace.convertAirdrop') || 'تبدیل ایردراپ'}
						</button>
					</div>
				</div>

				{/* ═══════ TAB PANELS ═══════ */}
				<div class="flex-1 px-4 pb-12">
					
					{/* ── BUY TAB (STORE) ── */}
					<Show when={activeTab() === 'buy'}>
						<Show when={!optionsLoading()} fallback={<div class="flex justify-center py-16"><div class="w-10 h-10 border-4 border-white/10 border-t-[#3390ec] rounded-full animate-spin shadow-[0_0_15px_#3390ec]" /></div>}>
							<div class="grid grid-cols-2 gap-3.5">
								<For each={options()}>
									{(opt) => (
										<div class={`bg-[#12141C]/80 backdrop-blur-xl border rounded-[24px] p-4 flex flex-col justify-between relative overflow-hidden transition-all duration-300 shadow-sm ${opt.popular ? 'border-amber-400/40 shadow-[0_8px_24px_rgba(245,158,11,0.15)] bg-gradient-to-b from-amber-400/5 to-transparent' : 'border-white/5 hover:border-white/15 hover:bg-[#161b28]'}`}>
											
											{opt.popular && (
												<div class="absolute top-0 right-0 bg-gradient-to-l from-amber-400 to-amber-500 text-black text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-[12px] shadow-sm flex items-center gap-0.5">
													<span class="material-symbols-outlined text-[12px]">local_fire_department</span> POPULAR
												</div>
											)}

											<div class="pt-2">
												<div class="text-white text-[26px] font-black flex items-baseline gap-1 font-mono tracking-tight" dir="ltr">
													{opt.frg_amount}
													<span class="text-amber-400 text-[11px] font-black font-sans">FRG</span>
												</div>
												<div class="text-white/40 text-[10px] font-bold mt-0.5" dir="ltr">
													{parseFloat((opt.price / opt.frg_amount).toFixed(4))} Stars/FRG
												</div>
												<Show when={opt.discount}>
													<span class="inline-block bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20 text-[9px] font-black px-2 py-0.5 rounded-[8px] mt-2.5 uppercase tracking-widest shadow-sm">
														SAVE {opt.discount}
													</span>
												</Show>
											</div>

											<div class="mt-5">
												<button
													onClick={() => handleBuyWithStars(opt)}
													disabled={loadingOptionId() !== null}
													class={`w-full h-11 rounded-[14px] font-black text-[12px] uppercase tracking-wider transition-all active:scale-[0.96] flex items-center justify-center gap-1.5 shadow-md ${
														loadingOptionId() === opt.id ? 'bg-[#08090D] text-white/30 border border-white/5' : opt.popular ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black shadow-[0_4px_15px_rgba(245,158,11,0.3)]' : 'bg-[#3390ec] text-white hover:bg-[#2b7ec9] shadow-[0_4px_15px_rgba(51,144,236,0.3)]'
													}`}
												>
													{loadingOptionId() === opt.id ? (
														<span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
													) : (
														<><span class="material-symbols-outlined text-[18px]">stars</span><span dir="ltr">{opt.price.toLocaleString('en-US')} Stars</span></>
													)}
												</button>
											</div>
										</div>
									)}
								</For>
							</div>
						</Show>
					</Show>

					{/* ── CONVERT TAB (EXCHANGE) ── */}
					<Show when={activeTab() === 'convert'}>
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[28px] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
							
							<div class="flex items-center gap-2 mb-6 px-1">
								<span class="material-symbols-outlined text-white/40 text-[18px]">currency_exchange</span>
								<span class="text-white/50 text-[11px] font-black uppercase tracking-widest pt-0.5">
									{t('marketplace.exchangeRate') || 'RATE: 100K COINS = 1 FRG'}
								</span>
							</div>

							<form onSubmit={handleConvert} class="flex flex-col gap-5">
								<div>
									<label class="block text-white/70 text-[12px] font-bold mb-2.5 px-1">{t('marketplace.convertLabel') || 'سکه جهت تبدیل:'}</label>
									<div class="relative">
										<input
											type="number"
											value={convertAmount()}
											onInput={(e) => { setConvertAmount(e.target.value); setIsUserEdited(true); }}
											placeholder="MIN: 100,000"
											class="w-full bg-[#08090D] border border-white/10 focus:border-[#3390ec]/50 rounded-[18px] py-4 pl-4 pr-[85px] text-white font-mono font-black text-[16px] outline-none transition-all shadow-inner placeholder-white/20"
											dir="ltr"
										/>
										<div class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none bg-white/5 px-2.5 py-1.5 rounded-[10px] border border-white/5">
											<span class="material-symbols-outlined text-[#3390ec] text-[16px]">monetization_on</span>
											<span class="text-white/60 text-[10px] font-bold uppercase tracking-widest pt-0.5">COINS</span>
										</div>
									</div>

									{/* Percent Quick Actions */}
									<div class="flex gap-2 mt-3.5">
										{[0.25, 0.5, 0.75, 1.0].map((pct) => (
											<button
												type="button"
												onClick={() => setPercentAmount(pct)}
												class="flex-1 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/5 text-white/60 hover:text-white font-bold py-2.5 rounded-[12px] text-[11px] transition-all shadow-sm"
											>
												{pct === 1.0 ? 'MAX' : `${pct * 100}%`}
											</button>
										))}
									</div>
								</div>

								{/* Output Preview */}
								<Show when={calculatedFRG() > 0}>
									<div class="bg-gradient-to-r from-[#3390ec]/10 to-transparent border border-[#3390ec]/20 rounded-[20px] p-4 flex items-center justify-between mt-1 animate-fade-in shadow-[inset_0_0_20px_rgba(51,144,236,0.05)]">
										<div class="flex flex-col">
											<span class="text-[#3390ec]/70 text-[9px] font-black uppercase tracking-widest mb-0.5">سکه دریافتی:</span>
											<div class="text-white text-[24px] font-black font-mono tracking-tight" dir="ltr">
												{calculatedFRG().toLocaleString('en-US')}
												<span class="text-amber-400 text-[12px] font-black font-sans ml-1.5">FRG</span>
											</div>
										</div>
										<div class="w-10 h-10 rounded-[12px] bg-[#3390ec]/20 flex items-center justify-center border border-[#3390ec]/30 shadow-inner">
											<span class="material-symbols-outlined text-[#3390ec] text-[22px]">trending_up</span>
										</div>
									</div>
								</Show>

								{/* Messages */}
								<Show when={convertError()}>
									<div class="text-[#ff4a4a] text-[11px] font-bold text-center bg-[#ff4a4a]/10 py-3 rounded-[14px] border border-[#ff4a4a]/20 flex items-center justify-center gap-1.5 shadow-sm mt-1">
										<span class="material-symbols-outlined text-[16px]">error</span> {convertError()}
									</div>
								</Show>
								<Show when={convertSuccess()}>
									<div class="text-[#00ff88] text-[11px] font-bold text-center bg-[#00ff88]/10 py-3 rounded-[14px] border border-[#00ff88]/20 flex items-center justify-center gap-1.5 shadow-sm mt-1">
										<span class="material-symbols-outlined text-[16px]">check_circle</span> {convertSuccess()}
									</div>
								</Show>

								<button
									type="submit"
									disabled={convertLoading() || !convertAmount() || parseFloat(convertAmount()) < 100000}
									class={`w-full h-14 rounded-[16px] font-black text-[13px] uppercase tracking-widest transition-all active:scale-[0.97] flex items-center justify-center gap-2 mt-1 shadow-md border ${
										convertLoading() || !convertAmount() || parseFloat(convertAmount()) < 100000
											? 'bg-[#08090D] text-white/30 border-white/5 shadow-none'
											: 'bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] text-white hover:opacity-90 border-white/10 shadow-[0_8px_20px_rgba(51,144,236,0.3)]'
									}`}
								>
									{convertLoading() ? (
										<><span class="material-symbols-outlined text-[20px] animate-spin">progress_activity</span> EXCHANGING...</>
									) : (
										<><span class="material-symbols-outlined text-[20px]">swap_horizontal_circle</span> {t('marketplace.convertBtn') || 'تبدیل به سکه اصلی'}</>
									)}
								</button>
							</form>
						</div>
					</Show>
				</div>
			</div>
		</div>
	);
};

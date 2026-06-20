import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { backButton, hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { channelApi } from '@/shared/api/channel-management.js';
import { subscriptionApi, frgApi, SubscriptionPackage } from '@/shared/api/bot-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';

export const ManagedChannelsPage: Component = () => {
	const navigate = useNavigate();

	// Fetch all channels for the logged-in user
	const [channels, { refetch }] = createResource(
		() => true,
		() => channelApi.getUserChannels('all'),
	);

	const [channelToDelete, setChannelToDelete] = createSignal<any | null>(null);
	const [isDeleting, setIsDeleting] = createSignal(false);

	const [showSubscription, setShowSubscription] = createSignal(false);
	const [paymentStep, setPaymentStep] = createSignal<'package' | 'method'>('package');
	const [selectedChan, setSelectedChan] = createSignal<string>('');
	const [selectedPkg, setSelectedPkg] = createSignal<string>('');
	const [isProcessing, setIsProcessing] = createSignal(false);
	const [successMsg, setSuccessMsg] = createSignal('');
	const [errorMsg, setErrorMsg] = createSignal('');

	const [packages] = createResource(subscriptionApi.getPackages);
	const [_balance, { refetch: refetchBalance }] = createResource(frgApi.getBalance);

	const openSubscription = (channelId: string) => {
		setSelectedChan(channelId);
		setPaymentStep('package');
		setShowSubscription(true);
		hapticFeedback.impactOccurred('light');
	};

	const handleSubscribeAirdrop = async () => {
		if (!selectedPkg() || !selectedChan()) return;
		setIsProcessing(true);
		setErrorMsg('');
		try {
			await subscriptionApi.subscribeChannelWithAirdrop(selectedChan(), selectedPkg());
			hapticFeedback.notificationOccurred('success');
			setSuccessMsg('Subscription activated successfully!');
			setShowSubscription(false);
			refetch();
			refetchBalance();
		} catch (e: any) {
			const msg = e?.response?.data?.error || 'Payment failed';
			setErrorMsg(msg);
			hapticFeedback.notificationOccurred('error');
		} finally {
			setIsProcessing(false);
			setTimeout(() => {
				setSuccessMsg('');
				setErrorMsg('');
			}, 4000);
		}
	};

	const handleSubscribeStars = async () => {
		if (!selectedPkg() || !selectedChan()) return;
		setIsProcessing(true);
		setErrorMsg('');
		try {
			const res = await subscriptionApi.createChannelSubscriptionStarsInvoice(
				selectedChan(),
				selectedPkg(),
			);
			if (res.invoice_link) {
				const tg = (window as any).Telegram?.WebApp;
				if (tg?.openInvoice) {
					tg.openInvoice(res.invoice_link, (status: string) => {
						if (status === 'paid') {
							hapticFeedback.notificationOccurred('success');
							setShowSubscription(false);
							refetch();
						}
					});
				} else {
					openTelegramLink(res.invoice_link);
				}
			}
		} catch (e: any) {
			const msg = e?.response?.data?.error || 'Failed to create invoice';
			setErrorMsg(msg);
			hapticFeedback.notificationOccurred('error');
		} finally {
			setIsProcessing(false);
			setTimeout(() => {
				setSuccessMsg('');
				setErrorMsg('');
			}, 4000);
		}
	};

	const formatTimeRemaining = (dateStr: string) => {
		const date = new Date(dateStr);
		const now = new Date();
		const diff = date.getTime() - now.getTime();
		if (diff <= 0) return 'Expired';

		const days = Math.floor(diff / (1000 * 3600 * 24));
		const hours = Math.floor((diff % (1000 * 3600 * 24)) / (1000 * 3600));

		if (days > 0) return `${days}d ${hours}h left`;
		return `${hours}h left`;
	};

	const handleDeleteChannel = async () => {
		const channel = channelToDelete();
		if (!channel) return;

		setIsDeleting(true);
		try {
			await channelApi.disconnectChannel(channel.id);
			hapticFeedback.notificationOccurred('success');
			setChannelToDelete(null);
			refetch();
		} catch (e: any) {
			hapticFeedback.notificationOccurred('error');
		} finally {
			setIsDeleting(false);
		}
	};

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => window.history.back());
		onCleanup(() => off());
	});

	const handleConnectNew = () => {
		hapticFeedback.impactOccurred('medium');
		navigate('/channel/connect');
	};

	return (
		<div
			class={`min-h-screen bg-[#0f1014] pb-28 relative overflow-x-hidden text-white ${isRtl() ? 'rtl' : 'ltr'}`}
		>
			{/* Header */}
			<div class="px-5 pt-6 pb-4 bg-[#0f1014] sticky top-0 z-30 border-b border-[#1c1c1c] flex items-center gap-3">
				<button
					onClick={() => {
						hapticFeedback.impactOccurred('light');
						navigate('/dashboard');
					}}
					class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-90 transition-all shrink-0"
					aria-label="Back"
				>
					<span class="material-symbols-outlined text-white text-[20px] rtl:-scale-x-100">
						arrow_back
					</span>
				</button>
				<div class="flex flex-col gap-0.5 min-w-0">
					<h1 class="text-[18px] font-black text-white leading-tight truncate">
						{t('managedChannels.title')}
					</h1>
					<span class="text-[12px] text-on-surface-variant truncate">
						{t('managedChannels.description')}
					</span>
				</div>
			</div>

			<div class="px-5 pt-6 flex flex-col gap-6">
				{/* Connect New Channel Button */}
				<button
					onClick={handleConnectNew}
					class="w-full bg-[#1c1c1c] border border-[#32ade6]/30 hover:border-[#32ade6] hover:bg-[#32ade6]/10 text-[#32ade6] rounded-2xl py-4 flex items-center justify-center gap-2 font-bold transition-all shadow-sm group"
				>
					<div class="w-8 h-8 rounded-full bg-[#32ade6]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
						<span class="material-symbols-outlined text-[20px]">add</span>
					</div>
					{t('managedChannels.connectNew')}
				</button>

				{/* Channel List */}

				<Show
					when={channels() && channels()!.length > 0}
					fallback={
						!channels.loading ? (
						<Motion.div
							initial={{ opacity: 0, y: 15 }}
							animate={{ opacity: 1, y: 0 }}
							class="bg-[#1c1c1c] rounded-3xl p-6 flex flex-col items-center justify-center text-center gap-4 border border-[#2a2a2a]"
						>
							<div class="w-16 h-16 rounded-full bg-[#32ade6]/10 flex items-center justify-center mb-1">
								<span class="material-symbols-outlined text-[#32ade6] text-[32px]">campaign</span>
							</div>
							<h3 class="text-white font-black text-[18px]">{t('managedChannels.noChannels')}</h3>
							<p class="text-[13px] text-[#8e8e93] leading-relaxed max-w-[280px]">
								{isRtl()
									? 'هنوز کانالی متصل نشده. با ۳ مرحله ساده شروع کنید:'
									: 'No channels connected yet. Get started in 3 simple steps:'}
							</p>

							<div class="w-full flex flex-col gap-2.5 mt-2 text-start">
								<div class="flex items-center gap-3 bg-[#0f1014] rounded-xl p-3 border border-[#2a2a2a]">
									<div class="w-8 h-8 rounded-full bg-[#32ade6] text-black font-black flex items-center justify-center text-[14px] shrink-0">1</div>
									<span class="text-[13px] text-white">
										{isRtl()
											? 'ربات @iFragmentBot را به کانال‌های خود به عنوان مدیر اضافه کنید'
											: 'Add @iFragmentBot to your channels as admin'}
									</span>
								</div>
								<div class="flex items-center gap-3 bg-[#0f1014] rounded-xl p-3 border border-[#2a2a2a]">
									<div class="w-8 h-8 rounded-full bg-[#32ade6] text-black font-black flex items-center justify-center text-[14px] shrink-0">2</div>
									<span class="text-[13px] text-white">
										{isRtl()
											? 'آدرس کانال‌های ورودی و خروجی را وارد کنید'
											: 'Enter your input and output channel addresses'}
									</span>
								</div>
								<div class="flex items-center gap-3 bg-[#0f1014] rounded-xl p-3 border border-[#2a2a2a]">
									<div class="w-8 h-8 rounded-full bg-[#34c759] text-black font-black flex items-center justify-center text-[14px] shrink-0">✓</div>
									<span class="text-[13px] text-white">
										{isRtl()
											? 'از تمام قابلیت‌ها مثل هوش مصنوعی، قیف و پاسخگوی خودکار لذت ببرید!'
											: 'Enjoy AI posting, funnels, auto-responder and more!'}
									</span>
								</div>
							</div>

							<button
								onClick={handleConnectNew}
								class="mt-3 w-full h-12 bg-[#32ade6] text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-[#2b96c8] transition-all active:scale-95"
							>
								<span class="material-symbols-outlined text-[20px]">add</span>
								{isRtl() ? 'اتصال اولین کانال' : 'Connect Your First Channel'}
							</button>
						</Motion.div>
					) : (
						<div class="flex flex-col gap-3">
							<div class="flex items-center justify-between mb-1 pl-2">
								<div class="h-4 w-32 bg-[#2a2a2a] rounded animate-pulse"></div>
							</div>
							<For each={[1, 2, 3]}>
								{() => (
									<div class="bg-[#1c1c1c] rounded-3xl p-4 border border-[#2a2a2a] flex items-center gap-4">
										<div class="w-14 h-14 rounded-full bg-[#2a2a2a] animate-pulse shrink-0"></div>
										<div class="flex-1 flex flex-col gap-2">
											<div class="h-4 w-1/2 bg-[#2a2a2a] rounded animate-pulse"></div>
											<div class="h-3 w-1/3 bg-[#2a2a2a] rounded animate-pulse"></div>
										</div>
										<div class="w-10 h-10 rounded-full bg-[#2a2a2a] animate-pulse shrink-0"></div>
									</div>
								)}
							</For>
						</div>
					)
					}
				>
					<div class="flex flex-col gap-3">
						<div class="flex items-center justify-between mb-1 pl-2">
							<h2 class="text-[14px] font-bold text-[#8e8e93] uppercase tracking-wider">
								{t('managedChannels.yourChannels')}
							</h2>
						</div>

						<For each={channels()}>
							{(channel, i) => {
								const endDateStr =
									channel.subscription_status === 'trial' ? channel.trial_ends_at : channel.paid_until;
								return (
									<Motion.div
										initial={{ opacity: 0, scale: 0.95 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{ delay: 0.1 + i() * 0.05 }}
										class="bg-[#1c1c1c] rounded-3xl p-4 border border-[#2a2a2a] hover:border-[#32ade6]/50 flex flex-col gap-4 group transition-all"
									>
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-4 overflow-hidden">
												<div class="w-14 h-14 rounded-full bg-gradient-to-br from-[#32ade6] to-[#2b96c8] flex items-center justify-center font-black text-black text-xl shadow-lg group-hover:scale-105 transition-transform">
													{channel.avatar}
												</div>
												<div class="flex flex-col overflow-hidden">
													<span class="text-white font-bold text-[16px] truncate">{channel.title}</span>
													<span class="text-[13px] text-[#8e8e93]">
														{channel.members} {t('managedChannels.subscribers')}
													</span>
												</div>
											</div>
											<div class="flex flex-col items-end shrink-0">
												<span
													class={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
														channel.subscription_status === 'paid'
															? 'text-[#34c759] border-[#34c759]/20 bg-[#34c759]/5'
															: channel.subscription_status === 'trial'
																? 'text-[#ff9f0a] border-[#ff9f0a]/20 bg-[#ff9f0a]/5'
																: 'text-[#ff3b30] border-[#ff3b30]/20 bg-[#ff3b30]/5'
													}`}
												>
													{channel.subscription_status === 'paid'
														? 'Active'
														: channel.subscription_status === 'trial'
															? 'Trial'
															: 'Expired'}
												</span>
												<Show when={endDateStr && channel.subscription_status !== 'expired'}>
													<span class="text-[10px] text-[#8e8e93] font-medium mt-1 whitespace-nowrap">
														{formatTimeRemaining(endDateStr!)}
													</span>
												</Show>
											</div>
										</div>

										<div class="flex gap-2 w-full">
											<Show when={channel.subscription_status !== 'expired'}>
												<button
													onClick={() => {
														hapticFeedback.impactOccurred('light');
														navigate(`/channel/${channel.id}`);
													}}
													class="flex-1 h-11 rounded-xl text-[13px] font-black transition-all bg-[#2c2c2e] text-white border border-[#3a3a3c] hover:bg-[#3a3a3c]"
												>
													{t('botManage.manage')}
												</button>
											</Show>
											<button
												onClick={() => openSubscription(channel.id)}
												class={`flex-1 h-11 rounded-xl text-[13px] font-black transition-all border ${
													channel.subscription_status === 'paid'
														? 'bg-[#1c1c1c] text-[#8e8e93] border-[#2a2a2a] hover:bg-[#2a2a2a]'
														: 'bg-[#32ade6] text-black border-transparent shadow-[0_8px_20px_rgba(50,173,230,0.3)] hover:scale-[1.02]'
												}`}
											>
												{channel.subscription_status === 'paid'
													? t('botManage.extendSub' as any) || 'Extend'
													: t('botManage.buySubscription' as any) || 'Buy Subscription'}
											</button>
											<button
												onClick={(e) => {
													e.stopPropagation();
													hapticFeedback.impactOccurred('medium');
													setChannelToDelete(channel);
												}}
												class="w-11 h-11 rounded-xl bg-transparent flex items-center justify-center border border-[#ff3b30]/20 hover:bg-[#ff3b30]/10 text-[#ff3b30] transition-all"
												aria-label={t('managedChannels.delete' as any) || 'Delete'}
											>
												<span class="material-symbols-outlined text-[20px]">delete</span>
											</button>
										</div>
									</Motion.div>
								);
							}}
						</For>
					</div>
				</Show>
			</div>

			{/* Delete Channel Modal */}
			<Show when={channelToDelete()}>
				<Motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-5"
					onClick={(e) => {
						if (e.target === e.currentTarget && !isDeleting()) setChannelToDelete(null);
					}}
				>
					<Motion.div
						initial={{ scale: 0.9, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						transition={{ duration: 0.2, easing: [0.32, 0.72, 0, 1] }}
						class="w-full max-w-sm bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-6 flex flex-col items-center text-center"
					>
						<div class="w-16 h-16 rounded-full bg-[#ff3b30]/10 flex items-center justify-center mb-4">
							<span class="material-symbols-outlined text-[#ff3b30] text-[32px]">delete_forever</span>
						</div>
						
						<h3 class="text-[20px] font-black text-white mb-2">
							{t('managedChannels.deleteConfirmTitle' as any)}
						</h3>
						<p class="text-[14px] text-[#8e8e93] mb-6 leading-relaxed">
							{t('managedChannels.deleteConfirmDesc' as any)}
						</p>

						<div class="w-full flex gap-3">
							<button
								onClick={() => setChannelToDelete(null)}
								disabled={isDeleting()}
								class="flex-1 h-12 rounded-2xl font-bold text-[15px] bg-[#2a2a2a] text-white hover:bg-[#333] transition-all disabled:opacity-50"
							>
								{t('common.cancel')}
							</button>
							<button
								onClick={handleDeleteChannel}
								disabled={isDeleting()}
								class="flex-1 h-12 rounded-2xl font-bold text-[15px] bg-[#ff3b30] text-white hover:bg-[#ff453a] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(255,59,48,0.2)]"
							>
								<Show
									when={!isDeleting()}
									fallback={
										<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
									}
								>
									{t('managedChannels.delete' as any)}
								</Show>
							</button>
						</div>
					</Motion.div>
				</Motion.div>
			</Show>

			{/* Subscription Bottom Sheet */}
			<Show when={showSubscription()}>
				<Motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					class="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-end justify-center"
					onClick={(e) => {
						if (e.target === e.currentTarget) setShowSubscription(false);
					}}
				>
					<Motion.div
						initial={{ y: '100%' }}
						animate={{ y: 0 }}
						transition={{ duration: 0.4, easing: [0.32, 0.72, 0, 1] }}
						class="w-full max-h-[85vh] bg-[#1c1c1c] rounded-t-[2.5rem] border-t border-[#2a2a2a] p-6 overflow-y-auto no-scrollbar shadow-2xl animate-fade-in"
					>
						{/* Status Messages */}
						<Show when={successMsg()}>
							<div class="bg-[#34c759]/10 border border-[#34c759]/30 text-[#34c759] rounded-2xl px-4 py-3 flex items-center gap-2 text-[13px] font-bold mb-4">
								<span class="material-symbols-outlined text-[18px]">check_circle</span>
								{successMsg()}
							</div>
						</Show>
						<Show when={errorMsg()}>
							<div class="bg-[#ff3b30]/10 border border-[#ff3b30]/30 text-[#ff3b30] rounded-2xl px-4 py-3 flex items-center gap-2 text-[13px] font-bold mb-4">
								<span class="material-symbols-outlined text-[18px]">error</span>
								{errorMsg()}
							</div>
						</Show>

						{/* Handle */}
						<div class="w-12 h-1.5 bg-[#3a3a3a] rounded-full mx-auto mb-6" />

						{paymentStep() === 'package' ? (
							<>
								<h3 class="text-[20px] font-black text-white mb-2 leading-tight">
									{t('botManage.choosePackage' as any) || 'Choose Subscription'}
								</h3>
								<p class="text-[13px] font-medium text-[#8e8e93] mb-6">
									Select a premium package for your channel
								</p>

								{/* Package Cards */}
								<div class="space-y-3">
									<For each={packages() || []}>
										{(pkg: SubscriptionPackage) => (
											<button
												onClick={() => {
													setSelectedPkg(pkg.id);
													hapticFeedback.selectionChanged();
												}}
												class={`w-full rounded-3xl p-5 flex items-center justify-between border-2 transition-all active:scale-[0.98] ${
													selectedPkg() === pkg.id
														? 'border-[#32ade6] bg-[#32ade6]/10 shadow-lg'
														: 'border-[#2a2a2a] bg-[#242426] hover:border-[#3a3a3a]'
												}`}
											>
												<div class="flex flex-col items-start gap-1">
													<div class="flex items-center gap-2">
														<span
															class={`text-[16px] font-black ${selectedPkg() === pkg.id ? 'text-white' : 'text-white/90'}`}
														>
															{pkg.name}
														</span>
														<Show when={pkg.discount}>
															<span class="text-[10px] font-black text-[#34c759] bg-[#34c759]/10 px-2.5 py-1 rounded-full uppercase">
																-{pkg.discount}
															</span>
														</Show>
													</div>
													<span class="text-[12px] font-bold text-[#8e8e93]">
														Premium Channel Services
													</span>
												</div>
												<div class="flex items-baseline gap-1.5">
													<span class="text-2xl font-black text-white">
														{(pkg.price_frg * 100000).toLocaleString()}
													</span>
													<span class="text-[13px] font-black text-[#32ade6]">
														{t('airdrop.boosters.currency')}
													</span>
												</div>
											</button>
										)}
									</For>
								</div>

								{/* Continue Button */}
								<button
									onClick={() => {
										hapticFeedback.impactOccurred('medium');
										setPaymentStep('method');
									}}
									disabled={!selectedPkg()}
									class="w-full h-16 bg-[#32ade6] hover:bg-[#2b96c8] text-black rounded-[1.5rem] font-black text-[17px] mt-8 transition-all disabled:opacity-40 flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(50,173,230,0.3)] active:scale-95"
								>
									Continue to Payment
								</button>
							</>
						) : (
							<>
								<div class="flex items-center gap-4 mb-6">
									<button
										onClick={() => setPaymentStep('package')}
										class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center hover:bg-[#2a2a2a]"
									>
										<span class="material-symbols-outlined text-[20px]">arrow_back</span>
									</button>
									<div>
										<h3 class="text-[20px] font-black text-white leading-tight">
											Select Payment Method
										</h3>
										<p class="text-[13px] font-medium text-[#8e8e93]">Choose how you want to pay</p>
									</div>
								</div>

								<div class="space-y-4 mt-8">
									{/* Telegram Stars Button */}
									<button
										onClick={handleSubscribeStars}
										disabled={isProcessing()}
										class="w-full relative group overflow-hidden bg-gradient-to-r from-[#2c2d30] to-[#1c1d20] border border-[#ffb900]/30 rounded-[1.5rem] p-5 text-left transition-all active:scale-[0.98] hover:border-[#ffb900]/60"
									>
										<div class="absolute right-[-20px] top-[-20px] w-24 h-24 bg-[#ffb900]/10 rounded-full blur-2xl group-hover:bg-[#ffb900]/20 transition-all" />
										<div class="relative flex items-center gap-4 z-10">
											<div class="w-12 h-12 rounded-full bg-[#ffb900]/10 flex items-center justify-center border border-[#ffb900]/20 shadow-inner">
												<span class="text-[24px]">⭐</span>
											</div>
											<div class="flex-1">
												<h4 class="text-[17px] font-black text-white mb-0.5">Telegram Stars</h4>
												<p class="text-[13px] font-medium text-[#8e8e93]">Fast & native payment</p>
											</div>
											<span class="material-symbols-outlined text-[#ffb900]">chevron_right</span>
										</div>
									</button>

									{/* Airdrop Coins Button */}
									<button
										onClick={handleSubscribeAirdrop}
										disabled={isProcessing()}
										class="w-full relative group overflow-hidden bg-gradient-to-r from-[#2c2d30] to-[#1c1d20] border border-[#32ade6]/30 rounded-[1.5rem] p-5 text-left transition-all active:scale-[0.98] hover:border-[#32ade6]/60"
									>
										<div class="absolute right-[-20px] top-[-20px] w-24 h-24 bg-[#32ade6]/10 rounded-full blur-2xl group-hover:bg-[#32ade6]/20 transition-all" />
										<div class="relative flex items-center gap-4 z-10">
											<div class="w-12 h-12 rounded-full bg-[#32ade6]/10 flex items-center justify-center border border-[#32ade6]/20 shadow-inner">
												<span class="material-symbols-outlined text-[#32ade6] text-[24px]">
													toll
												</span>
											</div>
											<div class="flex-1">
												<h4 class="text-[17px] font-black text-white mb-0.5">Airdrop Coins</h4>
												<p class="text-[13px] font-medium text-[#8e8e93]">Use earned balance</p>
											</div>
											<span class="material-symbols-outlined text-[#32ade6]">chevron_right</span>
										</div>
									</button>
								</div>
							</>
						)}

						{isProcessing() && (
							<div class="absolute inset-0 bg-[#0f1014]/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center rounded-t-[2.5rem]">
								<span class="w-10 h-10 border-4 border-[#32ade6]/30 border-t-[#32ade6] rounded-full animate-spin mb-4" />
								<span class="text-[15px] font-bold text-white animate-pulse">Processing...</span>
							</div>
						)}
					</Motion.div>
				</Motion.div>
			</Show>
		</div>
	);
};

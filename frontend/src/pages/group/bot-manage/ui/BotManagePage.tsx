import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { ManagedGroup, SubscriptionPackage } from '@/shared/api/bot-management.js';
import { botApi, frgApi, subscriptionApi, groupApi } from '@/shared/api/bot-management.js';
import { channelApi } from '@/shared/api/channel-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';

export const BotManagePage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();
	const botId = params.botId;

	const [showSubscription, setShowSubscription] = createSignal(false);
	const [paymentStep, setPaymentStep] = createSignal<'package' | 'method'>('package');
	const [selectedGroup, setSelectedGroup] = createSignal<string>('');
	const [selectedPkg, setSelectedPkg] = createSignal<string>('');
	const [isProcessing, setIsProcessing] = createSignal(false);
	const [successMsg, setSuccessMsg] = createSignal('');
	const [errorMsg, setErrorMsg] = createSignal('');

	const [groupToDelete, setGroupToDelete] = createSignal<ManagedGroup | null>(null);
	const [isDeletingGroup, setIsDeletingGroup] = createSignal(false);

	const [bot] = createResource(
		() => botId,
		(id) => botApi.getBot(id),
	);

	const [groups, { refetch: refetchGroups }] = createResource(
		() => botId,
		(id) => botApi.listGroups(id),
	);

	const [_channels] = createResource(
		() => botId,
		(id) => channelApi.getUserChannels(id),
	);

	const [packages] = createResource(subscriptionApi.getPackages);


	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			if (showSubscription()) {
				setShowSubscription(false);
			} else {
				navigate('/managed-bots');
			}
		});
		onCleanup(() => off());
	});

	const handleInvite = () => {
		if (!bot()) return;
		const url = `https://t.me/${bot()!.bot_username.replace('@', '')}?startgroup=start&admin=restrict_members+delete_messages+ban_users`;
		try {
			openTelegramLink(url);
		} catch (_e) {
			window.open(url, '_blank');
		}
	};

	const openSubscription = (groupId: string) => {
		setSelectedGroup(groupId);
		setPaymentStep('package');
		setShowSubscription(true);
		hapticFeedback.impactOccurred('light');
	};

	const handleSubscribeAirdrop = async () => {
		if (!selectedPkg() || !selectedGroup()) return;
		setIsProcessing(true);
		setErrorMsg('');
		try {
			await subscriptionApi.subscribeWithAirdrop(selectedGroup(), selectedPkg());
			hapticFeedback.notificationOccurred('success');
			setSuccessMsg(
				t('botManage.subscriptionSuccess' as any) || 'Subscription activated successfully!',
			);
			setShowSubscription(false);
			refetchGroups();
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

	const handleDeleteGroup = async () => {
		const group = groupToDelete();
		if (!group) return;

		setIsDeletingGroup(true);
		try {
			await groupApi.revokeGroup(group.id);
			hapticFeedback.notificationOccurred('success');
			setGroupToDelete(null);
			refetchGroups();
		} catch (e: any) {
			hapticFeedback.notificationOccurred('error');
		} finally {
			setIsDeletingGroup(false);
		}
	};

	const handleSubscribeStars = async () => {
		if (!selectedPkg() || !selectedGroup()) return;
		setIsProcessing(true);
		setErrorMsg('');
		try {
			const res = await subscriptionApi.createSubscriptionStarsInvoice(
				selectedGroup(),
				selectedPkg(),
			);
			if (res.invoice_link) {
				const tg = (window as any).Telegram?.WebApp;
				if (tg?.openInvoice) {
					tg.openInvoice(res.invoice_link, (status: string) => {
						if (status === 'paid') {
							hapticFeedback.notificationOccurred('success');
							setShowSubscription(false);
							refetchGroups();
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
		if (diff <= 0) return t('botManage.expired' as any);

		const days = Math.floor(diff / (1000 * 3600 * 24));
		const hours = Math.floor((diff % (1000 * 3600 * 24)) / (1000 * 3600));

		if (days > 0)
			return `${days}${t('botManage.daysLeft' as any)} ${hours}${t('botManage.hoursLeft' as any)}`;
		return `${hours}${t('botManage.hoursLeft' as any)}`;
	};

	return (
		<div
			class={`min-h-screen bg-[#0f1014] pb-32 relative text-white overflow-x-hidden ${isRtl() ? 'rtl' : 'ltr'}`}
		>
			{/* Header */}
			<div class="pt-8 pb-6 px-6 sticky top-0 bg-[#0f1014]/90 backdrop-blur-xl z-30 border-b border-[#1c1c1c] flex items-center justify-between">
				<div class="flex flex-col gap-1">
					<div class="flex items-center gap-2">
						<h1 class="text-2xl font-black text-white tracking-tight">{t('botManage.title')}</h1>
						<div class="w-2 h-2 rounded-full bg-[#34c759] shadow-[0_0_8px_rgba(52,199,89,0.4)]" />
					</div>
					<Show when={bot()}>
						<div class="flex items-center gap-1.5">
							<span class="text-[13px] font-bold text-[#3390ec]">@{bot()?.bot_username}</span>
							<span class="w-1 h-1 rounded-full bg-[#3a3a3c]" />
							<span class="text-[12px] font-medium text-[#8e8e93]">
								ID: {bot()?.id.slice(0, 8)}
							</span>
						</div>
					</Show>
				</div>

				<button
					onClick={() => {
						hapticFeedback.impactOccurred('light');
						navigate('/managed-bots');
					}}
					class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] transition-all active:scale-90"
				>
					<span class="material-symbols-outlined text-white text-[20px]">close</span>
				</button>
			</div>

			<div class="p-5 flex flex-col gap-8 max-w-md mx-auto">
				<Show when={bot()}>
					{/* Status Messages */}
					<Show when={successMsg()}>
						<Motion.div
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							class="bg-[#34c759]/10 border border-[#34c759]/30 text-[#34c759] rounded-2xl px-4 py-3 flex items-center gap-2 text-[13px] font-bold"
						>
							<span class="material-symbols-outlined text-[18px]">check_circle</span>
							{successMsg()}
						</Motion.div>
					</Show>
					<Show when={errorMsg()}>
						<Motion.div
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							class="bg-[#ff3b30]/10 border border-[#ff3b30]/30 text-[#ff3b30] rounded-2xl px-4 py-3 flex items-center gap-2 text-[13px] font-bold"
						>
							<span class="material-symbols-outlined text-[18px]">error</span>
							{errorMsg()}
						</Motion.div>
					</Show>

					{/* Bot Stats Cards */}
					<div class="grid grid-cols-2 gap-3">
						<div class="bg-[#1c1c1c] rounded-[1.75rem] border border-[#2a2a2a] p-4 flex flex-col gap-1">
							<span class="text-[11px] font-black text-[#8e8e93] uppercase tracking-wider">
								{t('botManage.managedGroups')}
							</span>
							<span class="text-2xl font-black text-white">{bot()?.managed_groups_count || 0}</span>
						</div>
						<div class="bg-[#1c1c1c] rounded-[1.75rem] border border-[#2a2a2a] p-4 flex flex-col gap-1">
							<span class="text-[11px] font-black text-[#8e8e93] uppercase tracking-wider">
								Subscription
							</span>
							<span
								class={`text-[15px] font-black uppercase ${bot()?.subscription_status === 'pro' ? 'text-[#ff9f0a]' : 'text-[#8e8e93]'}`}
							>
								{bot()?.subscription_status || 'Free'}
							</span>
						</div>
					</div>

					{/* Setup Bot Card */}
					<Motion.div
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						class="bg-[#1c1c1c] rounded-[2rem] border border-[#2a2a2a] overflow-hidden"
					>
						<div class="p-6 flex flex-col gap-5">
							<div class="flex items-center gap-3">
								<div class="w-12 h-12 rounded-2xl bg-[#3390ec]/10 flex items-center justify-center border border-[#3390ec]/20">
									<span class="material-symbols-outlined text-[#3390ec] text-[28px]">
										rocket_launch
									</span>
								</div>
								<div class="flex flex-col">
									<h3 class="text-lg font-black text-white leading-tight">
										{t('botManage.setupTitle')}
									</h3>
									<p class="text-[12px] font-medium text-[#8e8e93]">
										{t('botManage.setupSubtitle')}
									</p>
								</div>
							</div>

							<div class="space-y-4">
								<div class="flex items-start gap-3">
									<div class="w-6 h-6 rounded-full bg-[#2c2c2e] text-white text-[12px] font-black flex items-center justify-center shrink-0">
										1
									</div>
									<p class="text-[13px] text-[#8e8e93] leading-relaxed">
										<span class="text-white font-bold">{t('botManage.step1Title')}</span>:{' '}
										{t('botManage.step1Desc')}
									</p>
								</div>
								<div class="flex items-start gap-3">
									<div class="w-6 h-6 rounded-full bg-[#2c2c2e] text-white text-[12px] font-black flex items-center justify-center shrink-0">
										2
									</div>
									<p class="text-[13px] text-[#8e8e93] leading-relaxed">
										<span class="text-white font-bold">{t('botManage.step2Title')}</span>:{' '}
										{t('botManage.step2Desc')}
									</p>
								</div>
							</div>

							<button
								onClick={handleInvite}
								class="w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7bc9] text-white rounded-2xl font-black text-[16px] shadow-[0_15px_35px_rgba(51,144,236,0.25)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
							>
								<span class="material-symbols-outlined">person_add</span>
								{t('botManage.inviteBtn')}
							</button>
						</div>
					</Motion.div>

					{/* Connected Groups Section */}
					<div class="flex flex-col gap-4">
						<h2 class="text-xl font-black text-white px-2 flex items-center gap-3">
							<span class="w-1.5 h-6 bg-[#3390ec] rounded-full"></span>
							{t('botManage.connectedGroups')}
						</h2>

						<div class="flex flex-col gap-3">
							<Show when={!groups.loading && (!groups() || groups()!.length === 0)}>
								<div class="bg-[#1c1c1c] rounded-[2rem] p-10 border border-[#2a2a2a] flex flex-col items-center justify-center text-center gap-3 shadow-inner">
									<div class="w-16 h-16 rounded-full bg-[#2c2c2e] flex items-center justify-center border border-[#3a3a3c]">
										<span class="material-symbols-outlined text-[#3a3a3c] text-[32px]">forum</span>
									</div>
									<p class="text-[#8e8e93] text-sm font-bold">{t('botManage.noGroups')}</p>
								</div>
							</Show>

							<For each={groups() || []}>
								{(group: ManagedGroup, i) => {
									const endDateStr =
										group.subscription_status === 'trial' ? group.trial_ends_at : group.paid_until;
									return (
										<Motion.div
											initial={{ opacity: 0, x: -10 }}
											animate={{ opacity: 1, x: 0 }}
											transition={{ delay: 0.1 + i() * 0.08, duration: 0.4 }}
											class="bg-[#1c1c1c] rounded-[1.75rem] p-4 border border-[#2a2a2a] flex flex-col gap-4 group hover:border-[#3390ec]/30 transition-all shadow-lg active:scale-[0.99]"
										>
											<div class="flex items-center justify-between">
												<div class="flex items-center gap-4 overflow-hidden">
													<div class="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-[#3390ec]/10 to-transparent flex items-center justify-center border border-[#3390ec]/20 overflow-hidden">
														<Show
															when={group.photo_url}
															fallback={
																<span class="text-lg font-black text-[#3390ec]">
																	{group.chat_title ? group.chat_title.charAt(0) : 'G'}
																</span>
															}
														>
															<img
																src={group.photo_url}
																alt={group.chat_title}
																class="w-full h-full object-cover rounded-2xl"
																onError={(e) => {
																	(e.currentTarget as HTMLElement).style.display = 'none';
																}}
															/>
														</Show>
													</div>
													<div class="flex flex-col overflow-hidden">
														<h3 class="text-[16px] font-black text-white leading-tight mb-0.5 truncate">
															{group.chat_title}
														</h3>
														<span class="text-[12px] text-[#8e8e93] font-bold">
															{group.members_count.toLocaleString()} {t('botManage.members')}
														</span>
													</div>
												</div>

												<div class="flex flex-col items-end shrink-0">
													<button
														onClick={(e) => {
															e.stopPropagation();
															hapticFeedback.impactOccurred('medium');
															setGroupToDelete(group);
														}}
														class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#ff3b30]/10 text-[#555] hover:text-[#ff3b30] transition-all mb-1"
														aria-label={t('managedBots.delete' as any) || 'Delete'}
													>
														<span class="material-symbols-outlined text-[20px]">delete</span>
													</button>
													<span
														class={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
															group.subscription_status === 'paid'
																? 'text-[#34c759] border-[#34c759]/20 bg-[#34c759]/5'
																: group.subscription_status === 'trial'
																	? 'text-[#ff9f0a] border-[#ff9f0a]/20 bg-[#ff9f0a]/5'
																	: 'text-[#ff3b30] border-[#ff3b30]/20 bg-[#ff3b30]/5'
														}`}
													>
														{group.subscription_status === 'paid'
															? 'Active'
															: group.subscription_status === 'trial'
																? 'Trial'
																: t('botManage.expired' as any) || 'Expired'}
													</span>
													<Show when={endDateStr && group.subscription_status !== 'expired'}>
														<span class="text-[10px] text-[#8e8e93] font-medium mt-1 whitespace-nowrap">
															{formatTimeRemaining(endDateStr!)}
														</span>
													</Show>
												</div>
											</div>

											<div class="flex gap-2 w-full">
												<Show when={group.subscription_status !== 'expired'}>
													<button
														onClick={() => {
															hapticFeedback.impactOccurred('light');
															navigate(`/group/${group.id}`);
														}}
														class="flex-1 h-11 rounded-xl text-[13px] font-black transition-all bg-[#2c2c2e] text-white border border-[#3a3a3c] hover:bg-[#3a3a3c]"
													>
														{t('botManage.manage')}
													</button>
												</Show>
												<button
													onClick={() => openSubscription(group.id)}
													class={`flex-1 h-11 rounded-xl text-[13px] font-black transition-all border ${
														group.subscription_status === 'paid'
															? 'bg-[#1c1c1c] text-[#8e8e93] border-[#2a2a2a] hover:bg-[#2a2a2a]'
															: 'bg-[#3390ec] text-white border-transparent shadow-[0_8px_20px_rgba(51,144,236,0.3)] hover:scale-[1.02]'
													}`}
												>
													{group.subscription_status === 'paid'
														? t('botManage.extendSub' as any) || 'Extend'
														: t('botManage.buySubscription' as any) || 'Buy Subscription'}
												</button>
											</div>
										</Motion.div>
									);
								}}
							</For>
						</div>
					</div>
				</Show>
			</div>

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
						class="w-full max-h-[85vh] bg-[#1c1c1c] rounded-t-[2.5rem] border-t border-[#2a2a2a] p-6 overflow-y-auto no-scrollbar shadow-2xl"
					>
						{/* Handle */}
						<div class="w-12 h-1.5 bg-[#3a3a3a] rounded-full mx-auto mb-6" />

						{paymentStep() === 'package' ? (
							<>
								<h3 class="text-[20px] font-black text-white mb-1 leading-tight">
									{t('botManage.choosePackage' as any) || 'Choose a Plan'}
								</h3>
								<p class="text-[13px] font-medium text-[#8e8e93] mb-6">
									{t('botManage.selectPlan' as any) || 'Select a monthly plan for your'}{' '}
									{t('botManage.groupService' as any) || 'group'}
								</p>

								{/* Plan Cards */}
								<div class="space-y-3">
									<For each={packages() || []}>
										{(pkg: SubscriptionPackage) => (
											<button
												onClick={() => {
													setSelectedPkg(pkg.id);
													hapticFeedback.selectionChanged();
												}}
												class={`w-full rounded-3xl p-4 flex items-center justify-between border-2 transition-all active:scale-[0.98] relative overflow-hidden ${
													selectedPkg() === pkg.id
														? 'border-[#3390ec] bg-[#3390ec]/10 shadow-lg'
														: 'border-[#2a2a2a] bg-[#242426] hover:border-[#3a3a3a]'
												}`}
											>
												{/* Badge */}
												<Show when={pkg.badge}>
													<div class={`absolute top-0 ${isRtl() ? 'left-0 rounded-bl-xl rounded-tr-2xl' : 'right-0 rounded-br-xl rounded-tl-2xl'} px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
														pkg.badge === 'best_value'
															? 'bg-[#ff9f0a] text-black'
															: 'bg-[#3390ec] text-white'
													}`}>
														{pkg.badge === 'best_value'
															? (t('botManage.bestValue' as any) || 'Best Value')
															: (t('botManage.popular' as any) || 'Popular')}
													</div>
												</Show>

												<div class="flex flex-col items-start gap-0.5">
													<div class="flex items-center gap-2">
														<span class={`text-[16px] font-black ${selectedPkg() === pkg.id ? 'text-white' : 'text-white/90'}`}>
															{pkg.name}
														</span>
														<Show when={pkg.discount}>
															<span class="text-[10px] font-black text-[#34c759] bg-[#34c759]/10 px-2 py-0.5 rounded-full">
																-{pkg.discount}
															</span>
														</Show>
													</div>
													<span class="text-[11px] font-medium text-[#8e8e93]">
														{t('botManage.totalPrice' as any) || 'Total'}: ${pkg.price_usd.toFixed(2)} · {pkg.price_stars} ⭐
													</span>
												</div>
												<div class="flex flex-col items-end gap-0.5">
													<div class="flex items-baseline gap-0.5">
														<span class="text-[22px] font-black text-white">
															${pkg.price_per_month.toFixed(2)}
														</span>
														<span class="text-[12px] font-bold text-[#8e8e93]">
															{t('botManage.perMonth' as any) || '/mo'}
														</span>
													</div>
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
									class="w-full h-16 bg-[#3390ec] hover:bg-[#2b7bc9] text-white rounded-[1.5rem] font-black text-[17px] mt-8 transition-all disabled:opacity-40 flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(51,144,236,0.3)] active:scale-95"
								>
									{t('botManage.continuePayment' as any) || 'Continue to Payment'}
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
											{t('botManage.paymentMethodTitle' as any) || 'Payment Method'}
										</h3>
										<p class="text-[13px] font-medium text-[#8e8e93]">
											{t('botManage.paymentMethodDesc' as any) || 'Choose how you want to pay'}
										</p>
									</div>
								</div>

								{/* Selected plan summary */}
								<Show when={packages() && selectedPkg()}>
									{(() => {
										const pkg = (packages() || []).find((p: SubscriptionPackage) => p.id === selectedPkg());
										return pkg ? (
											<div class="bg-[#242426] rounded-2xl p-4 mb-6 border border-[#2a2a2a] flex items-center justify-between">
												<div class="flex flex-col gap-0.5">
													<span class="text-[15px] font-black text-white">{pkg.name}</span>
													<span class="text-[12px] text-[#8e8e93]">${pkg.price_per_month.toFixed(2)}{t('botManage.perMonth' as any) || '/mo'}</span>
												</div>
												<div class="flex flex-col items-end">
													<span class="text-[17px] font-black text-white">${pkg.price_usd.toFixed(2)}</span>
													<span class="text-[11px] text-[#8e8e93]">{pkg.price_stars} ⭐</span>
												</div>
											</div>
										) : null;
									})()}
								</Show>

								<div class="space-y-4">
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
												<h4 class="text-[17px] font-black text-white mb-0.5">
													{t('botManage.starsPayTitle' as any) || 'Telegram Stars'}
												</h4>
												<p class="text-[13px] font-medium text-[#8e8e93]">
													{t('botManage.starsPayDesc' as any) || 'Fast & native Telegram payment'}
												</p>
											</div>
											<Show when={packages() && selectedPkg()}>
												{(() => {
													const pkg = (packages() || []).find((p: SubscriptionPackage) => p.id === selectedPkg());
													return pkg ? (
														<span class="text-[15px] font-black text-[#ffb900]">{pkg.price_stars} ⭐</span>
													) : null;
												})()}
											</Show>
										</div>
									</button>

									{/* Airdrop Coins Button */}
									<button
										onClick={handleSubscribeAirdrop}
										disabled={isProcessing()}
										class="w-full relative group overflow-hidden bg-gradient-to-r from-[#2c2d30] to-[#1c1d20] border border-[#3390ec]/30 rounded-[1.5rem] p-5 text-left transition-all active:scale-[0.98] hover:border-[#3390ec]/60"
									>
										<div class="absolute right-[-20px] top-[-20px] w-24 h-24 bg-[#3390ec]/10 rounded-full blur-2xl group-hover:bg-[#3390ec]/20 transition-all" />
										<div class="relative flex items-center gap-4 z-10">
											<div class="w-12 h-12 rounded-full bg-[#3390ec]/10 flex items-center justify-center border border-[#3390ec]/20 shadow-inner">
												<span class="material-symbols-outlined text-[#3390ec] text-[24px]">
													toll
												</span>
											</div>
											<div class="flex-1">
												<h4 class="text-[17px] font-black text-white mb-0.5">
													{t('botManage.airdropPayTitle' as any) || 'Airdrop Coins'}
												</h4>
												<p class="text-[13px] font-medium text-[#8e8e93]">
													{t('botManage.airdropPayDesc' as any) || 'Use your earned coin balance'}
												</p>
											</div>
											<Show when={packages() && selectedPkg()}>
												{(() => {
													const pkg = (packages() || []).find((p: SubscriptionPackage) => p.id === selectedPkg());
													return pkg ? (
														<span class="text-[15px] font-black text-[#3390ec]">
															{(pkg.price_coins).toLocaleString()}
														</span>
													) : null;
												})()}
											</Show>
										</div>
									</button>
								</div>
							</>
						)}

						{isProcessing() && (
							<div class="absolute inset-0 bg-[#0f1014]/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center rounded-t-[2.5rem]">
								<span class="w-10 h-10 border-4 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin mb-4" />
								<span class="text-[15px] font-bold text-white animate-pulse">Processing...</span>
							</div>
						)}
					</Motion.div>
				</Motion.div>
			</Show>

			{/* Delete Group Modal */}
			<Show when={groupToDelete()}>
				<Motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center px-5"
					onClick={(e) => {
						if (e.target === e.currentTarget && !isDeletingGroup()) setGroupToDelete(null);
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
							{t('botManage.deleteConfirmTitle' as any) || 'Remove Group'}
						</h3>
						<p class="text-[14px] text-[#8e8e93] mb-6 leading-relaxed">
							{t('botManage.deleteConfirmDesc' as any) || 'Are you sure you want to remove this group? All settings will be lost and bot management will be disabled.'}
						</p>

						<div class="w-full flex gap-3">
							<button
								onClick={() => setGroupToDelete(null)}
								disabled={isDeletingGroup()}
								class="flex-1 h-12 rounded-2xl font-bold text-[15px] bg-[#2a2a2a] text-white hover:bg-[#333] transition-all disabled:opacity-50"
							>
								{t('common.cancel')}
							</button>
							<button
								onClick={handleDeleteGroup}
								disabled={isDeletingGroup()}
								class="flex-1 h-12 rounded-2xl font-bold text-[15px] bg-[#ff3b30] text-white hover:bg-[#ff453a] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(255,59,48,0.2)]"
							>
								<Show
									when={!isDeletingGroup()}
									fallback={
										<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
									}
								>
									{t('managedBots.delete' as any) || 'Delete'}
								</Show>
							</button>
						</div>
					</Motion.div>
				</Motion.div>
			</Show>
		</div>
	);
};

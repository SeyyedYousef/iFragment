import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { ManagedGroup, SubscriptionPackage } from '@/shared/api/bot-management.js';
import { botApi, groupApi, subscriptionApi } from '@/shared/api/bot-management.js';
import { channelApi } from '@/shared/api/channel-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';

const GroupAvatar: Component<{ photoUrl?: string; title?: string; sizeClass?: string; textClass?: string }> = (props) => {
	const [imgFailed, setImgFailed] = createSignal(false);
	const initial = () => (props.title?.trim() ? props.title.trim().charAt(0).toUpperCase() : 'G');

	return (
		<div class={`shrink-0 rounded-[16px] bg-[#08090D] flex items-center justify-center border border-white/10 overflow-hidden shadow-inner ${props.sizeClass || 'w-14 h-14'}`}>
			<Show
				when={props.photoUrl && !imgFailed()}
				fallback={<span class={`font-black text-[#3390ec] ${props.textClass || 'text-[18px]'}`}>{initial()}</span>}
			>
				<img
					src={props.photoUrl}
					alt={props.title || ''}
					class="w-full h-full object-cover"
					onError={() => setImgFailed(true)}
				/>
			</Show>
		</div>
	);
};

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

	const [bot] = createResource(() => botId, (id) => botApi.getBot(id));
	const [groups, { refetch: refetchGroups }] = createResource(() => botId, (id) => botApi.listGroups(id));
	const [_channels] = createResource(() => botId, (id) => channelApi.getUserChannels(id));
	const [packages] = createResource(subscriptionApi.getPackages);

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			try { hapticFeedback.impactOccurred('light'); } catch (_) {}
			if (showSubscription()) setShowSubscription(false);
			else navigate('/managed-bots');
		});
		onCleanup(() => { off(); backButton.hide(); });
	});

	const handleInvite = () => {
		if (!bot()) return;
		try { hapticFeedback.impactOccurred('medium'); } catch (_) {}
		const url = `https://t.me/${bot()!.bot_username.replace('@', '')}?startgroup=start&admin=restrict_members+delete_messages+ban_users`;
		try { openTelegramLink(url); } catch (_e) { window.open(url, '_blank'); }
	};

	const openSubscription = (groupId: string) => {
		setSelectedGroup(groupId);
		setPaymentStep('package');
		setShowSubscription(true);
		try { hapticFeedback.impactOccurred('light'); } catch (_) {}
	};

	const handleSubscribeAirdrop = async () => {
		if (!selectedPkg() || !selectedGroup()) return;
		setIsProcessing(true); setErrorMsg('');
		try {
			await subscriptionApi.subscribeWithAirdrop(selectedGroup(), selectedPkg());
			try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
			setSuccessMsg(t('botManage.subscriptionSuccess' as any) || 'Subscription activated successfully!');
			setShowSubscription(false);
			refetchGroups();
		} catch (e: any) {
			setErrorMsg(e?.response?.data?.error || 'Payment failed');
			try { hapticFeedback.notificationOccurred('error'); } catch (_) {}
		} finally {
			setIsProcessing(false);
			setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 4000);
		}
	};

	const handleDeleteGroup = async () => {
		const group = groupToDelete();
		if (!group) return;
		setIsDeletingGroup(true);
		try {
			await groupApi.revokeGroup(group.id);
			try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
			setGroupToDelete(null);
			refetchGroups();
		} catch (_e: any) {
			try { hapticFeedback.notificationOccurred('error'); } catch (_) {}
		} finally {
			setIsDeletingGroup(false);
		}
	};

	const handleSubscribeStars = async () => {
		if (!selectedPkg() || !selectedGroup()) return;
		setIsProcessing(true); setErrorMsg('');
		try {
			const res = await subscriptionApi.createSubscriptionStarsInvoice(selectedGroup(), selectedPkg());
			if (res.invoice_link) {
				const tg = (window as any).Telegram?.WebApp;
				if (tg?.openInvoice) {
					tg.openInvoice(res.invoice_link, (status: string) => {
						if (status === 'paid') {
							try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
							setShowSubscription(false);
							refetchGroups();
						}
					});
				} else {
					openTelegramLink(res.invoice_link);
				}
			}
		} catch (e: any) {
			setErrorMsg(e?.response?.data?.error || 'Failed to create invoice');
			try { hapticFeedback.notificationOccurred('error'); } catch (_) {}
		} finally {
			setIsProcessing(false);
			setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 4000);
		}
	};

	const formatTimeRemaining = (dateStr: string) => {
		const diff = new Date(dateStr).getTime() - new Date().getTime();
		if (diff <= 0) return t('botManage.expired' as any) || 'Expired';
		const days = Math.floor(diff / (1000 * 3600 * 24));
		const hours = Math.floor((diff % (1000 * 3600 * 24)) / (1000 * 3600));
		return days > 0 ? `${days}d ${hours}h` : `${hours}h left`;
	};

	return (
		<div class="min-h-screen bg-[#030303] pb-32 relative text-white overflow-x-hidden font-sans selection:bg-[#3390ec]/30" dir={isRtl() ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#3390ec]/15 via-[#8b5cf6]/5 to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/80 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between shadow-sm">
				<div class="flex flex-col gap-0.5">
					<div class="flex items-center gap-2.5">
						<h1 class="text-[22px] font-black text-white tracking-tight drop-shadow-sm">{t('botManage.title')}</h1>
						<div class="w-2 h-2 rounded-full bg-[#00ff88] shadow-[0_0_10px_rgba(0,255,136,0.6)] animate-pulse" />
					</div>
					<Show when={bot()}>
						<div class="flex items-center gap-2 opacity-80">
							<span class="text-[12px] font-bold text-[#3390ec] font-mono tracking-tight">@{bot()?.bot_username}</span>
							<span class="w-1 h-1 rounded-full bg-white/20" />
							<span class="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest">ID: {bot()?.id.slice(0, 8)}</span>
						</div>
					</Show>
				</div>
				<button onClick={() => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} navigate('/managed-bots'); }} class="w-10 h-10 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/70">
					<span class="material-symbols-outlined text-[22px]">close</span>
				</button>
			</div>

			<div class="p-5 flex flex-col gap-6 max-w-md mx-auto relative z-10">
				<Show when={bot()}>
					
					{/* Status Messages */}
					<Show when={successMsg()}>
						<Motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} class="bg-[#00ff88]/10 border border-[#00ff88]/20 text-[#00ff88] rounded-[16px] px-4 py-3.5 flex items-center gap-2.5 text-[12px] font-bold shadow-sm">
							<span class="material-symbols-outlined text-[18px]">check_circle</span> {successMsg()}
						</Motion.div>
					</Show>
					<Show when={errorMsg()}>
						<Motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} class="bg-[#ff4a4a]/10 border border-[#ff4a4a]/20 text-[#ff4a4a] rounded-[16px] px-4 py-3.5 flex items-center gap-2.5 text-[12px] font-bold shadow-sm">
							<span class="material-symbols-outlined text-[18px]">error</span> {errorMsg()}
						</Motion.div>
					</Show>

					{/* ═══════ BOT STATS HUD ═══════ */}
					<div class="grid grid-cols-2 gap-3.5">
						<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-4.5 flex flex-col justify-center shadow-sm">
							<span class="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">{t('botManage.managedGroups') || 'MANAGED GROUPS'}</span>
							<span class="text-[26px] font-black text-white font-mono tracking-tight drop-shadow-sm">{bot()?.managed_groups_count || 0}</span>
						</div>
						<div class={`bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-4.5 flex flex-col justify-center shadow-sm relative overflow-hidden ${bot()?.subscription_status === 'pro' ? 'border-amber-400/20' : ''}`}>
							<Show when={bot()?.subscription_status === 'pro'}><div class="absolute -right-6 -top-6 w-20 h-20 bg-amber-400/10 blur-2xl rounded-full pointer-events-none" /></Show>
							<span class="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">SUBSCRIPTION</span>
							<span class={`text-[20px] font-black uppercase tracking-wider drop-shadow-sm ${bot()?.subscription_status === 'pro' ? 'text-amber-400' : 'text-white/60'}`}>
								{bot()?.subscription_status || 'FREE'}
							</span>
						</div>
					</div>

					{/* ═══════ SETUP BOT CARD ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] border border-white/5 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
						<div class="p-6 flex flex-col gap-6">
							<div class="flex items-center gap-4">
								<div class="w-14 h-14 rounded-[18px] bg-gradient-to-br from-[#3390ec]/20 to-[#3390ec]/5 flex items-center justify-center border border-[#3390ec]/30 shadow-inner shrink-0">
									<span class="material-symbols-outlined text-[#3390ec] text-[30px] drop-shadow-md">rocket_launch</span>
								</div>
								<div class="flex flex-col min-w-0">
									<h3 class="text-[18px] font-black text-white leading-tight mb-1 truncate">{t('botManage.setupTitle') || 'Setup Bot'}</h3>
									<p class="text-[12px] font-medium text-white/50 leading-relaxed">{t('botManage.setupSubtitle') || 'Follow these steps to connect your group.'}</p>
								</div>
							</div>

							<div class="space-y-4">
								<div class="flex items-start gap-3.5 bg-[#08090D] p-3.5 rounded-[16px] border border-white/5 shadow-inner">
									<div class="w-7 h-7 rounded-[10px] bg-white/10 text-white text-[12px] font-black flex items-center justify-center shrink-0 border border-white/10">1</div>
									<p class="text-[12px] text-white/60 leading-relaxed pt-0.5"><span class="text-white font-bold">{t('botManage.step1Title') || 'Add Bot'}:</span> {t('botManage.step1Desc') || 'Invite the bot to your group.'}</p>
								</div>
								<div class="flex items-start gap-3.5 bg-[#08090D] p-3.5 rounded-[16px] border border-white/5 shadow-inner">
									<div class="w-7 h-7 rounded-[10px] bg-white/10 text-white text-[12px] font-black flex items-center justify-center shrink-0 border border-white/10">2</div>
									<p class="text-[12px] text-white/60 leading-relaxed pt-0.5"><span class="text-white font-bold">{t('botManage.step2Title') || 'Grant Rights'}:</span> {t('botManage.step2Desc') || 'Make the bot an admin with specific rights.'}</p>
								</div>
							</div>

							<button onClick={handleInvite} class="w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7bc9] hover:from-[#2b7bc9] hover:to-[#3390ec] text-white rounded-[16px] font-black text-[14px] uppercase tracking-widest shadow-[0_8px_20px_rgba(51,144,236,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2 border border-white/10 mt-1">
								<span class="material-symbols-outlined text-[20px]">person_add</span> {t('botManage.inviteBtn') || 'INVITE TO GROUP'}
							</button>
						</div>
					</Motion.div>

					{/* ═══════ CONNECTED GROUPS ═══════ */}
					<div class="flex flex-col gap-4 mt-2">
						<div class="flex items-center gap-2 px-1 mb-1">
							<span class="material-symbols-outlined text-[#3390ec] text-[20px]">forum</span>
							<h2 class="text-[13px] font-black text-white/80 uppercase tracking-widest">{t('botManage.connectedGroups') || 'CONNECTED GROUPS'}</h2>
						</div>

						<div class="flex flex-col gap-3.5">
							<Show when={!groups.loading && (!groups() || groups()!.length === 0)}>
								<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] p-10 border border-white/5 flex flex-col items-center justify-center text-center gap-3 shadow-sm border-dashed">
									<div class="w-16 h-16 rounded-[20px] bg-white/5 flex items-center justify-center border border-white/10 mb-2">
										<span class="material-symbols-outlined text-white/30 text-[32px]">group_off</span>
									</div>
									<p class="text-white/40 text-[13px] font-bold tracking-wide">{t('botManage.noGroups') || 'No groups connected yet.'}</p>
								</div>
							</Show>

							<For each={groups() || []}>
								{(group: ManagedGroup, i) => {
									const isPaid = group.subscription_status === 'paid';
									const isTrial = group.subscription_status === 'trial';
									const isExpired = group.subscription_status === 'expired';
									const endDateStr = isTrial ? group.trial_ends_at : group.paid_until;

									return (
										<Motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i() * 0.08, duration: 0.4 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] p-4.5 border border-white/5 flex flex-col gap-4 hover:border-white/15 transition-all shadow-sm">
											<div class="flex items-center justify-between">
												
												{/* Avatar & Title */}
												<div class="flex items-center gap-3.5 overflow-hidden flex-1 pr-2">
													<GroupAvatar photoUrl={group.photo_url} title={group.chat_title} />
													<div class="flex flex-col overflow-hidden">
														<h3 class="text-[15px] font-black text-white leading-tight mb-1 truncate">{group.chat_title}</h3>
														<div class="flex items-center gap-1.5 opacity-60">
															<span class="material-symbols-outlined text-[14px]">group</span>
															<span class="text-[11px] font-mono font-bold pt-0.5">{group.members_count.toLocaleString()} {t('botManage.members')}</span>
														</div>
													</div>
												</div>

												{/* Status Badge & Delete */}
												<div class="flex flex-col items-end shrink-0 gap-1.5">
													<button onClick={(e) => { e.stopPropagation(); try { hapticFeedback.impactOccurred('medium'); } catch (_) {} setGroupToDelete(group); }} class="w-8 h-8 rounded-[10px] flex items-center justify-center hover:bg-[#ff4a4a]/10 text-white/30 hover:text-[#ff4a4a] transition-colors border border-transparent hover:border-[#ff4a4a]/20" aria-label="Delete">
														<span class="material-symbols-outlined text-[18px]">delete</span>
													</button>
													<span class={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-[8px] border shadow-sm ${isPaid ? 'text-[#00ff88] border-[#00ff88]/30 bg-[#00ff88]/10' : isTrial ? 'text-amber-400 border-amber-400/30 bg-amber-400/10' : 'text-[#ff4a4a] border-[#ff4a4a]/30 bg-[#ff4a4a]/10'}`}>
														{isPaid ? 'ACTIVE' : isTrial ? 'TRIAL' : t('botManage.expired' as any) || 'EXPIRED'}
													</span>
													<Show when={endDateStr && !isExpired}>
														<span class="text-[10px] text-white/40 font-mono font-bold mt-0.5 whitespace-nowrap">{formatTimeRemaining(endDateStr!)}</span>
													</Show>
												</div>
											</div>

											{/* Actions */}
											<div class="flex gap-2.5 w-full pt-1">
												<Show when={!isExpired}>
													<button onClick={() => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} navigate(`/group/${group.id}`); }} class="flex-1 h-12 rounded-[14px] text-[12px] font-black uppercase tracking-widest transition-all bg-white/5 text-white border border-white/10 hover:bg-white/10 active:scale-95 shadow-sm">
														{t('botManage.manage') || 'MANAGE'}
													</button>
												</Show>
												<button onClick={() => openSubscription(group.id)} class={`flex-1 h-12 rounded-[14px] text-[12px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 border ${isPaid ? 'bg-[#08090D] text-white/60 border-white/5 hover:bg-white/5' : 'bg-[#3390ec] text-white border-transparent shadow-[0_8px_20px_rgba(51,144,236,0.3)] hover:bg-[#2b7ec9]'}`}>
													{isPaid ? (t('botManage.extendSub' as any) || 'EXTEND') : (t('botManage.buySubscription' as any) || 'SUBSCRIBE')}
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

			{/* ═══════ SUBSCRIPTION PAYMENT GATE (Bottom Sheet) ═══════ */}
			<Show when={showSubscription()}>
				<Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} class="fixed inset-0 bg-[#030303]/90 backdrop-blur-2xl z-[100] flex items-end justify-center" onClick={(e) => { if (e.target === e.currentTarget) setShowSubscription(false); }}>
					<Motion.div initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ duration: 0.35, easing: [0.32, 0.72, 0, 1] }} class="w-full max-h-[92vh] bg-[#12141C] rounded-t-[32px] border-t border-white/10 p-6 overflow-y-auto no-scrollbar shadow-[0_-30px_80px_rgba(0,0,0,0.8)] relative" dir={isRtl() ? 'rtl' : 'ltr'}>
						
						<div class="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />

						<Show when={successMsg()}><div class="bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] rounded-[16px] px-4 py-3.5 flex items-center gap-2.5 text-[12px] font-bold mb-5 shadow-sm"><span class="material-symbols-outlined text-[20px]">check_circle</span>{successMsg()}</div></Show>
						<Show when={errorMsg()}><div class="bg-[#ff4a4a]/10 border border-[#ff4a4a]/30 text-[#ff4a4a] rounded-[16px] px-4 py-3.5 flex items-center gap-2.5 text-[12px] font-bold mb-5 shadow-sm"><span class="material-symbols-outlined text-[20px]">error</span>{errorMsg()}</div></Show>

						{paymentStep() === 'package' ? (
							<>
								<div class="flex flex-col items-center text-center gap-2 mb-8">
									<div class="w-16 h-16 rounded-[20px] bg-gradient-to-br from-[#3390ec]/20 to-transparent border border-white/10 flex items-center justify-center shadow-[inset_0_2px_10px_rgba(255,255,255,0.05),0_10px_30px_rgba(51,144,236,0.15)] mb-2">
										<span class="material-symbols-outlined text-[36px] text-[#3390ec] drop-shadow-md">workspace_premium</span>
									</div>
									<h3 class="text-[22px] font-black text-white leading-tight tracking-tight">{t('botManage.choosePackage' as any) || 'Choose a Plan'}</h3>
									<p class="text-[13px] font-medium text-white/50 max-w-xs">{t('botManage.selectPlan' as any) || 'Select a monthly plan for your group.'}</p>
								</div>

								<div class="space-y-3.5 mb-8">
									<For each={packages() || []}>
										{(pkg: SubscriptionPackage) => (
											<button onClick={() => { setSelectedPkg(pkg.id); try { hapticFeedback.selectionChanged(); } catch (_) {} }} class={`w-full rounded-[24px] p-4.5 flex items-center justify-between border-[1.5px] transition-all active:scale-[0.98] relative overflow-hidden text-start ${selectedPkg() === pkg.id ? 'border-[#3390ec] bg-[#3390ec]/10 shadow-[0_8px_24px_rgba(51,144,236,0.15)]' : 'border-white/10 bg-[#08090D] hover:border-white/20 hover:bg-[#161b28]'}`}>
												<Show when={selectedPkg() === pkg.id}><div class="absolute -right-6 -top-6 w-24 h-24 bg-[#3390ec]/10 rounded-full blur-2xl pointer-events-none" /></Show>
												<Show when={pkg.badge}>
													<div class={`absolute top-0 ${isRtl() ? 'left-0 rounded-bl-[12px]' : 'right-0 rounded-br-[12px]'} px-3 py-1 text-[9px] font-black uppercase tracking-widest shadow-sm ${pkg.badge === 'best_value' ? 'bg-amber-400 text-black' : 'bg-[#3390ec] text-white'}`}>
														{pkg.badge === 'best_value' ? (t('botManage.bestValue' as any) || 'BEST VALUE') : (t('botManage.popular' as any) || 'POPULAR')}
													</div>
												</Show>

												<div class="flex flex-col items-start gap-1 z-10 relative">
													<div class="flex items-center gap-2">
														<span class={`text-[17px] font-black ${selectedPkg() === pkg.id ? 'text-white' : 'text-white/90'}`}>{pkg.name}</span>
														<Show when={pkg.discount}><span class="text-[10px] font-black text-[#00ff88] bg-[#00ff88]/10 px-2 py-0.5 rounded-[6px] border border-[#00ff88]/20 uppercase tracking-widest shadow-sm">SAVE {pkg.discount}</span></Show>
													</div>
													<span class="text-[12px] font-mono font-medium text-white/50">
														TOTAL: ${pkg.price_usd.toFixed(2)} <span class="mx-1">•</span> {pkg.price_stars} ⭐
													</span>
												</div>
												<div class="flex flex-col items-end gap-0.5 z-10 relative">
													<div class="flex items-baseline gap-1" dir="ltr">
														<span class="text-[26px] font-black font-mono tracking-tight text-white">${pkg.price_per_month.toFixed(2)}</span>
														<span class="text-[11px] font-bold text-white/40 uppercase tracking-widest">/MO</span>
													</div>
												</div>
											</button>
										)}
									</For>
								</div>

								<button onClick={() => { try { hapticFeedback.impactOccurred('medium'); } catch (_) {} setPaymentStep('method'); }} disabled={!selectedPkg()} class="w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] text-white rounded-[16px] font-black text-[14px] uppercase tracking-widest transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(51,144,236,0.3)] active:scale-95 border border-white/10">
									{t('botManage.continuePayment' as any) || 'CONTINUE'} <span class="material-symbols-outlined text-[20px] rtl:-scale-x-100">arrow_forward</span>
								</button>
							</>
						) : (
							<>
								<div class="flex items-center gap-4 mb-8">
									<button onClick={() => setPaymentStep('package')} class="w-10 h-10 rounded-[12px] bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all text-white/70">
										<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">arrow_back</span>
									</button>
									<div class="flex flex-col">
										<h3 class="text-[20px] font-black text-white leading-tight tracking-tight">{t('botManage.paymentMethodTitle' as any) || 'Payment Method'}</h3>
										<p class="text-[12px] font-medium text-white/50">{t('botManage.paymentMethodDesc' as any) || 'Choose how you want to pay'}</p>
									</div>
								</div>

								<Show when={packages() && selectedPkg()}>
									{(() => {
										const pkg = (packages() || []).find((p: SubscriptionPackage) => p.id === selectedPkg());
										return pkg ? (
											<div class="bg-[#08090D] rounded-[20px] p-5 mb-6 border border-white/5 flex items-center justify-between shadow-inner">
												<div class="flex flex-col gap-1">
													<span class="text-[16px] font-black text-white">{pkg.name}</span>
													<span class="text-[12px] font-mono text-white/50">${pkg.price_per_month.toFixed(2)}/mo</span>
												</div>
												<div class="flex flex-col items-end gap-1">
													<span class="text-[20px] font-black font-mono text-white tracking-tight">${pkg.price_usd.toFixed(2)}</span>
													<span class="text-[11px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-[6px] border border-amber-400/20">{pkg.price_stars} STARS</span>
												</div>
											</div>
										) : null;
									})()}
								</Show>

								<div class="space-y-3.5">
									<button onClick={handleSubscribeStars} disabled={isProcessing()} class="w-full relative group overflow-hidden bg-[#08090D] border border-amber-400/20 hover:border-amber-400/50 rounded-[24px] p-4.5 text-left transition-all active:scale-[0.98] disabled:opacity-50 shadow-md">
										<div class="absolute -right-6 -top-6 w-24 h-24 bg-amber-400/10 rounded-full blur-2xl group-hover:bg-amber-400/20 transition-all pointer-events-none" />
										<div class="relative flex items-center justify-between gap-3 z-10 w-full">
											<div class="flex items-center gap-4 flex-1 min-w-0">
												<div class="w-12 h-12 rounded-[16px] bg-amber-400/10 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-inner">
													<span class="material-symbols-outlined text-amber-400 text-[26px]">star</span>
												</div>
												<div class="flex flex-col text-start min-w-0">
													<h4 class="text-[15px] font-black text-white truncate">{t('botManage.starsPayTitle' as any) || 'Telegram Stars'}</h4>
													<span class="text-[11px] font-medium text-white/50 mt-0.5 truncate">{t('botManage.starsPayDesc' as any) || 'Native fast payment'}</span>
												</div>
											</div>
										</div>
									</button>

									<button onClick={handleSubscribeAirdrop} disabled={isProcessing()} class="w-full relative group overflow-hidden bg-[#08090D] border border-cyan-400/20 hover:border-cyan-400/50 rounded-[24px] p-4.5 text-left transition-all active:scale-[0.98] disabled:opacity-50 shadow-md">
										<div class="absolute -right-6 -top-6 w-24 h-24 bg-cyan-400/10 rounded-full blur-2xl group-hover:bg-cyan-400/20 transition-all pointer-events-none" />
										<div class="relative flex items-center justify-between gap-3 z-10 w-full">
											<div class="flex items-center gap-4 flex-1 min-w-0">
												<div class="w-12 h-12 rounded-[16px] bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center shrink-0 shadow-inner">
													<span class="material-symbols-outlined text-cyan-400 text-[26px]">toll</span>
												</div>
												<div class="flex flex-col text-start min-w-0">
													<h4 class="text-[15px] font-black text-white truncate">{t('botManage.airdropPayTitle' as any) || 'Airdrop Coins'}</h4>
													<span class="text-[11px] font-medium text-white/50 mt-0.5 truncate">{t('botManage.airdropPayDesc' as any) || 'Use your mined balance'}</span>
												</div>
											</div>
										</div>
									</button>
								</div>
							</>
						)}

						<Show when={isProcessing()}>
							<div class="absolute inset-0 bg-[#12141C]/90 backdrop-blur-md z-30 flex flex-col items-center justify-center rounded-t-[32px]">
								<span class="w-12 h-12 border-4 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin mb-4 shadow-[0_0_15px_#3390ec]" />
								<span class="text-[14px] font-black uppercase tracking-widest text-white animate-pulse">PROCESSING...</span>
							</div>
						</Show>
					</Motion.div>
				</Motion.div>
			</Show>

			{/* ═══════ DELETE GROUP MODAL (Danger Zone) ═══════ */}
			<Show when={groupToDelete()}>
				<Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} class="fixed inset-0 bg-[#030303]/90 backdrop-blur-md z-[150] flex items-center justify-center px-5" onClick={(e) => { if (e.target === e.currentTarget && !isDeletingGroup()) setGroupToDelete(null); }}>
					<Motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3, easing: [0.32, 0.72, 0, 1] }} class="w-full max-w-sm bg-[#12141C] rounded-[32px] border border-white/10 p-7 flex flex-col items-center text-center shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative overflow-hidden">
						<div class="absolute -top-10 -left-10 w-32 h-32 bg-[#ff4a4a]/20 blur-3xl rounded-full pointer-events-none" />
						
						<div class="w-20 h-20 rounded-[24px] bg-[#ff4a4a]/10 border border-[#ff4a4a]/30 flex items-center justify-center mb-5 shadow-inner relative z-10">
							<span class="material-symbols-outlined text-[#ff4a4a] text-[40px] drop-shadow-md">delete_forever</span>
						</div>

						<h3 class="text-[22px] font-black text-white mb-2 tracking-tight relative z-10">{t('botManage.deleteConfirmTitle' as any) || 'Remove Group?'}</h3>
						<p class="text-[13px] text-white/50 mb-8 leading-relaxed font-medium px-2 relative z-10">
							{t('botManage.deleteConfirmDesc' as any) || 'This action cannot be undone. All settings and management features will be disabled.'}
						</p>

						<div class="w-full flex flex-col gap-3 relative z-10">
							<button onClick={handleDeleteGroup} disabled={isDeletingGroup()} class="w-full h-14 rounded-[16px] font-black text-[14px] uppercase tracking-widest bg-[#ff4a4a] hover:bg-[#ff3b30] text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(255,74,74,0.3)] active:scale-95 border border-white/10">
								<Show when={!isDeletingGroup()} fallback={<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}>
									<span class="material-symbols-outlined text-[20px]">warning</span> {t('managedBots.delete' as any) || 'YES, REMOVE'}
								</Show>
							</button>
							<button onClick={() => setGroupToDelete(null)} disabled={isDeletingGroup()} class="w-full h-14 rounded-[16px] font-bold text-[14px] uppercase tracking-widest bg-transparent hover:bg-white/5 text-white/60 hover:text-white transition-all disabled:opacity-50 active:scale-95 border border-transparent hover:border-white/5">
								{t('common.cancel') || 'CANCEL'}
							</button>
						</div>
					</Motion.div>
				</Motion.div>
			</Show>
		</div>
	);
};

import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { backButton, openTelegramLink } from '@tma.js/sdk-solid';
import {
	type Component,
	createResource,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
import { balance } from '@/entities/airdrop/index.js';
import { type SubscriptionPackage, subscriptionApi } from '@/entities/bot/index.js';
import { channelApi } from '@/entities/channel/index.js';
import type { ManagedChannel } from '@/entities/channel/model/types.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { calculateDiscountForPlan } from '@/shared/lib/stars-calculator.js';
import { showToast } from '@/shared/ui/index.js';
import { PaymentDiscountCard } from '@/shared/ui/payment-discount/PaymentDiscountCard.js';
import { CreditStoreSheet, useWallet } from '@/widgets/paywall/index.js';

export const ManagedChannelsPage: Component = () => {
	const navigate = useNavigate();
	const wallet = useWallet();

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
	const [isDiscountEnabled, setIsDiscountEnabled] = createSignal(false);
	const [discountPercent, setDiscountPercent] = createSignal<25 | 50 | 75>(50);
	const [isProcessing, setIsProcessing] = createSignal(false);
	const [isStoreOpen, setIsStoreOpen] = createSignal(false);
	const [successMsg, setSuccessMsg] = createSignal('');
	const [errorMsg, setErrorMsg] = createSignal('');

	// Create Project Inline Modal State
	const [showCreateProject, setShowCreateProject] = createSignal(false);
	const [projectName, setProjectName] = createSignal(
		t('managedChannels.defaultProjectName') || 'پروژه انتقال هوشمند',
	);
	const [sourceInput, setSourceInput] = createSignal('');
	const [targetInput, setTargetInput] = createSignal('');
	const [sourceChannel, setSourceChannel] = createSignal<ManagedChannel | null>(null);
	const [targetChannel, setTargetChannel] = createSignal<ManagedChannel | null>(null);
	const [isCheckingSource, setIsCheckingSource] = createSignal(false);
	const [isCheckingTarget, setIsCheckingTarget] = createSignal(false);
	const [sourceError, setSourceError] = createSignal('');
	const [targetError, setTargetError] = createSignal('');
	const [isCreatingProject, setIsCreatingProject] = createSignal(false);

	const [packages] = createResource(subscriptionApi.getPackages);

	const openSubscription = (channelId: string) => {
		setSelectedChan(channelId);
		setPaymentStep('package');
		setShowSubscription(true);
		haptic.impact('light');
	};

	const handleSubscribeCredits = async () => {
		if (!selectedPkg() || !selectedChan()) return;
		setIsProcessing(true);
		setErrorMsg('');
		try {
			haptic.impact('heavy');
			await subscriptionApi.subscribeChannelWithCredits(selectedChan(), selectedPkg());
			haptic.notify('success');
			setSuccessMsg(t('botManage.subscriptionSuccess') || 'Subscription activated successfully!');
			wallet.refetch();
			refetch();
			setTimeout(() => {
				setShowSubscription(false);
			}, 1200);
		} catch (e: any) {
			const msg = e?.response?.data?.error || e?.message || 'Failed to activate with credits';
			setErrorMsg(msg);
			haptic.notify('error');
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
			const percent = isDiscountEnabled() ? discountPercent() : 0;
			const res = await subscriptionApi.createChannelSubscriptionStarsInvoice(
				selectedChan(),
				selectedPkg(),
				percent,
			);
			if (res.invoice_link) {
				const tg = (window as any).Telegram?.WebApp;
				if (tg?.openInvoice) {
					tg.openInvoice(res.invoice_link, (status: string) => {
						if (status === 'paid') {
							haptic.notify('success');
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
			haptic.notify('error');
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
		if (diff <= 0) return t('botManage.expired');

		const days = Math.floor(diff / (1000 * 3600 * 24));
		const hours = Math.floor((diff % (1000 * 3600 * 24)) / (1000 * 3600));

		if (days > 0) return `${days}${t('botManage.daysLeft')}`;
		return `${hours}${t('botManage.hoursLeft')}`;
	};

	const handleDeleteChannel = async () => {
		const channel = channelToDelete();
		if (!channel) return;

		setIsDeleting(true);
		try {
			await channelApi.disconnectChannel(channel.id);
			haptic.notify('success');
			setChannelToDelete(null);
			refetch();
		} catch (_e: any) {
			haptic.notify('error');
		} finally {
			setIsDeleting(false);
		}
	};

	// Verify source channel
	const handleVerifySource = async (customInput?: string) => {
		const val = (customInput !== undefined ? customInput : sourceInput()).trim();
		if (!val) {
			setSourceError(
				t('managedChannels.enterSourceError') || 'لطفاً آیدی یا یوزرنیم کانال ورودی را وارد کنید',
			);
			return;
		}
		setIsCheckingSource(true);
		setSourceError('');
		try {
			const res = await channelApi.connectChannel('auto', val);
			setSourceChannel(res);
			setSourceError('');
			haptic.notify('success');
		} catch (err: any) {
			setSourceChannel(null);
			const msg =
				err?.response?.data?.error ||
				err?.message ||
				t('managedChannels.botNotAdminError') ||
				'ربات در این کانال عضو یا ادمین نیست. لطفاً ابتدا ربات را در کانال ادمین کنید.';
			setSourceError(msg);
			haptic.notify('error');
		} finally {
			setIsCheckingSource(false);
		}
	};

	// Verify target channel
	const handleVerifyTarget = async (customInput?: string) => {
		const val = (customInput !== undefined ? customInput : targetInput()).trim();
		if (!val) {
			setTargetError(
				t('managedChannels.enterTargetError') || 'لطفاً آیدی یا یوزرنیم کانال خروجی را وارد کنید',
			);
			return;
		}
		setIsCheckingTarget(true);
		setTargetError('');
		try {
			const res = await channelApi.connectChannel('auto', val);
			setTargetChannel(res);
			setTargetError('');
			haptic.notify('success');
		} catch (err: any) {
			setTargetChannel(null);
			const msg =
				err?.response?.data?.error ||
				err?.message ||
				t('managedChannels.botNotAdminError') ||
				'ربات در این کانال عضو یا ادمین نیست. لطفاً ابتدا ربات را در کانال ادمین کنید.';
			setTargetError(msg);
			haptic.notify('error');
		} finally {
			setIsCheckingTarget(false);
		}
	};

	// Submit project creation
	const handleCreateProjectSubmit = async (e: Event) => {
		e.preventDefault();
		haptic.impact('medium');

		let src = sourceChannel();
		let tgt = targetChannel();

		if (!src && sourceInput().trim()) {
			await handleVerifySource();
			src = sourceChannel();
		}
		if (!tgt && targetInput().trim()) {
			await handleVerifyTarget();
			tgt = targetChannel();
		}

		if (!src) {
			setSourceError(
				t('managedChannels.verifySourceFirst') ||
					'لطفاً ابتدا کانال ورودی معتبر را بررسی و تایید کنید.',
			);
			return;
		}
		if (!tgt) {
			setTargetError(
				t('managedChannels.verifyTargetFirst') ||
					'لطفاً ابتدا کانال خروجی معتبر را بررسی و تایید کنید.',
			);
			return;
		}

		setIsCreatingProject(true);
		try {
			await channelApi.createProject({
				name:
					projectName().trim() ||
					t('managedChannels.defaultProjectName') ||
					'پروژه انتقال هوشمند',
				source_channel_id: src.id,
				target_channel_id: tgt.id,
			});

			haptic.notify('success');
			showToast(
				t('managedChannels.projectCreatedSuccess') ||
					'پروژه با موفقیت ساخته شد و ۷۲ ساعت تست رایگان فعال گردید!',
				'success',
			);
			setShowCreateProject(false);
			setSourceInput('');
			setTargetInput('');
			setSourceChannel(null);
			setTargetChannel(null);
			setSourceError('');
			setTargetError('');
			refetch();
		} catch (err: any) {
			haptic.notify('error');
			const msg =
				err?.response?.data?.error ||
				err?.message ||
				t('managedChannels.projectCreateError') ||
				'خطا در ساخت پروژه';
			setTargetError(msg);
			showToast(msg, 'error');
		} finally {
			setIsCreatingProject(false);
		}
	};

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			haptic.impact('light');
			navigate('/dashboard');
		});
		onCleanup(() => {
			off();
			backButton.hide();
		});
	});

	return (
		<div
			class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-30 border-b border-white/5 flex items-center justify-between shadow-sm">
				<div class="flex items-center gap-3.5 min-w-0">
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							navigate('/dashboard');
						}}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
						aria-label="Back"
					>
						<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col gap-0.5 min-w-0">
						<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
							{t('managedChannels.title')}
						</h1>
						<span class="text-[11px] font-bold text-white/50 uppercase tracking-wider truncate">
							{t('managedChannels.description')}
						</span>
					</div>
				</div>

				{/* Quick Add Button in Header when channels exist */}
				<Show when={channels() && channels()!.length > 0}>
					<button
						type="button"
						onClick={() => {
							haptic.impact('medium');
							setShowCreateProject(true);
						}}
						class="h-10 px-3.5 rounded-[12px] bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[0_4px_12px_rgba(51,144,236,0.3)] active:scale-95 transition-all shrink-0"
					>
						<span class="material-symbols-outlined text-[16px]">add</span>
						<span>{t('managedChannels.createProject') || 'ساخت پروژه'}</span>
					</button>
				</Show>
			</div>

			<div class="px-5 pt-6 flex flex-col gap-6 max-w-md mx-auto relative z-10 w-full">
				{/* ═══════ CHANNEL LIST ═══════ */}
				<Show
					when={channels() && channels()!.length > 0}
					fallback={
						!channels.loading ? (
							<Motion.div
								initial={{ opacity: 0, y: 15 }}
								animate={{ opacity: 1, y: 0 }}
								class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] p-8 flex flex-col items-center justify-center text-center gap-5 border border-white/5 shadow-sm relative overflow-hidden"
							>
								<div class="absolute -top-10 -right-10 w-32 h-32 bg-[#3390ec]/15 rounded-full blur-3xl pointer-events-none" />

								<div class="w-20 h-20 rounded-[20px] bg-gradient-to-br from-[#3390ec]/20 to-[#3390ec]/5 border border-[#3390ec]/30 flex items-center justify-center shadow-inner relative z-10">
									<span class="material-symbols-outlined text-[#3390ec] text-[40px] drop-shadow-md">
										campaign
									</span>
								</div>

								<div class="flex flex-col gap-2 relative z-10">
									<h3 class="text-white font-black text-[20px] tracking-tight">
										{t('managedChannels.noChannels')}
									</h3>
									<p class="text-[12px] text-white/50 leading-relaxed font-medium max-w-[250px] mx-auto">
										{t('managedChannels.noChannelsDesc')}
									</p>
								</div>

								<div class="w-full flex flex-col gap-2.5 mt-2 text-start relative z-10">
									<div class="flex items-center gap-3.5 bg-[#08090D] rounded-[16px] p-3.5 border border-white/5 shadow-inner">
										<div class="w-9 h-9 rounded-[10px] bg-[#3390ec]/15 text-[#3390ec] font-black flex items-center justify-center text-[14px] shrink-0 border border-[#3390ec]/30">
											1
										</div>
										<span class="text-[12px] font-bold text-white/90 leading-snug">
											{t('managedChannels.step1')}
										</span>
									</div>
									<div class="flex items-center gap-3.5 bg-[#08090D] rounded-[16px] p-3.5 border border-white/5 shadow-inner">
										<div class="w-9 h-9 rounded-[10px] bg-[#3390ec]/15 text-[#3390ec] font-black flex items-center justify-center text-[14px] shrink-0 border border-[#3390ec]/30">
											2
										</div>
										<span class="text-[12px] font-bold text-white/90 leading-snug">
											{t('managedChannels.step2')}
										</span>
									</div>
									<div class="flex items-center gap-3.5 bg-[#08090D] rounded-[16px] p-3.5 border border-white/5 shadow-inner">
										<div class="w-9 h-9 rounded-[10px] bg-[#10b981]/15 text-[#10b981] font-black flex items-center justify-center text-[16px] shrink-0 border border-[#10b981]/30">
											<span class="material-symbols-outlined text-[18px]">done</span>
										</div>
										<span class="text-[12px] font-bold text-white/90 leading-snug">
											{t('managedChannels.step3')}
										</span>
									</div>
								</div>

								{/* Direct Inline Project Creation Trigger (72h Free Trial) */}
								<button
									type="button"
									onClick={() => {
										haptic.impact('medium');
										setShowCreateProject(true);
									}}
									class="mt-4 w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] text-white font-black text-[13px] uppercase tracking-widest rounded-[16px] flex items-center justify-center gap-2 hover:from-[#2b7ec9] hover:to-[#3390ec] transition-all active:scale-95 shadow-[0_10px_25px_rgba(51,144,236,0.3)] relative z-10 border border-white/10"
								>
									<span class="material-symbols-outlined text-[20px]">rocket_launch</span>
									<span>{t('managedChannels.createProjectTrial') || 'ساخت پروژه جدید (۷۲ ساعت تست رایگان)'}</span>
								</button>

								<button
									type="button"
									onClick={() => {
										haptic.impact('light');
										navigate('/channel/demo-channel');
									}}
									class="w-full h-12 bg-amber-400/10 hover:bg-amber-400/15 border border-amber-400/30 text-amber-300 rounded-[16px] font-bold text-[12px] transition-all flex items-center justify-center gap-2 relative z-10 active:scale-95"
								>
									<span class="material-symbols-outlined text-[18px]">science</span>
									{t('demo.previewChannel')}
								</button>
							</Motion.div>
						) : (
							<div class="flex flex-col gap-4">
								<div class="flex items-center justify-between mb-1 pl-2">
									<div class="h-4 w-32 bg-white/5 rounded-[4px] animate-pulse"></div>
								</div>
								<For each={[1, 2, 3]}>
									{() => (
										<div class="bg-[#12141C]/50 rounded-[24px] p-5 border border-white/5 flex items-center gap-4">
											<div class="w-14 h-14 rounded-[16px] bg-white/5 animate-pulse shrink-0"></div>
											<div class="flex-1 flex flex-col gap-2">
												<div class="h-4 w-1/2 bg-white/5 rounded-[4px] animate-pulse"></div>
												<div class="h-3 w-1/3 bg-white/5 rounded-[4px] animate-pulse"></div>
											</div>
											<div class="w-10 h-10 rounded-[12px] bg-white/5 animate-pulse shrink-0"></div>
										</div>
									)}
								</For>
							</div>
						)
					}
				>
					<div class="flex flex-col gap-4">
						<div class="flex items-center justify-between mb-1 px-1 border-b border-white/5 pb-2">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-[#3390ec] text-[20px]">view_list</span>
								<h2 class="text-[12px] font-black text-white/40 uppercase tracking-widest">
									{t('managedChannels.yourChannels')}
								</h2>
							</div>
						</div>

						<For each={channels()}>
							{(channel, i) => {
								const endDateStr =
									channel.subscription_status === 'trial'
										? channel.trial_ends_at
										: channel.paid_until;
								return (
									<Motion.div
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: i() * 0.05 }}
										class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] p-5 border border-white/5 hover:border-white/15 flex flex-col gap-5 shadow-sm transition-all relative overflow-hidden group"
									>
										<div class="flex items-center justify-between relative z-10">
											<div class="flex items-center gap-4 overflow-hidden pr-2">
												<div class="w-[52px] h-[52px] rounded-[16px] bg-gradient-to-br from-[#3390ec]/20 to-[#3390ec]/5 border border-[#3390ec]/30 flex items-center justify-center font-black text-[#3390ec] text-[22px] shadow-inner shrink-0 group-hover:scale-105 transition-transform">
													{channel.avatar}
												</div>
												<div class="flex flex-col overflow-hidden gap-0.5">
													<span class="text-white font-black text-[15px] truncate tracking-tight">
														{channel.title}
													</span>
													<span class="text-[11px] font-bold text-white/40 tracking-wider">
														{channel.members} {t('managedChannels.subscribers')}
													</span>
												</div>
											</div>
											<div class="flex flex-col items-end shrink-0 gap-1">
												<span
													class={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-[8px] border shadow-sm ${
														channel.subscription_status === 'paid'
															? 'text-[#10b981] border-[#10b981]/30 bg-[#10b981]/10'
															: channel.subscription_status === 'trial'
																? 'text-amber-400 border-amber-400/30 bg-amber-400/10'
																: 'text-[#ff4a4a] border-[#ff4a4a]/30 bg-[#ff4a4a]/10'
													}`}
												>
													{channel.subscription_status === 'paid'
														? 'Active'
														: channel.subscription_status === 'trial'
															? 'Trial'
															: 'Expired'}
												</span>
												<Show when={endDateStr && channel.subscription_status !== 'expired'}>
													<span class="text-[10px] text-white/50 font-bold font-mono whitespace-nowrap bg-white/5 px-2 py-0.5 rounded-[4px]">
														{formatTimeRemaining(endDateStr!)}
													</span>
												</Show>
											</div>
										</div>

										<div class="flex gap-2.5 w-full relative z-10">
											<Show when={channel.subscription_status !== 'expired'}>
												<button
													type="button"
													onClick={() => {
														haptic.impact('light');
														navigate(`/channel/${channel.id}`);
													}}
													class="flex-[1.5] h-12 rounded-[14px] text-[12px] uppercase tracking-widest font-black transition-all bg-[#08090D] text-white/80 border border-white/5 hover:border-white/20 hover:text-white shadow-sm active:scale-95"
												>
													{t('botManage.manage')}
												</button>
											</Show>
											<button
												type="button"
												onClick={() => openSubscription(channel.id)}
												class={`h-12 rounded-[14px] text-[12px] uppercase tracking-widest font-black transition-all border active:scale-95 flex items-center justify-center gap-1 shadow-sm ${
													channel.subscription_status === 'paid'
														? 'flex-1 bg-white/5 text-white/60 border-transparent hover:bg-white/10 hover:text-white'
														: 'flex-[2] bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] text-white border-white/10 shadow-[0_4px_15px_rgba(51,144,236,0.3)]'
												}`}
											>
												<Show when={channel.subscription_status !== 'paid'}>
													<span class="material-symbols-outlined text-[16px]">stars</span>
												</Show>
												{channel.subscription_status === 'paid'
													? t('botManage.extendSub')
													: t('botManage.buySubscription')}
											</button>
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													haptic.impact('medium');
													setChannelToDelete(channel);
												}}
												class="w-12 h-12 rounded-[14px] bg-transparent flex items-center justify-center border border-transparent hover:bg-[#ff4a4a]/10 hover:border-[#ff4a4a]/30 text-white/30 hover:text-[#ff4a4a] transition-all active:scale-95 shrink-0"
												aria-label={t('managedChannels.delete')}
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

			{/* ═══════ CREATE PROJECT INLINE MODAL ═══════ */}
			<Show when={showCreateProject()}>
				<Motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					class="fixed inset-0 bg-[#030303]/90 backdrop-blur-2xl z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
					onClick={(e) => {
						if (e.target === e.currentTarget && !isCreatingProject()) {
							setShowCreateProject(false);
						}
					}}
				>
					<Motion.div
						initial={{ y: '100%', opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						transition={{ duration: 0.35, easing: [0.32, 0.72, 0, 1] }}
						class="w-full max-w-lg bg-[#12141C] rounded-t-[32px] sm:rounded-[32px] border border-white/10 p-6 max-h-[92vh] overflow-y-auto no-scrollbar shadow-[0_-20px_60px_rgba(0,0,0,0.8)] relative"
					>
						<div class="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-5 sm:hidden" />

						{/* Header */}
						<div class="flex items-center justify-between pb-4 border-b border-white/5 mb-5">
							<div class="flex items-center gap-3">
								<div class="w-10 h-10 rounded-[12px] bg-[#3390ec]/15 text-[#3390ec] flex items-center justify-center border border-[#3390ec]/30 shadow-inner">
									<span class="material-symbols-outlined text-[22px]">rocket_launch</span>
								</div>
								<div class="flex flex-col">
									<h3 class="text-[17px] font-black text-white tracking-tight">
										{t('managedChannels.createProjectModalTitle') || 'ساخت پروژه جدید'}
									</h3>
									<span class="text-[11px] font-bold text-amber-400 flex items-center gap-1">
										<span>⭐</span> {t('managedChannels.freeTrial72hBadge') || '۷۲ ساعت تست کاملاً رایگان'}
									</span>
								</div>
							</div>
							<button
								type="button"
								onClick={() => setShowCreateProject(false)}
								disabled={isCreatingProject()}
								class="w-9 h-9 rounded-[10px] bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-all"
							>
								<span class="material-symbols-outlined text-[18px]">close</span>
							</button>
						</div>

						<form onSubmit={handleCreateProjectSubmit} class="flex flex-col gap-5">
							{/* Project Name */}
							<div class="flex flex-col gap-1.5">
								<label class="text-[12px] font-bold text-white/70">
									{t('managedChannels.projectName') || 'نام پروژه'}
								</label>
								<input
									type="text"
									value={projectName()}
									onInput={(e) => setProjectName(e.currentTarget.value)}
									placeholder={
										t('managedChannels.projectNamePlaceholder') || 'مثال: کانال اصلی به VIP'
									}
									class="w-full h-12 bg-[#08090D] border border-white/10 focus:border-[#3390ec] rounded-[14px] px-4 text-[13px] text-white placeholder:text-white/30 outline-none transition-colors"
									required
								/>
							</div>

							{/* Source Channel (Input) */}
							<div class="flex flex-col gap-2">
								<div class="flex items-center justify-between">
									<label class="text-[12px] font-bold text-white/80 flex items-center gap-1.5">
										<span class="text-[#3390ec]">●</span> {t('managedChannels.sourceChannel') || 'کانال ورودی (Source)'}
									</label>
									<Show when={sourceChannel()}>
										<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/15 px-2 py-0.5 rounded-[6px] border border-[#10b981]/30">
											✓ {t('managedChannels.verified') || 'تایید شده'}
										</span>
									</Show>
								</div>

								{/* If user has existing channels, allow quick select */}
								<Show when={channels() && channels()!.length > 0}>
									<select
										onChange={(e) => {
											const chosen = channels()!.find((c: any) => c.id === e.currentTarget.value);
											if (chosen) {
												setSourceChannel(chosen);
												setSourceInput(chosen.chat_username ? `@${chosen.chat_username}` : (chosen.chat_title || chosen.title || ''));
												setSourceError('');
											}
										}}
										class="w-full h-11 bg-[#08090D] border border-white/10 rounded-[14px] px-3 text-[12px] text-white/80 outline-none"
									>
										<option value="">{t('managedChannels.selectFromConnected') || '-- انتخاب از کانال‌های متصل شما --'}</option>
										<For each={channels()}>
											{(ch: any) => (
												<option value={ch.id}>
													{ch.chat_title || ch.title} ({ch.chat_username ? `@${ch.chat_username}` : (ch.subscribers_count ?? ch.members ?? 0)})
												</option>
											)}
										</For>
									</select>
								</Show>

								<div class="flex gap-2">
									<input
										type="text"
										value={sourceInput()}
										onInput={(e) => {
											setSourceInput(e.currentTarget.value);
											setSourceChannel(null);
											setSourceError('');
										}}
										placeholder={
											t('managedChannels.sourcePlaceholder') ||
											'یوزرنیم یا لینک کانال مبدا (مثلاً mychannel@)'
										}
										class={`flex-1 h-12 bg-[#08090D] rounded-[14px] px-4 text-[13px] text-white placeholder:text-white/30 outline-none transition-all border ${
											sourceChannel()
												? 'border-[#10b981]/60 bg-[#10b981]/5 text-[#10b981]'
												: sourceError()
													? 'border-[#ff4a4a]/60 bg-[#ff4a4a]/5'
													: 'border-white/10 focus:border-[#3390ec]'
										}`}
										dir="ltr"
									/>
									<button
										type="button"
										onClick={() => handleVerifySource()}
										disabled={isCheckingSource() || !sourceInput().trim()}
										class={`px-4 h-12 rounded-[14px] text-[12px] font-black transition-all shrink-0 flex items-center justify-center gap-1.5 ${
											sourceChannel()
												? 'bg-[#10b981] text-black shadow-[0_2px_10px_rgba(16,185,129,0.3)]'
												: 'bg-white/10 hover:bg-white/15 text-white border border-white/10 active:scale-95 disabled:opacity-40'
										}`}
									>
										<Show
											when={!isCheckingSource()}
											fallback={
												<span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
											}
										>
											<Show when={sourceChannel()} fallback={<span>{t('managedChannels.check') || 'بررسی'}</span>}>
												<span class="material-symbols-outlined text-[18px]">done</span>
												<span>{t('managedChannels.verified') || 'تایید'}</span>
											</Show>
										</Show>
									</button>
								</div>

								{/* Verified Source Feedback Card */}
								<Show when={sourceChannel()}>
									<div class="bg-[#10b981]/10 border border-[#10b981]/30 rounded-[14px] p-3 flex items-center justify-between">
										<div class="flex items-center gap-2.5 min-w-0">
											<span class="w-7 h-7 rounded-full bg-[#10b981]/20 text-[#10b981] flex items-center justify-center font-bold text-[14px] shrink-0">
												✓
											</span>
											<div class="flex flex-col min-w-0">
												<span class="text-[13px] font-black text-white truncate">
													{sourceChannel()?.chat_title}
												</span>
												<span class="text-[11px] font-medium text-[#10b981]">
													{t('managedChannels.botIsAdmin') || 'ربات عضو و ادمین است 🟢'} ({sourceChannel()?.subscribers_count || 0} {t('managedChannels.subscribers') || 'عضو'})
												</span>
											</div>
										</div>
									</div>
								</Show>

								{/* Source Error Feedback */}
								<Show when={sourceError()}>
									<div class="bg-[#ff4a4a]/10 border border-[#ff4a4a]/30 text-[#ff4a4a] text-[11px] font-bold rounded-[12px] p-3 flex items-start gap-2">
										<span class="material-symbols-outlined text-[16px] shrink-0 mt-0.5">error</span>
										<span>{sourceError()}</span>
									</div>
								</Show>
							</div>

							{/* Target Channel (Output) */}
							<div class="flex flex-col gap-2">
								<div class="flex items-center justify-between">
									<label class="text-[12px] font-bold text-white/80 flex items-center gap-1.5">
										<span class="text-[#10b981]">●</span> {t('managedChannels.targetChannel') || 'کانال خروجی (Target)'}
									</label>
									<Show when={targetChannel()}>
										<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/15 px-2 py-0.5 rounded-[6px] border border-[#10b981]/30">
											✓ {t('managedChannels.verified') || 'تایید شده'}
										</span>
									</Show>
								</div>

								{/* If user has existing channels, allow quick select */}
								<Show when={channels() && channels()!.length > 0}>
									<select
										onChange={(e) => {
											const chosen = channels()!.find((c: any) => c.id === e.currentTarget.value);
											if (chosen) {
												setTargetChannel(chosen);
												setTargetInput(chosen.chat_username ? `@${chosen.chat_username}` : (chosen.chat_title || chosen.title || ''));
												setTargetError('');
											}
										}}
										class="w-full h-11 bg-[#08090D] border border-white/10 rounded-[14px] px-3 text-[12px] text-white/80 outline-none"
									>
										<option value="">{t('managedChannels.selectFromConnected') || '-- انتخاب از کانال‌های متصل شما --'}</option>
										<For each={channels()}>
											{(ch: any) => (
												<option value={ch.id}>
													{ch.chat_title || ch.title} ({ch.chat_username ? `@${ch.chat_username}` : (ch.subscribers_count ?? ch.members ?? 0)})
												</option>
											)}
										</For>
									</select>
								</Show>

								<div class="flex gap-2">
									<input
										type="text"
										value={targetInput()}
										onInput={(e) => {
											setTargetInput(e.currentTarget.value);
											setTargetChannel(null);
											setTargetError('');
										}}
										placeholder={
											t('managedChannels.targetPlaceholder') ||
											'یوزرنیم یا لینک کانال مقصد (مثلاً targetchan@)'
										}
										class={`flex-1 h-12 bg-[#08090D] rounded-[14px] px-4 text-[13px] text-white placeholder:text-white/30 outline-none transition-all border ${
											targetChannel()
												? 'border-[#10b981]/60 bg-[#10b981]/5 text-[#10b981]'
												: targetError()
													? 'border-[#ff4a4a]/60 bg-[#ff4a4a]/5'
													: 'border-white/10 focus:border-[#3390ec]'
										}`}
										dir="ltr"
									/>
									<button
										type="button"
										onClick={() => handleVerifyTarget()}
										disabled={isCheckingTarget() || !targetInput().trim()}
										class={`px-4 h-12 rounded-[14px] text-[12px] font-black transition-all shrink-0 flex items-center justify-center gap-1.5 ${
											targetChannel()
												? 'bg-[#10b981] text-black shadow-[0_2px_10px_rgba(16,185,129,0.3)]'
												: 'bg-white/10 hover:bg-white/15 text-white border border-white/10 active:scale-95 disabled:opacity-40'
										}`}
									>
										<Show
											when={!isCheckingTarget()}
											fallback={
												<span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
											}
										>
											<Show when={targetChannel()} fallback={<span>{t('managedChannels.check') || 'بررسی'}</span>}>
												<span class="material-symbols-outlined text-[18px]">done</span>
												<span>{t('managedChannels.verified') || 'تایید'}</span>
											</Show>
										</Show>
									</button>
								</div>

								{/* Verified Target Feedback Card */}
								<Show when={targetChannel()}>
									<div class="bg-[#10b981]/10 border border-[#10b981]/30 rounded-[14px] p-3 flex items-center justify-between">
										<div class="flex items-center gap-2.5 min-w-0">
											<span class="w-7 h-7 rounded-full bg-[#10b981]/20 text-[#10b981] flex items-center justify-center font-bold text-[14px] shrink-0">
												✓
											</span>
											<div class="flex flex-col min-w-0">
												<span class="text-[13px] font-black text-white truncate">
													{targetChannel()?.chat_title}
												</span>
												<span class="text-[11px] font-medium text-[#10b981]">
													{t('managedChannels.botIsAdmin') || 'ربات عضو و ادمین است 🟢'} ({targetChannel()?.subscribers_count || 0} {t('managedChannels.subscribers') || 'عضو'})
												</span>
											</div>
										</div>
									</div>
								</Show>

								{/* Target Error Feedback */}
								<Show when={targetError()}>
									<div class="bg-[#ff4a4a]/10 border border-[#ff4a4a]/30 text-[#ff4a4a] text-[11px] font-bold rounded-[12px] p-3 flex items-start gap-2">
										<span class="material-symbols-outlined text-[16px] shrink-0 mt-0.5">error</span>
										<span>{targetError()}</span>
									</div>
								</Show>
							</div>

							{/* Submit Button */}
							<button
								type="submit"
								disabled={isCreatingProject()}
								class="w-full h-15 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white rounded-[18px] font-black text-[14px] uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(51,144,236,0.35)] active:scale-[0.98] mt-2 border border-white/10"
							>
								<Show
									when={!isCreatingProject()}
									fallback={
										<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
									}
								>
									<span class="material-symbols-outlined text-[20px]">rocket_launch</span>
									<span>{t('managedChannels.createProjectBtn') || 'ساخت پروژه (۷۲ ساعت تست رایگان)'}</span>
								</Show>
							</button>
						</form>
					</Motion.div>
				</Motion.div>
			</Show>

			{/* ═══════ DELETE CHANNEL MODAL ═══════ */}
			<Show when={channelToDelete()}>
				<Motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					class="fixed inset-0 bg-[#030303]/90 backdrop-blur-2xl z-50 flex items-center justify-center px-5"
					onClick={(e) => {
						if (e.target === e.currentTarget && !isDeleting()) setChannelToDelete(null);
					}}
				>
					<Motion.div
						initial={{ scale: 0.9, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						transition={{ duration: 0.3, easing: [0.32, 0.72, 0, 1] }}
						class="w-full max-w-sm bg-[#12141C] rounded-[32px] border border-white/10 p-7 flex flex-col items-center text-center shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative overflow-hidden"
					>
						<div class="absolute -top-10 -left-10 w-32 h-32 bg-[#ff4a4a]/20 blur-3xl rounded-full pointer-events-none" />

						<div class="w-20 h-20 rounded-[24px] bg-[#ff4a4a]/10 border border-[#ff4a4a]/30 flex items-center justify-center mb-5 shadow-inner relative z-10">
							<span class="material-symbols-outlined text-[#ff4a4a] text-[40px] drop-shadow-md">
								delete_forever
							</span>
						</div>

						<h3 class="text-[22px] font-black text-white mb-2 tracking-tight relative z-10">
							{t('managedChannels.deleteConfirmTitle')}
						</h3>
						<p class="text-[13px] text-white/50 mb-8 leading-relaxed font-medium relative z-10 px-2">
							{t('managedChannels.deleteConfirmDesc')}
						</p>

						<div class="w-full flex flex-col gap-3 relative z-10">
							<button
								type="button"
								onClick={handleDeleteChannel}
								disabled={isDeleting()}
								class="w-full h-14 rounded-[16px] font-black text-[14px] uppercase tracking-widest bg-[#ff4a4a] text-white hover:bg-[#ff3b30] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(255,74,74,0.3)] active:scale-95 border border-white/10"
							>
								<Show
									when={!isDeleting()}
									fallback={
										<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
									}
								>
									<span class="material-symbols-outlined text-[20px]">warning</span>{' '}
									{t('managedChannels.delete')}
								</Show>
							</button>
							<button
								type="button"
								onClick={() => setChannelToDelete(null)}
								disabled={isDeleting()}
								class="w-full h-14 rounded-[16px] font-bold text-[14px] uppercase tracking-widest bg-transparent text-white/60 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5 transition-all disabled:opacity-50 active:scale-95"
							>
								{t('common.cancel')}
							</button>
						</div>
					</Motion.div>
				</Motion.div>
			</Show>

			{/* ═══════ SUBSCRIPTION BOTTOM SHEET ═══════ */}
			<Show when={showSubscription()}>
				<Motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					class="fixed inset-0 bg-[#030303]/90 backdrop-blur-2xl z-[100] flex items-end justify-center"
					onClick={(e) => {
						if (e.target === e.currentTarget) setShowSubscription(false);
					}}
				>
					<Motion.div
						initial={{ y: '100%' }}
						animate={{ y: 0 }}
						transition={{ duration: 0.4, easing: [0.32, 0.72, 0, 1] }}
						class="w-full max-h-[85vh] bg-[#12141C] rounded-t-[32px] border-t border-white/10 p-6 overflow-y-auto no-scrollbar shadow-[0_-30px_80px_rgba(0,0,0,0.8)] relative"
					>
						<Show when={successMsg()}>
							<div class="bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] rounded-[16px] px-4 py-3.5 flex items-center gap-2.5 text-[13px] font-bold mb-5 shadow-sm">
								<span class="material-symbols-outlined text-[20px]">check_circle</span>{' '}
								{successMsg()}
							</div>
						</Show>
						<Show when={errorMsg()}>
							<div class="bg-[#ff4a4a]/10 border border-[#ff4a4a]/20 text-[#ff4a4a] rounded-[16px] px-4 py-3.5 flex items-center gap-2.5 text-[13px] font-bold mb-5 shadow-sm">
								<span class="material-symbols-outlined text-[20px]">error</span> {errorMsg()}
							</div>
						</Show>

						<div class="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />

						{paymentStep() === 'package' ? (
							<div class="flex flex-col gap-4">
								<div class="flex flex-col gap-1 text-center mb-1">
									<h3 class="text-[22px] font-black text-white tracking-tight">
										{t('botManage.choosePackage')}
									</h3>
									<p class="text-[13px] font-medium text-white/50">
										{t('botManage.selectPlan')} {t('botManage.channelService')}
									</p>
								</div>

								{/* Credit Balance Hub */}
								<div class="flex items-center justify-between w-full bg-gradient-to-r from-[#121829] to-[#0a0d14] border border-[#00C6FF]/30 rounded-[20px] p-3.5 shadow-sm">
									<div class="flex items-center gap-2.5">
										<span class="text-[20px]">💎</span>
										<div class="flex flex-col text-start">
											<span class="text-[10px] font-black uppercase text-[#00C6FF] tracking-wider">
												{t('botManage.userCredits', { count: wallet.balance() ?? 0 })}
											</span>
											<span class="text-[13px] font-bold text-white/80">
												{wallet.balance() ?? 0} {t('paywall.credit_unit')}
											</span>
										</div>
									</div>
									<button
										type="button"
										onClick={() => setIsStoreOpen(true)}
										class="px-3 py-1.5 rounded-[12px] bg-[#00C6FF]/15 border border-[#00C6FF]/30 text-[#00C6FF] text-[11px] font-black active:scale-95 transition-all flex items-center gap-1 hover:bg-[#00C6FF]/25"
									>
										<span>+</span>
										<span>{t('paywall.get_credits')}</span>
									</button>
								</div>

								<div class="space-y-3">
									<For each={packages() || []}>
										{(pkg: SubscriptionPackage) => {
											const credits = pkg.price_credits || (pkg.duration_months === 1 ? 3 : pkg.duration_months === 3 ? 8 : pkg.duration_months === 6 ? 15 : 25);
											const creditsPerMonth = (credits / pkg.duration_months).toFixed(1);
											const isSelected = () => selectedPkg() === pkg.id;

											return (
												<button
													type="button"
													onClick={() => {
														setSelectedPkg(pkg.id);
														haptic.selection();
													}}
													class={`w-full rounded-[24px] p-4.5 flex items-center justify-between border-2 transition-all active:scale-[0.98] relative overflow-hidden group ${
														isSelected()
															? 'border-[#00C6FF] bg-[#00C6FF]/10 shadow-[0_10px_30px_rgba(0,198,255,0.15)]'
															: 'border-white/5 bg-[#08090D] hover:border-white/20 shadow-inner'
													}`}
												>
													<Show when={pkg.badge}>
														<div
															class={`absolute top-0 ${isRtl() ? 'left-0 rounded-br-[14px]' : 'right-0 rounded-bl-[14px]'} px-3 py-1 text-[9px] font-black uppercase tracking-widest shadow-sm ${pkg.badge === 'best_value' ? 'bg-amber-400 text-black' : 'bg-[#00C6FF] text-black'}`}
														>
															{pkg.badge === 'best_value'
																? t('botManage.bestValue')
																: t('botManage.popular')}
														</div>
													</Show>

													<div class="flex flex-col items-start gap-1">
														<div class="flex items-center gap-2">
															<span
																class={`text-[17px] font-black tracking-tight ${isSelected() ? 'text-[#00C6FF]' : 'text-white'}`}
															>
																{pkg.name}
															</span>
															<Show when={pkg.discount}>
																<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/20 px-2 py-0.5 rounded-[6px] shadow-sm">
																	-{pkg.discount}
																</span>
															</Show>
														</div>
														<span class="text-[11px] font-medium text-white/40">
															{t('botManage.creditsEquivalent', { stars: pkg.price_stars })}
														</span>
													</div>
													<div class="flex flex-col items-end gap-0.5">
														<div class="flex items-baseline gap-1" dir="ltr">
															<span
																class={`text-[24px] font-black font-mono tracking-tight ${isSelected() ? 'text-white' : 'text-white/90'}`}
															>
																{credits}
															</span>
															<span class="text-[12px] font-black text-[#00C6FF]">💎</span>
														</div>
														<span class="text-[10px] font-medium text-white/40">
															({creditsPerMonth} {t('paywall.credit_unit')} / {t('botManage.perMonth') || 'mo'})
														</span>
													</div>
												</button>
											);
										}}
									</For>
								</div>

								<Show when={selectedPkg()}>
									{(() => {
										const pkg = (packages() || []).find((p: SubscriptionPackage) => p.id === selectedPkg());
										if (!pkg) return null;
										const reqCredits = pkg.price_credits || (pkg.duration_months === 1 ? 3 : pkg.duration_months === 3 ? 8 : pkg.duration_months === 6 ? 15 : 25);
										const userCreds = wallet.balance() ?? 0;
										const hasEnough = userCreds >= reqCredits;

										return (
											<div class="space-y-3 mt-1">
												<Show
													when={hasEnough}
													fallback={
														<div class="space-y-3">
															<div class="rounded-[18px] border border-amber-400/25 bg-amber-400/10 p-3.5 text-start text-[12px]">
																<div class="flex items-center gap-2 text-amber-300 font-bold mb-1">
																	<span class="material-symbols-outlined text-[18px]">info</span>
																	<span>
																		{t('botManage.insufficientCredits', {
																			needed: reqCredits - userCreds,
																		}) || `Deficit: ${reqCredits - userCreds} Credits needed`}
																	</span>
																</div>
																<p class="text-white/60 text-[11px] leading-relaxed">
																	{t('botManage.insufficientCreditsDesc', { current: userCreds })}
																</p>
															</div>

															<div class="grid grid-cols-2 gap-2.5">
																<button
																	type="button"
																	onClick={() => {
																		haptic.impact('medium');
																		setIsStoreOpen(true);
																	}}
																	class="h-12 rounded-[16px] bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black text-[12px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
																>
																	<span>⭐</span>
																	<span>{t('botManage.buyCreditsStars')}</span>
																</button>
																<button
																	type="button"
																	onClick={() => {
																		haptic.impact('medium');
																		setIsStoreOpen(true);
																	}}
																	class="h-12 rounded-[16px] bg-white/10 hover:bg-white/15 text-white font-black text-[12px] uppercase tracking-wider flex items-center justify-center gap-1.5 border border-white/10 active:scale-95 transition-all"
																>
																	<span>🪙</span>
																	<span>{t('botManage.convertCoinsToCredits')}</span>
																</button>
															</div>

															<button
																type="button"
																onClick={() => {
																	haptic.impact('light');
																	setPaymentStep('method');
																}}
																class="w-full text-center text-[12px] font-bold text-white/50 hover:text-white/80 py-1 transition-colors"
															>
																{t('botManage.payWithStars')} ({pkg.price_stars} ⭐) ←
															</button>
														</div>
													}
												>
													<button
														type="button"
														onClick={handleSubscribeCredits}
														disabled={isProcessing()}
														class="w-full h-14 bg-gradient-to-r from-[#00C6FF] to-[#0072FF] text-black font-black text-[15px] tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_8px_25px_rgba(0,198,255,0.35)] active:scale-95 border border-white/15 rounded-[18px]"
													>
														<span>💎</span>
														<span>{t('botManage.payWithCredits', { count: reqCredits })}</span>
													</button>
													<button
														type="button"
														onClick={() => {
															haptic.impact('light');
															setPaymentStep('method');
														}}
														class="w-full text-center text-[12px] font-bold text-white/50 hover:text-white/80 py-1 transition-colors"
													>
														{t('common.or') || 'or'} {t('botManage.payWithStars')} ({pkg.price_stars} ⭐)
													</button>
												</Show>
											</div>
										);
									})()}
								</Show>
							</div>
						) : (
							<div class="flex flex-col gap-5">
								<div class="flex items-center gap-4 mb-2">
									<button
										type="button"
										onClick={() => setPaymentStep('package')}
										class="w-11 h-11 rounded-[14px] bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/10 active:scale-95 shrink-0"
									>
										<span class="material-symbols-outlined text-[22px] text-white/70">
											arrow_back
										</span>
									</button>
									<div class="flex flex-col gap-0.5">
										<h3 class="text-[20px] font-black text-white leading-tight tracking-tight">
											{t('botManage.paymentMethodTitle')}
										</h3>
										<p class="text-[12px] font-medium text-white/50">
											{t('botManage.paymentMethodDesc')}
										</p>
									</div>
								</div>

								<Show when={packages() && selectedPkg()}>
									{(() => {
										const pkg = (packages() || []).find(
											(p: SubscriptionPackage) => p.id === selectedPkg(),
										);
										if (!pkg) return null;
										const calc = () =>
											calculateDiscountForPlan(
												pkg.price_usd,
												isDiscountEnabled() ? discountPercent() : 0,
												pkg.price_stars,
											);

										return (
											<div class="space-y-4">
												{/* Plan Summary Card */}
												<div class="bg-[#08090D] rounded-[20px] p-5 border border-white/5 flex items-center justify-between shadow-inner">
													<div class="flex flex-col gap-1">
														<span class="text-[16px] font-black text-[#3390ec] tracking-tight">
															{pkg.name} Plan
														</span>
														<span class="text-[11px] font-bold text-white/40 uppercase tracking-widest">
															${pkg.price_per_month.toFixed(2)} {t('botManage.perMonth')}
														</span>
													</div>
													<div class="flex flex-col items-end gap-1">
														<span class="text-[20px] font-black font-mono text-white tracking-tight">
															${calc().finalUsd.toFixed(2)}
														</span>
														<span class="text-[11px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-[6px] border border-amber-400/20 shadow-sm">
															{calc().finalStars} ⭐
														</span>
													</div>
												</div>

												{/* Coin Discount Toggle & Tier Selector */}
												<PaymentDiscountCard
													baseUsd={pkg.price_usd}
													baseStars={pkg.price_stars}
													userCoins={balance()}
													isDiscountEnabled={isDiscountEnabled()}
													selectedPercent={discountPercent()}
													onToggleDiscount={(enabled) => setIsDiscountEnabled(enabled)}
													onSelectPercent={(percent) => setDiscountPercent(percent)}
												/>

												{/* Pay Action Button */}
												<button
													type="button"
													onClick={handleSubscribeStars}
													disabled={isProcessing()}
													class="w-full h-15 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-black font-black text-[15px] uppercase tracking-wider rounded-[20px] shadow-[0_10px_25px_rgba(245,158,11,0.3)] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2.5 mt-2"
												>
													<span class="text-[20px]">⭐</span>
													<span>
														{t('botManage.payWithStars' as any) || 'Pay with Stars'} (
														{calc().finalStars} ⭐)
													</span>
												</button>
											</div>
										);
									})()}
								</Show>
							</div>
						)}

						<Show when={isProcessing()}>
							<div class="absolute inset-0 bg-[#030303]/90 backdrop-blur-xl z-50 flex flex-col items-center justify-center rounded-t-[32px] gap-4">
								<span class="w-12 h-12 border-4 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin" />
								<span class="text-[14px] font-black uppercase tracking-widest text-[#3390ec] animate-pulse">
									{t('managedChannels.processing')}
								</span>
							</div>
						</Show>
					</Motion.div>
				</Motion.div>
			</Show>

			{/* ═══════ CREDIT STORE SHEET (Quick Top-Up / Exchange) ═══════ */}
			<CreditStoreSheet
				open={isStoreOpen()}
				onClose={() => {
					setIsStoreOpen(false);
					wallet.refetch();
				}}
				vertical="channel"
			/>
		</div>
	);
};

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
import type { ManagedChannel, Project } from '@/entities/channel/model/types.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { calculateDiscountForPlan } from '@/shared/lib/stars-calculator.js';
import { showToast } from '@/shared/ui/index.js';
import { PaymentDiscountCard } from '@/shared/ui/payment-discount/PaymentDiscountCard.js';
import { CreditStoreSheet, useWallet } from '@/widgets/paywall/index.js';

export const ManagedChannelsPage: Component = () => {
	const navigate = useNavigate();
	const wallet = useWallet();

	// Fetch projects and channels
	const [projects, { refetch: refetchProjects }] = createResource(channelApi.getProjects);
	const [channels, { refetch: refetchChannels }] = createResource(
		() => true,
		() => channelApi.getUserChannels('all'),
	);

	const refetchAll = () => {
		refetchProjects();
		refetchChannels();
	};

	const [projectToDelete, setProjectToDelete] = createSignal<Project | null>(null);
	const [isDeletingProject, setIsDeletingProject] = createSignal(false);

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
		t('managedChannels.defaultProjectName') || 'Smart Forwarding Project',
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
			refetchAll();
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
							refetchAll();
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

	const formatTimeRemaining = (dateStr?: string | null) => {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		const now = new Date();
		const diff = date.getTime() - now.getTime();
		if (diff <= 0) return t('botManage.expired') || 'Expired';

		const days = Math.floor(diff / (1000 * 3600 * 24));
		const hours = Math.floor((diff % (1000 * 3600 * 24)) / (1000 * 3600));

		if (days > 0) return `${days} ${t('botManage.daysLeft') || 'days left'}`;
		return `${hours} ${t('botManage.hoursLeft') || 'hours left'}`;
	};

	const handleDeleteProject = async () => {
		const project = projectToDelete();
		if (!project) return;

		setIsDeletingProject(true);
		try {
			await channelApi.deleteProject(project.id);
			haptic.notify('success');
			showToast(
				t('managedChannels.projectDeleteSuccess') ||
					t('channel.projects.deleted') ||
					'Project deleted successfully',
				'info',
			);
			setProjectToDelete(null);
			refetchAll();
		} catch (_e: any) {
			haptic.notify('error');
			showToast(t('managedChannels.projectDeleteError') || 'Failed to delete project', 'error');
		} finally {
			setIsDeletingProject(false);
		}
	};


	// Verify source channel
	const handleVerifySource = async (customInput?: string) => {
		const val = (customInput !== undefined ? customInput : sourceInput()).trim();
		if (!val) {
			setSourceError(
				t('managedChannels.enterSourceError') || 'Please enter source channel username or ID',
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
				'Bot is not an admin in this channel. Please add the bot as admin first.';
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
				t('managedChannels.enterTargetError') || 'Please enter target channel username or ID',
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
				'Bot is not an admin in this channel. Please add the bot as admin first.';
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
				t('managedChannels.verifySourceFirst') || 'Please verify a valid source channel first.',
			);
			return;
		}
		if (!tgt) {
			setTargetError(
				t('managedChannels.verifyTargetFirst') || 'Please verify a valid target channel first.',
			);
			return;
		}

		setIsCreatingProject(true);
		try {
			await channelApi.createProject({
				name:
					projectName().trim() ||
					t('managedChannels.defaultProjectName') ||
					'Smart Forwarding Project',
				source_channel_id: src.id,
				target_channel_id: tgt.id,
			});

			haptic.notify('success');
			showToast(
				t('managedChannels.projectCreatedSuccess') ||
					'Project created successfully with 72h free trial!',
				'success',
			);
			setShowCreateProject(false);
			setSourceInput('');
			setTargetInput('');
			setSourceChannel(null);
			setTargetChannel(null);
			setSourceError('');
			setTargetError('');
			refetchAll();
		} catch (err: any) {
			haptic.notify('error');
			const msg =
				err?.response?.data?.error ||
				err?.message ||
				t('managedChannels.projectCreateError') ||
				'Failed to create project';
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
						aria-label={t('common.back') || 'Back'}
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

				{/* Quick Add Button in Header */}
				<button
					type="button"
					onClick={() => {
						haptic.impact('medium');
						setShowCreateProject(true);
					}}
					class="h-10 px-3.5 rounded-[12px] bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[0_4px_12px_rgba(51,144,236,0.3)] active:scale-95 transition-all shrink-0"
				>
					<span class="material-symbols-outlined text-[16px]">add</span>
					<span>{t('managedChannels.createProject') || 'Create Project'}</span>
				</button>
			</div>

			<div class="px-5 pt-6 flex flex-col gap-6 max-w-md mx-auto relative z-10 w-full">
				{/* ═══════ PROJECTS LIST ═══════ */}
				<Show
					when={projects() && projects()!.length > 0}
					fallback={
						!projects.loading ? (
							<Motion.div
								initial={{ opacity: 0, y: 15 }}
								animate={{ opacity: 1, y: 0 }}
								class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] p-8 flex flex-col items-center justify-center text-center gap-5 border border-white/5 shadow-sm relative overflow-hidden"
							>
								<div class="absolute -top-10 -right-10 w-32 h-32 bg-[#3390ec]/15 rounded-full blur-3xl pointer-events-none" />

								<div class="w-20 h-20 rounded-[20px] bg-gradient-to-br from-[#3390ec]/20 to-[#3390ec]/5 border border-[#3390ec]/30 flex items-center justify-center shadow-inner relative z-10">
									<span class="material-symbols-outlined text-[#3390ec] text-[40px] drop-shadow-md">
										rocket_launch
									</span>
								</div>

								<div class="flex flex-col gap-2 relative z-10">
									<h3 class="text-white font-black text-[20px] tracking-tight">
										{t('managedChannels.noProjects') || "You haven't created any projects yet."}
									</h3>
									<p class="text-[12px] text-white/50 leading-relaxed font-medium max-w-[280px] mx-auto">
										{t('managedChannels.noProjectsDesc') ||
											'Create a smart forwarding project to connect your input and output channels with custom filters.'}
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
									<span>
										{t('managedChannels.createProjectTrial') ||
											'Create New Project (72h Free Trial)'}
									</span>
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
								<For each={[1, 2]}>
									{() => (
										<div class="bg-[#12141C]/50 rounded-[24px] p-5 border border-white/5 flex flex-col gap-4">
											<div class="flex items-center gap-4">
												<div class="w-12 h-12 rounded-[16px] bg-white/5 animate-pulse shrink-0"></div>
												<div class="flex-1 flex flex-col gap-2">
													<div class="h-4 w-1/2 bg-white/5 rounded-[4px] animate-pulse"></div>
													<div class="h-3 w-1/3 bg-white/5 rounded-[4px] animate-pulse"></div>
												</div>
											</div>
											<div class="h-16 bg-white/5 rounded-[16px] animate-pulse"></div>
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
								<span class="material-symbols-outlined text-[#3390ec] text-[20px]">hub</span>
								<h2 class="text-[13px] font-black text-white/70 uppercase tracking-wider">
									{t('managedChannels.yourProjects') || 'پروژه‌های فعال شما'}
								</h2>
							</div>
							<span class="text-[11px] font-black text-[#3390ec] bg-[#3390ec]/10 px-2.5 py-0.5 rounded-full border border-[#3390ec]/20">
								{projects()!.length} {t('managedChannels.projectsCountSuffix') || 'پروژه'}
							</span>
						</div>

						<For each={projects()}>
							{(project, i) => {
								const isPaidActive = project.stars_subscription_active;
								const isTrialActive =
									!isPaidActive &&
									(project.trial_used || project.status === 'active') &&
									project.trial_ends_at;
								const endDateStr = isPaidActive ? project.stars_expires_at : project.trial_ends_at;

								return (
									<Motion.div
										initial={{ opacity: 0, y: 12 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: i() * 0.05 }}
										class="bg-gradient-to-b from-[#141722]/95 to-[#0d0f17]/95 backdrop-blur-2xl rounded-[28px] p-5 border border-white/10 hover:border-[#3390ec]/30 flex flex-col gap-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)] transition-all relative overflow-hidden group"
									>
										{/* Ambient Glow */}
										<div class="absolute -right-10 -top-10 w-36 h-36 bg-[#3390ec]/10 blur-3xl rounded-full pointer-events-none" />

										{/* ── Top Row: Project Info & Badges ── */}
										<div class="flex items-start justify-between gap-3 relative z-10">
											<div class="flex items-center gap-3 min-w-0">
												<div class="w-12 h-12 rounded-[16px] bg-gradient-to-br from-[#3390ec]/20 to-[#3390ec]/5 border border-[#3390ec]/30 flex items-center justify-center text-[#3390ec] shadow-inner shrink-0">
													<span class="material-symbols-outlined text-[24px]">rocket_launch</span>
												</div>
												<div class="flex flex-col min-w-0">
													<h3 class="text-white font-black text-[16px] leading-snug truncate tracking-tight">
														{project.name}
													</h3>
													<div class="flex items-center gap-1.5 text-[11px] font-mono text-white/40">
														<span>{t('managedChannels.projectId') || 'شناسه'}:</span>
														<span class="text-white/60 font-semibold">{project.id.slice(0, 8)}</span>
													</div>
												</div>
											</div>

											{/* Status Badges */}
											<div class="flex flex-col items-end shrink-0 gap-1.5">
												<span
													class={`text-[11px] font-black px-3 py-1 rounded-full border shadow-sm flex items-center gap-1.5 ${
														isPaidActive
															? 'text-[#10b981] border-[#10b981]/30 bg-[#10b981]/15'
															: isTrialActive
																? 'text-amber-400 border-amber-400/30 bg-amber-400/15'
																: 'text-[#ff4a4a] border-[#ff4a4a]/30 bg-[#ff4a4a]/15'
													}`}
												>
													<span class="w-1.5 h-1.5 rounded-full animate-pulse bg-current" />
													<span>
														{isPaidActive
															? 'نسخه پرو'
															: isTrialActive
																? 'آزمایشی (۷۲ ساعته)'
																: 'منقضی شده'}
													</span>
												</span>
												<Show when={endDateStr}>
													<div class="flex items-center gap-1 text-[10px] text-white/70 font-mono bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
														<span class="material-symbols-outlined text-[13px] text-amber-400">schedule</span>
														<span>{formatTimeRemaining(endDateStr)}</span>
													</div>
												</Show>
											</div>
										</div>

										{/* ── Middle Row: Visual Input (Source) ➔ Output (Target) Flow ── */}
										<div class="bg-[#090a0f]/90 border border-white/5 rounded-[22px] p-3.5 flex items-center justify-between gap-2.5 relative z-10 shadow-inner">
											{/* Source Channel Box */}
											<div class="flex-1 flex flex-col gap-1 min-w-0 bg-white/[0.03] p-3 rounded-[16px] border border-[#3390ec]/20 hover:border-[#3390ec]/40 transition-colors">
												<div class="flex items-center justify-between">
													<span class="text-[10px] font-black text-[#3390ec] uppercase tracking-wider flex items-center gap-1">
														<span class="w-2 h-2 rounded-full bg-[#3390ec]" />
														<span>ورودی (SOURCE)</span>
													</span>
												</div>
												<span class="text-[13px] font-black text-white truncate mt-0.5">
													{project.source_title || 'کانال ورودی'}
												</span>
												<span class="text-[10px] text-white/50 font-mono truncate" dir="ltr">
													{project.source_username
														? `@${project.source_username}`
														: project.source_chat_id
															? `ID: ${project.source_chat_id}`
															: 'متصل'}
												</span>
											</div>

											{/* Flow Arrow Indicator */}
											<div class="flex flex-col items-center justify-center shrink-0">
												<div class="w-9 h-9 rounded-full bg-[#3390ec]/20 border border-[#3390ec]/40 flex items-center justify-center text-[#3390ec] shadow-sm">
													<span class="material-symbols-outlined text-[20px] rtl:-scale-x-100">
														arrow_forward
													</span>
												</div>
											</div>

											{/* Target Channel Box */}
											<div class="flex-1 flex flex-col gap-1 min-w-0 bg-white/[0.03] p-3 rounded-[16px] border border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
												<div class="flex items-center justify-between">
													<span class="text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
														<span class="w-2 h-2 rounded-full bg-emerald-400" />
														<span>خروجی (TARGET)</span>
													</span>
												</div>
												<span class="text-[13px] font-black text-white truncate mt-0.5">
													{project.target_title || 'کانال خروجی'}
												</span>
												<span class="text-[10px] text-white/50 font-mono truncate" dir="ltr">
													{project.target_username
														? `@${project.target_username}`
														: project.target_chat_id
															? `ID: ${project.target_chat_id}`
															: 'متصل'}
												</span>
											</div>
										</div>

										{/* ── Subscription Plan Ribbon (Clean & Uncut) ── */}
										<div class="bg-gradient-to-r from-amber-500/10 via-white/[0.02] to-transparent border border-amber-500/20 rounded-[18px] p-3 flex items-center justify-between gap-3 relative z-10">
											<div class="flex items-center gap-3 min-w-0">
												<div class={`w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0 border ${
													isPaidActive
														? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
														: isTrialActive
															? 'bg-amber-400/20 text-amber-400 border-amber-400/30'
															: 'bg-rose-500/20 text-rose-400 border-rose-500/30'
												}`}>
													<span class="material-symbols-outlined text-[20px]">
														{isPaidActive ? 'verified' : isTrialActive ? 'military_tech' : 'lock_clock'}
													</span>
												</div>
												<div class="flex flex-col min-w-0">
													<div class="flex items-center gap-2">
														<span class="text-[13px] font-black text-white truncate">
															{isPaidActive
																? 'اشتراک پرمیوم فعال'
																: isTrialActive
																	? 'پلن آزمایشی ۷۲ ساعته'
																	: 'اشتراک منقضی شده'}
														</span>
														<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/30 font-mono shrink-0">
															{isPaidActive ? '۳ 💎 ماهانه' : isTrialActive ? '۰ 💎 (رایگان)' : '۳ 💎 ماهانه'}
														</span>
													</div>
													<span class="text-[11px] text-white/50 truncate mt-0.5">
														{isPaidActive
															? (endDateStr ? `فعال تا: ${new Date(endDateStr).toLocaleDateString('fa-IR')}` : 'پلن پرو فعال است')
															: isTrialActive
																? (endDateStr ? `زمان باقی‌مانده: ${formatTimeRemaining(endDateStr)}` : '۷۲ ساعت مهلت تست رایگان')
																: 'برای ادامه ارسال خودکار و قابلیت‌های هوش مصنوعی تمدید کنید'}
													</span>
												</div>
											</div>
										</div>

										{/* ── Bottom Row: Unified Persian Action Buttons ── */}
										<div class="flex items-center gap-2.5 w-full relative z-10 pt-1">
											{/* Manage Channel Dashboard */}
											<button
												type="button"
												onClick={() => {
													haptic.impact('light');
													const targetId =
														project.target_channel_id || project.source_channel_id || project.id;
													navigate(`/channel/${targetId}/dashboard`);
												}}
												class="flex-1 h-12 rounded-[18px] text-[13px] font-black transition-all bg-[#090a0f] text-white/90 border border-white/10 hover:border-[#3390ec]/40 hover:text-[#3390ec] shadow-sm active:scale-95 flex items-center justify-center gap-2"
												title="ورود به داشبورد کانال و تنظیمات"
											>
												<span class="material-symbols-outlined text-[19px]">dashboard</span>
												<span>داشبورد کانال</span>
											</button>

											{/* Subscription Button */}
											<button
												type="button"
												onClick={() => {
													openSubscription(project.id);
												}}
												class={`flex-[1.2] h-12 rounded-[18px] text-[13px] font-black transition-all border active:scale-95 flex items-center justify-center gap-2 shadow-sm ${
													isPaidActive
														? 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
														: 'bg-gradient-to-r from-[#3390ec] via-[#2b7ec9] to-[#1e60a3] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white border-white/15 shadow-[0_4px_18px_rgba(51,144,236,0.35)]'
												}`}
											>
												<span class="text-[16px]">💎</span>
												<span>{isPaidActive ? 'تمدید پلن' : 'ارتقا پلن (کریدیت)'}</span>
											</button>

											{/* Delete Project Button */}
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													haptic.impact('medium');
													setProjectToDelete(project);
												}}
												class="w-12 h-12 rounded-[18px] bg-[#090a0f] flex items-center justify-center border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/30 text-white/40 hover:text-rose-400 transition-all active:scale-95 shrink-0"
												title="حذف پروژه"
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
										{t('managedChannels.createProjectModalTitle') || 'Create New Project'}
									</h3>
									<span class="text-[11px] font-bold text-amber-400 flex items-center gap-1">
										<span>⭐</span>{' '}
										{t('managedChannels.freeTrial72hBadge') || '72 Hours 100% Free Trial'}
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
									{t('managedChannels.projectName') || 'Project Name'}
								</label>
								<input
									type="text"
									value={projectName()}
									onInput={(e) => setProjectName(e.currentTarget.value)}
									placeholder={
										t('managedChannels.projectNamePlaceholder') || 'e.g. Main Channel to VIP'
									}
									class="w-full h-12 bg-[#08090D] border border-white/10 focus:border-[#3390ec] rounded-[14px] px-4 text-[13px] text-white placeholder:text-white/30 outline-none transition-colors"
									required
								/>
							</div>

							{/* Source Channel (Input) */}
							<div class="flex flex-col gap-2">
								<div class="flex items-center justify-between">
									<label class="text-[12px] font-bold text-white/80 flex items-center gap-1.5">
										<span class="text-[#3390ec]">●</span>{' '}
										{t('managedChannels.sourceChannel') || 'Source Channel (Input)'}
									</label>
									<Show when={sourceChannel()}>
										<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/15 px-2 py-0.5 rounded-[6px] border border-[#10b981]/30">
											✓ {t('managedChannels.verified') || 'Verified'}
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
												setSourceInput(
													chosen.chat_username
														? `@${chosen.chat_username}`
														: chosen.chat_title || chosen.title || '',
												);
												setSourceError('');
											}
										}}
										class="w-full h-11 bg-[#08090D] border border-white/10 rounded-[14px] px-3 text-[12px] text-white/80 outline-none"
									>
										<option value="">
											{t('managedChannels.selectFromConnected') ||
												'-- Select from your connected channels --'}
										</option>
										<For each={channels()}>
											{(ch: any) => (
												<option value={ch.id}>
													{ch.chat_title || ch.title} (
													{ch.chat_username
														? `@${ch.chat_username}`
														: (ch.subscribers_count ?? ch.members ?? 0)}
													)
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
											'Source channel @username or link (e.g. @mychannel)'
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
											<Show
												when={sourceChannel()}
												fallback={<span>{t('managedChannels.check') || 'Check'}</span>}
											>
												<span class="material-symbols-outlined text-[18px]">done</span>
												<span>{t('managedChannels.verified') || 'Verified'}</span>
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
													{t('managedChannels.botIsAdmin') || 'Bot is admin & member 🟢'} (
													{sourceChannel()?.subscribers_count || 0}{' '}
													{t('managedChannels.subscribers') || 'subscribers'})
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
										<span class="text-[#10b981]">●</span>{' '}
										{t('managedChannels.targetChannel') || 'Target Channel (Output)'}
									</label>
									<Show when={targetChannel()}>
										<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/15 px-2 py-0.5 rounded-[6px] border border-[#10b981]/30">
											✓ {t('managedChannels.verified') || 'Verified'}
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
												setTargetInput(
													chosen.chat_username
														? `@${chosen.chat_username}`
														: chosen.chat_title || chosen.title || '',
												);
												setTargetError('');
											}
										}}
										class="w-full h-11 bg-[#08090D] border border-white/10 rounded-[14px] px-3 text-[12px] text-white/80 outline-none"
									>
										<option value="">
											{t('managedChannels.selectFromConnected') ||
												'-- Select from your connected channels --'}
										</option>
										<For each={channels()}>
											{(ch: any) => (
												<option value={ch.id}>
													{ch.chat_title || ch.title} (
													{ch.chat_username
														? `@${ch.chat_username}`
														: (ch.subscribers_count ?? ch.members ?? 0)}
													)
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
											'Target channel @username or link (e.g. @targetchan)'
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
											<Show
												when={targetChannel()}
												fallback={<span>{t('managedChannels.check') || 'Check'}</span>}
											>
												<span class="material-symbols-outlined text-[18px]">done</span>
												<span>{t('managedChannels.verified') || 'Verified'}</span>
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
													{t('managedChannels.botIsAdmin') || 'Bot is admin & member 🟢'} (
													{targetChannel()?.subscribers_count || 0}{' '}
													{t('managedChannels.subscribers') || 'subscribers'})
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
									<span>
										{t('managedChannels.createProjectBtn') || 'Create Project (72h Free Trial)'}
									</span>
								</Show>
							</button>
						</form>
					</Motion.div>
				</Motion.div>
			</Show>

			{/* ═══════ DELETE PROJECT MODAL ═══════ */}
			<Show when={projectToDelete()}>
				<Motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					class="fixed inset-0 bg-[#030303]/90 backdrop-blur-2xl z-50 flex items-center justify-center px-5"
					onClick={(e) => {
						if (e.target === e.currentTarget && !isDeletingProject()) setProjectToDelete(null);
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

						<h3 class="text-[20px] font-black text-white mb-2 tracking-tight relative z-10">
							{t('managedChannels.deleteProjectConfirmTitle') || 'Delete Project'}
						</h3>
						<p class="text-[13px] text-white/50 mb-8 leading-relaxed font-medium relative z-10 px-2">
							{t('managedChannels.deleteProjectConfirmDesc') ||
								'Are you sure you want to delete this project and stop auto-forwarding?'}
						</p>

						<div class="w-full flex flex-col gap-3 relative z-10">
							<button
								type="button"
								onClick={handleDeleteProject}
								disabled={isDeletingProject()}
								class="w-full h-14 rounded-[16px] font-black text-[14px] uppercase tracking-widest bg-[#ff4a4a] text-white hover:bg-[#ff3b30] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(255,74,74,0.3)] active:scale-95 border border-white/10"
							>
								<Show
									when={!isDeletingProject()}
									fallback={
										<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
									}
								>
									<span class="material-symbols-outlined text-[20px]">delete</span>{' '}
									{t('managedChannels.delete') || 'Delete'}
								</Show>
							</button>
							<button
								type="button"
								onClick={() => setProjectToDelete(null)}
								disabled={isDeletingProject()}
								class="w-full h-14 rounded-[16px] font-bold text-[14px] uppercase tracking-widest bg-transparent text-white/60 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5 transition-all disabled:opacity-50 active:scale-95"
							>
								{t('common.cancel') || 'Cancel'}
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

						<div class="flex flex-col gap-4">
							<div class="flex flex-col gap-1 text-center mb-1">
								<h3 class="text-[22px] font-black text-white tracking-tight flex items-center justify-center gap-2">
									<span>💎</span>
									<span>{t('botManage.choosePackage') || 'ارتقای پلن پروژه هوشمند'}</span>
								</h3>
								<p class="text-[13px] font-medium text-white/50">
									{t('botManage.selectPlan') || 'فعال‌سازی آنی با کریدیت یا ستاره‌های تلگرام'}
								</p>
							</div>

							{/* ── Credit Balance Hub (Identical to BotManagePage) ── */}
							<div class="flex items-center justify-between w-full bg-gradient-to-r from-[#121829] to-[#0a0d14] border border-[#3390ec]/30 rounded-[22px] p-4 shadow-sm">
								<div class="flex items-center gap-3">
									<span class="text-[24px]">💎</span>
									<div class="flex flex-col text-start">
										<span class="text-[11px] font-black uppercase text-[#3390ec] tracking-wider">
											موجودی کریدیت شما
										</span>
										<span class="text-[14px] font-bold text-white/90 font-mono">
											{wallet.balance() ?? 0} {t('paywall.credit_unit') || 'کریدیت'}
										</span>
									</div>
								</div>
								<button
									type="button"
									onClick={() => {
										try {
											haptic.impact('light');
										} catch {}
										setIsStoreOpen(true);
									}}
									class="px-3.5 py-2 rounded-[14px] bg-[#3390ec]/15 border border-[#3390ec]/30 text-[#3390ec] text-[12px] font-black active:scale-95 transition-all flex items-center gap-1.5 hover:bg-[#3390ec]/25"
								>
									<span>+</span>
									<span>{t('paywall.get_credits') || 'دریافت کریدیت'}</span>
								</button>
							</div>

							{/* Package Selection Cards */}
							<div class="space-y-3">
								<For each={packages() || []}>
									{(pkg: SubscriptionPackage) => {
										const credits =
											pkg.price_credits ||
											(pkg.duration_months === 1
												? 3
												: pkg.duration_months === 3
													? 8
													: pkg.duration_months === 6
														? 15
														: 25);
										const creditsPerMonth = (credits / pkg.duration_months).toFixed(1);
										const isSelected = () => selectedPkg() === pkg.id;

										return (
											<button
												type="button"
												onClick={() => {
													setSelectedPkg(pkg.id);
													haptic.selection();
												}}
												class={`w-full rounded-[24px] p-4 flex items-center justify-between border-[1.5px] transition-all active:scale-[0.98] relative overflow-hidden text-start ${
													isSelected()
														? 'border-[#3390ec] bg-[#3390ec]/10 shadow-[0_8px_25px_rgba(51,144,236,0.15)]'
														: 'border-white/10 bg-[#08090D] hover:border-white/20 hover:bg-[#161b28]'
												}`}
											>
												<Show when={pkg.badge}>
													<div
														class={`absolute top-0 ${isRtl() ? 'left-0 rounded-br-[12px]' : 'right-0 rounded-bl-[12px]'} px-3 py-1 text-[9px] font-black uppercase tracking-widest shadow-sm ${
															pkg.badge === 'best_value'
																? 'bg-amber-400 text-black'
																: 'bg-[#3390ec] text-white'
														}`}
													>
														{pkg.badge === 'best_value'
															? t('botManage.bestValue' as any) || 'بهترین انتخاب'
															: t('botManage.popular' as any) || 'محبوب'}
													</div>
												</Show>

												<div class="flex flex-col items-start gap-1 z-10 relative">
													<div class="flex items-center gap-2">
														<span
															class={`text-[16px] font-black ${isSelected() ? 'text-white' : 'text-white/90'}`}
														>
															{pkg.name}
														</span>
														<Show when={pkg.discount}>
															<span class="text-[10px] font-black text-[#00ff88] bg-[#00ff88]/10 px-2 py-0.5 rounded-[6px] border border-[#00ff88]/20 uppercase tracking-widest shadow-sm">
																تخفیف {pkg.discount}
															</span>
														</Show>
													</div>
													<span class="text-[12px] font-medium text-white/50">
														معادل {pkg.price_stars} ستاره تلگرام (⭐)
													</span>
												</div>

												<div class="flex flex-col items-end gap-0.5 z-10 relative">
													<div class="flex items-baseline gap-1" dir="ltr">
														<span class="text-[22px] font-black font-mono tracking-tight text-white">
															{credits}
														</span>
														<span class="text-[13px] font-black text-[#3390ec]">💎</span>
													</div>
													<span class="text-[10px] font-medium text-white/40">
														({creditsPerMonth} کریدیت / ماه)
													</span>
												</div>
											</button>
										);
									}}
								</For>
							</div>

							<Show when={selectedPkg()}>
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
									const reqCredits =
										pkg.price_credits ||
										(pkg.duration_months === 1
											? 3
											: pkg.duration_months === 3
												? 8
												: pkg.duration_months === 6
													? 15
													: 25);
									const userCreds = wallet.balance() ?? 0;
									const hasEnoughCredits = userCreds >= reqCredits;

									return (
										<div class="space-y-3.5 pt-2">
											<Show
												when={hasEnoughCredits}
												fallback={
													<div class="space-y-3">
														<div class="rounded-[20px] border border-amber-400/25 bg-amber-400/10 p-4 text-start text-[12px]">
															<div class="flex items-center gap-2 text-amber-300 font-bold mb-1">
																<span class="material-symbols-outlined text-[18px]">info</span>
																<span>
																	کسری موجودی: {reqCredits - userCreds} کریدیت نیاز دارید
																</span>
															</div>
															<p class="text-white/60 text-[11px] leading-relaxed">
																موجودی فعلی شما {userCreds} کریدیت است. می‌توانید با سکه/ستاره کریدیت تهیه کنید یا مستقیماً با ستاره پرداخت کنید.
															</p>
														</div>

														<div class="grid grid-cols-2 gap-2.5">
															<button
																type="button"
																onClick={() => {
																	haptic.impact('medium');
																	setIsStoreOpen(true);
																}}
																class="h-13 rounded-[16px] bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black text-[12px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
															>
																<span>⭐</span>
																<span>خرید کریدیت با سکه/ستاره</span>
															</button>
															<button
																type="button"
																onClick={handleSubscribeStars}
																disabled={isProcessing()}
																class="h-13 rounded-[16px] bg-white/10 hover:bg-white/15 text-white font-black text-[12px] uppercase tracking-wider flex items-center justify-center gap-1.5 border border-white/10 active:scale-95 transition-all"
															>
																<span>⭐</span>
																<span>پرداخت مستقیم ({calc().finalStars} ⭐)</span>
															</button>
														</div>
													</div>
												}
											>
												{/* Primary: Pay with Credits */}
												<button
													type="button"
													onClick={handleSubscribeCredits}
													disabled={isProcessing()}
													class="w-full h-14 bg-gradient-to-r from-[#3390ec] via-[#2b7ec9] to-[#1e60a3] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white font-black text-[15px] uppercase tracking-wider rounded-[20px] shadow-[0_8px_30px_rgba(51,144,236,0.35)] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2.5 border border-white/15"
												>
													<span class="text-[20px]">💎</span>
													<span>
														پرداخت و فعال‌سازی با {reqCredits} کریدیت
													</span>
												</button>

												{/* Alternate: Pay with Stars with Voucher */}
												<div class="pt-2">
													<PaymentDiscountCard
														baseUsd={pkg.price_usd}
														baseStars={pkg.price_stars}
														userCoins={balance()}
														isDiscountEnabled={isDiscountEnabled()}
														selectedPercent={discountPercent()}
														onToggleDiscount={(enabled) => setIsDiscountEnabled(enabled)}
														onSelectPercent={(percent) => setDiscountPercent(percent)}
													/>
													<button
														type="button"
														onClick={handleSubscribeStars}
														disabled={isProcessing()}
														class="mt-2 w-full h-11 rounded-[16px] bg-white/5 hover:bg-white/10 text-white/80 font-bold text-xs flex items-center justify-center gap-2 border border-white/10 transition-colors"
													>
														<span>⭐</span>
														<span>یا پرداخت با {calc().finalStars} ستاره تلگرام</span>
													</button>
												</div>
											</Show>
										</div>
									);
								})()}
							</Show>
						</div>

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

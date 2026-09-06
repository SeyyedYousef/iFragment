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
								<h2 class="text-[12px] font-black text-white/50 uppercase tracking-widest">
									{t('managedChannels.yourProjects') || 'Your Projects'}
								</h2>
							</div>
							<span class="text-[11px] font-black text-[#3390ec] bg-[#3390ec]/10 px-2 py-0.5 rounded-[6px] border border-[#3390ec]/20">
								{projects()!.length} {t('managedChannels.projectsCountSuffix') || 'Projects'}
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
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: i() * 0.05 }}
										class="bg-[#12141C]/90 backdrop-blur-xl rounded-[26px] p-5 border border-white/10 hover:border-white/20 flex flex-col gap-4 shadow-lg transition-all relative overflow-hidden group"
									>
										{/* Ambient Card Glow */}
										<div class="absolute -right-8 -top-8 w-32 h-32 bg-[#3390ec]/10 blur-2xl rounded-full pointer-events-none" />

										{/* Top Row: Project Info & Status */}
										<div class="flex items-center justify-between relative z-10">
											<div class="flex items-center gap-3.5 overflow-hidden">
												<div class="w-12 h-12 rounded-[16px] bg-gradient-to-br from-[#3390ec]/25 to-[#3390ec]/5 border border-[#3390ec]/40 flex items-center justify-center text-[#3390ec] shadow-inner shrink-0 group-hover:scale-105 transition-transform">
													<span class="material-symbols-outlined text-[24px]">rocket_launch</span>
												</div>
												<div class="flex flex-col overflow-hidden gap-0.5">
													<h3 class="text-white font-black text-[16px] truncate tracking-tight">
														{project.name}
													</h3>
													<span class="text-[11px] font-bold text-white/40 tracking-wider">
														{t('managedChannels.projectId') || 'Project ID'}:{' '}
														{project.id.slice(0, 8)}
													</span>
												</div>
											</div>

											<div class="flex flex-col items-end shrink-0 gap-1">
												<span
													class={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-[8px] border shadow-sm flex items-center gap-1 ${
														isPaidActive
															? 'text-[#10b981] border-[#10b981]/30 bg-[#10b981]/10'
															: isTrialActive
																? 'text-amber-400 border-amber-400/30 bg-amber-400/10'
																: 'text-[#ff4a4a] border-[#ff4a4a]/30 bg-[#ff4a4a]/10'
													}`}
												>
													{isPaidActive
														? '⭐ ' + (t('managedChannels.activeStatus') || 'PRO (Active)')
														: isTrialActive
															? '🎯 ' + (t('managedChannels.trialBadge72h') || 'TRIAL (72h)')
															: '⚠️ ' + (t('managedChannels.expiredStatus') || 'EXPIRED')}
												</span>
												<Show when={endDateStr}>
													<span class="text-[10px] text-white/70 font-bold font-mono whitespace-nowrap bg-white/5 px-2 py-0.5 rounded-[5px] border border-white/10 flex items-center gap-1">
														<span class="material-symbols-outlined text-[12px] text-amber-400">schedule</span>
														{formatTimeRemaining(endDateStr)}
													</span>
												</Show>
											</div>
										</div>

										{/* Middle Row: Visual Source ➔ Target Flow Card */}
										<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex items-center justify-between gap-2.5 relative z-10 shadow-inner">
											{/* Source Channel Box */}
											<div class="flex-1 flex flex-col gap-1 min-w-0 bg-white/[0.02] p-2.5 rounded-[14px] border border-white/5">
												<div class="flex items-center gap-1.5">
													<span class="w-2 h-2 rounded-full bg-[#3390ec]" />
													<span class="text-[10px] font-bold text-[#3390ec] uppercase tracking-wider">
														{t('managedChannels.sourceBadge') || 'Input (Source)'}
													</span>
												</div>
												<span class="text-[13px] font-black text-white truncate">
													{project.source_title ||
														t('managedChannels.defaultSourceTitle') ||
														'Source Channel'}
												</span>
												<span class="text-[10px] text-white/40 font-mono truncate" dir="ltr">
													{project.source_username
														? `@${project.source_username}`
														: project.source_chat_id
															? `ID: ${project.source_chat_id}`
															: t('managedChannels.connected') || 'Connected'}
												</span>
											</div>

											{/* Flow Arrow */}
											<div class="flex flex-col items-center justify-center shrink-0 px-1">
												<div class="w-8 h-8 rounded-full bg-[#3390ec]/15 border border-[#3390ec]/30 flex items-center justify-center text-[#3390ec] shadow-sm">
													<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">
														arrow_forward
													</span>
												</div>
											</div>

											{/* Target Channel Box */}
											<div class="flex-1 flex flex-col gap-1 min-w-0 bg-white/[0.02] p-2.5 rounded-[14px] border border-white/5">
												<div class="flex items-center gap-1.5">
													<span class="w-2 h-2 rounded-full bg-[#10b981]" />
													<span class="text-[10px] font-bold text-[#10b981] uppercase tracking-wider">
														{t('managedChannels.targetBadge') || 'Output (Target)'}
													</span>
												</div>
												<span class="text-[13px] font-black text-white truncate">
													{project.target_title ||
														t('managedChannels.defaultTargetTitle') ||
														'Target Channel'}
												</span>
												<span class="text-[10px] text-white/40 font-mono truncate" dir="ltr">
													{project.target_username
														? `@${project.target_username}`
														: project.target_chat_id
															? `ID: ${project.target_chat_id}`
															: t('managedChannels.connected') || 'Connected'}
												</span>
											</div>
										</div>

										{/* Subscription & Pricing Information Bar */}
										<div class="bg-gradient-to-r from-white/[0.04] to-white/[0.01] border border-white/10 rounded-[16px] p-3 flex items-center justify-between gap-2 relative z-10">
											<div class="flex items-center gap-2.5 min-w-0">
												<div class={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 border ${
													isPaidActive
														? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30'
														: isTrialActive
															? 'bg-amber-400/15 text-amber-400 border-amber-400/30'
															: 'bg-[#ff4a4a]/15 text-[#ff4a4a] border-[#ff4a4a]/30'
												}`}>
													<span class="material-symbols-outlined text-[18px]">
														{isPaidActive ? 'verified' : isTrialActive ? 'hourglass_top' : 'lock'}
													</span>
												</div>
												<div class="flex flex-col min-w-0">
													<div class="flex items-center gap-2">
														<span class="text-[12px] font-black text-white truncate">
															{isPaidActive
																? 'Pro Channel Plan'
																: isTrialActive
																	? 'Free Trial (72h)'
																	: 'Subscription Expired'}
														</span>
														<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20 font-mono">
															{isPaidActive ? '250 ⭐ / mo' : isTrialActive ? '0 ⭐ (Trial)' : '250 ⭐ / mo'}
														</span>
													</div>
													<span class="text-[10px] text-white/50 truncate">
														{isPaidActive
															? (endDateStr ? `${t('managedChannels.expiresIn') || 'Active until'}: ${new Date(endDateStr).toLocaleDateString()}` : 'Pro Active')
															: isTrialActive
																? (endDateStr ? `${t('managedChannels.trialRemaining') || 'Remaining'}: ${formatTimeRemaining(endDateStr)}` : '72 Hours Trial')
																: (t('managedChannels.subExpiredHint') || 'Requires renewal to resume auto-forwarding & AI')}
													</span>
												</div>
											</div>

											<div class="shrink-0">
												<span class={`text-[10px] font-bold px-2 py-1 rounded-[6px] border ${
													isPaidActive
														? 'text-[#10b981] border-[#10b981]/30 bg-[#10b981]/10'
														: isTrialActive
															? 'text-amber-400 border-amber-400/30 bg-amber-400/10'
															: 'text-[#ff4a4a] border-[#ff4a4a]/30 bg-[#ff4a4a]/10'
												}`}>
													{isPaidActive ? '⭐ Subscribed' : isTrialActive ? '🎯 Trial' : '⚠️ Inactive'}
												</span>
											</div>
										</div>

										{/* Bottom Row: Actions Bar */}
										<div class="flex items-center gap-2 w-full relative z-10 pt-1">
											{/* Manage Channel Dashboard */}
											<button
												type="button"
												onClick={() => {
													haptic.impact('light');
													const targetId =
														project.target_channel_id || project.source_channel_id || project.id;
													navigate(`/channel/${targetId}/dashboard`);
												}}
												class="flex-[1.4] h-11 rounded-[14px] text-[12px] uppercase tracking-wider font-black transition-all bg-[#08090D] text-white/90 border border-white/10 hover:border-[#3390ec]/40 hover:text-[#3390ec] shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
												title={t('channel.menu.dashboard') || 'Channel Dashboard & General Settings'}
											>
												<span class="material-symbols-outlined text-[18px]">dashboard</span>
												<span>{t('channel.menu.dashboard') || 'داشبورد'}</span>
											</button>

											{/* Edit Project Funnel */}
											<button
												type="button"
												onClick={() => {
													haptic.impact('light');
													navigate(`/channel/${project.id}/edit-project`);
												}}
												class="h-11 px-3 rounded-[14px] bg-[#08090D] text-white/70 hover:text-white border border-white/10 hover:border-cyan-500/40 flex items-center justify-center gap-1 transition-all active:scale-95 shrink-0 shadow-sm text-[11px] font-bold"
												title={t('channel.menu.funnel') || 'تنظیمات قیف پروژه'}
											>
												<span class="material-symbols-outlined text-[16px]">tune</span>
												<span>قیف</span>
											</button>

											{/* Subscription Button */}
											<button
												type="button"
												onClick={() => {
													openSubscription(project.id);
												}}
												class={`h-11 rounded-[14px] text-[12px] uppercase tracking-wider font-black transition-all border active:scale-95 flex items-center justify-center gap-1.5 shadow-sm ${
													isPaidActive
														? 'flex-1 bg-white/5 text-white/70 border-white/5 hover:bg-white/10 hover:text-white'
														: 'flex-[1.5] bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] text-white border-white/10 shadow-[0_4px_15px_rgba(51,144,236,0.3)]'
												}`}
											>
												<span class="material-symbols-outlined text-[16px] text-amber-400">stars</span>
												<span>
													{isPaidActive
														? (t('botManage.extendSub') || 'Extend Plan')
														: isTrialActive
															? 'Upgrade Plan'
															: (t('botManage.buySubscription') || 'Subscribe')}
												</span>
											</button>

											{/* Delete Project Button */}
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													haptic.impact('medium');
													setProjectToDelete(project);
												}}
												class="w-11 h-11 rounded-[14px] bg-transparent flex items-center justify-center border border-transparent hover:bg-[#ff4a4a]/10 hover:border-[#ff4a4a]/30 text-white/30 hover:text-[#ff4a4a] transition-all active:scale-95 shrink-0"
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

				{/* ═══════ CONNECTED CHANNELS SECTION ═══════ */}
				<Show when={channels() && channels()!.length > 0}>
					<div class="flex flex-col gap-4 mt-2">
						<div class="flex items-center justify-between mb-1 px-1 border-b border-white/5 pb-2">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-[#10b981] text-[20px]">tv</span>
								<h2 class="text-[12px] font-black text-white/50 uppercase tracking-widest">
									{t('managedChannels.connectedChannels') || 'کانال‌های متصل شما'}
								</h2>
							</div>
							<span class="text-[11px] font-black text-[#10b981] bg-[#10b981]/10 px-2 py-0.5 rounded-[6px] border border-[#10b981]/20">
								{channels()!.length} {t('managedChannels.channelsCountSuffix') || 'کانال'}
							</span>
						</div>

						<For each={channels()}>
							{(ch: ManagedChannel) => (
								<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[22px] p-4 border border-white/10 flex items-center justify-between gap-3 shadow-md hover:border-white/20 transition-all">
									<div class="flex items-center gap-3 min-w-0">
										<div class="w-11 h-11 rounded-[14px] bg-[#3390ec]/15 border border-[#3390ec]/30 flex items-center justify-center text-[#3390ec] font-black text-base shrink-0">
											{(ch.chat_title || 'C').charAt(0).toUpperCase()}
										</div>
										<div class="flex flex-col min-w-0">
											<h3 class="text-white font-black text-[14px] truncate">
												{ch.chat_title}
											</h3>
											<span class="text-[11px] text-white/40 font-mono truncate" dir="ltr">
												{ch.chat_username ? `@${ch.chat_username}` : `ID: ${ch.chat_id}`}
											</span>
										</div>
									</div>

									<button
										type="button"
										onClick={() => {
											haptic.impact('light');
											navigate(`/channel/${ch.id}/dashboard`);
										}}
										class="px-3.5 h-10 rounded-[12px] bg-[#3390ec]/15 hover:bg-[#3390ec]/25 border border-[#3390ec]/30 text-[#3390ec] font-black text-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
									>
										<span class="material-symbols-outlined text-[16px]">dashboard</span>
										<span>{t('channel.menu.dashboard') || 'داشبورد'}</span>
									</button>
								</div>
							)}
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
									<span>⭐</span>
									<span>{t('botManage.choosePackage') || 'Channel Pro Subscription'}</span>
								</h3>
								<p class="text-[13px] font-medium text-white/50">
									{t('botManage.selectPlan') || 'Instant activation with Telegram Stars (⭐)'}
								</p>
							</div>

							{/* Package Selection Cards */}
							<div class="space-y-2.5">
								<For each={packages() || []}>
									{(pkg: SubscriptionPackage) => {
										const isSelected = () => selectedPkg() === pkg.id;
										return (
											<button
												type="button"
												onClick={() => {
													setSelectedPkg(pkg.id);
													haptic.selection();
												}}
												class={`w-full rounded-[22px] p-4 flex items-center justify-between border-2 transition-all active:scale-[0.98] relative overflow-hidden ${
													isSelected()
														? 'border-amber-400 bg-amber-400/10 shadow-[0_8px_25px_rgba(251,191,36,0.15)]'
														: 'border-white/10 bg-[#08090D] hover:border-white/20'
												}`}
											>
												<Show when={pkg.badge}>
													<div
														class={`absolute top-0 ${isRtl() ? 'left-0 rounded-br-[12px]' : 'right-0 rounded-bl-[12px]'} px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-sm ${pkg.badge === 'best_value' ? 'bg-amber-400 text-black' : 'bg-[#3390ec] text-white'}`}
													>
														{pkg.badge === 'best_value'
															? t('botManage.bestValue') || 'Best Value'
															: t('botManage.popular') || 'Popular'}
													</div>
												</Show>

												<div class="flex flex-col items-start gap-0.5">
													<div class="flex items-center gap-2">
														<span
															class={`text-[16px] font-black tracking-tight ${isSelected() ? 'text-amber-400' : 'text-white'}`}
														>
															{pkg.name}
														</span>
														<Show when={pkg.discount}>
															<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/20 px-1.5 py-0.5 rounded-[5px]">
																-{pkg.discount}
															</span>
														</Show>
													</div>
													<span class="text-[11px] font-medium text-white/50">
														{pkg.duration_months === 1
															? 'Full feature access for 30 days'
															: `${pkg.duration_months} months uninterrupted automated service`}
													</span>
												</div>

												<div class="flex flex-col items-end gap-0.5">
													<div class="flex items-center gap-1">
														<span class="text-[20px] font-black font-mono text-white">
															{pkg.price_stars}
														</span>
														<span class="text-[14px]">⭐</span>
													</div>
													<span class="text-[10px] font-semibold text-white/40">
														({(pkg.price_stars / pkg.duration_months).toFixed(0)} ⭐ / mo)
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
												: 25);
									const userCreds = wallet.balance() ?? 0;
									const hasEnoughCredits = userCreds >= reqCredits;

									return (
										<div class="space-y-3 pt-2">
											{/* Discount Voucher (Optional) */}
											<PaymentDiscountCard
												baseUsd={pkg.price_usd}
												baseStars={pkg.price_stars}
												userCoins={balance()}
												isDiscountEnabled={isDiscountEnabled()}
												selectedPercent={discountPercent()}
												onToggleDiscount={(enabled) => setIsDiscountEnabled(enabled)}
												onSelectPercent={(percent) => setDiscountPercent(percent)}
											/>

											{/* Primary Stars Payment CTA */}
											<button
												type="button"
												onClick={handleSubscribeStars}
												disabled={isProcessing()}
												class="w-full h-14 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-amber-400 text-black font-black text-[15px] uppercase tracking-wider rounded-[20px] shadow-[0_8px_30px_rgba(251,191,36,0.35)] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2.5 border border-amber-300/40"
											>
												<span class="text-[20px]">⭐</span>
												<span>
													{t('botManage.payWithStars' as any) || 'Pay with Stars'} (
													{calc().finalStars} ⭐)
												</span>
											</button>

											{/* Alternate: Pay with Credits if user has sufficient balance */}
											<Show when={hasEnoughCredits}>
												<button
													type="button"
													onClick={handleSubscribeCredits}
													disabled={isProcessing()}
													class="w-full py-3 rounded-[16px] bg-white/5 hover:bg-white/10 text-white/80 font-bold text-xs flex items-center justify-center gap-2 border border-white/10 transition-colors"
												>
													<span>💎</span>
													<span>Pay with {reqCredits} Credits (Balance: {userCreds})</span>
												</button>
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

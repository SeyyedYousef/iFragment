import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import {
	type Component,
	createResource,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
import { channelApi } from '@/entities/channel/api/channelApi.js';
import { type SubscriptionPackage, subscriptionApi } from '@/entities/bot/index.js';
import { ChannelContextBar, ChannelHamburgerMenu } from '@/entities/channel/index.js';
import type { ManagedChannel, Project } from '@/entities/channel/model/types.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/index.js';
import { CreditStoreSheet, useWallet } from '@/widgets/paywall/index.js';
import { balance } from '@/entities/airdrop/index.js';
import { PaymentDiscountCard } from '@/shared/ui/payment-discount/PaymentDiscountCard.js';
import { calculateDiscountForPlan } from '@/shared/lib/stars-calculator.js';

export const ProjectsPage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();
	const wallet = useWallet();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [isCreateModalOpen, setIsCreateModalOpen] = createSignal(false);

	// Paywall and Subscription modal state
	const [showSubscription, setShowSubscription] = createSignal(false);
	const [selectedProject, setSelectedProject] = createSignal<Project | null>(null);
	const [selectedPkg, setSelectedPkg] = createSignal<string>('');
	const [isDiscountEnabled, setIsDiscountEnabled] = createSignal(false);
	const [discountPercent, setDiscountPercent] = createSignal<25 | 50 | 75>(50);
	const [isProcessing, setIsProcessing] = createSignal(false);
	const [isStoreOpen, setIsStoreOpen] = createSignal(false);
	const [projectToDelete, setProjectToDelete] = createSignal<string | null>(null);

	// New Project Form Signals
	const [projectName, setProjectName] = createSignal('');
	const [sourceChannelId, setSourceChannelId] = createSignal('');
	const [sourceIdentifier, setSourceIdentifier] = createSignal('');
	const [targetChannelId, setTargetChannelId] = createSignal('');
	const [targetIdentifier, setTargetIdentifier] = createSignal('');
	const [dropMedia, setDropMedia] = createSignal(false);
	const [removeAds, setRemoveAds] = createSignal(true);
	const [removeLinks, setRemoveLinks] = createSignal(false);
	const [removeHashtags, setRemoveHashtags] = createSignal(false);
	const [aiRewrite, setAiRewrite] = createSignal(false);
	const [autoPublish, setAutoPublish] = createSignal(true);
	const [watermark, setWatermark] = createSignal('');
	const [isSubmitting, setIsSubmitting] = createSignal(false);

	const resetForm = () => {
		setProjectName('');
		setSourceChannelId('');
		setSourceIdentifier('');
		setTargetChannelId('');
		setTargetIdentifier('');
		setDropMedia(false);
		setRemoveAds(true);
		setRemoveLinks(false);
		setRemoveHashtags(false);
		setAiRewrite(false);
		setAutoPublish(true);
		setWatermark('');
	};

	// Fast Switcher Signals for existing projects
	const [switchingProjectId, setSwitchingProjectId] = createSignal<string | null>(null);
	const [switchingType, setSwitchingType] = createSignal<'source' | 'target' | null>(null);

	// Fetch Projects and User's Managed Channels
	const [projects, { refetch: refetchProjects }] = createResource(channelApi.getProjects);
	const [userChannels] = createResource(() => channelApi.getUserChannels());
	const [packages] = createResource(subscriptionApi.getPackages);

	onMount(() => {
		try {
			if (backButton.isSupported() && backButton.mount.isAvailable()) {
				backButton.mount();
				backButton.show();
				backButton.onClick(() => {
					haptic.impact('light');
					if (params.id) {
						navigate(`/channel/${params.id}/dashboard`);
					} else {
						navigate('/managed-channels');
					}
				});
			}
		} catch (_e) {}
	});

	onCleanup(() => {
		try {
			if (backButton.isSupported()) {
				backButton.hide();
			}
		} catch (_e) {}
	});

	const handleCreateProject = async (e: Event) => {
		e.preventDefault();
		if (!projectName().trim()) {
			showToast(t('channelProjects.nameRequired') || 'Project name is required', 'error');
			return;
		}

		setIsSubmitting(true);
		haptic.impact('medium');

		try {
			await channelApi.createProject({
				name: projectName().trim(),
				source_channel_id: sourceChannelId() || null,
				source_channel_identifier: sourceIdentifier().trim() || undefined,
				target_channel_id: targetChannelId() || null,
				target_channel_identifier: targetIdentifier().trim() || undefined,
				pipeline_config: {
					drop_media: dropMedia(),
					remove_ads: removeAds(),
					remove_links: removeLinks(),
					remove_hashtags: removeHashtags(),
					ai_rewrite: aiRewrite(),
					watermark: watermark().trim(),
					auto_publish: autoPublish(),
				},
			});

			haptic.notify('success');
			showToast(
				t('channelProjects.createdSuccess') ||
					'Project created successfully with 72h free trial!',
				'success',
			);
			setIsCreateModalOpen(false);
			resetForm();
			refetchProjects();
		} catch (err: any) {
			haptic.notify('error');
			const errorMsg = err?.response?.data?.error || err?.message || 'Failed to create project';
			showToast(errorMsg, 'error');
		} finally {
			setIsSubmitting(false);
		}
	};

	const formatTimeRemaining = (dateStr?: string | null) => {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		const now = new Date();
		const diff = date.getTime() - now.getTime();
		if (diff <= 0) return t('channelProjects.expired') || 'Expired';

		const days = Math.floor(diff / (1000 * 3600 * 24));
		const hours = Math.floor((diff % (1000 * 3600 * 24)) / (1000 * 3600));
		if (days > 0) {
			return t('channelProjects.daysRemainingText', { days }) || `${days} ${t('channelProjects.daysRemaining')}`;
		}
		return t('channelProjects.hoursRemainingText', { hours }) || `${hours} ${t('channelProjects.hoursRemaining')}`;
	};

	const openSubscription = (project: Project) => {
		setSelectedProject(project);
		setSelectedPkg(packages()?.[0]?.id || '1_month');
		setShowSubscription(true);
		haptic.impact('light');
	};

	const handleSubscribeCredits = async () => {
		const proj = selectedProject();
		if (!selectedPkg() || !proj) return;
		setIsProcessing(true);
		try {
			haptic.impact('heavy');
			await subscriptionApi.subscribeChannelWithCredits(proj.id, selectedPkg());
			haptic.notify('success');
			showToast(t('botManage.subscriptionSuccess') || 'Subscription activated successfully!', 'success');
			wallet.refetch();
			refetchProjects();
			setTimeout(() => {
				setShowSubscription(false);
			}, 1000);
		} catch (e: any) {
			const msg = e?.response?.data?.error || e?.message || 'Error activating with credits';
			showToast(msg, 'error');
			haptic.notify('error');
		} finally {
			setIsProcessing(false);
		}
	};

	const handleSubscribeStars = async () => {
		const proj = selectedProject();
		if (!selectedPkg() || !proj) return;
		setIsProcessing(true);
		try {
			const percent = isDiscountEnabled() ? discountPercent() : 0;
			const res = await channelApi.createProjectSubscriptionStarsInvoice(proj.id, selectedPkg(), percent);
			if (res.invoice_link) {
				const tg = (window as any).Telegram?.WebApp;
				if (tg?.openInvoice) {
					tg.openInvoice(res.invoice_link, (status: string) => {
						if (status === 'paid') {
							haptic.notify('success');
							showToast(t('botManage.subscriptionSuccess') || 'Subscription activated successfully!', 'success');
							setShowSubscription(false);
							refetchProjects();
						}
					});
				} else {
					window.open(res.invoice_link, '_blank');
				}
			}
		} catch (err: any) {
			showToast(err?.response?.data?.error || 'Error creating Stars invoice', 'error');
			haptic.notify('error');
		} finally {
			setIsProcessing(false);
		}
	};

	const handleFastSwitchChannel = async (
		projectId: string,
		field: 'source' | 'target',
		newChannelId: string,
	) => {
		haptic.impact('medium');
		try {
			await channelApi.updateProject(projectId, {
				[field === 'source' ? 'source_channel_id' : 'target_channel_id']: newChannelId || null,
			});
			haptic.notify('success');
			showToast(
				t('channel.projects.channel_switched') || 'Channel switched instantly without extra cost!',
				'success',
			);
			setSwitchingProjectId(null);
			setSwitchingType(null);
			refetchProjects();
		} catch (err: any) {
			haptic.notify('error');
			showToast(err?.response?.data?.error || 'Failed to switch channel', 'error');
		}
	};

	const handleDeleteProject = async (projectId: string) => {
		if (
			!confirm(
				t('channelProjects.deleteConfirm') || 'Are you sure you want to delete this project?',
			)
		) {
			return;
		}
		haptic.notify('warning');
		try {
			await channelApi.deleteProject(projectId);
			showToast(t('channelProjects.deletedSuccess') || 'Project deleted successfully', 'info');
			refetchProjects();
		} catch (err: any) {
			showToast(err?.response?.data?.error || 'Failed to delete project', 'error');
		}
	};

	const effectiveChannelId = () =>
		params.id ||
		(projects() && (projects()![0]?.target_channel_id || projects()![0]?.source_channel_id)) ||
		(userChannels() && userChannels()![0]?.id) ||
		'';

	return (
		<div
			class="min-h-screen bg-neutral-950 text-neutral-100 pb-28 pt-2 px-4"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Context Bar */}
			<Show when={effectiveChannelId()}>
				<ChannelContextBar channelId={effectiveChannelId()} />
			</Show>

			{/* Hamburger Drawer */}
			<ChannelHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				channelId={effectiveChannelId()}
				activeTab="projects"
			/>

			{/* ═══════ HEADER ═══════ */}
			<div class="mt-2 mb-6 flex items-center justify-between gap-3 bg-[#12141C]/80 backdrop-blur-xl p-4 rounded-[22px] border border-white/10 shadow-md">
				<div class="flex items-center gap-3 min-w-0">
					<div class="w-11 h-11 rounded-[14px] bg-gradient-to-br from-[#3390ec]/25 to-[#3390ec]/5 border border-[#3390ec]/40 flex items-center justify-center text-[#3390ec] shadow-inner shrink-0">
						<span class="material-symbols-outlined text-[22px]">rocket_launch</span>
					</div>
					<div class="flex flex-col min-w-0">
						<h1 class="text-[17px] font-black tracking-tight text-white truncate">
							{t('channelProjects.title') || 'Smart Forwarding Projects'}
						</h1>
						<p class="text-[11px] text-white/50 font-medium truncate mt-0.5">
							{t('channelProjects.subtitle') || 'Connect input channel to output with AI & smart filters'}
						</p>
					</div>
				</div>

				<div class="flex items-center gap-2 shrink-0">
					<button
						type="button"
						onClick={() => {
							haptic.impact('medium');
							setIsCreateModalOpen(true);
						}}
						class="h-10 px-3.5 rounded-[13px] bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] text-white text-[11px] font-black uppercase tracking-wider shadow-[0_4px_14px_rgba(51,144,236,0.3)] hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5 border border-white/10"
					>
						<span class="material-symbols-outlined text-[16px]">add</span>
						<span>{t('channelProjects.newProject') || 'New Project'}</span>
					</button>

					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							setIsMenuOpen(true);
						}}
						class="w-10 h-10 rounded-[13px] bg-[#090a0f] hover:bg-white/10 flex items-center justify-center border border-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
						aria-label={t('common.toggle') || 'Menu'}
						title={t('channel.menu.title') || 'Menu'}
					>
						<span class="material-symbols-outlined text-[20px]">menu</span>
					</button>
				</div>
			</div>

			{/* ═══════ PROJECTS LIST ═══════ */}
			<div class="space-y-4">
				<Show when={projects.loading}>
					<div class="space-y-3">
						<div class="h-44 rounded-[26px] bg-[#12141C]/50 animate-pulse border border-white/5" />
						<div class="h-44 rounded-[26px] bg-[#12141C]/50 animate-pulse border border-white/5" />
					</div>
				</Show>

				<Show when={!projects.loading && (!projects() || projects()?.length === 0)}>
					<div class="py-12 px-6 rounded-[28px] bg-[#12141C]/80 backdrop-blur-xl border border-white/5 text-center space-y-4 shadow-sm">
						<div class="w-16 h-16 mx-auto rounded-[20px] bg-[#3390ec]/15 border border-[#3390ec]/30 flex items-center justify-center text-3xl shadow-inner text-[#3390ec]">
							<span class="material-symbols-outlined text-[34px]">rocket_launch</span>
						</div>
						<div class="space-y-1">
							<h3 class="text-[17px] font-black text-white">
								{t('channelProjects.emptyTitle') || 'No projects created yet'}
							</h3>
							<p class="text-xs text-white/50 max-w-sm mx-auto leading-relaxed">
								{t('channelProjects.emptyDesc') ||
									'Create your first smart forwarding pipeline with a 72-hour free trial.'}
							</p>
						</div>
						<button
							type="button"
							onClick={() => {
								haptic.impact('medium');
								setIsCreateModalOpen(true);
							}}
							class="py-3 px-5 rounded-[16px] bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-[#3390ec]/25 hover:opacity-95 active:scale-95 transition-all inline-flex items-center gap-2 border border-white/10"
						>
							<span class="material-symbols-outlined text-[18px]">add</span>
							<span>{t('channelProjects.createFirst') || 'Create Project (72h Free Trial)'}</span>
						</button>
					</div>
				</Show>

				<For each={projects()}>
					{(project) => {
						const isPaid = project.stars_subscription_active && (!project.stars_expires_at || new Date(project.stars_expires_at) > new Date());
						const isTrial = !isPaid && project.trial_ends_at && new Date(project.trial_ends_at) > new Date();
						const endDateStr = isPaid ? project.stars_expires_at : project.trial_ends_at;

						return (
							<div class="bg-gradient-to-b from-[#141722]/95 to-[#0d0f17]/95 backdrop-blur-2xl rounded-[28px] p-5 border border-white/10 hover:border-[#3390ec]/30 flex flex-col gap-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)] transition-all relative overflow-hidden group">
								{/* Ambient Glow */}
								<div class="absolute -right-10 -top-10 w-36 h-36 bg-[#3390ec]/10 blur-3xl rounded-full pointer-events-none" />

								{/* ── Top Row: Project Info & Status Badges ── */}
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
												<span>{t('managedChannels.projectId') || 'ID'}:</span>
												<span class="text-white/60 font-semibold">{project.id.slice(0, 8)}</span>
											</div>
										</div>
									</div>

									{/* Status Badges */}
									<div class="flex flex-col items-end shrink-0 gap-1.5">
										<span
											class={`text-[11px] font-black px-3 py-1 rounded-full border shadow-sm flex items-center gap-1.5 ${
												isPaid
													? 'text-[#10b981] border-[#10b981]/30 bg-[#10b981]/15'
													: isTrial
														? 'text-amber-400 border-amber-400/30 bg-amber-400/15'
														: 'text-[#ff4a4a] border-[#ff4a4a]/30 bg-[#ff4a4a]/15'
											}`}
										>
											<span class="w-1.5 h-1.5 rounded-full animate-pulse bg-current" />
											<span>
												{isPaid
													? t('channelProjects.proBadge')
													: isTrial
														? t('channelProjects.trialBadge')
														: t('channelProjects.expiredBadge')}
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
												<span>{t('channelProjects.sourceBadge')}</span>
											</span>
											<button
												type="button"
												onClick={() => {
													setSwitchingProjectId(project.id);
													setSwitchingType('source');
												}}
												class="text-[10px] text-[#3390ec] hover:underline font-bold"
											>
												{t('channelProjects.switchChannel')}
											</button>
										</div>
										<span class="text-[13px] font-black text-white truncate mt-0.5">
											{project.source_title || t('channelProjects.sourceChannel')}
										</span>
										<span class="text-[10px] text-white/50 font-mono truncate" dir="ltr">
											{project.source_username
												? `@${project.source_username}`
												: project.source_chat_id
													? `ID: ${project.source_chat_id}`
													: t('channelProjects.connected')}
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
												<span>{t('channelProjects.targetBadge')}</span>
											</span>
											<button
												type="button"
												onClick={() => {
													setSwitchingProjectId(project.id);
													setSwitchingType('target');
												}}
												class="text-[10px] text-emerald-400 hover:underline font-bold"
											>
												{t('channelProjects.switchChannel')}
											</button>
										</div>
										<span class="text-[13px] font-black text-white truncate mt-0.5">
											{project.target_title || t('channelProjects.targetChannel')}
										</span>
										<span class="text-[10px] text-white/50 font-mono truncate" dir="ltr">
											{project.target_username
												? `@${project.target_username}`
												: project.target_chat_id
													? `ID: ${project.target_chat_id}`
													: t('channelProjects.connected')}
										</span>
									</div>
								</div>

								{/* ── Subscription Plan Ribbon ── */}
								<div class="bg-gradient-to-r from-amber-500/10 via-white/[0.02] to-transparent border border-amber-500/20 rounded-[18px] p-3 flex items-center justify-between gap-3 relative z-10">
									<div class="flex items-center gap-3 min-w-0">
										<div class={`w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0 border ${
											isPaid
												? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
												: isTrial
													? 'bg-amber-400/20 text-amber-400 border-amber-400/30'
													: 'bg-rose-500/20 text-rose-400 border-rose-500/30'
										}`}>
											<span class="material-symbols-outlined text-[20px]">
												{isPaid ? 'verified' : isTrial ? 'military_tech' : 'lock_clock'}
											</span>
										</div>
										<div class="flex flex-col min-w-0">
											<div class="flex items-center gap-2">
												<span class="text-[13px] font-black text-white truncate">
													{isPaid
														? t('channelProjects.activePremium')
														: isTrial
															? t('channelProjects.trialActive')
															: t('channelProjects.expiredPlan')}
												</span>
												<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/30 font-mono shrink-0">
													{isPaid ? t('channelProjects.monthlyPrice') : isTrial ? t('channelProjects.freePrice') : t('channelProjects.monthlyPrice')}
												</span>
											</div>
											<span class="text-[11px] text-white/50 truncate mt-0.5">
												{isPaid
													? (endDateStr ? `${t('channelProjects.trialRemainingPrefix')}${new Date(endDateStr).toLocaleDateString(isRtl() ? 'fa-IR' : undefined)}` : t('channelProjects.activePremium'))
													: isTrial
														? (endDateStr ? `${t('channelProjects.trialRemainingPrefix')}${formatTimeRemaining(endDateStr)}` : t('channelProjects.trialNotice'))
														: t('channelProjects.renewPrompt')}
											</span>
										</div>
									</div>
								</div>

								{/* ── Actions Row: Balanced Buttons ── */}
								<div class="flex items-center gap-2.5 w-full relative z-10 pt-1">
									{/* Edit Settings Button */}
									<button
										type="button"
										onClick={() => {
											haptic.impact('light');
											navigate(`/channel/${project.id}/edit-project`);
										}}
										class="flex-1 h-12 rounded-[18px] text-[13px] font-black transition-all bg-[#090a0f] text-white/90 border border-white/10 hover:border-[#3390ec]/40 hover:text-[#3390ec] shadow-sm active:scale-95 flex items-center justify-center gap-2"
										title={t('channelProjects.projectSettings')}
									>
										<span class="material-symbols-outlined text-[19px]">tune</span>
										<span>{t('channelProjects.projectSettings')}</span>
									</button>

									{/* Subscription Button */}
									<button
										type="button"
										onClick={() => openSubscription(project)}
										class={`flex-[1.2] h-12 rounded-[18px] text-[13px] font-black transition-all border active:scale-95 flex items-center justify-center gap-2 shadow-sm ${
											isPaid
												? 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
												: 'bg-gradient-to-r from-[#3390ec] via-[#2b7ec9] to-[#1e60a3] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white border-white/15 shadow-[0_4px_18px_rgba(51,144,236,0.35)]'
										}`}
									>
										<span class="text-[16px]">💎</span>
										<span>{isPaid ? t('channelProjects.renewPlan') : t('channelProjects.upgradePlan')}</span>
									</button>

									{/* Delete Button */}
									<button
										type="button"
										onClick={() => handleDeleteProject(project.id)}
										class="w-12 h-12 rounded-[18px] bg-[#090a0f] flex items-center justify-center border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/30 text-white/40 hover:text-rose-400 transition-all active:scale-95 shrink-0"
										title={t('channelProjects.deleteProject') || 'Delete Project'}
									>
										<span class="material-symbols-outlined text-[20px]">delete</span>
									</button>
								</div>

								{/* Inline Fast Switcher */}
								<Show when={switchingProjectId() === project.id}>
									<div class="p-3.5 rounded-[18px] bg-[#090a0f] border border-[#3390ec]/30 space-y-2.5 animate-fade-in relative z-10">
										<div class="flex items-center justify-between">
											<span class="text-[12px] font-black text-white flex items-center gap-1.5">
												<span class="material-symbols-outlined text-[16px] text-[#3390ec]">swap_horiz</span>
												<span>
													{switchingType() === 'source'
														? (t('channelProjects.selectNewSource') || 'Select New Input Channel')
														: (t('channelProjects.selectNewTarget') || 'Select New Output Channel')}
												</span>
											</span>
											<button
												type="button"
												onClick={() => {
													setSwitchingProjectId(null);
													setSwitchingType(null);
												}}
												class="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white text-xs transition-colors"
											>
												✕
											</button>
										</div>
										<select
											onChange={(e) => {
												if (e.currentTarget.value) {
													handleFastSwitchChannel(project.id, switchingType()!, e.currentTarget.value);
												}
											}}
											class="w-full py-2.5 px-3 rounded-[12px] bg-[#141722] border border-white/10 text-white text-xs focus:border-[#3390ec] outline-none"
										>
											<option value="">
												{t('channelProjects.selectChannelPlaceholder') || '-- Select Channel --'}
											</option>
											<For each={userChannels()}>
												{(ch: ManagedChannel) => (
													<option value={ch.id}>
														{ch.chat_title} (@{ch.chat_username || ch.chat_id})
													</option>
												)}
											</For>
										</select>
									</div>
								</Show>

								{/* Pipeline Tags */}
								<div class="flex flex-wrap items-center gap-1.5 pt-1 relative z-10">
									<Show when={project.pipeline_config?.remove_ads}>
										<span class="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1">
											<span>🛡️</span>
											<span>{t('channelForwarding.noAds') || 'No Ads'}</span>
										</span>
									</Show>
									<Show when={project.pipeline_config?.remove_links}>
										<span class="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold flex items-center gap-1">
											<span>🔗</span>
											<span>{t('channelForwarding.noLinks') || 'No Links'}</span>
										</span>
									</Show>
									<Show when={project.pipeline_config?.remove_hashtags}>
										<span class="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold flex items-center gap-1">
											<span>#</span>
											<span>{t('channelForwarding.noTags') || 'No Hashtags'}</span>
										</span>
									</Show>
									<Show when={project.pipeline_config?.drop_media}>
										<span class="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold flex items-center gap-1">
											<span>📄</span>
											<span>{t('channelProjects.textOnly') || 'Text Only'}</span>
										</span>
									</Show>
									<Show when={project.pipeline_config?.ai_rewrite}>
										<span class="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold flex items-center gap-1">
											<span>✨</span>
											<span>{t('channelProjects.aiRewrite') || 'AI Rewrite'}</span>
										</span>
									</Show>
								</div>
							</div>
						);
					}}
				</For>
			</div>

			{/* ═══════ CREATE PROJECT MODAL ═══════ */}
			<Show when={isCreateModalOpen()}>
				<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
					<Motion.div
						initial={{ scale: 0.95, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						class="w-full max-w-md rounded-[28px] bg-[#12141C] border border-white/10 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar"
					>
						<div class="flex items-center justify-between pb-3 border-b border-white/10">
							<div class="flex items-center gap-2.5">
								<div class="w-9 h-9 rounded-[12px] bg-[#3390ec]/15 border border-[#3390ec]/30 flex items-center justify-center text-[#3390ec]">
									<span class="material-symbols-outlined text-[20px]">rocket_launch</span>
								</div>
								<h3 class="text-base font-black text-white">
									{t('channelProjects.createModalTitle') || 'Create Smart Forwarding Project'}
								</h3>
							</div>
							<button
								type="button"
								onClick={() => setIsCreateModalOpen(false)}
								class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
							>
								✕
							</button>
						</div>

						<form onSubmit={handleCreateProject} class="space-y-4">
							{/* Project Name */}
							<div class="space-y-1.5">
								<label class="text-[11px] font-black uppercase text-white/70 tracking-wider">
									{t('channelProjects.formName') || 'Project Name'}
								</label>
								<input
									type="text"
									value={projectName()}
									onInput={(e) => setProjectName(e.currentTarget.value)}
									placeholder={t('channelProjects.projectNamePlaceholder') || 'e.g. Main Channel to VIP Archive'}
									class="w-full h-11 px-3.5 rounded-[14px] bg-[#090a0f] border border-white/10 text-white text-xs focus:border-[#3390ec] focus:outline-none transition-colors"
									required
								/>
							</div>

							{/* Source Channel */}
							<div class="space-y-1.5">
								<label class="text-[11px] font-black uppercase text-[#3390ec] tracking-wider flex items-center gap-1.5">
									<span class="w-1.5 h-1.5 rounded-full bg-[#3390ec]" />
									<span>{t('channelProjects.formSource') || 'Source Channel (Input)'}</span>
								</label>
								<select
									value={sourceChannelId()}
									onChange={(e) => setSourceChannelId(e.currentTarget.value)}
									class="w-full h-11 px-3.5 rounded-[14px] bg-[#090a0f] border border-white/10 text-white text-xs focus:border-[#3390ec] focus:outline-none transition-colors"
								>
									<option value="">
										{t('channelProjects.chooseOrType') || '-- Choose from connected channels --'}
									</option>
									<For each={userChannels()}>
										{(ch: ManagedChannel) => (
											<option value={ch.id}>
												{ch.chat_title} (@{ch.chat_username || ch.chat_id})
											</option>
										)}
									</For>
								</select>
								<input
									type="text"
									value={sourceIdentifier()}
									onInput={(e) => setSourceIdentifier(e.currentTarget.value)}
									placeholder={
										t('channelProjects.orPublicUsername') ||
										'Or public username of input channel (e.g. @username)'
									}
									class="w-full h-11 px-3.5 rounded-[14px] bg-[#090a0f] border border-white/10 text-white text-xs focus:border-[#3390ec] focus:outline-none transition-colors mt-1 font-mono"
									dir="ltr"
								/>
							</div>

							{/* Target Channel */}
							<div class="space-y-1.5">
								<label class="text-[11px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
									<span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
									<span>{t('channelProjects.formTarget') || 'Target Channel (Output)'}</span>
								</label>
								<select
									value={targetChannelId()}
									onChange={(e) => setTargetChannelId(e.currentTarget.value)}
									class="w-full h-11 px-3.5 rounded-[14px] bg-[#090a0f] border border-white/10 text-white text-xs focus:border-emerald-500 focus:outline-none transition-colors"
								>
									<option value="">
										{t('channelProjects.selectTargetPlaceholder') ||
											'-- Select connected output channel --'}
									</option>
									<For each={userChannels()}>
										{(ch: ManagedChannel) => (
											<option value={ch.id}>
												{ch.chat_title} (@{ch.chat_username || ch.chat_id})
											</option>
										)}
									</For>
								</select>
								<input
									type="text"
									value={targetIdentifier()}
									onInput={(e) => setTargetIdentifier(e.currentTarget.value)}
									placeholder={
										t('channelProjects.orTargetIdentifier') ||
										'Or public username of output channel (e.g. @myoutput)'
									}
									class="w-full h-11 px-3.5 rounded-[14px] bg-[#090a0f] border border-white/10 text-white text-xs focus:border-emerald-500 focus:outline-none transition-colors mt-1 font-mono"
									dir="ltr"
								/>
							</div>

							{/* Pipeline Toggles */}
							<div class="space-y-2 pt-2 border-t border-white/10">
								<div class="text-[11px] font-black uppercase text-white/60 tracking-wider">
									{t('channelProjects.pipelineOptions') || 'Smart Rules & Pipeline Filters'}
								</div>

								<div class="grid grid-cols-2 gap-2">
									<label class="flex items-center gap-2 p-2.5 rounded-[14px] bg-[#090a0f] border border-white/5 hover:border-white/15 text-xs cursor-pointer transition-colors">
										<input
											type="checkbox"
											checked={removeAds()}
											onChange={(e) => setRemoveAds(e.currentTarget.checked)}
											class="rounded text-[#3390ec]"
										/>
										<span>{t('channelForwarding.noAds') || 'No Ads'}</span>
									</label>

									<label class="flex items-center gap-2 p-2.5 rounded-[14px] bg-[#090a0f] border border-white/5 hover:border-white/15 text-xs cursor-pointer transition-colors">
										<input
											type="checkbox"
											checked={removeLinks()}
											onChange={(e) => setRemoveLinks(e.currentTarget.checked)}
											class="rounded text-[#3390ec]"
										/>
										<span>{t('channelForwarding.noLinks') || 'No Links'}</span>
									</label>

									<label class="flex items-center gap-2 p-2.5 rounded-[14px] bg-[#090a0f] border border-white/5 hover:border-white/15 text-xs cursor-pointer transition-colors">
										<input
											type="checkbox"
											checked={removeHashtags()}
											onChange={(e) => setRemoveHashtags(e.currentTarget.checked)}
											class="rounded text-[#3390ec]"
										/>
										<span>{t('channelForwarding.noTags') || 'No Hashtags'}</span>
									</label>

									<label class="flex items-center gap-2 p-2.5 rounded-[14px] bg-[#090a0f] border border-white/5 hover:border-white/15 text-xs cursor-pointer transition-colors">
										<input
											type="checkbox"
											checked={dropMedia()}
											onChange={(e) => setDropMedia(e.currentTarget.checked)}
											class="rounded text-[#3390ec]"
										/>
										<span>{t('channelProjects.textOnly') || 'Text Only'}</span>
									</label>

									<label class="col-span-2 flex items-center justify-between p-3 rounded-[14px] bg-[#3390ec]/10 border border-[#3390ec]/30 text-xs cursor-pointer transition-colors">
										<div class="flex items-center gap-2">
											<span class="material-symbols-outlined text-[18px] text-[#3390ec]">send</span>
											<div class="flex flex-col text-start">
												<span class="font-bold text-white">{t('channelProjects.autoPublish')}</span>
												<span class="text-[10px] text-white/50">{t('channelProjects.autoPublishDesc')}</span>
											</div>
										</div>
										<input
											type="checkbox"
											checked={autoPublish()}
											onChange={(e) => setAutoPublish(e.currentTarget.checked)}
											class="w-4 h-4 rounded accent-[#3390ec]"
										/>
									</label>

									<label class="col-span-2 flex items-center justify-between p-3 rounded-[14px] bg-[#090a0f] border border-white/5 hover:border-white/15 text-xs cursor-pointer transition-colors">
										<div class="flex items-center gap-2">
											<span class="text-[16px]">✨</span>
											<div class="flex flex-col text-start">
												<span class="font-bold text-white">{t('channelProjects.aiRewrite')}</span>
												<span class="text-[10px] text-white/50">{t('channelProjects.aiRewriteDesc')}</span>
											</div>
										</div>
										<input
											type="checkbox"
											checked={aiRewrite()}
											onChange={(e) => setAiRewrite(e.currentTarget.checked)}
											class="w-4 h-4 rounded accent-[#3390ec]"
										/>
									</label>
								</div>

								{/* Watermark input */}
								<div class="space-y-1 pt-1">
									<label class="text-[11px] font-black uppercase text-white/70 tracking-wider">
										{t('channelProjects.watermarkLabel')}
									</label>
									<input
										type="text"
										value={watermark()}
										onInput={(e) => setWatermark(e.currentTarget.value)}
										placeholder={t('channelProjects.watermarkPlaceholder')}
										class="w-full h-11 px-3.5 rounded-[14px] bg-[#090a0f] border border-white/10 text-white text-xs focus:border-[#3390ec] focus:outline-none transition-colors font-mono"
										dir="ltr"
									/>
								</div>
							</div>

							{/* Submit Button */}
							<button
								type="submit"
								disabled={isSubmitting()}
								class="w-full h-12 rounded-[16px] bg-gradient-to-r from-[#3390ec] via-[#2b7ec9] to-[#1e60a3] text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-[#3390ec]/25 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 border border-white/15"
							>
								<Show when={isSubmitting()}>
									<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
								</Show>
								<span>
									{t('channelProjects.startTrialBtn') || 'Create Project (72h Free Trial)'}
								</span>
							</button>
						</form>
					</Motion.div>
				</div>
			</Show>

			{/* ═══════ SUBSCRIPTION BOTTOM SHEET (CREDIT PAYWALL) ═══════ */}
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
						<div class="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />

						<div class="flex flex-col gap-4">
							<div class="flex flex-col gap-1 text-center mb-1">
								<h3 class="text-[22px] font-black text-white tracking-tight flex items-center justify-center gap-2">
									<span>💎</span>
									<span>{t('botManage.choosePackage')}</span>
								</h3>
								<p class="text-[13px] font-medium text-white/50">
									{t('botManage.selectPlan')}
								</p>
							</div>

							{/* ── Credit Balance Hub ── */}
							<div class="flex items-center justify-between w-full bg-gradient-to-r from-[#121829] to-[#0a0d14] border border-[#3390ec]/30 rounded-[22px] p-4 shadow-sm">
								<div class="flex items-center gap-3">
									<span class="text-[24px]">💎</span>
									<div class="flex flex-col text-start">
										<span class="text-[11px] font-black uppercase text-[#3390ec] tracking-wider">
											{t('paywall.credits_title') || 'CREDITS'}
										</span>
										<span class="text-[14px] font-bold text-white/90 font-mono">
											{wallet.balance() ?? 0} {t('paywall.credit_unit') || 'Credits'}
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
									<span>{t('paywall.get_credits') || t('botManage.buyCreditsStars') || 'Get Credits'}</span>
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
															? (t('botManage.bestValue' as any) || 'Best Value')
															: (t('botManage.popular' as any) || 'Popular')}
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
																{t('channelProjects.discountPrefix') || 'Discount'} {pkg.discount}
															</span>
														</Show>
													</div>
													<span class="text-[12px] font-medium text-white/50">
														{t('botManage.creditsEquivalent', { stars: pkg.price_stars }) || t('channelProjects.equivalentStars', { count: pkg.price_stars }) || `Equivalent to ${pkg.price_stars} Stars (⭐)`}
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
														({creditsPerMonth} {t('channelProjects.creditsPerMonth') || 'credits / mo'})
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
																	{t('botManage.insufficientCredits', { needed: reqCredits - userCreds }) || `(${reqCredits - userCreds} credits needed)`}
																</span>
															</div>
															<p class="text-white/60 text-[11px] leading-relaxed">
																{t('botManage.insufficientCreditsDesc', { current: userCreds }) || ''}
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
																<span>{t('botManage.buyCreditsStars') || 'Get Credits'}</span>
															</button>
															<button
																type="button"
																onClick={handleSubscribeStars}
																disabled={isProcessing()}
																class="h-13 rounded-[16px] bg-white/10 hover:bg-white/15 text-white font-black text-[12px] uppercase tracking-wider flex items-center justify-center gap-1.5 border border-white/10 active:scale-95 transition-all"
															>
																<span>⭐</span>
																<span>{t('botManage.payWithStars') || 'Pay with Stars'} ({calc().finalStars} ⭐)</span>
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
														{t('botManage.payWithCredits', { count: reqCredits }) || `Pay with ${reqCredits} Credits`}
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
														<span>{t('botManage.orPayWith') || 'Or'} {calc().finalStars} ⭐</span>
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
									{t('managedChannels.processing') || t('botManage.processing') || 'Processing...'}
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

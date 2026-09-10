import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
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
import { channelApi } from '@/entities/channel/index.js';
import type { PreflightResult } from '@/entities/channel/model/types.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/index.js';

export const ProjectsHubPage: Component = () => {
	const navigate = useNavigate();

	const [projects, { refetch: refetchProjects }] = createResource(channelApi.getProjects);

	// Create Project Modal & Preflight State
	const [showCreateModal, setShowCreateModal] = createSignal(false);
	const [projectName, setProjectName] = createSignal('');
	const [sourceInput, setSourceInput] = createSignal('');
	const [targetInput, setTargetInput] = createSignal('');
	const [autoPublish, setAutoPublish] = createSignal(false); // Default to review inbox for editorial control
	const [isPreflightChecking, setIsPreflightChecking] = createSignal(false);
	const [preflightResult, setPreflightResult] = createSignal<PreflightResult | null>(null);
	const [isCreating, setIsCreating] = createSignal(false);

	onMount(() => {
		try {
			if (backButton.isSupported() && backButton.mount.isAvailable()) {
				backButton.mount();
				backButton.show();
				backButton.onClick(() => {
					haptic.impact('light');
					navigate('/dashboard');
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

	const handlePreflightCheck = async () => {
		const src = sourceInput().trim();
		const tgt = targetInput().trim();
		if (!src || !tgt) {
			showToast(t('channelProjects.hub.enterBothChannels'), 'error');
			return;
		}

		setIsPreflightChecking(true);
		setPreflightResult(null);
		try {
			haptic.impact('medium');
			const res = await channelApi.checkPreflight(src, tgt);
			setPreflightResult(res);
			if (res.valid) {
				haptic.notify('success');
			} else {
				haptic.notify('error');
			}
		} catch (err: any) {
			haptic.notify('error');
			showToast(err?.response?.data?.error || err?.message || t('channelProjects.hub.preflightFailed'), 'error');
		} finally {
			setIsPreflightChecking(false);
		}
	};

	const handleCreateProject = async (e: Event) => {
		e.preventDefault();
		const name = projectName().trim() || t('channelProjects.context.defaultName');
		const src = sourceInput().trim();
		const tgt = targetInput().trim();

		if (!src || !tgt) {
			showToast(t('channelProjects.hub.fillChannels'), 'error');
			return;
		}

		setIsCreating(true);
		try {
			haptic.impact('heavy');
			const newProject = await channelApi.createProject({
				name,
				source_channel_identifier: src,
				target_channel_identifier: tgt,
				pipeline_config: {
					auto_publish: autoPublish(),
					remove_ads: true,
					remove_links: false,
					ai_rewrite: false,
				},
			});

			haptic.notify('success');
			showToast(t('channelProjects.createdSuccess'), 'success');
			setShowCreateModal(false);
			setProjectName('');
			setSourceInput('');
			setTargetInput('');
			setPreflightResult(null);
			refetchProjects();

			// Navigate directly to the project's dashboard!
			navigate(`/projects/${newProject.id}`);
		} catch (err: any) {
			haptic.notify('error');
			showToast(err?.response?.data?.error || err?.message || t('channelProjects.common.saveError'), 'error');
		} finally {
			setIsCreating(false);
		}
	};

	const formatTimeRemaining = (dateStr?: string | null) => {
		if (!dateStr) return '';
		const diff = new Date(dateStr).getTime() - Date.now();
		if (diff <= 0) return t('channelProjects.context.expired');
		const hours = Math.floor(diff / (1000 * 60 * 60));
		const days = Math.floor(hours / 24);
		if (days > 0) return `${days} ${t('channelProjects.daysRemaining')}`;
		return `${hours} ${t('channelProjects.hoursRemaining')}`;
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-30 border-b border-white/5 flex items-center justify-between shadow-sm">
				<div class="flex items-center gap-3.5 min-w-0">
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							navigate('/dashboard');
						}}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col gap-0.5 min-w-0">
						<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
							{t('channelProjects.hub.title')}
						</h1>
						<span class="text-[11px] font-bold text-white/50 uppercase tracking-wider truncate">
							{t('channelProjects.hub.subtitle')}
						</span>
					</div>
				</div>

				<button
					type="button"
					onClick={() => {
						haptic.impact('medium');
						setShowCreateModal(true);
					}}
					class="h-10 px-3.5 rounded-[12px] bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] text-white text-[12px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[0_4px_14px_rgba(51,144,236,0.35)] active:scale-95 transition-all shrink-0"
				>
					<span class="material-symbols-outlined text-[18px]">add</span>
					<span>{t('channelProjects.hub.newProject')}</span>
				</button>
			</div>

			<div class="px-5 pt-6 flex flex-col gap-6 max-w-md mx-auto relative z-10 w-full">
				<Show
					when={projects() && projects()!.length > 0}
					fallback={
						!projects.loading ? (
							<Motion.div
								initial={{ opacity: 0, y: 15 }}
								animate={{ opacity: 1, y: 0 }}
								class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] p-8 flex flex-col items-center justify-center text-center gap-5 border border-white/5 shadow-sm relative overflow-hidden"
							>
								<div class="w-20 h-20 rounded-[22px] bg-gradient-to-br from-[#3390ec]/20 to-[#3390ec]/5 border border-[#3390ec]/30 flex items-center justify-center shadow-inner">
									<span class="material-symbols-outlined text-[#3390ec] text-[42px]">hub</span>
								</div>
								<div class="flex flex-col gap-2">
									<h3 class="text-white font-black text-[20px] tracking-tight">
										{t('channelProjects.hub.emptyTitle')}
									</h3>
									<p class="text-[12px] text-white/50 leading-relaxed font-medium max-w-[280px]">
										{t('channelProjects.hub.emptyDesc')}
									</p>
								</div>
								<button
									type="button"
									onClick={() => setShowCreateModal(true)}
									class="mt-3 w-full h-13 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] text-white font-black text-[13px] rounded-[16px] flex items-center justify-center gap-2 active:scale-95 shadow-lg"
								>
									<span class="material-symbols-outlined text-[20px]">rocket_launch</span>
									<span>{t('channelProjects.hub.createFirst')}</span>
								</button>
							</Motion.div>
						) : (
							<div class="flex flex-col gap-4">
								<For each={[1, 2]}>
									{() => (
										<div class="bg-[#12141C]/50 rounded-[24px] p-5 border border-white/5 animate-pulse h-40" />
									)}
								</For>
							</div>
						)
					}
				>
					<div class="flex flex-col gap-4">
						<For each={projects()}>
							{(project, i) => {
								const isPaid = project.stars_subscription_active;
								const isTrial = !isPaid && project.status === 'active' && project.trial_ends_at;
								const expiresDate = isPaid ? project.stars_expires_at : project.trial_ends_at;

								return (
									<Motion.div
										initial={{ opacity: 0, y: 12 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: i() * 0.04 }}
										onClick={() => {
											haptic.impact('light');
											navigate(`/projects/${project.id}`);
										}}
										class="bg-gradient-to-b from-[#141722]/95 to-[#0d0f17]/95 backdrop-blur-2xl rounded-[26px] p-5 border border-white/10 hover:border-[#3390ec]/40 flex flex-col gap-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)] transition-all cursor-pointer group"
									>
										{/* Top Row */}
										<div class="flex items-start justify-between gap-3">
											<div class="flex items-center gap-3 min-w-0">
												<div class="w-12 h-12 rounded-[16px] bg-gradient-to-br from-[#3390ec]/20 to-[#3390ec]/5 border border-[#3390ec]/30 flex items-center justify-center text-[#3390ec] shrink-0 group-hover:scale-105 transition-transform">
													<span class="material-symbols-outlined text-[24px]">hub</span>
												</div>
												<div class="flex flex-col min-w-0">
													<h3 class="text-white font-black text-[16px] truncate">
														{project.name}
													</h3>
													<span class="text-[11px] font-mono text-white/40">
														ID: {project.id.slice(0, 8)}
													</span>
												</div>
											</div>

											<div class="flex flex-col items-end gap-1.5 shrink-0">
												<span
													class={`text-[10px] font-black px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
														isPaid
															? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/15'
															: isTrial
																? 'text-amber-400 border-amber-400/30 bg-amber-400/15'
																: 'text-rose-400 border-rose-500/30 bg-rose-500/15'
													}`}
												>
													<span class="w-1.5 h-1.5 rounded-full animate-pulse bg-current" />
													<span>{isPaid ? t('channelProjects.context.premium') : isTrial ? t('channelProjects.context.trial') : t('channelProjects.context.expired')}</span>
												</span>
												<Show when={expiresDate}>
													<span class="text-[10px] font-mono text-white/60">
														{formatTimeRemaining(expiresDate)}
													</span>
												</Show>
											</div>
										</div>

										{/* Source ➔ Target Flow */}
										<div class="bg-[#090a0f]/90 border border-white/5 rounded-[20px] p-3 flex items-center justify-between gap-2 shadow-inner">
											<div class="flex-1 min-w-0 bg-white/[0.03] p-2.5 rounded-[14px] border border-[#3390ec]/20">
												<span class="text-[9px] font-black text-[#3390ec] uppercase block">
													{t('channelProjects.settingsPage.sourceChannel')}
												</span>
												<span class="text-[12px] font-bold text-white truncate block mt-0.5">
													{project.source_title || project.source_username || t('channelProjects.sourceChannel')}
												</span>
											</div>

											<div class="w-8 h-8 rounded-full bg-[#3390ec]/15 border border-[#3390ec]/30 flex items-center justify-center text-[#3390ec] shrink-0">
												<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
											</div>

											<div class="flex-1 min-w-0 bg-white/[0.03] p-2.5 rounded-[14px] border border-emerald-500/20">
												<span class="text-[9px] font-black text-emerald-400 uppercase block">
													{t('channelProjects.settingsPage.targetChannel')}
												</span>
												<span class="text-[12px] font-bold text-white truncate block mt-0.5">
													{project.target_title || project.target_username || t('channelProjects.targetChannel')}
												</span>
											</div>
										</div>

										{/* Quick Action Navigation */}
										<div class="flex items-center gap-2 pt-1">
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													haptic.impact('light');
													navigate(`/projects/${project.id}/inbox`);
												}}
												class="flex-1 h-10 rounded-[14px] bg-[#3390ec]/10 border border-[#3390ec]/30 text-[#3390ec] text-[12px] font-black flex items-center justify-center gap-1.5 hover:bg-[#3390ec]/20 active:scale-95 transition-all"
											>
												<span class="material-symbols-outlined text-[17px]">inbox</span>
												<span>{t('channelProjects.dashboard.inboxCardTitle')}</span>
											</button>

											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													haptic.impact('light');
													navigate(`/projects/${project.id}`);
												}}
												class="flex-1 h-10 rounded-[14px] bg-white/5 border border-white/10 text-white/80 text-[12px] font-bold flex items-center justify-center gap-1.5 hover:bg-white/10 active:scale-95 transition-all"
											>
												<span class="material-symbols-outlined text-[17px]">dashboard</span>
												<span>{t('channelProjects.dashboard.title')}</span>
											</button>
										</div>
									</Motion.div>
								);
							}}
						</For>
					</div>
				</Show>
			</div>

			{/* ═══════ CREATE PROJECT MODAL WITH PREFLIGHT CHECK ═══════ */}
			<Show when={showCreateModal()}>
				<Motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					class="fixed inset-0 bg-[#030303]/90 backdrop-blur-2xl z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
					onClick={(e) => {
						if (e.target === e.currentTarget && !isCreating()) setShowCreateModal(false);
					}}
				>
					<Motion.div
						initial={{ y: '100%' }}
						animate={{ y: 0 }}
						class="w-full max-w-lg bg-[#12141C] rounded-t-[32px] sm:rounded-[32px] border border-white/10 p-6 max-h-[92vh] overflow-y-auto no-scrollbar shadow-2xl"
					>
						<div class="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
							<div class="flex items-center gap-2.5">
								<span class="material-symbols-outlined text-[#3390ec] text-[24px]">rocket_launch</span>
								<h2 class="text-[17px] font-black text-white">{t('channelProjects.hub.newProject')}</h2>
							</div>
							<button
								type="button"
								onClick={() => setShowCreateModal(false)}
								class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white"
							>
								<span class="material-symbols-outlined text-[20px]">close</span>
							</button>
						</div>

						<form onSubmit={handleCreateProject} class="flex flex-col gap-4">
							<div>
								<label class="block text-[12px] font-bold text-white/70 mb-1.5">
									{t('channelProjects.settingsPage.projectName')}
								</label>
								<input
									type="text"
									placeholder={t('channelProjects.namePlaceholder')}
									value={projectName()}
									onInput={(e) => setProjectName(e.currentTarget.value)}
									class="w-full h-12 bg-[#090a0f] rounded-[16px] px-4 text-[13px] text-white border border-white/10 focus:border-[#3390ec] outline-none"
								/>
							</div>

							<div>
								<label class="block text-[12px] font-bold text-white/70 mb-1.5">
									{t('channelProjects.hub.sourceLabel')}
								</label>
								<input
									type="text"
									placeholder={t('channelProjects.hub.sourcePlaceholder')}
									value={sourceInput()}
									onInput={(e) => setSourceInput(e.currentTarget.value)}
									dir="ltr"
									class="w-full h-12 bg-[#090a0f] rounded-[16px] px-4 text-[13px] text-white border border-white/10 focus:border-[#3390ec] outline-none font-mono"
								/>
							</div>

							<div>
								<label class="block text-[12px] font-bold text-white/70 mb-1.5">
									{t('channelProjects.hub.targetLabel')}
								</label>
								<input
									type="text"
									placeholder={t('channelProjects.hub.targetPlaceholder')}
									value={targetInput()}
									onInput={(e) => setTargetInput(e.currentTarget.value)}
									dir="ltr"
									class="w-full h-12 bg-[#090a0f] rounded-[16px] px-4 text-[13px] text-white border border-white/10 focus:border-[#3390ec] outline-none font-mono"
								/>
								<span class="text-[10px] text-white/40 mt-1 block">
									{t('channelProjects.hub.botAdminNotice')}
								</span>
							</div>

							{/* Preflight Button */}
							<button
								type="button"
								onClick={handlePreflightCheck}
								disabled={isPreflightChecking()}
								class="h-11 bg-white/5 hover:bg-white/10 border border-white/15 rounded-[14px] text-[12px] font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-all"
							>
								<span class="material-symbols-outlined text-[18px]">verified_user</span>
								<span>{isPreflightChecking() ? t('channelProjects.hub.preflightChecking') : t('channelProjects.hub.preflightBtn')}</span>
							</button>

							{/* Preflight Result Card */}
							<Show when={preflightResult()}>
								{(res) => (
									<div class={`p-3.5 rounded-[16px] border text-[12px] flex flex-col gap-2 ${
										res().valid
											? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
											: 'bg-rose-500/10 border-rose-500/30 text-rose-300'
									}`}>
										<div class="flex items-center gap-2 font-bold">
											<span class="material-symbols-outlined text-[18px]">
												{res().valid ? 'check_circle' : 'error'}
											</span>
											<span>{res().valid ? t('channelProjects.hub.preflightValid') : t('channelProjects.hub.preflightErrors')}</span>
										</div>
										<Show when={res().errors && res().errors!.length > 0}>
											<ul class="list-disc pr-5 text-[11px] text-rose-400">
												<For each={res().errors}>{(err) => <li>{err}</li>}</For>
											</ul>
										</Show>
									</div>
								)}
							</Show>

							{/* Editorial Workflow Switch */}
							<div class="bg-[#090a0f] p-3.5 rounded-[18px] border border-white/10 flex items-center justify-between gap-3">
								<div class="flex flex-col">
									<span class="text-[12px] font-bold text-white">{t('channelProjects.hub.manualApprovalTitle')}</span>
									<span class="text-[10px] text-white/50">{t('channelProjects.hub.manualApprovalDesc')}</span>
								</div>
								<button
									type="button"
									onClick={() => setAutoPublish(!autoPublish())}
									class={`w-12 h-6 rounded-full transition-colors relative ${
										!autoPublish() ? 'bg-[#3390ec]' : 'bg-white/20'
									}`}
								>
									<span
										class={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
											!autoPublish() ? 'right-6' : 'right-0.5'
										}`}
									/>
								</button>
							</div>

							<button
								type="submit"
								disabled={isCreating()}
								class="h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] text-white font-black text-[13px] rounded-[18px] flex items-center justify-center gap-2 active:scale-95 shadow-lg mt-2"
							>
								<span class="material-symbols-outlined text-[20px]">done</span>
								<span>{isCreating() ? t('channelProjects.hub.creating') : t('channelProjects.hub.createFinalBtn')}</span>
							</button>
						</form>
					</Motion.div>
				</Motion.div>
			</Show>
		</div>
	);
};

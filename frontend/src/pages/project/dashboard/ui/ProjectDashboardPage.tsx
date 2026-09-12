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
import { channelApi } from '@/entities/channel/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/index.js';
import { ProjectContextBar, ProjectHamburgerMenu } from '@/widgets/project/index.js';
import {
	ProjectAutoResponderCard,
	ProjectContentPipelineCard,
	ProjectDynamicBioCard,
	ProjectInlineButtonsCard,
	ProjectJoinRequestsCard,
	ProjectSmartPostingCard,
} from './cards/index.js';

export const ProjectDashboardPage: Component = () => {
	const params = useParams<{ projectId: string }>();
	const navigate = useNavigate();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [activeCategory, setActiveCategory] = createSignal<
		'all' | 'automation' | 'content' | 'security'
	>('all');

	const [project, { refetch: refetchProject }] = createResource(
		() => params.projectId,
		(id) => channelApi.getProject(id),
	);

	const [inboxItems, { refetch: refetchInbox }] = createResource(
		() => params.projectId,
		(id) => channelApi.getProjectInbox(id, 'awaiting_review', 5),
	);

	const [deliveries] = createResource(
		() => params.projectId,
		(id) => channelApi.getProjectDeliveries(id, 5),
	);

	onMount(() => {
		try {
			if (backButton.isSupported() && backButton.mount.isAvailable()) {
				backButton.mount();
				backButton.show();
				backButton.onClick(() => {
					haptic.impact('light');
					navigate('/projects');
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

	const handleQuickApprove = async (contentId: string) => {
		try {
			haptic.impact('heavy');
			await channelApi.approveContent(params.projectId, contentId);
			haptic.notify('success');
			showToast(t('channelProjects.dashboard.approvedSuccess'), 'success');
			refetchInbox();
		} catch (err: any) {
			haptic.notify('error');
			showToast(err?.response?.data?.error || err?.message || t('channelProjects.dashboard.actionError'), 'error');
		}
	};

	const handleQuickReject = async (contentId: string) => {
		try {
			haptic.impact('medium');
			await channelApi.rejectContent(params.projectId, contentId, t('channelProjects.dashboard.quickRejectReason'));
			haptic.notify('success');
			showToast(t('channelProjects.dashboard.rejectedSuccess'), 'success');
			refetchInbox();
		} catch (err: any) {
			haptic.notify('error');
			showToast(t('channelProjects.dashboard.actionError'), 'error');
		}
	};

	const config = () => (project()?.pipeline_config as any) || {};

	const isSingleChannel = () => {
		const p = project();
		if (!p) return false;
		const cfg = (p.pipeline_config as any) || {};
		if (cfg.single_channel_mode) return true;
		const hasSource = !!(p.source_title || p.source_username || p.source_chat_id);
		const hasTarget = !!(p.target_title || p.target_username || p.target_chat_id);
		return (hasSource && !hasTarget) || (!hasSource && hasTarget);
	};

	const isBioActive = () => !!config()?.dynamic_bio?.enabled;
	const bioTarget = () => (config()?.dynamic_bio?.target || 'output') as 'input' | 'output' | 'both';

	const isResponderActive = () => !!config()?.auto_responder?.enabled;
	const responderTarget = () => (config()?.auto_responder?.target || 'output') as 'input' | 'output' | 'both';

	const isButtonsActive = () => !!config()?.inline_buttons?.enabled;
	const buttonsTarget = () => (config()?.inline_buttons?.target || 'output') as 'input' | 'output' | 'both';
	const buttonsCount = () =>
		Array.isArray(config()?.inline_buttons?.buttons) ? config()?.inline_buttons?.buttons.length : 0;

	const isAiActive = () => !!config()?.ai_rewrite;
	const aiModel = () => config()?.ai_model || 'Gemini 3.8 Flash';

	const isPipelineAuto = () => !!config()?.auto_publish;

	const isJoinActive = () => !!config()?.join_requests?.enabled;
	const joinTarget = () => (config()?.join_requests?.target || 'input') as 'input' | 'output' | 'both';

	const handleUpdateConfig = async (patch: (cfg: any) => any, featureLabel?: string) => {
		try {
			const currentCfg = config();
			const updatedCfg = patch({ ...currentCfg });
			await channelApi.updateProject(params.projectId, { pipeline_config: updatedCfg });
			haptic.notify('success');
			if (featureLabel) {
				showToast(t('channelProjects.dashboard.statusToggleToast', { feature: featureLabel }), 'success');
			}
			refetchProject();
		} catch (err: any) {
			haptic.notify('error');
			showToast(err?.response?.data?.error || err?.message || t('channelProjects.dashboard.actionError'), 'error');
		}
	};

	const handleCycleTarget = async (featureKey: string, nextTarget: 'input' | 'output' | 'both') => {
		const targetLabel =
			nextTarget === 'input'
				? t('channelProjects.dashboard.targetInput')
				: nextTarget === 'both'
					? t('channelProjects.dashboard.targetBoth')
					: t('channelProjects.dashboard.targetOutput');

		await handleUpdateConfig((cfg) => {
			cfg[featureKey] = { ...(cfg[featureKey] || {}), target: nextTarget };
			return cfg;
		});
		showToast(t('channelProjects.dashboard.targetCycleToast', { target: targetLabel }), 'info');
	};

	const handleToggleFeature = async (featureKey: string, enabled: boolean, featureLabel?: string) => {
		if (featureKey === 'ai_rewrite') {
			await handleUpdateConfig((cfg) => {
				cfg.ai_rewrite = enabled;
				return cfg;
			}, featureLabel || t('channelProjects.dashboard.featureAi'));
		} else if (featureKey === 'auto_publish') {
			await handleUpdateConfig((cfg) => {
				cfg.auto_publish = enabled;
				return cfg;
			}, featureLabel || t('channelProjects.dashboard.featurePipeline'));
		} else {
			await handleUpdateConfig((cfg) => {
				cfg[featureKey] = { ...(cfg[featureKey] || {}), enabled };
				return cfg;
			}, featureLabel);
		}
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[360px] bg-gradient-to-b from-[#3390ec]/20 via-[#06b6d4]/10 to-transparent blur-[90px] pointer-events-none z-0" />

			{/* ═══════ STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-30 border-b border-white/5 flex items-center justify-between shadow-sm">
				<div class="flex items-center gap-3 min-w-0">
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							navigate('/projects');
						}}
						class="w-10 h-10 rounded-[12px] bg-[#12141C] flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 text-white/80"
						aria-label={t('common.back') || 'Back'}
					>
						<span class="material-symbols-outlined text-[20px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col min-w-0">
						<h1 class="text-[17px] font-black text-white leading-tight truncate tracking-tight">
							{project()?.name || t('channelProjects.dashboard.title')}
						</h1>
						<span class="text-[10px] font-bold text-white/50 uppercase tracking-wider">
							{t('channelProjects.dashboard.subtitle')}
						</span>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							setIsMenuOpen(true);
						}}
						class="w-10 h-10 rounded-[12px] bg-[#12141C] flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all text-white"
					>
						<span class="material-symbols-outlined text-[22px]">menu</span>
					</button>
				</div>
			</div>

			<div class="px-5 pt-5 flex flex-col gap-5 max-w-md mx-auto relative z-10 w-full">
				{/* Project Context Bar */}
				<ProjectContextBar projectId={params.projectId} />

				{/* ═══════ METRICS ROW ═══════ */}
				<div class="grid grid-cols-3 gap-2.5">
					<div
						onClick={() => {
							haptic.impact('light');
							navigate(`/projects/${params.projectId}/inbox`);
						}}
						class="bg-[#12141C]/90 border border-white/10 rounded-[20px] p-3.5 flex flex-col gap-1 cursor-pointer hover:border-[#3390ec]/40 active:scale-95 transition-all shadow-sm"
					>
						<div class="flex items-center justify-between text-[#3390ec]">
							<span class="material-symbols-outlined text-[20px]">inbox</span>
							<span class="text-[10px] font-black uppercase">{t('channelProjects.dashboard.inboxMetric')}</span>
						</div>
						<span class="text-[20px] font-black text-white mt-1">
							{inboxItems() ? inboxItems()!.length : 0}
						</span>
						<span class="text-[10px] text-white/40">{t('channelProjects.dashboard.inboxDesc')}</span>
					</div>

					<div
						onClick={() => {
							haptic.impact('light');
							navigate(`/projects/${params.projectId}/deliveries`);
						}}
						class="bg-[#12141C]/90 border border-white/10 rounded-[20px] p-3.5 flex flex-col gap-1 cursor-pointer hover:border-emerald-500/40 active:scale-95 transition-all shadow-sm"
					>
						<div class="flex items-center justify-between text-emerald-400">
							<span class="material-symbols-outlined text-[20px]">local_shipping</span>
							<span class="text-[10px] font-black uppercase">{t('channelProjects.dashboard.deliveriesMetric')}</span>
						</div>
						<span class="text-[20px] font-black text-white mt-1">
							{deliveries() ? deliveries()!.length : 0}
						</span>
						<span class="text-[10px] text-white/40">{t('channelProjects.dashboard.deliveriesDesc')}</span>
					</div>

					<div
						onClick={() => {
							haptic.impact('light');
							navigate(`/projects/${params.projectId}/pipeline?tab=pipeline`);
						}}
						class="bg-[#12141C]/90 border border-white/10 rounded-[20px] p-3.5 flex flex-col gap-1 cursor-pointer hover:border-amber-400/40 active:scale-95 transition-all shadow-sm"
					>
						<div class="flex items-center justify-between text-amber-400">
							<span class="material-symbols-outlined text-[20px]">tune</span>
							<span class="text-[10px] font-black uppercase">{t('channelProjects.dashboard.pipelineMetric')}</span>
						</div>
						<span class="text-[14px] font-black text-white mt-2">
							{project()?.status === 'active' ? t('channelProjects.common.active') : t('channelProjects.common.paused')}
						</span>
						<span class="text-[10px] text-white/40">{t('channelProjects.dashboard.botStatus')}</span>
					</div>
				</div>

				{/* ═══════ CATEGORY FILTER TABS ═══════ */}
				<div class="flex items-center gap-1.5 p-1 bg-[#12141C]/80 border border-white/10 rounded-[18px] backdrop-blur-md overflow-x-auto no-scrollbar shadow-inner">
					{[
						{ id: 'all', label: t('channelProjects.dashboard.filterAll'), icon: 'stars' },
						{ id: 'automation', label: t('channelProjects.dashboard.filterAutomation'), icon: 'smart_toy' },
						{ id: 'content', label: t('channelProjects.dashboard.filterContent'), icon: 'psychology' },
						{ id: 'security', label: t('channelProjects.dashboard.filterSecurity'), icon: 'shield' },
					].map((tab) => (
						<button
							type="button"
							onClick={() => {
								haptic.impact('light');
								setActiveCategory(tab.id as any);
							}}
							class={`flex items-center gap-1.5 px-3 py-2 rounded-[14px] text-[11px] font-black whitespace-nowrap transition-all flex-1 justify-center ${
								activeCategory() === tab.id
									? 'bg-[#3390ec] text-white shadow-[0_4px_12px_rgba(51,144,236,0.35)]'
									: 'text-white/50 hover:text-white hover:bg-white/5'
							}`}
						>
							<span class="material-symbols-outlined text-[16px]">{tab.icon}</span>
							<span>{tab.label}</span>
						</button>
					))}
				</div>

				{/* ═══════ 🌟 INTERACTIVE LIVE STUDIO CARDS ═══════ */}
				<div class="flex flex-col gap-4">
					{/* Studio 1: Dynamic Bio & Title */}
					<Show when={activeCategory() === 'all' || activeCategory() === 'automation'}>
						<ProjectDynamicBioCard
							projectId={params.projectId}
							isActive={isBioActive()}
							target={bioTarget()}
							isSingleChannel={isSingleChannel()}
							onToggleActive={(active) =>
								handleToggleFeature('dynamic_bio', active, t('channelProjects.dashboard.featureBio'))
							}
							onCycleTarget={(next) => handleCycleTarget('dynamic_bio', next)}
							onNavigate={() => {
								haptic.impact('light');
								navigate(`/projects/${params.projectId}/pipeline?tab=bio`);
							}}
						/>
					</Show>

					{/* Studio 2: Auto-Responder & First Comment */}
					<Show when={activeCategory() === 'all' || activeCategory() === 'automation'}>
						<ProjectAutoResponderCard
							projectId={params.projectId}
							isActive={isResponderActive()}
							target={responderTarget()}
							isSingleChannel={isSingleChannel()}
							onToggleActive={(active) =>
								handleToggleFeature('auto_responder', active, t('channelProjects.dashboard.featureResponder'))
							}
							onCycleTarget={(next) => handleCycleTarget('auto_responder', next)}
							onNavigate={() => {
								haptic.impact('light');
								navigate(`/projects/${params.projectId}/pipeline?tab=responder`);
							}}
						/>
					</Show>

					{/* Studio 3: Inline Glass Buttons */}
					<Show when={activeCategory() === 'all' || activeCategory() === 'automation'}>
						<ProjectInlineButtonsCard
							projectId={params.projectId}
							isActive={isButtonsActive()}
							target={buttonsTarget()}
							buttonCount={buttonsCount()}
							isSingleChannel={isSingleChannel()}
							onToggleActive={(active) =>
								handleToggleFeature('inline_buttons', active, t('channelProjects.dashboard.featureButtons'))
							}
							onCycleTarget={(next) => handleCycleTarget('inline_buttons', next)}
							onNavigate={() => {
								haptic.impact('light');
								navigate(`/projects/${params.projectId}/pipeline?tab=buttons`);
							}}
						/>
					</Show>

					{/* Studio 4: Smart Posting & AI Assistant */}
					<Show when={activeCategory() === 'all' || activeCategory() === 'content'}>
						<ProjectSmartPostingCard
							projectId={params.projectId}
							isActive={isAiActive()}
							aiModel={aiModel()}
							onToggleActive={(active) =>
								handleToggleFeature('ai_rewrite', active, t('channelProjects.dashboard.featureAi'))
							}
							onNavigate={() => {
								haptic.impact('light');
								navigate(`/projects/${params.projectId}/pipeline?tab=ai`);
							}}
						/>
					</Show>

					{/* Studio 5: Content Pipeline & Forwarding Flow */}
					<Show when={activeCategory() === 'all' || activeCategory() === 'content'}>
						<ProjectContentPipelineCard
							projectId={params.projectId}
							isAutoPublish={isPipelineAuto()}
							sourceName={
								project()?.source_title ||
								project()?.source_username ||
								(config()?.source_channel_identifier as string)
							}
							targetName={
								project()?.target_title ||
								project()?.target_username ||
								(config()?.target_channel_identifier as string)
							}
							onToggleAutoPublish={(auto) =>
								handleToggleFeature('auto_publish', auto, t('channelProjects.dashboard.featurePipeline'))
							}
							onNavigate={() => {
								haptic.impact('light');
								navigate(`/projects/${params.projectId}/pipeline?tab=pipeline`);
							}}
						/>
					</Show>

					{/* Studio 6: Join Requests & Gatekeeper Guard */}
					<Show when={activeCategory() === 'all' || activeCategory() === 'security'}>
						<ProjectJoinRequestsCard
							projectId={params.projectId}
							isActive={isJoinActive()}
							target={joinTarget()}
							isSingleChannel={isSingleChannel()}
							onToggleActive={(active) =>
								handleToggleFeature('join_requests', active, t('channelProjects.dashboard.featureJoin'))
							}
							onCycleTarget={(next) => handleCycleTarget('join_requests', next)}
							onNavigate={() => {
								haptic.impact('light');
								navigate(`/projects/${params.projectId}/pipeline?tab=join`);
							}}
						/>
					</Show>
				</div>

				{/* ═══════ OPERATIONS & SETTINGS GRID ═══════ */}
				<div class="grid grid-cols-2 gap-3 pt-1">
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							navigate(`/projects/${params.projectId}/inbox`);
						}}
						class="bg-[#12141C] border border-white/10 hover:border-[#3390ec]/40 rounded-[20px] p-4 flex flex-col items-start gap-2 active:scale-95 transition-all text-start shadow-sm"
					>
						<div class="w-9 h-9 rounded-[12px] bg-[#3390ec]/15 text-[#3390ec] flex items-center justify-center">
							<span class="material-symbols-outlined text-[20px]">inbox</span>
						</div>
						<div class="flex items-center justify-between w-full">
							<span class="text-[13px] font-black text-white">{t('channelProjects.dashboard.inboxCardTitle')}</span>
							<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#3390ec]/15 text-[#3390ec]">
								{inboxItems() ? inboxItems()!.length : 0}
							</span>
						</div>
						<span class="text-[10px] text-white/40">{t('channelProjects.dashboard.inboxCardDesc')}</span>
					</button>

					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							navigate(`/projects/${params.projectId}/deliveries`);
						}}
						class="bg-[#12141C] border border-white/10 hover:border-emerald-500/40 rounded-[20px] p-4 flex flex-col items-start gap-2 active:scale-95 transition-all text-start shadow-sm"
					>
						<div class="w-9 h-9 rounded-[12px] bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
							<span class="material-symbols-outlined text-[20px]">local_shipping</span>
						</div>
						<div class="flex items-center justify-between w-full">
							<span class="text-[13px] font-black text-white">{t('channelProjects.dashboard.deliveriesCardTitle')}</span>
							<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
								{deliveries() ? deliveries()!.length : 0}
							</span>
						</div>
						<span class="text-[10px] text-white/40">{t('channelProjects.dashboard.deliveriesCardDesc')}</span>
					</button>

					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							navigate(`/projects/${params.projectId}/team`);
						}}
						class="bg-[#12141C] border border-white/10 hover:border-sky-400/40 rounded-[20px] p-4 flex flex-col items-start gap-2 active:scale-95 transition-all text-start shadow-sm"
					>
						<div class="w-9 h-9 rounded-[12px] bg-sky-500/15 text-sky-400 flex items-center justify-center">
							<span class="material-symbols-outlined text-[20px]">group</span>
						</div>
						<span class="text-[13px] font-black text-white">{t('channelProjects.dashboard.featureTeam')}</span>
						<span class="text-[10px] text-white/40">{t('channelProjects.dashboard.featureTeamDesc')}</span>
					</button>

					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							navigate(`/projects/${params.projectId}/settings`);
						}}
						class="bg-[#12141C] border border-white/10 hover:border-white/30 rounded-[20px] p-4 flex flex-col items-start gap-2 active:scale-95 transition-all text-start shadow-sm"
					>
						<div class="w-9 h-9 rounded-[12px] bg-white/10 text-white/80 flex items-center justify-center">
							<span class="material-symbols-outlined text-[20px]">settings</span>
						</div>
						<span class="text-[13px] font-black text-white">{t('channelProjects.dashboard.settingsCardTitle')}</span>
						<span class="text-[10px] text-white/40">{t('channelProjects.dashboard.settingsCardDesc')}</span>
					</button>
				</div>

				{/* ═══════ PENDING REVIEW INBOX PREVIEW ═══════ */}
				<div class="flex flex-col gap-3 pt-2">
					<div class="flex items-center justify-between px-1">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-[#3390ec] text-[20px]">mark_email_unread</span>
							<h3 class="text-[14px] font-black text-white">{t('channelProjects.dashboard.readyForReview')}</h3>
						</div>
						<button
							type="button"
							onClick={() => navigate(`/projects/${params.projectId}/inbox`)}
							class="text-[11px] text-[#3390ec] font-bold hover:underline"
						>
							{t('channelProjects.dashboard.viewAll')} ({inboxItems() ? inboxItems()!.length : 0})
						</button>
					</div>

					<Show
						when={inboxItems() && inboxItems()!.length > 0}
						fallback={
							<div class="bg-[#12141C]/60 border border-white/5 rounded-[22px] p-6 text-center text-white/40 text-[12px]">
								{t('channelProjects.dashboard.emptyInboxDesc')}
							</div>
						}
					>
						<For each={inboxItems()!.slice(0, 3)}>
							{(item) => (
								<div class="bg-[#12141C] border border-white/10 rounded-[20px] p-4 flex flex-col gap-3">
									<div class="flex items-center justify-between text-[11px] text-white/40">
										<span>#{item.source_message_id}</span>
										<span>{new Date(item.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
									</div>

									<p class="text-[13px] text-white/90 line-clamp-3 leading-relaxed">
										{item.revision?.text || item.revision?.caption || '...'}
									</p>

									<div class="flex items-center gap-2 pt-1">
										<button
											type="button"
											onClick={() => handleQuickApprove(item.id)}
											class="flex-1 h-9 rounded-[12px] bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-[11px] font-black flex items-center justify-center gap-1 active:scale-95"
										>
											<span class="material-symbols-outlined text-[16px]">check</span>
											<span>{t('channelProjects.dashboard.approvePublish')}</span>
										</button>
										<button
											type="button"
											onClick={() => handleQuickReject(item.id)}
											class="w-9 h-9 rounded-[12px] bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 flex items-center justify-center active:scale-95"
											aria-label={t('channelProjects.dashboard.reject')}
										>
											<span class="material-symbols-outlined text-[16px]">close</span>
										</button>
									</div>
								</div>
							)}
						</For>
					</Show>
				</div>
			</div>

			{/* Project Drawer Menu */}
			<ProjectHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				projectId={params.projectId}
				activeTab="dashboard"
			/>
		</div>
	);
};
